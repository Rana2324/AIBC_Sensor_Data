/**
 * Simple client-side logger
 * Adds timestamps and log levels to console output
 */
class ClientLogger {
  constructor(options = {}) {
    this.debugEnabled = options.debugEnabled || false;
    this.logToServer = options.logToServer || false;
    this.serverEndpoint = options.serverEndpoint || '/api/logs';
    this.appName = options.appName || 'Client';
    
    // Bind methods
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    
    // Init
    this.info('Logger initialized');
  }
  
  _timestamp() {
    return new Date().toISOString();
  }
  
  _formatMessage(level, message) {
    return `[${this.appName}] ${this._timestamp()} ${level}: ${message}`;
  }
  
  _sendToServer(level, message) {
    if (!this.logToServer) return;
    
    try {
      fetch(this.serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level,
          message,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(err => {
        console.error('Failed to send log to server:', err);
      });
    } catch (err) {
      console.error('Error sending log to server:', err);
    }
  }
  
  debug(message, ...args) {
    if (!this.debugEnabled) return;
    const formattedMessage = this._formatMessage('DEBUG', message);
    console.debug(formattedMessage, ...args);
    this._sendToServer('debug', message);
  }
  
  info(message, ...args) {
    const formattedMessage = this._formatMessage('INFO', message);
    console.info(formattedMessage, ...args);
    this._sendToServer('info', message);
  }
  
  warn(message, ...args) {
    const formattedMessage = this._formatMessage('WARN', message);
    console.warn(formattedMessage, ...args);
    this._sendToServer('warn', message);
  }
  
  error(message, ...args) {
    const formattedMessage = this._formatMessage('ERROR', message);
    console.error(formattedMessage, ...args);
    this._sendToServer('error', message);
  }
}

// Create and export a default instance
const logger = new ClientLogger({
  debugEnabled: window.location.hostname === 'localhost',
  appName: 'SensorData'
});

window.logger = logger; // Make available globally