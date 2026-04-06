import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let isInitialized = false;

/**

* Initialize Firebase Admin SDK
  */
  const initializeFirebase = () => {
  if (isInitialized) {
  console.log('✅ Firebase already initialized');
  return true;
  }

try {
console.log('🔥 Initializing Firebase Admin SDK...');

```
// ===============================
// ✅ METHOD 1: ENV VARIABLES (BEST FOR RENDER)
// ===============================
if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_CLIENT_EMAIL
) {
  console.log('📋 Using ENV variables for Firebase');

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });

  isInitialized = true;
  console.log('✅ Firebase initialized (ENV)');
  return true;
}

// ===============================
// ✅ METHOD 2: LOCAL JSON FILE
// ===============================
console.log('📋 Trying serviceAccountKey.json...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, 'serviceAccountKey.json');

console.log('📂 Looking at:', serviceAccountPath);

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

/**

* Check Firebase status
  */
  const isFirebaseInitialized = () => isInitialized;

/**

* Safe admin getter
  */
  const getAdmin = () => {
  if (!isInitialized) {
  throw new Error('Firebase not initialized');
  }
  return admin;
  };

export { admin, initializeFirebase, isFirebaseInitialized, getAdmin };
