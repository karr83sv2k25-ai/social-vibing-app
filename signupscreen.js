import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ImageBackground,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, deleteUser } from 'firebase/auth';
import { setDoc, doc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import PhoneInput from 'react-native-phone-number-input';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';
import { app, db } from './firebaseConfig';

const USERNAME_REGEX = /^[a-z0-9._-]{3,20}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

// Input sanitization functions
const sanitizeInput = (text) => {
  if (!text) return '';
  return text
    .trim()
    .replace(/[<>"'`]/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

const sanitizeUsername = (text) => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, ''); // Only allow valid username characters
};

export default function WithEmailScreen({ navigation }) {
  // All hooks must be called before any conditional returns
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Validation states
  const [usernameError, setUsernameError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [isValidPhone, setIsValidPhone] = useState(true);
  const [isStrongPassword, setIsStrongPassword] = useState(true);
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: '' });

  const phoneInput = useRef(null);
  const emailValidationTimeout = useRef(null);
  const usernameValidationTimeout = useRef(null);

  const [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (emailValidationTimeout.current) clearTimeout(emailValidationTimeout.current);
      if (usernameValidationTimeout.current) clearTimeout(usernameValidationTimeout.current);
    };
  }, []);

  // Enhanced password strength validation
  const checkPasswordStrength = useCallback((password) => {
    if (!password) {
      setPasswordStrength({ score: 0, message: '' });
      return false;
    }

    let score = 0;
    let message = '';

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character type checks
    if (/[a-z]/.test(password)) score++; // lowercase
    if (/[A-Z]/.test(password)) score++; // uppercase
    if (/\d/.test(password)) score++; // numbers
    if (/[@$!%*?&#]/.test(password)) score++; // special characters

    // Set strength message
    if (score <= 2) {
      message = 'Weak - Add uppercase, numbers, and special characters';
      setPasswordStrength({ score, message, color: '#FF0000' });
      return false;
    } else if (score <= 4) {
      message = 'Medium - Consider adding more character types';
      setPasswordStrength({ score, message, color: '#FFA500' });
      return true;
    } else {
      message = 'Strong password';
      setPasswordStrength({ score, message, color: '#00FF00' });
      return true;
    }
  }, []);

  // Validation functions with real-time feedback and debouncing
  const validateEmail = async (text) => {
    setEmail(text);

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(text);

    if (!isValidFormat) {
      setIsValidEmail(false);
      return;
    }

    try {
      const [localPart, domain] = text.split('@');

      // Additional email validations
      if (localPart.length > 64) {
        setIsValidEmail(false);
        return;
      }

      if (domain.length > 255) {
        setIsValidEmail(false);
        return;
      }

      if (text.length > 254) {
        setIsValidEmail(false);
        return;
      }

      // Check if domain has valid DNS records
      if (!domain.includes('.')) {
        setIsValidEmail(false);
        return;
      }

      // Check if email already exists in Firebase
      if (text.length > 0) {
        const auth = getAuth(app);
        try {
          const methods = await fetchSignInMethodsForEmail(auth, text);
          if (methods && methods.length > 0) {
            setIsValidEmail(false);
            Alert.alert('Email Already Exists', 'This email address is already registered. Please use a different email or try logging in.');
            return;
          }
        } catch (error) {
          console.log('Email check error:', error);
          // Don't set invalid here as the error might be network-related
        }
      }

      setIsValidEmail(true);
    } catch (error) {
      setIsValidEmail(false);
    }
  };

  const validatePhoneInRealTime = (text) => {
    // Update phone number state
    setPhoneNumber(text);

    if (!text.trim()) {
      setIsValidPhone(false);
      return;
    }

    try {
      if (phoneInput.current) {
        const checkValid = phoneInput.current.isValidNumber(text);
        setIsValidPhone(checkValid);

        // Additional phone number validations
        if (checkValid) {
          const countryCode = phoneInput.current.getCallingCode();
          const numberWithoutCode = text.replace(`+${countryCode}`, '');

          // Check minimum length (usually 10 digits)
          if (numberWithoutCode.length < 10) {
            setIsValidPhone(false);
            return;
          }

          // Check maximum length (usually 15 digits)
          if (numberWithoutCode.length > 15) {
            setIsValidPhone(false);
            return;
          }

          // Check if number contains only digits
          if (!/^\+?[\d\s-]+$/.test(text)) {
            setIsValidPhone(false);
            return;
          }
        }
      }
    } catch (error) {
      setIsValidPhone(false);
    }
  };

  // Sanitized name handlers
  const handleFirstNameChange = useCallback((text) => {
    const sanitized = sanitizeInput(text);
    setFirstName(sanitized);
  }, []);

  const handleLastNameChange = useCallback((text) => {
    const sanitized = sanitizeInput(text);
    setLastName(sanitized);
  }, []);

  const validatePassword = useCallback((text) => {
    setPassword(text);
    const isStrong = checkPasswordStrength(text);
    setIsStrongPassword(isStrong && text.length >= 8);
    if (confirmPassword) {
      setPasswordsMatch(text === confirmPassword);
    }
  }, [confirmPassword, checkPasswordStrength]);

  const validateConfirmPassword = (text) => {
    setConfirmPassword(text);
    setPasswordsMatch(text === password);
  };

  const handleUsernameChange = useCallback((text) => {
    const sanitized = sanitizeUsername(text);
    setUsername(sanitized);
    if (usernameError) {
      setUsernameError('');
    }
    if (usernameAvailable) {
      setUsernameAvailable(false);
    }
  }, [usernameError, usernameAvailable]);

  const handleUsernameBlur = useCallback(async () => {
    // Clear previous timeout
    if (usernameValidationTimeout.current) {
      clearTimeout(usernameValidationTimeout.current);
    }

    const normalized = sanitizeUsername(username);
    setUsername(normalized);

    if (!normalized) {
      setUsernameError('Username is required');
      setUsernameAvailable(false);
      return;
    }

    if (!USERNAME_REGEX.test(normalized)) {
      setUsernameError('Username must be 3-20 characters (lowercase letters, numbers, ., -, _)');
      setUsernameAvailable(false);
      return;
    }

    // Debounce username check
    usernameValidationTimeout.current = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const usernameDocRef = doc(db, 'usernames', normalized);
        const usernameSnap = await getDoc(usernameDocRef);
        if (usernameSnap.exists()) {
          setUsernameError('Username already taken - please choose another');
          setUsernameAvailable(false);
        } else {
          setUsernameError('');
          setUsernameAvailable(true);
        }
      } catch (error) {
        console.error('Username check error:', error);
        setUsernameError('Unable to verify username. Please check your connection.');
        setUsernameAvailable(false);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500); // Wait 500ms after blur
  }, [username]);

  const handleSignup = async () => {
    if (isSubmitting || isCheckingUsername) {
      return;
    }

    // Sanitize and validate all fields
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedLastName = sanitizeInput(lastName);
    const normalizedUsername = sanitizeUsername(username);
    const sanitizedEmail = email.trim().toLowerCase();

    if (!sanitizedFirstName || !sanitizedLastName) {
      Alert.alert('Invalid Input', 'Please enter your full name');
      return;
    }

    if (!normalizedUsername) {
      const message = 'Please choose a username';
      setUsernameError(message);
      Alert.alert('Invalid Input', message);
      return;
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      const message = 'Username must be 3-20 characters (lowercase letters, numbers, ., -, _)';
      setUsernameError(message);
      Alert.alert('Invalid Username', message);
      return;
    }

    if (!isValidEmail || !sanitizedEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (!phoneInput.current?.isValidNumber(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    if (!isStrongPassword || password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character for better security.');
      return;
    }

    if (!passwordsMatch) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    let userCredential = null;
    let userDocCreated = false;

    try {
      const auth = getAuth(app);

      // Step 1: Create Firebase Auth user
      console.log('Creating Firebase Auth user...');
      userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
      const userId = userCredential.user.uid;
      console.log('✅ Firebase Auth user created:', userId);

      // Step 2: Use Firestore transaction to atomically reserve username and create user doc
      console.log('Starting atomic transaction for username reservation...');
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, 'usernames', normalizedUsername);
        const userRef = doc(db, 'users', userId);

        // Check if username is available (inside transaction for atomicity)
        const usernameDoc = await transaction.get(usernameRef);
        if (usernameDoc.exists()) {
          throw new Error('USERNAME_TAKEN');
        }

        // Reserve the username
        transaction.set(usernameRef, {
          ownerId: userId,
          createdAt: new Date().toISOString(),
        });

        // Create user document
        const userData = {
          firstName: sanitizedFirstName,
          lastName: sanitizedLastName,
          email: sanitizedEmail,
          phoneNumber: phoneInput.current?.getCallingCode() + phoneNumber,
          createdAt: new Date().toISOString(),
          // initialize social stats
          followers: 0,
          following: 0,
          friends: 0,
          visits: 0,
          // profile defaults
          bio: '',
          username: normalizedUsername,
          profileImage: '',
          uid: userId,
          role: 'member',
          isAdmin: false,
          isVerified: false,
          verificationStatus: null,
          isBanned: false,
          banType: null,
          banReason: null,
          bannedAt: null,
          banExpiresAt: null,
          bannedBy: null,
          isSuspended: false,
          suspendedReason: null,
          suspendedAt: null,
          suspendedBy: null,
          warningsCount: 0,
          accountStatus: 'active',
          reportsReceived: 0,
        };
        transaction.set(userRef, userData);

        userDocCreated = true;
      });

      console.log('✅ Transaction completed - username reserved and user created');

      // Save authentication state to AsyncStorage for persistent login
      try {
        await AsyncStorage.setItem('userLoggedIn', 'true');
        await AsyncStorage.setItem('userEmail', userCredential.user.email);
        console.log('💾 Login state saved after account creation');
      } catch (storageError) {
        console.warn('⚠️  Failed to save login state:', storageError);
      }

      Alert.alert('Success', 'Account created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate to Splash screen with reset to prevent going back
            navigation.reset({
              index: 0,
              routes: [{ name: 'Splash' }],
            });
          }
        }
      ]);
    } catch (error) {
      console.error('Signup Error:', error);

      // Comprehensive error cleanup
      if (userCredential) {
        console.log('⚠️  Signup failed, cleaning up...');
        try {
          // Delete username reservation if it was created
          if (error.message === 'USERNAME_TAKEN') {
            setUsernameError('Username already taken - please choose another');
            setUsernameAvailable(false);
            Alert.alert('Username Taken', 'This username was just taken by another user. Please choose a different username.');
          } else {
            // Clean up user document if it exists
            if (userDocCreated) {
              await deleteDoc(doc(db, 'users', userCredential.user.uid));
              console.log('✅ User document deleted');
            }
            // Clean up username reservation if it exists
            try {
              await deleteDoc(doc(db, 'usernames', normalizedUsername));
              console.log('✅ Username reservation deleted');
            } catch (usernameDeleteError) {
              console.log('No username to delete or already deleted');
            }
          }

          // Delete Firebase Auth user
          await deleteUser(userCredential.user);
          console.log('✅ Firebase Auth user deleted');
        } catch (cleanupError) {
          console.error('❌ Cleanup error:', cleanupError);
          Alert.alert(
            'Account Cleanup Failed',
            'There was an issue cleaning up the partial account. Please contact support if you experience login issues.',
            [{ text: 'OK' }]
          );
        }
      }

      // Show user-friendly error message
      let errorMessage = 'An error occurred during signup';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please try logging in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message !== 'USERNAME_TAKEN') {
        errorMessage = error.message || errorMessage;
      }

      if (error.message !== 'USERNAME_TAKEN') {
        Alert.alert('Signup Failed', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    } else {
      Alert.alert('Back pressed');
    }
  };

  // Show loading indicator while fonts are loading
  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.background}>
          <ImageBackground
            source={require('./assets/login_bg.png')}
            style={styles.background}
            blurRadius={10}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF06C8" />
            </View>
          </ImageBackground>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.background}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.background}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.background}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
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

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.container}>
                    <Text style={styles.heading}>Create Account</Text>
                    <Text style={styles.subText}>Please fill in your details</Text>

                    {/* First Name Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="First Name"
                        placeholderTextColor="#BDBDBD"
                        value={firstName}
                        onChangeText={handleFirstNameChange}
                        autoCapitalize="words"
                      />
                    </LinearGradient>

                    {/* Last Name Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="Last Name"
                        placeholderTextColor="#BDBDBD"
                        value={lastName}
                        onChangeText={handleLastNameChange}
                        autoCapitalize="words"
                      />
                    </LinearGradient>

                    {/* Username Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.inputContainer,
                        usernameError && styles.invalidInput,
                        usernameAvailable && !usernameError && styles.validInput
                      ]}>
                      <View style={styles.usernameRow}>
                        <TextInput
                          style={[styles.input, styles.usernameInputField]}
                          placeholder="Username"
                          placeholderTextColor="#BDBDBD"
                          value={username}
                          onChangeText={handleUsernameChange}
                          onBlur={handleUsernameBlur}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {isCheckingUsername && (
                          <View style={styles.usernameStatusIcon}>
                            <Text style={styles.statusText}>⏳</Text>
                          </View>
                        )}
                        {!isCheckingUsername && usernameAvailable && (
                          <View style={styles.usernameStatusIcon}>
                            <Ionicons name="checkmark-circle" size={20} color="#00FF00" />
                          </View>
                        )}
                        {!isCheckingUsername && usernameError && (
                          <View style={styles.usernameStatusIcon}>
                            <Ionicons name="close-circle" size={20} color="#FF0000" />
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                    {isCheckingUsername ? (
                      <Text style={styles.validationHelperText}>Checking username availability...</Text>
                    ) : usernameAvailable && !usernameError ? (
                      <Text style={styles.validationSuccessText}>✓ Username is available!</Text>
                    ) : (
                      usernameError ? (
                        <Text style={styles.validationText}>{usernameError}</Text>
                      ) : null
                    )}

                    {/* Email Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.inputContainer, !isValidEmail && email && styles.invalidInput]}>
                      <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#BDBDBD"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={validateEmail}
                        autoCapitalize="none"
                      />
                    </LinearGradient>
                    {email && !isValidEmail && (
                      <Text style={styles.validationText}>
                        Please enter a valid email address
                      </Text>
                    )}

                    {/* Phone Number Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inputContainer}>
                      <PhoneInput
                        ref={phoneInput}
                        value={phoneNumber}
                        defaultCode="US"
                        layout="first"
                        containerStyle={styles.phoneContainer}
                        textContainerStyle={styles.phoneTextContainer}
                        textInputStyle={styles.phoneTextInput}
                        codeTextStyle={styles.phoneCodeText}
                        placeholder="Enter phone number"
                        textInputProps={{
                          placeholderTextColor: '#BDBDBD',
                        }}
                        flagButtonStyle={styles.flagButton}
                        countryPickerButtonStyle={styles.countryButton}
                        onChangeFormattedText={validatePhoneInRealTime}
                        withDarkTheme
                        autoFocus={false}
                      />
                    </LinearGradient>
                    {phoneNumber && !isValidPhone && (
                      <Text style={styles.validationText}>
                        Please enter a valid phone number
                      </Text>
                    )}

                    {/* Password Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.inputContainer, !isStrongPassword && password && styles.invalidInput]}>
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, styles.passwordInputField]}
                          placeholder="Password"
                          placeholderTextColor="#BDBDBD"
                          secureTextEntry={!showPassword}
                          value={password}
                          onChangeText={validatePassword}
                          contextMenuHidden={false}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeIconButton}>
                          <Ionicons
                            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#FF06C8"
                          />
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>

                    {/* Confirm Password Input */}
                    <LinearGradient
                      colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.inputContainer, !passwordsMatch && confirmPassword && styles.invalidInput]}>
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, styles.passwordInputField]}
                          placeholder="Confirm Password"
                          placeholderTextColor="#BDBDBD"
                          secureTextEntry={!showConfirmPassword}
                          value={confirmPassword}
                          onChangeText={validateConfirmPassword}
                          contextMenuHidden={false}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={styles.eyeIconButton}>
                          <Ionicons
                            name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#FF06C8"
                          />
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>

                    {/* Password Strength Indicator */}
                    {password && passwordStrength.message && (
                      <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                        {passwordStrength.message}
                      </Text>
                    )}

                    {/* Password Requirements Helper */}
                    {password && !isStrongPassword && (
                      <Text style={styles.requirementText}>
                        💡 Include: uppercase, lowercase, number, special character (@$!%*?&#)
                      </Text>
                    )}

                    {/* Password Match Feedback */}
                    {confirmPassword && !passwordsMatch && (
                      <Text style={styles.validationText}>
                        Passwords do not match
                      </Text>
                    )}

                    {/* Terms Text */}
                    <Text style={styles.termsText}>
                      By signing up, you agree to our{' '}
                      <Text style={styles.linkText}>Terms of Service</Text> and{' '}
                      <Text style={styles.linkText}>Privacy Policy</Text>.
                    </Text>

                    {/* Sign Up Button */}
                    <TouchableOpacity
                      onPress={handleSignup}
                      activeOpacity={0.8}
                      disabled={isSubmitting || isCheckingUsername}
                    >
                      <LinearGradient
                        colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.button, (isSubmitting || isCheckingUsername) && styles.buttonDisabled]}>
                        <Text style={styles.buttonText}>
                          {isSubmitting ? 'Creating...' : 'Create Account'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </ImageBackground>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover'
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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

  container: {
    flex: 1,
    marginTop: 120,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  heading: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },

  subText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 30,
  },

  inputContainer: {
    width: 300,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    padding: 2,
    marginBottom: 20,
  },

  invalidInput: {
    borderColor: '#FF0000',
  },

  validInput: {
    borderColor: '#00FF00',
  },

  input: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Manrope_400Regular',
  },

  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderRadius: 6,
  },

  passwordInputField: {
    paddingRight: 45,
  },

  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderRadius: 6,
  },

  usernameInputField: {
    paddingRight: 45,
  },

  usernameStatusIcon: {
    position: 'absolute',
    right: 15,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  statusText: {
    fontSize: 16,
  },

  eyeIconButton: {
    position: 'absolute',
    right: 15,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  phoneContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },

  phoneTextContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    height: '100%',
  },

  phoneTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
    height: '100%',
    paddingLeft: 10,
  },

  phoneCodeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
  },

  flagButton: {
    width: 50,
    height: '100%',
    backgroundColor: 'transparent',
  },

  countryButton: {
    width: 50,
    height: '100%',
    marginRight: 5,
    backgroundColor: 'transparent',
  },

  requirementText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#FFA500',
    textAlign: 'center',
    width: 300,
    marginTop: -15,
    marginBottom: 15,
  },

  passwordStrengthText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    textAlign: 'left',
    width: 300,
    marginTop: -15,
    marginBottom: 10,
    fontWeight: '600',
  },

  validationText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#FF0000',
    textAlign: 'left',
    width: 300,
    marginTop: -15,
    marginBottom: 15,
  },

  validationHelperText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#BDBDBD',
    textAlign: 'left',
    width: 300,
    marginTop: -15,
    marginBottom: 15,
  },

  validationSuccessText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#00FF00',
    textAlign: 'left',
    width: 300,
    marginTop: -15,
    marginBottom: 15,
  },

  termsText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10,
    color: '#BDBDBD',
    textAlign: 'center',
    width: 300,
    marginBottom: 30,
  },

  linkText: {
    color: '#BF2EF0',
    textDecorationLine: 'underline'
  },

  button: {
    width: 300,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF06C8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF1468',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 9.9,
    elevation: 8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
