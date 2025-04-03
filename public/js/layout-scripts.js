// Add debugging for Socket.IO events
window.addEventListener('DOMContentLoaded', () => {
  if (window.io) {
    console.log('Socket.IO is available');
    const socket = io();
    
    // Debug Socket.IO connection events
    socket.on('connect', () => {
      console.log('DEBUG: Socket.IO connected, ID:', socket.id);
      document.dispatchEvent(new CustomEvent('socketConnected'));
    });
    
    socket.on('disconnect', () => {
      console.log('DEBUG: Socket.IO disconnected');
    });
    
    socket.on('connect_error', (err) => {
      console.error('DEBUG: Socket.IO connection error:', err);
    });
    
    // Debug data events
    socket.on('newSensorData', (data) => {
      console.log('DEBUG: Received newSensorData event:', data);
    });
    
    socket.on('fullSensorData', (data) => {
      console.log('DEBUG: Received fullSensorData event:', data);
    });
    
    socket.on('sensorDataUpdate', (data) => {
      console.log('DEBUG: Received sensorDataUpdate event:', data);
    });
    
    // Enable global access to socket
    window.debugSocket = socket;
  } else {
    console.error('Socket.IO client library not loaded');
  }
});

// Shared layout scripts
document.addEventListener('DOMContentLoaded', () => {
  // Socket.IO setup for shared layout components
  setupLayoutSocket();
});

// Set up Socket.IO connection and events for layout-wide functionality
function setupLayoutSocket() {
  const socket = io();
  const connectionStatus = document.getElementById('connectionStatus');
  
  // Connection events
  socket.on('connect', () => {
    logger.info('Connected to server');
    connectionStatus.classList.remove('disconnected');
    connectionStatus.classList.add('connected');
    connectionStatus.textContent = 'サーバー接続中';
  });
  
  socket.on('disconnect', () => {
    logger.warn('Disconnected from server');
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    connectionStatus.textContent = 'サーバー接続切れ';
  });
  
  // Handle new sensor data if a function exists to process it
  socket.on('newSensorData', (data) => {
    logger.info('Received sensor data:', data.sensorId);
    if (typeof handleNewSensorData === 'function') {
      handleNewSensorData(data);
    }
  });
  
  // Handle alerts if a function exists to process them
  socket.on('alert', (data) => {
    logger.info('Received alert:', data.sensorId);
    if (typeof handleAlert === 'function') {
      handleAlert(data);
    }
  });

  socket.on('settingChange', (data) => {
    logger.info('Setting changed:', data.sensorId);
    if (typeof handleSettingChange === 'function') {
      handleSettingChange(data);
    }
  });

  socket.on('personalityUpdate', (data) => {
    logger.info('Personality updated:', data.sensorId);
    if (typeof handlePersonalityUpdate === 'function') {
      handlePersonalityUpdate(data);
    }
  });
}
