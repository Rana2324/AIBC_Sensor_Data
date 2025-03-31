let io;
const logger = require('../config/logger');
const mongoose = require('mongoose');
let pollingInterval;
let lastDataTimestamps = {}; // Track last seen data timestamps per sensor

const initSocket = (socketIo) => {
    io = socketIo;
    
    io.on('connection', (socket) => {
        logger.info('Client connected');

        // Send initial full dataset when a client connects
        sendFullDataset(socket);

        // When a client connects, start sending them updates
        startDataPolling();

        // Handle client requesting full data refresh
        socket.on('requestFullData', () => {
            sendFullDataset(socket);
        });

        socket.on('disconnect', () => {
            logger.info('Client disconnected');
            
            // If no clients are connected, stop polling to save resources
            if (io.engine.clientsCount === 0) {
                stopDataPolling();
            }
        });
    });
};

// Send complete dataset to client
const sendFullDataset = async (socket) => {
    try {
        logger.info('Sending full dataset to client');
        
        // Get latest temperature readings for all sensors
        const TemperatureReading = mongoose.model('TemperatureReading');
        const sensorIds = await TemperatureReading.distinct('sensorId');
        
        for (const sensorId of sensorIds) {
            const data = await TemperatureReading
                .find({ sensorId })
                .sort({ timestamp: -1 })
                .limit(100);
                
            if (data.length > 0) {
                // Track the latest timestamp for this sensor
                lastDataTimestamps[sensorId] = data[0].timestamp;
                
                // Send complete dataset for this sensor
                socket.emit('fullSensorData', {
                    sensorId,
                    readings: data
                });
                logger.info(`Sent full dataset (${data.length} readings) for sensor ${sensorId}`);
            }
        }
        
        // Send other data types as well
        sendFullAlertsDataset(socket);
        sendFullSettingsDataset(socket);
        sendFullPersonalityDataset(socket);
        
    } catch (error) {
        logger.error('Error sending full dataset:', error);
    }
};

const sendFullAlertsDataset = async (socket) => {
    try {
        const Alert = mongoose.model('Alert');
        const alerts = await Alert.find().sort({ timestamp: -1 }).limit(100);
        socket.emit('fullAlertsData', alerts);
        logger.info(`Sent full alerts dataset (${alerts.length} alerts)`);
    } catch (error) {
        logger.error('Error sending full alerts dataset:', error);
    }
};

const sendFullSettingsDataset = async (socket) => {
    try {
        const Setting = mongoose.model('Setting');
        const settings = await Setting.find().sort({ timestamp: -1 }).limit(100);
        socket.emit('fullSettingsData', settings);
        logger.info(`Sent full settings dataset (${settings.length} settings)`);
    } catch (error) {
        logger.error('Error sending full settings dataset:', error);
    }
};

const sendFullPersonalityDataset = async (socket) => {
    try {
        const Personality = mongoose.model('Personality');
        const personalities = await Personality.find().sort({ timestamp: -1 }).limit(100);
        socket.emit('fullPersonalityData', personalities);
        logger.info(`Sent full personality dataset (${personalities.length} items)`);
    } catch (error) {
        logger.error('Error sending full personality dataset:', error);
    }
};

// Poll database for updates and emit to clients
const startDataPolling = () => {
    // Only start polling if it's not already running
    if (pollingInterval) return;
    
    logger.info('Starting data polling (1-second interval)');
    
    // Poll for temperature data every 1 second
    pollingInterval = setInterval(async () => {
        try {
            // Check for new data for each sensorId
            const TemperatureReading = mongoose.model('TemperatureReading');
            const sensorIds = await TemperatureReading.distinct('sensorId');
            
            let newDataFound = false;
            
            for (const sensorId of sensorIds) {
                // Query for any new data since the last timestamp we've seen
                const lastTimestamp = lastDataTimestamps[sensorId] || new Date(0);
                
                const newData = await TemperatureReading
                    .find({ 
                        sensorId,
                        timestamp: { $gt: lastTimestamp }
                    })
                    .sort({ timestamp: -1 });
                
                if (newData.length > 0) {
                    // We have new data for this sensor!
                    newDataFound = true;
                    logger.info(`Found ${newData.length} new readings for sensor ${sensorId}`);
                    
                    // Update our last seen timestamp
                    lastDataTimestamps[sensorId] = newData[0].timestamp;
                    
                    // Option 1: Emit each new reading
                    newData.forEach(reading => {
                        emitSensorData(reading);
                    });
                    
                    // Option 2: Broadcast an event indicating new data is available
                    // This will cause connected clients to request a full refresh
                    io.emit('newDataAvailable', { sensorId, count: newData.length });
                }
            }
            
            // If new data was found for any sensor, broadcast notification
            if (newDataFound) {
                io.emit('dataUpdated', { timestamp: new Date() });
            }
            
            // Check for recent alerts
            const Alert = mongoose.model('Alert');
            const latestAlerts = await Alert
                .find({ timestamp: { $gt: new Date(Date.now() - 60000) } }) // Alerts from last minute
                .sort({ timestamp: -1 });
                
            latestAlerts.forEach(alert => {
                emitAlert(alert);
            });
            
            // Check for recent settings changes
            const Setting = mongoose.model('Setting');
            const latestSettings = await Setting
                .find({ timestamp: { $gt: new Date(Date.now() - 60000) } }) // Settings from last minute
                .sort({ timestamp: -1 });
                
            latestSettings.forEach(setting => {
                emitSettingChange(setting);
            });
            
            // Check for recent personality updates
            const Personality = mongoose.model('Personality');
            const latestPersonality = await Personality
                .find({ timestamp: { $gt: new Date(Date.now() - 60000) } }) // Updates from last minute
                .sort({ timestamp: -1 });
                
            latestPersonality.forEach(item => {
                emitPersonalityUpdate(item);
            });
            
        } catch (error) {
            logger.error('Error in data polling:', error);
        }
    }, 1000); // Poll every 1 second
};

const stopDataPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        logger.info('Data polling stopped');
    }
};

const emitSensorData = (data) => {
    if (!io) return;
    
    try {
        // Add timestamp and calculate abnormality if not present
        const temperatures = data.temperatures || [];
        const validTemps = temperatures.filter(temp => temp !== null && temp !== undefined);
        
        const processedData = {
            ...data.toObject ? data.toObject() : data,
            timestamp: data.timestamp || new Date(),
            isAbnormal: data.isAbnormal !== undefined ? data.isAbnormal :
                validTemps.some(temp => temp < 20 || temp > 26) ||
                (validTemps.length > 1 && Math.max(...validTemps) - Math.min(...validTemps) > 5)
        };
        
        io.emit('newSensorData', processedData);
        
        // If abnormal, also emit an alert
        if (processedData.isAbnormal) {
            const alert = {
                sensorId: data.sensorId,
                timestamp: new Date(),
                event: '温度異常を検出しました',
                eventType: 'TEMPERATURE_ABNORMAL'
            };
            emitAlert(alert);
        }
    } catch (error) {
        logger.error('Error emitting sensor data:', error);
    }
};

const emitAlert = (data) => {
    if (!io) return;
    
    try {
        const alert = {
            ...(data.toObject ? data.toObject() : data),
            date: new Date(data.timestamp || data.date || new Date()).toLocaleDateString('ja-JP'),
            time: new Date(data.timestamp || data.date || new Date()).toLocaleTimeString('ja-JP')
        };
        io.emit('alert', alert);
        logger.info(`Emitted alert for ${data.sensorId}: ${data.event || data.alertReason}`);
    } catch (error) {
        logger.error('Error emitting alert:', error);
    }
};

const emitSettingChange = (data) => {
    if (!io) return;
    
    try {
        const setting = {
            ...(data.toObject ? data.toObject() : data),
            date: new Date(data.timestamp || new Date()).toLocaleDateString('ja-JP'),
            time: new Date(data.timestamp || new Date()).toLocaleTimeString('ja-JP'),
            content: data.content || `${data.changeType}: ${JSON.stringify(data.value)}`
        };
        io.emit('settingChange', setting);
        logger.info(`Emitted setting change for ${data.sensorId}`);
    } catch (error) {
        logger.error('Error emitting setting change:', error);
    }
};

const emitPersonalityUpdate = (data) => {
    if (!io) return;
    
    try {
        const update = {
            ...(data.toObject ? data.toObject() : data),
            date: new Date(data.timestamp || new Date()).toLocaleDateString('ja-JP'),
            time: new Date(data.timestamp || new Date()).toLocaleTimeString('ja-JP'),
            content: data.content || `${data.biasType}: ${data.biasValue && data.biasValue.level ? data.biasValue.level : JSON.stringify(data.biasValue)}`
        };
        io.emit('personalityUpdate', update);
        logger.info(`Emitted personality update for ${data.sensorId}`);
    } catch (error) {
        logger.error('Error emitting personality update:', error);
    }
};

module.exports = {
    initSocket,
    emitSensorData,
    emitAlert,
    emitSettingChange,
    emitPersonalityUpdate
};