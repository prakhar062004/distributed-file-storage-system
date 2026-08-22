const axios = require('axios');
const FormData = require('form-data');
const STORAGE_NODES = require('../config/storageNodes');
const ConsistentHashRing = require('./consistentHash');

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

const sendChunkToNode = async (node, chunkId, buffer) => {
  const form = new FormData();
  form.append('chunkId', chunkId);
  form.append('chunk', buffer, { filename: chunkId });

  const response = await axios.post(`${node.url}/internal/chunks`, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return response.data;
};

const getChunkFromNode = async (node, chunkId) => {
  const response = await axios.get(`${node.url}/internal/chunks/${chunkId}`, {
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
};

const deleteChunkFromNode = async (node, chunkId) => {
  await axios.delete(`${node.url}/internal/chunks/${chunkId}`);
};

module.exports = {
  selectNodeRoundRobin,
  selectNodeConsistentHash,
  sendChunkToNode,
  getChunkFromNode,
  deleteChunkFromNode,
  STORAGE_NODES,
  hashRing,
};