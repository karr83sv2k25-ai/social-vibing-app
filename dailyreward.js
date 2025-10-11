// DailyRewardScreen.js
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

const C = {
  bg: "#0B0B10",
  card: "#14171C",
  card2: "#1A1F27",
  border: "#232833",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  purple: "#7C3AED",
  blue: "#00BFFF",
  gold: "#FFD54F",
};

export default function DailyRewardScreen({ navigation }) {
  const [tasks, setTasks] = useState([
    {
      id: "t1",
      title: "Check-in Rewards",
      subtitle: "Earn 10 Coins",
      type: "coin",
      reward: 10,
      status: "available", // available | claimed | locked
    },
    {
      id: "t2",
      title: "Spend 30 mins in the app",
      subtitle: "Earn 20 Coins",
      type: "gem",
      reward: 1, // just to show diamond icon on button like the mock
      status: "available",
    },
    {
      id: "t3",
      title: "Invite Friends",
      subtitle: "Earn 50 Coins",
      type: "coin",
      reward: 50,
      status: "available",
    },
  ]);

  const onClaim = (id) => {
    setTasks((old) =>
      old.map((t) => (t.id === id ? { ...t, status: "claimed" } : t))
    );
  };

  const StatChip = ({ icon, label }) => (
    <View style={s.statChip}>
      <View style={s.statIcon}>{icon}</View>
      <Text style={s.statText}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 28 }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reward Center</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Banner with overlay (same vibe as previous screen) */}
      <View style={s.bannerWrap}>
        <ImageBackground
          source={require("./assets/rewardbanner.jpg")}
          style={s.banner}
          imageStyle={{ borderRadius: 16 }}
        >
          <View style={s.bannerOverlay}>
            <View style={s.headlineRow}>
              <Image source={require("./assets/trophy.png")} style={s.shield} />
              <Text style={s.headline}>
                COMPLETE THE TASKS AND EARN{"\n"}
                <Text style={s.highlight}>EXCITED REWARDS !</Text>
              </Text>
            </View>

            <View style={s.features}>
              <StatChip
                icon={<Ionicons name="cash" size={14} color="#fff" />}
                label="Coins"
              />
              <StatChip
                icon={<Ionicons name="image" size={14} color="#fff" />}
                label="Frames"
              />
              <StatChip
                icon={<Ionicons name="diamond" size={14} color="#fff" />}
                label="Diamonds"
              />
              <StatChip
                icon={<Ionicons name="albums" size={14} color="#fff" />}
                label="Collections"
              />
              <StatChip
                icon={<Ionicons name="people" size={14} color="#fff" />}
                label="Followers"
              />
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Task Cards */}
      <View style={{ marginTop: 12 }}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onClaim={() => onClaim(t.id)} />
        ))}
      </View>
    </ScrollView>
  );
}

/* ------------ Row component ------------ */
function TaskRow({ task, onClaim }) {
  const disabled = task.status !== "available";
  const isCoin = task.type === "coin";

  return (
    <View style={s.taskCard}>
      <View>
        <Text style={s.taskTitle}>{task.title}</Text>
        <Text style={s.taskSub}>{task.subtitle}</Text>
      </View>

      {/* Right Pill Button */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={!disabled ? onClaim : undefined}
        style={{ marginLeft: 10 }}
      >
        <LinearGradient
          colors={
            task.status === "claimed"
              ? ["#2A2F39", "#1A1F27"]
              : isCoin
              ? ["#FFD54F", "#F9A825"]
              : ["#4DB6FF", "#2F9BFF"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            s.claimPill,
            task.status === "claimed" && { borderColor: "#3A3F49" },
          ]}
        >
          {isCoin ? (
            <Image source={require("./assets/goldicon.png")} style={s.pillIcon} />
          ) : (
            <Image source={require("./assets/diamond1.png")} style={s.pillIcon} />
          )}
          <Text
            style={[
              s.claimText,
              task.status === "claimed" && { color: "#A2A8B3" },
            ]}
          >
            {task.status === "claimed" ? "Claimed" : "Claim"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- Styles ---------------- */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
    justifyContent: "space-between",
  },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "700" },

  bannerWrap: { marginTop: 16, borderRadius: 16, overflow: "hidden" },
  banner: { width: "100%", height: 180, justifyContent: "flex-end" },
  bannerOverlay: { paddingHorizontal: 14, paddingVertical: 12 },
  headlineRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  shield: { width: 32, height: 32, resizeMode: "contain", marginRight: 8 },
  headline: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  highlight: { color: C.gold },
  features: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(20,23,28,0.85)",
    borderWidth: 1,
    borderColor: C.border,
  },
  statIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  statText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  taskCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 12,
    borderWidth: 2,
    borderColor: C.purple, // neon purple outline like mock
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  taskTitle: { color: C.text, fontWeight: "700", fontSize: 15 },
  taskSub: { color: C.gold, fontWeight: "700", fontSize: 12, marginTop: 4 },

  claimPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#C49124",
  },
  pillIcon: { width: 16, height: 16, resizeMode: "contain", marginRight: 6 },
  claimText: { color: "#1A1F27", fontWeight: "800", fontSize: 12 },
});
