const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const HEARTBEAT_KEY_PREFIX = 'node:heartbeat:';
const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.HEARTBEAT_TIMEOUT_MS, 10) || 15000;

/**
 * Records a heartbeat from a storage node. Stored in Redis with a TTL
 * slightly longer than the timeout — if a node truly goes silent, its
 * key naturally expires from Redis rather than needing manual cleanup.
 */
const recordHeartbeat = async (nodeId, data) => {
  const key = `${HEARTBEAT_KEY_PREFIX}${nodeId}`;
  const payload = JSON.stringify({ ...data, lastSeen: Date.now() });
  await redisClient.set(key, payload, 'PX', HEARTBEAT_TIMEOUT_MS * 2);
};

/**
 * Determines a node's current health status based on when its last
 * heartbeat was recorded, relative to the configured timeout.
 */
const getNodeStatus = async (nodeId) => {
  const key = `${HEARTBEAT_KEY_PREFIX}${nodeId}`;
  const raw = await redisClient.get(key);
  if (!raw) {
    logger.warn('Node has no heartbeat record', { nodeId });
    return { nodeId, status: 'unhealthy', reason: 'no heartbeat received', lastSeen: null };
  }

  const data = JSON.parse(raw);
  const elapsed = Date.now() - data.lastSeen;

  if (elapsed > HEARTBEAT_TIMEOUT_MS) {
    logger.warn('Node heartbeat overdue', { nodeId, elapsedMs: elapsed });
    return { nodeId, status: 'unhealthy', reason: 'heartbeat overdue', lastSeen: data.lastSeen, elapsed };
  }

  return { nodeId, status: 'healthy', lastSeen: data.lastSeen, elapsed, ...data };
};

/**
 * Returns health status for every known storage node.
 */
const getAllNodeStatuses = async () => {
  const STORAGE_NODES = require('../config/storageNodes');
  const statuses = await Promise.all(STORAGE_NODES.map((n) => getNodeStatus(n.nodeId)));
  return statuses;
};

module.exports = { recordHeartbeat, getNodeStatus, getAllNodeStatuses };