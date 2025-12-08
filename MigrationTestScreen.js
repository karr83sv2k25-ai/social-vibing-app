/**
 * User Migration Test Screen
 * 
 * Use this screen to test and verify user migration functionality.
 * Add this to your navigation stack for testing purposes.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { verifyUserDocument, migrateUser } from './migrateExistingUsers';

export default function MigrationTestScreen() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const auth = getAuth();

  // Test current logged-in user
  const testCurrentUser = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        Alert.alert('Error', 'No user is currently logged in');
        return;
      }
      
      const verification = await verifyUserDocument(currentUser.uid);
      
      setResult({
        type: 'current_user',
        userId: currentUser.uid,
        email: currentUser.email,
        ...verification,
      });
      
      if (!verification.complete) {
        Alert.alert(
          'Incomplete User Document',
          `Missing fields: ${verification.missingFields?.join(', ')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Migrate Now',
              onPress: () => migrateCurrentUser(),
            },
          ]
        );
      } else {
        Alert.alert('Success', 'User document is complete!');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Migrate current user
  const migrateCurrentUser = async () => {
    setLoading(true);
    
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        Alert.alert('Error', 'No user is currently logged in');
        return;
      }
      
      const migrationResult = await migrateUser(
        currentUser.uid,
        currentUser.email,
        currentUser.displayName,
        currentUser.photoURL,
        currentUser.metadata?.creationTime
      );
      
      setResult({
        type: 'migration',
        ...migrationResult,
      });
      
      if (migrationResult.success) {
        Alert.alert('Success', `User migrated successfully! Action: ${migrationResult.action}`);
      } else {
        Alert.alert('Error', migrationResult.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test specific user by ID
  const testSpecificUser = async () => {
    if (!userId.trim()) {
      Alert.alert('Error', 'Please enter a user ID');
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const verification = await verifyUserDocument(userId);
      
      setResult({
        type: 'specific_user',
        userId,
        ...verification,
      });
      
      if (verification.exists) {
        if (verification.complete) {
          Alert.alert('Success', 'User document is complete!');
        } else {
          Alert.alert(
            'Incomplete',
            `Missing fields: ${verification.missingFields?.join(', ')}`
          );
        }
      } else {
        Alert.alert('Not Found', 'User document does not exist');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Get current user info
  const getCurrentUserInfo = () => {
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      creationTime: user.metadata?.creationTime,
      lastSignInTime: user.metadata?.lastSignInTime,
    };
  };

  const userInfo = getCurrentUserInfo();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>User Migration Test</Text>
        
        {/* Current User Info */}
        {userInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current User</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>ID: {userInfo.uid}</Text>
              <Text style={styles.infoText}>Email: {userInfo.email}</Text>
              <Text style={styles.infoText}>Name: {userInfo.displayName || 'N/A'}</Text>
              <Text style={styles.infoText}>Verified: {userInfo.emailVerified ? 'Yes' : 'No'}</Text>
            </View>
            
            <TouchableOpacity
              style={styles.button}
              onPress={testCurrentUser}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Test Current User</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.migrateButton]}
              onPress={migrateCurrentUser}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Migrate Current User</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {!userInfo && (
          <View style={styles.section}>
            <Text style={styles.warningText}>No user logged in</Text>
          </View>
        )}
        
        {/* Test Specific User */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Specific User</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter User ID"
            placeholderTextColor="#999"
            value={userId}
            onChangeText={setUserId}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={testSpecificUser}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Test User</Text>
          </TouchableOpacity>
        </View>
        
        {/* Loading */}
        {loading && (
          <View style={styles.section}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
        
        {/* Results */}
        {result && !loading && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Result</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>
                {JSON.stringify(result, null, 2)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  migrateButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    color: '#FF9500',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  resultBox: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
  },
  resultText: {
    color: '#0F0',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
