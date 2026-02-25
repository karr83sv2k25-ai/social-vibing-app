// screens/ExpoGoPlaceholderScreen.js - Shown when native modules not available
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ExpoGoPlaceholderScreen({ navigation, feature = 'this feature' }) {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0B0B0E', '#17171C']} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning-outline" size={80} color="#7C3AED" />
          </View>

          <Text style={styles.title}>Feature Unavailable in Expo Go</Text>
          
          <Text style={styles.description}>
            {feature} requires native modules that are not supported in Expo Go.
          </Text>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={24} color="#7C3AED" />
            <Text style={styles.infoText}>
              To use this feature, you need to build a development version of the app.
            </Text>
          </View>

          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>Build Instructions:</Text>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Install EAS CLI: npm install -g eas-cli</Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>Build for Android: eas build --profile development --platform android</Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>Install the APK on your device</Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>Run: npx expo start --dev-client</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['#7C3AED', '#5B21B6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Ionicons name="arrow-back" size={20} color="#FFF" />
              <Text style={styles.backButtonText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  infoText: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  stepsContainer: {
    backgroundColor: '#17171C',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 15,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: 'bold',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
