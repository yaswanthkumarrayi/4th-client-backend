import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { initializeFirebase, isFirebaseInitialized } from './config/firebase.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import orderRoutes from './routes/orders.js';

// Load environment variables FIRST
dotenv.config();

console.log('\n');
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║       🚀 SAMSKRUTHI FOODS API SERVER                   ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('\n');

// STEP 1: Initialize Firebase Admin FIRST (before anything else)
console.log('📌 STEP 1: Initializing Firebase Admin SDK...');
const firebaseReady = initializeFirebase();

if (!firebaseReady) {
  console.log('\n');
  console.log('⚠️  ════════════════════════════════════════════════════════');
  console.log('⚠️  WARNING: Firebase Admin SDK FAILED to initialize!');
  console.log('⚠️  Authentication will NOT work.');
  console.log('⚠️  ════════════════════════════════════════════════════════');
  console.log('\n');
  console.log('📋 REQUIRED: Place serviceAccountKey.json at:');
  console.log('   backend/src/config/serviceAccountKey.json');
  console.log('\n');
} else {
  console.log('');
}

// STEP 2: Connect to MongoDB
console.log('📌 STEP 2: Connecting to MongoDB...');
connectDB();

// STEP 3: Initialize Express
console.log('📌 STEP 3: Setting up Express server...');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS configuration
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`⚠️  CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] 📨 ${req.method} ${req.path}`);
  next();
});

// STEP 4: Mount Routes
console.log('📌 STEP 4: Mounting API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    firebase: isFirebaseInitialized() ? '✅ initialized' : '❌ not initialized',
    message: isFirebaseInitialized() 
      ? 'Server is ready' 
      : 'WARNING: Firebase not initialized - auth will fail'
  });
});

// Debug endpoint - check Firebase status
app.get('/api/debug/firebase', (req, res) => {
  res.json({
    initialized: isFirebaseInitialized(),
    message: isFirebaseInitialized() 
      ? 'Firebase Admin SDK is ready' 
      : 'Firebase Admin SDK NOT initialized - check serviceAccountKey.json'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// STEP 5: Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log(`║  ✅ Server running on port ${PORT}                         ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  📡 API Base:    http://localhost:${PORT}/api              ║`);
  console.log(`║  ❤️  Health:      http://localhost:${PORT}/api/health       ║`);
  console.log(`║  🔥 Firebase:    ${isFirebaseInitialized() ? '✅ Ready' : '❌ NOT Ready'}                        ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
});
