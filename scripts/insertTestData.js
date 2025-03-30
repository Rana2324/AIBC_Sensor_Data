require('dotenv').config();
const { MongoClient } = require('mongodb');

async function insertTestData() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const collection = db.collection('temperature_readings');

        // Clear existing data
        await collection.deleteMany({});

        // Insert test data
        const result = await collection.insertMany([
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

        console.log(`Inserted ${result.insertedCount} documents`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

insertTestData();