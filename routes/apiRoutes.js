import express from 'express';
import * as sensorController from '../controllers/sensorController.js';

const router = express.Router();

// Sensor data endpoints
router.get('/sensor-data/latest', sensorController.getLatestData);
router.get('/sensor-data/:sensorId/latest', sensorController.getLatestDataBySensorId);

// History endpoints
router.get('/alerts', sensorController.getAlerts);
// router.get('/settings', sensorController.getSettings);
// router.get('/personality', sensorController.getPersonalityData);

export default router;