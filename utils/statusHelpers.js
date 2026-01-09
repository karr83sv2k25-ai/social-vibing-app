/**
 * statusHelpers.js
 * Firebase helper functions for user status management
 */

import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Safely import AsyncStorage with fallback
let AsyncStorage;
try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
    console.warn('AsyncStorage not available in statusHelpers, caching disabled');
    AsyncStorage = {
        getItem: async () => null,
        setItem: async () => { },
        removeItem: async () => { },
        getAllKeys: async () => [],
        multiRemove: async () => { }
    };
}

const CACHE_PREFIX = 'user_status_';

/**
 * Initialize status fields for a new user
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>}
 */
export async function initializeUserStatus(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const data = userDoc.data();

            // Only initialize if fields don't exist
            if (data.currentStatus === undefined || data.customStatuses === undefined) {
                await updateDoc(userRef, {
                    currentStatus: null,
                    customStatuses: [],
                    statusUpdatedAt: serverTimestamp(),
                });
            }
        } else {
            // Create new user document with status fields
            await setDoc(userRef, {
                currentStatus: null,
                customStatuses: [],
                statusUpdatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
            });
        }

        return true;
    } catch (error) {
        console.error('Error initializing user status:', error);
        throw error;
    }
}

/**
 * Get user's current status
 * @param {string} userId - The user ID
 * @param {boolean} useCache - Whether to check cache first
 * @returns {Promise<string|null>}
 */
export async function getUserStatus(userId, useCache = true) {
    if (!userId) {
        return null;
    }

    try {
        // Check cache first if enabled
        if (useCache) {
            const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${userId}`);
            if (cached) {
                const data = JSON.parse(cached);
                // Return cached if it's less than 5 minutes old
                if (Date.now() - data.timestamp < 5 * 60 * 1000) {
                    return data.status;
                }
            }
        }

        // Fetch from Firestore
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const status = userDoc.data().currentStatus || null;

            // Cache the result
            await AsyncStorage.setItem(
                `${CACHE_PREFIX}${userId}`,
                JSON.stringify({
                    status,
                    timestamp: Date.now(),
                })
            );

            return status;
        }

        return null;
    } catch (error) {
        console.error('Error fetching user status:', error);
        return null;
    }
}

/**
 * Update user's current status
 * @param {string} userId - The user ID
 * @param {string} newStatus - The new status text
 * @returns {Promise<boolean>}
 */
export async function updateUserStatus(userId, newStatus) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const userRef = doc(db, 'users', userId);

        await updateDoc(userRef, {
            currentStatus: newStatus,
            statusUpdatedAt: serverTimestamp(),
        });

        // Update cache
        await AsyncStorage.setItem(
            `${CACHE_PREFIX}${userId}`,
            JSON.stringify({
                status: newStatus,
                timestamp: Date.now(),
            })
        );

        return true;
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
}

/**
 * Add a custom status to user's list
 * @param {string} userId - The user ID
 * @param {string} customStatus - The custom status text
 * @returns {Promise<boolean>}
 */
export async function addCustomStatus(userId, customStatus) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    if (!customStatus || customStatus.trim().length === 0) {
        throw new Error('Custom status cannot be empty');
    }

    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            throw new Error('User not found');
        }

        const customStatuses = userDoc.data().customStatuses || [];
        const trimmed = customStatus.trim();

        // Check if already exists
        if (customStatuses.includes(trimmed)) {
            throw new Error('This custom status already exists');
        }

        // Add to array and set as current status
        await updateDoc(userRef, {
            customStatuses: arrayUnion(trimmed),
            currentStatus: trimmed,
            statusUpdatedAt: serverTimestamp(),
        });

        // Update cache
        await AsyncStorage.setItem(
            `${CACHE_PREFIX}${userId}`,
            JSON.stringify({
                status: trimmed,
                timestamp: Date.now(),
            })
        );

        return true;
    } catch (error) {
        console.error('Error adding custom status:', error);
        throw error;
    }
}

/**
 * Clear user's current status
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>}
 */
export async function clearUserStatus(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const userRef = doc(db, 'users', userId);

        await updateDoc(userRef, {
            currentStatus: null,
            statusUpdatedAt: serverTimestamp(),
        });

        // Clear cache
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${userId}`);

        return true;
    } catch (error) {
        console.error('Error clearing user status:', error);
        throw error;
    }
}

/**
 * Get multiple users' statuses in batch
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Map<string, string|null>>}
 */
export async function getBatchUserStatuses(userIds) {
    if (!userIds || userIds.length === 0) {
        return new Map();
    }

    const statusMap = new Map();

    try {
        // Fetch all users in parallel
        const promises = userIds.map(async (userId) => {
            const status = await getUserStatus(userId, true);
            return { userId, status };
        });

        const results = await Promise.all(promises);

        results.forEach(({ userId, status }) => {
            statusMap.set(userId, status);
        });

        return statusMap;
    } catch (error) {
        console.error('Error fetching batch user statuses:', error);
        return statusMap;
    }
}

/**
 * Clear all cached statuses
 * @returns {Promise<void>}
 */
export async function clearStatusCache() {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const statusKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));

        if (statusKeys.length > 0) {
            await AsyncStorage.multiRemove(statusKeys);
        }
    } catch (error) {
        console.error('Error clearing status cache:', error);
    }
}

/**
 * Validate status text
 * @param {string} status - The status text to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateStatus(status) {
    if (!status || typeof status !== 'string') {
        return { valid: false, error: 'Status must be a non-empty string' };
    }

    const trimmed = status.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'Status cannot be empty' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'Status must be 50 characters or less' };
    }

    // Check for invalid characters (optional)
    const invalidChars = /[<>{}[\]\\]/;
    if (invalidChars.test(trimmed)) {
        return { valid: false, error: 'Status contains invalid characters' };
    }

    return { valid: true, error: null };
}

export default {
    initializeUserStatus,
    getUserStatus,
    updateUserStatus,
    addCustomStatus,
    clearUserStatus,
    getBatchUserStatuses,
    clearStatusCache,
    validateStatus,
};
