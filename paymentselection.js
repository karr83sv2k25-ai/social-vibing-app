// PaymentSelectionScreen.js
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT_DIM = "#9CA3AF";
const CYAN = "#08FFE2";
const BORDER = "#23232A";
const GOLD = "#FFD54F";
const CHIP = "#2A2A33";

export default function PaymentSelectionScreen({ route, navigation }) {
  const item =
    route?.params?.item || {
      name: "Anime chat",
      rating: 5,
      reviews: 50,
      creator: "Ken·Kaneki",
      coins: 5,
      img: require("./assets/pp3.png"),
    };

  const [qty, setQty] = useState(1);
  // method: "coin" | "diamond" | null
  const [method, setMethod] = useState("coin");

  const totalCoins = useMemo(() => item.coins * qty, [item.coins, qty]);

  const handleContinue = () => {
    if (method === "coin") {
      navigation.navigate("CoinPurchase", {
        item,
        qty,
        totalCoins,
        paymentType: "coin",
      });
    } else if (method === "diamond") {
      navigation.navigate("DiamondPurchase", {
        item,
        qty,
        totalCoins,
        paymentType: "diamond",
      });
    } else {
      Alert.alert("Select a method", "Please choose a payment method first.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Top Up coins</Text>
        <TouchableOpacity style={styles.hBtn}>
          <Ionicons name="ellipsis-vertical" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Your balance (title row icon) */}
        <View style={styles.sectionCaptionRow}>
          <Text style={styles.caption}>Your balance :</Text>
          <SmallDot />
        </View>

        {/* Item card */}
        <View style={styles.itemCard}>
          <Image source={item.img} style={styles.thumb} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.nameRow}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.editPill}>
                <Text style={styles.editText}>Editor art</Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons key={i} name={i < item.rating ? "star" : "star-outline"} size={12} color={GOLD} />
              ))}
              <Text style={styles.miniText}> 4.5/5 · {item.reviews}+ Reviews</Text>
            </View>

            <View style={styles.creatorRow}>
              <Ionicons name="person-circle" size={14} color="#6EE7B7" />
              <Text style={styles.creatorText}>{item.creator}</Text>
            </View>

            <View style={styles.coinRow}>
              <Image source={require("./assets/goldicon.png")} style={styles.goldIcon} />
              <Text style={styles.coinText}>{item.coins}</Text>
            </View>
          </View>
        </View>

        {/* Order details caption */}
        <View style={[styles.sectionCaptionRow, { marginTop: 10 }]}>
          <Text style={styles.caption}>Order details</Text>
          <SmallDot />
        </View>

        {/* Quantity */}
        <Row>
          <Text style={styles.rowLabel}>Quantity Details</Text>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={() => setQty((q) => Math.max(1, q - 1))} style={styles.stepBtn}>
              <Ionicons name="remove" size={14} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.stepQty}>{qty}</Text>
            <TouchableOpacity onPress={() => setQty((q) => q + 1)} style={styles.stepBtn}>
              <Ionicons name="add" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </Row>

        {/* Required coins */}
        <Row>
          <Text style={styles.rowLabel}>Required coins</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image source={require("./assets/goldicon.png")} style={styles.goldIcon} />
            <Text style={styles.rowValue}>{totalCoins}</Text>
          </View>
        </Row>

        {/* Coupons */}
        <Row>
          <Text style={styles.rowLabel}>Coupons</Text>
          <TouchableOpacity style={styles.couponBtn}>
            <Text style={styles.couponText}>apply coupon</Text>
            <Ionicons name="chevron-forward" size={14} color={CYAN} />
          </TouchableOpacity>
        </Row>

        {/* Total required */}
        <Row last>
          <Text style={[styles.rowLabel, { fontWeight: "800" }]}>Total coins required</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image source={require("./assets/goldicon.png")} style={styles.goldIcon} />
            <Text style={[styles.rowValue, { fontWeight: "800" }]}>{totalCoins}</Text>
          </View>
        </Row>

        {/* Choose payment method */}
        <Text style={[styles.caption, { marginHorizontal: 14, marginTop: 12, marginBottom: 8 }]}>
          Choose a payment method
        </Text>
        <View style={styles.methodCard}>
          {/* Pay with coins */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.methodRow, method === "coin" && styles.methodActive]}
            onPress={() => setMethod("coin")}
          >
            <View style={styles.methodLeft}>
              <MaterialCommunityIcons name="cash-multiple" size={18} color="#fff" />
              <Text style={styles.methodText}>Pay with coins</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Select coin</Text>
              <Ionicons name="chevron-down" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Pay with diamonds */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.methodRow, method === "diamond" && styles.methodActive]}
            onPress={() => setMethod("diamond")}
          >
            <View style={styles.methodLeft}>
              <MaterialCommunityIcons name="diamond-stone" size={18} color="#fff" />
              <Text style={styles.methodText}>Pay with diamonds</Text>
            </View>
            <View style={[styles.selectChip, { backgroundColor: "#2c2230", borderColor: "#874CFF" }]}>
              <Text style={styles.selectChipText}>Select diamond</Text>
              <Ionicons name="chevron-down" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Continue button (gradient) */}
        <View style={{ paddingHorizontal: 14, marginTop: 14 }}>
          <LinearGradient
            colors={["rgba(255,6,200,0.4)", "rgba(255,6,200,0.1)"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaWrap}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.ctaBtn}
              onPress={handleContinue}
              // disabled={!method} // optional: disable if nothing selected
            >
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ——— tiny helpers ——— */
const Row = ({ children, last }) => (
  <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: BORDER }]}>
    {children}
  </View>
);

const SmallDot = () => (
  <View style={styles.orangeDot}>
    <Ionicons name="ellipse" size={10} color="#FFA74D" />
  </View>
);

/* ——— styles ——— */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  hTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },

  sectionCaptionRow: {
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  caption: { color: TEXT_DIM, fontSize: 12, fontWeight: "700" },
  orangeDot: {
    backgroundColor: CARD, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center",
  },

  itemCard: {
    marginHorizontal: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: { width: 54, height: 54, borderRadius: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemName: { color: "#fff", fontSize: 14, fontWeight: "800", flex: 1, marginRight: 10 },
  editPill: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: CHIP, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  editText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 2 },
  miniText: { color: "#fff", fontSize: 11 },
  creatorRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  creatorText: { color: "#fff", fontSize: 12, marginLeft: 6 },
  coinRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  goldIcon: { width: 16, height: 16, resizeMode: "contain", marginRight: 6 },
  coinText: { color: "#fff", fontWeight: "800" },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  rowLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  rowValue: { color: "#fff", fontSize: 13, fontWeight: "700" },

  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  stepQty: { color: "#fff", fontWeight: "800", minWidth: 16, textAlign: "center" },

  couponBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  couponText: { color: CYAN, fontWeight: "700", fontSize: 12 },

  methodCard: {
    marginHorizontal: 14,
    padding: 10,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  methodRow: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#17171C",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  methodActive: { borderColor: CYAN + "80" },
  methodLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  methodText: { color: "#fff", fontWeight: "700" },

  selectChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#243036",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: "#2F4852",
  },
  selectChipText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  ctaWrap: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FF069B",
    shadowColor: "#FF1468",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    justifyContent: "center",
  },
  ctaBtn: { alignItems: "center", justifyContent: "center", height: "100%" },
  ctaText: { color: "#fff", fontWeight: "900" },
});

