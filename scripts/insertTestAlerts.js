require('dotenv').config();
const { MongoClient } = require('mongodb');

async function insertTestAlerts() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const collection = db.collection('alerts_log');

        // Insert test alert data
        const result = await collection.insertMany([
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

        console.log(`Inserted ${result.insertedCount} alerts`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

insertTestAlerts();