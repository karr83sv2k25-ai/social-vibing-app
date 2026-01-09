import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  ImageBackground,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import PhoneInput from 'react-native-phone-number-input';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';
import { app, db } from './firebaseConfig';

export default function WithEmailScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Validation states
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [isValidPhone, setIsValidPhone] = useState(true);
  const [isStrongPassword, setIsStrongPassword] = useState(true);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  const phoneInput = useRef(null);

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) return null;

  // Validation functions
  const validateEmail = (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(text));
    setEmail(text);
  };

  const validatePassword = (text) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    setIsStrongPassword(passwordRegex.test(text));
    setPassword(text);
    if (confirmPassword) {
      setPasswordsMatch(text === confirmPassword);
    }
  };

  const validateConfirmPassword = (text) => {
    setConfirmPassword(text);
    setPasswordsMatch(text === password);
  };

  const handleSignup = async () => {
    // Validate all fields
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    if (!isValidEmail) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!phoneInput.current?.isValidNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    if (!isStrongPassword) {
      Alert.alert('Error', 'Password must be at least 8 characters with uppercase, lowercase, number and special character');
      return;
    }

    if (!passwordsMatch) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      const auth = getAuth(app);
      // db is now imported globally

      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Save additional user info to Firestore
      const userData = {
        firstName,
        lastName,
        email,
        phoneNumber: phoneInput.current?.getCallingCode() + phoneNumber,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

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
          onPress: () => navigation.replace('TabBar')
        }
      ]);
    } catch (error) {
      console.error('Signup Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleBack = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    } else {
      Alert.alert('Back pressed');
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
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
              onChangeText={setFirstName}
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
              onChangeText={setLastName}
            />
          </LinearGradient>

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
              onChangeFormattedText={text => {
                setPhoneNumber(text);
                setIsValidPhone(phoneInput.current?.isValidNumber(text));
              }}
              withDarkTheme
              autoFocus={false}
            />
          </LinearGradient>

          {/* Password Input */}
          <LinearGradient
            colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.inputContainer, !isStrongPassword && password && styles.invalidInput]}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#BDBDBD"
              secureTextEntry
              value={password}
              onChangeText={validatePassword}
            />
          </LinearGradient>

          {/* Confirm Password Input */}
          <LinearGradient
            colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.inputContainer, !passwordsMatch && confirmPassword && styles.invalidInput]}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#BDBDBD"
              secureTextEntry
              value={confirmPassword}
              onChangeText={validateConfirmPassword}
            />
          </LinearGradient>

          {/* Password Requirements */}
          {password && !isStrongPassword && (
            <Text style={styles.requirementText}>
              Password must contain at least 8 characters, including uppercase, lowercase, number and special character
            </Text>
          )}

          {/* Terms Text */}
          <Text style={styles.termsText}>
            By signing up, you agree to our{' '}
            <Text style={styles.linkText}>Terms of Service</Text> and{' '}
            <Text style={styles.linkText}>Privacy Policy</Text>.
          </Text>

          {/* Sign Up Button */}
          <TouchableOpacity onPress={handleSignup} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}>
              <Text style={styles.buttonText}>Create Account</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

// 🎨 STYLES
const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: 'cover' },

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

  input: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Manrope_400Regular',
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
    color: '#FF0000',
    textAlign: 'center',
    width: 300,
    marginBottom: 20,
  },

  termsText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10,
    color: '#BDBDBD',
    textAlign: 'center',
    width: 300,
    marginBottom: 30,
  },

  linkText: { color: '#BF2EF0', textDecorationLine: 'underline' },

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

  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

