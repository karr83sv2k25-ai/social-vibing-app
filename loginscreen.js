import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
} from '@expo-google-fonts/manrope';

export default function LoginScreen({ navigation }) {
  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
  });

  if (!fontsLoaded) {
    return null; // Fonts loading fallback, you can show a custom loader here
  }

  const handleLogin = async (email, password) => {
    try {
      const response = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Store user data in context or async storage
        // Navigate to tab navigator so bottom tabs are visible
        navigation.replace('TabBar');
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  };

  const handleSignup = () => {
    navigation.navigate('Signup');
  };

  return (
    <ImageBackground
      source={require('./assets/login_bg.png')}
      style={styles.background}>
      <View style={styles.headingContainer}>
        <Text style={styles.logo}>Social Vibing</Text>
        <Text style={styles.subtitle}>Social Vibing</Text>
      </View>

      <View style={styles.buttonContainer}>
        {/* Signup Button */}
        <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
          <Text style={[styles.buttonText, styles.signupText]}>Signup</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('AccountLogin')}
          activeOpacity={0.8}>
          <Text style={[styles.buttonText, styles.loginText]}>Login</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  headingContainer: {
    alignItems: 'center',
  },
  logo: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 87,
  },
  subtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    lineHeight: 13,
    letterSpacing: -0.02 * 13,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  signupButton: {
    width: 320,
    height: 50,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BF2EF0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#BF2EF0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6.2,
    elevation: 10,
  },
  loginButton: {
    width: 320,
    height: 50,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EE9F07',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6161',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6.2,
    elevation: 10,
  },
  buttonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signupText: {
    color: '#BF2EF0',
  },
  loginText: {
    color: '#EE9F07',
  },
});
