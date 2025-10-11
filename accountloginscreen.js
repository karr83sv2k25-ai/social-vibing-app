import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) return <AppLoading />;

  // 🔹 Static navigation to Splash Screen on Login click
  const handleLogin = () => {
    navigation.navigate('Splash');
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

        {/* 📧 Email */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#BDBDBD"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
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
        <TouchableOpacity onPress={handleLogin} activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}>
            <Text style={styles.buttonText}>Login</Text>
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
});

