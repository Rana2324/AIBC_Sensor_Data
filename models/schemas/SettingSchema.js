import mongoose from 'mongoose';

// Define schema with collection name matching exactly what's in MongoDB
const settingSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  content: String,
  changeType: String,
  value: mongoose.Schema.Types.Mixed
}, { collection: 'settings_history' });

// Create model
const Setting = mongoose.model('Setting', settingSchema);

export default Setting;