// screens/viewers/ComicReaderScreen.js - Comic book reader with swipe navigation
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Swiper from 'react-native-swiper';
import {getDoc, doc} from 'firebase/firestore';
import {db} from '../../firebaseConfig';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const BG = '#000000';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

export default function ComicReaderScreen({route, navigation}) {
  const {productId} = route.params;
  const [comic, setComic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const swiperRef = useRef(null);
  const controlsTimeout = useRef(null);

  useEffect(() => {
    fetchComic();
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  const fetchComic = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const productData = productDoc.data();
        setComic(productData);

        // Check if user owns this comic
        // This should be verified server-side, but we'll trust the navigation
      } else {
        Alert.alert('Error', 'Comic not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading comic:', error);
      Alert.alert('Error', 'Failed to load comic');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const toggleControls = () => {
    setShowControls((prev) => !prev);

    // Auto-hide controls after 3 seconds
    if (!showControls) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handlePageChange = (index) => {
    setCurrentPage(index);
  };

  const goToPage = (pageIndex) => {
    if (swiperRef.current) {
      swiperRef.current.scrollBy(pageIndex - currentPage);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading comic...</Text>
      </View>
    );
  }

  if (!comic || !comic.comicConfig || !comic.comicConfig.pages) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle-outline" size={64} color={TEXT} />
        <Text style={styles.errorText}>Comic pages not available</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pages = comic.comicConfig.pages;
  const totalPages = pages.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={!showControls} />

      {/* Top Controls */}
      {showControls && (
        <View style={styles.topControls}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.controlButton}
          >
            <Ionicons name="close" size={28} color={TEXT} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {comic.title}
            </Text>
            <Text style={styles.pageIndicator}>
              Page {currentPage + 1} of {totalPages}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Comic Info',
                `${comic.title}\n\nCreator: ${comic.creator || 'Unknown'}\n\nPages: ${totalPages}`,
              );
            }}
            style={styles.controlButton}
          >
            <Ionicons name="information-circle-outline" size={28} color={TEXT} />
          </TouchableOpacity>
        </View>
      )}

      {/* Comic Pages Swiper */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={toggleControls}
        style={styles.swiperContainer}
      >
        <Swiper
          ref={swiperRef}
          loop={false}
          showsPagination={false}
          onIndexChanged={handlePageChange}
          index={currentPage}
          loadMinimal
          loadMinimalSize={2}
        >
          {pages.map((page, index) => (
            <View key={index} style={styles.pageContainer}>
              <Image
                source={{uri: page.imageUrl}}
                style={styles.pageImage}
                resizeMode="contain"
              />
            </View>
          ))}
        </Swiper>
      </TouchableOpacity>

      {/* Bottom Controls */}
      {showControls && (
        <View style={styles.bottomControls}>
          {/* Page Navigation */}
          <View style={styles.navigationRow}>
            <TouchableOpacity
              onPress={() => goToPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={[
                styles.navButton,
                currentPage === 0 && styles.navButtonDisabled,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentPage === 0 ? '#666' : TEXT}
              />
              <Text
                style={[
                  styles.navButtonText,
                  currentPage === 0 && styles.navButtonTextDisabled,
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            {/* Page dots indicator */}
            <View style={styles.dotsContainer}>
              {Array.from({length: Math.min(totalPages, 5)}).map((_, idx) => {
                const pageIndex =
                  totalPages <= 5
                    ? idx
                    : Math.floor(
                        (currentPage / totalPages) * 5,
                      ) +
                      idx -
                      2;
                const isActive = pageIndex === currentPage;

                if (pageIndex < 0 || pageIndex >= totalPages) return null;

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => goToPage(pageIndex)}
                    style={[styles.dot, isActive && styles.dotActive]}
                  />
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => goToPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              style={[
                styles.navButton,
                currentPage === totalPages - 1 && styles.navButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.navButtonText,
                  currentPage === totalPages - 1 && styles.navButtonTextDisabled,
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={currentPage === totalPages - 1 ? '#666' : TEXT}
              />
            </TouchableOpacity>
          </View>

          {/* Quick jump buttons */}
          <View style={styles.quickJumpRow}>
            <TouchableOpacity
              onPress={() => goToPage(0)}
              disabled={currentPage === 0}
              style={styles.quickJumpButton}
            >
              <Ionicons
                name="play-skip-back"
                size={20}
                color={currentPage === 0 ? '#666' : TEXT}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => goToPage(totalPages - 1)}
              disabled={currentPage === totalPages - 1}
              style={styles.quickJumpButton}
            >
              <Ionicons
                name="play-skip-forward"
                size={20}
                color={currentPage === totalPages - 1 ? '#666' : TEXT}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT,
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: TEXT,
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: ACCENT,
    borderRadius: 8,
  },
  backButtonText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 10,
  },
  controlButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  titleText: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
  },
  pageIndicator: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  swiperContainer: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingBottom: 32,
    paddingTop: 16,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: TEXT,
    fontSize: 16,
    marginHorizontal: 4,
  },
  navButtonTextDisabled: {
    color: '#666',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: ACCENT,
    width: 24,
  },
  quickJumpRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  quickJumpButton: {
    padding: 8,
  },
});
