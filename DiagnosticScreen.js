import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, limit } from 'firebase/firestore';
import { app } from './firebaseConfig';

const DiagnosticScreen = ({ navigation }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState([]);

    const addResult = (message, type = 'info') => {
        setResults(prev => [...prev, { message, type, timestamp: Date.now() }]);
    };

    const runDiagnostics = async () => {
        setIsRunning(true);
        setResults([]);

        try {
            const auth = getAuth(app);
            const db = getFirestore(app);
            const currentUser = auth.currentUser;

            addResult('🔬 Starting Firebase Diagnostics...', 'header');
            addResult('');

            // Check 1: Auth Status
            addResult('📋 Step 1: Authentication Status', 'header');
            if (currentUser) {
                addResult(`✅ User authenticated: ${currentUser.uid}`, 'success');
                addResult(`   Email: ${currentUser.email || 'N/A'}`, 'info');
            } else {
                addResult('❌ No user authenticated', 'error');
                addResult('   Please log in first', 'warning');
                setIsRunning(false);
                return;
            }
            addResult('');

            // Check 2: User Document
            addResult('📋 Step 2: Reading User Document', 'header');
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await Promise.race([
                    getDoc(userRef),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                    )
                ]);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    addResult('✅ User document read successfully', 'success');
                    addResult(`   Name: ${userData.firstName || ''} ${userData.lastName || ''}`, 'info');
                } else {
                    addResult('⚠️ User document not found', 'warning');
                }
            } catch (error) {
                addResult(`❌ Failed: ${error.message}`, 'error');
                if (error.code === 'permission-denied') {
                    addResult('   💡 Firestore rules blocking access', 'warning');
                }
            }
            addResult('');

            // Check 3: Posts Collection
            addResult('📋 Step 3: Reading Posts Collection', 'header');
            try {
                const postsRef = collection(db, 'posts');
                const postsQuery = query(postsRef, limit(5));

                const postsSnap = await Promise.race([
                    getDocs(postsQuery),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                    )
                ]);

                addResult(`✅ Posts read successfully (${postsSnap.docs.length} docs)`, 'success');
                if (postsSnap.docs.length === 0) {
                    addResult('   ⚠️ No posts in database', 'warning');
                }
            } catch (error) {
                addResult(`❌ Failed: ${error.message}`, 'error');
                if (error.code === 'permission-denied') {
                    addResult('   🚨 PERMISSION DENIED - Check Firestore rules!', 'error');
                } else if (error.message.includes('Timeout')) {
                    addResult('   🚨 CONNECTION TIMEOUT - Check internet', 'error');
                }
            }
            addResult('');

            // Check 4: Communities
            addResult('📋 Step 4: Reading Communities Collection', 'header');
            try {
                const communitiesRef = collection(db, 'communities');
                const communitiesQuery = query(communitiesRef, limit(3));

                const communitiesSnap = await Promise.race([
                    getDocs(communitiesQuery),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                    )
                ]);

                addResult(`✅ Communities read successfully (${communitiesSnap.docs.length} docs)`, 'success');
            } catch (error) {
                addResult(`❌ Failed: ${error.message}`, 'error');
            }
            addResult('');

            // Summary
            addResult('📊 DIAGNOSTIC COMPLETE', 'header');
            const hasErrors = results.some(r => r.type === 'error');
            if (hasErrors) {
                addResult('⚠️ Issues found - see errors above', 'warning');
            } else {
                addResult('✅ All checks passed!', 'success');
            }

        } catch (error) {
            addResult(`❌ FATAL ERROR: ${error.message}`, 'error');
        }

        setIsRunning(false);
    };

    const getColorForType = (type) => {
        switch (type) {
            case 'success': return '#4CAF50';
            case 'error': return '#F44336';
            case 'warning': return '#FF9800';
            case 'header': return '#2196F3';
            default: return '#666';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Firebase Diagnostics</Text>
                <Text style={styles.subtitle}>Check data fetching issues</Text>
            </View>

            <TouchableOpacity
                style={[styles.button, isRunning && styles.buttonDisabled]}
                onPress={runDiagnostics}
                disabled={isRunning}
            >
                {isRunning ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Run Diagnostics</Text>
                )}
            </TouchableOpacity>

            <ScrollView style={styles.results}>
                {results.map((result, index) => (
                    <Text
                        key={index}
                        style={[
                            styles.resultText,
                            { color: getColorForType(result.type) },
                            result.type === 'header' && styles.headerText
                        ]}
                    >
                        {result.message}
                    </Text>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#2196F3',
        padding: 20,
        paddingTop: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: '#fff',
        marginTop: 5,
        opacity: 0.9,
    },
    button: {
        backgroundColor: '#2196F3',
        margin: 20,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonDisabled: {
        backgroundColor: '#999',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    results: {
        flex: 1,
        padding: 20,
    },
    resultText: {
        fontSize: 13,
        fontFamily: 'monospace',
        marginBottom: 4,
        lineHeight: 20,
    },
    headerText: {
        fontWeight: 'bold',
        fontSize: 14,
        marginTop: 8,
    },
});

export default DiagnosticScreen;
