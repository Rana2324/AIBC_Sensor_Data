import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './logger.js';

// Initialize environment variables
dotenv.config();

// Database configuration with correct collection names and authentication
export const dbConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sensorData',
  dbName: 'sensorData',
  collections: {
    temperatureReadings: 'temperature_readings',
    alertsLog: 'alerts_log',
    settingsHistory: 'settings_history',
    personalityHistory: 'personality_history'
  }
};

export async function connectDB() {
  try {
    await mongoose.connect(dbConfig.uri, {
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
    logger.info('Connected to MongoDB successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export default { connectDB, dbConfig };