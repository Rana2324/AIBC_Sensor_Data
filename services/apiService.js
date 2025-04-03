import axios from 'axios';
import logger from '../config/logger.js';
import SensorData from '../models/SensorData.js';

// Configure the API endpoint
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_POLLING_INTERVAL = process.env.API_POLLING_INTERVAL || 5000; // 5 seconds by default

// Store the polling interval reference
let pollingInterval = null;

// Event callbacks - these will be set by other modules
// Use a callbacks object instead of direct exports
export const callbacks = {
  onDataFetched: null,
  onAlertsFetched: null,
  onSettingsFetched: null
};

/**
 * Fetch sensor data from the API
 * @returns {Promise<Array>} The sensor data from the API
 */
export const fetchSensorData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/sensor-data/latest`, {
      timeout: 5000 // 5 second timeout
    });
    
    // Ensure we always return an array
    const data = Array.isArray(response.data) ? response.data : [];
    logger.info(`Fetched ${data.length} sensor readings from API`);
    
    // We no longer notify here - we'll notify after DB save instead
    
    return data;
  } catch (error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}` 
      : error.message;
    logger.error(`Error fetching sensor data from API: ${errorMessage}`);
    return [];
  }
};

/**
 * Fetch alerts from the API
 * @returns {Promise<Array>} The alerts from the API
 */
export const fetchAlerts = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/alerts`, {
      timeout: 5000 // 5 second timeout
    });
    
    // Ensure we always return an array
    const data = Array.isArray(response.data) ? response.data : [];
    logger.info(`Fetched ${data.length} alerts from API`);
    
    // We no longer notify here - we'll notify after DB save instead
    
    return data;
  } catch (error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}` 
      : error.message;
    logger.error(`Error fetching alerts from API: ${errorMessage}`);
    return [];
  }
};

/**
 * Fetch settings from the API
 * @returns {Promise<Array>} The settings from the API
 */
export const fetchSettings = async () => {
  try {
    // Since there's no settings endpoint yet, just return empty array to prevent errors
    logger.info('Settings endpoint not implemented yet, returning empty array');
    return [];
    
    /* Commented out until settings endpoint is implemented
    const response = await axios.get(`${API_BASE_URL}/settings`, {
      timeout: 5000 // 5 second timeout
    });
    
    // Ensure we always return an array
    const data = Array.isArray(response.data) ? response.data : [];
    logger.info(`Fetched ${data.length} settings from API`);
    
    return data;
    */
  } catch (error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}` 
      : error.message;
    logger.error(`Error fetching settings from API: ${errorMessage}`);
    return [];
  }
};

/**
 * Post sensor data to the API
 * @param {Object} data - The sensor data to post
 * @returns {Promise<Object>} The response from the API
 */
export const postSensorData = async (data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/sensor-data`, data, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    logger.info(`Posted sensor data to API successfully: ${JSON.stringify(data)}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}` 
      : error.message;
    logger.error(`Error posting sensor data to API: ${errorMessage}`);
    throw error;
  }
};

/**
 * Post alert to the API
 * @param {Object} alert - The alert to post
 * @returns {Promise<Object>} The response from the API
 */
export const postAlert = async (alert) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/alerts`, alert, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    logger.info(`Posted alert to API successfully: ${JSON.stringify(alert)}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}` 
      : error.message;
    logger.error(`Error posting alert to API: ${errorMessage}`);
    throw error;
  }
};

/**
 * Post setting to the API
 * @param {Object} setting - The setting to post
 * @returns {Promise<Object>} The response from the API
 */
export const postSetting = async (setting) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/settings`, setting, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    logger.info(`Posted setting to API successfully: ${JSON.stringify(setting)}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}` 
      : error.message;
    logger.error(`Error posting setting to API: ${errorMessage}`);
    throw error;
  }
};

/**
 * Process and save sensor data to MongoDB
 * @param {Array} data - The sensor data to save
 */
export const processSensorData = async (data) => {
  try {
    // Skip processing if no data
    if (!Array.isArray(data) || data.length === 0) {
      return;
    }
    
    // Process each reading
    const promises = data.map(async (reading) => {
      try {
        // Skip invalid data
        if (!reading.sensor_id) {
          logger.warn(`Skipping invalid sensor data: missing sensor_id`);
          return;
        }
        
        // Convert temperature_data from strings to numbers if needed
        const temperatures = Array.isArray(reading.temperature_data) ? 
          reading.temperature_data.map(temp => typeof temp === 'string' ? parseFloat(temp) : temp) : 
          reading.temperatures || [];
        
        // Format date and time correctly
        let dateStr = reading.date;
        let timeStr = reading.time;
        
        // If created_at is a string like "2025/04/02 16:24:34.347", parse it into date and time
        if (reading.created_at && typeof reading.created_at === 'string') {
          const parts = reading.created_at.split(' ');
          if (parts.length === 2) {
            if (!dateStr) dateStr = parts[0];
            if (!timeStr) timeStr = parts[1];
          }
        }
        
        // Map the incoming data to match our schema
        const sensorReading = {
          sensorId: reading.sensor_id,
          temperatures: temperatures,
          isAbnormal: reading.is_abnormal || reading.isAbnormal || false,
          temperature_ave: reading.average_temp || reading.temperature_ave || null,
          timestamp: new Date(),
          acquisitionDate: dateStr || new Date().toLocaleDateString('ja-JP'),
          acquisitionTime: timeStr || new Date().toLocaleTimeString('ja-JP'),
          status: reading.status || (reading.is_abnormal ? 'anomaly' : 'normal')
        };
        
        // Save to MongoDB using our model
        const result = await SensorData.addSensorData(sensorReading);
        logger.info(`Successfully saved sensor reading to MongoDB: ${result._id}`);
        
        // Only after successful DB save, notify listeners about this specific reading
        if (callbacks.onDataFetched && typeof callbacks.onDataFetched === 'function') {
          // Format data to match what the client expects
          const formattedData = {
            sensorId: sensorReading.sensorId,
            readings: [sensorReading]
          };
          callbacks.onDataFetched(formattedData);
        }
      } catch (error) {
        logger.error(`Error processing individual sensor reading: ${error.message}`);
      }
    });
    
    await Promise.all(promises);
    logger.info(`Successfully processed ${data.length} sensor readings`);
  } catch (error) {
    logger.error('Error processing sensor data:', error.message);
  }
};

/**
 * Process and save alerts to MongoDB
 * @param {Array} alerts - The alerts to save
 */
export const processAlerts = async (alerts) => {
  try {
    // Skip processing if no alerts
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return;
    }
    
    // Process each alert
    const promises = alerts.map(async (alert) => {
      try {
        // Skip invalid data
        if (!alert.sensor_id) {
          logger.warn(`Skipping invalid alert: missing sensor_id`);
          return;
        }
        
        // Map the incoming data to match our schema
        const alertData = {
          sensorId: alert.sensor_id,
          alertReason: alert.alert_reason || alert.message || alert.event,
          status: alert.status || alert.event_type,
          timestamp: new Date(),
          date: alert.date || new Date().toLocaleDateString('ja-JP'),
          time: alert.time || new Date().toLocaleTimeString('ja-JP'),
          value: alert.value
        };
        
        // Save to MongoDB using our model
        const result = await SensorData.addAlert(alertData);
        logger.info(`Successfully saved alert to MongoDB for sensor: ${alertData.sensorId}`);
        
        // Only notify listeners after successful database save
        if (callbacks.onAlertsFetched && typeof callbacks.onAlertsFetched === 'function') {
          // Format data to match what the client expects
          const formattedAlert = {
            sensorId: alertData.sensorId,
            alerts: [alertData]
          };
          callbacks.onAlertsFetched(formattedAlert);
        }
      } catch (error) {
        logger.error(`Error processing individual alert: ${error.message}`);
      }
    });
    
    await Promise.all(promises);
    logger.info(`Successfully processed ${alerts.length} alerts`);
  } catch (error) {
    logger.error('Error processing alerts:', error.message);
  }
};

/**
 * Process and save settings to MongoDB
 * @param {Array} settings - The settings to save
 */
export const processSettings = async (settings) => {
  try {
    // Skip processing if no settings
    if (!Array.isArray(settings) || settings.length === 0) {
      return;
    }
    
    // Process each setting
    const promises = settings.map(async (setting) => {
      try {
        // Skip invalid data
        if (!setting.sensor_id) {
          logger.warn(`Skipping invalid setting: missing sensor_id`);
          return;
        }
        
        // Map the incoming data to match our schema
        const settingData = {
          sensorId: setting.sensor_id,
          content: setting.content,
          changeType: setting.change_type || setting.type,
          value: setting.value
        };
        
        // Save to MongoDB using our model
        const result = await SensorData.addSetting(settingData);
        logger.info(`Successfully saved setting to MongoDB for sensor: ${settingData.sensorId}`);
        
        // Only notify listeners after successful database save
        if (callbacks.onSettingsFetched && typeof callbacks.onSettingsFetched === 'function') {
          // Format data to match what the client expects
          const formattedSetting = {
            sensorId: settingData.sensorId,
            settings: [settingData]
          };
          callbacks.onSettingsFetched(formattedSetting);
        }
      } catch (error) {
        logger.error(`Error processing individual setting: ${error.message}`);
      }
    });
    
    await Promise.all(promises);
    logger.info(`Successfully processed ${settings.length} settings`);
  } catch (error) {
    logger.error('Error processing settings:', error.message);
  }
};

/**
 * Start polling the API at regular intervals
 */
export const startPolling = () => {
  if (pollingInterval) {
    logger.warn('API polling is already active');
    return;
  }
  
  logger.info(`Starting to poll API every ${API_POLLING_INTERVAL}ms`);
  
  // Define polling function
  const pollApi = async () => {
    try {
      // Fetch and process sensor data
      const sensorData = await fetchSensorData();
      if (sensorData.length > 0) {
        await processSensorData(sensorData);
      }
      
      // Fetch and process alerts
      const alerts = await fetchAlerts();
      if (alerts.length > 0) {
        await processAlerts(alerts);
      }
      
      // Fetch and process settings
      const settings = await fetchSettings();
      if (settings.length > 0) {
        await processSettings(settings);
      }
    } catch (error) {
      logger.error('Error during API polling cycle:', error.message);
    }
  };
  
  // Run immediately once
  pollApi();
  
  // Then set up regular interval
  pollingInterval = setInterval(pollApi, API_POLLING_INTERVAL);
};

/**
 * Stop polling the API
 */
export const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Stopped polling API');
  }
};