require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

async function insertTestAlerts() {
    try {
        // Connect to MongoDB using Mongoose
        await connectDB();
        
        // Get the model
        const Alert = mongoose.model('Alert');
        
        // Insert test alert data
        const result = await Alert.insertMany([
            {
                sensorId: "SENSOR_001",
                timestamp: new Date(),
                event: "温度が26°Cを超えました",
                eventType: "TEMPERATURE_HIGH",
                value: 27.5
            },
            {
                sensorId: "SENSOR_001",
                timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
                event: "温度が正常範囲に戻りました",
                eventType: "TEMPERATURE_RECOVERY",
                value: 23.1
            },
            {
                sensorId: "SENSOR_002",
                timestamp: new Date(Date.now() - 10 * 60000), // 10 minutes ago
                event: "温度が20°C未満になりました",
                eventType: "TEMPERATURE_LOW",
                value: 18.5
            }
        ]);

        console.log(`Inserted ${result.length} alerts`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

insertTestAlerts();