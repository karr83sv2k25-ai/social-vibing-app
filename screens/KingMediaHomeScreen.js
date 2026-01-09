// screens/KingMediaHomeScreen.js - Main dashboard for King Media features
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, getAdminURL } from '../services/kingMediaService';

export default function KingMediaHomeScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            // Try to get fresh user data
            const result = await authAPI.me();
            if (result.success) {
                setUser(result.user);
            }
        } catch (error) {
            // Not logged in, redirect to login
            navigation.replace('KingMediaLogin');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await authAPI.logout();
                            navigation.replace('KingMediaLogin');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to logout');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
            </View>
        );
    }

    const features = [
        {
            title: 'AI Chat',
            description: 'Ask AI anything',
            icon: 'chatbubbles',
            gradient: ['#7C3AED', '#EC4899'],
            screen: 'KingMediaAIChat',
            limit: '20/hour',
        },
        {
            title: 'Image Generator',
            description: 'Create images from text',
            icon: 'image',
            gradient: ['#10B981', '#06B6D4'],
            screen: 'KingMediaImageGen',
            limit: '5/hour',
        },
        {
            title: 'Video Generator',
            description: 'Generate videos with AI',
            icon: 'videocam',
            gradient: ['#F59E0B', '#EF4444'],
            screen: 'KingMediaVideoGen',
            limit: '2/hour',
        },
        {
            title: 'My Jobs',
            description: 'View generation history',
            icon: 'list',
            gradient: ['#6366F1', '#8B5CF6'],
            screen: 'KingMediaJobs',
            limit: null,
        },
    ];

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Welcome back,</Text>
                        <Text style={styles.username}>{user?.handle || 'User'}</Text>
                        <Text style={styles.level}>Level {user?.level || 0}</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Ionicons name="log-out-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Features Grid */}
                <View style={styles.grid}>
                    {features.map((feature, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.featureCard}
                            onPress={() => navigation.navigate(feature.screen)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={feature.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.featureGradient}
                            >
                                <Ionicons name={feature.icon} size={32} color="#fff" />
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDesc}>{feature.description}</Text>
                                {feature.limit && (
                                    <View style={styles.limitBadge}>
                                        <Text style={styles.limitText}>{feature.limit}</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Info Section */}
                <View style={styles.infoCard}>
                    <MaterialCommunityIcons name="information" size={24} color="#7C3AED" />
                    <Text style={styles.infoTitle}>Rate Limits</Text>
                    <Text style={styles.infoText}>
                        • AI Chat: 20 requests/hour{'\n'}
                        • Image Gen: 5 requests/hour{'\n'}
                        • Video Gen: 2 requests/hour
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.adminBtn}
                    onPress={() => {
                        Alert.alert(
                            'Admin Panel',
                            'Open admin panel in browser?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Open',
                                    onPress: () => {
                                        // Could open WebView or external browser
                                        const url = getAdminURL();
                                        console.log('Admin URL:', url);
                                    },
                                },
                            ]
                        );
                    }}
                >
                    <MaterialCommunityIcons name="shield-crown" size={20} color="#7C3AED" />
                    <Text style={styles.adminText}>Admin Panel</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0B0E',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0B0B0E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
    },
    greeting: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    username: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 5,
    },
    level: {
        color: '#7C3AED',
        fontSize: 14,
        marginTop: 2,
    },
    logoutBtn: {
        padding: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 10,
    },
    featureCard: {
        width: '48%',
        margin: '1%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    featureGradient: {
        padding: 20,
        minHeight: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15,
        textAlign: 'center',
    },
    featureDesc: {
        color: '#fff',
        fontSize: 12,
        marginTop: 5,
        textAlign: 'center',
        opacity: 0.9,
    },
    limitBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 10,
    },
    limitText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#17171C',
        margin: 20,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    infoTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
    },
    infoText: {
        color: '#9CA3AF',
        fontSize: 14,
        lineHeight: 22,
    },
    adminBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#17171C',
        margin: 20,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#7C3AED',
        gap: 8,
    },
    adminText: {
        color: '#7C3AED',
        fontSize: 16,
        fontWeight: '600',
    },
});
