const fs = require('fs');
const File = require('../models/File');
const Chunk = require('../models/Chunk');
const { chunkFile } = require('../services/chunkingService');
const { getChunkFromNode, deleteChunkFromNode, STORAGE_NODES } = require('../services/storageCoordinator');

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

      // Try each replica location in order until one succeeds
      for (const nodeId of chunk.storageLocations) {
        const node = STORAGE_NODES.find((n) => n.nodeId === nodeId);
        if (!node) continue;

        try {
          chunkData = await getChunkFromNode(node, chunk.chunkId);
          break; // success — no need to try further replicas
        } catch (err) {
          lastError = err;
          console.error(`Replica on ${nodeId} failed for chunk ${chunk.chunkIndex}, trying next replica if available`);
        }
      }

      if (!chunkData) {
        return next(new Error(`All replicas failed for chunk ${chunk.chunkIndex}: ${lastError?.message}`));
      }

      res.write(chunkData);
    }

    res.end();
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
            // Log but don't block deletion — the metadata record is the source of truth
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

module.exports = { uploadFile, listFiles, getFile, downloadFile, deleteFile };