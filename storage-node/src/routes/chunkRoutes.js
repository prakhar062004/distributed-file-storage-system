const express = require('express');
const upload = require('../config/multerConfig');
const { storeChunk, getChunk, deleteChunk, healthCheck } = require('../controllers/chunkController');

const router = express.Router();

router.post('/chunks', upload.single('chunk'), storeChunk);
router.get('/chunks/:chunkId', getChunk);
router.delete('/chunks/:chunkId', deleteChunk);
router.get('/health', healthCheck);

module.exports = router;