require('dotenv').config();
const fs = require('fs');
const path = require('path');
const app = require('./app');
const { startHeartbeat } = require('./services/heartbeatService');

const PORT = process.env.PORT || 5001;
const STORAGE_PATH = path.join(__dirname, '../', process.env.STORAGE_PATH);

if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`Storage node [${process.env.NODE_ID}] running on port ${PORT}`);
  startHeartbeat();
});