/**
 * StatusBadge.js
 * Reusable component for displaying user status badges
 * Consistent design across all screens
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStatus } from '../contexts/StatusContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Theme colors
const C = {
    bg: '#0B0B10',
    card: '#14171C',
    card2: '#1A1F27',
    border: '#242A33',
    text: '#EAEAF0',
    dim: '#A2A8B3',
    cyan: '#08FFE2',
    brand: '#BF2EF0',
};

/**
 * StatusBadge Component
 * @param {string} userId - The user ID to display status for (optional if showing own status)
 * @param {boolean} isOwnStatus - Whether this is the current user's status
 * @param {Function} onPress - Called when badge is pressed (for editing)
 * @param {string} size - Size variant: 'small', 'medium', 'large'
 * @param {boolean} showEditIcon - Whether to show edit icon (only for own status)
 * @param {string} style - Additional styles
 */
export default function StatusBadge({
    userId = null,
    isOwnStatus = false,
    onPress = null,
    size = 'medium',
    showEditIcon = false,
    style = {},
}) {
    const { currentStatus, getUserStatus, subscribeToUserStatus } = useStatus();
    const [displayStatus, setDisplayStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    // Load status for other users or use current status for own
    useEffect(() => {
        if (isOwnStatus) {
            setDisplayStatus(currentStatus);
            return;
        }

        if (!userId) {
            setDisplayStatus(null);
            return;
        }

        // Subscribe to real-time updates for other users
        setLoading(true);
        const unsubscribe = subscribeToUserStatus(userId, (status) => {
            setDisplayStatus(status);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, isOwnStatus, currentStatus, subscribeToUserStatus]);

    // Show placeholder for own status when no status is set
    const showPlaceholder = isOwnStatus && !displayStatus && !loading;

    // Don't render if no status for other users
    if (!isOwnStatus && !displayStatus && !loading) {
        return null;
    }

    const sizeStyles = {
        small: {
            container: { paddingHorizontal: 8, paddingVertical: 4, height: 24 },
            text: { fontSize: 11 },
            icon: 14,
        },
        medium: {
            container: { paddingHorizontal: 10, paddingVertical: 6, height: 28 },
            text: { fontSize: 13 },
            icon: 16,
        },
        large: {
            container: { paddingHorizontal: 12, paddingVertical: 8, height: 32 },
            text: { fontSize: 14 },
            icon: 18,
        },
    };

    const currentSize = sizeStyles[size] || sizeStyles.medium;

    const BadgeContent = () => (
        <>
            {loading ? (
                <ActivityIndicator size="small" color={C.text} />
            ) : showPlaceholder ? (
                <>
                    <View style={[styles.statusIndicator, { backgroundColor: C.dim }]} />
                    <Text
                        style={[styles.statusText, currentSize.text, { color: C.dim }]}
                        numberOfLines={1}
                    >
                        Set status
                    </Text>
                    <Ionicons
                        name="create-outline"
                        size={currentSize.icon}
                        color={C.dim}
                        style={{ marginLeft: 4 }}
                    />
                </>
            ) : (
                <>
                    <View style={styles.statusIndicator} />
                    <Text
                        style={[styles.statusText, currentSize.text]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {displayStatus}
                    </Text>
                    {showEditIcon && isOwnStatus && (
                        <Ionicons
                            name="create-outline"
                            size={currentSize.icon}
                            color={C.dim}
                            style={{ marginLeft: 4 }}
                        />
                    )}
                </>
            )}
        </>
    );

    if (onPress && (isOwnStatus || showPlaceholder)) {
        return (
            <TouchableOpacity
                style={[styles.badge, currentSize.container, style]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <BadgeContent />
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.badge, currentSize.container, style]}>
            <BadgeContent />
        </View>
    );
}

/**
 * Compact inline status display (just the text with icon)
 */
export function InlineStatus({
    userId = null,
    isOwnStatus = false,
    style = {},
    textStyle = {},
}) {
    const { currentStatus, getUserStatus, subscribeToUserStatus } = useStatus();
    const [displayStatus, setDisplayStatus] = useState(null);

    useEffect(() => {
        if (isOwnStatus) {
            setDisplayStatus(currentStatus);
            return;
        }

        if (!userId) {
            setDisplayStatus(null);
            return;
        }

        const unsubscribe = subscribeToUserStatus(userId, (status) => {
            setDisplayStatus(status);
        });

        return () => unsubscribe();
    }, [userId, isOwnStatus, currentStatus, subscribeToUserStatus]);

    if (!displayStatus) {
        return null;
    }

    return (
        <View style={[styles.inlineStatus, style]}>
            <View style={styles.inlineIndicator} />
            <Text
                style={[styles.inlineText, textStyle]}
                numberOfLines={1}
                ellipsizeMode="tail"
            >
                {displayStatus}
            </Text>
        </View>
    );
}

/**
 * Status chip with predefined color based on status type
 */
export function StatusChip({ status, style = {} }) {
    if (!status) return null;

    // Determine color based on common status keywords
    let chipColor = C.brand;
    const lowerStatus = status.toLowerCase();

    if (lowerStatus.includes('available') || lowerStatus.includes('online')) {
        chipColor = '#10B981'; // Green
    } else if (lowerStatus.includes('busy') || lowerStatus.includes('do not disturb') || lowerStatus.includes('dnd')) {
        chipColor = '#EF4444'; // Red
    } else if (lowerStatus.includes('away') || lowerStatus.includes('idle')) {
        chipColor = '#F59E0B'; // Orange
    } else if (lowerStatus.includes('meeting')) {
        chipColor = '#8B5CF6'; // Purple
    }

    return (
        <View style={[styles.chip, { backgroundColor: chipColor + '20' }, style]}>
            <View style={[styles.chipDot, { backgroundColor: chipColor }]} />
            <Text style={[styles.chipText, { color: chipColor }]} numberOfLines={1}>
                {status}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card2,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        alignSelf: 'flex-start',
    },
    statusIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.cyan,
        marginRight: 6,
    },
    statusText: {
        color: C.text,
        fontWeight: '500',
        maxWidth: 150,
    },
    inlineStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inlineIndicator: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.cyan,
        marginRight: 5,
    },
    inlineText: {
        color: C.dim,
        fontSize: 12,
        maxWidth: 120,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    chipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        maxWidth: 120,
    },
});

/**
 * SimpleInlineStatus - Works without StatusProvider
 * Fetches status directly from Firestore
 * Use this in screens that aren't wrapped in StatusProvider
 */
export function SimpleInlineStatus({
    userId,
    style = {},
    textStyle = {},
}) {
    const [displayStatus, setDisplayStatus] = useState(null);

    useEffect(() => {
        if (!userId) {
            setDisplayStatus(null);
            return;
        }

        const userRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                setDisplayStatus(userData.currentStatus || null);
            }
        }, (error) => {
            console.log('Error fetching user status:', error);
            setDisplayStatus(null);
        });

        return () => unsubscribe();
    }, [userId]);

    if (!displayStatus) {
        return null;
    }

    return (
        <View style={[styles.inlineStatus, style]}>
            <View style={styles.inlineIndicator} />
            <Text
                style={[styles.inlineText, textStyle]}
                numberOfLines={1}
                ellipsizeMode="tail"
            >
                {displayStatus}
            </Text>
        </View>
    );
}
