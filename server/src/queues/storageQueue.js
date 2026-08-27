const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
};

const storageQueue = new Queue('storage-jobs', { connection });

module.exports = { storageQueue, connection };