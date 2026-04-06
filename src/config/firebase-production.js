import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let isInitialized = false;

export const initializeFirebase = () => {
if (isInitialized) {
console.log('✅ Firebase already initialized');
return true;
}

try {
console.log('🔥 Initializing Firebase Admin SDK...');

```
// ===============================
// ✅ METHOD 1: ENV VARIABLES (PRODUCTION)
// ===============================
if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  console.log('📋 Using ENV variables for Firebase');

  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Fix newline issue
  privateKey = privateKey.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    })
  });

  isInitialized = true;
  console.log('✅ Firebase initialized (ENV)');
  return true;
}

// ===============================
// ✅ METHOD 2: LOCAL FILE (DEV ONLY)
// ===============================
console.log('📋 ENV not found, trying serviceAccountKey.json...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase credentials not found');
  return false;
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

isInitialized = true;
console.log('✅ Firebase initialized (FILE)');
return true;
```

} catch (error) {
console.error('❌ Firebase init error:', error.message);
return false;
}
};

// ===============================
// STATUS CHECK
// ===============================
export const isFirebaseInitialized = () => isInitialized;

// ===============================
// SAFE ADMIN ACCESS
// ===============================
export const getAdmin = () => {
if (!isInitialized) {
throw new Error('Firebase not initialized');
}
return admin;
};

// ===============================
// VERIFY TOKEN
// ===============================
export const verifyIdToken = async (token) => {
if (!isInitialized) {
throw new Error('Firebase not initialized');
}

try {
return await admin.auth().verifyIdToken(token);
} catch (error) {
console.error('❌ Token verification failed:', error.message);
throw error;
}
};

export { admin };
