import mongoose from 'mongoose';
import TemperatureReading from './schemas/TemperatureSchema.js';
import Alert from './schemas/AlertSchema.js';
import Setting from './schemas/SettingSchema.js';
import Personality from './schemas/PersonalitySchema.js';
import { dbConfig } from '../config/db.js';
import logger from '../config/logger.js';

class SensorData {
  static async getLatestReadings(limit = 100) {
    try {
      // Get unique sensor IDs
      const sensorIds = await TemperatureReading.distinct('sensorId');
      logger.info(`Found ${sensorIds.length} unique sensor IDs`);
      
      // For each sensor, get their latest readings and check activity
      const readings = await Promise.all(sensorIds.map(async (sensorId) => {
        // Always get the latest 100 records sorted by timestamp
        const data = await TemperatureReading
          .find({ sensorId })
          .sort({ timestamp: -1 })
          .limit(100);

        logger.info(`Retrieved ${data.length} temperature readings for sensor ${sensorId}`);

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
            
          logger.info(`Retrieved ${alerts.length} alerts for sensor ${sensorId}`);
        } catch (error) {
          logger.error(`Error fetching alerts for sensor ${sensorId}:`, error);
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
                            (validTemps.length > 1 && Math.max(...validTemps) - Math.min(...validTemps) > 5);
          
          // Format date as YYYY/MM/DD
          const date = reading.timestamp ? new Date(reading.timestamp) : new Date();
          const acquisitionDate = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\//g, '/');
          
          // Format time as HH:MM:SS.xxx with milliseconds
          const acquisitionTime = date.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
          
          return {
            acquisitionDate,
            acquisitionTime,
            temperatures,
            averageTemperature,
            isAbnormal,
            temperature_ave: reading.temperature_ave
          };
        });

        return {
          sensorId,
          isActive,
          data: processedData,
          alerts: alerts.map(alert => {
            const date = alert.timestamp ? new Date(alert.timestamp) : new Date();
            return {
              date: date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).replace(/\//g, '/'),
              time: date.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }) + '.' + String(date.getMilliseconds()).padStart(3, '0'),
              event: alert.alertReason || alert.alert_reason || '-',
              eventType: alert.eventType || alert.status || '-'
            };
          }),
          settings: settings.map(setting => {
            const date = setting.timestamp ? new Date(setting.timestamp) : new Date();
            return {
              date: date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).replace(/\//g, '/'),
              time: date.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }) + '.' + String(date.getMilliseconds()).padStart(3, '0'),
              content: setting.content || `${setting.changeType}: ${JSON.stringify(setting.value)}`
            };
          }),
          personality: personality.map(item => {
            const date = item.timestamp ? new Date(item.timestamp) : new Date();
            return {
              date: date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).replace(/\//g, '/'),
              time: date.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }) + '.' + String(date.getMilliseconds()).padStart(3, '0'),
              content: item.content || `${item.biasType}: ${item.biasValue && item.biasValue.level ? item.biasValue.level : JSON.stringify(item.biasValue)}`
            };
          })
        };
      }));

      return readings;
    } catch (error) {
      logger.error('Error in getLatestReadings:', error);
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

export default SensorData;