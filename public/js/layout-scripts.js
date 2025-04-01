// Socket.IO connection handling
document.addEventListener('DOMContentLoaded', () => {
  const connectionStatus = document.getElementById('connectionStatus');
  const socket = io({
    reconnectionAttempts: 5,
    timeout: 10000,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    connectionStatus.textContent = '接続済み';
    connectionStatus.className = 'connection-status connected';
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connectionStatus.textContent = '切断';
    connectionStatus.className = 'connection-status disconnected';
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionStatus.textContent = '接続エラー';
    connectionStatus.className = 'connection-status disconnected';
  });

  socket.on('newSensorData', (data) => {
    console.log('Received sensor data:', data);
    if (typeof updateSensorData === 'function') {
      updateSensorData(data);
    }
  });

  socket.on('alert', (data) => {
    console.log('Received alert:', data);
    if (typeof handleAlert === 'function') {
      handleAlert(data);
    }
  });

  socket.on('settingChange', (data) => {
    console.log('Setting changed:', data);
    if (typeof handleSettingChange === 'function') {
      handleSettingChange(data);
    }
  });

  socket.on('personalityUpdate', (data) => {
    console.log('Personality updated:', data);
    if (typeof handlePersonalityUpdate === 'function') {
      handlePersonalityUpdate(data);
    }
  });
});