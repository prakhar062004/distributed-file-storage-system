require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startWorker } = require('./queues/storageWorker');
const { scheduleRecurringJobs } = require('./queues/scheduler');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, async () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    startWorker();
    await scheduleRecurringJobs();
  });
};

startServer();