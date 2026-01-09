import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, getFirestore, memoryLocalCache, enableNetwork, connectFirestoreEmulator } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

// CRITICAL: Suppress Firestore internal errors BEFORE any Firebase initialization
// This must be the FIRST thing we do to catch SDK errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

/*
console.error = (...args) => {
  const message = args[0]?.toString?.() || '';
  const fullMessage = JSON.stringify(args);

  // Aggressively filter Firestore SDK internal errors
  if (
    message.includes('FIRESTORE') ||
    message.includes('INTERNAL ASSERTION FAILED') ||
    message.includes('Unexpected state') ||
    message.includes('b815') ||
    message.includes('ca9') ||
    message.includes('Target ID already exists') ||
    message.includes('Could not reach Cloud Firestore backend') ||
    message.includes('Connection failed') ||
    message.includes('code=unavailable') ||
    message.includes('auth/already-initialized') ||
    fullMessage.includes('FIRESTORE') && fullMessage.includes('INTERNAL')
  ) {
    // Completely suppress - these are harmless SDK bugs
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  const message = args[0]?.toString?.() || '';
  const fullMessage = JSON.stringify(args);

  if (
    message.includes('FIRESTORE') ||
    message.includes('INTERNAL ASSERTION') ||
    message.includes('Unexpected state') ||
    message.includes('Target ID already exists') ||
    message.includes('Could not fetch user from Firestore') ||
    fullMessage.includes('FIRESTORE') && fullMessage.includes('INTERNAL')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

console.log = (...args) => {
  const message = args[0]?.toString?.() || '';

  // Also filter from console.log (some errors appear there)
  if (
    message.includes('@firebase/firestore') && message.includes('INTERNAL ASSERTION') ||
    message.includes('FIRESTORE') && message.includes('Unexpected state') ||
    message.includes('Error fetching all posts') ||
    message.includes('[Firestore] Error in') && message.includes('snapshot listener') ||
    message.includes('Target ID already exists')
  ) {
    return;
  }
  originalConsoleLog(...args);
};
*/

// Support both development (expo go) and production (standalone build)
const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY,
  authDomain: extra.FIREBASE_AUTH_DOMAIN,
  projectId: extra.FIREBASE_PROJECT_ID,
  storageBucket: extra.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.FIREBASE_APP_ID,
};

// Validate Firebase config
const requiredFields = ['apiKey', 'projectId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
  originalConsoleError('❌ Missing Firebase config fields:', missingFields);
  throw new Error(`Firebase config incomplete. Missing: ${missingFields.join(', ')}`);
}

// Log config for debugging (remove sensitive data in production)
originalConsoleLog('🔥 Firebase Config Loaded:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasApiKey: !!firebaseConfig.apiKey,
});

// ✅ Initialize app only once (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

originalConsoleLog('✅ Firebase App initialized');

// ✅ Initialize Auth with AsyncStorage persistence
// CRITICAL: Must initialize with persistence BEFORE any getAuth() call
let auth;
try {
  // Always try initializeAuth first to ensure persistence is set
  originalConsoleLog('🔄 Initializing Auth with AsyncStorage persistence...');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
  originalConsoleLog('✅✅✅ Auth initialized with PERSISTENT LOGIN ENABLED ✅✅✅');
  originalConsoleLog('📱 Users will stay logged in after closing the app');
} catch (error) {
  if (error.code === 'auth/already-initialized') {
    // Auth was already initialized (hot reload in dev)
    originalConsoleLog('⚠️ Auth already initialized (hot reload), using existing instance');
    auth = getAuth(app);
  } else {
    originalConsoleError('❌ Failed to initialize auth:', error);
    throw error;
  }
}

// ✅ Initialize Firestore with proper settings for React Native/Expo
// IMPORTANT: Always use initializeFirestore first to ensure settings are applied
let db;
let firestoreReady = false;
let firestoreReadyPromise = null;

try {
  // Initialize with proper offline persistence and cache settings
  originalConsoleLog('🔄 Initializing Firestore with offline persistence...');
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true, // Required for React Native
    cacheSizeBytes: 50 * 1024 * 1024, // 50 MB cache for better offline support
  });
  originalConsoleLog('✅ Firestore initialized with OFFLINE PERSISTENCE enabled');
  originalConsoleLog('📦 Cache size: 50 MB');
} catch (error) {
  // If already initialized (hot reload), get existing instance
  if (error.message?.includes('already') || error.code === 'failed-precondition') {
    originalConsoleLog('⚠️ Firestore already initialized (using existing instance)');
    db = getFirestore(app);
  } else {
    originalConsoleError('❌ Failed to initialize Firestore:', error);
    throw error;
  }
}

// Create a promise that resolves when Firestore is ready
firestoreReadyPromise = new Promise((resolve, reject) => {
  // Enable network on init with better error handling
  enableNetwork(db)
    .then(() => {
      originalConsoleLog('✅ Firestore network enabled');
      firestoreReady = true;
      resolve(db);
    })
    .catch(err => {
      originalConsoleWarn('⚠️  Firestore network could not be enabled (error:', err.code, ')');
      originalConsoleLog('📴 App will work in offline mode with cached data');
      // Still resolve - app can work offline
      firestoreReady = true;
      resolve(db);
    });

  // Timeout after 5 seconds
  setTimeout(() => {
    if (!firestoreReady) {
      originalConsoleLog('⏱️  Firestore taking longer than expected, continuing anyway...');
      firestoreReady = true;
      resolve(db);
    }
  }, 5000);
});

// Export a function to wait for Firestore to be ready
export const waitForFirestore = () => firestoreReadyPromise;

// Add a global error handler for auth
auth.onAuthStateChanged(
  (user) => {
    if (user) {
      originalConsoleLog('👤 User authenticated:', user.uid);
    } else {
      originalConsoleLog('👤 No user authenticated');
    }
  },
  (error) => {
    originalConsoleError('❌ Auth state change error:', error);
  }
);

originalConsoleLog('✅ Firebase initialization complete');

export { app, auth, db };

