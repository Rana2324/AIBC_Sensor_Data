import mongoose from 'mongoose';

// Define schema with collection name matching exactly what's in MongoDB
const temperatureReadingSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  temperatures: [mongoose.Schema.Types.Mixed], // Allow either string or number values
  isAbnormal: Boolean,
  temperature_ave: mongoose.Schema.Types.Mixed, // Allow either string or number
  acquisitionDate: String, // Date in YYYY/MM/DD format
  acquisitionTime: String, // Time in HH:MM:SS.xxx format
  status: String, // 'normal' or 'anomaly'
  sensor_id: String // Add this for compatibility with incoming data
}, { collection: 'temperature_readings' });

// Add index on sensorId field for better query performance
temperatureReadingSchema.index({ sensorId: 1 });
temperatureReadingSchema.index({ timestamp: -1 }); // For sorting by timestamp

// Create model
const TemperatureReading = mongoose.model('TemperatureReading', temperatureReadingSchema);

export default TemperatureReading;