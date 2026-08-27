const axios = require('axios');
const FormData = require('form-data');
const STORAGE_NODES = require('../config/storageNodes');
const ConsistentHashRing = require('./consistentHash');

const NODE_REQUEST_TIMEOUT_MS = parseInt(process.env.NODE_REQUEST_TIMEOUT_MS, 10) || 3000;

let roundRobinIndex = 0;
const hashRing = new ConsistentHashRing(STORAGE_NODES);

/**
 * Round-robin node selection (legacy/reference — kept for comparison, no longer used by default).
 */
const selectNodeRoundRobin = () => {
  const node = STORAGE_NODES[roundRobinIndex % STORAGE_NODES.length];
  roundRobinIndex++;
  return node;
};

/**
 * Consistent-hashing node selection: the chunk's own ID determines its node
 * deterministically. Same chunkId always maps to the same node (until the
 * ring itself changes), and adding/removing a node only reshuffles a small
 * fraction of keys instead of nearly all of them.
 */
const selectNodeConsistentHash = (chunkId) => {
  return hashRing.getNode(chunkId);
};

/**
 * Returns `replicationFactor` distinct nodes for a chunk, using the hash
 * ring's clockwise walk. The first node returned is the "primary" placement;
 * the rest are replicas.
 */
const selectNodesForReplication = (chunkId, replicationFactor) => {
  return hashRing.getNodes(chunkId, replicationFactor);
};

/**
 * All storage-node HTTP calls use an explicit timeout (default 3s, via
 * NODE_REQUEST_TIMEOUT_MS) rather than relying on the OS's much longer
 * default TCP timeout. This makes failover to a healthy replica fast when
 * a node is dead, instead of waiting tens of seconds per failed attempt.
 */
const sendChunkToNode = async (node, chunkId, buffer) => {
  const form = new FormData();
  form.append('chunkId', chunkId);
  form.append('chunk', buffer, { filename: chunkId });

  const response = await axios.post(`${node.url}/internal/chunks`, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: NODE_REQUEST_TIMEOUT_MS,
  });

  return response.data;
};

const getChunkFromNode = async (node, chunkId) => {
  const response = await axios.get(`${node.url}/internal/chunks/${chunkId}`, {
    responseType: 'arraybuffer',
    timeout: NODE_REQUEST_TIMEOUT_MS,
  });
  return Buffer.from(response.data);
};

const deleteChunkFromNode = async (node, chunkId) => {
  await axios.delete(`${node.url}/internal/chunks/${chunkId}`, {
    timeout: NODE_REQUEST_TIMEOUT_MS,
  });
};

module.exports = {
  selectNodeRoundRobin,
  selectNodeConsistentHash,
  selectNodesForReplication,
  sendChunkToNode,
  getChunkFromNode,
  deleteChunkFromNode,
  STORAGE_NODES,
  hashRing,
};