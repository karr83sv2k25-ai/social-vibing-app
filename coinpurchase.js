// CoinPurchaseScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BG = "#0B0B0E";
const CARD = "#17171C";
const BORDER = "#23232A";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9CA3AF";
const GOLD = "#FFB300";
const GREEN = "#00FF73";

const COINS = [
  { id: 1, amount: "60 Coins", price: "$100", icon: require("./assets/coin1.png") },
  { id: 2, amount: "120 Coins", price: "$100", icon: require("./assets/coin2.png") },
  { id: 3, amount: "180 Coins", price: "$100", icon: require("./assets/coin3.png") },
  { id: 4, amount: "240 Coins", price: "$100", icon: require("./assets/coin4.png") },
  { id: 5, amount: "300 Coins", price: "$100", icon: require("./assets/coin5.png") },
  { id: 6, amount: "400 Coins", price: "$100", icon: require("./assets/coin6.png") },
];

export default function CoinPurchaseScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* 🔹 Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Up coins</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 💰 Balance Label */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Your balance :</Text>
          <TouchableOpacity style={styles.orangeDot}>
            <Ionicons name="ellipse" size={10} color="#FFA74D" />
          </TouchableOpacity>
        </View>

        {/* 🪙 Coins Grid */}
        <View style={styles.grid}>
          {COINS.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("PaymentSelection", { item: c })}
            >
              <Image source={c.icon} style={styles.coinIcon} />
              <Text style={styles.amountText}>{c.amount}</Text>
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>{c.price}</Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerTitle: { color: TEXT, fontSize: 16, fontWeight: "800" },

  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  balanceLabel: { color: TEXT_DIM, fontSize: 13, fontWeight: "700" },
  orangeDot: {
    backgroundColor: CARD,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 30,
  },

  card: {
    width: "47%",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginBottom: 12,
  },
  coinIcon: {
    width: 60,
    height: 60,
    resizeMode: "contain",
    marginBottom: 8,
  },
  amountText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  pricePill: {
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 13,
  },
});
