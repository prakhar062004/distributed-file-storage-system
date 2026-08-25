const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const nodeRoutes = require('./routes/nodeRoutes');


const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/nodes', nodeRoutes);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}



// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});
//Auth routes
app.use('/api/auth', authRoutes);

//File routes
app.use('/api/files', fileRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Centralized error handler (must be last)
app.use(errorHandler);

module.exports = app;