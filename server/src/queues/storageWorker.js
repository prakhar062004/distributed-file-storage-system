const { Worker } = require('bullmq');
const { connection } = require('./storageQueue');
const JOB_TYPES = require('./jobTypes');
const { runRecoveryCycle } = require('../services/recoveryService');

const processJob = async (job) => {
  console.log(`[worker] Processing job ${job.id} (${job.name})`);

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
    console.log(`[worker] Job ${job.id} (${job.name}) completed:`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts: ${err.message}`);
  });

  console.log('[worker] Storage job worker started');
  return worker;
};

module.exports = { startWorker };