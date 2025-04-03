import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import viewRoutes from './routes/viewRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import * as socketService from './services/socketService.js';
import * as apiService from './services/apiService.js'; // Import the API service
import { connectDB } from './config/db.js';
import logger from './config/logger.js';
import { 
  httpLogger, 
  errorLogger, 
  errorHandler, 
  notFoundHandler 
} from './middleware/logging.js';

// Initialize environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

// Initialize socket service
socketService.initSocket(io);

// Connect to MongoDB
connectDB()
  .then(() => logger.info('MongoDB connected'))
  .catch(err => {
    logger.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Setup middleware
app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', viewRoutes);
app.use('/api', apiRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorLogger);
app.use(errorHandler);

// Start server
server.listen(port, () => {
  logger.info(`Server started on port ${port}`);
  
  // Start polling the C API once the server is running
  apiService.startPolling();
  logger.info('Started polling the C API for sensor data');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  
  // Stop the API polling
  apiService.stopPolling();
  
  // Close the HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});