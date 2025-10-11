import React from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
} from '@expo-google-fonts/manrope';
import AppLoading from 'expo-app-loading';

export default function SignupScreen({ navigation }) {
  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  // Button handlers
  const handleGoogleSignup = () => alert('Signup with Google');
  const handleEmailSignup = () => alert('Signup with Email');
  const handleFacebookSignup = () => alert('Signup with Facebook');

  return (
    <ImageBackground
      source={require('./assets/login_bg.png')}
      style={styles.background}>
      {/* Heading */}
      <View style={styles.headingContainer}>
        <Text style={styles.logo}>Solo Vibing</Text>
        <Text style={styles.subtitle}>Solo Vibing</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {/* Phone Signup Button */}
        <TouchableOpacity
          style={styles.phoneButton}
          onPress={() => navigation.navigate('WithPhone')}>
          <View style={styles.buttonInner}>
            <Image
              source={require('./assets/phonelogo.png')}
              style={styles.icon}
            />
            <Text style={[styles.buttonText, styles.phoneText]}>
              Phone Number
            </Text>
          </View>
        </TouchableOpacity>

        {/* Google Signup Button */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={() => navigation.navigate('WithEmail')}>
          <View style={styles.buttonInner}>
            <Image
              source={require('./assets/googlelogo.png')}
              style={styles.icon}
            />
            <Text style={[styles.buttonText, styles.googleText]}>Google</Text>
          </View>
        </TouchableOpacity>

        {/* OR Divider */}
        <Text style={styles.orText}>OR</Text>

        {/* Email + Facebook Buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleEmailSignup}>
            <Image
              source={require('./assets/emaillogo.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleFacebookSignup}>
            <Image
              source={require('./assets/facebooklogo.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
        </View>
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
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  icon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  phoneButton: {
    width: 320,
    height: 50,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007BFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6.2,
    elevation: 10,
  },
  googleButton: {
    width: 320,
    height: 50,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6.2,
    elevation: 10,
  },
  buttonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  phoneText: {
    color: '#007BFF',
  },
  googleText: {
    color: '#FF3B30',
  },
  orText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#fff',
    marginTop: 10,
    marginBottom: 10,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    backgroundColor: '#000',
    opacity: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  socialIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
});

