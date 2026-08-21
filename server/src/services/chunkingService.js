const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Chunk = require('../models/Chunk');

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE, 10) || 1048576;

const CHUNKS_DIR = path.join(__dirname, '../../chunks');

if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

/**
 * Reads a file from disk in a streaming fashion and splits it into
 * fixed-size chunks, writing each chunk to disk and creating a
 * corresponding Chunk document in MongoDB.
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
      const chunk = await writeChunk(fileId, chunkIndex, chunkData);
      createdChunks.push(chunk);
      chunkIndex++;
    }
  }

  // Final partial chunk (file size isn't necessarily a multiple of CHUNK_SIZE)
  if (buffer.length > 0) {
    const chunk = await writeChunk(fileId, chunkIndex, buffer);
    createdChunks.push(chunk);
  }

  return createdChunks;
};

const writeChunk = async (fileId, chunkIndex, data) => {
  const chunkId = crypto.randomBytes(16).toString('hex');
  const chunkPath = path.join(CHUNKS_DIR, chunkId);

  fs.writeFileSync(chunkPath, data);

  const checksum = crypto.createHash('sha256').update(data).digest('hex');

  const chunk = await Chunk.create({
    chunkId,
    fileId,
    chunkIndex,
    size: data.length,
    checksum,
    storageLocations: ['local'],
  });

  return chunk;
};

module.exports = { chunkFile, CHUNK_SIZE };