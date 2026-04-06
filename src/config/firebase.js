import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let isInitialized = false;

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (isInitialized) {
    console.log('✅ Firebase Admin SDK already initialized');
    return true;
  }

  try {
    // CORRECT PATH: backend/src/config/serviceAccountKey.json
    // Since this file is in backend/src/config/, the key is in the SAME directory
    const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
    
    console.log('🔍 Looking for service account at:', serviceAccountPath);

    if (!existsSync(serviceAccountPath)) {
      console.error('❌ Firebase service account file NOT FOUND at:', serviceAccountPath);
      console.log('\n📋 To fix this:');
      console.log('1. Go to Firebase Console: https://console.firebase.google.com');
      console.log('2. Select your project');
      console.log('3. Go to Project Settings > Service Accounts');
      console.log('4. Click "Generate new private key"');
      console.log('5. Save the file as: backend/src/config/serviceAccountKey.json\n');
      return false;
    }

    console.log('📄 Loading Firebase service account...');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    // Validate service account has required fields
    if (!serviceAccount.project_id) {
      console.error('❌ Invalid service account - missing project_id');
      return false;
    }
    if (!serviceAccount.private_key) {
      console.error('❌ Invalid service account - missing private_key');
      return false;
    }
    if (!serviceAccount.client_email) {
      console.error('❌ Invalid service account - missing client_email');
      return false;
    }

    console.log('🔧 Initializing Firebase Admin for project:', serviceAccount.project_id);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully!');
    console.log('   Project:', serviceAccount.project_id);
    console.log('   Client:', serviceAccount.client_email);
    return true;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    if (error.message.includes('JSON')) {
      console.error('   The service account file may be corrupted or not valid JSON');
    }
    return false;
  }
};

// Check if Firebase is initialized
const isFirebaseInitialized = () => isInitialized;

// Get admin instance (with check)
const getAdmin = () => {
  if (!isInitialized) {
    console.error('❌ Firebase Admin not initialized! Call initializeFirebase() first.');
    return null;
  }
  return admin;
};

export { admin, initializeFirebase, isFirebaseInitialized, getAdmin };
