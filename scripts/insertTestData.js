require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

async function insertTestData() {
    try {
        // Connect to MongoDB using Mongoose
        await connectDB();
        
        // Get the model
        const TemperatureReading = mongoose.model('TemperatureReading');
        
        // Clear existing data
        await TemperatureReading.deleteMany({});

        // Insert test data
        const result = await TemperatureReading.insertMany([
            {
                sensorId: "SENSOR_001",
                timestamp: new Date(),
                temperatures: [22.5, 23.1, 22.8, 23.0, 22.9, 23.2, 22.7, 22.6, 23.1, 22.9, 23.0, 22.8, 23.1, 22.7, 22.9, 23.0],
                isAbnormal: false
            },
            {
                sensorId: "SENSOR_002",
                timestamp: new Date(),
                temperatures: [24.5, 24.8, 24.6, 24.7, 24.9, 24.8, 24.7, 24.6, 24.8, 24.7, 24.6, 24.8, 24.7, 24.6, 24.8, 24.7],
                isAbnormal: false
            }
        ]);

        console.log(`Inserted ${result.length} documents`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

insertTestData();