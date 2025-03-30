const SensorData = require('../models/SensorData');
const { getDB } = require('../config/db');
const logger = require('../config/logger');
const socketService = require('../services/socketService');

exports.renderSensorData = async (req, res) => {
  try {
    const latestReadings = await SensorData.getLatestReadings(100);
    const db = await getDB();
    
    // Get the last update timestamp from any sensor
    const lastUpdate = await db.collection('temperature_readings')
      .findOne({}, { sort: { timestamp: -1 } });

    // Count active sensors
    const now = new Date();
    const fiveSecondsAgo = new Date(now.getTime() - 5000);
    const activeSensorCount = await db.collection('temperature_readings')
      .distinct('sensorId', { 
        timestamp: { $gt: fiveSecondsAgo } 
      });

    res.render("sensorData", { 
      latestReadings,
      serverStats: {
        lastUpdateTime: lastUpdate ? lastUpdate.timestamp : null,
        totalSensors: latestReadings.length,
        activeSensors: activeSensorCount.length
      }
    });
  } catch (error) {
    logger.error("Error in renderSensorData controller:", error);
    res.status(500).send("Internal Server Error");
  }
};

exports.getLatestData = async (req, res) => {
  try {
    const db = await getDB();
    const collection = db.collection('temperature_readings');
    
    // Get unique sensor IDs
    const sensorIds = await collection.distinct('sensorId');
    
    // For each sensor, get their latest reading and process it
    const latestData = await Promise.all(sensorIds.map(async (sensorId) => {
      const data = await collection
        .findOne({ sensorId }, { sort: { timestamp: -1 } });
        
      if (!data) return null;
      
      // Calculate abnormality
      const validTemps = data.temperatures.filter(temp => temp !== null);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) || 
                        Math.max(...validTemps) - Math.min(...validTemps) > 5;
                        
      // Check sensor activity
      const now = new Date();
      const fiveSecondsAgo = new Date(now.getTime() - 5000);
      const isActive = new Date(data.timestamp) > fiveSecondsAgo;
      
      return {
        ...data,
        isAbnormal,
        isActive
      };
    }));
    
    res.json(latestData.filter(Boolean));
  } catch (error) {
    logger.error("Error in getLatestData controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getLatestDataBySensorId = async (req, res) => {
  try {
    const { sensorId } = req.params;
    const latestData = await SensorData.getLatestDataBySensorId(sensorId, 100);
    
    // Process each reading to add abnormality flags
    const processedData = latestData.map(reading => {
      const validTemps = reading.temperatures.filter(temp => temp !== null);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) || 
                        Math.max(...validTemps) - Math.min(...validTemps) > 5;
      return {
        ...reading,
        isAbnormal
      };
    });
    
    res.json(processedData);
  } catch (error) {
    logger.error(`Error in getLatestDataBySensorId controller for sensor ${req.params.sensorId}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Alert handling
exports.getAlerts = async (req, res) => {
  try {
    const db = await getDB();
    const collection = db.collection('alerts_log');
    const alerts = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
      
    const formattedAlerts = alerts.map(alert => ({
      ...alert,
      date: new Date(alert.timestamp).toLocaleDateString('ja-JP'),
      time: new Date(alert.timestamp).toLocaleTimeString('ja-JP')
    }));
    
    res.json(formattedAlerts);
  } catch (error) {
    logger.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Settings handling
exports.getSettings = async (req, res) => {
  try {
    const db = await getDB();
    const collection = db.collection('settings_history');
    const settings = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
      
    const formattedSettings = settings.map(setting => ({
      ...setting,
      date: new Date(setting.timestamp).toLocaleDateString('ja-JP'),
      time: new Date(setting.timestamp).toLocaleTimeString('ja-JP')
    }));
    
    res.json(formattedSettings);
  } catch (error) {
    logger.error("Error fetching settings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Personality data handling
exports.getPersonalityData = async (req, res) => {
  try {
    const db = await getDB();
    const collection = db.collection('personality_history');
    const data = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
      
    const formattedData = data.map(item => ({
      ...item,
      date: new Date(item.timestamp).toLocaleDateString('ja-JP'),
      time: new Date(item.timestamp).toLocaleTimeString('ja-JP')
    }));
    
    res.json(formattedData);
  } catch (error) {
    logger.error("Error fetching personality data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};