// MembershipScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const C = {
  bg: "#0B0B10",
  card: "#14171C",
  card2: "#1A1F27",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  border: "#232833",
  gold: "#FFD54F",
  purple: "#7C3AED",
};

export default function MembershipScreen({ navigation }) {
  const perks = [
    {
      icon: <Ionicons name="ribbon-outline" size={18} color="#EAEAF0" />,
      title: "Prime Badge",
      desc: "A badge next to your username",
    },
    {
      icon: <Ionicons name="gift-outline" size={18} color="#EAEAF0" />,
      title: "Monthly Gifts",
      desc: "Monthly gifts include extra account visibility",
    },
    {
      icon: <Ionicons name="color-palette-outline" size={18} color="#EAEAF0" />,
      title: "Customized Nickname",
      desc: "Display your nickname in any color you want",
    },
    {
      icon: <Ionicons name="checkmark-done-outline" size={18} color="#EAEAF0" />,
      title: "Double Check-in Rewards",
      desc: "Prime members get more rewards for being active",
    },
    {
      icon: <Ionicons name="apps-outline" size={18} color="#EAEAF0" />,
      title: "Stylish App Icons",
      desc: "Choose from stylish app icons for your phone’s homepage",
    },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 28 }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Membership</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Banner */}
      <View style={s.bannerWrap}>
        <ImageBackground
          source={require("./assets/homebackground.jpg")} 
          style={s.banner}
          imageStyle={{ borderRadius: 18 }}
        >
          <View style={s.bannerInner}>
            <Image source={require("./assets/crown.png")} style={s.crown} />
            <Text style={s.bannerHeadline}>
              SUBSCRIBE AND UNLOCK THE{"\n"}
              <Text style={s.bannerHighlight}>EXCLUSIVE FEATURES !</Text>
            </Text>
          </View>
        </ImageBackground>
      </View>

      {/* Perks list */}
      <View style={s.listCard}>
        {perks.map((p, i) => (
          <View key={i} style={[s.row, i !== perks.length - 1 && s.rowDivider]}>
            <View style={s.iconWrap}>{p.icon}</View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.rowTitle}>{p.title}</Text>
              <Text style={s.rowDesc}>{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Subscribe CTA */}
      <TouchableOpacity activeOpacity={0.9} style={s.ctaWrap}>
        <LinearGradient
          colors={["#E24ECF", "#8A2BE2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.ctaBtn}
        >
          <Text style={s.ctaText}>SUBSCRIBE NOW !</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ---------------- Styles ---------------- */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 36,
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "800" },

  /* BANNER */
  bannerWrap: { marginTop: 14 },
  banner: { width: "100%", height: 220, justifyContent: "flex-end" },
  bannerInner: { padding: 18, alignItems: "center", marginBottom: 10 },
  crown: { width: 36, height: 36, resizeMode: "contain", marginBottom: 8 },
  bannerHeadline: {
    color: "#fff",
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Bangers", // ✅ custom font
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 26, // 120%
    letterSpacing: 0,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerHighlight: { color: C.gold, fontFamily: "Bangers" },

  /* PERKS LIST */
  listCard: {
    marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: C.text, fontWeight: "700", fontSize: 14 },
  rowDesc: { color: C.dim, fontSize: 12, marginTop: 2 },

  /* CTA BUTTON */
  ctaWrap: {
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#9F7AEA",
  },
  ctaBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Bangers", // ✅ optional same font for button
    fontWeight: "400",
    textAlign: "center",
    letterSpacing: 0,
  },
});
