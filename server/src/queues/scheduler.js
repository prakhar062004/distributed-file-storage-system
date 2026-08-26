const { storageQueue } = require('./storageQueue');
const JOB_TYPES = require('./jobTypes');

const scheduleRecurringJobs = async () => {
  const intervalMs = parseInt(process.env.RECOVERY_INTERVAL_MS, 10) || 20000;

  await storageQueue.add(
    JOB_TYPES.RUN_RECOVERY_CYCLE,
    {},
    {
      repeat: { every: intervalMs },
      jobId: 'recurring-recovery-cycle', // stable ID prevents duplicate schedules on restart
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 20 }, // keep last 20 completed jobs for inspection
      removeOnFail: { count: 50 }, // keep last 50 failed jobs for debugging
    }
  );

  console.log(`[scheduler] Scheduled recurring recovery cycle every ${intervalMs}ms`);
};

module.exports = { scheduleRecurringJobs };