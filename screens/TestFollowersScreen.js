import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { debugFollowersSystem, testFirestoreConnection } from '../testFollowersSystem';
import { fixFollowersSubcollection, verifyFollowersStructure } from '../fixFollowers';
import { auth } from '../firebaseConfig';

const BG = '#0B0B0E';
const CARD = '#17171C';
const ACCENT = '#8B2EF0';

export default function TestFollowersScreen({ navigation }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');

  const runTest = async (testName, testFunc) => {
    setTesting(true);
    setResult(`Running ${testName}...`);
    
    try {
      await testFunc();
      setResult(`✅ ${testName} completed! Check console for details.`);
    } catch (error) {
      setResult(`❌ ${testName} failed: ${error.message}`);
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test Followers System</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧪 System Tests</Text>
          <Text style={styles.cardDesc}>
            Run these tests to debug followers and notifications
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonDisabled]}
          onPress={() => runTest('Firestore Connection', testFirestoreConnection)}
          disabled={testing}
        >
          <Ionicons name="cloud-outline" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Test Firestore Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonDisabled]}
          onPress={() => runTest('Followers System Debug', () => debugFollowersSystem())}
          disabled={testing}
        >
          <Ionicons name="people-outline" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Debug My Followers/Following</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonDisabled, { backgroundColor: '#FF6B00' }]}
          onPress={() => runTest('Fix Followers Migration', fixFollowersSubcollection)}
          disabled={testing}
        >
          <Ionicons name="construct-outline" size={24} color="#fff" />
          <Text style={styles.testButtonText}>🔧 Fix Followers Subcollection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonDisabled, { backgroundColor: '#00A86B' }]}
          onPress={() => runTest('Verify Structure', () => verifyFollowersStructure(auth.currentUser?.uid))}
          disabled={testing}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Verify My Followers Structure</Text>
        </TouchableOpacity>

        {testing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>Running test...</Text>
          </View>
        )}

        {result !== '' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>{result}</Text>
            <Text style={styles.resultSubtext}>Check console for detailed logs</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 What to Check:</Text>
          <Text style={styles.infoText}>
            • Open Developer Console (Metro bundler){'\n'}
            • Run a test above{'\n'}
            • Look for emoji logs (🔍 📊 ✅ ❌){'\n'}
            • Verify data matches your expectations{'\n'}
            • Check for any error messages
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🐛 Common Issues:</Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Empty followers list:</Text>{'\n'}
            Check if subcollection has data{'\n\n'}
            <Text style={styles.bold}>No notifications:</Text>{'\n'}
            Check if notifications subcollection exists{'\n\n'}
            <Text style={styles.bold}>Count mismatch:</Text>{'\n'}
            User document count vs actual subcollection size
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
  },
  resultText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  resultSubtext: {
    fontSize: 12,
    color: '#888',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
    color: '#fff',
  },
});
