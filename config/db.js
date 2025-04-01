import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Database configuration with correct collection names
export const dbConfig = {
  uri: process.env.MONGODB_URI,
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
    await mongoose.connect(dbConfig.uri);
    console.log('Connected to MongoDB Atlas using Mongoose');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export default { connectDB, dbConfig };