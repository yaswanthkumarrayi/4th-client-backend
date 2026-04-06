import admin from 'firebase-admin';

let isInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Supports TWO methods:
 * 1. Environment variables (RECOMMENDED for production)
 * 2. Service account JSON file (for local development)
 */
const initializeFirebase = () => {
  if (isInitialized) {
    console.log('✅ Firebase Admin SDK already initialized');
    return true;
  }

  try {
    console.log('🔥 Initializing Firebase Admin SDK...');

    // METHOD 1: Use environment variables (PRODUCTION - Render/Vercel)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('📋 Using Firebase credentials from environment variables');
      
      // Render/Vercel environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      // Replace \\n with actual newlines in private key
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      console.log('   Project ID:', projectId);
      console.log('   Client Email:', clientEmail.substring(0, 30) + '...');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });

      isInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from environment variables!');
      console.log('   Project:', projectId);
      return true;
    }

    // METHOD 2: Use service account file (LOCAL DEVELOPMENT)
    console.log('📋 Environment variables not found, trying service account file...');
    
    const { readFileSync, existsSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                                join(__dirname, 'serviceAccountKey.json');
    
    console.log('   Looking for file at:', serviceAccountPath);

    if (!existsSync(serviceAccountPath)) {
      console.error('❌ Firebase credentials NOT FOUND!');
      console.error('\n📋 To fix this, choose ONE method:\n');
      console.error('METHOD 1 (Recommended for Production/Render):');
      console.error('  Set these environment variables in Render:');
      console.error('    FIREBASE_PROJECT_ID=samskruthi-auth-b8ee6');
      console.error('    FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@samskruthi-auth-b8ee6.iam.gserviceaccount.com');
      console.error('    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
      console.error('\nMETHOD 2 (Local Development):');
      console.error('  1. Go to: https://console.firebase.google.com');
      console.error('  2. Select project: samskruthi-auth-b8ee6');
      console.error('  3. Project Settings > Service Accounts');
      console.error('  4. Generate new private key (JSON)');
      console.error('  5. Save as: backend/src/config/serviceAccountKey.json');
      console.error('\n');
      return false;
    }

    console.log('📄 Loading Firebase service account from file...');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      console.error('❌ Invalid service account file - missing required fields');
      return false;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized from file!');
    console.log('   Project:', serviceAccount.project_id);
    return true;

  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
};

/**
 * Check if Firebase is initialized
 */
const isFirebaseInitialized = () => isInitialized;

/**
 * Get admin instance (with safety check)
 */
const getAdmin = () => {
  if (!isInitialized) {
    throw new Error('Firebase Admin not initialized! Call initializeFirebase() first.');
  }
  return admin;
};

export { admin, initializeFirebase, isFirebaseInitialized, getAdmin };
