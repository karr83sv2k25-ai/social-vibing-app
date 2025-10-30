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
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
} from '@expo-google-fonts/manrope';

export default function CreateAccountScreen({ navigation }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState({
    name: 'Select your country',
    flag: '🌍',
  });
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  const countries = [
    { name: 'India', flag: '🇮🇳' },
    { name: 'USA', flag: '🇺🇸' },
    { name: 'UK', flag: '🇬🇧' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'UAE', flag: '🇦🇪' },
  ];

  let [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) return null;

  const handleNext = () => {
    if (!name || !password || !confirmPassword || !age || !gender) {
      alert('Please fill all fields');
    } else if (password !== confirmPassword) {
      alert('Passwords do not match');
    } else {
      alert(`Account Created for ${name}`);
      // navigation.navigate('NextScreen');
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* 🧾 Heading */}
        <Text style={styles.heading}>Create New Account</Text>

        {/* 🧍 Name */}
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#BDBDBD"
          value={name}
          onChangeText={setName}
        />

        {/* 🔒 Password */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Password"
            placeholderTextColor="#BDBDBD"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#BDBDBD"
              style={styles.eyeIcon}
            />
          </TouchableOpacity>
        </View>

        {/* 🔒 Confirm Password */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Confirm Password"
            placeholderTextColor="#BDBDBD"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons
              name={showConfirmPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#BDBDBD"
              style={styles.eyeIcon}
            />
          </TouchableOpacity>
        </View>

        {/* 🌍 Select Country */}
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowCountryModal(true)}>
          <Text style={styles.dropdownText}>
            {selectedCountry.flag} {selectedCountry.name}
          </Text>
        </TouchableOpacity>

        {/* 🎂 Select Age */}
        <TextInput
          style={styles.input}
          placeholder="Select your age"
          placeholderTextColor="#BDBDBD"
          keyboardType="numeric"
          value={age}
          onChangeText={setAge}
        />

        {/* 🚻 Gender */}
        <View style={styles.genderRow}>
          {['Male', 'Female', 'Other'].map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderButton,
                gender === g && styles.genderSelected,
              ]}
              onPress={() => setGender(g)}>
              <Text
                style={[
                  styles.genderText,
                  gender === g && styles.genderTextSelected,
                ]}>
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 🚀 Next Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('AgeVerification')}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}>
            <Text style={styles.buttonText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* 🌍 Country Modal */}
        <Modal visible={showCountryModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <FlatList
                data={countries}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryItem}
                    onPress={() => {
                      setSelectedCountry(item);
                      setShowCountryModal(false);
                    }}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={styles.countryName}>{item.name}</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heading: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    color: '#fff',
    marginBottom: 25,
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
    marginBottom: 15,
  },
  eyeIcon: { marginLeft: -35 },
  dropdown: {
    width: 300,
    height: 50,
    backgroundColor: 'rgba(52,42,66,0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  dropdownText: { color: '#fff', fontFamily: 'Manrope_400Regular' },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 300,
    marginBottom: 30,
  },
  genderButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#8C7EBB',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  genderSelected: {
    borderColor: '#FF06C8',
    backgroundColor: 'rgba(255, 6, 200, 0.1)',
  },
  genderText: { color: '#ccc', fontFamily: 'Manrope_500Medium' },
  genderTextSelected: { color: '#FF06C8' },
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
  countryName: { color: '#FFFFFF', fontFamily: 'Manrope_400Regular' },
});
