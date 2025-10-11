import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9CA3AF";

const THEMES = [
  { id: 1, name: "Edward Elric", rating: 5, coins: 5, img: require("./assets/pp1.png") },
  { id: 2, name: "Isaac Netero", rating: 4, coins: 40, img: require("./assets/pp2.png") },
  { id: 3, name: "Ken Kaneki", rating: 5, coins: 100, img: require("./assets/pp3.png") },
  { id: 4, name: "Izuku Midoriya", rating: 4, coins: 20, img: require("./assets/pp4.png") },
  { id: 5, name: "Satoru Gojo", rating: 5, coins: 200, img: require("./assets/pp5.png") },
  { id: 6, name: "Tengen Uzui", rating: 4, coins: 140, img: require("./assets/pp6.png") },
];

export default function ThemesScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* 🔙 Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Themes</Text>
        <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
      </View>

      {/* 🖼️ Grid */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {THEMES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("StickerPreview", { item })}
            >
              <Image source={item.img} style={styles.image} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>

              {/* ⭐ Rating */}
              <View style={styles.ratingRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < item.rating ? "star" : "star-outline"}
                    size={12}
                    color="#FFD54F"
                  />
                ))}
              </View>

              {/* 🪙 Coins */}
              <View style={styles.coinRow}>
                <Image source={require("./assets/goldicon.png")} style={styles.goldIcon} />
                <Text style={styles.coinText}>{item.coins}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
    paddingBottom: 10,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 30,
  },
  card: {
    width: "47%",
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#23232A",
    padding: 10,
    marginBottom: 12,
  },
  image: { width: "100%", height: 110, borderRadius: 8, marginBottom: 6 },
  name: { color: TEXT, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  ratingRow: { flexDirection: "row", marginBottom: 4, gap: 2 },
  coinRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  goldIcon: { width: 15, height: 15, resizeMode: "contain" },
  coinText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
