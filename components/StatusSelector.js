/**
 * StatusSelector.js
 * Reusable component for selecting and managing user status
 * Can be used in Profile, Messages, and Community screens
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStatus } from '../contexts/StatusContext';

const { width } = Dimensions.get('window');

// Theme colors matching your app
const C = {
    bg: '#0B0B10',
    card: '#14171C',
    card2: '#1A1F27',
    border: '#242A33',
    text: '#EAEAF0',
    dim: '#A2A8B3',
    cyan: '#08FFE2',
    brand: '#BF2EF0',
    danger: '#FF1010',
    success: '#10B981',
};

/**
 * StatusSelector Component
 * @param {boolean} visible - Controls modal visibility
 * @param {Function} onClose - Called when modal is closed
 * @param {string} title - Optional title for the selector
 */
export default function StatusSelector({ visible, onClose, title = 'Change Status' }) {
    const {
        currentStatus,
        customStatuses,
        PREDEFINED_STATUSES,
        updateStatus,
        addCustomStatus,
        clearStatus,
        loading,
    } = useStatus();

    const [customInput, setCustomInput] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [updating, setUpdating] = useState(false);

    const handleStatusSelect = async (statusText) => {
        try {
            setUpdating(true);
            await updateStatus(statusText);
            setCustomInput('');
            setShowCustomInput(false);
            onClose();
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update status. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const handleAddCustomStatus = async () => {
        if (!customInput.trim()) {
            Alert.alert('Invalid Input', 'Please enter a status message');
            return;
        }

        if (customInput.trim().length > 50) {
            Alert.alert('Too Long', 'Status must be 50 characters or less');
            return;
        }

        try {
            setUpdating(true);
            await addCustomStatus(customInput.trim());
            setCustomInput('');
            setShowCustomInput(false);
            onClose();
        } catch (error) {
            console.error('Error adding custom status:', error);
            if (error.message.includes('already exists')) {
                Alert.alert('Duplicate Status', 'This status already exists in your list');
            } else {
                Alert.alert('Error', 'Failed to add custom status. Please try again.');
            }
        } finally {
            setUpdating(false);
        }
    };

    const handleClearStatus = async () => {
        try {
            setUpdating(true);
            await clearStatus();
            onClose();
        } catch (error) {
            console.error('Error clearing status:', error);
            Alert.alert('Error', 'Failed to clear status. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const renderStatusItem = ({ item, isPredefined = false }) => {
        const isSelected = currentStatus === (isPredefined ? item.label : item);
        const displayText = isPredefined ? item.label : item;
        const emoji = isPredefined ? item.emoji : '💬';
        const color = isPredefined ? item.color : C.brand;

        return (
            <TouchableOpacity
                style={[styles.statusItem, isSelected && styles.statusItemSelected]}
                onPress={() => handleStatusSelect(displayText)}
                disabled={updating}
            >
                <View style={styles.statusLeft}>
                    <View style={[styles.statusEmoji, { backgroundColor: color + '20' }]}>
                        <Text style={styles.emojiText}>{emoji}</Text>
                    </View>
                    <Text style={styles.statusText}>{displayText}</Text>
                </View>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={C.cyan} />
                )}
            </TouchableOpacity>
        );
    };

    const allStatuses = [
        ...PREDEFINED_STATUSES.map(s => ({ ...s, isPredefined: true })),
        ...customStatuses.map(s => ({ label: s, isPredefined: false })),
    ];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={C.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Current Status Display */}
                    {currentStatus && (
                        <View style={styles.currentStatusContainer}>
                            <Text style={styles.currentStatusLabel}>Current Status:</Text>
                            <View style={styles.currentStatusBadge}>
                                <Text style={styles.currentStatusText}>{currentStatus}</Text>
                                <TouchableOpacity
                                    onPress={handleClearStatus}
                                    disabled={updating}
                                    style={styles.clearButton}
                                >
                                    <Ionicons name="close-circle" size={18} color={C.dim} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Status List */}
                    <FlatList
                        data={allStatuses}
                        keyExtractor={(item, index) =>
                            item.isPredefined ? item.id : `custom-${index}`
                        }
                        renderItem={({ item }) =>
                            renderStatusItem({
                                item: item.isPredefined ? item : item.label,
                                isPredefined: item.isPredefined,
                            })
                        }
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No statuses available</Text>
                            </View>
                        }
                    />

                    {/* Custom Status Input */}
                    {showCustomInput ? (
                        <View style={styles.customInputContainer}>
                            <TextInput
                                style={styles.customInput}
                                placeholder="Enter custom status..."
                                placeholderTextColor={C.dim}
                                value={customInput}
                                onChangeText={setCustomInput}
                                maxLength={50}
                                autoFocus
                            />
                            <View style={styles.customInputButtons}>
                                <TouchableOpacity
                                    style={[styles.button, styles.buttonSecondary]}
                                    onPress={() => {
                                        setShowCustomInput(false);
                                        setCustomInput('');
                                    }}
                                    disabled={updating}
                                >
                                    <Text style={styles.buttonTextSecondary}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.buttonPrimary]}
                                    onPress={handleAddCustomStatus}
                                    disabled={updating || !customInput.trim()}
                                >
                                    {updating ? (
                                        <ActivityIndicator color={C.text} size="small" />
                                    ) : (
                                        <Text style={styles.buttonTextPrimary}>Add</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.addCustomButton}
                            onPress={() => setShowCustomInput(true)}
                            disabled={updating}
                        >
                            <MaterialCommunityIcons name="plus-circle" size={20} color={C.brand} />
                            <Text style={styles.addCustomText}>Set Custom Status</Text>
                        </TouchableOpacity>
                    )}

                    {updating && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={C.cyan} />
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: C.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: C.text,
    },
    closeButton: {
        padding: 4,
    },
    currentStatusContainer: {
        padding: 16,
        backgroundColor: C.bg,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
    },
    currentStatusLabel: {
        fontSize: 12,
        color: C.dim,
        marginBottom: 6,
    },
    currentStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    currentStatusText: {
        fontSize: 16,
        color: C.text,
        fontWeight: '600',
        flex: 1,
    },
    clearButton: {
        padding: 4,
    },
    listContent: {
        padding: 16,
        paddingBottom: 8,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        backgroundColor: C.card2,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    statusItemSelected: {
        borderColor: C.cyan,
        backgroundColor: C.card2 + 'CC',
    },
    statusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    statusEmoji: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    emojiText: {
        fontSize: 18,
    },
    statusText: {
        fontSize: 16,
        color: C.text,
        fontWeight: '500',
        flex: 1,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 14,
        color: C.dim,
    },
    customInputContainer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    customInput: {
        backgroundColor: C.card2,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: C.text,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    customInputButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonSecondary: {
        backgroundColor: C.card2,
        borderWidth: 1,
        borderColor: C.border,
    },
    buttonPrimary: {
        backgroundColor: C.brand,
    },
    buttonTextSecondary: {
        fontSize: 16,
        fontWeight: '600',
        color: C.text,
    },
    buttonTextPrimary: {
        fontSize: 16,
        fontWeight: '600',
        color: C.text,
    },
    addCustomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginTop: 8,
        backgroundColor: C.card2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        borderStyle: 'dashed',
    },
    addCustomText: {
        fontSize: 16,
        fontWeight: '600',
        color: C.brand,
        marginLeft: 8,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
});
