import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function TopBar({ navigation }) {
  const [activeButton, setActiveButton] = useState('Explored');
  const [activeCategoryLive, setActiveCategoryLive] = useState('Anime & Manga');
  const [activeCategoryExplore, setActiveCategoryExplore] = useState('Anime & Manga');
  const [activeCategoryJoined, setActiveCategoryJoined] = useState('Anime & Manga');

  const buttons = ['Explored', 'Joined', 'Managed by you'];

  const categories = [
    'Anime & Manga',
    'Role play',
    'Art & Aesthetic',
    'Fandom',
    'Animals & Pets',
  ];

  const exploredImages = [
    { img: require('./assets/join1.png'), name: 'Tiesha Kyle' },
    { img: require('./assets/join2.jpg'), name: 'Olivia Essex' },
    { img: require('./assets/join3.jpg'), name: 'Tiesha' },
  ];

  const joinedImages = [
    { img: require('./assets/join1.png'), name: 'Anime Vibes' },
    { img: require('./assets/join2.jpg'), name: 'Pet Lovers' },
    { img: require('./assets/join3.jpg'), name: 'Art Corner' },
    { img: require('./assets/post1.1.jpg'), name: 'Fantasy RP' },
  ];

  const managedImages = [
    { img: require('./assets/join1.png'), name: 'Otaku World' },
    { img: require('./assets/join2.jpg'), name: 'Art Galaxy' },
    { img: require('./assets/join3.jpg'), name: 'Fandom Freaks' },
    { img: require('./assets/post1.1.jpg'), name: 'Pet Pals' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 🔝 Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.profileContainer}>
          <Image
            source={require('./assets/profile.png')}
            style={styles.profileImage}
          />
          <View style={styles.profileTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.profileName}>John Doe</Text>
              <Image
                source={require('./assets/starimage.png')}
                style={{ width: 18, height: 18, marginLeft: 5 }}
              />
            </View>
            <Text style={styles.profileStatus}>● Online</Text>
          </View>
        </View>

        <View style={styles.iconsContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Explore')}
          >
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notification')}
          >
            <Ionicons name="notifications" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔘 Tabs */}
      <View style={styles.buttonContainer}>
        {buttons.map((btn) => {
          const isActive = activeButton === btn;
          return (
            <TouchableOpacity
              key={btn}
              style={{ flex: 1, marginHorizontal: 5 }}
              onPress={() => setActiveButton(btn)}
              activeOpacity={0.8}
            >
              {isActive ? (
                <LinearGradient
                  colors={['#BF2EF0', 'rgba(191, 46, 240, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeButton}
                >
                  <Text style={styles.activeButtonText}>{btn}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.inactiveButton}>
                  <Text style={styles.inactiveButtonText}>{btn}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 📸 Sections */}
      <ScrollView contentContainerStyle={styles.cardContainer}>
        {/* === EXPLORED TAB === */}
        {activeButton === 'Explored' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Live Parties</Text>
                <TouchableOpacity>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map((cat) => {
                  const isActive = activeCategoryLive === cat;
                  return (
                    <TouchableOpacity key={cat + '_live'} onPress={() => setActiveCategoryLive(cat)} style={styles.categoryButton}>
                      <Text style={[styles.categoryText, { color: isActive ? '#fff' : '#aaa' }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.imageRow}>
                {exploredImages.map((item, index) => (
                  <ImageBackground key={index} source={item.img} style={styles.cardImage} imageStyle={{ borderRadius: 10 }}>
                    <View style={styles.imageOverlay}>
                      <Text style={styles.imageText}>{item.name}</Text>
                    </View>
                  </ImageBackground>
                ))}
              </View>
            </View>

            {/* 🌈 Gradient Button: View all Categories → */}
            <TouchableOpacity activeOpacity={0.8} style={{ alignSelf: 'center', marginTop: 10 }}>
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <Text style={styles.gradientButtonText}>View all Categories </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* === JOINED TAB === */}
        {activeButton === 'Joined' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((cat) => {
                const isActive = activeCategoryJoined === cat;
                return (
                  <TouchableOpacity key={cat + '_joined'} onPress={() => setActiveCategoryJoined(cat)} style={styles.categoryButton}>
                    <Text style={[styles.categoryText, { color: isActive ? '#fff' : '#aaa' }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {joinedImages.map((item, index) => (
                <ImageBackground
                  key={index}
                  source={item.img}
                  style={styles.joinedImage}
                  imageStyle={{ borderRadius: 10 }}
                >
                  <View style={styles.imageOverlay}>
                    <Text style={styles.imageText}>{item.name}</Text>
                  </View>
                </ImageBackground>
              ))}
            </ScrollView>

            {/* 🌈 Gradient Button: Explore More → */}
            <TouchableOpacity activeOpacity={0.8} style={{ alignSelf: 'center', marginTop: 15 }}>
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <Text style={styles.gradientButtonText}>Explore More </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* === MANAGED TAB === */}
        {activeButton === 'Managed by you' && (
          <View>
            <Text style={styles.cardTitle}>Communities Managed by You</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
              {managedImages.map((item, index) => (
                <ImageBackground
                  key={index}
                  source={item.img}
                  style={styles.joinedImage}
                  imageStyle={{ borderRadius: 10 }}
                >
                  <View style={styles.imageOverlay}>
                    <Text style={styles.imageText}>{item.name}</Text>
                  </View>
                </ImageBackground>
              ))}
            </ScrollView>

            {/* ✏️ Gradient Button: Click to Edit */}
            <TouchableOpacity activeOpacity={0.8} style={{ alignSelf: 'center', marginTop: 15 }}>
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradientButton, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.gradientButtonText}>Click to Edit</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 15 },
  profileContainer: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#08FFE2' },
  profileTextContainer: { marginLeft: 15 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileStatus: { color: '#08FFE2', fontSize: 14, marginTop: 3 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 15 },

  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, paddingHorizontal: 15 },
  activeButton: { borderWidth: 1, borderColor: '#BF2EF0', borderRadius: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  activeButtonText: { color: '#fff', fontWeight: '600' },
  inactiveButton: { borderWidth: 1, borderColor: '#222', borderRadius: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  inactiveButtonText: { color: '#aaa', fontWeight: '500' },

  cardContainer: { paddingHorizontal: 15, paddingVertical: 20 },
  card: { width: 328, height: 186, borderRadius: 20, borderWidth: 1, borderColor: '#222', backgroundColor: '#111', padding: 6, alignSelf: 'center', marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#08FFE2', fontSize: 16, fontWeight: '700' },
  viewAllText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  categoryScroll: { marginBottom: 10 },
  categoryButton: { borderWidth: 0, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6 },
  categoryText: { fontSize: 12, fontWeight: '500' },
  imageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardImage: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden' },
  joinedImage: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden', marginRight: 10 },
  imageOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10 },
  imageText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // 🌈 Gradient Button Style
  gradientButton: {
    width: 328,
    height: 41,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FF069B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF1468',
    shadowOpacity: 0.6,
    shadowRadius: 9.9,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(255, 6, 200, 0.1)',
  },
  gradientButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
