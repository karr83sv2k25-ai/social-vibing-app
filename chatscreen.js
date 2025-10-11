// ChatScreen.js — header visible (back + avatar + name + email + info icon)
import React, { useState, useLayoutEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const ACCENT = "#7C3AED";
const CYAN = "#08FFE2";
const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT_DIM = "#9CA3AF";
const GREEN = "#22C55E";

const FALLBACK_AVATAR = require("./assets/profile.png");

const Avatar = ({ name, size = 34, color = ACCENT, source }) => {
  const initials = useMemo(() => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }, [name]);

  return source ? (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: `${color}88`,
        backgroundColor: CARD,
      }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}33`,
        borderWidth: 1,
        borderColor: `${color}88`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{initials}</Text>
    </View>
  );
};

export default function ChatScreen({ route, navigation }) {
  const scrollViewRef = useRef(null);
  const user = route?.params?.user || {
    name: "Ken Kaneki",
    handle: "ghoul123@gmail.com",
    avatar: FALLBACK_AVATAR,
  };

  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([
    { id: "m1", from: "them", text: "Hey there!", time: "2:01 pm" },
    {
      id: "m2",
      from: "them",
      text: "Kuch clear ideas do start karne ke liye. I just want to make sure we align before I push this.",
      time: "2:02 pm",
    },
    { id: "m3", from: "me", text: "Sure yaar 😄 Let's finalize today.", time: "2:03 pm" },
  ]);

  const send = () => {
    const message = text.trim();
    if (!message) return;
    const newMsg = {
      id: `${Date.now()}`,
      from: "me",
      text: message,
      time: "now",
    };
    setMsgs((prev) => [...prev, newMsg]);
    setText("");
    requestAnimationFrame(() =>
      scrollViewRef.current?.scrollToEnd({ animated: true })
    );
  };

  // ✅ We build our own header manually
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔹 Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Avatar name={user.name} size={40} source={user.avatar} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{user.name}</Text>
            <Text style={styles.headerEmail}>{user.handle}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerRight}>
          <Ionicons name="information-circle-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 💬 Chat Section */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 10} // ⬆️ Keyboard slightly higher
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {msgs.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubbleRow,
                m.from === "me" && styles.bubbleRight,
              ]}
            >
              {m.from !== "me" && (
                <Avatar name={user.name} size={28} source={user.avatar} />
              )}
              <View
                style={[
                  styles.bubble,
                  m.from === "me" ? styles.bubbleMe : styles.bubbleThem,
                ]}
              >
                <Text style={styles.bubbleText}>{m.text}</Text>
                <Text style={styles.bubbleTime}>{m.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* ✍️ Message Composer */}
        <View style={styles.composerBar}>
          <View style={styles.composerInner}>
            <MaterialCommunityIcons name="sticker-emoji" size={20} color={TEXT_DIM} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor={TEXT_DIM}
              style={styles.composerInput}
              multiline
            />
            <TouchableOpacity style={styles.plusBtn}>
              <Ionicons name="add" size={18} color="#000" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={send} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  customHeader: {
    backgroundColor: BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F25",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  backBtn: { marginRight: 8 },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerEmail: { color: TEXT_DIM, fontSize: 12 },
  headerRight: { paddingHorizontal: 6 },

  scrollContainer: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 100,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    gap: 8,
  },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  bubbleThem: { backgroundColor: CARD, borderColor: "#23232A" },
  bubbleMe: { backgroundColor: `${ACCENT}33`, borderColor: `${ACCENT}66` },
  bubbleText: { color: "#fff" },
  bubbleTime: { color: TEXT_DIM, fontSize: 10, marginTop: 4, textAlign: "right" },
  composerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: BG,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#19191F",
  },
  composerInner: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#23232A",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  composerInput: { flex: 1, color: "#fff", paddingVertical: 4, minHeight: 20 },
  plusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CYAN,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    backgroundColor: CYAN,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
