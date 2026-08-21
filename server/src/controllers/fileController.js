const fs = require('fs');
const path = require('path');
const File = require('../models/File');
const Chunk = require('../models/Chunk');
const { chunkFile } = require('../services/chunkingService');

const CHUNKS_DIR = path.join(__dirname, '../../chunks');

// @desc    Upload a file (chunked)
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

    // Original whole-file temp copy is no longer needed once chunked
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

// @desc    Download a file (reconstructed from chunks)
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

    // Stream chunks to the response sequentially, in order
    for (const chunk of chunks) {
      const chunkPath = path.join(CHUNKS_DIR, chunk.chunkId);
      if (!fs.existsSync(chunkPath)) {
        return next(new Error(`Missing chunk ${chunk.chunkIndex} for file ${file._id}`));
      }
      await streamChunkToResponse(chunkPath, res);
    }

    res.end();
  } catch (error) {
    next(error);
  }
};

const streamChunkToResponse = (chunkPath, res) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(chunkPath);
    readStream.on('data', (data) => res.write(data));
    readStream.on('end', resolve);
    readStream.on('error', reject);
  });
};

// @desc    Delete a file and its chunks
// @route   DELETE /api/files/:id
const deleteFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const chunks = await Chunk.find({ fileId: file._id });

    for (const chunk of chunks) {
      const chunkPath = path.join(CHUNKS_DIR, chunk.chunkId);
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    }

    await Chunk.deleteMany({ fileId: file._id });
    await File.deleteOne({ _id: file._id });

    res.status(200).json({ success: true, message: 'File and chunks deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile, listFiles, getFile, downloadFile, deleteFile };