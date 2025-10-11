import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // ✅ Added for arrow icon

const { width } = Dimensions.get('window');

export default function SplashScreens({ navigation }) {
  const [screen, setScreen] = useState(1);

  const handleNext = () => {
    if (screen < 3) {
      setScreen(screen + 1);
    } else {
      navigation.navigate('LoginScreen');
    }
  };

  // Splash 1 & 2
  if (screen === 1 || screen === 2) {
    return (
      <ImageBackground
        source={
          screen === 1
            ? require('./assets/splash1.png')
            : require('./assets/splash2.png')
        }
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlayLeft}>
          <Text style={styles.titleLeft}>
            {screen === 1 ? 'Welcome!' : 'Let’s Go!'}
          </Text>
          <Text style={styles.subTextLeft}>
            Lorum ipsum Lorum ipsum{'\n'}Lorum ipsum
          </Text>

          {/* Centered Dots */}
          <View style={styles.dotsContainerCenter}>
            <View
              style={[styles.dot, screen === 1 ? styles.activeDot : null]}
            />
            <View
              style={[styles.dot, screen === 2 ? styles.activeDot : null]}
            />
            <View
              style={[styles.dot, screen === 3 ? styles.activeDot : null]}
            />
          </View>
        </View>

        {/* ✅ Next Button with Arrow Icon */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          style={styles.nextButtonRight}>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>
    );
  }

  // Splash 3
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <ImageBackground
        source={require('./assets/splash3.jpg')}
        style={styles.topBackground}
        resizeMode="cover">
        <View style={styles.textBoxWrapper}>
          <View style={styles.textBox}>
            <Text style={styles.heading}>What are you interested in?</Text>
            <Text style={styles.subText2}>
              Let us know your interest and enjoy app better
            </Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.bottomContainer}>
        <View style={styles.boxGrid}>
          {[
            { img: require('./assets/s1.jpg'), title: 'Music' },
            { img: require('./assets/s2.jpg'), title: 'Movies' },
            { img: require('./assets/s3.jpg'), title: 'Travel' },
            { img: require('./assets/s4.jpg'), title: 'Gaming' },
            { img: require('./assets/s5.jpg'), title: 'Fitness' },
            { img: require('./assets/s6.jpg'), title: 'Food' },
            { img: require('./assets/s7.jpg'), title: 'Art' },
            { img: require('./assets/s8.jpg'), title: 'Lifestyle' },
            { img: require('./assets/s9.jpg'), title: 'Tech' },
          ].map((item, index) => (
            <View key={index} style={styles.boxWrapper}>
              <TouchableOpacity style={styles.box}>
                <Image source={item.img} style={styles.boxImage} />
              </TouchableOpacity>
              <Text style={styles.boxTitle}>{item.title}</Text>
            </View>
          ))}
        </View>

        {/* Dots Indicator */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, screen === 1 ? styles.activeDot : null]} />
          <View style={[styles.dot, screen === 2 ? styles.activeDot : null]} />
          <View style={[styles.dot, screen === 3 ? styles.activeDot : null]} />
        </View>

        {/* Next Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('TabBar')}
          activeOpacity={0.8}
          style={styles.customNextButton}>
          <Text style={styles.customNextText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  overlayLeft: {
    alignSelf: 'flex-start',
    marginLeft: 25,
    marginBottom: 60,
    width: '100%',
  },

  titleLeft: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'left',
  },

  subTextLeft: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 40,
    textAlign: 'left',
  },

  dotsContainerCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },

  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 25,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
    marginHorizontal: 4,
  },

  activeDot: {
    backgroundColor: '#00FF94',
  },

  nextButtonRight: {
    position: 'absolute',
    bottom: 60,
    right: 25,
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00FF94',
  },

  topBackground: {
    height: 240,
    width: width,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },

  textBoxWrapper: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
  },

  textBox: {
    backgroundColor: '#000',
    paddingVertical: 25,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
  },

  heading: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },

  subText2: {
    color: '#BDBDBD',
    fontSize: 14,
    textAlign: 'center',
  },

  bottomContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    paddingTop: 20,
  },

  boxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  boxWrapper: {
    width: 89,
    alignItems: 'center',
    marginBottom: 10,
  },

  box: {
    width: 89,
    height: 114,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  boxImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },

  boxTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },

  customNextButton: {
    width: 328,
    height: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#05FF00',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 255, 0, 0.2)',
    shadowColor: '#05FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 9.9,
    elevation: 5,
    marginBottom: 20,
  },

  customNextText: {
    color: '#05FF00',
    fontSize: 16,
    fontWeight: '700',
  },
});
