import mongoose from 'mongoose';

// Define schema with collection name matching exactly what's in MongoDB
const personalitySchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  content: String,
  biasType: String,
  biasValue: mongoose.Schema.Types.Mixed
}, { collection: 'personality_history' });

// Create model
const Personality = mongoose.model('Personality', personalitySchema);

export default Personality;