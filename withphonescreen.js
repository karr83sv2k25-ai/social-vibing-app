import React, { useState } from 'react';
import {
  StyleSheet,
  ImageBackground,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // 👈 for back arrow
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';

export default function WithPhoneScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [selectedCode, setSelectedCode] = useState({ code: '+91', flag: '🇮🇳' });
  const [modalVisible, setModalVisible] = useState(false);

  const countries = [
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
    { code: '+971', flag: '🇦🇪', name: 'UAE' },
  ];

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) {
  return null;
  }

  const handleSendOtp = () => {
    if (!phone.trim()) {
      alert('Please enter your phone number');
    } else {
      alert(`OTP sent to: ${selectedCode.code} ${phone}`);
    }
  };

  const selectCountry = (item) => {
    setSelectedCode(item);
    setModalVisible(false);
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
        <Text style={styles.heading}>Phone number</Text>
        <Text style={styles.subText}>Please enter your phone number</Text>

        {/* Phone Input Box with Country Code */}
        <LinearGradient
          colors={['rgba(5,0,14,0.5)', 'rgba(52,42,66,0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.countryCodeBox}
              onPress={() => setModalVisible(true)}>
              <Text style={styles.countryFlag}>{selectedCode.flag}</Text>
              <Text style={styles.countryCode}>{selectedCode.code}</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="00000 00000"
              placeholderTextColor="#BDBDBD"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </LinearGradient>

        <Text style={styles.termsText}>
          By entering a Phone number, you agree to our{' '}
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

        {/* Country Picker Modal */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <FlatList
                data={countries}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryItem}
                    onPress={() => selectCountry(item)}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={styles.countryName}>
                      {item.name} ({item.code})
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
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
    marginTop: 120, // 👈 content shifted upward
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

  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginRight: 8,
  },

  countryFlag: { fontSize: 18, marginRight: 4 },
  countryCode: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#fff',
  },

  input: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBox: {
    width: 250,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 15,
  },

  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  flag: { fontSize: 20, marginRight: 8 },
  countryName: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_400Regular',
  },
});
