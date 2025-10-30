import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";

const { width } = Dimensions.get("window");
const PADDING_H = 18;

/* --------- THEME --------- */
const C = {
  bg: "#0B0B10",
  card: "#14171C",
  card2: "#1A1F27",
  border: "#242A33",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  cyan: "#08FFE2",
  gold: "#FFC93C",
  brand: "#BF2EF0",
  danger: "#FF1010",
};

/* --------- REUSABLES --------- */
const Pill = ({ label }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>{label}</Text>
  </View>
);

const Stat = ({ value, label }) => (
  <View style={{ alignItems: "center", width: 68 }}>
    <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{value}</Text>
    <Text style={{ color: C.dim, fontSize: 12 }}>{label}</Text>
  </View>
);

const ListRow = ({ title, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.row}>
    <Text style={styles.rowTitle}>{title}</Text>
    <Feather name="chevron-right" size={20} color={C.dim} />
  </TouchableOpacity>
);

const RewardDot = ({ day, state = "done" }) => {
  let fill = C.border;
  if (state === "done") fill = C.gold;
  else if (state === "today") fill = C.cyan;
  else if (state === "missed") fill = "#3A3F49";
  else fill = C.border;
  return (
    <View style={{ alignItems: "center", width: 52 }}>
      <View style={[styles.rewardDot, { backgroundColor: fill }]}>
        <Image source={require("./assets/goldicon.png")} style={styles.rewardIcon} />
      </View>
      <Text style={{ color: C.text, fontSize: 11, marginTop: 6 }}>{day}</Text>
    </View>
  );
};

/* --------- MAIN COMPONENT --------- */
export default function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* ===== PROFILE CARD ===== */}
      <LinearGradient
        colors={["#0EE7B7", "#8A2BE2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileOuter}
      >
        <View style={styles.profileInner}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image source={require("./assets/profile.png")} style={styles.avatar} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.name}>Jeevesh</Text>
                <Ionicons name="male" size={16} color={C.cyan} style={{ marginLeft: 6 }} />
              </View>
              <Text style={styles.handle}>@JazebBlade  · Active now</Text>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate("EditProfile")}
            >
              <Feather name="edit-2" size={16} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Tags */}
          <View style={{ flexDirection: "row", marginTop: 12, flexWrap: "wrap" }}>
            <Pill label="#universocraft" />
            <Pill label="#Anime" />
            <Pill label="#Cartoon" />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat value="10" label="Followers" />
            <Stat value="05" label="Following" />
            <Stat value="10" label="Friends" />
            <Stat value="5" label="Visits" />
          </View>
        </View>
      </LinearGradient>

      {/* ===== WALLET ===== */}
      <View style={styles.walletCard}>
        <Text style={styles.walletTitle}>Wallet</Text>

        <TouchableOpacity activeOpacity={0.9} style={styles.purchaseBtn}>
          <LinearGradient
            colors={["rgba(162,162,162,0.15)", "rgba(255,251,251,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.purchaseBtnInner}
          >
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>Purchase</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.walletRow}>
          <View style={styles.walletChipPlain}>
            <Image source={require("./assets/goldicon.png")} style={styles.walletIconBig} />
            <Text style={styles.walletChipPlainText}>5</Text>
          </View>
          <View style={styles.walletChipPlain}>
            <Image source={require("./assets/diamond1.png")} style={styles.walletIconBig} />
            <Text style={styles.walletChipPlainText}>5</Text>
          </View>
          <View style={styles.walletChipPlain}>
            <Image source={require("./assets/trophy.png")} style={styles.walletIconBig} />
            <Text style={styles.walletChipPlainText}>5</Text>
          </View>
        </View>
      </View>

      {/* ===== REWARDS ===== */}
      <View style={styles.rewardsCard}>
        <View style={styles.rewardsHeader}>
          <Text style={styles.rewardsTitle}>Daily Rewards</Text>
          <TouchableOpacity>
            <Text style={{ color: C.cyan, fontWeight: "600" }}>More Rewards ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rewardsDots}>
          <RewardDot day="Missed" state="missed" />
          <RewardDot day="Today" state="today" />
          <RewardDot day="21 Sep" state="future" />
          <RewardDot day="22 Sep" state="future" />
          <RewardDot day="23 Sep" state="future" />
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.claimWrapper}>
          <LinearGradient
            colors={[C.brand, "rgba(191,46,240,0.2)"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.claimBtn}
          >
            <Text style={styles.claimText}>Claim Reward</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ===== STORIES ===== */}
      <Text style={styles.sectionTitle}>Stories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PADDING_H }}
      >
        <TouchableOpacity style={[styles.story, { justifyContent: "center", alignItems: "center" }]}>
          <Feather name="plus" size={24} color={C.dim} />
          <Text style={{ color: C.dim, marginTop: 8, fontSize: 12 }}>Add Story</Text>
        </TouchableOpacity>

        {[require("./assets/join1.png"), require("./assets/join2.jpg")].map((src, idx) => (
          <TouchableOpacity key={idx} style={styles.story}>
            <Image source={src} style={styles.storyImg} />
            <Text style={styles.storyCaption}>{idx === 0 ? "Yesterday" : "Sep 08"}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ===== MORE ===== */}
      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>More</Text>
      <View style={{ paddingHorizontal: PADDING_H }}>
        <View style={styles.listCard}>
          {/* ✅ Only My Store navigates */}
          <ListRow title="My Store" onPress={() => navigation.navigate("MyStore")} />
          <View style={styles.divider} />
          <ListRow title="Membership" onPress={() => navigation.navigate("Membership")}  />
          <View style={styles.divider} />
          <ListRow title="Reward Center"onPress={() => navigation.navigate("Reward")} />
          <View style={styles.divider} />
          <ListRow title="Help Center" />
          <View style={styles.divider} />
          <ListRow title="Shop" />
          <View style={styles.divider} />
          <ListRow title="Account Setting" />
        </View>

        <TouchableOpacity 
          activeOpacity={0.9} 
          style={styles.logoutBtn}
          onPress={async () => {
            try {
              const auth = getAuth();
              await signOut(auth);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout Error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          }}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  profileOuter: { marginTop: 18, marginHorizontal: PADDING_H, borderRadius: 18, padding: 2 },
  profileInner: { backgroundColor: C.card, borderRadius: 16, padding: 14 },
  avatar: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.border },
  name: { color: C.text, fontSize: 16, fontWeight: "800" },
  handle: { color: C.dim, fontSize: 12, marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: C.text },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: C.border,
    marginTop: 14,
    paddingTop: 14,
  },
  walletCard: {
    marginTop: 16,
    marginHorizontal: PADDING_H,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  walletTitle: { color: C.text, fontWeight: "700", fontSize: 15 },
  purchaseBtn: { position: "absolute", right: 14, top: 14, borderRadius: 10, overflow: "hidden" },
  purchaseBtnInner: { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  walletRow: {
    flexDirection: "row",
    marginTop: 14,
    justifyContent: "space-between",
    gap: 10,
  },
  walletChipPlain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  walletIconBig: { width: 22, height: 22, resizeMode: "contain" },
  walletChipPlainText: { color: C.text, fontWeight: "800", fontSize: 14 },
  rewardsCard: {
    marginTop: 16,
    marginHorizontal: PADDING_H,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  rewardsHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  rewardsTitle: { color: C.text, fontWeight: "700", fontSize: 15 },
  rewardsDots: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  rewardDot: { width: 36, height: 36, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rewardIcon: { width: 16, height: 16, resizeMode: "contain" },
  claimWrapper: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 12,
    overflow: "hidden",
  },
  claimBtn: { paddingVertical: 12, alignItems: "center" },
  claimText: { color: "#fff", fontWeight: "800" },
  sectionTitle: {
    color: C.text,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: PADDING_H,
  },
  story: {
    width: width * 0.34,
    height: width * 0.42,
    borderRadius: 16,
    backgroundColor: C.card,
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  storyImg: { width: "100%", height: "100%" },
  storyCaption: {
    position: "absolute",
    bottom: 8,
    left: 10,
    color: C.text,
    fontWeight: "700",
  },
  listCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 4,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 12 },
  logoutBtn: {
    marginTop: 14,
    backgroundColor: "#000",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.danger,
    alignItems: "center",
    paddingVertical: 12,
  },
  logoutText: { color: C.text, fontWeight: "800", fontSize: 14 },
});
