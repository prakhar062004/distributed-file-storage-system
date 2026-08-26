const Chunk = require('../models/Chunk');
const { getAllNodeStatuses } = require('./nodeHealthService');
const { getChunkFromNode, sendChunkToNode, hashRing, STORAGE_NODES } = require('./storageCoordinator');
const { verifyChecksum } = require('../utils/checksum');
const { acquireLock, releaseLock } = require('../utils/distributedLock');

const REPLICATION_FACTOR = parseInt(process.env.REPLICATION_FACTOR, 10) || 1;
const RECOVERY_LOCK_KEY = 'lock:recovery-cycle';

/**
 * Scans all chunks, finds any whose storageLocations include an unhealthy
 * node, and repairs them by copying a fresh copy from a healthy replica
 * onto a different healthy node — restoring full replication factor.
 * Guarded by a distributed lock so overlapping cycles (timer + manual
 * trigger) can never run concurrently.
 */
const runRecoveryCycle = async () => {
  const lockToken = await acquireLock(RECOVERY_LOCK_KEY, 30000);

  if (!lockToken) {
    console.log('[recovery] Another recovery cycle is already in progress — skipping this run');
    return { scanned: 0, repaired: 0, skipped: 0, message: 'Skipped — recovery already in progress' };
  }

  try {
    const nodeStatuses = await getAllNodeStatuses();
    const unhealthyNodeIds = new Set(
      nodeStatuses.filter((n) => n.status === 'unhealthy').map((n) => n.nodeId)
    );
    const healthyNodeIds = new Set(
      nodeStatuses.filter((n) => n.status === 'healthy').map((n) => n.nodeId)
    );

    if (unhealthyNodeIds.size === 0) {
      return { scanned: 0, repaired: 0, skipped: 0, message: 'All nodes healthy — nothing to recover' };
    }

    console.log(`[recovery] Detected unhealthy nodes: ${[...unhealthyNodeIds].join(', ')}`);

    const affectedChunks = await Chunk.find({
      storageLocations: { $in: [...unhealthyNodeIds] },
    });

    let repaired = 0;
    let skipped = 0;

    for (const chunk of affectedChunks) {
      const result = await repairChunk(chunk, unhealthyNodeIds, healthyNodeIds);
      if (result.repaired) repaired++;
      else skipped++;
    }

    return { scanned: affectedChunks.length, repaired, skipped };
  } finally {
    await releaseLock(RECOVERY_LOCK_KEY, lockToken);
  }
};

const repairChunk = async (chunk, unhealthyNodeIds, healthyNodeIds) => {
  const survivingLocations = chunk.storageLocations.filter((nodeId) => healthyNodeIds.has(nodeId));

  if (survivingLocations.length === 0) {
    console.error(`[recovery] Chunk ${chunk.chunkId} has NO healthy replicas left — cannot repair, data at risk`);
    return { repaired: false, reason: 'no healthy source replica' };
  }

  if (survivingLocations.length >= REPLICATION_FACTOR) {
    chunk.storageLocations = survivingLocations;
    await chunk.save();
    return { repaired: true, reason: 'stale location removed, factor already satisfied' };
  }

  const sourceNodeId = survivingLocations[0];
  const sourceNode = STORAGE_NODES.find((n) => n.nodeId === sourceNodeId);

  let data;
  try {
    data = await getChunkFromNode(sourceNode, chunk.chunkId);
    if (!verifyChecksum(data, chunk.checksum)) {
      console.error(`[recovery] Source replica ${sourceNodeId} for chunk ${chunk.chunkId} is itself corrupted — skipping`);
      return { repaired: false, reason: 'source replica corrupted' };
    }
  } catch (err) {
    console.error(`[recovery] Failed to fetch source copy of chunk ${chunk.chunkId} from ${sourceNodeId}: ${err.message}`);
    return { repaired: false, reason: 'source fetch failed' };
  }

  const candidateNodes = [...healthyNodeIds].filter((id) => !survivingLocations.includes(id));

  if (candidateNodes.length === 0) {
    console.error(`[recovery] No healthy target node available to re-replicate chunk ${chunk.chunkId}`);
    return { repaired: false, reason: 'no available target node' };
  }

  const targetNodeId = candidateNodes[0];
  const targetNode = STORAGE_NODES.find((n) => n.nodeId === targetNodeId);

  try {
    await sendChunkToNode(targetNode, chunk.chunkId, data);
  } catch (err) {
    console.error(`[recovery] Failed to write recovered chunk ${chunk.chunkId} to ${targetNodeId}: ${err.message}`);
    return { repaired: false, reason: 'target write failed' };
  }

  chunk.storageLocations = [...survivingLocations, targetNodeId];
  await chunk.save();

  console.log(`[recovery] Repaired chunk ${chunk.chunkId}: now on [${chunk.storageLocations.join(', ')}]`);
  return { repaired: true, reason: 'replicated to new node' };
};

module.exports = { runRecoveryCycle, repairChunk };