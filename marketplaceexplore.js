import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "./firebaseConfig";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9CA3AF";
const ACCENT = "#7C3AED";

const TYPE_CONFIG = {
  comic: { title: "Comics", emoji: "📚", icon: "book" },
  book: { title: "Books", emoji: "📖", icon: "reader" },
  art: { title: "Art", emoji: "🎨", icon: "image" },
  sticker_pack: { title: "Sticker Packs", emoji: "🎭", icon: "happy" },
  profile_frame: { title: "Profile Frames", emoji: "🖼️", icon: "square-outline" },
  chat_bubble: { title: "Chat Themes", emoji: "💬", icon: "chatbubble" },
};

export default function MarketPlaceExploreScreen({ route, navigation }) {
  const { type } = route.params || {};
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(type || "all");

  useEffect(() => {
    fetchProducts();
  }, [selectedType]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      
      let q;
      if (selectedType === 'all') {
        q = query(productsRef, where('status', '==', 'active'), limit(50));
      } else {
        q = query(
          productsRef, 
          where('type', '==', selectedType),
          where('status', '==', 'active'),
          limit(50)
        );
      }

      const snapshot = await getDocs(q);
      const fetchedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(fetchedProducts);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const config = TYPE_CONFIG[selectedType] || { title: "All Products", emoji: "🛍️" };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{config.emoji} {config.title}</Text>
        <TouchableOpacity onPress={() => {}}>
          <Ionicons name="filter" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={TEXT_DIM} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={TEXT_DIM}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Type Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          label="All"
          icon="apps"
          active={selectedType === 'all'}
          onPress={() => setSelectedType('all')}
        />
        {Object.keys(TYPE_CONFIG).map(typeKey => (
          <FilterChip
            key={typeKey}
            label={TYPE_CONFIG[typeKey].title}
            icon={TYPE_CONFIG[typeKey].icon}
            active={selectedType === typeKey}
            onPress={() => setSelectedType(typeKey)}
          />
        ))}
      </ScrollView>

      {/* Products Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={80} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptyDesc}>Try adjusting your filters or search query</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() => navigation.navigate("ProductDetail", { productId: product.id })}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FilterChip({ label, icon, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color={active ? "#fff" : TEXT_DIM} />
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ product, onPress }) {
  const [imageError, setImageError] = useState(false);
  
  // Determine image source with proper fallback
  let imageSource;
  if (imageError) {
    imageSource = require('./assets/pp1.png');
  } else if (product.coverImage) {
    imageSource = typeof product.coverImage === 'string' 
      ? { uri: product.coverImage } 
      : product.coverImage;
  } else {
    imageSource = require('./assets/pp1.png');
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={imageSource}
        style={styles.image}
        defaultSource={require('./assets/pp1.png')}
        onError={() => setImageError(true)}
      />
      
      {/* Type Badge */}
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>{getTypeEmoji(product.type)}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.name} numberOfLines={1}>
          {product.title}
        </Text>

        {/* Rating */}
        <View style={styles.ratingRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < (product.stats?.rating || 0) ? "star" : "star-outline"}
              size={12}
              color="#FFD54F"
            />
          ))}
          <Text style={styles.ratingText}>({product.stats?.reviews || 0})</Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          {product.currency === 'diamonds' || !product.currency ? (
            <MaterialCommunityIcons name="diamond-stone" size={14} color="#EC4899" />
          ) : (
            <Image source={require("./assets/goldicon.png")} style={styles.coinIcon} />
          )}
          <Text style={styles.price}>
            {product.price} {product.currency === 'coins' ? 'Coins' : 'Diamonds'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getTypeEmoji(type) {
  const emojis = {
    comic: "📚",
    book: "📖",
    art: "🎨",
    sticker_pack: "🎭",
    profile_frame: "🖼️",
    chat_bubble: "💬",
  };
  return emojis[type] || "🛍️";
}

/* 🎨 Styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: TEXT,
    flex: 1,
    textAlign: "center",
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23232A',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },

  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#23232A',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterText: {
    color: TEXT_DIM,
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 20,
  },

  card: {
    width: "47%",
    margin: "1.5%",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#23232A",
    overflow: "hidden",
  },
  image: { 
    width: "100%", 
    height: 180, 
    resizeMode: "cover",
    backgroundColor: '#1A1A1F',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  typeBadgeText: {
    fontSize: 16,
  },
  cardInfo: {
    padding: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: TEXT_DIM,
    marginLeft: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coinIcon: { 
    width: 16, 
    height: 16, 
    resizeMode: "contain" 
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD54F",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
  },
});