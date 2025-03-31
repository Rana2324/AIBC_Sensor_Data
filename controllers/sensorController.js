const SensorData = require('../models/SensorData');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const socketService = require('../services/socketService');

exports.renderSensorData = async (req, res) => {
  try {
    // Set up collection references using the specified database and collection names
    const db = mongoose.connection.db;
    const temperatureReadings = db.collection('temperature_readings');
    const alertsLog = db.collection('alerts_log');
    const personalityHistory = db.collection('personality_history');

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
        const validTemps = temperatures.filter(temp => temp !== null && temp !== undefined);
        const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
          Math.max(...validTemps) - Math.min(...validTemps) > 5;
        
        // Calculate average temperature
        let averageTemperature = null;
        if (validTemps.length > 0) {
          averageTemperature = validTemps.reduce((sum, temp) => Number(sum) + Number(temp), 0) / validTemps.length;
        }
        
        return {
          sensorId: sensorId,
          acquisitionDate,
          acquisitionTime,
          temperatures: temperatures,
          isAbnormal,
          averageTemperature,
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
          event: alert.event || alert.alertReason || alert.message || 'Unknown alert',
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
      
      // Check if sensor is active (had data in the last 1 second)
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);
      const latestReading = data[0]; // First item is the latest due to sort order
      const isActive = latestReading && (
        (latestReading.created_at && new Date(latestReading.created_at) > oneSecondAgo) || 
        (latestReading.timestamp && new Date(latestReading.timestamp) > oneSecondAgo)
      );
      
      // Add this sensor's data to the latestReadings array
      latestReadings.push({
        sensorId,
        data: processedData,
        alerts,
        personality,
        isActive,
        // Add settings if you have them in a separate collection
        settings: [] // Add logic to fetch settings if needed
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
    
    res.render("sensorData", {
      latestReadings,
      serverStats: {
        lastUpdateTime: lastUpdateReading[0]?.created_at || lastUpdateReading[0]?.timestamp || null,
        totalSensors: latestReadings.length,
        activeSensors: activeReadings.length,
        totalDataPoints: latestReadings.reduce((acc, sensor) => {
          acc[sensor.sensorId] = sensor.data.length;
          return acc;
        }, {})
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

// API endpoint to get latest data for all sensors
exports.getLatestData = async (req, res) => {
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
      const validTemps = temperatures.filter(temp => temp !== null && temp !== undefined);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
        Math.max(...validTemps) - Math.min(...validTemps) > 5;
      
      // Check sensor activity
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);
      const isActive = (reading.created_at && new Date(reading.created_at) > oneSecondAgo) ||
                      (reading.timestamp && new Date(reading.timestamp) > oneSecondAgo);
      
      // Calculate average temperature
      let averageTemperature = null;
      if (validTemps.length > 0) {
        averageTemperature = validTemps.reduce((sum, temp) => Number(sum) + Number(temp), 0) / validTemps.length;
      }
      
      return {
        ...reading,
        sensorId: sensorId,
        temperatures: temperatures,
        isAbnormal,
        isActive,
        averageTemperature
      };
    }));
    
    res.json(latestData.filter(Boolean));
  } catch (error) {
    logger.error("Error in getLatestData controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get latest data for a specific sensor
exports.getLatestDataBySensorId = async (req, res) => {
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
      const validTemps = temperatures.filter(temp => temp !== null && temp !== undefined);
      const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
        Math.max(...validTemps) - Math.min(...validTemps) > 5;
      
      // Calculate average temperature
      let averageTemperature = null;
      if (validTemps.length > 0) {
        averageTemperature = validTemps.reduce((sum, temp) => Number(sum) + Number(temp), 0) / validTemps.length;
      }
      
      return {
        ...reading,
        sensorId: sensorId,
        temperatures: temperatures,
        isAbnormal,
        averageTemperature
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
exports.getAlerts = async (req, res) => {
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
      event: alert.event || alert.alertReason || alert.message || 'Unknown alert'
    }));
    
    res.json(formattedAlerts);
  } catch (error) {
    logger.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get settings
exports.getSettings = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    // Note: Since you didn't specify a settings collection name,
    // I'm assuming it might be stored within another collection or doesn't exist yet
    // You may need to adjust this based on your actual data structure
    
    // For now, return an empty array to prevent errors
    const settings = [];
    
    res.json(settings);
  } catch (error) {
    logger.error("Error fetching settings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// API endpoint to get personality data
exports.getPersonalityData = async (req, res) => {
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
exports.renderDashboard = async (req, res) => {
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
exports.getLatestAlertData = async (req, res) => {
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