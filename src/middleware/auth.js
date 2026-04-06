import { admin, isFirebaseInitialized } from '../config/firebase.js';

// Verify Firebase ID Token Middleware
export const verifyToken = async (req, res, next) => {
  console.log('\n🔐 === AUTH MIDDLEWARE ===');
  
  try {
    // STEP 1: Check if Firebase is initialized
    if (!isFirebaseInitialized()) {
      console.error('❌ CRITICAL: Firebase Admin SDK not initialized!');
      console.error('   Server needs to be restarted with valid serviceAccountKey.json');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error - Firebase not initialized' 
      });
    }
    console.log('✅ Firebase Admin is initialized');

    // STEP 2: Get Authorization header
    const authHeader = req.headers.authorization;
    console.log('📨 Authorization header:', authHeader ? `Present (${authHeader.length} chars)` : 'MISSING');
    
    if (!authHeader) {
      console.log('❌ No Authorization header provided');
      return res.status(401).json({ 
        success: false, 
        message: 'No authorization header. Send: Authorization: Bearer <token>' 
      });
    }

    // STEP 3: Validate Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid header format. Expected: Bearer <token>');
      console.log('   Received:', authHeader.substring(0, 20) + '...');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid authorization format. Use: Bearer <token>' 
      });
    }

    // STEP 4: Extract token
    const token = authHeader.split(' ')[1];
    console.log('🔑 Token extracted:', token ? `${token.substring(0, 20)}...` : 'EMPTY');
    
    if (!token || token === 'undefined' || token === 'null' || token.length < 100) {
      console.log('❌ Token is empty, undefined, or too short');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token provided' 
      });
    }

    // STEP 5: Verify token with Firebase
    console.log('🔍 Verifying token with Firebase Admin...');
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      console.log('✅ TOKEN VERIFIED SUCCESSFULLY!');
      console.log('   UID:', decodedToken.uid);
      console.log('   Email:', decodedToken.email);
      console.log('   Name:', decodedToken.name || '(not set)');
      
      // Attach user info to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
      };
      
      console.log('✅ req.user set, proceeding to route handler\n');
      next();
      
    } catch (firebaseError) {
      console.error('❌ Firebase token verification FAILED!');
      console.error('   Error code:', firebaseError.code);
      console.error('   Error message:', firebaseError.message);
      
      // Provide specific error messages
      let message = 'Invalid or expired token';
      let statusCode = 401;
      
      if (firebaseError.code === 'auth/id-token-expired') {
        message = 'Token has expired. Please sign in again.';
      } else if (firebaseError.code === 'auth/argument-error') {
        message = 'Invalid token format. The token may be corrupted.';
      } else if (firebaseError.code === 'auth/id-token-revoked') {
        message = 'Token has been revoked. Please sign in again.';
      } else if (firebaseError.message.includes('Firebase ID token has incorrect')) {
        message = 'Token is for a different Firebase project. Check your configuration.';
      }
      
      return res.status(statusCode).json({ 
        success: false, 
        message,
        code: firebaseError.code
      });
    }
    
  } catch (error) {
    console.error('❌ Auth middleware unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed due to server error' 
    });
  }
};

// Optional auth - continues even without token
export const optionalAuth = async (req, res, next) => {
  try {
    if (!isFirebaseInitialized()) {
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token || token === 'undefined' || token === 'null') {
      return next();
    }
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0]
      };
    } catch (firebaseError) {
      // Token invalid but continue anyway for optional auth
      console.log('Optional auth: Token invalid -', firebaseError.code);
    }
    
    next();
  } catch (error) {
    next();
  }
};
