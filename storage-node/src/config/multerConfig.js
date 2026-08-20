const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../', process.env.STORAGE_PATH));
  },
  filename: (req, file, cb) => {
    // If the caller (backend) provides a chunkId, use it; otherwise generate one
    const chunkId = req.body.chunkId || crypto.randomBytes(16).toString('hex');
    cb(null, chunkId);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per chunk max, configurable later
  },
});

module.exports = upload;