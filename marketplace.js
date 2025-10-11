import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  const [activeTab, setActiveTab] = useState("Popular");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
          <TouchableOpacity style={styles.balanceBtn}>
            <Ionicons name="logo-usd" size={16} color={CYAN} />
            <Text style={styles.balanceText}>5 Coins</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.balanceBtn}>
            <MaterialCommunityIcons name="diamond-stone" size={16} color="#ff00ff" />
            <Text style={styles.balanceText}>2 Diamonds</Text>
          </TouchableOpacity>
        </View>

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

        {/* 🧩 Categories */}
        <View style={styles.categoryRow}>
          <Category icon={require("./assets/character.png")} label="" />
          <Category icon={require("./assets/profileframe.png")} label="" />
          <Category icon={require("./assets/chatbubbles.png")} label="" />
          <Category icon={require("./assets/photos.png")} label="" />
        </View>

        {/* 🔸 Colors Section */}
        <Section title="Colors" data={USERS} />
        {/* 🔸 Characters Section */}
        <Section title="Characters" data={USERS} />
        {/* 🔸 Message Bubbles Section */}
        <Section title="Message Bubbles" data={USERS} />

        {/* Tabs + Product Grid */}
        <FilterTabs active={activeTab} onChange={setActiveTab} />
        <ProductGrid items={FILTERS[activeTab] || []} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Small Components ---------- */
function Category({ icon, label }) {
  return (
    <TouchableOpacity style={styles.catItem}>
      <Image source={icon} style={styles.catIcon} />
      {!!label && <Text style={styles.catText}>{label}</Text>}
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

function ProductGrid({ items }) {
  return (
    <View style={styles.gridWrap}>
      {items.map((it) => (
        <View style={styles.productCard} key={it.id}>
          <Image source={it.img} style={styles.productImg} />
          <Text style={styles.productTitle} numberOfLines={1}>{it.title}</Text>

          {/* ⭐ Rating */}
          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < it.rating ? "star" : "star-outline"}
                size={12}
                color="#FFD54F"
                style={{ marginRight: 2 }}
              />
            ))}
          </View>

          {/* 🪙 Gold coin + price */}
          <View style={styles.priceRow}>
            <Image source={require("./assets/goldicon.png")} style={styles.goldIcon} />
            <Text style={styles.priceText}>{it.price} Coins</Text>
          </View>
        </View>
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
  catItem: { alignItems: "center", gap: 6 },
  catIcon: { width: 72, height: 72, borderRadius: 8, resizeMode: "contain" },
  catText: { color: TEXT_DIM, fontSize: 12 },

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
});
