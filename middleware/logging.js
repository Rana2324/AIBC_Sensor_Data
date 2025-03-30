const morgan = require('morgan');
const logger = require('../config/logger');

// Create a write stream for Morgan
const stream = {
  write: (message) => logger.info(message.trim())
};

// HTTP request logging middleware
const httpLogger = morgan('dev', { stream });

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error(err.stack);
  
  // Log additional request details for debugging
  logger.error(`Request Path: ${req.path}`);
  logger.error(`Request Method: ${req.method}`);
  logger.error(`Request Body: ${JSON.stringify(req.body)}`);
  
  next(err);
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;

  res.status(status).json({
    error: {
      message,
      status,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
};

// 404 handler middleware
const notFoundHandler = (req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
};

module.exports = {
  httpLogger,
  errorLogger,
  errorHandler,
  notFoundHandler
};