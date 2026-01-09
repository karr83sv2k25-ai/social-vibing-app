import React, { useState } from 'react';
import { View, Text, ImageBackground, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { uploadImageToHostinger } from './hostingerConfig';

export default function AgeVerificationScreen({ navigation, route }) {
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [verificationDocument, setVerificationDocument] = useState(null);
  const [documentType, setDocumentType] = useState('ID Card');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) return null;

  const handlePickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setVerificationDocument(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSubmitVerification = async () => {
    if (!verificationDocument) {
      Alert.alert('Required', 'Please upload a verification document');
      return;
    }

    if (!dateOfBirth) {
      Alert.alert('Required', 'Please enter your date of birth');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Required', 'Please accept the terms to continue');
      return;
    }

    // Calculate age
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 17) {
      Alert.alert('Age Restriction', 'You must be at least 17 years old to use Social Vibing');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Error', 'No user logged in');
        return;
      }

      // Upload verification document
      let documentUrl = null;
      if (verificationDocument?.uri) {
        documentUrl = await uploadImageToHostinger(verificationDocument.uri, `verification_${user.uid}_${Date.now()}`);
      }

      // Update user document with verification status
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        verificationStatus: 'pending',
        verificationDocument: documentUrl,
        documentType: documentType,
        dateOfBirth: dateOfBirth,
        verificationSubmittedAt: serverTimestamp(),
        isVerified: false,
        age: age
      });

      Alert.alert(
        'Verification Submitted',
        'Your verification request has been submitted. An admin will review it within 24-48 hours.',
        [{ text: 'OK', onPress: () => navigation.replace('TabBar') }]
      );
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipForNow = () => {
    Alert.alert(
      'Verification Required',
      'Account verification is required to access all features. You can verify later from your profile settings.',
      [
        { text: 'Verify Now', style: 'cancel' },
        { 
          text: 'Continue Without Verification', 
          onPress: () => navigation.replace('TabBar')
        }
      ]
    );
  };

  const handleEnter = () => {
    if (!acceptedTerms) {
      Alert.alert('Required', 'Please confirm you are 17 years or older');
      return;
    }
    setShowVerificationForm(true);
  };

  return (
    <ImageBackground
      source={require('./assets/login_bg.png')}
      style={styles.background}
      blurRadius={10}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.container}>
        {!showVerificationForm ? (
          // Age Warning Screen
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(30,30,30,0.9)']}
            style={styles.card}>
            <Text style={styles.title}>
              Attention <Ionicons name="warning-outline" size={18} color="#FFD700" />
            </Text>

            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔞</Text>
            </View>

            <Text style={styles.warningText}>
              Social Vibing is <Text style={{ color: 'red' }}>adult only</Text> application
            </Text>

            <Text style={styles.desc}>
              Social Vibing is strictly limited to those over 17 or of legal age
              in your jurisdiction, whichever is greater.
            </Text>

            <Text style={styles.desc}>
              By entering this Platform, I acknowledge that I am 17 years old or
              older and agree to the terms of service.
            </Text>

            <TouchableOpacity>
              <Text style={styles.link}>How to protect your minors</Text>
            </TouchableOpacity>

            {/* Accept Terms Checkbox */}
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setAcceptedTerms(!acceptedTerms)}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={styles.checkboxText}>I am 17 years or older</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleEnter} 
              activeOpacity={0.8}
              disabled={!acceptedTerms}>
              <LinearGradient
                colors={acceptedTerms ? ['#FF2E2E', '#CC0000'] : ['#666', '#444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.enterButton}>
                <Text style={styles.enterText}>ENTER & VERIFY ACCOUNT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          // Verification Form
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(30,30,30,0.9)']}
            style={styles.verificationCard}>
            <Text style={styles.title}>
              <Ionicons name="shield-checkmark" size={20} color="#08FFE2" /> Account Verification
            </Text>

            <Text style={styles.verificationDesc}>
              To ensure a safe community, please verify your age by uploading an ID or official document.
            </Text>

            {/* Document Type Selector */}
            <View style={styles.documentTypeContainer}>
              {['ID Card', 'Passport', 'Driver License'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.documentTypeButton,
                    documentType === type && styles.documentTypeSelected
                  ]}
                  onPress={() => setDocumentType(type)}>
                  <Text style={[
                    styles.documentTypeText,
                    documentType === type && styles.documentTypeTextSelected
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date of Birth */}
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD (e.g., 1999-12-31)"
              placeholderTextColor="#666"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
            />

            {/* Document Upload */}
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={handlePickDocument}>
              <Ionicons name="cloud-upload-outline" size={24} color="#08FFE2" />
              <Text style={styles.uploadButtonText}>
                {verificationDocument ? 'Document Selected ✓' : 'Upload Verification Document'}
              </Text>
            </TouchableOpacity>

            {verificationDocument && (
              <View style={styles.documentPreview}>
                <Image 
                  source={{ uri: verificationDocument.uri }} 
                  style={styles.documentImage}
                />
                <Text style={styles.documentInfo}>Document ready to submit</Text>
              </View>
            )}

            <Text style={styles.privacyNote}>
              <Ionicons name="lock-closed" size={14} color="#08FFE2" /> Your information is encrypted and will only be used for age verification.
            </Text>

            {/* Submit Button */}
            <TouchableOpacity 
              onPress={handleSubmitVerification}
              activeOpacity={0.8}
              disabled={loading}>
              <LinearGradient
                colors={['#08FFE2', '#0BC5A8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitButton}>
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Verification</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Skip Option */}
            <TouchableOpacity onPress={handleSkipForNow}>
              <Text style={styles.skipText}>Verify Later</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 320,
    padding: 25,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  verificationCard: {
    width: '90%',
    maxWidth: 400,
    padding: 25,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 15,
  },
  iconContainer: {
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 8,
    marginBottom: 10,
  },
  icon: {
    fontSize: 24,
  },
  warningText: {
    color: '#fff',
    fontFamily: 'Manrope_500Medium',
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    color: '#ccc',
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationDesc: {
    color: '#aaa',
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  link: {
    color: '#4FA8FF',
    fontSize: 13,
    textDecorationLine: 'underline',
    marginTop: 5,
    marginBottom: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#08FFE2',
    borderColor: '#08FFE2',
  },
  checkboxText: {
    color: '#fff',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
  },
  enterButton: {
    width: 250,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enterText: {
    color: '#fff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
  },
  documentTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  documentTypeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#666',
  },
  documentTypeSelected: {
    backgroundColor: '#08FFE2',
    borderColor: '#08FFE2',
  },
  documentTypeText: {
    color: '#aaa',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
  },
  documentTypeTextSelected: {
    color: '#000',
    fontFamily: 'Manrope_700Bold',
  },
  inputLabel: {
    color: '#fff',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  dateInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  uploadButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 255, 226, 0.1)',
    borderWidth: 2,
    borderColor: '#08FFE2',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
  },
  uploadButtonText: {
    color: '#08FFE2',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    marginLeft: 10,
  },
  documentPreview: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  documentImage: {
    width: 150,
    height: 100,
    borderRadius: 10,
    marginBottom: 8,
  },
  documentInfo: {
    color: '#08FFE2',
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
  },
  privacyNote: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  submitButton: {
    width: '100%',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  submitButtonText: {
    color: '#000',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
  skipText: {
    color: '#4FA8FF',
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    textDecorationLine: 'underline',
  },
});

