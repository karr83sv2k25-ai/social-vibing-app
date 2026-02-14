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
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { app } from './firebaseConfig';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  // Cooldown timer effect
  React.useEffect(() => {
    let timer;
    if (cooldownSeconds > 0) {
      timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  if (!fontsLoaded) return null;

  const validateEmail = (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(text === '' || emailRegex.test(text));
    setEmail(text.toLowerCase().trim());
  };

  const handleResetPassword = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (cooldownSeconds > 0) {
      Alert.alert(
        'Please Wait',
        `You can request another reset email in ${cooldownSeconds} seconds.`
      );
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Sending password reset email to:', email);
      const auth = getAuth(app);

      await sendPasswordResetEmail(auth, email, {
        // Customize the email action link settings
        url: 'https://social-vibing-app.web.app/login', // Redirect URL after reset
        handleCodeInApp: false, // Handle in web, not in app
      });

      console.log('✅ Password reset email sent successfully');
      setEmailSent(true);
      setCooldownSeconds(60); // 60-second cooldown before resending

      Alert.alert(
        '📧 Email Sent!',
        `We've sent a password reset link to ${email}. Please check your inbox and spam folder.`,
        [
          {
            text: 'Back to Login',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('❌ Password reset error:', error);

      let errorMessage = 'An error occurred. Please try again.';
      let errorTitle = 'Reset Failed';

      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'The email address is not valid.';
          break;
        case 'auth/user-not-found':
          // For security, don't reveal if email exists or not
          // Instead, show a generic success-like message
          setEmailSent(true);
          setCooldownSeconds(60);
          Alert.alert(
            '📧 Check Your Email',
            `If an account exists for ${email}, you will receive a password reset link shortly.`,
            [{ text: 'OK' }]
          );
          setIsLoading(false);
          return;
        case 'auth/too-many-requests':
          errorTitle = 'Too Many Requests';
          errorMessage =
            'Too many password reset attempts. Please wait a few minutes before trying again.';
          setCooldownSeconds(120);
          break;
        case 'auth/network-request-failed':
          errorTitle = 'Network Error';
          errorMessage =
            'Unable to connect to the server. Please check your internet connection.';
          break;
        default:
          errorMessage = error.message || 'An unexpected error occurred.';
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleResendEmail = () => {
    if (cooldownSeconds === 0) {
      handleResetPassword();
    }
  };

  return (
    <ImageBackground
      source={require('./assets/login_bg.png')}
      style={styles.background}
      blurRadius={10}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

      {/* 🔙 Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            {/* 🔐 Lock Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.3)', 'rgba(255, 6, 200, 0.1)']}
                style={styles.iconGradient}>
                <Ionicons name="lock-closed-outline" size={40} color="#FF06C8" />
              </LinearGradient>
            </View>

            {/* 🧾 Heading */}
            <Text style={styles.heading}>Forgot Password?</Text>

            {/* 📝 Description */}
            <Text style={styles.description}>
              {emailSent
                ? `We've sent a password reset link to your email. Check your inbox and follow the instructions.`
                : `No worries! Enter your email address below and we'll send you a link to reset your password.`}
            </Text>

            {/* 📧 Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={!isValidEmail && email ? '#FF6B6B' : '#8C7EBB'}
                style={styles.inputIcon}
              />
              <TextInput
                style={[
                  styles.input,
                  !isValidEmail && email && styles.invalidInput,
                ]}
                placeholder="Enter your email address"
                placeholderTextColor="#BDBDBD"
                value={email}
                onChangeText={validateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!isLoading}
                returnKeyType="send"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            {/* ⚠️ Email validation error */}
            {!isValidEmail && email ? (
              <Text style={styles.errorText}>
                Please enter a valid email address
              </Text>
            ) : null}

            {/* 🚀 Send Reset Link Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
              activeOpacity={0.8}
              disabled={isLoading || cooldownSeconds > 0}>
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.button,
                  (isLoading || cooldownSeconds > 0) && styles.buttonDisabled,
                ]}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : cooldownSeconds > 0 ? (
                  <Text style={styles.buttonText}>
                    Resend in {cooldownSeconds}s
                  </Text>
                ) : emailSent ? (
                  <Text style={styles.buttonText}>Resend Link</Text>
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* 🔗 Back to Login Link */}
            <TouchableOpacity
              style={styles.backToLogin}
              onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={16} color="#FF06C8" />
              <Text style={styles.backToLoginText}>Back to Login</Text>
            </TouchableOpacity>

            {/* 💡 Help Tips */}
            {emailSent && (
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Didn't receive the email?</Text>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#8C7EBB" />
                  <Text style={styles.tipText}>Check your spam/junk folder</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#8C7EBB" />
                  <Text style={styles.tipText}>
                    Make sure you entered the correct email
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#8C7EBB" />
                  <Text style={styles.tipText}>
                    Wait a few minutes and try again
                  </Text>
                </View>
              </View>
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

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    marginTop: 140,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  iconContainer: {
    marginBottom: 24,
  },

  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 6, 200, 0.3)',
  },

  heading: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },

  description: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#BDBDBD',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 22,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 300,
    height: 50,
    backgroundColor: 'rgba(52,42,66,0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    height: '100%',
    color: '#fff',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
  },

  invalidInput: {
    borderColor: '#FF6B6B',
  },

  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    alignSelf: 'flex-start',
    marginLeft: 38,
    marginBottom: 15,
  },

  button: {
    width: 300,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF06C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FF1468',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 9.9,
    elevation: 8,
  },

  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    fontWeight: 'bold',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    gap: 6,
  },

  backToLoginText: {
    color: '#FF06C8',
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
  },

  tipsContainer: {
    marginTop: 40,
    padding: 20,
    backgroundColor: 'rgba(52,42,66,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(140, 126, 187, 0.3)',
    width: 300,
  },

  tipsTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 15,
  },

  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },

  tipText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#BDBDBD',
    flex: 1,
  },
});
