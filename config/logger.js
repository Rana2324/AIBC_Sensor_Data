const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create logger
const logger = winston.createLogger({
  format: logFormat,
  transports: [
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      level: 'info'
    }),
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error'
    }),
    // Write to console in development mode
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
      level: process.env.NODE_ENV === 'production' ? 'error' : 'debug'
    })
  ]
});

module.exports = logger;