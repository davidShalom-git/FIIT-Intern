const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const auth = require('./routes/auth')
const chat = require('./routes/chat');

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || true 
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    nodeVersion: process.version,
    mongooseVersion: mongoose.version
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

// MongoDB connection for Vercel (optimized for serverless)
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
      bufferMaxEntries: 0,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    });
    
    isConnected = true;
    console.log('MongoDB connected successfully');
    return connection;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    isConnected = false;
    throw err;
  }
};

// Database status route
app.get('/api/db-status', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ 
      connected: isConnected,
      readyState: mongoose.connection.readyState,
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
      host: mongoose.connection.host,
      name: mongoose.connection.name
    });
  } catch (err) {
    res.status(500).json({ 
      connected: false, 
      error: err.message,
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET'
    });
  }
});

// Load routes after ensuring database connection
let routesLoaded = false;

const loadRoutes = async () => {
  if (routesLoaded) return;

  try {
    await connectToDatabase();
    
    // Import and use routes
    const authRoutes = require('./routes/auth');
    const chatRoutes = require('./routes/chat');
    
    app.use('/api/auth', authRoutes);
    app.use('/api/chat', chatRoutes);
    
    routesLoaded = true;
    console.log('Routes loaded successfully');
  } catch (err) {
    console.error('Error loading routes:', err);
    // Create fallback routes
    app.get('/api/auth/status', (req, res) => {
      res.status(500).json({ error: 'Auth routes not loaded', details: err.message });
    });
    app.get('/api/chat/status', (req, res) => {
      res.status(500).json({ error: 'Chat routes not loaded', details: err.message });
    });
  }
};

// Load routes on startup
loadRoutes();

// Manual route loading endpoint for debugging
app.get('/api/load-routes', async (req, res) => {
  try {
    await loadRoutes();
    res.json({ message: 'Routes loaded successfully', routesLoaded });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load routes', details: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: ['/api', '/api/test', '/api/db-status', '/api/load-routes']
  });
});

app.use('/api/auth', auth);
app.use('/api/chat', chat);

// Export the app for Vercel
module.exports = app;

// Only listen on port if not in production (for local development)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}