# AIBC Sensor Data System

A complete system that fetches data from a C API, stores it in MongoDB, and displays it in real-time using Node.js, Express, EJS, and Socket.IO.

## System Architecture

This system consists of several components:

1. **C API** (Simulated): A REST API that mimics a C program transformed to provide sensor data through HTTP endpoints.
2. **Node.js API**: Express.js server that connects to the C API, processes data, and stores it in MongoDB.
3. **MongoDB**: Database for storing sensor readings, alerts, settings, and personality data.
4. **EJS Templates**: Frontend views that display the data to users in real-time.
5. **Socket.IO**: Enables real-time data updates in the UI without page refreshes.

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- MongoDB (local installation or MongoDB Atlas)

### Environment Setup

Create a `.env` file in the root directory with the following configuration:

```env
# Server configuration
PORT=3000
NODE_ENV=development

# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/aibc_sensor_data

# C API configuration
C_API_URL=http://localhost:8080
C_API_PORT=8080
API_POLLING_INTERVAL=5000

# Logging 
LOG_LEVEL=info
```

### Installation

```bash
# Install dependencies for main application
npm install

# Install dependencies for C API simulator
cd c-api-simulator
npm install
cd ..
```

### Running the System

There are multiple ways to run the system:

#### Option 1: Run Everything Together

```bash
npm run start-all
```

This command starts both the C API simulator and the Node.js application together.

#### Option 2: Run Components Separately

In one terminal, start the C API simulator:

```bash
cd c-api-simulator
npm start
```

In another terminal, start the Node.js application:

```bash
npm start
```

### Access the UI

Open your browser and navigate to:

```
http://localhost:3000
```

## API Endpoints

### C API Endpoints (Port 8080)

- `GET /api/sensors`: List all available sensors
- `GET /api/sensors/readings`: Get the latest temperature readings from all sensors
- `GET /api/sensors/alerts`: Get recent alerts
- `GET /api/sensors/settings`: Get sensor settings

### Node.js API Endpoints (Port 3000)

- `GET /api/sensor-data/latest`: Get latest sensor data from MongoDB
- `GET /api/sensor-data/:sensorId/latest`: Get latest data for a specific sensor
- `GET /api/alerts`: Get alerts from MongoDB
- `GET /api/settings`: Get settings from MongoDB
- `GET /api/personality`: Get personality data from MongoDB

## Data Flow

1. The C API simulator generates random sensor data, alerts, and settings.
2. The Node.js application polls the C API at regular intervals (default: every 5 seconds).
3. The data retrieved from the C API is processed and stored in MongoDB.
4. The data in MongoDB is served to the UI through API endpoints and Socket.IO.
5. The EJS templates render the data in the browser, with real-time updates via Socket.IO.

## Real-time Updates with Socket.IO

Socket.IO events:

- `newSensorData`: Emitted when new sensor data is received
- `alert`: Emitted when a new alert is received
- `settingChange`: Emitted when sensor settings change
- `personalityUpdate`: Emitted when personality data changes
- `serverStats`: Emitted with server statistics updates

## Project Structure

```
├── c-api-simulator/       # C API simulator
│   ├── api.js            # REST API implementation
│   └── package.json      # C API dependencies
├── config/                # Configuration files
│   ├── db.js             # MongoDB connection 
│   └── logger.js         # Logging configuration
├── controllers/           # Route controllers
│   └── sensorController.js # Handles API requests
├── models/                # Database models
│   └── SensorData.js     # MongoDB schema definitions
├── public/               # Static assets
│   ├── css/             # Stylesheets
│   └── js/              # Client-side scripts
├── routes/               # API routes
│   ├── apiRoutes.js     # API endpoints
│   └── viewRoutes.js    # Page rendering routes
├── services/             # Business logic 
│   ├── apiService.js    # C API communication
│   └── socketService.js # Socket.IO management
├── views/                # EJS templates
│   ├── layout.ejs       # Main layout template
│   └── sensorData.ejs   # Sensor data display
├── .env                  # Environment variables
├── package.json          # Dependencies
├── server.js             # Main application entry
└── start-all.js          # Script to start all services
```

## Error Handling

The system includes robust error handling for:

- C API communication failures
- MongoDB connection issues
- Data processing errors

Errors are logged using Winston and displayed appropriately in the UI.

## Performance Optimization

- Socket.IO is used for real-time updates instead of HTTP polling
- MongoDB queries are optimized with proper indexing
- Data is processed in batches to reduce database load
- Only modified data is sent to clients to minimize bandwidth usage

## Security Considerations

- Input data is validated before being stored in MongoDB
- API endpoints use proper error handling to avoid exposing system details
- Socket.IO connections use secure practices

## Future Improvements

1. Add authentication system for API access
2. Implement data compression for large datasets
3. Add visualization tools (charts, graphs) for sensor data
4. Develop a mobile application for monitoring on the go

## Troubleshooting

### C API Connection Issues

If the Node.js application cannot connect to the C API:

1. Check that the C API simulator is running on port 8080
2. Verify C_API_URL in the .env file
3. Check the logs for connection errors

### MongoDB Connection Issues

If you're having trouble connecting to MongoDB:

1. Verify MongoDB is running
2. Check MONGODB_URI in the .env file
3. Look for connection errors in the logs

### No Data Displaying in UI

If no data is showing in the UI:

1. Check the browser console for errors
2. Verify that Socket.IO connections are established
3. Check that data is being stored in MongoDB

## License

ISC
