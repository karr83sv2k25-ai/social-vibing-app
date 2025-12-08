import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Alert,
  ActivityIndicator,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app, db } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  useEffect(() => {
    // Check network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  if (!fontsLoaded) return null;

  const validateEmail = (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(text));
    setEmail(text);
  };

  // Firebase authentication login
  const handleLogin = async () => {
    // Check network connectivity first
    if (!isConnected) {
      Alert.alert(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Input validation
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isValidEmail) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Attempting login...');
      console.log('📧 Email:', email);
      console.log('🌐 Network connected:', isConnected);
      
      const auth = getAuth(app);
      console.log('✅ Got auth instance');
      
      // Try login with shorter timeout (20 seconds)
      console.log('📡 Calling signInWithEmailAndPassword...');
      const loginPromise = signInWithEmailAndPassword(auth, email, password);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout - server not responding')), 20000)
      );
      
      const userCredential = await Promise.race([loginPromise, timeoutPromise]);
      const user = userCredential.user;
      
      console.log('✅ Login successful for user:', user.uid);
      
      // Verify user document exists in Firestore, create/update if missing or incomplete
      // IMPORTANT: Preserve all existing website user data
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          console.log('📝 User document not found, creating complete user profile for migrated user...');
          // Create complete user document with all required fields for old/migrated users
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName || email.split('@')[0],
            firstName: user.displayName?.split(' ')[0] || email.split('@')[0],
            lastName: user.displayName?.split(' ')[1] || '',
            profileImage: user.photoURL || '',
            phoneNumber: user.phoneNumber || '',
            createdAt: user.metadata?.creationTime || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            // Social stats - initialize for old users
            followers: 0,
            following: 0,
            friends: 0,
            visits: 0,
            // Profile defaults
            bio: '',
            username: email.split('@')[0],
            characterCollection: [],
            interests: [],
            // Migration flag to track old users
            migratedFromWeb: true,
            migrationDate: new Date().toISOString(),
          });
          console.log('✅ Complete user document created for migrated user');
        } else {
          console.log('✅ User document exists, preserving existing data and adding only missing fields...');
          const userData = userSnap.data();
          const updates = {};
          
          // PRESERVE EXISTING DATA - Only add missing required fields
          // Never overwrite existing user data from website
          if (userData.firstName === undefined || userData.firstName === null || userData.firstName === '') {
            updates.firstName = user.displayName?.split(' ')[0] || email.split('@')[0];
          }
          if (userData.lastName === undefined || userData.lastName === null || userData.lastName === '') {
            updates.lastName = user.displayName?.split(' ')[1] || '';
          }
          if (userData.username === undefined || userData.username === null || userData.username === '') {
            updates.username = email.split('@')[0];
          }
          if (userData.followers === undefined || userData.followers === null) {
            updates.followers = 0;
          }
          if (userData.following === undefined || userData.following === null) {
            updates.following = 0;
          }
          if (userData.friends === undefined || userData.friends === null) {
            updates.friends = 0;
          }
          if (userData.visits === undefined || userData.visits === null) {
            updates.visits = 0;
          }
          if (userData.bio === undefined || userData.bio === null) {
            updates.bio = '';
          }
          if (userData.profileImage === undefined || userData.profileImage === null) {
            updates.profileImage = '';
          }
          if (userData.characterCollection === undefined || userData.characterCollection === null) {
            updates.characterCollection = [];
          }
          if (userData.interests === undefined || userData.interests === null) {
            updates.interests = [];
          }
          if (userData.displayName === undefined || userData.displayName === null) {
            updates.displayName = user.displayName || email.split('@')[0];
          }
          if (userData.email === undefined || userData.email === null) {
            updates.email = user.email;
          }
          
          // Always update last login to track mobile app usage
          updates.lastLogin = new Date().toISOString();
          
          if (Object.keys(updates).length > 1) { // More than just lastLogin
            console.log('📝 Adding missing fields while preserving existing data:', Object.keys(updates));
            await updateDoc(userRef, updates);
            console.log('✅ User document updated - all existing website data preserved');
          } else {
            // Just update last login
            await updateDoc(userRef, { lastLogin: new Date().toISOString() });
            console.log('✅ User document complete - all existing website data preserved');
          }
        }
      } catch (firestoreError) {
        console.warn('⚠️  Firestore check failed, but auth succeeded:', firestoreError);
        // Don't block login if Firestore is having issues
      }
      
      // Clear inputs
      setEmail('');
      setPassword('');
      
      // Navigate to TabBar (bottom tabs) on successful login
      console.log('🚀 Navigating to TabBar...');
      navigation.replace('TabBar');
    } catch (error) {
      console.error('❌ Login Error:', error);
      
      // Show user-friendly error messages
      let errorMessage = 'An error occurred during login';
      let errorTitle = 'Login Failed';
      
      if (error.message && error.message.includes('Login timeout')) {
        errorTitle = 'Connection Timeout';
        errorMessage = 'Firebase Authentication is not responding. This usually means:\n\n• Network/Firewall blocking Firebase\n• DNS resolution issues\n• Try using mobile data instead of WiFi\n• Contact your network administrator';
      } else {
        switch (error.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled';
            break;
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password';
            break;
          case 'auth/network-request-failed':
            errorTitle = 'Network Error';
            errorMessage = 'Unable to connect to authentication server. Please check:\n\n• Your internet connection\n• WiFi/mobile data is enabled\n• Firewall settings\n\nThen try again.';
            break;
          case 'auth/too-many-requests':
            errorTitle = 'Too Many Attempts';
            errorMessage = 'Too many failed login attempts. Please wait a few minutes and try again.';
            break;
          default:
            errorMessage = error.message || 'An error occurred during login';
        }
      }
      
      Alert.alert(errorTitle, errorMessage, [
        { text: 'OK' },
        error.code === 'auth/network-request-failed' && {
          text: 'Check Connection',
          onPress: async () => {
            const state = await NetInfo.fetch();
            Alert.alert(
              'Connection Status',
              `Connected: ${state.isConnected}\nInternet: ${state.isInternetReachable}\nType: ${state.type}`
            );
          }
        }
      ].filter(Boolean));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
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

      <View style={styles.container}>
        {/* 🧾 Heading */}
        <Text style={styles.heading}>Login</Text>

        {/* Network Status Indicator */}
        {!isConnected && (
          <View style={styles.networkWarning}>
            <Ionicons name="cloud-offline" size={20} color="#FF6B6B" />
            <Text style={styles.networkWarningText}>No Internet Connection</Text>
          </View>
        )}

        {/* 📧 Email */}
        <TextInput
          style={[styles.input, !isValidEmail && email && styles.invalidInput]}
          placeholder="Email"
          placeholderTextColor="#BDBDBD"
          value={email}
          onChangeText={validateEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* 🔒 Password */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor="#BDBDBD"
            secureTextEntry={hidePassword}
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            onPress={() => setHidePassword(!hidePassword)}
            style={styles.iconButton}>
            <Ionicons
              name={hidePassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#FF06C8"
            />
          </TouchableOpacity>
        </View>

        {/* 🔗 Forgot Password */}
        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* 🚀 Login Button */}
        <TouchableOpacity 
          onPress={handleLogin} 
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.button, isLoading && styles.buttonDisabled]}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: 'cover' },

  header: {
    marginTop: 60,
    marginLeft: 30,
    position: 'absolute',
    zIndex: 10,
  },

  invalidInput: {
    borderColor: '#FF0000',
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
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
  },

  input: {
    width: 300,
    height: 50,
    backgroundColor: 'rgba(52,42,66,0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    paddingHorizontal: 15,
    color: '#fff',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    marginBottom: 15,
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 300,
    height: 50,
    backgroundColor: 'rgba(52,42,66,0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  passwordInput: {
    flex: 1,
    borderWidth: 0,
    marginBottom: 0,
  },

  iconButton: {
    paddingHorizontal: 10,
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    width: 300,
    paddingHorizontal: 5,
    marginBottom: 25,
  },

  forgotText: {
    color: '#FF06C8',
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    textAlign: 'right',
  },

  button: {
    width: 300,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF06C8',
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

  buttonDisabled: {
    opacity: 0.6,
  },

  networkWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },

  networkWarningText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
  },
});


