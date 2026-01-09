// TestMarketplaceSetup.js - Test screen to initialize marketplace
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { initializeMarketplaceData } from './initializeMarketplace';
import { useWallet } from './context/WalletContext';

export default function TestMarketplaceSetup() {
    const [loading, setLoading] = useState(false);
    const { wallet, fetchWallet } = useWallet();

    const handleInitialize = async () => {
        setLoading(true);
        const result = await initializeMarketplaceData();
        setLoading(false);

        if (result.success) {
            Alert.alert('Success', `${result.count} products added to marketplace!`);
        } else {
            Alert.alert('Error', result.error?.message || 'Failed to initialize');
        }
    };

    const handleRefreshWallet = async () => {
        setLoading(true);
        await fetchWallet();
        setLoading(false);
        Alert.alert('Success', 'Wallet refreshed!');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Marketplace Setup</Text>

            <View style={styles.card}>
                <Text style={styles.label}>Current Wallet:</Text>
                <Text style={styles.value}>Coins: {wallet.coins}</Text>
                <Text style={styles.value}>Diamonds: {wallet.diamonds}</Text>
                <Text style={styles.value}>Earnings: {wallet.earningsBalance}</Text>
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={handleInitialize}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Seed Marketplace Data</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleRefreshWallet}
                disabled={loading}
            >
                <Text style={styles.buttonText}>Refresh Wallet</Text>
            </TouchableOpacity>

            <Text style={styles.info}>
                This will add 6 sample products to Firestore.{'\n'}
                Run once only, then check the Marketplace tab.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0B0E',
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 30,
    },
    card: {
        backgroundColor: '#17171C',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    label: {
        color: '#9CA3AF',
        fontSize: 14,
        marginBottom: 10,
    },
    value: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 5,
    },
    button: {
        backgroundColor: '#7C3AED',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonSecondary: {
        backgroundColor: '#374151',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    info: {
        color: '#9CA3AF',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 18,
    },
});
