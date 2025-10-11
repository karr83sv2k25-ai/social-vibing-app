import React, { useState } from 'react';
import {
  StyleSheet,
  ImageBackground,
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import AppLoading from 'expo-app-loading';

export default function WithEmailScreen({ navigation }) {
  const [email, setEmail] = useState('');

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  const handleSendOtp = () => {
    if (!email.trim()) {
      alert('Please enter your email address');
    } else {
      alert(`OTP sent to: ${email}`);
    }
  };

  const handleBack = () => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    } else {
      alert('Back pressed');
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

      <View style={styles.container}>
        {/* Heading */}
        <Text style={styles.heading}>Email</Text>

        {/* Subtext */}
        <Text style={styles.subText}>Please enter your email address</Text>

        {/* Email Input Box */}
        <LinearGradient
          colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            placeholderTextColor="#BDBDBD"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        </LinearGradient>

        {/* Terms Text */}
        <Text style={styles.termsText}>
          By entering an Email ID, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>.
        </Text>

        {/* Send OTP Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('OtpVerify')}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}>
            <Text style={styles.buttonText}>Send OTP</Text>
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

  input: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Manrope_400Regular',
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

  // ✨ Send OTP Button
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
