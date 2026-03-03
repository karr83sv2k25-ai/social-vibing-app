/**
 * Advertisement Service
 * Fetches active advertisements from Firestore that admins manage via the admin panel.
 * Collection: advertisements
 */

import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

/**
 * Fetch active advertisements
 * @param {Object} options - Filter options
 * @param {string} options.position - Ad position: 'home', 'community', 'marketplace', etc.
 * @param {string} options.communityId - Optional community ID filter
 * @param {number} options.limitCount - Max ads to return (default: 5)
 * @returns {Promise<Array>} Array of ad objects
 */
export const getActiveAdvertisements = async ({
  position = null,
  communityId = null,
  limitCount = 5,
} = {}) => {
  try {
    const constraints = [
      where('active', '==', true),
    ];

    if (position) {
      constraints.push(where('position', '==', position));
    }

    if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }

    constraints.push(limit(limitCount));

    const q = query(collection(db, 'advertisements'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.warn('⚠️ Error fetching advertisements:', error.message);
    return [];
  }
};

/**
 * Subscribe to active advertisements in real-time
 * @param {Object} options - Filter options
 * @param {Function} callback - Called with array of ads on each update
 * @returns {Function} Unsubscribe function
 */
export const subscribeToAdvertisements = (options = {}, callback) => {
  const { position = null, communityId = null, limitCount = 5 } = options;

  try {
    const constraints = [
      where('active', '==', true),
    ];

    if (position) {
      constraints.push(where('position', '==', position));
    }

    if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }

    constraints.push(limit(limitCount));

    const q = query(collection(db, 'advertisements'), ...constraints);

    return onSnapshot(q, (snapshot) => {
      const ads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(ads);
    }, (error) => {
      console.warn('⚠️ Ad subscription error:', error.message);
      callback([]);
    });
  } catch (error) {
    console.warn('⚠️ Error setting up ad subscription:', error.message);
    callback([]);
    return () => {};
  }
};
