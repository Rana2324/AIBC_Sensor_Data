import express from 'express';
import * as sensorController from '../controllers/sensorController.js';

const router = express.Router();

// Main route redirects to sensor data page
router.get('/', (req, res) => {
  res.redirect('/sensor-data');
});

// Route to render the sensor data page
router.get('/sensor-data', sensorController.renderSensorData);

export default router;