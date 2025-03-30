const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// Sensor data endpoints
router.get('/sensor-data/latest', sensorController.getLatestData);
router.get('/sensor-data/:sensorId/latest', sensorController.getLatestDataBySensorId);

// History endpoints
router.get('/alerts', sensorController.getAlerts);
router.get('/settings', sensorController.getSettings);
router.get('/personality', sensorController.getPersonalityData);

module.exports = router;