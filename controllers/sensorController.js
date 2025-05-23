import SensorData from '../models/SensorData.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import * as socketService from '../services/socketService.js';

export const renderSensorData = async (req, res) => {
  try {
    // Set up collection references using the specified database and collection names
    const db = mongoose.connection.db;
    const temperatureReadings = db.collection('temperature_readings');
    const alertsLog = db.collection('alerts_log');
    const personalityHistory = db.collection('personality_history');
    const settingsHistory = db.collection('settings_history');  // Add settings_history collection reference

    // Get distinct sensor IDs from temperature readings
    const sensorIds = await temperatureReadings.distinct('sensor_id');
    
    // Prepare the structure for the latest readings
    const latestReadings = [];
    
    // For each sensor, fetch its latest data
    for (const sensorId of sensorIds) {
      // Get the 100 latest temperature readings for this sensor
      const data = await temperatureReadings
        .find({ sensor_id: sensorId })
        .sort({ created_at: -1 })
        .limit(100)
        .toArray();
      
      // Process each reading to add necessary fields
      const processedData = data.map(reading => {
        // Get timestamp from created_at field or fallback to timestamp field
        const timestamp = reading.created_at ? new Date(reading.created_at) : 
                         (reading.timestamp ? new Date(reading.timestamp) : new Date());
        
        // Use date and time fields if available, otherwise format the timestamp
        const acquisitionDate = reading.date || timestamp.toLocaleDateString('ja-JP');
        const acquisitionTime = reading.time || timestamp.toLocaleTimeString('ja-JP');
        
        // Map temperature_data to temperatures array if needed
        const temperatures = reading.temperature_data || reading.temperatures || [];
        
        // Calculate if temperature is abnormal
        const validTemps = convertTemperatures(temperatures);
        const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
          Math.max(...validTemps) - Math.min(...validTemps) > 5;
        
        // Use temperature_ave from the database instead of calculating average
        const temperature_ave = reading.temperature_ave !== undefined ? reading.temperature_ave : null;
        
        return {
          sensorId: sensorId,
          acquisitionDate,
          acquisitionTime,
          temperatures: temperatures,
          isAbnormal,
          temperature_ave,
          // Keep additional fields that might be useful
          alert_flag: reading.alert_flag
        };
      });
      
      // Get the 10 latest alerts for this sensor
      const alerts = await alertsLog
        .find({ sensor_id: sensorId })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray()
        .then(alerts => alerts.map(alert => ({
          sensorId: sensorId,
          date: alert.date || new Date(alert.created_at || alert.timestamp).toLocaleDateString('ja-JP'),
          time: alert.time || new Date(alert.created_at || alert.timestamp).toLocaleTimeString('ja-JP'),
          event: alert.alert_reason || alert.alertReason || alert.message || 'Unknown alert',
          eventType: alert.eventType || alert.status || ''
        })));
      
      // Get the 10 latest personality history entries for this sensor
      const personality = await personalityHistory
        .find({ sensor_id: sensorId })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray()
        .then(items => items.map(item => ({
          sensorId: sensorId,
          date: item.date || new Date(item.created_at || item.timestamp).toLocaleDateString('ja-JP'),
          time: item.time || new Date(item.created_at || item.timestamp).toLocaleTimeString('ja-JP'),
          content: item.content || formatPersonalityContent(item)
        })));
      
      // Check if sensor is active (had data in the last 5 minutes)
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes window
      const latestReading = data[0]; // First item is the latest due to sort order
      const isActive = latestReading && (
        (latestReading.created_at && new Date(latestReading.created_at) > fiveMinutesAgo) || 
        (latestReading.timestamp && new Date(latestReading.timestamp) > fiveMinutesAgo)
      );
      
      // Get the 10 latest settings for this sensor
      const settings = await settingsHistory
        .find({ sensor_id: sensorId })
        .sort({ timestamp: -1, created_at: -1 })
        .limit(10)
        .toArray()
        .then(items => items.map(item => ({
          sensorId: sensorId,
          date: item.date || new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString('ja-JP'),
          time: item.time || new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString('ja-JP'),
          content: item.content || `${item.changeType || 'Setting'}: ${item.value !== undefined ? item.value : JSON.stringify(item.value)}`
        })));
      
      // Add this sensor's data to the latestReadings array
      latestReadings.push({
        sensorId,
        data: processedData,
        alerts,
        personality,
        isActive,
        settings: settings // Use the fetched settings data
      });
    }
    
    // Get the overall last update timestamp
    const lastUpdateReading = await temperatureReadings
      .find()
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    // Count active sensors
    const now = new Date();
    const oneSecondAgo = new Date(now.getTime() - 1000);
    const activeReadings = await temperatureReadings
      .distinct('sensor_id', { 
        $or: [
          { created_at: { $gt: oneSecondAgo } },
          { timestamp: { $gt: oneSecondAgo } }
        ] 
      });
      
    // Calculate today's data count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const todayDataCount = await temperatureReadings.countDocuments({
      $or: [
        { created_at: { $gte: startOfToday } },
        { timestamp: { $gte: startOfToday } }
      ]
    });
    
    // Calculate today's alert count
    const todayAlertCount = await alertsLog.countDocuments({
      $or: [
        { created_at: { $gte: startOfToday } },
        { timestamp: { $gte: startOfToday } }
      ]
    });
    
    // Get database stats for size information
    const dbStats = await db.stats();
    const dbSizeBytes = dbStats.dataSize || 0;
    
    res.render("sensorData", {
      latestReadings,
      serverStats: {
        lastUpdateTime: lastUpdateReading[0]?.created_at || lastUpdateReading[0]?.timestamp || null,
        totalSensors: latestReadings.length,
        activeSensors: activeReadings.length,
        totalDataPoints: latestReadings.reduce((acc, sensor) => {
          // Sum up the number of data points across all sensors
          return acc + (sensor.data ? sensor.data.length : 0);
        }, 0),
        todayDataPoints: todayDataCount,
        todayAlerts: todayAlertCount,
        dbSize: dbSizeBytes
      }
    });
  } catch (error) {
    logger.error("Error in renderSensorData controller:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Helper function to format personality content
function formatPersonalityContent(item) {
  if (item.biasType === 'temperature_offset' && item.biasValue) {
    const offset = item.biasValue.offset;
    const sign = offset > 0 ? '+' : '';
    return `温度補正バイアス: ${sign}${offset}°C`;
  } else if (item.biasType === 'sensitivity' && item.biasValue) {
    return `感度設定: ${item.biasValue.level}`;
  } else {
    return `${item.biasType || 'バイアス'}の設定`;
  }
}

// Helper function to convert temperature values if they're strings
function convertTemperatures(temps) {
  if (!Array.isArray(temps)) return [];
  return temps.map(temp => typeof temp === 'string' ? parseFloat(temp) : temp)
    .filter(temp => temp !== null && temp !== undefined && !isNaN(temp));
}

// API endpoint to get latest data for all sensors
export const getLatestData = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const temperatureReadings = db.collection('temperature_readings');
    
    // Get unique sensor IDs
    const sensorIds = await temperatureReadings.distinct('sensor_id');
    
    // For each sensor, get their latest reading and process it
    const latestData = await Promise.all(sensorIds.map(async (sensorId) => {
      const data = await temperatureReadings
        .find({ sensor_id: sensorId })
        .sort({ created_at: -1 })
        .limit(1)
        .toArray();
        
      if (!data || data.length === 0) return null;
      const reading = data[0];
      
      // Map temperature_data to temperatures array if needed
      const temperatures = reading.temperature_data || reading.temperatures || [];
      
      // Calculate abnormality
      const validTemps = convertTemperatures(temperatures);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
        Math.max(...validTemps) - Math.min(...validTemps) > 5;
      
      // Check sensor activity
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);
      const isActive = (reading.created_at && new Date(reading.created_at) > oneSecondAgo) ||
                      (reading.timestamp && new Date(reading.timestamp) > oneSecondAgo);
      
      // Use temperature_ave from database instead of calculating averageTemperature
      const temperature_ave = reading.temperature_ave !== undefined ? reading.temperature_ave : null;
      
      return {
        ...reading,
        sensorId: sensorId,
        temperatures: temperatures,
        isAbnormal,
        temperature_ave
      };
    }));
    
    res.json(latestData.filter(Boolean));
  } catch (error) {
    logger.error("Error in getLatestData controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get latest data for a specific sensor
export const getLatestDataBySensorId = async (req, res) => {
  try {
    const { sensorId } = req.params;
    const db = mongoose.connection.db;
    const temperatureReadings = db.collection('temperature_readings');
    
    // Get the 100 latest readings for this sensor
    const data = await temperatureReadings
      .find({ sensor_id: sensorId })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    
    // Process each reading to add necessary fields
    const processedData = data.map(reading => {
      // Map temperature_data to temperatures array if needed
      const temperatures = reading.temperature_data || reading.temperatures || [];
      
      // Calculate if temperature is abnormal
      const validTemps = convertTemperatures(temperatures);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
        Math.max(...validTemps) - Math.min(...validTemps) > 5;
      
      // Use temperature_ave from database instead of calculating averageTemperature
      const temperature_ave = reading.temperature_ave !== undefined ? reading.temperature_ave : null;
      
      return {
        ...reading,
        sensorId: sensorId,
        temperatures: temperatures,
        isAbnormal,
        temperature_ave
      };
    });
    
    logger.info(`Found ${processedData.length} data points for sensor ${sensorId}`);
    res.json(processedData);
  } catch (error) {
    logger.error(`Error in getLatestDataBySensorId controller for sensor ${req.params.sensorId}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get alerts
export const getAlerts = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const alertsLog = db.collection('alerts_log');
    
    const alerts = await alertsLog
      .find()
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();
    
    const formattedAlerts = alerts.map(alert => ({
      ...alert,
      sensorId: alert.sensor_id,
      date: alert.date || new Date(alert.created_at || alert.timestamp).toLocaleDateString('ja-JP'),
      time: alert.time || new Date(alert.created_at || alert.timestamp).toLocaleTimeString('ja-JP'),
      event: alert.alert_reason || alert.alertReason || alert.message || 'Unknown alert'
    }));
    
    res.json(formattedAlerts);
  } catch (error) {
    logger.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get settings
export const getSettings = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const settingsHistory = db.collection('settings_history');
    
    const settingsData = await settingsHistory
      .find()
      .sort({ timestamp: -1, created_at: -1 })
      .limit(10)
      .toArray();
    
    const formattedSettings = settingsData.map(item => ({
      ...item,
      sensorId: item.sensor_id || item.sensorId,
      date: item.date || new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString('ja-JP'),
      time: item.time || new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString('ja-JP'),
      content: item.content || `${item.changeType || 'Setting'}: ${item.value !== undefined ? item.value : JSON.stringify(item.value)}`
    }));
    
    logger.info(`Returning ${formattedSettings.length} setting records`);
    res.json(formattedSettings);
  } catch (error) {
    logger.error("Error fetching settings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get personality data
export const getPersonalityData = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const personalityHistory = db.collection('personality_history');
    
    const data = await personalityHistory
      .find()
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();
    
    const formattedData = data.map(item => ({
      ...item,
      sensorId: item.sensor_id,
      date: item.date || new Date(item.created_at || item.timestamp).toLocaleDateString('ja-JP'),
      time: item.time || new Date(item.created_at || item.timestamp).toLocaleTimeString('ja-JP'),
      content: item.content || formatPersonalityContent(item)
    }));
    
    res.json(formattedData);
  } catch (error) {
    logger.error("Error fetching personality data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Add dashboard render controller if needed
export const renderDashboard = async (req, res) => {
  try {
    res.render("dashboard", {
      title: "Real-Time Sensor Dashboard"
    });
  } catch (error) {
    logger.error("Error in renderDashboard controller:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Get the latest alert records for the dashboard
export const getLatestAlertData = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const alertsLog = db.collection('alerts_log');
    
    const alertData = await alertsLog
      .find({})
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    
    const formattedData = alertData.map(record => ({
      sensorId: record.sensor_id,
      date: record.date ? record.date :
        record.created_at ? new Date(record.created_at).toLocaleDateString('ja-JP') : 
        record.timestamp ? new Date(record.timestamp).toLocaleDateString('ja-JP') : '-',
      time: record.time ? record.time :
        record.created_at ? new Date(record.created_at).toLocaleTimeString('ja-JP') :
        record.timestamp ? new Date(record.timestamp).toLocaleTimeString('ja-JP') : '-',
      alertReason: record.alertReason || record.event || record.message || '-',
      status: record.status || record.eventType || 'UNKNOWN'
    }));
    
    logger.info(`Returning ${formattedData.length} alert records for dashboard`);
    res.json(formattedData);
  } catch (error) {
    logger.error("Error in getLatestAlertData controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};