import User from '../models/User.js';
import { admin, isFirebaseInitialized } from '../config/firebase.js';

// Google Authentication - Create or get user
export const googleAuth = async (req, res) => {
  console.log('\n🔐 === GOOGLE AUTH ENDPOINT ===');
  
  try {
    const { token } = req.body;
    
    console.log('📨 Token in request body:', token ? `Present (${token.length} chars)` : 'MISSING');
    
    if (!token) {
      console.log('❌ No token provided in request body');
      return res.status(400).json({
        success: false,
        message: 'Token is required. Send: { "token": "<firebase-id-token>" }'
      });
    }

    // Check Firebase initialization
    if (!isFirebaseInitialized()) {
      console.error('❌ Firebase Admin SDK not initialized!');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error - Firebase not initialized'
      });
    }

    // Verify the Firebase token
    console.log('🔍 Verifying token with Firebase Admin...');
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('✅ Token verified!');
      console.log('   UID:', decodedToken.uid);
      console.log('   Email:', decodedToken.email);
      console.log('   Name:', decodedToken.name || '(not set)');
    } catch (verifyError) {
      console.error('❌ Token verification failed!');
      console.error('   Code:', verifyError.code);
      console.error('   Message:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: verifyError.code
      });
    }

    const { uid, email, name } = decodedToken;

    // Check if user exists in MongoDB
    console.log('🔍 Looking for user in MongoDB...');
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      console.log('   Not found by firebaseUid, checking email...');
      user = await User.findOne({ email });
      
      if (user) {
        console.log('✅ Found user by email, linking firebaseUid');
        user.firebaseUid = uid;
        user.authProvider = 'google';
        await user.save();
      } else {
        console.log('📝 Creating new user...');
        user = await User.create({
          firebaseUid: uid,
          email,
          name: name || email.split('@')[0],
          authProvider: 'google'
        });
        console.log('✅ User created with ID:', user._id);
      }
    } else {
      console.log('✅ User found:', user.email);
    }

    console.log('✅ Google Auth successful!\n');

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Email Registration
export const register = async (req, res) => {
  console.log('\n📝 === REGISTER ENDPOINT ===');
  
  try {
    const { name, email, password } = req.body;
    
    console.log('📨 Registration request for:', email);

    if (!name || !email || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Email already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      authProvider: 'email'
    });

    console.log('✅ User registered:', user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

// Email Login
export const login = async (req, res) => {
  console.log('\n🔐 === LOGIN ENDPOINT ===');
  
  try {
    const { email, password } = req.body;
    
    console.log('📨 Login request for:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    if (user.authProvider === 'google' && !user.password) {
      console.log('❌ Google user trying email login:', email);
      return res.status(401).json({
        success: false,
        message: 'This account uses Google Sign-In. Please use Google to login.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    console.log('✅ Login successful:', email);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Sync user from Firebase (uses auth middleware - token in header)
export const syncUser = async (req, res) => {
  console.log('\n🔄 === SYNC USER ENDPOINT ===');
  
  try {
    // req.user is set by verifyToken middleware
    const { uid, email, name } = req.user;
    
    console.log('📨 Sync request from middleware:');
    console.log('   UID:', uid);
    console.log('   Email:', email);
    console.log('   Name:', name);

    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      console.log('🔍 User not found by UID, checking email...');
      user = await User.findOne({ email });
      
      if (user) {
        console.log('✅ Found user by email, updating firebaseUid');
        user.firebaseUid = uid;
        await user.save();
      } else {
        console.log('📝 Creating new user from sync');
        user = await User.create({
          firebaseUid: uid,
          email,
          name: name || email.split('@')[0],
          authProvider: 'google'
        });
        console.log('✅ User created:', user._id);
      }
    } else {
      console.log('✅ User found:', user.email);
    }

    console.log('✅ Sync complete!\n');

    res.status(200).json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Sync user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync user'
    });
  }
};
