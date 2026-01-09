// screens/KingMediaVideoGenScreen.js - AI Video Generator (Complete Implementation)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { aiAPI } from '../services/kingMediaService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VideoGenerationScreen = ({ navigation }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    const token = await AsyncStorage.getItem('kingmedia_jwt_token');
    if (!token) {
      Alert.alert(
        'Login Required',
        'Please login to use AI Video Generator',
        [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Login', onPress: () => {
            // Navigate to login screen if you have one
            Alert.alert('Info', 'Please login first at the marketplace');
            navigation.goBack();
          }}
        ]
      );
    }
  };

  const handleGenerateVideo = async () => {
    // Validation
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a video description');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('🎬 Starting video generation...');
      console.log('📝 Prompt:', prompt);
      
      // Call API - IMPORTANT: provider must be 'veo3'
      const response = await aiAPI.generateVideo(prompt, 'veo3');
      
      console.log('📦 Response:', JSON.stringify(response, null, 2));

      if (response.success) {
        setResult(response);
        Alert.alert(
          'Success! 🎉', 
          'Video generation started! This will take 2-5 minutes.'
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to start video generation');
      }
    } catch (error) {
      console.error('❌ Video Generation Error:', error);
      console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      Alert.alert(
        'Error',
        error.message || 'Failed to generate video. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎬 Generate Video</Text>
        <Text style={styles.subtitle}>Powered by Google Veo 3</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Describe your video in detail. Example: "A cat playing with a ball of yarn on a sunny day"
          </Text>
        </View>

        <TextInput
          style={styles.textArea}
          placeholder="Describe your video..."
          placeholderTextColor="#999"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          numberOfLines={4}
          editable={!loading}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGenerateVideo}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>🎬 Generate Video</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>✅ Video Generation Started</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Job ID:</Text>
              <Text style={styles.resultValue}>{result.job_id}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Status:</Text>
              <Text style={styles.resultValue}>{result.status}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Estimated Time:</Text>
              <Text style={styles.resultValue}>{result.estimated_time || '2-5 minutes'}</Text>
            </View>
          </View>
        )}

        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>📝 Example Prompts:</Text>
          
          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('A cat playing with a ball of yarn')}>
            <Text style={styles.exampleText}>🐱 A cat playing with a ball of yarn</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('Waves crashing on a beach at sunset')}>
            <Text style={styles.exampleText}>🌊 Waves crashing on a beach at sunset</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('A bird flying through the clouds')}>
            <Text style={styles.exampleText}>🐦 A bird flying through the clouds</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('A person walking in a park on a sunny day')}>
            <Text style={styles.exampleText}>🚶 A person walking in a park on a sunny day</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>⏱️ Important Notes:</Text>
          <Text style={styles.noteText}>• Video generation takes 2-5 minutes</Text>
          <Text style={styles.noteText}>• You will receive notification when complete</Text>
          <Text style={styles.noteText}>• Keep your description detailed and clear</Text>
          <Text style={styles.noteText}>• Limit: 2 videos per hour</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 120,
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  resultContainer: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 15,
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 120,
  },
  resultValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  examplesContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exampleButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exampleText: {
    fontSize: 14,
    color: '#2196F3',
  },
  noteBox: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#E65100',
    marginBottom: 4,
  },
});

export default VideoGenerationScreen;
