const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// Main route redirects to sensor data page
router.get('/', (req, res) => {
  res.redirect('/sensor-data');
});

// Route to render the sensor data page
router.get('/sensor-data', sensorController.renderSensorData);

module.exports = router;