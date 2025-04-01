// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tabs - make the first tab active by default
  const defaultTabId = 'sensorTab';
  const defaultTabBtn = document.getElementById('sensorTabBtn');
  
  if (defaultTabBtn && document.getElementById(defaultTabId)) {
    document.getElementById(defaultTabId).classList.add('active');
    defaultTabBtn.classList.add('active');
  }
  
  // Initialize scrollbar overflow indicators
  initScrollIndicators();
  
  // Setup Socket.IO functionality
  setupSocketIO();
});

// Check for table overflow to add visual indicators
function initScrollIndicators() {
  // Check all table wrappers for overflow
  document.querySelectorAll('.table-wrapper').forEach(wrapper => {
    // Check if content is overflowing
    if (wrapper.scrollHeight > wrapper.clientHeight) {
      wrapper.classList.add('has-overflow');
    }
  });
}

// Setup Socket.IO functionality
function setupSocketIO() {
  const socket = io();
  
  // Connection status indicators
  socket.on('connect', () => {
    console.log('Connected to server');
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
      connectionStatus.textContent = '接続済み';
      connectionStatus.className = 'connection-status connected';
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
      connectionStatus.textContent = '切断';
      connectionStatus.className = 'connection-status disconnected';
    }
  });
  
  // Track last received data timestamps per sensor to avoid duplicate updates
  const lastReceivedTimestamps = {};
  
  // Data event handlers
  socket.on('fullSensorData', (data) => {
    console.log('Received full sensor data:', data.sensorId);
    if (handleFullSensorData(data)) {
      // Only pulse if there's new data
      pulseRealTimeIndicator(data.sensorId);
    }
  });
  
  socket.on('sensorDataUpdate', (data) => {
    console.log('Received sensor data update:', data.sensorId);
    // Check if this is actually new data
    const isNewData = handleFullSensorData(data, lastReceivedTimestamps);
    if (isNewData) {
      pulseRealTimeIndicator(data.sensorId);
    }
  });
  
  socket.on('fullAlertsData', (data) => {
    console.log('Received full alerts data');
    handleFullAlertsData(data);
  });
  
  socket.on('alertsUpdate', (data) => {
    console.log('Received alerts update');
    // Check if this contains new alerts
    const newAlerts = handleFullAlertsData(data, true);
    
    if (newAlerts && newAlerts.length > 0) {
      // Group alerts by sensor
      const alertsBySensor = {};
      newAlerts.forEach(alert => {
        if (!alert.sensorId) return;
        if (!alertsBySensor[alert.sensorId]) {
          alertsBySensor[alert.sensorId] = [];
        }
        alertsBySensor[alert.sensorId].push(alert);
      });
      
      // Pulse indicators for each affected sensor
      for (const sensorId in alertsBySensor) {
        pulseRealTimeIndicator(sensorId, 'alert');
      }
    }
  });
  
  socket.on('fullSettingsData', (data) => {
    console.log('Received full settings data');
    handleFullSettingsData(data);
  });
  
  socket.on('settingsUpdate', (data) => {
    console.log('Received settings update');
    handleFullSettingsData(data);
  });
  
  socket.on('fullPersonalityData', (data) => {
    console.log('Received full personality data');
    handleFullPersonalityData(data);
  });
  
  socket.on('personalityUpdate', (data) => {
    console.log('Received personality update');
    handleFullPersonalityData(data);
  });
  
  socket.on('dataHeartbeat', (data) => {
    console.log('Received heartbeat:', data.timestamp);
    // Just update timestamps without pulsing indicators
    document.querySelectorAll('.last-updated').forEach(el => {
      if (!el.id.includes('data-last-updated') && !el.id.includes('alert-last-updated')) {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        el.textContent = `最終更新: ${formattedTime}`;
      }
    });
  });
  
  // Setup automatic refresh every 60 seconds
  setInterval(() => {
    if (socket.connected) {
      console.log('Auto-refreshing data...');
      socket.emit('requestFullData');
    }
  }, 60000);
  
  // Initial data request on connection
  socket.on('connect', () => {
    console.log('Requesting initial data...');
    socket.emit('requestFullData');
  });
}

// Update temperature cell styles dynamically using CSS classes
function styleTemperatureCell(td, tempValue) {
  // First, make sure all cells have default white background
  td.style.backgroundColor = 'white';
  td.style.color = '';
  td.classList.remove('temp-danger');
  td.classList.remove('new-temp-warning');
  
  // Only apply the danger styling if the temperature is ≤ 0°C or > 70°C
  if (tempValue !== undefined && tempValue !== null) {
    if (tempValue <= 0 || tempValue > 70) {
      td.style.backgroundColor = '#ffebee';
      td.style.color = 'red';
      td.classList.add('new-temp-warning');
      
      // Remove the animation class after animation completes
      setTimeout(() => {
        td.classList.remove('new-temp-warning');
      }, 2000);
    }
  }
}

// Data handling functions for real-time updates
function handleFullSensorData(data, timestampTracker) {
  if (!data || !data.sensorId || !Array.isArray(data.readings)) return false;

  const tbody = document.getElementById(`tbody-${data.sensorId}`);
  if (!tbody) return false;

  // Check if this is actually new data by comparing latest timestamp
  let isNewData = false;
  if (data.readings.length > 0) {
    const latestTimestamp = new Date(data.readings[0].timestamp).getTime();

    // If we're tracking timestamps between calls
    if (timestampTracker) {
      const prevTimestamp = timestampTracker[data.sensorId];
      // Only consider as new data if timestamp is newer or we have no previous record
      isNewData = !prevTimestamp || latestTimestamp > prevTimestamp;
      if (isNewData) {
        timestampTracker[data.sensorId] = latestTimestamp;
      } else {
        console.log(`Ignoring data for ${data.sensorId} - not new`);
      }
    } else {
      isNewData = true;
    }

    // Update sensor status indicator if this is new data
    if (isNewData) {
      // Consider a sensor active if we have received data in the last 5 minutes
      const now = new Date();
      const lastReading = new Date(data.readings[0].timestamp);
      const isActive = (now - lastReading) < (5 * 60 * 1000);
      updateSensorStatus(data.sensorId, isActive);
    }
  }

  // Clear existing rows
  tbody.innerHTML = '';

  // Add new rows
  data.readings.forEach(reading => {
    const tr = document.createElement('tr');
    if (reading.isAbnormal) tr.classList.add('table-danger');

    // Format date and time
    const timestamp = new Date(reading.timestamp);
    const dateStr = timestamp.toLocaleDateString('ja-JP');
    const timeStr = timestamp.toLocaleTimeString('ja-JP');

    // Create date cell
    const dateCell = document.createElement('td');
    dateCell.textContent = dateStr;
    tr.appendChild(dateCell);

    // Create time cell
    const timeCell = document.createElement('td');
    timeCell.textContent = timeStr;
    tr.appendChild(timeCell);

    // Create temperature cells
    const temperatures = reading.temperatures || [];
    for (let i = 0; i < 16; i++) {
      const td = document.createElement('td');
      const tempValue = temperatures[i];
      td.textContent = tempValue !== undefined && tempValue !== null 
        ? tempValue.toFixed(1) 
        : '--';

      // Apply styles based on temperature value
      styleTemperatureCell(td, tempValue);

      tr.appendChild(td);
    }

    // Create average temperature cell
    const avgTempCell = document.createElement('td');
    const avgTemp = reading.temperature_ave;
    avgTempCell.textContent = avgTemp !== undefined && avgTemp !== null 
      ? `${avgTemp.toFixed(1)} °C` 
      : '--';

    // Apply styles based on average temperature value
    styleTemperatureCell(avgTempCell, avgTemp);

    tr.appendChild(avgTempCell);

    // Create status cell
    const statusCell = document.createElement('td');
    statusCell.textContent = reading.isAbnormal ? '異常' : '正常';
    tr.appendChild(statusCell);

    tbody.appendChild(tr);
  });

  // Only update timestamp indicators if this is new data
  if (isNewData) {
    updateDataLastUpdated(data.sensorId);
  }

  return isNewData;
}

function handleFullAlertsData(alerts, checkForNewOnly = false) {
  if (!Array.isArray(alerts)) return [];
  
  // Track new alerts to determine if we should pulse the indicator
  const newAlerts = checkForNewOnly ? [] : null;
  
  // Group alerts by sensor ID
  const alertsBySensor = {};
  alerts.forEach(alert => {
    if (!alert.sensorId) return;
    
    if (!alertsBySensor[alert.sensorId]) {
      alertsBySensor[alert.sensorId] = [];
    }
    alertsBySensor[alert.sensorId].push(alert);
    
    if (checkForNewOnly && newAlerts) {
      const alertsTable = document.getElementById(`alerts-${alert.sensorId}`);
      if (alertsTable) {
        const alertTimestamp = new Date(alert.timestamp || Date.now()).getTime();
        const alertContent = alert.alert_reason || alert.event || alert.alertReason || '';
        
        let existingAlert = false;
        const rows = alertsTable.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length >= 3) {
            const content = cells[2].textContent;
            if (content === alertContent) {
              existingAlert = true;
              break;
            }
          }
        }
        
        if (!existingAlert) {
          newAlerts.push(alert);
        }
      }
    }
  });
  
  // Update each sensor's alerts table
  for (const sensorId in alertsBySensor) {
    updateAlertsTable(sensorId, alertsBySensor[sensorId]);
  }
  
  return newAlerts;
}

function handleFullSettingsData(data) {
  if (!Array.isArray(data)) return;
  
  // Group settings by sensor ID
  const settingsBySensor = {};
  data.forEach(setting => {
    if (!setting.sensorId) return;
    
    if (!settingsBySensor[setting.sensorId]) {
      settingsBySensor[setting.sensorId] = [];
    }
    settingsBySensor[setting.sensorId].push(setting);
  });
  
  // Update each sensor's settings table
  for (const sensorId in settingsBySensor) {
    updateSettingsTable(sensorId, settingsBySensor[sensorId]);
  }
}

function handleFullPersonalityData(data) {
  if (!Array.isArray(data)) return;
  
  // Group personality data by sensor ID
  const personalityBySensor = {};
  data.forEach(item => {
    if (!item.sensorId) return;
    
    if (!personalityBySensor[item.sensorId]) {
      personalityBySensor[item.sensorId] = [];
    }
    personalityBySensor[item.sensorId].push(item);
  });
  
  // Update each sensor's personality table
  for (const sensorId in personalityBySensor) {
    updatePersonalityTable(sensorId, personalityBySensor[sensorId]);
  }
}

// UI update functions
function updateAlertsTable(sensorId, alerts) {
  const alertsTable = document.getElementById(`alerts-${sensorId}`);
  if (!alertsTable) return;
  
  // Clear existing rows
  alertsTable.innerHTML = '';
  
  if (alerts.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-table-row';
    
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'アラート履歴はありません';
    
    tr.appendChild(td);
    alertsTable.appendChild(tr);
    return;
  }
  
  // Add new rows
  alerts.forEach(alert => {
    const tr = document.createElement('tr');
    tr.className = alert.eventType?.includes('RECOVERY') ? 'alert-recovery' : 'alert-row';
    
    let date = alert.date || '';
    let time = alert.time || '';
    
    if (!date || !time) {
      const timestamp = new Date(alert.timestamp || Date.now());
      date = date || timestamp.toLocaleDateString('ja-JP');
      time = time || timestamp.toLocaleTimeString('ja-JP');
    }
    
    const dateCell = document.createElement('td');
    dateCell.textContent = date;
    tr.appendChild(dateCell);
    
    const timeCell = document.createElement('td');
    timeCell.textContent = time;
    tr.appendChild(timeCell);
    
    const eventCell = document.createElement('td');
    eventCell.textContent = alert.alert_reason || alert.event || alert.alertReason || '-';
    tr.appendChild(eventCell);
    
    alertsTable.appendChild(tr);
  });
}

function updateSettingsTable(sensorId, settings) {
  const settingsTable = document.getElementById(`settings-${sensorId}`);
  if (!settingsTable) return;
  
  // Clear existing rows
  settingsTable.innerHTML = '';
  
  if (settings.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-table-row';
    
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = '設定変更履歴はありません';
    
    tr.appendChild(td);
    settingsTable.appendChild(tr);
    return;
  }
  
  // Add new rows
  settings.forEach(setting => {
    const tr = document.createElement('tr');
    
    let date = setting.date || '';
    let time = setting.time || '';
    
    if (!date || !time) {
      const timestamp = new Date(setting.timestamp || Date.now());
      date = date || timestamp.toLocaleDateString('ja-JP');
      time = time || timestamp.toLocaleTimeString('ja-JP');
    }
    
    const dateCell = document.createElement('td');
    dateCell.textContent = date;
    tr.appendChild(dateCell);
    
    const timeCell = document.createElement('td');
    timeCell.textContent = time;
    tr.appendChild(timeCell);
    
    const contentCell = document.createElement('td');
    contentCell.textContent = setting.content || '-';
    tr.appendChild(contentCell);
    
    settingsTable.appendChild(tr);
  });
}

function updatePersonalityTable(sensorId, items) {
  const personalityTable = document.getElementById(`personality-${sensorId}`);
  if (!personalityTable) return;
  
  // Clear existing rows
  personalityTable.innerHTML = '';
  
  if (!items || items.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-table-row';
    
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'バイアス設定履歴はありません';
    
    tr.appendChild(td);
    personalityTable.appendChild(tr);
    return;
  }
  
  // Add new rows
  items.forEach(item => {
    const tr = document.createElement('tr');
    
    let date = item.date || '';
    let time = item.time || '';
    
    if (!date || !time) {
      const timestamp = new Date(item.timestamp || Date.now());
      date = date || timestamp.toLocaleDateString('ja-JP');
      time = time || timestamp.toLocaleTimeString('ja-JP');
    }
    
    const dateCell = document.createElement('td');
    dateCell.textContent = date;
    tr.appendChild(dateCell);
    
    const timeCell = document.createElement('td');
    timeCell.textContent = time;
    tr.appendChild(timeCell);
    
    const contentCell = document.createElement('td');
    contentCell.textContent = item.content || '-';
    tr.appendChild(contentCell);
    
    personalityTable.appendChild(tr);
  });
}

// UI helper functions
function switchTab(tabId, button) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab content
  document.getElementById(tabId).classList.add('active');
  
  // Activate selected button
  button.classList.add('active');
}

function toggleTableExpand(tableId) {
  const tableWrapper = document.getElementById(tableId);
  const button = event.currentTarget;
  const toggleIcon = button.querySelector('.toggle-icon');
  const toggleText = button.querySelector('.toggle-text');
  
  if (tableWrapper) {
    tableWrapper.classList.toggle('expanded');
    
    if (tableWrapper.classList.contains('expanded')) {
      toggleText.textContent = '折りたたむ';
      toggleIcon.style.transform = 'rotate(180deg)';
      button.setAttribute('aria-expanded', 'true');
    } else {
      toggleText.textContent = '展開';
      toggleIcon.style.transform = 'rotate(0deg)';
      button.setAttribute('aria-expanded', 'false');
    }
  }
}

function refreshData(sensorId) {
  const button = event.currentTarget;
  
  // Add spinning animation to the refresh button
  button.classList.add('spinning');
  
  // Emit a request for updated data
  const socket = io();
  socket.emit('requestSensorData', { sensorId: sensorId });
  
  // Remove spinning class after 1 second
  setTimeout(() => {
    button.classList.remove('spinning');
  }, 1000);
}

function refreshAlertData(sensorId) {
  const button = event.currentTarget;
  
  // Add spinning animation to the refresh button
  button.classList.add('spinning');
  
  // Emit a request for updated alert data
  const socket = io();
  socket.emit('requestAlertsData', { sensorId: sensorId });
  
  // Remove spinning class after 1 second
  setTimeout(() => {
    button.classList.remove('spinning');
  }, 1000);
  
  // Update timestamp
  updateAlertLastUpdated(sensorId);
}

function refreshSettingsData(sensorId) {
  const button = event.currentTarget;
  
  // Add spinning animation to the refresh button
  button.classList.add('spinning');
  
  // Emit a request for updated settings data
  const socket = io();
  socket.emit('requestSettingsData', { sensorId: sensorId });
  
  // Remove spinning class after 1 second
  setTimeout(() => {
    button.classList.remove('spinning');
  }, 1000);
  
  // Update timestamp
  updateSettingsLastUpdated(sensorId);
}

function refreshPersonalityData(sensorId) {
  const button = event.currentTarget;
  
  // Add spinning animation to the refresh button
  button.classList.add('spinning');
  
  // Emit a request for updated personality data
  const socket = io();
  socket.emit('requestPersonalityData', { sensorId: sensorId });
  
  // Remove spinning class after 1 second
  setTimeout(() => {
    button.classList.remove('spinning');
  }, 1000);
  
  // Update timestamp
  updatePersonalityLastUpdated(sensorId);
}

// Timestamp update functions
function updateDataLastUpdated(sensorId) {
  updateTimestamp(`data-last-updated-${sensorId}`);
}

function updateAlertLastUpdated(sensorId) {
  updateTimestamp(`alert-last-updated-${sensorId}`);
}

function updateSettingsLastUpdated(sensorId) {
  updateTimestamp(`settings-last-updated-${sensorId}`);
}

function updatePersonalityLastUpdated(sensorId) {
  updateTimestamp(`personality-last-updated-${sensorId}`);
}

function updateTimestamp(elementId) {
  const now = new Date();
  const formattedTime = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = `最終更新: ${formattedTime}`;
    element.classList.add('timestamp-updated');
    setTimeout(() => {
      element.classList.remove('timestamp-updated');
    }, 2000);
  }
}

// Real-time indicator functions
function pulseRealTimeIndicator(sensorId, type = 'data') {
  let indicatorId;
  switch (type) {
    case 'alert':
      indicatorId = `alert-realtime-indicator-${sensorId}`;
      break;
    case 'settings':
      indicatorId = `settings-realtime-indicator-${sensorId}`;
      break;
    case 'personality':
      indicatorId = `personality-realtime-indicator-${sensorId}`;
      break;
    case 'data':
    default:
      indicatorId = `realtime-indicator-${sensorId}`;
      break;
  }
  
  const indicator = document.getElementById(indicatorId);
  if (!indicator) return;
  
  // Find the dot element within the indicator
  const dot = indicator.querySelector('.realtime-dot');
  if (dot) {
    // Add the active-pulse class (matches the CSS animation class)
    dot.classList.add('active-pulse');
    
    // Remove the class after the animation completes
    setTimeout(() => {
      dot.classList.remove('active-pulse');
    }, 2000);
  }
  
  // Update the corresponding timestamp
  switch (type) {
    case 'alert':
      updateAlertLastUpdated(sensorId);
      break;
    case 'settings':
      updateSettingsLastUpdated(sensorId);
      break;
    case 'personality':
      updatePersonalityLastUpdated(sensorId);
      break;
    case 'data':
    default:
      updateDataLastUpdated(sensorId);
      break;
  }
}

function updateSensorStatus(sensorId, isActive) {
  const statusElement = document.querySelector(`#sensor-${sensorId} .sensor-status`);
  if (statusElement) {
    if (isActive) {
      statusElement.classList.remove('inactive');
      statusElement.classList.add('active');
      statusElement.textContent = '稼働中';
    } else {
      statusElement.classList.remove('active');
      statusElement.classList.add('inactive');
      statusElement.textContent = '停止中';
    }
    
    statusElement.classList.add('status-changed');
    setTimeout(() => {
      statusElement.classList.remove('status-changed');
    }, 1000);
  }
}