const fs = require('fs');
const crypto = require('crypto');
const Chunk = require('../models/Chunk');
const { selectNodesForReplication, sendChunkToNode } = require('./storageCoordinator');

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE, 10) || 1048576;
const REPLICATION_FACTOR = parseInt(process.env.REPLICATION_FACTOR, 10) || 1;

/**
 * Reads a file from disk in a streaming fashion, splits it into fixed-size
 * chunks, and sends each chunk to REPLICATION_FACTOR storage nodes (selected
 * via consistent hashing) instead of writing to local disk.
 */
const chunkFile = async (sourceFilePath, fileId) => {
  const createdChunks = [];
  let buffer = Buffer.alloc(0);
  let chunkIndex = 0;

  const readStream = fs.createReadStream(sourceFilePath);

  for await (const data of readStream) {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length >= CHUNK_SIZE) {
      const chunkData = buffer.subarray(0, CHUNK_SIZE);
      buffer = buffer.subarray(CHUNK_SIZE);
      const chunk = await distributeChunk(fileId, chunkIndex, chunkData);
      createdChunks.push(chunk);
      chunkIndex++;
    }
  }

  if (buffer.length > 0) {
    const chunk = await distributeChunk(fileId, chunkIndex, buffer);
    createdChunks.push(chunk);
  }

  return createdChunks;
};

const distributeChunk = async (fileId, chunkIndex, data) => {
  const chunkId = crypto.randomBytes(16).toString('hex');
  const checksum = crypto.createHash('sha256').update(data).digest('hex');

  const targetNodes = selectNodesForReplication(chunkId, REPLICATION_FACTOR);

  if (targetNodes.length === 0) {
    throw new Error('No storage nodes available for chunk placement');
  }

  const successfulNodeIds = [];
  const results = await Promise.allSettled(
    targetNodes.map((node) => sendChunkToNode(node, chunkId, data))
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      successfulNodeIds.push(targetNodes[i].nodeId);
    } else {
      console.error(`Failed to replicate chunk ${chunkId} to ${targetNodes[i].nodeId}: ${result.reason.message}`);
    }
  });

  if (successfulNodeIds.length === 0) {
    throw new Error(`Failed to store chunk ${chunkId} on any node`);
  }

  const chunk = await Chunk.create({
    chunkId,
    fileId,
    chunkIndex,
    size: data.length,
    checksum,
    storageLocations: successfulNodeIds,
  });

  return chunk;
};

module.exports = { chunkFile, CHUNK_SIZE, REPLICATION_FACTOR };