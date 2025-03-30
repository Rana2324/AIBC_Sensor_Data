const { getDB } = require('../config/db');

class SensorData {
  static async getLatestReadings(limit = 100) {
    const db = await getDB();
    const collection = db.collection('temperature_readings');
    
    try {
      // Get unique sensor IDs
      const sensorIds = await collection.distinct('sensorId');
      
      // For each sensor, get their latest readings and check activity
      const readings = await Promise.all(sensorIds.map(async (sensorId) => {
        const data = await collection
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();

        // Check if sensor is active (has data in last 5 seconds)
        const now = new Date();
        const fiveSecondsAgo = new Date(now.getTime() - 5000);
        const isActive = data.length > 0 && new Date(data[0].timestamp) > fiveSecondsAgo;

        // Get alerts for this sensor with better error handling
        let alerts = [];
        try {
          alerts = await db.collection('alerts_log')
            .find({ sensorId })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();
            
          console.log(`Retrieved ${alerts.length} alerts for sensor ${sensorId}`);
        } catch (error) {
          console.error(`Error fetching alerts for sensor ${sensorId}:`, error);
          alerts = [];
        }

        // Get settings for this sensor
        const settings = await db.collection('settings_history')
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();

        // Get personality data for this sensor
        const personality = await db.collection('personality_history')
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();

        // Process temperature data and calculate abnormality
        const processedData = data.map(reading => {
          const temperatures = reading.temperatures || Array(16).fill(null);
          const validTemps = temperatures.filter(temp => temp !== null);
          const averageTemperature = validTemps.length > 0 
            ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length 
            : null;
          
          // Check for abnormal conditions
          const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) || 
                            Math.max(...validTemps) - Math.min(...validTemps) > 5;

          return {
            acquisitionDate: new Date(reading.timestamp).toLocaleDateString('ja-JP'),
            acquisitionTime: new Date(reading.timestamp).toLocaleTimeString('ja-JP'),
            temperatures,
            averageTemperature,
            isAbnormal
          };
        });

        return {
          sensorId,
          isActive,
          data: processedData,
          alerts: alerts.map(alert => ({
            date: new Date(alert.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(alert.timestamp).toLocaleTimeString('ja-JP'),
            event: alert.event,
            eventType: alert.eventType
          })),
          settings: settings.map(setting => ({
            date: new Date(setting.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(setting.timestamp).toLocaleTimeString('ja-JP'),
            content: setting.content
          })),
          personality: personality.map(item => ({
            date: new Date(item.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(item.timestamp).toLocaleTimeString('ja-JP'),
            content: item.content
          }))
        };
      }));

      return readings;
    } catch (error) {
      console.error('Error in getLatestReadings:', error);
      throw error;
    }
  }

  static async getLatestData(limit = 20) {
    const db = await getDB();
    const collection = db.collection('temperature_readings');
    
    return await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  static async getLatestDataBySensorId(sensorId, limit = 100) {
    const db = await getDB();
    const collection = db.collection('temperature_readings');
    
    return await collection
      .find({ sensorId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  static async addSensorData(data) {
    const db = await getDB();
    const collection = db.collection('temperature_readings');
    return await collection.insertOne({
      ...data,
      timestamp: new Date()
    });
  }

  static async addAlert(alert) {
    const db = await getDB();
    const collection = db.collection('alerts_log');
    return await collection.insertOne({
      ...alert,
      timestamp: new Date()
    });
  }

  static async addSetting(setting) {
    const db = await getDB();
    const collection = db.collection('settings_history');
    return await collection.insertOne({
      ...setting,
      timestamp: new Date()
    });
  }

  static async addPersonalityData(data) {
    const db = await getDB();
    const collection = db.collection('personality_history');
    return await collection.insertOne({
      ...data,
      timestamp: new Date()
    });
  }
}

module.exports = SensorData;