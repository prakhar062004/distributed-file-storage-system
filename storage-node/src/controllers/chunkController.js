const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '../../', process.env.STORAGE_PATH);

// @desc    Store a chunk
// @route   POST /internal/chunks
const storeChunk = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No chunk data provided' });
    }

    // multer already wrote it to STORAGE_PATH with the chunkId as filename
    res.status(201).json({
      success: true,
      nodeId: process.env.NODE_ID,
      chunkId: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Retrieve a chunk
// @route   GET /internal/chunks/:chunkId
const getChunk = async (req, res, next) => {
  try {
    const chunkPath = path.join(STORAGE_PATH, req.params.chunkId);

    if (!fs.existsSync(chunkPath)) {
      return res.status(404).json({ success: false, error: 'Chunk not found on this node' });
    }

    const readStream = fs.createReadStream(chunkPath);
    readStream.pipe(res);

    readStream.on('error', (err) => next(err));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a chunk
// @route   DELETE /internal/chunks/:chunkId
const deleteChunk = async (req, res, next) => {
  try {
    const chunkPath = path.join(STORAGE_PATH, req.params.chunkId);

    if (!fs.existsSync(chunkPath)) {
      return res.status(404).json({ success: false, error: 'Chunk not found on this node' });
    }

    fs.unlinkSync(chunkPath);

    res.status(200).json({ success: true, message: 'Chunk deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Health check
// @route   GET /internal/health
const healthCheck = async (req, res) => {
  const stats = fs.statSync(STORAGE_PATH);

  res.status(200).json({
    success: true,
    nodeId: process.env.NODE_ID,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { storeChunk, getChunk, deleteChunk, healthCheck };