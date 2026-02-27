import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { doc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';

export default function ComicsLibraryScreen({ navigation }) {
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchComics();
  }, []);

  const fetchComics = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get user's library
      const libraryDoc = await getDoc(doc(db, 'libraries', user.uid));
      if (!libraryDoc.exists()) {
        setComics([]);
        return;
      }

      const comicIds = libraryDoc.data().comics || [];
      
      if (comicIds.length === 0) {
        setComics([]);
        return;
      }

      // Fetch comic products
      const comicPromises = comicIds.map(id => getDoc(doc(db, 'products', id)));
      const comicDocs = await Promise.all(comicPromises);
      
      const comicsData = comicDocs
        .filter(doc => doc.exists())
        .map(doc => ({ id: doc.id, ...doc.data() }));

      setComics(comicsData);
    } catch (error) {
      console.error('Failed to fetch comics:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchComics();
    setRefreshing(false);
  };

  const renderComicItem = ({ item }) => (
    <TouchableOpacity
      style={styles.comicCard}
      onPress={() => navigation.navigate('ComicReader', { productId: item.id })}
      activeOpacity={0.8}
    >
      <Image
        source={typeof item.coverImage === 'string' ? { uri: item.coverImage } : item.coverImage}
        style={styles.comicCover}
      />
      <View style={styles.comicInfo}>
        <Text style={styles.comicTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.comicPages}>{item.comicConfig?.totalPages || 0} Pages</Text>
        
        <View style={styles.comicMeta}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#FFD54F" />
            <Text style={styles.ratingText}>{item.stats?.rating || 0}</Text>
          </View>
          <Text style={styles.genreText}>{item.comicConfig?.genre?.[0] || 'Comic'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading your comics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📚 My Comics</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'comic' })}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{comics.length}</Text>
          <Text style={styles.statLabel}>Comics</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {comics.reduce((sum, c) => sum + (c.comicConfig?.totalPages || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Total Pages</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {comics.filter(c => c.comicConfig?.genre?.includes('Action')).length}
          </Text>
          <Text style={styles.statLabel}>Action</Text>
        </View>
      </View>

      {/* Comics List */}
      {comics.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={80} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>No Comics Yet</Text>
          <Text style={styles.emptyDesc}>Browse the marketplace to find amazing comics!</Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'comic' })}
          >
            <Text style={styles.browseBtnText}>Browse Comics</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={comics}
          renderItem={renderComicItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#08FFE2" />
          }
        />
      )}
    </SafeAreaView>
  );
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

  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: CARD,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 4,
  },

  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },

  comicCard: {
    flex: 1,
    margin: 8,
    backgroundColor: CARD,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  comicCover: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  comicInfo: {
    padding: 12,
  },
  comicTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  comicPages: {
    color: TEXT_DIM,
    fontSize: 12,
    marginBottom: 8,
  },
  comicMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD54F20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    color: '#FFD54F',
    fontSize: 11,
    fontWeight: '600',
  },
  genreText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '600',
  },

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
