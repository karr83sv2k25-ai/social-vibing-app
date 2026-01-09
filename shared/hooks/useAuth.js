// Custom Hook for Authentication
// Works on both React Native and React Web
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

/**
 * useAuth Hook
 * Manages authentication state
 * 
 * Usage:
 * import { auth, db } from '../firebaseConfig'; // Mobile
 * import { auth, db } from '../shared/firebaseConfig.web'; // Web
 * import { useAuth } from '../shared/hooks/useAuth';
 * 
 * const { user, userData, loading, authenticated } = useAuth(auth, db);
 */
export const useAuth = (auth, db) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setLoading(true);
      
      if (authUser) {
        setUser(authUser);
        setAuthenticated(true);
        
        // Fetch user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
        setUserData(null);
        setAuthenticated(false);
      }
      
      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [auth, db]);

  return { user, userData, loading, authenticated };
};
