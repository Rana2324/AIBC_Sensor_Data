const mongoose = require('mongoose');
const { dbConfig } = require('../config/db');

// Define schemas with collection names matching exactly what's in MongoDB
const temperatureReadingSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  temperatures: [Number],
  isAbnormal: Boolean
}, { collection: 'temperature_readings' });

const alertSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  date: Date,
  alertReason: String,
  status: String,
  createdAt: Date,
  event: String,
  eventType: String,
  value: Number
}, { collection: 'alerts_log' });

const settingSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  content: String,
  changeType: String,
  value: mongoose.Schema.Types.Mixed
}, { collection: 'settings_history' });

const personalitySchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  content: String,
  biasType: String,
  biasValue: mongoose.Schema.Types.Mixed
}, { collection: 'personality_history' });

// Create models
const TemperatureReading = mongoose.model('TemperatureReading', temperatureReadingSchema);
const Alert = mongoose.model('Alert', alertSchema);
const Setting = mongoose.model('Setting', settingSchema);
const Personality = mongoose.model('Personality', personalitySchema);

class SensorData {
  static async getLatestReadings(limit = 100) {
    try {
      // Get unique sensor IDs
      const sensorIds = await TemperatureReading.distinct('sensorId');
      console.log(`Found ${sensorIds.length} unique sensor IDs`);
      
      // For each sensor, get their latest readings and check activity
      const readings = await Promise.all(sensorIds.map(async (sensorId) => {
        // Always get the latest 100 records sorted by timestamp
        const data = await TemperatureReading
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(100);

        console.log(`Retrieved ${data.length} temperature readings for sensor ${sensorId}`);

        // Check if sensor is active (has data in last 5 seconds)
        const now = new Date();
        const fiveSecondsAgo = new Date(now.getTime() - 5000);
        const isActive = data.length > 0 && new Date(data[0].timestamp) > fiveSecondsAgo;

        // Get alerts for this sensor
        let alerts = [];
        try {
          alerts = await Alert
            .find({ sensorId })
            .sort({ timestamp: -1 })
            .limit(10);
            
          console.log(`Retrieved ${alerts.length} alerts for sensor ${sensorId}`);
        } catch (error) {
          console.error(`Error fetching alerts for sensor ${sensorId}:`, error);
          alerts = [];
        }

        // Get settings for this sensor
        const settings = await Setting
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(10);

        // Get personality data for this sensor
        const personality = await Personality
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(10);

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
            date: alert.date ? new Date(alert.date).toLocaleDateString('ja-JP') : 
                  alert.timestamp ? new Date(alert.timestamp).toLocaleDateString('ja-JP') : '-',
            time: alert.date ? new Date(alert.date).toLocaleTimeString('ja-JP') :
                 alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('ja-JP') : '-',
            event: alert.alert_reason || alert.alertReason || '-',
            eventType: alert.eventType || alert.status || '-'
          })),
          settings: settings.map(setting => ({
            date: new Date(setting.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(setting.timestamp).toLocaleTimeString('ja-JP'),
            content: setting.content || `${setting.changeType}: ${JSON.stringify(setting.value)}`
          })),
          personality: personality.map(item => ({
            date: new Date(item.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(item.timestamp).toLocaleTimeString('ja-JP'),
            content: item.content || `${item.biasType}: ${item.biasValue && item.biasValue.level ? item.biasValue.level : JSON.stringify(item.biasValue)}`
          }))
        };
      }));

      return readings;
    } catch (error) {
      console.error('Error in getLatestReadings:', error);
      throw error;
    }
  }

  static async getLatestData(limit = 100) {
    return await TemperatureReading
      .find({})
      .sort({ timestamp: -1 })
      .limit(100); // Always return 100 records
  }

  static async getLatestDataBySensorId(sensorId, limit = 100) {
    return await TemperatureReading
      .find({ sensorId })
      .sort({ timestamp: -1 })
      .limit(100); // Always return 100 records
  }

  static async addSensorData(data) {
    return await TemperatureReading.create({
      ...data,
      timestamp: new Date()
    });
  }

  static async addAlert(alert) {
    return await Alert.create({
      ...alert,
      timestamp: new Date()
    });
  }

  static async addSetting(setting) {
    return await Setting.create({
      ...setting,
      timestamp: new Date()
    });
  }

  static async addPersonalityData(data) {
    return await Personality.create({
      ...data,
      timestamp: new Date()
    });
  }
}

module.exports = SensorData;