import React from 'react';
import { View, Text, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
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

export default function AgeVerificationScreen({ navigation }) {
  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) return <AppLoading />;

  const handleEnter = () => {
    navigation.navigate('HomeScreen'); // 👈 change this to your target screen
  };

  return (
    <ImageBackground
      source={require('./assets/login_bg.png')}
      style={styles.background}
      blurRadius={10}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'rgba(30,30,30,0.9)']}
          style={styles.card}>
          <Text style={styles.title}>
            Attention <Ionicons name="warning-outline" size={18} color="#FFD700" />
          </Text>

          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔞</Text>
          </View>

          <Text style={styles.warningText}>
            Social Vibing is <Text style={{ color: 'red' }}>adult only</Text> application
          </Text>

          <Text style={styles.desc}>
            Social Vibing is strictly limited to those over 17 or of legal age
            in your jurisdiction, whichever is greater.
          </Text>

          <Text style={styles.desc}>
            By entering this Platform, I acknowledge that I am 17 years old or
            older and agree to the terms of service.
          </Text>

          <TouchableOpacity>
            <Text style={styles.link}>How to protect your minors</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleEnter} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FF2E2E', '#CC0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.enterButton}>
              <Text style={styles.enterText}>I am 17 years old or older ENTER</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 320,
    padding: 25,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  iconContainer: {
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 8,
    marginBottom: 10,
  },
  icon: {
    fontSize: 24,
  },
  warningText: {
    color: '#fff',
    fontFamily: 'Manrope_500Medium',
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    color: '#ccc',
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    marginBottom: 8,
  },
  link: {
    color: '#4FA8FF',
    fontSize: 13,
    textDecorationLine: 'underline',
    marginTop: 5,
    marginBottom: 20,
  },
  enterButton: {
    width: 250,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enterText: {
    color: '#fff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
  },
});
