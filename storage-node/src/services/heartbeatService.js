const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 5000;

const getDiskStats = () => {
  const storagePath = path.join(__dirname, '../../', process.env.STORAGE_PATH);
  let fileCount = 0;
  let totalSize = 0;

  try {
    const files = fs.readdirSync(storagePath);
    fileCount = files.length;
    totalSize = files.reduce((sum, f) => {
      const stat = fs.statSync(path.join(storagePath, f));
      return sum + (stat.isFile() ? stat.size : 0);
    }, 0);
  } catch (err) {
    // storage path might not be readable in edge cases — report zeros rather than crash
  }

  return { fileCount, totalSize };
};

const sendHeartbeat = async () => {
  try {
    const { fileCount, totalSize } = getDiskStats();

    await axios.post(`${BACKEND_URL}/api/nodes/heartbeat`, {
      nodeId: process.env.NODE_ID,
      url: `http://localhost:${process.env.PORT}`,
      fileCount,
      totalSize,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`Heartbeat failed to send: ${err.message}`);
  }
};

const startHeartbeat = () => {
  console.log(`Starting heartbeat every ${HEARTBEAT_INTERVAL_MS}ms to ${BACKEND_URL}`);
  sendHeartbeat();
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
};

module.exports = { startHeartbeat };