// MessagesScreen.js — Messages list with heading + icons + navigation to Chat
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  StatusBar,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// 🎨 Theme Colors
const ACCENT = "#7C3AED";
const CYAN = "#08FFE2";
const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT_DIM = "#9CA3AF";

/* 🔹 Local static images (put these files in your /assets folder) */
const AV_KANEKI = require("./assets/profile.png");
const AV_GOJO = require("./assets/post2.png");
const AV_ED = require("./assets/post2.png");
const AV_LUFFY = require("./assets/post2.png");

/* 🔹 Sample people data */
const PEOPLE = [
  {
    id: "1",
    name: "Ken Kaneki",
    handle: "@ghoul",
    time: "02:03 pm",
    unread: 2,
    last: "Are you sure?",
    avatar: AV_KANEKI,
  },
  {
    id: "2",
    name: "Satoru Gojo",
    handle: "@sixeyes",
    time: "01:19 pm",
    unread: 0,
    last: "See you at 7.",
    avatar: AV_GOJO,
  },
  {
    id: "3",
    name: "Edward Elric",
    handle: "@alchemy",
    time: "12:47 pm",
    unread: 1,
    last: "Done ✅",
    avatar: AV_ED,
  },
  {
    id: "4",
    name: "Monkey D. Luffy",
    handle: "@strawhat",
    time: "10:12 am",
    unread: 0,
    last: "Meat!!! 🍖",
    avatar: AV_LUFFY,
  },
];

/* 🧩 Avatar component */
function Avatar({ name, size = 44, color = ACCENT, source }) {
  const initials = useMemo(
    () =>
      name
        .split(" ")
        .map((n) => (n?.[0] || "").toUpperCase())
        .join("")
        .slice(0, 2),
    [name]
  );

  if (source) {
    return (
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: color + "88",
          backgroundColor: CARD,
          resizeMode: "cover",
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + "33",
        borderWidth: 1,
        borderColor: color + "88",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{initials}</Text>
    </View>
  );
}

/* 💬 Main Screen */
export default function MessagesScreen({ navigation }) {
  const [query, setQuery] = useState("");

  const filtered = PEOPLE.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.handle.toLowerCase().includes(query.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.thread}
      // 🔹 Navigate to Chat screen
      onPress={() => navigation.navigate("Chat", { user: item })}
    >
      <Avatar name={item.name} source={item.avatar} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={TEXT_DIM} />
          <Text numberOfLines={1} style={styles.lastMsg}>
            {"  "}{item.last}
          </Text>
        </View>
      </View>

      {item.unread > 0 ? (
        <View style={styles.badge}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.unread}</Text>
        </View>
      ) : (
        <Ionicons name="checkmark-done" size={18} color={TEXT_DIM} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* ===== Header ===== */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="chatbubbles" size={22} color={CYAN} />
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity style={styles.hIcon}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hIcon}>
            <Ionicons name="person-add-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hIcon}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔍 Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={TEXT_DIM} />
        <TextInput
          placeholder="Search people"
          placeholderTextColor={TEXT_DIM}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
        />
        <TouchableOpacity>
          <Ionicons name="filter-outline" size={20} color={TEXT_DIM} />
        </TouchableOpacity>
      </View>

      {/* 🔹 Segments */}
      <View style={styles.segmentRow}>
        <Chip active icon="lock-closed" label="Private" />
        <Chip icon="people" label="Groups" />
        <Chip icon="mail-open-outline" label="Invites" />
        <Chip icon="at" label="Mentions" />
      </View>

      {/* 🧾 Messages List */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        style={{ paddingHorizontal: 14 }}
      />
    </SafeAreaView>
  );
}

/* ---- Small Chip component ---- */
function Chip({ icon, label, active }) {
  return (
    <View
      style={[
        styles.segment,
        active && { backgroundColor: ACCENT + "26", borderColor: ACCENT + "66" },
      ]}
    >
      <Ionicons
        name={icon}
        size={12}
        color={active ? "#fff" : TEXT_DIM}
        style={{ marginRight: 6 }}
      />
      <Text
        style={[
          styles.segmentText,
          active && { color: "#fff" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 24,
    paddingTop: 46,
    paddingBottom: 10,
    backgroundColor: BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  hIcon: {
    marginLeft: 10,
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23232A",
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    backgroundColor: CARD,
    marginHorizontal: 14,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#23232A",
  },
  input: { flex: 1, color: "#fff", paddingVertical: 2 },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: "#23232A",
  },
  segmentText: { color: TEXT_DIM, fontSize: 12, fontWeight: "600" },
  thread: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#23232A",
  },
  name: { color: "#fff", fontWeight: "700" },
  time: { color: TEXT_DIM, fontSize: 12 },
  lastMsg: { color: TEXT_DIM },
  badge: {
    marginLeft: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  
});

