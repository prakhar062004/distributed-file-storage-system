const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../config/multerConfig');
const {
  uploadFile,
  listFiles,
  getFile,
  downloadFile,
  deleteFile,
  verifyFileIntegrity,
} = require('../controllers/fileController');

const router = express.Router();

router.use(protect); // every route below requires authentication

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', listFiles);
router.get('/:id', getFile);
router.get('/:id/download', downloadFile);
router.get('/:id/verify', verifyFileIntegrity);
router.delete('/:id', deleteFile);

module.exports = router;