const { recordHeartbeat, getAllNodeStatuses } = require('../services/nodeHealthService');

// @desc    Receive a heartbeat from a storage node
// @route   POST /api/nodes/heartbeat
const receiveHeartbeat = async (req, res, next) => {
  try {
    const { nodeId, url, fileCount, totalSize } = req.body;

    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId is required' });
    }

    await recordHeartbeat(nodeId, { url, fileCount, totalSize });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health status of all storage nodes
// @route   GET /api/nodes/status
const getNodesStatus = async (req, res, next) => {
  try {
    const statuses = await getAllNodeStatuses();
    res.status(200).json({ success: true, nodes: statuses });
  } catch (error) {
    next(error);
  }
};

module.exports = { receiveHeartbeat, getNodesStatus };