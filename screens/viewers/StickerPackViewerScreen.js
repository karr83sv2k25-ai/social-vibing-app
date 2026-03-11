// screens/viewers/StickerPackViewerScreen.js - Sticker pack grid viewer
import React, {useState, useEffect} from 'react';
import {
  View,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {getDoc, doc} from 'firebase/firestore';
import {db} from '../../firebaseConfig';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const STICKER_SIZE = (SCREEN_WIDTH - 48) / 3; // 3 columns with padding

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

export default function StickerPackViewerScreen({route, navigation}) {
  const {productId} = route.params;
  const [stickerPack, setStickerPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSticker, setSelectedSticker] = useState(null);

  useEffect(() => {
    fetchStickerPack();
  }, []);

  const fetchStickerPack = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const productData = productDoc.data();
        setStickerPack(productData);
      } else {
        Alert.alert('Error', 'Sticker pack not found');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
      }
    } catch (error) {
      console.error('Error loading sticker pack:', error);
      Alert.alert('Error', 'Failed to load sticker pack');
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    } finally {
      setLoading(false);
    }
  };

  const handleStickerPress = (sticker, index) => {
    setSelectedSticker(sticker);

    // Show sticker options
    Alert.alert(
      `Sticker ${index + 1}`,
      'What would you like to do with this sticker?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Use in Chat',
          onPress: () => {
            // In a real app, this would save to clipboard or add to quick access
            Alert.alert('Success', 'Sticker ready to use in your chats!');
          },
        },
        {
          text: 'Share',
          onPress: () => {
            Alert.alert('Info', 'Sharing functionality coming soon');
          },
        },
      ],
    );
  };

  const renderSticker = ({item, index}) => (
    <TouchableOpacity
      style={styles.stickerItem}
      onPress={() => handleStickerPress(item, index)}
      activeOpacity={0.7}
    >
      <View style={styles.stickerContainer}>
        <Image
          source={{uri: item.imageUrl}}
          style={styles.stickerImage}
          resizeMode="contain"
        />
      </View>
      {item.name && (
        <Text style={styles.stickerName} numberOfLines={1}>
          {item.name}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading stickers...</Text>
      </View>
    );
  }

  if (!stickerPack || !stickerPack.stickerPackConfig || 
      !stickerPack.stickerPackConfig.stickers?.length) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="happy-outline" size={64} color={TEXT} />
        <Text style={styles.errorText}>No stickers available</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stickers = stickerPack.stickerPackConfig.stickers;
  const stickerCount = stickers.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {stickerPack.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {stickerCount} sticker{stickerCount !== 1 ? 's' : ''}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Sticker Pack Info',
              `${stickerPack.title}\n\nCreator: ${stickerPack.creator || 'Unknown'}\n\nStickers: ${stickerCount}\n\nDescription: ${stickerPack.description || 'No description'}`,
            );
          }}
          style={styles.headerButton}
        >
          <Ionicons name="information-circle-outline" size={24} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* Pack Info Banner */}
      <View style={styles.infoBanner}>
        <Image
          source={{uri: stickerPack.coverImage}}
          style={styles.packCover}
        />
        <View style={styles.packInfo}>
          <Text style={styles.packDescription} numberOfLines={2}>
            {stickerPack.description || 'Express yourself with these stickers!'}
          </Text>
          <View style={styles.packStats}>
            <View style={styles.statItem}>
              <Ionicons name="images-outline" size={14} color="#999" />
              <Text style={styles.statText}>{stickerCount} stickers</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={14} color="#999" />
              <Text style={styles.statText}>
                {stickerPack.stats?.purchaseCount || 0} using
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stickers Grid */}
      <FlatList
        data={stickers}
        renderItem={renderSticker}
        keyExtractor={(item, index) => `sticker-${index}`}
        numColumns={3}
        contentContainerStyle={styles.stickerGrid}
        showsVerticalScrollIndicator={false}
      />

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert(
              'Add to Favorites',
              'Save this sticker pack for quick access?',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Add',
                  onPress: () =>
                    Alert.alert('Success', 'Added to your favorites!'),
                },
              ],
            );
          }}
        >
          <Ionicons name="star-outline" size={20} color={TEXT} />
          <Text style={styles.actionButtonText}>Favorite</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert('Info', 'Sharing functionality coming soon');
          }}
        >
          <Ionicons name="share-outline" size={20} color={TEXT} />
          <Text style={styles.actionButtonText}>Share Pack</Text>
        </TouchableOpacity>
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
    backgroundColor: CARD,
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
  infoBanner: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: CARD,
    marginBottom: 8,
  },
  packCover: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#222',
  },
  packInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  packDescription: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  packStats: {
    flexDirection: 'row',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  stickerGrid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  stickerItem: {
    width: STICKER_SIZE,
    padding: 6,
  },
  stickerContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  stickerName: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  quickActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#222',
    borderRadius: 8,
  },
  actionButtonText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
