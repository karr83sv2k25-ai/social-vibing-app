/**
 * Firestore Helper Utilities
 * Provides robust error handling, retry logic, and offline support for Firestore operations
 */

import { getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

/**
 * Check if device has internet connection
 */
export const checkConnection = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable !== false;
  } catch (error) {
    console.warn('⚠️ Could not check connection status:', error);
    return true; // Assume connected if check fails
  }
};

/**
 * Execute Firestore operation with timeout and retry logic
 * @param {Function} operation - The Firestore operation to execute
 * @param {Object} options - Configuration options
 * @returns {Promise} - Resolves with operation result or rejects with error
 */
export const executeWithTimeout = async (operation, options = {}) => {
  const {
    timeout = 8000, // 8 seconds default timeout
    retries = 2, // Number of retry attempts
    retryDelay = 1000, // Delay between retries in ms
    fallbackValue = null, // Value to return if all attempts fail
    operationName = 'Firestore operation',
    silentFail = false, // If true, return fallback without logging error
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Check connection before attempting (skip on retries)
      if (attempt === 0) {
        const isConnected = await checkConnection();
        if (!isConnected) {
          if (!silentFail) {
            console.log(`📴 ${operationName}: Device offline, using fallback`);
          }
          return fallbackValue;
        }
      }

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timeout after ${timeout}ms`)), timeout)
      );

      // Race between operation and timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      
      // Success - log only on retry success
      if (attempt > 0) {
        console.log(`✅ ${operationName}: Succeeded on attempt ${attempt + 1}`);
      }
      
      return result;

    } catch (error) {
      lastError = error;
      const isOfflineError = 
        error.code === 'unavailable' ||
        error.message?.includes('offline') ||
        error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('UNAVAILABLE');

      // On last attempt or non-retryable error
      if (attempt === retries || !isOfflineError) {
        if (!silentFail) {
          console.warn(`⚠️ ${operationName} failed:`, error.message || error.code);
          console.log(`📦 Using fallback value for ${operationName}`);
        }
        return fallbackValue;
      }

      // Wait before retry
      if (attempt < retries) {
        const delay = retryDelay * (attempt + 1); // Exponential backoff
        if (!silentFail) {
          console.log(`🔄 ${operationName}: Retrying in ${delay}ms (attempt ${attempt + 2}/${retries + 1})`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return fallbackValue;
};

/**
 * Get document with retry and timeout
 */
export const getDocWithRetry = async (docRef, options = {}) => {
  return executeWithTimeout(
    () => getDoc(docRef),
    {
      operationName: `Get document ${docRef.path}`,
      ...options,
    }
  );
};

/**
 * Get collection with retry and timeout
 */
export const getDocsWithRetry = async (queryRef, options = {}) => {
  return executeWithTimeout(
    () => getDocs(queryRef),
    {
      operationName: 'Get documents',
      ...options,
    }
  );
};

/**
 * Set document with retry and timeout
 */
export const setDocWithRetry = async (docRef, data, options = {}) => {
  return executeWithTimeout(
    () => setDoc(docRef, data),
    {
      operationName: `Set document ${docRef.path}`,
      ...options,
    }
  );
};

/**
 * Update document with retry and timeout
 */
export const updateDocWithRetry = async (docRef, data, options = {}) => {
  return executeWithTimeout(
    () => updateDoc(docRef, data),
    {
      operationName: `Update document ${docRef.path}`,
      ...options,
    }
  );
};

/**
 * Delete document with retry and timeout
 */
export const deleteDocWithRetry = async (docRef, options = {}) => {
  return executeWithTimeout(
    () => deleteDoc(docRef),
    {
      operationName: `Delete document ${docRef.path}`,
      ...options,
    }
  );
};

/**
 * Fetch user data with cache fallback
 */
export const fetchUserWithCache = async (userId, db, CacheManager) => {
  const { doc } = await import('firebase/firestore');
  
  try {
    // Try cache first for instant UI
    const cached = await CacheManager.getUserProfile(userId);
    if (cached) {
      console.log('📦 Using cached user data for:', userId);
      
      // Fetch fresh data in background (silent)
      getDocWithRetry(doc(db, 'users', userId), {
        timeout: 5000,
        retries: 1,
        silentFail: true,
      }).then(async (snapshot) => {
        if (snapshot?.exists()) {
          const freshData = { id: userId, ...snapshot.data() };
          await CacheManager.saveUserProfile(userId, freshData);
          console.log('✅ Background refresh: User data updated');
        }
      }).catch(() => {
        // Silent fail for background refresh
      });
      
      return cached;
    }

    // No cache - fetch from Firestore
    const snapshot = await getDocWithRetry(doc(db, 'users', userId), {
      timeout: 8000,
      retries: 2,
    });

    if (snapshot?.exists()) {
      const userData = { id: userId, ...snapshot.data() };
      await CacheManager.saveUserProfile(userId, userData);
      return userData;
    }

    return null;
  } catch (error) {
    console.warn('⚠️ fetchUserWithCache failed:', error.message);
    return null;
  }
};

export default {
  executeWithTimeout,
  getDocWithRetry,
  getDocsWithRetry,
  setDocWithRetry,
  updateDocWithRetry,
  deleteDocWithRetry,
  fetchUserWithCache,
  checkConnection,
};
