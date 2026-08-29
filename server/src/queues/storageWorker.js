const { Worker } = require('bullmq');
const { connection } = require('./storageQueue');
const JOB_TYPES = require('./jobTypes');
const { runRecoveryCycle } = require('../services/recoveryService');
const logger = require('../utils/logger');

const processJob = async (job) => {
  logger.info('Worker processing job', { jobId: job.id, jobName: job.name });

  switch (job.name) {
    case JOB_TYPES.RUN_RECOVERY_CYCLE:
      return runRecoveryCycle();

    // Future job types (REPLICATE_CHUNK, VERIFY_CHECKSUM, etc.) would be
    // handled here as the system grows — each case delegates to existing
    // service functions, keeping the worker itself thin.

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
};

const startWorker = () => {
  const worker = new Worker('storage-jobs', processJob, {
    connection,
    concurrency: 2, // process up to 2 jobs simultaneously
  });

  worker.on('completed', (job, result) => {
    logger.info('Worker job completed', { jobId: job.id, jobName: job.name, result });
  });

  worker.on('failed', (job, err) => {
    logger.error('Worker job failed', { jobId: job.id, jobName: job.name, attempts: job.attemptsMade, error: err.message });
  });

  logger.info('Storage job worker started');
  return worker;
};

module.exports = { startWorker };