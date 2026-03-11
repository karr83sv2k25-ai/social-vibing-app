// screens/marketplace/SellerStoreScreen.js - Individual seller's storefront
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';

export default function SellerStoreScreen({ route, navigation }) {
  const { sellerId } = route.params;
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const categories = [
    { id: 'all', name: 'All', icon: 'grid' },
    { id: 'chat_bubble', name: 'Bubbles', icon: 'chatbubbles' },
    { id: 'profile_frame', name: 'Frames', icon: 'image-frame' },
    { id: 'sticker_pack', name: 'Stickers', icon: 'happy' },
    { id: 'art', name: 'Art', icon: 'color-palette' },
    { id: 'comic', name: 'Comics', icon: 'book' },
    { id: 'book', name: 'Books', icon: 'library' },
  ];
  
  useEffect(() => {
    fetchSellerData();
  }, [sellerId]);
  
  const fetchSellerData = async () => {
    try {
      setLoading(true);
      
      // Fetch seller info
      const sellerRef = doc(db, 'users', sellerId);
      const sellerDoc = await getDoc(sellerRef);
      
      if (sellerDoc.exists()) {
        setSeller({ id: sellerDoc.id, ...sellerDoc.data() });
      }
      
      // Fetch seller's products
      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        where('sellerId', '==', sellerId),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const fetchedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setProducts(fetchedProducts);
    } catch (error) {
      console.error('Failed to fetch seller data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSellerData();
    setRefreshing(false);
  };
  
  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.type === selectedCategory);
  
  const renderProduct = ({ item }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
    >
      <Image source={{ uri: item.coverImage }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.productFooter}>
          <View style={styles.priceTag}>
            <Ionicons
              name={item.currency === 'diamonds' ? 'diamond' : 'logo-usd'}
              size={12}
              color={item.currency === 'diamonds' ? '#ff00ff' : '#08FFE2'}
            />
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
          <View style={styles.stats}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.statsText}>
              {item.stats?.rating?.toFixed(1) || '5.0'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
  
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }
  
  if (!seller) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Seller not found</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store</Text>
        <TouchableOpacity>
          <Ionicons name="share-outline" size={22} color={TEXT} />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
      >
        {/* Seller Banner */}
        <LinearGradient
          colors={['#7C3AED', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <Image
              source={{ uri: seller.profileImage || seller.avatar || 'https://via.placeholder.com/80' }}
              style={styles.sellerAvatar}
            />
            <Text style={styles.sellerName}>{seller.username || seller.displayName || 'Creator'}</Text>
            {seller.creatorProfile?.bio && (
              <Text style={styles.sellerBio} numberOfLines={2}>{seller.creatorProfile.bio}</Text>
            )}
            
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{products.length}</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {seller.stats?.totalSales || 0}
                </Text>
                <Text style={styles.statLabel}>Sales</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {seller.stats?.averageRating?.toFixed(1) || '5.0'}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
        
        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={18}
                color={selectedCategory === cat.id ? '#FFF' : TEXT_DIM}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.id && styles.categoryTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Products Grid */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'all' ? 'All Products' : categories.find(c => c.id === selectedCategory)?.name}
            <Text style={styles.count}> ({filteredProducts.length})</Text>
          </Text>
          
          {filteredProducts.length > 0 ? (
            <FlatList
              data={filteredProducts}
              renderItem={renderProduct}
              keyExtractor={item => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.row}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={TEXT_DIM} />
              <Text style={styles.emptyText}>No products in this category</Text>
            </View>
          )}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },
  
  banner: {
    padding: 24,
    margin: 16,
    borderRadius: 16,
  },
  bannerContent: {
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  sellerName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  sellerBio: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  
  categoryScroll: {
    marginTop: 16,
  },
  categoryContent: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD,
    marginRight: 8,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: ACCENT,
  },
  categoryText: {
    color: TEXT_DIM,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  
  productsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  count: {
    color: TEXT_DIM,
    fontWeight: '400',
  },
  
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productCard: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  productImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsText: {
    color: TEXT_DIM,
    fontSize: 12,
  },
  
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 12,
  },
  
  errorText: {
    color: TEXT_DIM,
    fontSize: 16,
  },
});
