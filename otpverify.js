import React, { useState, useRef } from 'react';
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

export default function OtpVerificationScreen({ navigation }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  // OTP change handler
  const handleChange = (text, index) => {
    if (/^\d*$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      if (text && index < 5) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  // ✅ Navigate to CreateAccount after OTP verification
  const handleVerify = () => {
    if (otp.join('').length === 6) {
      navigation.navigate('CreateAccount');
    } else {
      alert('Please enter all 6 digits');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleResend = () => {
    alert('OTP resent successfully!');
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
        <Text style={styles.heading}>OTP Verification</Text>

        {/* Subtext */}
        <Text style={styles.subText}>
          A 6 digit code has been sent to your phone number
        </Text>

        {/* OTP Input Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <LinearGradient
              key={index}
              colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.otpBox}>
              <TextInput
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpInput}
                keyboardType="numeric"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
              />
            </LinearGradient>
          ))}
        </View>

        {/* Resend OTP */}
        <TouchableOpacity style={styles.resendContainer} onPress={handleResend}>
          <Text style={styles.resendText}>Resend OTP?</Text>
        </TouchableOpacity>

       {/* ✅ Verify Button */}
<TouchableOpacity
  onPress={() => {
    if (otp.join('').length === 6) {
      navigation.navigate('CreateAccount'); // ✅ Navigate to CreateAccount screen
    } else {
      alert('Please enter all 6 digits');
    }
  }}
  activeOpacity={0.8}>
  <LinearGradient
    colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.button}>
    <Text style={styles.buttonText}>Verify</Text>
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

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginBottom: 10,
  },

  otpBox: {
    width: 40,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  otpInput: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Manrope_500Medium',
    width: '100%',
  },

  resendContainer: {
    alignSelf: 'flex-end',
    marginRight: 30,
    marginBottom: 30,
  },

  resendText: {
    color: '#BF2EF0',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    textDecorationLine: 'underline',
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

  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

