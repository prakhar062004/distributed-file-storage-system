const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;