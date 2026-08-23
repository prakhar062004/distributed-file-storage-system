const crypto = require('crypto');

const computeChecksum = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

const verifyChecksum = (buffer, expectedChecksum) => {
  const actualChecksum = computeChecksum(buffer);
  return actualChecksum === expectedChecksum;
};

module.exports = { computeChecksum, verifyChecksum };