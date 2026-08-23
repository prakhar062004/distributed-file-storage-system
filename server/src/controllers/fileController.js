const fs = require('fs');
const File = require('../models/File');
const Chunk = require('../models/Chunk');
const { chunkFile } = require('../services/chunkingService');
const { getChunkFromNode, deleteChunkFromNode, STORAGE_NODES } = require('../services/storageCoordinator');
const { verifyChecksum } = require('../utils/checksum');

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

    const tempFilePath = req.file.path;

    const chunks = await chunkFile(tempFilePath, file._id);

    fs.unlinkSync(tempFilePath);

    file.status = 'available';
    await file.save();

    res.status(201).json({
      success: true,
      file,
      chunkCount: chunks.length,
    });
  } catch (error) {
    if (file) {
      file.status = 'failed';
      await file.save().catch(() => {});
    }
    next(error);
  }
};

// @desc    List current user's files
// @route   GET /api/files
const listFiles = async (req, res, next) => {
  try {
    const files = await File.find({ ownerId: req.user.id, status: { $ne: 'deleted' } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: files.length, files });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single file metadata
// @route   GET /api/files/:id
const getFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
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
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const chunks = await Chunk.find({ fileId: file._id }).sort({ chunkIndex: 1 });
    if (chunks.length === 0) {
      return res.status(404).json({ success: false, error: 'No chunk data found for this file' });
    }

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
            console.error(`CORRUPTION DETECTED: chunk ${chunk.chunkIndex} on ${nodeId} failed checksum verification, trying next replica`);
            continue;
          }

          chunkData = candidateData;
          break;
        } catch (err) {
          lastError = err;
          console.error(`Replica on ${nodeId} failed for chunk ${chunk.chunkIndex}, trying next replica if available`);
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
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

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
            console.error(`Failed to delete chunk ${chunk.chunkId} from ${nodeId}: ${err.message}`);
          }
        }
      }
    }

    await Chunk.deleteMany({ fileId: file._id });
    await File.deleteOne({ _id: file._id });

    res.status(200).json({ success: true, message: 'File and all chunk replicas deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile, listFiles, getFile, downloadFile, deleteFile, verifyFileIntegrity };