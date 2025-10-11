// RewardCenterScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function RewardCenterScreen({ navigation }) {
  const [stars, setStars] = useState(3); // daily reward progress (0-5)

  const milestoneCards = [
    { title: "Complete 5 Chats", img: require("./assets/ch1.jpg"), coins: 20, gems: 1 },
    { title: "Win 3 Battles", img: require("./assets/ch2.jpg"), coins: 40, gems: 2 },
    { title: "Login 7 Days", img: require("./assets/ch3.jpg"), coins: 60, gems: 3 },
  ];

  const StatPill = ({ icon, label }) => (
    <View style={styles.statPill}>
      {icon}
      <Text style={styles.statText}>{label}</Text>
    </View>
  );

  const Feature = ({ icon, label }) => (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>{icon}</View>
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reward Center</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Banner with overlay content */}
      <View style={styles.bannerWrap}>
        <ImageBackground
          source={require("./assets/rewardbanner.jpg")}
          style={styles.banner}
          imageStyle={{ borderRadius: 16 }}
        >
          <View style={styles.bannerOverlay}>
            <View style={styles.headlineRow}>
              <Image source={require("./assets/trophy.png")} style={styles.shield} />
              <Text style={styles.headline}>
                COMPLETE THE TASKS AND EARN{"\n"}
                <Text style={styles.highlight}>EXCITED REWARDS !</Text>
              </Text>
            </View>

            {/* Feature rows */}
            <View style={styles.featuresRow}>
              <Feature icon={<Ionicons name="cash" size={16} color="#fff" />} label="Coins" />
              <Feature icon={<Ionicons name="diamond" size={16} color="#fff" />} label="Diamonds" />
              <Feature icon={<Ionicons name="people" size={16} color="#fff" />} label="Followers" />
            </View>
            <View style={[styles.featuresRow, { marginTop: 8 }]}>
              <Feature icon={<Ionicons name="image" size={16} color="#fff" />} label="Frames" />
              <Feature icon={<Ionicons name="albums" size={16} color="#fff" />} label="Collections" />
            </View>
          </View>
        </ImageBackground>

        {/* Stats pills at bottom of banner */}
        <View style={styles.statsRow}>
          <StatPill
            icon={<Image source={require("./assets/goldicon.png")} style={styles.pillIcon} />}
            label="120"
          />
          <StatPill
            icon={<Image source={require("./assets/diamond1.png")} style={styles.pillIcon} />}
            label="8"
          />
          <StatPill icon={<Ionicons name="flame" size={14} color="#FFD54F" />} label="Streak 4" />
        </View>
      </View>

      {/* Milestone Challenges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Milestone Challenges</Text>

        {/* Outer blue card */}
        <View style={styles.sectionCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {milestoneCards.map((c, i) => (
              <View key={i} style={styles.milestoneCard}>
                <Image source={c.img} style={styles.milestoneImg} />
                <Text style={styles.milestoneTitle} numberOfLines={1}>
                  {c.title}
                </Text>
                <View style={styles.rewardsRow}>
                  <Image source={require("./assets/goldicon.png")} style={styles.rewardIcon} />
                  <Text style={styles.rewardText}>{c.coins}</Text>
                  <Image
                    source={require("./assets/diamond1.png")}
                    style={[styles.rewardIcon, { marginLeft: 10 }]}
                  />
                  <Text style={styles.rewardText}>{c.gems}</Text>
                </View>
                <TouchableOpacity style={styles.claimBtn}>
                  <Text style={styles.claimText}>Claim</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.helperNote}>Reward cards will be updated every 1 hour</Text>
        </View>
      </View>

      {/* Daily Reward Stars */}
      <View style={styles.dailyWrap}>
        <LinearGradient colors={["#3B1C48", "#161A22"]} style={styles.dailyCard}>
          <View style={styles.dailyLeft}>
            <Text style={styles.dailyTitle}>Daily Rewards</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < stars ? "star" : "star-outline"}
                  size={18}
                  color="#FFB84D"
                  style={{ marginRight: 4 }}
                />
              ))}
            </View>
          </View>

          {/* ⬇️ UPDATED: navigate to DailyReward on press */}
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate("DailyReward")}
            activeOpacity={0.85}
          >
            <Text style={styles.viewText}>View</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Watch Video CTA */}
      <TouchableOpacity activeOpacity={0.9} style={styles.watchWrap}>
        <LinearGradient
          colors={["#FFD54F", "#F9A825"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.watchCard}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="play-circle" size={22} color="#1A1F27" />
            <Text style={styles.watchTitle}>Watch Video and</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.watchEarn}>Earn 10</Text>
            <Image source={require("./assets/goldicon.png")} style={[styles.rewardIcon, { marginLeft: 6 }]} />
            <Text style={styles.watchEarn}>Coins</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ---------------- Styles ---------------- */
const BG = "#0B0B10";
const CARD = "#14171C";
const CARD2 = "#1A1F27";
const BORDER = "#232833";
const TEXT = "#EAEAF0";
const DIM = "#A2A8B3";
const BLUE = "#00BFFF";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  bannerWrap: { marginTop: 16, borderRadius: 16, overflow: "hidden" },
  banner: {
    width: "100%",
    height: 190,
    resizeMode: "cover",
    justifyContent: "flex-end",
    paddingBottom: 56,
  },

  // Overlay content
  bannerOverlay: { paddingHorizontal: 14, paddingTop: 10 },
  headlineRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  shield: { width: 34, height: 34, resizeMode: "contain", marginRight: 8 },
  headline: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  highlight: { color: "#FFD54F" },

  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 18,
  },
  featureItem: { flexDirection: "row", alignItems: "center" },
  featureIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  featureText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Stats pills floating at bottom of banner
  statsRow: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,23,28,0.85)",
    borderColor: BORDER,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statText: { color: "#EAEAF0", fontWeight: "700", marginLeft: 6, fontSize: 12 },
  pillIcon: { width: 14, height: 14, resizeMode: "contain" },

  // Section + cards
  section: { marginTop: 18 },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: "700", marginBottom: 8 },

  // Outer blue container for milestone cards
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },

  milestoneCard: {
    width: 170,
    backgroundColor: CARD2,
    borderRadius: 14,
    padding: 10,
    marginRight: 12,
    borderWidth: 2,
    borderColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  milestoneImg: { width: "100%", height: 110, borderRadius: 10, marginBottom: 8 },
  milestoneTitle: { color: TEXT, fontWeight: "700", fontSize: 13 },
  rewardsRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  rewardIcon: { width: 16, height: 16, resizeMode: "contain" },
  rewardText: { color: "#FFD54F", fontWeight: "700", marginLeft: 4, fontSize: 12 },
  claimBtn: {
    marginTop: 10,
    backgroundColor: "#0F1A22",
    borderColor: "#21313A",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  claimText: { color: "#8CE9FF", fontWeight: "700", fontSize: 12 },
  helperNote: { color: "#A2A8B3", fontSize: 11, marginTop: 10, textAlign: "center" },

  // Daily rewards
  dailyWrap: { marginTop: 14 },
  dailyCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3A2143",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dailyLeft: {},
  dailyTitle: { color: TEXT, fontWeight: "700", marginBottom: 6 },
  starsRow: { flexDirection: "row", alignItems: "center" },
  viewBtn: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewText: { color: TEXT, fontWeight: "700", fontSize: 12 },

  // Watch video CTA
  watchWrap: { marginTop: 14, marginBottom: 24 },
  watchCard: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#C49124",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  watchTitle: { color: "#1A1F27", fontWeight: "800", fontSize: 14, marginLeft: 8 },
  watchEarn: { color: "#1A1F27", fontWeight: "900", fontSize: 14, marginLeft: 4 },
});
