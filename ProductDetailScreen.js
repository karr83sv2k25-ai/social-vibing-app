import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { useWallet } from './context/WalletContext';
import { LinearGradient } from 'expo-linear-gradient';

// Safely import native modules
let FileSystem, MediaLibrary, Sharing;
try {
  FileSystem = require('expo-file-system/legacy');
  MediaLibrary = require('expo-media-library');
  Sharing = require('expo-sharing');
} catch (error) {
  console.log('Native modules not available, download feature will be disabled');
}

const { width } = Dimensions.get('window');
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';

export default function ProductDetailScreen({ route, navigation }) {
  const { productId } = route.params;
  const { wallet, fetchWallet } = useWallet();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [isOwned, setIsOwned] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    fetchProduct();
    checkOwnership();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        setProduct({ id: productDoc.id, ...productDoc.data() });
      } else {
        Alert.alert('Error', 'Product not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const checkOwnership = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const ownedProducts = userDoc.data().ownedProducts || [];
        setIsOwned(ownedProducts.includes(productId));
      }
    } catch (error) {
      console.error('Failed to check ownership:', error);
    }
  };

  const handlePurchase = async () => {
    if (!product) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'Please log in to make a purchase');
      return;
    }

    // Check balance
    const currency = product.currency || 'coins';
    const balance = currency === 'coins' ? wallet.coins : wallet.diamonds;

    if (balance < product.price) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${product.price} ${currency} but only have ${balance}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Buy ${currency === 'coins' ? 'Coins' : 'Diamonds'}`,
            onPress: () => navigation.navigate(currency === 'coins' ? 'CoinPurchase' : 'DiamondPurchase'),
          },
        ]
      );
      return;
    }

    setPurchasing(true);

    try {
      // Dummy purchase - directly update Firestore
      const currency = product.currency || 'coins';
      const userRef = doc(db, 'users', user.uid);
      const libraryRef = doc(db, 'libraries', user.uid);
      const productRef = doc(db, 'products', productId);

      // Deduct currency from wallet
      const walletUpdate = currency === 'coins' 
        ? { coins: increment(-product.price) }
        : { diamonds: increment(-product.price) };

      await updateDoc(userRef, {
        ...walletUpdate,
        ownedProducts: arrayUnion(productId),
      });

      // Add to library
      const libraryDoc = await getDoc(libraryRef);
      const libraryFieldMap = {
        'comic': 'comics',
        'book': 'books',
        'art': 'art',
        'sticker_pack': 'stickerPacks',
        'profile_frame': 'profileFrames',
        'chat_bubble': 'chatBubbles',
      };
      
      const fieldName = libraryFieldMap[product.type] || 'comics';

      if (libraryDoc.exists()) {
        await updateDoc(libraryRef, {
          [fieldName]: arrayUnion(productId)
        });
      } else {
        await setDoc(libraryRef, {
          [fieldName]: [productId]
        });
      }

      // Update product stats
      await updateDoc(productRef, {
        'stats.purchaseCount': increment(1)
      });

      Alert.alert('Success! 🎉', `You purchased ${product.title}!`);
      setIsOwned(true);
      await fetchWallet();

      // Navigate based on product type
      setTimeout(() => navigateToProduct(), 500);
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Purchase Failed', error.message || 'Something went wrong');
    } finally {
      setPurchasing(false);
    }
  };

  const navigateToProduct = () => {
    if (!product) return;

    // For now, just show success message since viewers might not be fully implemented
    Alert.alert(
      '✅ Product Purchased!',
      `${product.title} has been added to your library. You can access it from the My Library section in Marketplace.`,
      [
        { text: 'Go to Library', onPress: () => navigation.navigate('MarketPlace') },
        { text: 'Stay Here', style: 'cancel' }
      ]
    );

    /* Future navigation when viewers are ready:
    switch (product.type) {
      case 'comic':
        navigation.navigate('ComicReader', { productId: product.id });
        break;
      case 'book':
        navigation.navigate('BookReader', { productId: product.id });
        break;
      case 'art':
        navigation.navigate('ArtViewer', { productId: product.id });
        break;
      case 'sticker_pack':
        navigation.navigate('StickerPackViewer', { productId: product.id });
        break;
      case 'profile_frame':
        navigation.navigate('FrameCustomizer', { productId: product.id });
        break;
      case 'chat_bubble':
        navigation.navigate('BubbleCustomizer', { productId: product.id });
        break;
      default:
        Alert.alert('Coming Soon', 'This feature is being developed');
    }
    */
  };

  const handleDownload = async () => {
    if (!product) return;

    // Check if native modules are available
    if (!FileSystem || !MediaLibrary || !Sharing) {
      Alert.alert(
        'Feature Unavailable',
        'Download feature requires a native build. Please rebuild the app with:\n\nnpx expo run:android\n\nfor now, you can access your purchased items from the library.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if product is downloadable
    const downloadableTypes = ['comic', 'book', 'art'];
    if (!downloadableTypes.includes(product.type)) {
      Alert.alert('Not Downloadable', 'This type of product cannot be downloaded.');
      return;
    }

    // Get download URL based on product type
    let downloadUrl;
    let fileName;
    let fileExtension;

    switch (product.type) {
      case 'comic':
        downloadUrl = product.comicConfig?.fileUrl || product.coverImage;
        fileName = `${product.title.replace(/[^a-z0-9]/gi, '_')}_comic`;
        fileExtension = '.pdf';
        break;
      case 'book':
        downloadUrl = product.bookConfig?.fileUrl;
        fileName = `${product.title.replace(/[^a-z0-9]/gi, '_')}_book`;
        fileExtension = product.bookConfig?.format === 'epub' ? '.epub' : '.pdf';
        break;
      case 'art':
        downloadUrl = product.artConfig?.highResUrl || product.coverImage;
        fileName = `${product.title.replace(/[^a-z0-9]/gi, '_')}_art`;
        fileExtension = '.jpg';
        break;
      default:
        Alert.alert('Error', 'Cannot determine download URL');
        return;
    }

    if (!downloadUrl) {
      Alert.alert('Error', 'Download URL not available for this product.');
      return;
    }

    try {
      setDownloading(true);
      setDownloadProgress(0);

      // Request permissions for media library
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library permissions to download files.');
        setDownloading(false);
        return;
      }

      // Create download path
      const fileUri = FileSystem.documentDirectory + fileName + fileExtension;

      // Download with progress
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(Math.round(progress * 100));
        }
      );

      const { uri } = await downloadResumable.downloadAsync();

      // Save to media library (for images)
      if (product.type === 'art') {
        await MediaLibrary.createAssetAsync(uri);
        Alert.alert(
          'Download Complete! 🎉',
          `${product.title} has been saved to your gallery.`,
          [{ text: 'OK' }]
        );
      } else {
        // For PDFs/EPUBs, offer to share/open
        Alert.alert(
          'Download Complete! 🎉',
          `${product.title} has been downloaded.`,
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Open',
              onPress: async () => {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri);
                } else {
                  Alert.alert('Cannot Open', 'No app available to open this file type.');
                }
              }
            }
          ]
        );
      }

      // Update download count in Firestore
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        'stats.downloads': increment(1)
      });

    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', error.message || 'Could not download the file. Please try again.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return null;
  }

  const renderProductSpecifics = () => {
    switch (product.type) {
      case 'comic':
        return (
          <View style={styles.specs}>
            <SpecItem icon="book" label="Pages" value={product.comicConfig?.totalPages || 'N/A'} />
            <SpecItem icon="star" label="Genre" value={product.comicConfig?.genre?.join(', ') || 'N/A'} />
            <SpecItem icon="language" label="Language" value={product.comicConfig?.language || 'English'} />
          </View>
        );
      case 'book':
        return (
          <View style={styles.specs}>
            <SpecItem icon="document-text" label="Format" value={product.bookConfig?.format?.toUpperCase() || 'PDF'} />
            <SpecItem icon="book" label="Pages" value={product.bookConfig?.pageCount || 'N/A'} />
            <SpecItem icon="person" label="Author" value={product.bookConfig?.author || 'Unknown'} />
          </View>
        );
      case 'sticker_pack':
        return (
          <View style={styles.specs}>
            <SpecItem icon="happy" label="Stickers" value={product.stickerPackConfig?.totalStickers || 0} />
            <SpecItem icon="color-palette" label="Theme" value={product.stickerPackConfig?.packTheme || 'Various'} />
            <SpecItem icon="flash" label="Animated" value={product.stickerPackConfig?.animated ? 'Yes' : 'No'} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="share-social" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Cover Image */}
        <Image
          source={
            imageError 
              ? require('./assets/pp1.png')
              : (typeof product.coverImage === 'string' ? { uri: product.coverImage } : product.coverImage)
          }
          style={styles.coverImage}
          defaultSource={require('./assets/pp1.png')}
          onError={() => setImageError(true)}
        />

        {/* Product Info */}
        <View style={styles.contentCard}>
          {/* Type Badge */}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(product.type)}</Text>
          </View>

          <Text style={styles.title}>{product.title}</Text>

          {/* Creator */}
          <View style={styles.creatorRow}>
            <Image source={require('./assets/profile.png')} style={styles.creatorAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.creatorName}>{product.creatorName || 'Official'}</Text>
              <Text style={styles.creatorTag}>@creator</Text>
            </View>
            {product.isOfficial && (
              <View style={styles.officialBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#08FFE2" />
                <Text style={styles.officialText}>Official</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatItem icon="star" value={product.stats?.rating || 0} label="Rating" />
            <StatItem icon="download" value={formatNumber(product.stats?.downloads || 0)} label="Downloads" />
            <StatItem icon="chatbubble" value={formatNumber(product.stats?.reviews || 0)} label="Reviews" />
          </View>

          {/* Product Specifics */}
          {renderProductSpecifics()}

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description || 'No description available.'}</Text>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {product.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Purchase Button */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          {product.currency === 'diamonds' || !product.currency ? (
            <MaterialCommunityIcons name="diamond-stone" size={24} color="#EC4899" />
          ) : (
            <Image source={require('./assets/goldicon.png')} style={styles.priceIcon} />
          )}
          <Text style={styles.priceText}>
            {product.price} {product.currency === 'coins' ? 'Coins' : 'Diamonds'}
          </Text>
        </View>

        {isOwned ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.purchaseBtn, styles.ownedBtn]} onPress={navigateToProduct}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.btnText}>Owned</Text>
            </TouchableOpacity>
            
            {/* Download button for comics, books, and art */}
            {['comic', 'book', 'art'].includes(product.type) && (
              <TouchableOpacity 
                style={[styles.purchaseBtn, styles.downloadBtn]} 
                onPress={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnTextSmall}>{downloadProgress}%</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="download" size={20} color="#fff" />
                    <Text style={styles.btnText}>Download</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.purchaseBtn}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cart" size={20} color="#fff" />
                <Text style={styles.btnText}>Purchase</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function SpecItem({ icon, label, value }) {
  return (
    <View style={styles.specItem}>
      <Ionicons name={icon} size={18} color={ACCENT} />
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

function StatItem({ icon, value, label }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={20} color="#08FFE2" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getTypeLabel(type) {
  const labels = {
    comic: '📚 Comic',
    book: '📖 Book',
    art: '🎨 Art',
    sticker_pack: '🎭 Sticker Pack',
    profile_frame: '🖼️ Frame',
    chat_bubble: '💬 Chat Theme',
  };
  return labels[type] || type;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT_DIM,
    marginTop: 12,
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  coverImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover',
  },

  contentCard: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    padding: 20,
    minHeight: 400,
  },

  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${ACCENT}30`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT,
    marginBottom: 12,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },

  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  creatorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  creatorTag: {
    color: TEXT_DIM,
    fontSize: 12,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `#08FFE220`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  officialText: {
    color: '#08FFE2',
    fontSize: 11,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    color: TEXT_DIM,
    fontSize: 11,
    marginTop: 2,
  },

  specs: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  specLabel: {
    color: TEXT_DIM,
    fontSize: 14,
    flex: 1,
  },
  specValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    color: TEXT_DIM,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: `${ACCENT}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
  },
  tagText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#23232A',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  priceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  ownedBtn: {
    backgroundColor: '#10B981',
    flex: 1,
  },
  downloadBtn: {
    backgroundColor: '#06B6D4',
    flex: 1,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
