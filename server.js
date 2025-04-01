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
connectDB().catch(err => {
  logger.error('MongoDB connection error:', err);
  process.exit(1);
});

// Apply HTTP request logging middleware
app.use(httpLogger);

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// Use routes
app.use('/', viewRoutes);
app.use('/api', apiRoutes);

// Handle 404s
app.use(notFoundHandler);

// Error handling middleware
app.use(errorLogger);
app.use(errorHandler);

// Start server
server.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});