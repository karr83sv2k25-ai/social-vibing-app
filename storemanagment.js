// StoreManagementScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

/** ---- Dummy progress data (change as needed) ---- */
const PROGRESS = {
  uploads: { current: 5, total: 10 },      // 05/10
  sales:   { current: 10, total: 20 },     // 10/20
  visits:  { current: 8, total: 10 },      // 8/10
};
const pct = (c, t) => Math.max(0, Math.min(100, Math.round((c / t) * 100)));

export default function StoreManagementScreen({ navigation }) {
  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Store Management</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerIcon}>
            <Ionicons name="share-outline" size={18} color="#EAEAF0" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIcon}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#EAEAF0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Store Card */}
      <View style={s.card}>
        <View style={s.cardRow}>
          <Image source={require("./assets/pp1.png")} style={s.avatar} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.storeName}>NK’s Store</Text>
            <View style={s.badgesRow}>
              <Badge text="Owner" />
              <Badge text="Daemon" icon="shield-checkmark" />
              <LevelPill level={1} />
            </View>
          </View>
          <TouchableOpacity style={s.viewInfo}>
            <Text style={s.viewInfoText}>View info</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Box */}
        <View style={s.progressWrap}>
          <Text style={s.progressTitle}>To Achieve Next Level</Text>

          <ProgressItem
            label="Upload 10 Products"
            current={PROGRESS.uploads.current}
            total={PROGRESS.uploads.total}
            gradient={["#7C3AED", "#E24ECF"]}
          />
          <ProgressItem
            label="Sales Count"
            current={PROGRESS.sales.current}
            total={PROGRESS.sales.total}
            gradient={["#36E3C0", "#08FFE2"]}
          />
          <ProgressItem
            label="Store Visits"
            current={PROGRESS.visits.current}
            total={PROGRESS.visits.total}
            gradient={["#8A2BE2", "#4B8BFF"]}
          />
        </View>
      </View>

      {/* Settings List */}
      <SettingsItem title="Shop Info" onPress={() => {}} />
      <SettingsItem title="Store picture and Cover" onPress={() => {}} />
      <SettingsItem title="Inspirations" onPress={() => {}} />
      <SettingsItem title="Sales History" onPress={() => {}} />
      <SettingsItem title="Store Settings" onPress={() => {}} />
    </ScrollView>
  );
}

/* ---------- Small components ---------- */
function Badge({ text, icon }) {
  return (
    <View style={s.badge}>
      {icon ? <Ionicons name={icon} size={12} color="#8CE9FF" style={{ marginRight: 4 }} /> : null}
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

function LevelPill({ level = 1 }) {
  return (
    <View style={s.levelPill}>
      <Text style={s.levelText}>Lv{level}</Text>
    </View>
  );
}

function ProgressItem({ label, current, total, gradient }) {
  const percent = pct(current, total);
  return (
    <View style={{ marginTop: 12 }}>
      <View style={s.progressRow}>
        <Text style={s.progressLabel}>{label}</Text>
        <Text style={s.progressValue}>
          {String(current).padStart(2, "0")}/{total}
        </Text>
      </View>
      <View style={s.barBg}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.barFill, { width: `${percent}%` }]}
        />
      </View>
    </View>
  );
}

function SettingsItem({ title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.itemRow} activeOpacity={0.8}>
      <Text style={s.itemTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="#A2A8B3" />
    </TouchableOpacity>
  );
}

/* ---------- Styles ---------- */
const BG = "#0B0B10";
const CARD = "#14171C";
const CARD2 = "#1A1F27";
const BORDER = "#232833";
const TEXT = "#EAEAF0";
const DIM = "#A2A8B3";

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: CARD,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 12 },
  storeName: { color: TEXT, fontSize: 16, fontWeight: "700" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#0F1A22",
    borderWidth: 1,
    borderColor: "#1E2B33",
    marginRight: 6,
  },
  badgeText: { color: "#8CE9FF", fontSize: 12, fontWeight: "600" },

  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#27112E",
    borderWidth: 1,
    borderColor: "#3A2143",
  },
  levelText: { color: "#E24ECF", fontSize: 12, fontWeight: "700" },

  viewInfo: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: CARD2,
    borderWidth: 1,
    borderColor: BORDER,
    marginLeft: 10,
  },
  viewInfoText: { color: TEXT, fontSize: 12, fontWeight: "600" },

  progressWrap: {
    backgroundColor: "#1A1F27",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  progressTitle: { color: TEXT, fontWeight: "700", marginBottom: 6 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: TEXT, fontSize: 12 },
  progressValue: { color: DIM, fontSize: 12, fontWeight: "700" },
  barBg: {
    height: 8,
    backgroundColor: "#12161B",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#20252D",
    marginTop: 6,
  },
  barFill: { height: "100%" },

  itemRow: {
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  itemTitle: { color: TEXT, fontSize: 14, fontWeight: "600" },
});
