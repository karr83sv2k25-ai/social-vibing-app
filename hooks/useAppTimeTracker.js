// hooks/useAppTimeTracker.js
// Global hook to track time spent in the app for daily rewards
// This should be used in the App.js or main navigation component

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { updateTimeSpent } from '../shared/services/dailyRewardsService';

/**
 * Custom hook to track time spent in the app
 * Tracks active time and updates Firebase every minute
 * Handles app state changes (background/foreground)
 */
export const useAppTimeTracker = () => {
  const appState = useRef(AppState.currentState);
  const startTimeRef = useRef(Date.now());
  const totalActiveTimeRef = useRef(0);
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);

  // Listen for auth state changes to ensure token is ready
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setAuthReady(true);
      } else {
        setUserId(null);
        setAuthReady(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Get current user ID (kept for compatibility)
  const getUserId = useCallback(() => {
    return userId;
  }, [userId]);

  // Update time spent in Firebase
  const syncTimeToFirebase = useCallback(async () => {
    // Only sync if auth is ready and we have a user ID
    if (!authReady || !userId) return;

    const now = Date.now();
    const minutesSinceLastUpdate = Math.floor((now - lastUpdateRef.current) / 60000);

    if (minutesSinceLastUpdate >= 1) {
      try {
        await updateTimeSpent(db, userId, minutesSinceLastUpdate);
        lastUpdateRef.current = now;
        console.log(`⏱️ Updated time spent: +${minutesSinceLastUpdate} minutes`);
      } catch (error) {
        console.error('Error syncing time to Firebase:', error);
      }
    }
  }, [authReady, userId]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        console.log('📱 App became active');
        startTimeRef.current = Date.now();
        lastUpdateRef.current = Date.now();
        
        // Start tracking interval
        if (authReady && userId && !intervalRef.current) {
          intervalRef.current = setInterval(syncTimeToFirebase, 60000);
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App went to background - save any remaining time
        console.log('📱 App went to background');
        
        if (authReady && userId) {
          syncTimeToFirebase();
        }
        
        // Stop tracking interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Start tracking when hook mounts and auth is ready
    if (authReady && userId && !intervalRef.current) {
      intervalRef.current = setInterval(syncTimeToFirebase, 60000);
    }

    return () => {
      subscription?.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Final sync before unmount (only if auth is ready)
      if (authReady && userId) {
        syncTimeToFirebase();
      }
    };
  }, [authReady, userId, syncTimeToFirebase]);

  // Return methods for manual control
  return {
    forceSync: syncTimeToFirebase,
    getActiveMinutes: () => Math.floor((Date.now() - startTimeRef.current) / 60000),
    isReady: authReady && !!userId,
  };
};

export default useAppTimeTracker;
