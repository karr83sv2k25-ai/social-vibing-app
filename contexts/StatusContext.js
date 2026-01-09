/**
 * StatusContext.js
 * Global context for managing user status across the app
 * Provides real-time status updates and caching
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
    doc,
    onSnapshot,
    updateDoc,
    arrayUnion,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Safely import AsyncStorage with fallback
let AsyncStorage;
try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
    console.warn('AsyncStorage not available, caching will be disabled:', e.message);
    // Fallback mock implementation
    AsyncStorage = {
        getItem: async () => null,
        setItem: async () => { },
        removeItem: async () => { },
        getAllKeys: async () => [],
        multiRemove: async () => { }
    };
}

const StatusContext = createContext();

// Predefined status options
export const PREDEFINED_STATUSES = [
    { id: 'online', label: 'Online', emoji: '🟢', color: '#10B981' },
    { id: 'available', label: 'Available', emoji: '✅', color: '#10B981' },
    { id: 'busy', label: 'Busy', emoji: '🔴', color: '#EF4444' },
    { id: 'away', label: 'Away', emoji: '🟡', color: '#F59E0B' },
    { id: 'dnd', label: 'Do Not Disturb', emoji: '🔕', color: '#DC2626' },
    { id: 'meeting', label: 'In a meeting', emoji: '📅', color: '#8B5CF6' },
];

const CACHE_KEY = 'user_status_cache';

export function StatusProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [currentStatus, setCurrentStatus] = useState(null);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusListeners, setStatusListeners] = useState(new Map());

    // Initialize auth listener
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (!user) {
                setCurrentStatus(null);
                setCustomStatuses([]);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    // Load cached status on mount
    useEffect(() => {
        if (!currentUser) return;

        const loadCachedStatus = async () => {
            try {
                const cached = await AsyncStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    setCurrentStatus(data.currentStatus);
                    setCustomStatuses(data.customStatuses || []);
                }
            } catch (error) {
                console.error('Error loading cached status:', error);
            }
        };

        loadCachedStatus();
    }, [currentUser]);

    // Real-time listener for current user's status
    useEffect(() => {
        if (!currentUser) return;

        const userRef = doc(db, 'users', currentUser.uid);

        const unsubscribe = onSnapshot(
            userRef,
            async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const status = data.currentStatus || null;
                    const customs = data.customStatuses || [];

                    setCurrentStatus(status);
                    setCustomStatuses(customs);

                    // Cache the status
                    try {
                        await AsyncStorage.setItem(
                            `${CACHE_KEY}_${currentUser.uid}`,
                            JSON.stringify({ currentStatus: status, customStatuses: customs })
                        );
                    } catch (error) {
                        console.error('Error caching status:', error);
                    }
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error listening to status changes:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser]);

    /**
     * Update the current user's status
     * @param {string} newStatus - The status text to set
     */
    const updateStatus = useCallback(async (newStatus) => {
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                currentStatus: newStatus,
                statusUpdatedAt: new Date().toISOString(),
            });

            // Update local state
            setCurrentStatus(newStatus);

            // Update cache
            await AsyncStorage.setItem(
                `${CACHE_KEY}_${currentUser.uid}`,
                JSON.stringify({ currentStatus: newStatus, customStatuses })
            );

            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    }, [currentUser, customStatuses]);

    /**
     * Add a new custom status
     * @param {string} customStatus - The custom status text
     */
    const addCustomStatus = useCallback(async (customStatus) => {
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        if (!customStatus || customStatus.trim().length === 0) {
            throw new Error('Custom status cannot be empty');
        }

        const trimmed = customStatus.trim();

        // Check if already exists
        if (customStatuses.includes(trimmed)) {
            throw new Error('This custom status already exists');
        }

        try {
            const userRef = doc(db, 'users', currentUser.uid);

            // Add to custom statuses array and set as current status
            await updateDoc(userRef, {
                customStatuses: arrayUnion(trimmed),
                currentStatus: trimmed,
                statusUpdatedAt: new Date().toISOString(),
            });

            // Update local state
            const newCustoms = [...customStatuses, trimmed];
            setCustomStatuses(newCustoms);
            setCurrentStatus(trimmed);

            // Update cache
            await AsyncStorage.setItem(
                `${CACHE_KEY}_${currentUser.uid}`,
                JSON.stringify({ currentStatus: trimmed, customStatuses: newCustoms })
            );

            return true;
        } catch (error) {
            console.error('Error adding custom status:', error);
            throw error;
        }
    }, [currentUser, customStatuses]);

    /**
     * Get status for any user by ID (with caching)
     * @param {string} userId - The user ID to fetch status for
     * @returns {Promise<string|null>} The user's current status
     */
    const getUserStatus = useCallback(async (userId) => {
        if (!userId) return null;

        try {
            // Check cache first
            const cached = await AsyncStorage.getItem(`${CACHE_KEY}_${userId}`);
            if (cached) {
                const data = JSON.parse(cached);
                if (data.currentStatus) {
                    return data.currentStatus;
                }
            }

            // Fetch from Firestore
            const userRef = doc(db, 'users', userId);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const status = docSnap.data().currentStatus || null;

                // Cache it
                await AsyncStorage.setItem(
                    `${CACHE_KEY}_${userId}`,
                    JSON.stringify({ currentStatus: status })
                );

                return status;
            }

            return null;
        } catch (error) {
            console.error('Error fetching user status:', error);
            return null;
        }
    }, []);

    /**
     * Subscribe to real-time status updates for a specific user
     * @param {string} userId - The user ID to listen to
     * @param {Function} callback - Called with the new status when it changes
     * @returns {Function} Unsubscribe function
     */
    const subscribeToUserStatus = useCallback((userId, callback) => {
        if (!userId) return () => { };

        const userRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(
            userRef,
            async (docSnap) => {
                if (docSnap.exists()) {
                    const status = docSnap.data().currentStatus || null;

                    // Update cache
                    try {
                        await AsyncStorage.setItem(
                            `${CACHE_KEY}_${userId}`,
                            JSON.stringify({ currentStatus: status })
                        );
                    } catch (error) {
                        console.error('Error caching user status:', error);
                    }

                    callback(status);
                } else {
                    callback(null);
                }
            },
            (error) => {
                console.error('Error in status subscription:', error);
                callback(null);
            }
        );

        return unsubscribe;
    }, []);

    /**
     * Clear status (set to null)
     */
    const clearStatus = useCallback(async () => {
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                currentStatus: null,
                statusUpdatedAt: new Date().toISOString(),
            });

            setCurrentStatus(null);

            // Update cache
            await AsyncStorage.setItem(
                `${CACHE_KEY}_${currentUser.uid}`,
                JSON.stringify({ currentStatus: null, customStatuses })
            );

            return true;
        } catch (error) {
            console.error('Error clearing status:', error);
            throw error;
        }
    }, [currentUser, customStatuses]);

    const value = {
        currentStatus,
        customStatuses,
        loading,
        updateStatus,
        addCustomStatus,
        clearStatus,
        getUserStatus,
        subscribeToUserStatus,
        PREDEFINED_STATUSES,
    };

    return (
        <StatusContext.Provider value={value}>
            {children}
        </StatusContext.Provider>
    );
}

/**
 * Hook to use the status context
 */
export function useStatus() {
    const context = useContext(StatusContext);
    if (!context) {
        throw new Error('useStatus must be used within a StatusProvider');
    }
    return context;
}

export default StatusContext;
