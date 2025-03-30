let io;
const logger = require('../config/logger');

const initSocket = (socketIo) => {
    io = socketIo;
    
    io.on('connection', (socket) => {
        logger.info('Client connected');

        socket.on('disconnect', () => {
            logger.info('Client disconnected');
        });
    });
};

const emitSensorData = (data) => {
    if (!io) return;
    
    try {
        // Add timestamp and calculate abnormality if not present
        const processedData = {
            ...data,
            timestamp: data.timestamp || new Date(),
            isAbnormal: data.isAbnormal !== undefined ? data.isAbnormal :
                data.temperatures.some(temp => temp < 20 || temp > 26) ||
                Math.max(...data.temperatures) - Math.min(...data.temperatures) > 5
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
            ...data,
            date: new Date(data.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(data.timestamp).toLocaleTimeString('ja-JP')
        };
        io.emit('alert', alert);
    } catch (error) {
        logger.error('Error emitting alert:', error);
    }
};

const emitSettingChange = (data) => {
    if (!io) return;
    
    try {
        const setting = {
            ...data,
            date: new Date(data.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(data.timestamp).toLocaleTimeString('ja-JP')
        };
        io.emit('settingChange', setting);
    } catch (error) {
        logger.error('Error emitting setting change:', error);
    }
};

const emitPersonalityUpdate = (data) => {
    if (!io) return;
    
    try {
        const update = {
            ...data,
            date: new Date(data.timestamp).toLocaleDateString('ja-JP'),
            time: new Date(data.timestamp).toLocaleTimeString('ja-JP')
        };
        io.emit('personalityUpdate', update);
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