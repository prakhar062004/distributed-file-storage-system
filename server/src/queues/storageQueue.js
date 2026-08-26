const { Queue } = require('bullmq');

const connection = {
  host: 'localhost',
  port: 6379,
};

const storageQueue = new Queue('storage-jobs', { connection });

module.exports = { storageQueue, connection };