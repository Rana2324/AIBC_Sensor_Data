import logger from '../config/logger.js';
import mongoose from 'mongoose';
import os from 'os';

let io;
let pollingInterval;
let serverStatsInterval;
let lastDataTimestamps = {}; // Track last seen data timestamps per sensor

// Server statistics functions (defined at the top so they're available throughout the file)
async function sendServerStats(socket) {
    try {
        const stats = await collectServerStats();
        socket.emit('serverStats', stats);
        
        const performanceStats = collectPerformanceStats();
        socket.emit('performanceStats', performanceStats);
        
        const dataStats = await collectDataStats();
        socket.emit('dataStats', dataStats);
        
        logger.info('Sent server statistics to client');
    } catch (error) {
        logger.error('Error sending server statistics:', error);
    }
}

async function collectServerStats() {
    try {
        const db = mongoose.connection.db;
        const temperatureReadings = db.collection('temperature_readings');
        
        // Get sensor counts
        const sensorIds = await temperatureReadings.distinct('sensor_id');
        const totalSensors = sensorIds.length;
        
        // Consider a sensor active if it has data in the last 5 minutes
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        let activeSensors = 0;
        for (const sensorId of sensorIds) {
            const recentData = await temperatureReadings
                .find({ 
                    sensor_id: sensorId,
                    timestamp: { $gt: fiveMinutesAgo }
                })
                .limit(1)
                .toArray();
                
            if (recentData.length > 0) {
                activeSensors++;
            }
        }
        
        // Get the timestamp of the most recent data
        const latestReading = await temperatureReadings
            .find({})
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();
            
        const lastUpdateTime = latestReading.length > 0 
            ? latestReading[0].timestamp || latestReading[0].created_at
            : null;
            
        // MongoDB connection status
        const mongoDbConnected = mongoose.connection.readyState === 1;
        
        return {
            totalSensors,
            activeSensors,
            lastUpdateTime,
            mongoDbConnected
        };
    } catch (error) {
        logger.error('Error collecting server stats:', error);
        return {
            totalSensors: 0,
            activeSensors: 0,
            lastUpdateTime: null,
            mongoDbConnected: false
        };
    }
}

function collectPerformanceStats() {
    try {
        // CPU usage calculation
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        const cpuIdle = totalIdle / cpus.length;
        const cpuTotal = totalTick / cpus.length;
        const cpuUsage = 100 - (100 * cpuIdle / cpuTotal);
        
        // Memory usage
        const memoryUsage = process.memoryUsage().rss; // Resident Set Size in bytes
        
        return {
            uptime: process.uptime(), // Server uptime in seconds
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            clientCount: io.engine.clientsCount || 0
        };
    } catch (error) {
        logger.error('Error collecting performance stats:', error);
        return {
            uptime: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            clientCount: 0
        };
    }
}

async function collectDataStats() {
    try {
        const db = mongoose.connection.db;
        const temperatureReadings = db.collection('temperature_readings');
        const alertsLog = db.collection('alerts_log');
        
        // Get total data points count
        const totalDataPoints = await temperatureReadings.countDocuments();
        
        // Get today's data points count
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const todayDataPoints = await temperatureReadings.countDocuments({
            timestamp: { $gte: startOfToday }
        });
        
        // Get today's alerts count
        const todayAlerts = await alertsLog.countDocuments({
            timestamp: { $gte: startOfToday }
        });
        
        // Get database size (not perfectly accurate but a good estimate)
        const dbStats = await db.stats();
        const dbSize = dbStats.dataSize;
        
        return {
            totalDataPoints,
            todayDataPoints,
            todayAlerts,
            dbSize
        };
    } catch (error) {
        logger.error('Error collecting data stats:', error);
        return {
            totalDataPoints: 0,
            todayDataPoints: 0,
            todayAlerts: 0,
            dbSize: 0
        };
    }
}

async function sendServerStatsToAll() {
    if (!io) return;
    
    try {
        const stats = await collectServerStats();
        io.emit('serverStats', stats);
        
        const performanceStats = collectPerformanceStats();
        io.emit('performanceStats', performanceStats);
        
        const dataStats = await collectDataStats();
        io.emit('dataStats', dataStats);
    } catch (error) {
        logger.error('Error sending server stats to all clients:', error);
    }
}

const startServerStatsMonitoring = () => {
    // Only start monitoring if it's not already running
    if (serverStatsInterval) return;
    
    logger.info('Starting server stats monitoring (5-second interval)');
    
    // Initial send of server stats
    sendServerStatsToAll();
    
    // Then send updated stats every 5 seconds
    serverStatsInterval = setInterval(() => {
        sendServerStatsToAll();
    }, 5000); // Send stats every 5 seconds to reduce server load
};

const stopServerStatsMonitoring = () => {
    if (serverStatsInterval) {
        clearInterval(serverStatsInterval);
        serverStatsInterval = null;
        logger.info('Server stats monitoring stopped');
    }
};

// Socket.IO connection handling
const initSocket = (socketIo) => {
    io = socketIo;
    
    io.on('connection', (socket) => {
        logger.info('Client connected');

        // Send initial full dataset when a client connects
        sendFullDataset(socket);

        // When a client connects, start sending them updates
        startDataPolling();
        
        // Start server stats monitoring
        startServerStatsMonitoring();

        // Handle client requesting full data refresh
        socket.on('requestFullData', () => {
            sendFullDataset(socket);
        });
        
        // Handle client requesting server stats
        socket.on('requestServerStats', async () => {
            sendServerStats(socket);
        });

        socket.on('disconnect', () => {
            logger.info('Client disconnected');
            
            // If no clients are connected, stop polling to save resources
            if (io.engine.clientsCount === 0) {
                stopDataPolling();
                stopServerStatsMonitoring();
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
        // Use the direct MongoDB connection instead of the Mongoose model
        const db = mongoose.connection.db;
        const settingsHistory = db.collection('settings_history');
        
        const settings = await settingsHistory
            .find()
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();
            
        // Format settings data for the frontend
        const formattedSettings = settings.map(item => ({
            ...item,
            sensorId: item.sensor_id || item.sensorId,
            date: item.date || new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString('ja-JP'),
            time: item.time || new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString('ja-JP'),
            content: item.content || `${item.changeType || 'Setting'}: ${item.value !== undefined ? item.value : JSON.stringify(item.value)}`
        }));
        
        socket.emit('fullSettingsData', formattedSettings);
        logger.info(`Sent full settings dataset (${formattedSettings.length} settings)`);
    } catch (error) {
        logger.error('Error sending full settings dataset:', error);
    }
};

const sendFullPersonalityDataset = async (socket) => {
    try {
        // Use the direct MongoDB connection instead of the Mongoose model
        const db = mongoose.connection.db;
        const personalityHistory = db.collection('personality_history');
        
        const personalities = await personalityHistory
            .find()
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();
            
        // Format personality data for the frontend
        const formattedPersonalities = personalities.map(item => ({
            ...item,
            sensorId: item.sensor_id || item.sensorId,
            date: item.date || new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString('ja-JP'),
            time: item.time || new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString('ja-JP'),
            content: item.content || formatPersonalityContent(item)
        }));
        
        socket.emit('fullPersonalityData', formattedPersonalities);
        logger.info(`Sent full personality dataset (${formattedPersonalities.length} items)`);
    } catch (error) {
        logger.error('Error sending full personality dataset:', error);
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
    } else if (item.biasType && item.biasValue) {
        return `${item.biasType}: ${JSON.stringify(item.biasValue)}`;
    } else {
        return `${item.biasType || 'バイアス'}の設定`;
    }
}

// Poll database for updates and emit to clients
const startDataPolling = () => {
    // Only start polling if it's not already running
    if (pollingInterval) return;
    
    logger.info('Starting data polling (1-second interval)');
    
    // Poll for temperature data every 1 second
    pollingInterval = setInterval(async () => {
        try {
            const startTime = Date.now(); // Track execution time
            
            // Get direct access to MongoDB collections
            const db = mongoose.connection.db;
            const temperatureReadings = db.collection('temperature_readings');
            const alertsLog = db.collection('alerts_log');
            const settingsHistory = db.collection('settings_history');
            const personalityHistory = db.collection('personality_history');
            
            // Get unique sensor IDs
            const sensorIds = await temperatureReadings.distinct('sensor_id');
            
            // For each sensor, get their latest readings (up to 100)
            for (const sensorId of sensorIds) {
                const latestReadings = await temperatureReadings
                    .find({ sensor_id: sensorId })
                    .sort({ created_at: -1 })
                    .limit(100)
                    .toArray();
                    
                if (latestReadings.length > 0) {
                    // Process readings to add formatted fields
                    const processedReadings = latestReadings.map(reading => {
                        // Format timestamp
                        const timestamp = reading.created_at || reading.timestamp || new Date();
                        
                        // Process temperatures
                        const temperatures = reading.temperature_data || reading.temperatures || [];
                        const validTemps = temperatures.filter(temp => temp !== null && temp !== undefined);
                        const isAbnormal = validTemps.some(temp => temp < 20 || temp > 26) ||
                                         (validTemps.length > 1 && Math.max(...validTemps) - Math.min(...validTemps) > 5);
                        
                        return {
                            ...reading,
                            sensorId: sensorId,
                            timestamp: timestamp,
                            temperatures: temperatures,
                            isAbnormal: isAbnormal
                        };
                    });
                    
                    // Update our last seen timestamp
                    const newTimestamp = new Date(latestReadings[0].created_at || latestReadings[0].timestamp);
                    const lastTimestamp = lastDataTimestamps[sensorId];
                    
                    // If this is new data or we don't have a timestamp yet, broadcast it
                    if (!lastTimestamp || newTimestamp > lastTimestamp) {
                        lastDataTimestamps[sensorId] = newTimestamp;
                        
                        // Broadcast the complete dataset to all clients
                        io.emit('sensorDataUpdate', {
                            sensorId,
                            readings: processedReadings
                        });
                        
                        logger.info(`Broadcast ${processedReadings.length} readings for sensor ${sensorId}`);
                    }
                }
            }
            
            // Get the 10 most recent alerts
            const latestAlerts = await alertsLog
                .find({})
                .sort({ created_at: -1 })
                .limit(10)
                .toArray();
            
            // Format alerts
            const formattedAlerts = latestAlerts.map(alert => ({
                ...alert,
                sensorId: alert.sensor_id,
                date: alert.date || new Date(alert.created_at || alert.timestamp || Date.now()).toLocaleDateString('ja-JP'),
                time: alert.time || new Date(alert.created_at || alert.timestamp || Date.now()).toLocaleTimeString('ja-JP'),
                event: alert.alert_reason || alert.alertReason || alert.message || 'Unknown alert',
                eventType: alert.eventType || alert.status || ''
            }));
                
            // Broadcast alerts to all clients
            io.emit('alertsUpdate', formattedAlerts);
            
            // Get the 10 most recent settings changes
            const latestSettings = await settingsHistory
                .find({})
                .sort({ timestamp: -1, created_at: -1 })
                .limit(10)
                .toArray();
                
            // Format settings
            const formattedSettings = latestSettings.map(item => ({
                ...item,
                sensorId: item.sensor_id || item.sensorId,
                date: item.date || new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString('ja-JP'),
                time: item.time || new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString('ja-JP'),
                content: item.content || `${item.changeType || 'Setting'}: ${item.value !== undefined ? item.value : JSON.stringify(item.value)}`
            }));
                
            // Broadcast settings to all clients
            io.emit('settingsUpdate', formattedSettings);
            
            // Get the 10 most recent personality updates
            const latestPersonality = await personalityHistory
                .find({})
                .sort({ timestamp: -1, created_at: -1 })
                .limit(10)
                .toArray();
                
            // Format personality data
            const formattedPersonality = latestPersonality.map(item => ({
                ...item,
                sensorId: item.sensor_id || item.sensorId,
                date: item.date || new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString('ja-JP'),
                time: item.time || new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString('ja-JP'),
                content: item.content || formatPersonalityContent(item)
            }));
                
            // Broadcast personality updates to all clients
            io.emit('personalityUpdate', formattedPersonality);
            
            // Send a heartbeat to clients to update the "last updated" timestamp
            io.emit('dataHeartbeat', { timestamp: new Date() });
            
            // Log execution time for performance monitoring
            const executionTime = Date.now() - startTime;
            if (executionTime > 500) { // If execution takes more than 500ms, log a warning
                logger.warn(`Data polling took ${executionTime}ms to execute`);
            }
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
            // Use existing content field or create one from changeType and value
            content: data.content || 
                    (data.changeType && data.value ? 
                        `${data.changeType}: ${typeof data.value === 'object' ? 
                            JSON.stringify(data.value) : data.value}` : 
                        'Setting changed')
        };
        io.emit('settingChange', setting);
        logger.info(`Emitted setting change for ${data.sensorId}: ${setting.content}`);
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
            // Use existing content field or create one from biasType and biasValue
            content: data.content || 
                    (data.biasType && data.biasValue ? 
                        `${data.biasType}: ${data.biasValue.level || JSON.stringify(data.biasValue)}` :
                        'Personality updated')
        };
        io.emit('personalityUpdate', update);
        logger.info(`Emitted personality update for ${data.sensorId}: ${update.content}`);
    } catch (error) {
        logger.error('Error emitting personality update:', error);
    }
};

export {
    initSocket,
    emitSensorData,
    emitAlert,
    emitSettingChange,
    emitPersonalityUpdate
};