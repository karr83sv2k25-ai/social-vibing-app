import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { app } from './firebaseConfig';

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword]     = useState('');
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [showCurrent, setShowCurrent]             = useState(false);
  const [showNew, setShowNew]                     = useState(false);
  const [showConfirm, setShowConfirm]             = useState(false);
  const [isLoading, setIsLoading]                 = useState(false);
  const [verifiedCurrent, setVerifiedCurrent]     = useState(false);

  const [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  // ── Derived validation ─────────────────────────────────────────────────
  const passwordStrength = (() => {
    if (!newPassword) return null;
    let score = 0;
    if (newPassword.length >= MIN_PASSWORD_LENGTH) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    if (score <= 1) return { label: 'Weak',   color: '#FF4757' };
    if (score === 2) return { label: 'Fair',   color: '#FFB300' };
    if (score === 3) return { label: 'Good',   color: '#08FFE2' };
    return               { label: 'Strong', color: '#00FF73' };
  })();

  const passwordsMatch  = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // ── Step 1: verify current password ──────────────────────────────────
  const handleVerifyCurrent = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user || !user.email) {
      Alert.alert('Error', 'Unable to identify the current user. Please log in again.');
      return;
    }
    setIsLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      setVerifiedCurrent(true);
    } catch (error) {
      const msg =
        error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
          ? 'Current password is incorrect. Please try again.'
          : error.code === 'auth/too-many-requests'
          ? 'Too many failed attempts. Please wait a moment and try again.'
          : error.code === 'auth/network-request-failed'
          ? 'Network error. Please check your connection.'
          : 'Verification failed. Please try again.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: update password ───────────────────────────────────────────
  const handleUpdatePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Too Short', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Same Password', 'New password must be different from your current password.');
      return;
    }
    setIsLoading(true);
    try {
      const auth = getAuth(app);
      await updatePassword(auth.currentUser, newPassword);
      Alert.alert(
        '✅ Password Updated',
        'Your password has been changed successfully.',
        [{ text: 'Done', onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar') }]
      );
    } catch (error) {
      const msg =
        error.code === 'auth/requires-recent-login'
          ? 'Session expired. Please go back, log out and log in again before changing your password.'
          : error.code === 'auth/weak-password'
          ? 'Password is too weak. Please choose a stronger password.'
          : 'Failed to update password. Please try again.';
      Alert.alert('Update Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!fontsLoaded) {
    return (
      <ImageBackground source={require('./assets/login_bg.png')} style={styles.background} blurRadius={10}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF06C8" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('./assets/login_bg.png')} style={styles.background} blurRadius={10}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['rgba(255,6,200,0.3)', 'rgba(255,6,200,0.1)']}
                style={styles.iconGradient}
              >
                <Ionicons name="key-outline" size={40} color="#FF06C8" />
              </LinearGradient>
            </View>

            <Text style={styles.heading}>Change Password</Text>
            <Text style={styles.description}>
              {verifiedCurrent
                ? 'Enter your new password below.'
                : 'First, verify your current password to continue.'}
            </Text>

            {/* ── Step indicator ── */}
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#FF06C8' }]} />
              <View style={[styles.stepLine, { backgroundColor: verifiedCurrent ? '#FF06C8' : '#333' }]} />
              <View style={[styles.stepDot, { backgroundColor: verifiedCurrent ? '#FF06C8' : '#333' }]} />
            </View>
            <View style={styles.stepLabelRow}>
              <Text style={[styles.stepLabel, { color: '#FF06C8' }]}>Verify</Text>
              <Text style={[styles.stepLabel, { color: verifiedCurrent ? '#FF06C8' : '#666' }]}>New Password</Text>
            </View>

            {/* ── STEP 1: Current password ── */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <View style={[styles.inputContainer, verifiedCurrent && styles.inputVerified]}>
                <Ionicons name="lock-closed-outline" size={20} color={verifiedCurrent ? '#00FF73' : '#8C7EBB'} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  placeholderTextColor="#888"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!verifiedCurrent && !isLoading}
                  returnKeyType="done"
                  onSubmitEditing={!verifiedCurrent ? handleVerifyCurrent : undefined}
                />
                {!verifiedCurrent ? (
                  <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8C7EBB" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color="#00FF73" />
                )}
              </View>
            </View>

            {/* Verify button — only shown before verification */}
            {!verifiedCurrent && (
              <TouchableOpacity
                onPress={handleVerifyCurrent}
                activeOpacity={0.8}
                disabled={isLoading}
                style={{ width: 300 }}
              >
                <LinearGradient
                  colors={['rgba(255,6,200,0.55)', 'rgba(191,46,240,0.35)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.buttonText}>Verify Current Password</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* ── STEP 2: New + Confirm — only after verification ── */}
            {verifiedCurrent && (
              <>
                {/* New password */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>New Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-open-outline" size={20} color="#8C7EBB" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
                      placeholderTextColor="#888"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNew}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                    />
                    <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                      <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8C7EBB" />
                    </TouchableOpacity>
                  </View>
                  {/* Strength indicator */}
                  {passwordStrength && (
                    <View style={styles.strengthRow}>
                      {[0, 1, 2, 3].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.strengthBar,
                            {
                              backgroundColor:
                                (passwordStrength.label === 'Weak'   && i < 1) ||
                                (passwordStrength.label === 'Fair'   && i < 2) ||
                                (passwordStrength.label === 'Good'   && i < 3) ||
                                (passwordStrength.label === 'Strong' && i < 4)
                                  ? passwordStrength.color
                                  : '#333',
                            },
                          ]}
                        />
                      ))}
                      <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Confirm password */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Confirm New Password</Text>
                  <View style={[
                    styles.inputContainer,
                    passwordsMatch  && styles.inputVerified,
                    passwordMismatch && styles.inputError,
                  ]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={passwordMismatch ? '#FF4757' : passwordsMatch ? '#00FF73' : '#8C7EBB'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#888"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleUpdatePassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                      <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8C7EBB" />
                    </TouchableOpacity>
                  </View>
                  {passwordMismatch && (
                    <Text style={styles.errorText}>Passwords do not match</Text>
                  )}
                  {passwordsMatch && (
                    <Text style={styles.successText}>✓ Passwords match</Text>
                  )}
                </View>

                {/* Update button */}
                <TouchableOpacity
                  onPress={handleUpdatePassword}
                  activeOpacity={0.8}
                  disabled={isLoading || !passwordsMatch || newPassword.length < MIN_PASSWORD_LENGTH}
                  style={{ width: 300 }}
                >
                  <LinearGradient
                    colors={['rgba(255,6,200,0.55)', 'rgba(191,46,240,0.35)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.button,
                      (isLoading || !passwordsMatch || newPassword.length < MIN_PASSWORD_LENGTH) && styles.buttonDisabled,
                    ]}
                  >
                    {isLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.buttonText}>Update Password</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 60,
    marginLeft: 30,
    position: 'absolute',
    zIndex: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#2D3335',
    backgroundColor: '#1A1D1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    marginTop: 120,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,6,200,0.3)',
  },
  heading: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#BDBDBD',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLine: {
    width: 80,
    height: 2,
    marginHorizontal: 6,
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 116,
    marginBottom: 28,
  },
  stepLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
  },
  // Input
  fieldBlock: {
    width: 300,
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#BDBDBD',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: 'rgba(52,42,66,0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    paddingHorizontal: 12,
  },
  inputVerified: {
    borderColor: '#00FF73',
    backgroundColor: 'rgba(0,255,115,0.05)',
  },
  inputError: {
    borderColor: '#FF4757',
    backgroundColor: 'rgba(255,71,87,0.05)',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 4,
  },
  // Strength bar
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    marginLeft: 6,
    width: 44,
  },
  // Feedback text
  errorText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#FF4757',
    marginTop: 5,
  },
  successText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#00FF73',
    marginTop: 5,
  },
  // Button
  button: {
    height: 50,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,6,200,0.4)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
