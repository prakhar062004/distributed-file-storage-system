const Chunk = require('../models/Chunk');
const { getAllNodeStatuses } = require('./nodeHealthService');
const { getChunkFromNode, sendChunkToNode, hashRing, STORAGE_NODES } = require('./storageCoordinator');
const { verifyChecksum } = require('../utils/checksum');

const REPLICATION_FACTOR = parseInt(process.env.REPLICATION_FACTOR, 10) || 1;

/**
 * Scans all chunks, finds any whose storageLocations include an unhealthy
 * node, and repairs them by copying a fresh copy from a healthy replica
 * onto a different healthy node — restoring full replication factor.
 */
const runRecoveryCycle = async () => {
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

  // Find chunks that have at least one replica on an unhealthy node
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
};

const repairChunk = async (chunk, unhealthyNodeIds, healthyNodeIds) => {
  // Which of this chunk's current locations are still actually healthy?
  const survivingLocations = chunk.storageLocations.filter((nodeId) => healthyNodeIds.has(nodeId));

  if (survivingLocations.length === 0) {
    console.error(`[recovery] Chunk ${chunk.chunkId} has NO healthy replicas left — cannot repair, data at risk`);
    return { repaired: false, reason: 'no healthy source replica' };
  }

  if (survivingLocations.length >= REPLICATION_FACTOR) {
    // Already meets replication factor via surviving healthy nodes; just
    // drop the dead node from the record — nothing to copy.
    chunk.storageLocations = survivingLocations;
    await chunk.save();
    return { repaired: true, reason: 'stale location removed, factor already satisfied' };
  }

  // Fetch a good copy from a surviving replica
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

  // Pick a healthy node that doesn't already have this chunk
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

let recoveryIntervalHandle = null;

const startRecoveryLoop = () => {
  const intervalMs = parseInt(process.env.RECOVERY_INTERVAL_MS, 10) || 20000;
  console.log(`[recovery] Starting recovery cycle every ${intervalMs}ms`);

  recoveryIntervalHandle = setInterval(async () => {
    try {
      const result = await runRecoveryCycle();
      if (result.repaired > 0 || result.scanned > 0) {
        console.log(`[recovery] Cycle complete:`, result);
      }
    } catch (err) {
      console.error(`[recovery] Cycle failed: ${err.message}`);
    }
  }, intervalMs);
};

module.exports = { runRecoveryCycle, startRecoveryLoop };