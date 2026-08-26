const express = require('express');
const { protect } = require('../middleware/auth');
const { shareFile, revokeShare, listShares, listSharedWithMe } = require('../controllers/shareController');

const router = express.Router();

router.use(protect);

router.get('/shared-with-me', listSharedWithMe);
router.post('/:fileId/share', shareFile);
router.get('/:fileId/shares', listShares);
router.delete('/:fileId/share/:userId', revokeShare);

module.exports = router;