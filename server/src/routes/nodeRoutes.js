const express = require('express');
const { protect } = require('../middleware/auth');
const { receiveHeartbeat, getNodesStatus } = require('../controllers/nodeController');

const router = express.Router();

// Heartbeats come from storage nodes, not end users — no auth required for this one
router.post('/heartbeat', receiveHeartbeat);

// Status is useful for the frontend dashboard — require login
router.get('/status', protect, getNodesStatus);

module.exports = router;