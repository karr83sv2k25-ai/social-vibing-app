// Firebase configuration for WEB
// This file uses Firebase JS SDK (v9+) for web platforms
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence,
  connectAuthEmulator 
} from "firebase/auth";
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  connectFirestoreEmulator 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your Firebase configuration
// Replace these values with your actual Firebase config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID // Optional for analytics
};

// Validate Firebase config
const requiredFields = ['apiKey', 'projectId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field] || firebaseConfig[field].startsWith('YOUR_'));

if (missingFields.length > 0) {
  console.error('❌ Missing or invalid Firebase config fields:', missingFields);
  console.error('Please update firebaseConfig.web.js with your actual Firebase credentials');
}

// Initialize Firebase App (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

console.log('✅ Firebase App initialized for WEB');
console.log('🔥 Project ID:', firebaseConfig.projectId);

// Initialize Auth with browser persistence
const auth = getAuth(app);

// Set persistence to LOCAL (survives browser close/reload)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Auth persistence enabled (browser local storage)');
  })
  .catch((error) => {
    console.error('❌ Failed to set auth persistence:', error);
  });

// Initialize Firestore
const db = getFirestore(app);

// Enable offline persistence for web
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('✅ Firestore offline persistence enabled');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser doesn\'t support offline persistence');
      } else {
        console.error('❌ Error enabling persistence:', err);
      }
    });
}

// Initialize Storage
const storage = getStorage(app);

// Initialize Analytics (optional, only for web production)
let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
    console.log('✅ Firebase Analytics enabled');
  } catch (error) {
    console.warn('⚠️ Analytics not available:', error.message);
  }
}

// Development mode emulator support (optional)
const USE_EMULATOR = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';

if (USE_EMULATOR && typeof window !== 'undefined') {
  console.log('🔧 Using Firebase Emulator');
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}

// Export Firebase services
export { app, auth, db, storage, analytics };

// Helper function to check if Firebase is ready
export const isFirebaseReady = () => {
  return !!app && !!auth && !!db;
};
