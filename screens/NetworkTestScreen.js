// screens/NetworkTestScreen.js - Network Diagnostic Tool
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NetworkTestScreen() {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState([]);

    const addResult = (test, status, message) => {
        setResults(prev => [...prev, { test, status, message, time: new Date().toLocaleTimeString() }]);
    };

    const runTests = async () => {
        setTesting(true);
        setResults([]);

        // Test 1: Check internet connection
        addResult('Internet Check', 'testing', 'Checking basic connectivity...');
        try {
            const response = await fetch('https://www.google.com', { method: 'HEAD' });
            if (response.ok) {
                addResult('Internet Check', 'success', '✅ Internet is working');
            } else {
                addResult('Internet Check', 'error', '❌ Internet not working');
            }
        } catch (error) {
            addResult('Internet Check', 'error', `❌ No internet: ${error.message}`);
        }

        // Test 2: Check API server
        addResult('API Server', 'testing', 'Testing API server...');
        try {
            const response = await fetch('https://beige-crane-665569.hostingersite.com', { method: 'HEAD', timeout: 5000 });
            if (response.ok) {
                addResult('API Server', 'success', '✅ API server is reachable');
            } else {
                addResult('API Server', 'error', `❌ API server returned: ${response.status}`);
            }
        } catch (error) {
            addResult('API Server', 'error', `❌ Cannot reach API: ${error.message}`);
        }

        // Test 3: Check login endpoint
        addResult('Login API', 'testing', 'Testing login endpoint...');
        try {
            const response = await fetch('https://beige-crane-665569.hostingersite.com/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: 'karr83sv2k25@gmail.com',
                    password: 'Admin123!'
                }),
                credentials: 'omit',
                mode: 'cors',
            });

            console.log('Login test - Status:', response.status);
            const data = await response.json();
            console.log('Login test - Data:', data);

            if (data.success) {
                addResult('Login API', 'success', `✅ Login works! Token received`);
            } else {
                addResult('Login API', 'error', `❌ Login failed: ${data.message}`);
            }
        } catch (error) {
            addResult('Login API', 'error', `❌ Login error: ${error.message}`);
        }

        // Test 4: Check video endpoint
        addResult('Video API', 'testing', 'Testing video endpoint...');
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            if (!token) {
                addResult('Video API', 'warning', '⚠️ No token found. Login first.');
            } else {
                const response = await fetch('https://beige-crane-665569.hostingersite.com/api/ai/video', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        prompt: 'test video',
                        provider: 'veo3'
                    }),
                    credentials: 'omit',
                    mode: 'cors',
                });

                const data = await response.json();

                if (data.success) {
                    addResult('Video API', 'success', `✅ Video API works! Job ID: ${data.job_id}`);
                } else {
                    addResult('Video API', 'error', `❌ Video API failed: ${data.message}`);
                }
            }
        } catch (error) {
            addResult('Video API', 'error', `❌ Video API error: ${error.message}`);
        }

        // Test 5: Device Info
        addResult('Device Info', 'info', `Phone model: ${Platform.OS} ${Platform.Version}`);

        setTesting(false);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔍 Network Diagnostics</Text>
                <Text style={styles.subtitle}>Test API connectivity</Text>
            </View>

            <TouchableOpacity
                style={[styles.button, testing && styles.buttonDisabled]}
                onPress={runTests}
                disabled={testing}
            >
                {testing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.buttonText}>Testing...</Text>
                    </View>
                ) : (
                    <Text style={styles.buttonText}>🚀 Run Tests</Text>
                )}
            </TouchableOpacity>

            <ScrollView style={styles.resultsContainer}>
                {results.map((result, index) => (
                    <View
                        key={index}
                        style={[
                            styles.resultItem,
                            result.status === 'success' && styles.resultSuccess,
                            result.status === 'error' && styles.resultError,
                            result.status === 'warning' && styles.resultWarning,
                        ]}
                    >
                        <Text style={styles.resultTime}>{result.time}</Text>
                        <Text style={styles.resultTest}>{result.test}</Text>
                        <Text style={styles.resultMessage}>{result.message}</Text>
                    </View>
                ))}

                {results.length === 0 && !testing && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>Press "Run Tests" to start diagnostics</Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>📌 Troubleshooting Tips:</Text>
                <Text style={styles.infoText}>• Make sure phone has internet</Text>
                <Text style={styles.infoText}>• Try switching WiFi/Mobile data</Text>
                <Text style={styles.infoText}>• Check if VPN is blocking</Text>
                <Text style={styles.infoText}>• Restart app after network change</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
    },
    button: {
        backgroundColor: '#2196F3',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    resultsContainer: {
        flex: 1,
    },
    resultItem: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#ccc',
    },
    resultSuccess: {
        borderLeftColor: '#4CAF50',
    },
    resultError: {
        borderLeftColor: '#F44336',
    },
    resultWarning: {
        borderLeftColor: '#FF9800',
    },
    resultTime: {
        fontSize: 10,
        color: '#999',
        marginBottom: 5,
    },
    resultTest: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    resultMessage: {
        fontSize: 14,
        color: '#666',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    infoBox: {
        backgroundColor: '#E3F2FD',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1976D2',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 12,
        color: '#1976D2',
        marginBottom: 5,
    },
});
