const fs = require('fs');
const File = require('../models/File');
const Chunk = require('../models/Chunk');
const { chunkFile } = require('../services/chunkingService');
const { getChunkFromNode, deleteChunkFromNode, STORAGE_NODES } = require('../services/storageCoordinator');
const { verifyChecksum } = require('../utils/checksum');
const redisClient = require('../config/redis');
const { hasPermission } = require('../services/permissionService');
const Share = require('../models/Share');
const logger = require('../utils/logger');

// @desc    Upload a file (chunked, distributed and replicated across storage nodes)
// @route   POST /api/files/upload
const uploadFile = async (req, res, next) => {
  let file;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    file = await File.create({
      name: req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      ownerId: req.user.id,
      status: 'processing',
    });

    // Track upload progress in Redis — ephemeral, only meaningful while upload is in-flight
    const uploadStateKey = `upload:inprogress:${file._id}`;
    await redisClient.set(uploadStateKey, JSON.stringify({
      fileId: file._id,
      ownerId: req.user.id,
      startedAt: Date.now(),
      status: 'chunking',
    }), 'EX', 300); // 5 minute safety TTL — auto-cleans if something goes wrong

    const tempFilePath = req.file.path;

    const chunks = await chunkFile(tempFilePath, file._id);

    fs.unlinkSync(tempFilePath);

    file.status = 'available';
    await file.save();

    await redisClient.del(uploadStateKey); // upload complete — no longer "in progress"
    await redisClient.del(`files:list:${req.user.id}`);

    logger.info('File uploaded', {
      fileId: file._id,
      ownerId: req.user.id,
      chunkCount: chunks.length,
      sizeBytes: file.size,
    });

    res.status(201).json({
      success: true,
      file,
      chunkCount: chunks.length,
    });
  } catch (error) {
    if (file) {
      file.status = 'failed';
      await file.save().catch(() => {});
      logger.error('File upload failed', { fileId: file._id, error: error.message });
    }
    next(error);
  }
};

// @desc    List current user's files
// @route   GET /api/files
const listFiles = async (req, res, next) => {
  try {
    const cacheKey = `files:list:${req.user.id}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const files = JSON.parse(cached);
      return res.status(200).json({ success: true, count: files.length, files, cached: true });
    }

    const files = await File.find({ ownerId: req.user.id, status: { $ne: 'deleted' } }).sort({ createdAt: -1 });

    await redisClient.set(cacheKey, JSON.stringify(files), 'EX', 30); // 30s TTL

    res.status(200).json({ success: true, count: files.length, files, cached: false });
  } catch (error) {
    next(error);
  }
};

// @desc    List the current user's in-progress uploads
// @route   GET /api/files/uploads/in-progress
const getInProgressUploads = async (req, res, next) => {
  try {
    const keys = await redisClient.keys('upload:inprogress:*');
    const uploads = [];

    for (const key of keys) {
      const raw = await redisClient.get(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.ownerId === req.user.id) {
          uploads.push(data);
        }
      }
    }

    res.status(200).json({ success: true, uploads });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single file metadata
// @route   GET /api/files/:id
const getFile = async (req, res, next) => {
  try {
    const allowed = await hasPermission(req.params.id, req.user.id, 'READ');
    if (!allowed) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const file = await File.findById(req.params.id);
    const chunks = await Chunk.find({ fileId: file._id }).sort({ chunkIndex: 1 });
    res.status(200).json({ success: true, file, chunkCount: chunks.length });
  } catch (error) {
    next(error);
  }
};

// @desc    Download a file (reconstructed from chunks, trying each replica in order)
// @route   GET /api/files/:id/download
const downloadFile = async (req, res, next) => {
  try {
    const allowed = await hasPermission(req.params.id, req.user.id, 'READ');
    if (!allowed) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const file = await File.findById(req.params.id);

    const chunks = await Chunk.find({ fileId: file._id }).sort({ chunkIndex: 1 });
    if (chunks.length === 0) {
      return res.status(404).json({ success: false, error: 'No chunk data found for this file' });
    }

    logger.info('File download started', {
      fileId: file._id,
      userId: req.user.id,
      chunkCount: chunks.length,
    });

    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimeType);

    for (const chunk of chunks) {
      let chunkData = null;
      let lastError = null;

      for (const nodeId of chunk.storageLocations) {
        const node = STORAGE_NODES.find((n) => n.nodeId === nodeId);
        if (!node) continue;

        try {
          const candidateData = await getChunkFromNode(node, chunk.chunkId);

          if (!verifyChecksum(candidateData, chunk.checksum)) {
            lastError = new Error(`Checksum mismatch — data corruption detected on ${nodeId}`);
            logger.error('Chunk corruption detected', {
              chunkId: chunk.chunkId,
              chunkIndex: chunk.chunkIndex,
              nodeId,
            });
            continue;
          }

          chunkData = candidateData;
          break;
        } catch (err) {
          lastError = err;
          logger.warn('Replica unreachable, trying next replica', {
            chunkId: chunk.chunkId,
            chunkIndex: chunk.chunkIndex,
            nodeId,
            error: err.message,
          });
        }
      }

      if (!chunkData) {
        return next(new Error(`All replicas failed or were corrupted for chunk ${chunk.chunkIndex}: ${lastError?.message}`));
      }

      res.write(chunkData);
    }

    res.end();
  } catch (error) {
    next(error);
  }
};

// @desc    Verify integrity of all chunks for a file (checks every replica)
// @route   GET /api/files/:id/verify
const verifyFileIntegrity = async (req, res, next) => {
  try {
    const allowed = await hasPermission(req.params.id, req.user.id, 'READ');
    if (!allowed) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const file = await File.findById(req.params.id);
    const chunks = await Chunk.find({ fileId: file._id }).sort({ chunkIndex: 1 });

    const report = [];

    for (const chunk of chunks) {
      const chunkReport = { chunkIndex: chunk.chunkIndex, chunkId: chunk.chunkId, replicas: [] };

      for (const nodeId of chunk.storageLocations) {
        const node = STORAGE_NODES.find((n) => n.nodeId === nodeId);
        if (!node) {
          chunkReport.replicas.push({ nodeId, status: 'unknown-node' });
          continue;
        }

        try {
          const data = await getChunkFromNode(node, chunk.chunkId);
          const isValid = verifyChecksum(data, chunk.checksum);
          chunkReport.replicas.push({ nodeId, status: isValid ? 'ok' : 'corrupted' });
        } catch (err) {
          chunkReport.replicas.push({ nodeId, status: 'unreachable' });
        }
      }

      report.push(chunkReport);
    }

    const allHealthy = report.every((c) => c.replicas.some((r) => r.status === 'ok'));

    res.status(200).json({ success: true, fileId: file._id, allHealthy, chunks: report });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a file and all its chunk replicas across storage nodes
// @route   DELETE /api/files/:id
const deleteFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const chunks = await Chunk.find({ fileId: file._id });

    for (const chunk of chunks) {
      for (const nodeId of chunk.storageLocations) {
        const node = STORAGE_NODES.find((n) => n.nodeId === nodeId);
        if (node) {
          try {
            await deleteChunkFromNode(node, chunk.chunkId);
          } catch (err) {
            logger.warn('Failed to delete chunk from node', {
              chunkId: chunk.chunkId,
              nodeId,
              error: err.message,
            });
          }
        }
      }
    }

    await Chunk.deleteMany({ fileId: file._id });
    await File.deleteOne({ _id: file._id });
    await Share.deleteMany({ fileId: file._id });
    await redisClient.del(`files:list:${req.user.id}`);

    logger.info('File deleted', { fileId: file._id, ownerId: req.user.id, chunkCount: chunks.length });

    res.status(200).json({ success: true, message: 'File and all chunk replicas deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  listFiles,
  getInProgressUploads,
  getFile,
  downloadFile,
  deleteFile,
  verifyFileIntegrity,
};