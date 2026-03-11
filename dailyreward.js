// DailyRewardScreen.js – Fully connected to Firestore via dailyRewardsService
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Share,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { useWallet } from "./context/WalletContext";
import {
  subscribeToDailyRewards,
  getDailyRewardsData,
  claimTaskReward,
  unlockTask,
  DAILY_TASKS,
  STREAK_BONUSES,
  getStreakBonus,
  getNextStreakMilestone,
  getTimeUntilMidnight,
  formatTimeRemaining,
} from "./shared/services/dailyRewardsService";

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: "#0B0B10",
  card: "#14171C",
  card2: "#1A1F27",
  border: "#232833",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  purple: "#7C3AED",
  magenta: "#E91E8C",
  blue: "#00BFFF",
  gold: "#FFD54F",
  green: "#00E676",
  orange: "#FF8C42",
  red: "#FF4757",
};

const TASK_ICONS = {
  [DAILY_TASKS.CHECK_IN.id]: "calendar-check",
  [DAILY_TASKS.TIME_SPENT.id]: "timer-outline",
  [DAILY_TASKS.INVITE_FRIEND.id]: "account-plus",
  [DAILY_TASKS.WATCH_AD.id]: "play-circle",
  [DAILY_TASKS.FIRST_POST.id]: "pencil",
  [DAILY_TASKS.FIRST_COMMENT.id]: "comment-text-outline",
};

// ── Main Screen ─────────────────────────────────────────────────────────────────
export default function DailyRewardScreen({ navigation }) {
  const { wallet, fetchWallet } = useWallet();
  const [userId, setUserId] = useState(null);
  const [rewardsData, setRewardsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  const [streakBonus, setStreakBonus] = useState(null);
  const countdownRef = useRef(null);
  const flashAnim = useRef(new Animated.Value(1)).current;

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (uid) setUserId(uid);
  }, []);

  // Countdown timer (resets at midnight)
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  // Real-time Firestore subscription
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    let unsub;

    // Bootstrap first, then subscribe
    getDailyRewardsData(db, userId)
      .then((data) => {
        setRewardsData(data);
        // Show streak bonus toast if awarded today
        if (data?.streakBonusAwarded) setStreakBonus(data.streakBonusAwarded);
        setLoading(false);

        // Start live subscription
        unsub = subscribeToDailyRewards(db, userId, (liveData) => {
          setRewardsData(liveData);
        });
      })
      .catch((err) => {
        console.error("DailyReward bootstrap error:", err);
        setLoading(false);
      });

    return () => { if (unsub) unsub(); };
  }, [userId]);

  // Handle claim
  const handleClaim = useCallback(async (taskId) => {
    if (claimingId || !userId) return;
    setClaimingId(taskId);
    try {
      const result = await claimTaskReward(db, userId, taskId, { fetchWallet });
      if (result.success) {
        // Animate coin flash
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1.4, duration: 150, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        await fetchWallet();
      } else if (result.alreadyClaimed) {
        Alert.alert("Already Claimed", "You already claimed this reward today!");
      } else if (result.locked) {
        Alert.alert("Not Unlocked Yet", "Complete the task first.");
      }
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to claim reward. Please try again.");
    } finally {
      setClaimingId(null);
    }
  }, [claimingId, userId, fetchWallet, flashAnim]);

  // Handle invite friend action – open share sheet then unlock the task
  const handleInvite = useCallback(async () => {
    if (inviting || !userId) return;
    setInviting(true);
    try {
      const result = await Share.share({
        message:
          "Join me on Social Vibing! Download the app and connect with me 🎉\nhttps://socialvibingapp.karr83anime.com",
        title: "Join Social Vibing!",
      });
      if (result.action === Share.sharedAction) {
        // Unlock the task so the user can claim their reward
        await unlockTask(db, userId, DAILY_TASKS.INVITE_FRIEND.id);
        Alert.alert(
          "Invite Sent! 🎉",
          "Your invite task is now unlocked. Tap \"Claim\" to complete it!"
        );
      }
    } catch (err) {
      console.error("Share error:", err);
    } finally {
      setInviting(false);
    }
  }, [inviting, userId]);

  // Build ordered task list
  const taskList = rewardsData
    ? Object.values(DAILY_TASKS).map((cfg) => ({
        ...cfg,
        taskState: rewardsData.tasks?.[cfg.id] || { status: "locked" },
      }))
    : [];

  // Separate the check-in task for the hero card
  const checkInTask = taskList.find(t => t.id === DAILY_TASKS.CHECK_IN.id);
  const remainingTasks = taskList.filter(t => t.id !== DAILY_TASKS.CHECK_IN.id);

  const totalTasks = taskList.length;
  const completedTasks = taskList.filter(t => t.taskState.status === "claimed").length;
  const progressPct = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const streak = rewardsData?.streak || 0;
  const coinsToday = rewardsData?.coinsEarnedToday || 0;
  const timeMinutes = rewardsData?.timeSpentMinutes || 0;
  const nextMilestone = getNextStreakMilestone(streak);

  // ── Streak bonus toast ──────────────────────────────────────────────────────
  const StreakBonusToast = () => {
    if (!streakBonus) return null;
    return (
      <View style={s.streakToast}>
        <Text style={s.streakToastEmoji}>🎉</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.streakToastTitle}>{streakBonus.label} Bonus!</Text>
          <Text style={s.streakToastSub}>
            {streak}-day streak milestone achieved! 🔥
          </Text>
        </View>
        <TouchableOpacity onPress={() => setStreakBonus(null)}>
          <Ionicons name="close" size={18} color={C.dim} />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.purple} size="large" />
        <Text style={{ color: C.dim, marginTop: 12 }}>Loading rewards…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Daily Rewards</Text>
        {/* Coin balance */}
        <Animated.View style={[s.coinBadge, { transform: [{ scale: flashAnim }] }]}>
          <Ionicons name="cash" size={14} color={C.gold} />
          <Text style={s.coinBadgeText}>{wallet.coins ?? 0}</Text>
        </Animated.View>
      </View>

      {/* Streak bonus toast */}
      <StreakBonusToast />

      {/* Hero stats card */}
      <LinearGradient colors={["#1D0B3A", "#0B0B10"]} style={s.heroCard}>
        <View style={s.heroRow}>
          {/* Streak */}
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>{streak}</Text>
            <Text style={s.heroStatLabel}>🔥 Day Streak</Text>
          </View>
          {/* Divider */}
          <View style={s.heroDivider} />
          {/* Coins today */}
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>{coinsToday}</Text>
            <Text style={s.heroStatLabel}>💰 Coins Today</Text>
          </View>
          {/* Divider */}
          <View style={s.heroDivider} />
          {/* Time */}
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>{timeMinutes}m</Text>
            <Text style={s.heroStatLabel}>⏱ Time Today</Text>
          </View>
        </View>

        {/* Daily progress bar */}
        <View style={s.progressRow}>
          <Text style={s.progressLabel}>
            {completedTasks}/{totalTasks} tasks done
          </Text>
          <Text style={s.countdownText}>
            Resets in {formatTimeRemaining(countdown)}
          </Text>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
        </View>

        {/* Next streak milestone */}
        {nextMilestone && (
          <Text style={s.milestoneHint}>
            🏆 {nextMilestone.days - streak} more days → {nextMilestone.label}
          </Text>
        )}
      </LinearGradient>

      {/* Check-in card */}
      {checkInTask && (
        <CheckInCard
          task={checkInTask}
          streak={streak}
          claiming={claimingId === DAILY_TASKS.CHECK_IN.id}
          onClaim={() => handleClaim(DAILY_TASKS.CHECK_IN.id)}
        />
      )}

      {/* Remaining task list */}
      <Text style={s.sectionTitle}>Today's Tasks</Text>
      {remainingTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          timeMinutes={timeMinutes}
          claiming={claimingId === task.id}
          onClaim={() => handleClaim(task.id)}
          onAction={
            task.id === DAILY_TASKS.INVITE_FRIEND.id ? handleInvite : undefined
          }
          actionLoading={
            task.id === DAILY_TASKS.INVITE_FRIEND.id ? inviting : false
          }
        />
      ))}

      {/* Streak milestone table */}
      <Text style={s.sectionTitle}>Streak Milestones</Text>
      <View style={s.milestoneCard}>
        {STREAK_BONUSES.map((m) => {
          const achieved = streak >= m.days;
          return (
            <View key={m.days} style={[s.milestoneRow, achieved && s.milestoneAchieved]}>
              <Text style={[s.milestoneDay, achieved && { color: C.gold }]}>{m.days} days</Text>
              <Text style={s.milestoneName}>{m.label}</Text>
              <View style={s.milestonePill}>
                <Ionicons name="flame" size={12} color={C.orange} />
                <Text style={s.milestonePillText}>{achieved ? '✓' : `${m.days}d`}</Text>
              </View>
              {achieved && <Ionicons name="checkmark-circle" size={18} color={C.green} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Check-In Card ────────────────────────────────────────────────────────────────────────────────
function CheckInCard({ task, streak, claiming, onClaim }) {
  const { taskState } = task;
  const isClaimed = taskState?.status === "claimed";

  return (
    <LinearGradient
      colors={isClaimed ? ["#1A2A1A", "#111711"] : ["#2A1060", "#1D0B3A"]}
      style={s.checkInCard}
    >
      <View style={s.checkInTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.checkInTitle}>
            {isClaimed ? "✅ Checked In Today!" : "📅 Daily Check-In"}
          </Text>
          <Text style={s.checkInSub}>
            {isClaimed
              ? `You’re on a ${streak}-day streak! Come back tomorrow 🔥`
              : `Day ${streak} streak! Tap below to keep it going.`}
          </Text>
        </View>
        <View style={s.checkInBadge}>
          {task.reward > 0 ? (
            <>
              <Ionicons name="cash" size={16} color={C.gold} />
              <Text style={s.checkInBadgeText}>+{task.reward}</Text>
            </>
          ) : (
            <>
              <Ionicons name="flame" size={16} color={C.orange} />
              <Text style={s.checkInBadgeText}>Streak</Text>
            </>
          )}
        </View>
      </View>

      {!isClaimed && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onClaim}
          disabled={claiming}
          style={s.checkInBtn}
        >
          <LinearGradient
            colors={["#FFD54F", "#F9A825"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.checkInBtnInner}
          >
            {claiming ? (
              <ActivityIndicator color="#1A1F27" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="calendar-check" size={20} color="#1A1F27" />
                <Text style={s.checkInBtnText}>
                  {task.reward > 0 ? `Check In & Claim ${task.reward} Coins` : 'Check In ✓'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

// ── Task Row ────────────────────────────────────────────────────────────────────────────────
function TaskRow({ task, timeMinutes, claiming, onClaim, onAction, actionLoading }) {
  const { taskState } = task;
  const status = taskState?.status || "locked";
  const isAvailable = status === "available";
  const isClaimed = status === "claimed";
  const isLocked = status === "locked";

  // For time task, show progress
  const isTimeTask = task.id === DAILY_TASKS.TIME_SPENT.id;
  const isInviteTask = task.id === DAILY_TASKS.INVITE_FRIEND.id;
  const timeProgress = isTimeTask
    ? Math.min(100, (timeMinutes / task.requiredMinutes) * 100)
    : 0;

  const pillColors = isClaimed
    ? ["#2A2F39", "#1A1F27"]
    : isLocked
    ? ["#1A1F27", "#232833"]
    : ["#FFD54F", "#F9A825"];

  return (
    <View style={[s.taskCard, isClaimed && s.taskCardClaimed, isLocked && s.taskCardLocked]}>
      {/* Icon */}
      <View style={[s.taskIcon, { backgroundColor: isClaimed ? C.card2 : isLocked ? C.card2 : C.purple + "30" }]}>
        <MaterialCommunityIcons
          name={TASK_ICONS[task.id] || "star"}
          size={22}
          color={isClaimed ? C.dim : isLocked ? C.dim : C.purple}
        />
      </View>

      {/* Text */}
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={[s.taskTitle, isLocked && { color: C.dim }]}>{task.title}</Text>
        <Text style={s.taskSub}>
          {isTimeTask
            ? `${timeMinutes}/${task.requiredMinutes} min (${Math.round(timeProgress)}%)`
            : task.subtitle}
        </Text>
        {/* Time progress bar */}
        {isTimeTask && (
          <View style={s.miniTrack}>
            <View style={[s.miniFill, { width: `${timeProgress}%` }]} />
          </View>
        )}
      </View>

      {/* Claim button / Action button */}
      <View style={{ alignItems: "center", gap: 6 }}>
        {/* For locked invite task: show "Invite" action button */}
        {isInviteTask && isLocked && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={actionLoading}
            onPress={onAction}
          >
            <LinearGradient
              colors={["#E91E8C", "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.claimPill}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="share-social" size={14} color="#fff" />
                  <Text style={[s.claimText, { color: "#fff" }]}>Invite</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Standard claim button (hidden for locked invite – invite button handles first step) */}
        {!(isInviteTask && isLocked) && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isClaimed || isLocked || claiming}
            onPress={onClaim}
          >
            <LinearGradient
              colors={pillColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.claimPill, isLocked && { opacity: 0.5 }]}
            >
              {claiming ? (
                <ActivityIndicator size="small" color="#1A1F27" />
              ) : (
                <>
                  {isClaimed
                    ? <Ionicons name="checkmark" size={14} color={C.dim} />
                    : isLocked
                    ? <Ionicons name="lock-closed" size={14} color={C.dim} />
                    : task.reward > 0
                    ? <Ionicons name="cash" size={14} color="#1A1F27" />
                    : <Ionicons name="checkmark-circle" size={14} color="#1A1F27" />}
                  <Text style={[s.claimText, (isClaimed || isLocked) && { color: C.dim }]}>
                    {isClaimed ? "Claimed" : isLocked ? "Locked" : task.reward > 0 ? `+${task.reward}` : "Claim"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: C.bg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.card, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "700" },
  coinBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card2, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  coinBadgeText: { color: C.gold, fontWeight: "700", fontSize: 14, marginLeft: 4 },

  streakToast: {
    flexDirection: "row", alignItems: "flex-start",
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#1D0B3A", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.purple + "80",
  },
  streakToastEmoji: { fontSize: 22, marginRight: 8 },
  streakToastTitle: { color: C.gold, fontWeight: "700", fontSize: 14 },
  streakToastSub: { color: C.dim, fontSize: 12, marginTop: 2 },

  heroCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: C.purple + "40",
  },
  heroRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16 },
  heroStat: { alignItems: "center" },
  heroStatNum: { color: C.text, fontSize: 22, fontWeight: "800" },
  heroStatLabel: { color: C.dim, fontSize: 12, marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: C.border },

  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { color: C.dim, fontSize: 12 },
  countdownText: { color: C.blue, fontSize: 12, fontWeight: "600" },
  progressTrack: {
    height: 6, backgroundColor: C.card2, borderRadius: 3, overflow: "hidden",
  },
  progressFill: {
    height: "100%", backgroundColor: C.purple, borderRadius: 3,
  },
  milestoneHint: {
    color: C.gold, fontSize: 12, marginTop: 10, textAlign: "center",
  },

  sectionTitle: {
    color: C.text, fontSize: 16, fontWeight: "700",
    marginTop: 20, marginBottom: 8, marginHorizontal: 16,
  },

  taskCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 14,
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  taskCardClaimed: { borderColor: C.green + "40", backgroundColor: C.card },
  taskCardLocked: { opacity: 0.7 },
  taskIcon: {
    width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center",
  },
  taskTitle: { color: C.text, fontWeight: "700", fontSize: 14 },
  taskSub: { color: C.dim, fontSize: 12, marginTop: 2 },
  miniTrack: {
    height: 4, backgroundColor: C.card2, borderRadius: 2, marginTop: 6, overflow: "hidden",
  },
  miniFill: { height: "100%", backgroundColor: C.blue, borderRadius: 2 },
  claimPill: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    minWidth: 78, justifyContent: "center",
  },
  claimText: { color: "#1A1F27", fontWeight: "800", fontSize: 12, marginLeft: 4 },

  checkInCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: C.purple + "60",
  },
  checkInTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  checkInTitle: { color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  checkInSub: { color: C.dim, fontSize: 13, lineHeight: 18 },
  checkInBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.gold + "20", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, marginLeft: 10,
  },
  checkInBadgeText: { color: C.gold, fontWeight: "800", fontSize: 15, marginLeft: 4 },
  checkInBtn: { borderRadius: 14, overflow: "hidden" },
  checkInBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 13, gap: 8, borderRadius: 14,
  },
  checkInBtnText: { color: "#1A1F27", fontWeight: "800", fontSize: 15 },

  milestoneCard: {
    marginHorizontal: 16, backgroundColor: C.card,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: C.border,
  },
  milestoneRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  milestoneAchieved: { backgroundColor: C.card2 },
  milestoneDay: { color: C.dim, fontWeight: "700", fontSize: 13, width: 64 },
  milestoneName: { color: C.text, fontSize: 13, flex: 1 },
  milestonePill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.gold + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    marginRight: 8,
  },
  milestonePillText: { color: C.gold, fontWeight: "700", fontSize: 12, marginLeft: 4 },
});

