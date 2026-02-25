import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useWallet } from "./context/WalletContext";
import { db, auth } from "./firebaseConfig";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";

const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9CA3AF";
const ACCENT = "#7C3AED";
const CYAN = "#08FFE2";
const ORANGE = "#FF9800"; // coin button color

// ---- Dummy user data (for Colors / Characters / Bubbles cards) ----
const USERS = [
  { id: "1", name: "Ken Kaneki", tag: "@ghoul", coins: "50 Coins", avatar: require("./assets/profile.png") },
  { id: "2", name: "Satoru Gojo", tag: "@sixeyes", coins: "60 Coins", avatar: require("./assets/profile.png") },
  { id: "3", name: "Monkey D. Luffy", tag: "@strawhat", coins: "50 Coins", avatar: require("./assets/profile.png") },
  { id: "4", name: "Edward Elric", tag: "@alchemy", coins: "70 Coins", avatar: require("./assets/profile.png") },
  { id: "5", name: "Itachi Uchiha", tag: "@genjutsu", coins: "55 Coins", avatar: require("./assets/profile.png") },
  { id: "6", name: "Levi Ackerman", tag: "@captain", coins: "80 Coins", avatar: require("./assets/profile.png") },
  { id: "7", name: "Naruto Uzumaki", tag: "@hokage", coins: "50 Coins", avatar: require("./assets/profile.png") },
  { id: "8", name: "Eren Yeager", tag: "@freedom", coins: "60 Coins", avatar: require("./assets/profile.png") },
  { id: "9", name: "Ichigo Kurosaki", tag: "@shinigami", coins: "45 Coins", avatar: require("./assets/profile.png") },
  { id: "10", name: "Gon Freecss", tag: "@hunter", coins: "40 Coins", avatar: require("./assets/profile.png") },
];

// ---- Store items (grid under Message Bubbles) ----
const PRODUCTS = [
  { id: "p1", title: "Edward Elric", rating: 5, price: 30, img: require("./assets/pp1.png") },
  { id: "p2", title: "Isaac Netero", rating: 4, price: 40, img: require("./assets/pp2.png") },
  { id: "p3", title: "Ken Kaneki", rating: 5, price: 100, img: require("./assets/pp3.png") },
  { id: "p4", title: "Itachi Uchiha", rating: 5, price: 20, img: require("./assets/pp4.png") },
  { id: "p5", title: "Satoru Gojo", rating: 5, price: 200, img: require("./assets/pp5.png") },
  { id: "p6", title: "Tengen Uzui", rating: 4, price: 120, img: require("./assets/pp6.png") },
];

// simple “filters” splitting products
const FILTERS = {
  Popular: PRODUCTS,
  Freebies: PRODUCTS.filter(() => false),
  Officials: PRODUCTS.slice(0, 3),
  "Community’s": PRODUCTS.slice(3),
};

export default function MarketPlaceScreen({ navigation }) {
  const { wallet, loading: walletLoading } = useWallet();
  const [activeTab, setActiveTab] = useState("Popular");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [libraryCounts, setLibraryCounts] = useState({
    comics: 0,
    books: 0,
    art: 0,
    stickers: 0,
    frames: 0,
    bubbles: 0,
  });
  const [featuredSellers, setFeaturedSellers] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);

  useEffect(() => {
    console.log('🚀 Marketplace mounted, fetching products...');
    fetchProducts();
    fetchLibraryCounts();
    checkSellerStatus();
    fetchFeaturedSellers();
  }, [activeTab]);

  const checkSellerStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsSeller(userData.isSeller === true);
      }
    } catch (error) {
      console.error('Failed to check seller status:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching products from Firestore...');
      console.log('📊 Active tab:', activeTab);

      // Fetch from Firestore
      const productsRef = collection(db, 'products');
      let q;

      // Simplified queries - just get all products and filter client-side
      console.log('📦 Building query...');
      q = query(productsRef, limit(50));

      console.log('⏳ Executing query...');
      const snapshot = await getDocs(q);
      console.log(`✅ Found ${snapshot.size} products in Firestore`);
      
      const fetchedProducts = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`  📌 ${data.title} - ${data.type} - ${data.price} ${data.currency}`);
        return {
          id: doc.id,
          productId: doc.id, // Ensure productId is set for navigation
          ...data,
          // Flatten stats for easier access
          purchaseCount: data.stats?.purchaseCount || data.purchaseCount || 0,
          rating: data.stats?.rating || data.rating || 0,
        };
      });

      console.log(`📊 Fetched ${fetchedProducts.length} products from Firestore`);

      // Filter on client side if needed
      let filteredProducts = fetchedProducts.filter(p => p.status === 'active' || !p.status);
      console.log(`🔍 After status filter: ${filteredProducts.length} products`);

      if (activeTab === 'Popular') {
        filteredProducts.sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
        console.log('📈 Sorted by popularity');
      } else if (activeTab === 'Officials') {
        const beforeCount = filteredProducts.length;
        filteredProducts = filteredProducts.filter(p => p.isOfficial === true);
        console.log(`🏢 Officials filter: ${beforeCount} → ${filteredProducts.length} products`);
      } else if (activeTab === 'Freebies') {
        const beforeCount = filteredProducts.length;
        filteredProducts = filteredProducts.filter(p => p.price === 0);
        console.log(`🆓 Freebies filter: ${beforeCount} → ${filteredProducts.length} products`);
      }

      console.log(`✅ Final products to display: ${filteredProducts.length}`);
      
      setProducts(filteredProducts);
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);

      // Show helpful message if index is building
      if (error.message?.includes('index is currently building')) {
        console.log('⏳ Firestore indexes are building. This takes 1-2 minutes.');
      }

      // Keep products empty on error - user can refresh
      setProducts([]);
    } finally {
      setLoading(false);
      console.log('✅ Fetch complete');
    }
  };

  const fetchLibraryCounts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('⚠️ No user logged in, cannot fetch library counts');
        return;
      }

      console.log('📚 Fetching library counts for user:', user.uid);

      // Fetch user's library
      const libraryRef = doc(db, 'libraries', user.uid);
      const libraryDoc = await getDoc(libraryRef);

      if (!libraryDoc.exists()) {
        console.log('📚 No library found for user');
        return;
      }

      const libraryData = libraryDoc.data();
      console.log('📚 Library data:', libraryData);

      // Count items by type - matching the field names in Firestore
      const counts = {
        comics: (libraryData.comics || []).length,
        books: (libraryData.books || []).length,
        art: (libraryData.art || []).length,
        stickers: (libraryData.stickerPacks || libraryData.stickers || []).length,
        frames: (libraryData.profileFrames || libraryData.frames || []).length,
        bubbles: (libraryData.chatBubbles || libraryData.bubbles || []).length,
      };

      console.log('📊 Library counts:', counts);
      setLibraryCounts(counts);
    } catch (error) {
      console.error('❌ Failed to fetch library counts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    await fetchLibraryCounts();
    setRefreshing(false);
  };

  const fetchFeaturedSellers = async () => {
    try {
      setLoadingStores(true);
      console.log('🏪 Fetching featured sellers...');
      
      // Query users who are sellers and have products
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('isSeller', '==', true), limit(10));
      
      const snapshot = await getDocs(q);
      const sellers = [];
      
      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();
        
        // Count products for this seller
        const productsRef = collection(db, 'products');
        const productsQuery = query(
          productsRef,
          where('sellerId', '==', userDoc.id),
          where('status', '==', 'published')
        );
        const productsSnapshot = await getDocs(productsQuery);
        
        if (productsSnapshot.size > 0) {
          sellers.push({
            id: userDoc.id,
            ...userData,
            productCount: productsSnapshot.size,
          });
        }
      }
      
      console.log(`✅ Found ${sellers.length} featured sellers`);
      setFeaturedSellers(sellers);
    } catch (error) {
      console.error('❌ Failed to fetch sellers:', error);
    } finally {
      setLoadingStores(false);
    }
  };

  const handleProductPress = (productId) => {
    navigation.navigate('ProductDetail', { productId });
  };
  
  const handleStorePress = (sellerId) => {
    navigation.navigate('SellerStore', { sellerId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#08FFE2"
          />
        }
      >
        {/* 🔹 Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require("./assets/profile.png")} style={styles.avatar} />
            <Text style={styles.headerTitle}>Marketplace</Text>
          </View>
          <View style={styles.headerIcons}>
            {/* ✅ Search icon navigates to MarketplaceExplore */}
            <TouchableOpacity onPress={() => navigation.navigate("MarketPlaceExplore")}>
              <Ionicons name="search-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <Ionicons name="cart-outline" size={22} color="#fff" />
          </View>
        </View>

        {/* 💰 Coins & Diamonds */}
        <View style={styles.balanceRow}>
          <TouchableOpacity
            style={styles.balanceBtn}
            onPress={() => navigation.navigate('CoinPurchase')}
          >
            <Ionicons name="logo-usd" size={16} color={CYAN} />
            <Text style={styles.balanceText}>
              {walletLoading ? '...' : wallet.coins} Coins
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.balanceBtn}
            onPress={() => navigation.navigate('DiamondPurchase')}
          >
            <MaterialCommunityIcons name="diamond-stone" size={16} color="#ff00ff" />
            <Text style={styles.balanceText}>
              {walletLoading ? '...' : wallet.diamonds} Diamonds
            </Text>
          </TouchableOpacity>
        </View>

        {/* 💼 Seller Button */}
        <TouchableOpacity
          style={styles.sellerButton}
          onPress={() => navigation.navigate(isSeller ? 'SellerDashboard' : 'BecomeSeller')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sellerButtonGradient}
          >
            <View style={styles.sellerButtonContent}>
              <MaterialCommunityIcons 
                name={isSeller ? "storefront" : "store-plus"} 
                size={24} 
                color="#FFF" 
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.sellerButtonTitle}>
                  {isSeller ? '📦 My Store' : '🚀 Start Selling'}
                </Text>
                <Text style={styles.sellerButtonDesc}>
                  {isSeller ? 'Manage your products & earnings' : 'Turn your creativity into income'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* 🎁 Promo Card */}
        <LinearGradient
          colors={["#7C3AED", "#08FFE2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          <View>
            <Text style={styles.promoTitle}>Enjoy Social Vibing ✨</Text>
            <Text style={styles.promoDesc}>Get 50% off special gifts today!</Text>
          </View>
          <Image source={require("./assets/gift.png")} style={styles.promoImage} />
        </LinearGradient>

        {/* 🧩 Categories - 6 Main Features */}
        <View style={styles.categoryRow}>
          <Category
            icon={require("./assets/character.png")}
            label="Comics"
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'comic' })}
          />
          <Category
            icon={require("./assets/profileframe.png")}
            label="Books"
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'book' })}
          />
        </View>

        {/* 🏪 Featured Stores */}
        {!loadingStores && featuredSellers.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🏪 Featured Stores</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MarketPlaceExplore', { viewStores: true })}>
                <Text style={styles.sectionView}>View all ➜</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {featuredSellers.map((seller) => (
                <TouchableOpacity
                  key={seller.id}
                  style={styles.storeCard}
                  onPress={() => handleStorePress(seller.id)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: seller.profileImage || seller.avatar || 'https://via.placeholder.com/80' }}
                    style={styles.storeAvatar}
                  />
                  <Text style={styles.storeName} numberOfLines={1}>
                    {seller.username || seller.displayName || 'Creator'}
                  </Text>
                  <Text style={styles.storeProducts}>
                    {seller.productCount} product{seller.productCount !== 1 ? 's' : ''}
                  </Text>
                  <View style={styles.storeStats}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.storeRating}>
                      {seller.stats?.averageRating?.toFixed(1) || '5.0'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 📸 More Categories */}
        <View style={styles.categoryRow}>
          <Category
            icon={require("./assets/photos.png")}
            label="Art"
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'art' })}
          />
        </View>

        <View style={styles.categoryRow}>
          <Category
            icon={require("./assets/chatbubbles.png")}
            label="Stickers"
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'sticker_pack' })}
          />
          <Category
            icon={require("./assets/profileframe.png")}
            label="Frames"
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'profile_frame' })}
          />
          <Category
            icon={require("./assets/chatbubbles.png")}
            label="Bubbles"
            onPress={() => navigation.navigate('MarketPlaceExplore', { type: 'chat_bubble' })}
          />
        </View>

        {/* 🛠️ Quick Setup (Show if no products) */}
        {!loading && products.length === 0 && (
          <View>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={() => {
                console.log('🔄 Manual refresh triggered');
                fetchProducts();
              }}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
              <Text style={styles.setupText}>Refresh Products</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.setupButton, { marginTop: 10, backgroundColor: '#6366F1' }]}
              onPress={() => navigation.navigate('TestMarketplaceSetup')}
            >
              <MaterialCommunityIcons name="cog-outline" size={20} color="#fff" />
              <Text style={styles.setupText}>Setup Marketplace Data</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* � My Library Quick Access */}
       

        {/* Tabs + Product Grid */}
        <FilterTabs active={activeTab} onChange={setActiveTab} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant" size={60} color={TEXT_DIM} />
            <Text style={styles.emptyTitle}>No Products Yet</Text>
            <Text style={styles.emptyDesc}>
              Click "Setup Marketplace Data" above to add sample products
            </Text>
          </View>
        ) : (
          <ProductGrid items={products} onProductPress={handleProductPress} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Small Components ---------- */
function Category({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.catItem} onPress={onPress}>
      <Image source={icon} style={styles.catIcon} />
      {!!label && <Text style={styles.catText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function LibraryCard({ icon, title, count, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.libraryCard, { borderColor: color }]} onPress={onPress}>
      <View style={[styles.libraryIconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.libraryTitle}>{title}</Text>
      <Text style={styles.libraryCount}>{count} items</Text>
    </TouchableOpacity>
  );
}

function Section({ title, data }) {
  const grouped = [];
  for (let i = 0; i < data.length; i += 5) grouped.push(data.slice(i, i + 5));

  return (
    <View style={{ marginTop: 20 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionView}>View all ➜</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 10 }}
      >
        {grouped.map((group, idx) => (
          <View key={idx} style={styles.userCard}>
            {group.map((u) => (
              <View key={u.id} style={styles.userRow}>
                <Image source={u.avatar} style={styles.userAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userTag}>{u.tag}</Text>
                </View>
                <TouchableOpacity style={[styles.coinBtn, { backgroundColor: ORANGE }]}>
                  <Text style={styles.coinText}>{u.coins}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function FilterTabs({ active, onChange }) {
  const tabs = ["Popular", "Freebies", "Officials", "Community’s"];
  return (
    <View style={styles.tabsRow}>
      {tabs.map((t) => {
        const isActive = t === active;
        return (
          <TouchableOpacity
            key={t}
            style={[styles.tabPill, isActive && styles.tabPillActive]}
            onPress={() => onChange(t)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Product Card Component with proper image error handling
function ProductCard({ item, index, onProductPress }) {
  const [imageError, setImageError] = useState(false);

  // Determine image source - handle both dummy data and Firestore products
  let imageSource;
  if (item.coverImage) {
    imageSource = typeof item.coverImage === 'string' 
      ? { uri: item.coverImage } 
      : item.coverImage;
  } else if (item.img) {
    imageSource = typeof item.img === 'string' 
      ? { uri: item.img } 
      : item.img;
  } else {
    // Fallback to default placeholder
    imageSource = require('./assets/pp1.png');
  }

  const fallbackImage = require('./assets/pp1.png');

  return (
    <TouchableOpacity
      key={item.productId || item.id || `product-${index}`}
      style={styles.productCard}
      onPress={() => onProductPress(item.productId || item.id)}
      activeOpacity={0.8}
    >
      <Image
        source={imageError ? fallbackImage : imageSource}
        style={styles.productImg}
        defaultSource={fallbackImage}
        onError={() => setImageError(true)}
      />
      <Text style={styles.productTitle} numberOfLines={1}>
        {item.title || 'Untitled'}
      </Text>

      {/* ⭐ Rating */}
      <View style={styles.ratingRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Ionicons
            key={i}
            name={i < (item.stats?.rating || item.rating || 0) ? "star" : "star-outline"}
            size={12}
            color="#FFD54F"
            style={{ marginRight: 2 }}
          />
        ))}
      </View>

      {/* 🪙 Currency icon + price */}
      <View style={styles.priceRow}>
        {item.currency === 'diamonds' ? (
          <MaterialCommunityIcons name="diamond-stone" size={16} color="#EC4899" />
        ) : (
          <Image source={require("./assets/goldicon.png")} style={styles.goldIcon} />
        )}
        <Text style={styles.priceText}>
          {item.price || 0} {item.currency === 'coins' ? 'Coins' : 'Diamonds'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ProductGrid({ items, onProductPress }) {
  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="package-variant" size={60} color={TEXT_DIM} />
        <Text style={styles.emptyTitle}>No Products Available</Text>
        <Text style={styles.emptyDesc}>Check back later for new items</Text>
      </View>
    );
  }

  return (
    <View style={styles.gridWrap}>
      {items.map((item, index) => (
        <ProductCard
          key={item.productId || item.id || `product-${index}`}
          item={item}
          index={index}
          onProductPress={onProductPress}
        />
      ))}
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerIcons: { flexDirection: "row", gap: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19 },

  balanceRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  balanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#23232A",
  },
  balanceText: { color: "#fff", fontWeight: "600" },

  sellerButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sellerButtonGradient: {
    padding: 14,
  },
  sellerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerButtonTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sellerButtonDesc: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },

  promoCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 14,
  },
  promoTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  promoDesc: { color: "#fff", fontSize: 12, opacity: 0.9, marginTop: 4 },
  promoImage: { width: 70, height: 70 },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  catItem: { alignItems: "center", gap: 6, flex: 1 },
  catIcon: { width: 60, height: 60, borderRadius: 8, resizeMode: "contain" },
  catText: { color: TEXT_DIM, fontSize: 11 },

  libraryQuickAccess: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  libraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 10,
  },
  libraryCard: {
    width: '31%',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  libraryIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  libraryTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  libraryCount: {
    color: TEXT_DIM,
    fontSize: 10,
  },

  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  setupText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 6,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sectionView: { color: CYAN, fontSize: 12, fontWeight: "600" },

  userCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#23232A",
    padding: 10,
    marginRight: 10,
    width: 220,
  },
  userRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10 },
  userName: { color: "#fff", fontWeight: "700" },
  userTag: { color: TEXT_DIM, fontSize: 12 },
  coinBtn: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  coinText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginTop: 14 },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: "#23232A",
  },
  tabPillActive: { backgroundColor: `${ACCENT}26`, borderColor: `${ACCENT}66` },
  tabText: { color: TEXT_DIM, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },

  gridWrap: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingBottom: 30 },
  productCard: {
    width: "47%",
    margin: "1.5%",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#23232A",
    padding: 10,
  },
  productImg: { width: "100%", height: 110, borderRadius: 10, marginBottom: 8 },
  productTitle: { color: "#fff", fontWeight: "700", marginBottom: 6 },
  ratingRow: { flexDirection: "row", marginBottom: 8 },
  priceRow: { flexDirection: "row", alignItems: "center" },
  goldIcon: { width: 16, height: 16, marginRight: 6, resizeMode: "contain" },
  priceText: { color: "#fff", fontWeight: "800" },

  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Store card styles
  storeCard: {
    width: 140,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  storeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  storeName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  storeProducts: {
    color: TEXT_DIM,
    fontSize: 11,
    marginBottom: 6,
  },
  storeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeRating: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '600',
  },
});