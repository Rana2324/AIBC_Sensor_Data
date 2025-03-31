const SensorData = require('../models/SensorData');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const socketService = require('../services/socketService');

exports.renderSensorData = async (req, res) => {
  try {
    // Set limit to null to fetch all available data points
    const latestReadings = await SensorData.getLatestReadings(null);

    // Get the last update timestamp from any sensor
    const TemperatureReading = mongoose.model('TemperatureReading');
    const lastUpdate = await TemperatureReading
      .findOne()
      .sort({ timestamp: -1 })
      .select('timestamp');

    // Count active sensors
    const now = new Date();
    const fiveSecondsAgo = new Date(now.getTime() - 5000);
    const activeSensorCount = await TemperatureReading
      .distinct('sensorId', {
        timestamp: { $gt: fiveSecondsAgo }
      });

    // Get total count of data points
    const totalDataPoints = {};
    for (const reading of latestReadings) {
      totalDataPoints[reading.sensorId] = reading.data.length;
    }

    res.render("sensorData", {
      latestReadings,
      serverStats: {
        lastUpdateTime: lastUpdate ? lastUpdate.timestamp : null,
        totalSensors: latestReadings.length,
        activeSensors: activeSensorCount.length,
        totalDataPoints
      }
    });
  } catch (error) {
    logger.error("Error in renderSensorData controller:", error);
    res.status(500).send("Internal Server Error");
  }
};

exports.getLatestData = async (req, res) => {
  try {
    const TemperatureReading = mongoose.model('TemperatureReading');

    // Get unique sensor IDs
    const sensorIds = await TemperatureReading.distinct('sensorId');

    // For each sensor, get their latest reading and process it
    const latestData = await Promise.all(sensorIds.map(async (sensorId) => {
      const data = await TemperatureReading
        .findOne({ sensorId })
        .sort({ timestamp: -1 });

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
        ...data.toObject(),
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
    // Remove limit to get all data points
    const latestData = await SensorData.getLatestDataBySensorId(sensorId);

    // Process each reading to add abnormality flags
    const processedData = latestData.map(reading => {
      const validTemps = reading.temperatures.filter(temp => temp !== null);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
        Math.max(...validTemps) - Math.min(...validTemps) > 5;
      return {
        ...reading.toObject(),
        isAbnormal
      };
    });

    logger.info(`Found ${processedData.length} data points for sensor ${sensorId}`);
    res.json(processedData);
  } catch (error) {
    logger.error(`Error in getLatestDataBySensorId controller for sensor ${req.params.sensorId}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Alert handling
exports.getAlerts = async (req, res) => {
  try {
    const Alert = mongoose.model('Alert');
    const alerts = await Alert
      .find()
      .sort({ timestamp: -1 })
      .limit(10);

    const formattedAlerts = alerts.map(alert => ({
      ...alert.toObject(),
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
    const Setting = mongoose.model('Setting');
    const settings = await Setting
      .find()
      .sort({ timestamp: -1 })
      .limit(10);

    const formattedSettings = settings.map(setting => ({
      ...setting.toObject(),
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
    const Personality = mongoose.model('Personality');
    const data = await Personality
      .find()
      .sort({ timestamp: -1 })
      .limit(10);

    const formattedData = data.map(item => ({
      ...item.toObject(),
      date: new Date(item.timestamp).toLocaleDateString('ja-JP'),
      time: new Date(item.timestamp).toLocaleTimeString('ja-JP')
    }));

    res.json(formattedData);
  } catch (error) {
    logger.error("Error fetching personality data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Add new controller method for dashboard
exports.renderDashboard = async (req, res) => {
  try {
    // Render the dashboard template (no need to pre-load data as it will be loaded via Socket.io)
    res.render("dashboard", {
      title: "Real-Time Sensor Dashboard"
    });
  } catch (error) {
    logger.error("Error in renderDashboard controller:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Get the latest 100 alert records for the dashboard
exports.getLatestAlertData = async (req, res) => {
  try {
    const Alert = mongoose.model('Alert');

    // Get the latest 100 alert records
    const alertData = await Alert
      .find({})
      .sort({ timestamp: -1 })
      .limit(100);

    // Format the data for display
    const formattedData = alertData.map(record => ({
      sensorId: record.sensorId,
      date: record.date ? new Date(record.date).toLocaleDateString('ja-JP') :
        record.timestamp ? new Date(record.timestamp).toLocaleDateString('ja-JP') : '-',
      time: record.date ? new Date(record.date).toLocaleTimeString('ja-JP') :
        record.timestamp ? new Date(record.timestamp).toLocaleTimeString('ja-JP') : '-',
      alertReason: record.alertReason || record.event || '-',
      status: record.status || record.eventType || 'UNKNOWN'
    }));

    logger.info(`Returning ${formattedData.length} alert records for dashboard`);
    res.json(formattedData);
  } catch (error) {
    logger.error("Error in getLatestAlertData controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};