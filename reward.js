// RewardCenterScreen.js – Connected to WalletContext and dailyRewardsService
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { useWallet } from "./context/WalletContext";
import {
  subscribeToDailyRewards,
  getDailyRewardsData,
  claimTaskReward,
  DAILY_TASKS,
  STREAK_BONUSES,
  getNextStreakMilestone,
} from "./shared/services/dailyRewardsService";

export default function RewardCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { wallet, claimAdReward } = useWallet();
  const [userId, setUserId] = useState(null);
  const [rewardsData, setRewardsData] = useState(null);
  const [claimingAd, setClaimingAd] = useState(false);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (uid) setUserId(uid);
  }, []);

  // Real-time daily rewards subscription
  useEffect(() => {
    if (!userId) return;
    let unsub;

    getDailyRewardsData(db, userId)
      .then((data) => {
        setRewardsData(data);
        unsub = subscribeToDailyRewards(db, userId, setRewardsData);
      })
      .catch(console.error);

    return () => { if (unsub) unsub(); };
  }, [userId]);

  // Derive progress
  const taskList = rewardsData
    ? Object.values(DAILY_TASKS).map((cfg) => ({
        ...cfg,
        taskState: rewardsData.tasks?.[cfg.id] || { status: "locked" },
      }))
    : [];

  const completedTasks = taskList.filter(t => t.taskState.status === "claimed").length;
  const totalTasks = taskList.length;
  const streak = rewardsData?.streak || 0;
  const nextMilestone = getNextStreakMilestone(streak);

  // Watch ad reward
  const handleWatchAd = useCallback(async () => {
    if (claimingAd || !userId) return;
    setClaimingAd(true);
    try {
      // Claim watch_ad daily task if available
      const watchAdTask = taskList.find(t => t.id === DAILY_TASKS.WATCH_AD.id);
      if (watchAdTask && watchAdTask.taskState.status === "available") {
        await claimTaskReward(db, userId, DAILY_TASKS.WATCH_AD.id, null);
      }
      // Also credit ad coins via WalletContext (tracks ad revenue separately)
      if (claimAdReward) {
        const result = await claimAdReward();
        Alert.alert("Reward!", `You earned ${result.coinsEarned} coins for watching the ad!`);
      } else {
        Alert.alert("Reward!", "Coins added to your wallet!");
      }
    } catch (err) {
      Alert.alert("Oops", err.message || "Could not claim ad reward. Try again later.");
    } finally {
      setClaimingAd(false);
    }
  }, [claimingAd, userId, taskList, claimAdReward]);

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

  const milestoneCards = [
    { title: "Complete 5 Chats", coins: 0, gems: 1, progress: null },
    { title: "Win 3 Battles", coins: 0, gems: 2, progress: null },
    {
      title: "Login 7 Days",
      coins: 0,
      gems: 3,
      progress: streak >= 7 ? "done" : `${streak}/7 days`,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reward Center</Text>
        {/* Leaderboard shortcut */}
        <TouchableOpacity onPress={() => navigation.navigate("GlobalLeaderboard")}>
          <Ionicons name="trophy-outline" size={22} color="#FFD54F" />
        </TouchableOpacity>
      </View>

      {/* Banner */}
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

        {/* Real stats pills */}
        <View style={styles.statsRow}>
          <StatPill
            icon={<Image source={require("./assets/goldicon.png")} style={styles.pillIcon} />}
            label={`${wallet.coins ?? 0}`}
          />
          <StatPill
            icon={<Image source={require("./assets/diamond1.png")} style={styles.pillIcon} />}
            label={`${wallet.diamonds ?? 0}`}
          />
          <StatPill
            icon={<Ionicons name="flame" size={14} color="#FFD54F" />}
            label={`Streak ${streak}`}
          />
        </View>
      </View>

      {/* Milestone Challenges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Milestone Challenges</Text>
        <View style={styles.sectionCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {milestoneCards.map((c, i) => (
              <View key={i} style={styles.milestoneCard}>
                <View style={styles.milestonePlaceholder}>
                  <Ionicons name="trophy" size={40} color="#FFD54F" />
                </View>
                <Text style={styles.milestoneTitle} numberOfLines={2}>{c.title}</Text>
                {c.progress && (
                  <Text style={styles.milestoneProgress}>{c.progress}</Text>
                )}
                <View style={styles.rewardsRow}>
                  <Image source={require("./assets/goldicon.png")} style={styles.rewardIcon} />
                  <Text style={styles.rewardText}>{c.coins}</Text>
                  <Image source={require("./assets/diamond1.png")} style={[styles.rewardIcon, { marginLeft: 10 }]} />
                  <Text style={styles.rewardText}>{c.gems}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.claimBtn, c.progress === "done" && styles.claimBtnDone]}
                  disabled={c.progress !== "done"}
                  onPress={() => c.progress === "done" && Alert.alert("Claimed!", "Milestone reward credited.")}
                >
                  <Text style={styles.claimText}>
                    {c.progress === "done" ? "Claim" : "In Progress"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.helperNote}>Reward cards update daily</Text>
        </View>
      </View>

      {/* Daily Reward (real progress) */}
      <View style={styles.dailyWrap}>
        <LinearGradient colors={["#3B1C48", "#161A22"]} style={styles.dailyCard}>
          <View style={styles.dailyLeft}>
            <Text style={styles.dailyTitle}>Daily Rewards</Text>

            {/* Stars = tasks completed */}
            <View style={styles.starsRow}>
              {Array.from({ length: totalTasks || 6 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < completedTasks ? "star" : "star-outline"}
                  size={16}
                  color="#FFB84D"
                  style={{ marginRight: 3 }}
                />
              ))}
            </View>
            <Text style={styles.dailySub}>
              {completedTasks}/{totalTasks || 6} tasks · +{rewardsData?.coinsEarnedToday || 0} coins today
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate("DailyReward")}
          >
            <Text style={styles.viewText}>View</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Streak milestone progress */}
      {nextMilestone && (
        <View style={styles.streakProgressCard}>
          <Ionicons name="flame" size={22} color="#FF8C42" />
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={styles.streakProgressTitle}>
              {streak} Day Streak → {nextMilestone.label}
            </Text>
            <View style={styles.streakTrack}>
              <View
                style={[
                  styles.streakFill,
                  { width: `${Math.min(100, (streak / nextMilestone.days) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.streakProgressSub}>
              {nextMilestone.days - streak} more days to unlock {nextMilestone.label}
            </Text>
          </View>
        </View>
      )}

      {/* Watch Video CTA */}
      <TouchableOpacity activeOpacity={0.9} style={styles.watchWrap} onPress={handleWatchAd} disabled={claimingAd}>
        <LinearGradient
          colors={["#FFD54F", "#F9A825"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.watchCard}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {claimingAd
              ? <ActivityIndicator size="small" color="#1A1F27" />
              : <Ionicons name="play-circle" size={22} color="#1A1F27" />}
            <Text style={styles.watchTitle}>Watch Video and</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.watchEarn}>Earn {DAILY_TASKS.WATCH_AD.reward || 5}</Text>
            <Image source={require("./assets/goldicon.png")} style={[styles.rewardIcon, { marginLeft: 6 }]} />
            <Text style={styles.watchEarn}>Coins</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Global Leaderboard CTA */}
      <TouchableOpacity
        style={styles.leaderboardCTA}
        onPress={() => navigation.navigate("GlobalLeaderboard")}
      >
        <Ionicons name="trophy" size={20} color="#FFD700" />
        <Text style={styles.leaderboardCTAText}>View Global Leaderboard</Text>
        <Ionicons name="chevron-forward" size={18} color="#A2A8B3" />
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
const PURPLE = "#7C3AED";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  bannerWrap: { marginTop: 4, borderRadius: 16, overflow: "hidden" },
  banner: {
    width: "100%",
    height: 190,
    resizeMode: "cover",
    justifyContent: "flex-end",
    paddingBottom: 56,
  },
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
  featuresRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  featureItem: { flexDirection: "row", alignItems: "center" },
  featureIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
    marginRight: 6, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  featureText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },

  statsRow: {
    position: "absolute", bottom: 10, left: 10, right: 10,
    flexDirection: "row", justifyContent: "space-between",
  },
  statPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(20,23,28,0.85)",
    borderColor: BORDER, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  statText: { color: "#EAEAF0", fontWeight: "700", marginLeft: 6, fontSize: 12 },
  pillIcon: { width: 14, height: 14, resizeMode: "contain" },

  section: { marginTop: 18 },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 12,
    borderWidth: 2, borderColor: BLUE,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6, elevation: 6,
  },
  milestoneCard: {
    width: 170, backgroundColor: CARD2, borderRadius: 14,
    padding: 10, marginRight: 12, borderWidth: 2, borderColor: BLUE,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6, elevation: 6,
  },
  milestonePlaceholder: {
    width: "100%", height: 90, borderRadius: 10, marginBottom: 8,
    backgroundColor: "#1A1F27", alignItems: "center", justifyContent: "center",
  },
  milestoneTitle: { color: TEXT, fontWeight: "700", fontSize: 13, minHeight: 32 },
  milestoneProgress: { color: DIM, fontSize: 11, marginTop: 2 },
  rewardsRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  rewardIcon: { width: 16, height: 16, resizeMode: "contain" },
  rewardText: { color: "#FFD54F", fontWeight: "700", marginLeft: 4, fontSize: 12 },
  claimBtn: {
    marginTop: 10, backgroundColor: "#0F1A22",
    borderColor: "#21313A", borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, alignItems: "center",
  },
  claimBtnDone: { backgroundColor: "#0F3A1F", borderColor: "#1A6A2F" },
  claimText: { color: "#8CE9FF", fontWeight: "700", fontSize: 12 },
  helperNote: { color: DIM, fontSize: 11, marginTop: 10, textAlign: "center" },

  dailyWrap: { marginTop: 14 },
  dailyCard: {
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#3A2143",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  dailyLeft: { flex: 1 },
  dailyTitle: { color: TEXT, fontWeight: "700", marginBottom: 6 },
  starsRow: { flexDirection: "row", alignItems: "center" },
  dailySub: { color: DIM, fontSize: 11, marginTop: 4 },
  viewBtn: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  viewText: { color: TEXT, fontWeight: "700", fontSize: 12 },

  streakProgressCard: {
    marginTop: 12, flexDirection: "row", alignItems: "center",
    backgroundColor: CARD, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#FF8C4240",
  },
  streakProgressTitle: { color: TEXT, fontWeight: "700", fontSize: 13 },
  streakTrack: {
    height: 6, backgroundColor: CARD2, borderRadius: 3, marginTop: 6, overflow: "hidden",
  },
  streakFill: { height: "100%", backgroundColor: "#FF8C42", borderRadius: 3 },
  streakProgressSub: { color: DIM, fontSize: 11, marginTop: 4 },

  watchWrap: { marginTop: 14 },
  watchCard: {
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#C49124",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  watchTitle: { color: "#1A1F27", fontWeight: "800", fontSize: 14, marginLeft: 8 },
  watchEarn: { color: "#1A1F27", fontWeight: "900", fontSize: 14, marginLeft: 4 },

  leaderboardCTA: {
    marginTop: 12, flexDirection: "row", alignItems: "center",
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#FFD70030",
  },
  leaderboardCTAText: { flex: 1, color: TEXT, fontWeight: "700", fontSize: 14, marginLeft: 10 },
});
