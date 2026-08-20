const fs = require('fs');
const path = require('path');
const File = require('../models/File');

// @desc    Upload a file
// @route   POST /api/files/upload
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const file = await File.create({
      name: req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      ownerId: req.user.id,
      status: 'available', // no chunking yet, so it's immediately available
      storedFilename: req.file.filename, // internal disk filename
    });

    res.status(201).json({ success: true, file });
  } catch (error) {
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
    res.status(200).json({ success: true, file });
  } catch (error) {
    next(error);
  }
};

// @desc    Download a file
// @route   GET /api/files/:id/download
const downloadFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filePath = path.join(__dirname, '../../uploads', file.storedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File data missing on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimeType);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      next(err);
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a file
// @route   DELETE /api/files/:id
const deleteFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filePath = path.join(__dirname, '../../uploads', file.storedFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await File.deleteOne({ _id: file._id });

    res.status(200).json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile, listFiles, getFile, downloadFile, deleteFile };