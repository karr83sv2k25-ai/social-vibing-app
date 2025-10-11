// EditProfileScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const PADDING_H = 18;

/* THEME */
const C = {
  bg: "#0B0B10",
  card2: "#1A1F27",
  border: "#242A33",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  cyan: "#08FFE2",
  brand: "#BF2EF0",
  green: "#36E3C0",
};

/* REUSABLES */
const Pill = ({ label }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>#{label}</Text>
  </View>
);

const Stat = ({ value, label }) => (
  <View style={{ alignItems: "center", width: 70 }}>
    <Text style={{ color: C.text, fontWeight: "800", fontSize: 16 }}>{value}</Text>
    <Text style={{ color: C.dim, fontSize: 12 }}>{label}</Text>
  </View>
);

export default function EditProfileScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* ===== Header / Cover ===== */}
      <View style={styles.coverWrap}>
        <Image source={require("./assets/post2.png")} style={styles.cover} />

        {/* Left: back */}
        <TouchableOpacity
          style={[styles.headBtn, { left: 10 }]}
          onPress={() => navigation?.goBack?.()}
        >
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>

        {/* Right: edit + 3 dots */}
        <View style={{ position: "absolute", right: 10, top: 12, flexDirection: "row", gap: 8 }}>
          <View style={styles.headBtn}>
            <Feather name="edit-2" size={16} color={C.text} />
          </View>
          <View style={styles.headBtn}>
            <Feather name="more-horizontal" size={18} color={C.text} />
          </View>
        </View>

        {/* View Store */}
        <TouchableOpacity style={styles.viewStoreBtn}>
          <Text style={styles.viewStoreText}>View Store ›</Text>
        </TouchableOpacity>
      </View>

      {/* ===== Profile Info ===== */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Image source={require("./assets/profile.png")} style={styles.avatar} />
          <View style={styles.avatarRing} />
        </View>

        <View style={{ alignItems: "center", marginTop: 34 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.name}>Jeevesh</Text>
            <Ionicons name="male" size={16} color={C.cyan} style={{ marginLeft: 6 }} />
          </View>
          <Text style={styles.handle}>@JazebBlade</Text>
          <Text style={styles.joined}>Joined 10 Sep, 2024</Text>
          <Text style={styles.active}>Active Now</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat value="10" label="Followers" />
          <Stat value="05" label="Following" />
          <Stat value="10" label="Friends" />
          <Stat value="5" label="Visits" />
        </View>
      </View>

      {/* ===== All About Me ===== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All About Me</Text>
        </View>

        {/* Bio row WITH edit on right */}
        <View style={styles.subHeaderRow}>
          <Text style={styles.subHeader}>Bio</Text>
          <TouchableOpacity style={styles.smallEdit} onPress={() => { /* handle edit bio */ }}>
            <Feather name="edit-2" size={12} color={C.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.bioText}>
          Lorem ipsum dolor sit amet consectetur. Feu cius aliquam sapien eget placerat.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {["universocraft", "Love", "Anime"].map((t) => (
            <Pill key={t} label={t} />
          ))}
        </View>
      </View>

      {/* ===== Community Joined (WITH edit on right) ===== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="account-group" size={18} color={C.cyan} />
            <Text style={styles.sectionTitle}>Community Joined</Text>
          </View>
          <TouchableOpacity style={styles.editIcon} onPress={() => { /* handle edit communities */ }}>
            <Feather name="edit-2" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.communityCard}>
              <Image source={require("./assets/join2.jpg")} style={styles.communityImg} />
              <View style={{ padding: 8 }}>
                <Text style={styles.commTitle}>Anime Group</Text>
                <Text style={styles.commMeta}>2 Members</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ===== Stories (WITH edit on right) ===== */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stories</Text>
          <TouchableOpacity style={styles.editIcon} onPress={() => { /* handle edit stories */ }}>
            <Feather name="edit-2" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
        >
          {/* Add Story */}
          <TouchableOpacity
            style={[
              styles.story,
              { justifyContent: "center", alignItems: "center", backgroundColor: C.card2 },
            ]}
          >
            <Feather name="plus" size={22} color={C.dim} />
            <Text style={{ color: C.dim, marginTop: 6, fontSize: 12 }}>Add Story</Text>
          </TouchableOpacity>

          {/* Story items */}
          {[require("./assets/join1.png"), require("./assets/join2.jpg")].map((src, idx) => (
            <View key={idx} style={styles.story}>
              <Image source={src} style={styles.storyImg} />
              <Text style={styles.storyCaption}>{idx === 0 ? "Yesterday" : "Sep 08"}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

/* ================== STYLES ================== */
const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  /* Cover */
  coverWrap: {
    width: "100%",
    height: 160,
  },
  cover: { width: "100%", height: "100%" },

  headBtn: {
    position: "absolute",
    top: 12,
    backgroundColor: "#111A",
    borderWidth: 1,
    borderColor: C.border,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  viewStoreBtn: {
    position: "absolute",
    right: 12,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#111A",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
  },
  viewStoreText: { color: C.text, fontWeight: "700", fontSize: 12 },

  /* Profile */
  profileCard: {
    marginHorizontal: PADDING_H,
    marginTop: -AVATAR_SIZE / 2,
    paddingTop: AVATAR_SIZE / 2 + 8,
    paddingBottom: 12,
  },
  avatarWrap: {
    position: "absolute",
    top: -AVATAR_SIZE / 2,
    width: "100%",
    alignItems: "center",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: C.cyan,
  },
  avatarRing: {
    position: "absolute",
    width: AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    borderRadius: (AVATAR_SIZE + 10) / 2,
    borderWidth: 1,
    borderColor: C.cyan,
    opacity: 0.25,
  },

  name: { color: C.text, fontSize: 18, fontWeight: "800" },
  handle: { color: C.dim, fontSize: 13, marginTop: 2 },
  joined: { color: C.dim, fontSize: 12, marginTop: 2 },
  active: { color: C.green, fontSize: 12, marginTop: 2, fontWeight: "700" },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 12,
  },

  /* Sections (transparent) */
  section: {
    marginTop: 14,
    marginHorizontal: PADDING_H,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: { color: C.text, fontWeight: "800", fontSize: 15 },

  subHeaderRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subHeader: { color: C.cyan, fontWeight: "700", fontSize: 13 },
  bioText: { color: C.text, fontSize: 13, marginTop: 6, lineHeight: 18 },

  pill: {
    backgroundColor: C.card2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
  },
  pillText: { color: C.text, fontSize: 12, fontWeight: "600" },

  /* Community cards */
  communityCard: {
    width: width * 0.42,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 12,
    overflow: "hidden",
    marginTop: 10,
  },
  communityImg: { width: "100%", height: 90, borderRadius: 14 },
  commTitle: { color: C.text, fontWeight: "700", fontSize: 13 },
  commMeta: { color: C.dim, fontSize: 11, marginTop: 2 },

  /* Edit buttons reused */
  editIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallEdit: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Stories */
  story: {
    width: width * 0.34,
    height: width * 0.42,
    borderRadius: 16,
    backgroundColor: "transparent",
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
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
});
