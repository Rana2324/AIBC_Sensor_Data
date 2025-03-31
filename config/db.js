const mongoose = require('mongoose');
require('dotenv').config();

// Database configuration with correct collection names
const dbConfig = {
  uri: process.env.MONGODB_URI,
  dbName: 'sensorData',
  collections: {
    temperatureReadings: 'temperature_readings',
    alertsLog: 'alerts_log',
    settingsHistory: 'settings_history',
    personalityHistory: 'personality_history'
  }
};

async function connectDB() {
  try {
    await mongoose.connect(dbConfig.uri);
    console.log('Connected to MongoDB Atlas using Mongoose');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = { connectDB, dbConfig };