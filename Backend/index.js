const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Basic middleware first
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins for now
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

// Health check route - this should work first
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET'
  });
});

// Test route without database
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

// Import routes only if they exist
let authRoutes, chatRoutes;
try {
  authRoutes = require('./routes/auth');
  chatRoutes = require('./routes/chat');
  
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
} catch (err) {
  console.error('Error loading routes:', err);
  app.get('/api/routes-error', (req, res) => {
    res.status(500).json({ error: 'Routes loading failed', details: err.message });
  });
}

// MongoDB connection with better error handling
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
      bufferMaxEntries: 0,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    isConnected = false;
    // Don't throw error, let the app start without DB for debugging
  }
};

// Database status route
app.get('/api/db-status', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ 
      connected: isConnected,
      readyState: mongoose.connection.readyState,
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET'
    });
  } catch (err) {
    res.status(500).json({ 
      connected: false, 
      error: err.message,
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET'
    });
  }
});

// Connect to database on startup (non-blocking)
connectToDatabase().catch(console.error);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
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
    method: req.method
  });
});

// Export the app for Vercel
module.exports = app;

// Only listen on port if not in production (for local development)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}