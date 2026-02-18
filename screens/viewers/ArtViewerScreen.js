// screens/viewers/ArtViewerScreen.js - High-res art viewer with download
import React, {useState, useEffect} from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import {getDoc, doc} from 'firebase/firestore';
import {db} from '../../firebaseConfig';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const BG = '#000000';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

export default function ArtViewerScreen({route, navigation}) {
  const {productId} = route.params;
  const [art, setArt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    fetchArt();
  }, []);

  const fetchArt = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const productData = productDoc.data();
        setArt(productData);
      } else {
        Alert.alert('Error', 'Artwork not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading artwork:', error);
      Alert.alert('Error', 'Failed to load artwork');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      // Request permissions
      const {status} = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant media library access to download artwork.',
        );
        return;
      }

      setDownloading(true);

      // Download file
      const fileUri = FileSystem.documentDirectory + `art_${productId}.jpg`;
      const downloadUrl = art.artConfig?.fullResUrl || art.coverImage;

      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        fileUri,
      );

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      // Save to gallery
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('Social Vibing', asset, false);

      Alert.alert(
        'Success! 🎨',
        'Artwork saved to your gallery',
        [{text: 'OK'}],
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Unable to save artwork to gallery');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    Alert.alert(
      'Share Artwork',
      'Share this artwork with friends?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Share',
          onPress: () => {
            // In a real app, use Share API or social sharing
            Alert.alert('Info', 'Sharing functionality coming soon');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading artwork...</Text>
      </View>
    );
  }

  if (!art || !art.artConfig) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="image-outline" size={64} color={TEXT} />
        <Text style={styles.errorText}>Artwork not available</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUrl = art.artConfig.fullResUrl || art.coverImage;
  const artist = art.artConfig?.artist || art.creator || 'Unknown Artist';
  const dimensions = art.artConfig?.dimensions || 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="close" size={28} color={TEXT} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {art.title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            by {artist}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Artwork Info',
              `${art.title}\n\nArtist: ${artist}\n\nDimensions: ${dimensions}\n\nDescription: ${art.description || 'No description available'}`,
            );
          }}
          style={styles.headerButton}
        >
          <Ionicons name="information-circle-outline" size={28} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* Art Image */}
      <View style={styles.imageContainer}>
        {imageLoading && (
          <View style={styles.imageLoading}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        )}
        <Image
          source={{uri: imageUrl}}
          style={styles.artImage}
          resizeMode="contain"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, downloading && styles.controlButtonDisabled]}
          onPress={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <>
              <ActivityIndicator size="small" color={TEXT} />
              <Text style={styles.controlButtonText}>Downloading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="download-outline" size={24} color={TEXT} />
              <Text style={styles.controlButtonText}>Download</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={TEXT} />
          <Text style={styles.controlButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            Alert.alert(
              'Set As',
              'Use this artwork as...',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Wallpaper',
                  onPress: () =>
                    Alert.alert('Info', 'Wallpaper feature coming soon'),
                },
                {
                  text: 'Profile Picture',
                  onPress: () =>
                    Alert.alert('Info', 'Profile picture feature coming soon'),
                },
              ],
            );
          }}
        >
          <Ionicons name="brush-outline" size={24} color={TEXT} />
          <Text style={styles.controlButtonText}>Use</Text>
        </TouchableOpacity>
      </View>

      {/* Metadata */}
      <View style={styles.metadata}>
        <View style={styles.metadataItem}>
          <Ionicons name="resize-outline" size={16} color="#999" />
          <Text style={styles.metadataText}>{dimensions}</Text>
        </View>
        <View style={styles.metadataItem}>
          <Ionicons name="eye-outline" size={16} color="#999" />
          <Text style={styles.metadataText}>
            {art.stats?.viewCount || 0} views
          </Text>
        </View>
        <View style={styles.metadataItem}>
          <Ionicons name="heart-outline" size={16} color="#999" />
          <Text style={styles.metadataText}>
            {art.stats?.purchaseCount || 0} collected
          </Text>
        </View>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  controlButton: {
    alignItems: 'center',
    padding: 8,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    color: TEXT,
    fontSize: 12,
    marginTop: 4,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataText: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
});
