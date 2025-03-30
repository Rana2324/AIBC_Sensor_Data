const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

// Import routes and services
const viewRoutes = require('./routes/viewRoutes');
const apiRoutes = require('./routes/apiRoutes');
const socketService = require('./services/socketService');
const { connectDB } = require('./config/db');
const logger = require('./config/logger');
const { 
  httpLogger, 
  errorLogger, 
  errorHandler, 
  notFoundHandler 
} = require('./middleware/logging');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
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