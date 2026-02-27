import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';

// Generic library screen for Books, Art, Stickers, Frames, and Bubbles
export default function GenericLibraryScreen({ route, navigation, type: propType }) {
  // Support both route.params.type and direct prop
  const type = route?.params?.type || propType;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const config = getTypeConfig(type);

  useEffect(() => {
    fetchItems();
  }, [type]);

  const fetchItems = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const libraryDoc = await getDoc(doc(db, 'libraries', user.uid));
      if (!libraryDoc.exists()) {
        setItems([]);
        return;
      }

      const itemIds = libraryDoc.data()[config.fieldName] || [];
      
      if (itemIds.length === 0) {
        setItems([]);
        return;
      }

      const itemPromises = itemIds.map(id => getDoc(doc(db, 'products', id)));
      const itemDocs = await Promise.all(itemPromises);
      
      const itemsData = itemDocs
        .filter(doc => doc.exists())
        .map(doc => ({ id: doc.id, ...doc.data() }));

      setItems(itemsData);
    } catch (error) {
      console.error(`Failed to fetch ${type}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item) => {
    navigation.navigate(config.viewerScreen, { productId: item.id });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={typeof item.coverImage === 'string' ? { uri: item.coverImage } : item.coverImage}
        style={styles.itemImage}
      />
      <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.itemCreator} numberOfLines={1}>{item.creatorName || 'Official'}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{config.emoji} {config.title}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MarketPlaceExplore', { type })}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name={config.emptyIcon} size={80} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>No {config.title} Yet</Text>
          <Text style={styles.emptyDesc}>Browse the marketplace to find amazing {config.title.toLowerCase()}!</Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('MarketPlaceExplore', { type })}
          >
            <Text style={styles.browseBtnText}>Browse {config.title}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

function getTypeConfig(type) {
  const configs = {
    book: {
      title: 'Books',
      emoji: '📖',
      fieldName: 'books',
      emptyIcon: 'reader-outline',
      viewerScreen: 'BookReader',
    },
    art: {
      title: 'Art Gallery',
      emoji: '🎨',
      fieldName: 'art',
      emptyIcon: 'image-outline',
      viewerScreen: 'ArtViewer',
    },
    sticker_pack: {
      title: 'Sticker Packs',
      emoji: '🎭',
      fieldName: 'stickerPacks',
      emptyIcon: 'happy-outline',
      viewerScreen: 'StickerPackViewer',
    },
    profile_frame: {
      title: 'Profile Frames',
      emoji: '🖼️',
      fieldName: 'profileFrames',
      emptyIcon: 'square-outline',
      viewerScreen: 'FrameCustomizer',
    },
    chat_bubble: {
      title: 'Chat Themes',
      emoji: '💬',
      fieldName: 'chatBubbles',
      emptyIcon: 'chatbubble-outline',
      viewerScreen: 'BubbleCustomizer',
    },
  };

  return configs[type] || configs.book;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },

  itemCard: {
    flex: 1,
    margin: 8,
    backgroundColor: CARD,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  itemImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  itemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    padding: 12,
    paddingBottom: 4,
  },
  itemCreator: {
    color: TEXT_DIM,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  browseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
