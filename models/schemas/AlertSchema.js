import mongoose from 'mongoose';

// Define schema with collection name matching exactly what's in MongoDB
const alertSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  date: String, // Date in YYYY/MM/DD format
  time: String, // Time in HH:MM:SS.xxx format
  alertReason: String, // Alert reason / message
  status: String,
  event: String,
  eventType: String,
  value: mongoose.Schema.Types.Mixed // Can be number or other type
}, { collection: 'alerts_log' });

// Create model
const Alert = mongoose.model('Alert', alertSchema);

export default Alert;