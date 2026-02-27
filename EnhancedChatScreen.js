/**
 * EnhancedChatScreen.js
 * 
 * WhatsApp-style chat with:
 * ✅ Persistent message box (always visible)
 * ✅ Draft message persistence
 * ✅ Smart keyboard handling
 * ✅ Auto-scroll behavior
 * ✅ Scroll-to-bottom button
 * ✅ Typing indicators
 * ✅ Network status
 * ✅ Input mode switching (mic/send)
 * ✅ Voice recording
 * ✅ Back button handling (keyboard first, then navigation)
 */

import React, { useState, useLayoutEffect, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Keyboard,
  BackHandler,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useChatState } from './hooks/useChatState';
import { MessageBox } from './components/MessageBox';
import { ScrollToBottomButton } from './components/ScrollToBottomButton';
import { InlineStatus } from './components/StatusBadge';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToHostinger, uploadVideoToHostinger } from './hostingerConfig';
import { compressChatImage } from './utils/imageCompression';
import { flagMessage, MESSAGE_REPORT_REASONS } from './shared/services/moderationService';
import { db, auth } from './firebaseConfig';

const ACCENT = "#7C3AED";
const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT_DIM = "#9CA3AF";
const FALLBACK_AVATAR = require("./assets/profile.png");

// Avatar Component
const Avatar = ({ name, size = 34, source }) => {
  const initials = name
    ?.split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("") || "?";

  return source ? (
    <Image
      source={source}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      resizeMode="cover"
    />
  ) : (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
};

export default function EnhancedChatScreen({ route, navigation }) {
  const user = route?.params?.user || {
    name: "Ken Kaneki",
    handle: "ghoul123@gmail.com",
    avatar: FALLBACK_AVATAR,
  };

  const chatId = route?.params?.chatId || `chat_${user.id || user.name}`;

  // Use chat state hook
  const {
    messageText,
    setMessageText,
    isTyping,
    clearMessage,
    keyboardHeight,
    keyboardVisible,
    handleKeyboardShow,
    handleKeyboardHide,
    shouldAutoScroll,
    showScrollToBottom,
    isUserScrolling,
    setIsUserScrolling,
    handleScroll,
    inputMode,
    isRecording,
    setIsRecording,
    recordingDuration,
    setRecordingDuration,
    isOnline,
    handleBackPress,
  } = useChatState(chatId);

  const [messages, setMessages] = useState([
    { id: "m1", from: "them", text: "Hey there!", time: "2:01 pm", timestamp: Date.now() - 3600000 },
    {
      id: "m2",
      from: "them",
      text: "Let's finalize the details today.",
      time: "2:02 pm",
      timestamp: Date.now() - 3000000,
    },
    { id: "m3", from: "me", text: "Sure! Let's do it.", time: "2:03 pm", timestamp: Date.now() - 1800000 },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Flag / report message states
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggedMessage, setFlaggedMessage] = useState(null);
  const [flagSelectedReason, setFlagSelectedReason] = useState(null);
  const [flagLoading, setFlagLoading] = useState(false);

  const flatListRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const messageInputRef = useRef(null);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  // Hide default header
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Keyboard listeners
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      handleKeyboardShow
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      handleKeyboardHide
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true; // Prevent default back
      }
      return false; // Allow navigation
    });

    return () => backHandler.remove();
  }, [keyboardVisible]);

  // Auto-scroll when keyboard opens
  useEffect(() => {
    if (keyboardVisible && shouldAutoScroll) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [keyboardVisible]);

  // Auto-scroll on new message (only if at bottom) - with debouncing
  const scrollTimeoutRef = useRef(null);
  useEffect(() => {
    // Clear any pending scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    if (shouldAutoScroll && !isUserScrolling && messages.length > 0) {
      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else if (!shouldAutoScroll && messages.length > 0) {
      // User is reading old messages, increment unread
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.from !== 'me') {
        setUnreadCount(prev => prev + 1);
      }
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages.length, shouldAutoScroll, isUserScrolling]);

  // Send message
  const handleSend = useCallback(async () => {
    const text = messageText.trim();
    if (!text || isLoading) return;

    const newMsg = {
      id: `msg_${Date.now()}`,
      from: "me",
      text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMsg]);
    clearMessage();
    setIsLoading(true);

    // Simulate network delay
    setTimeout(() => {
      setIsLoading(false);
    }, 500);

    // Auto-scroll to new message
    setIsUserScrolling(false);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messageText, isLoading, clearMessage]);

  // Voice recording
  const handleVoiceStart = useCallback(async () => {
    try {
      // Check microphone permission (for future implementation with expo-av)
      // For now, we'll just start recording
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting voice recording:', error);
      Alert.alert(
        'Recording Error',
        'Unable to start voice recording. Please check microphone permissions.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const handleVoiceEnd = useCallback(() => {
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const duration = recordingDuration;
      setIsRecording(false);
      setRecordingDuration(0);

      if (duration < 1) {
        Alert.alert('Too Short', 'Voice message must be at least 1 second');
        return;
      }

      // Check if online before sending
      if (!isOnline) {
        Alert.alert(
          'No Connection',
          'Voice message will be sent when connection is restored.',
          [{ text: 'OK' }]
        );
        // TODO: Queue message for later sending
        return;
      }

      // Create voice message
      const newMsg = {
        id: `msg_${Date.now()}`,
        from: "me",
        type: 'voice',
        duration: duration,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, newMsg]);
    } catch (error) {
      console.error('Error ending voice recording:', error);
      Alert.alert(
        'Error',
        'Failed to save voice message. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [recordingDuration, isOnline]);

  // Handle attachment
  const handleAttachment = useCallback(async () => {
    try {
      // Show action sheet for attachment type
      Alert.alert(
        'Send Attachment',
        'Choose attachment type',
        [
          {
            text: 'Photo/Video',
            onPress: async () => {
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert('Permission Required', 'Please grant photo library access to send images.');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsEditing: false,
                quality: 1.0,
                videoMaxDuration: 60,
              });

              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setUploadProgress('Uploading...');

                try {
                  let uploadedUrl;
                  if (asset.type === 'video') {
                    uploadedUrl = await uploadVideoToHostinger(asset.uri, 'chat_videos');
                  } else {
                    // Compress image before upload
                    const compressedUri = await compressChatImage(asset.uri);
                    uploadedUrl = await uploadImageToHostinger(compressedUri, 'chat_images');
                  }

                  const newMsg = {
                    id: `msg_${Date.now()}`,
                    from: 'me',
                    type: asset.type === 'video' ? 'video' : 'image',
                    url: uploadedUrl,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: Date.now(),
                  };

                  setMessages(prev => [...prev, newMsg]);
                  setUploadProgress(null);

                  // Auto-scroll to new message
                  setIsUserScrolling(false);
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                } catch (uploadError) {
                  console.error('Upload error:', uploadError);
                  setUploadProgress(null);
                  Alert.alert('Upload Failed', 'Could not upload attachment. Please try again.');
                }
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Attachment error:', error);
      Alert.alert('Error', 'Failed to select attachment. Please try again.');
    }
  }, [setIsUserScrolling]);

  // Handle message long-press: flag others', delete own
  const handleMessageLongPress = useCallback((item) => {
    const currentUser = auth.currentUser;
    if (item.from === 'me') {
      Alert.alert(
        'Delete Message',
        'Remove this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => {
            setMessages(prev => prev.filter(m => m.id !== item.id));
          }},
        ]
      );
    } else {
      setFlaggedMessage(item);
      setFlagSelectedReason(null);
      setShowFlagModal(true);
    }
  }, []);

  const submitFlagMessage = async () => {
    if (!flagSelectedReason) {
      Alert.alert('Select a reason', 'Please choose a reason before submitting.');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setFlagLoading(true);
    try {
      const result = await flagMessage(db, currentUser.uid, {
        messageId: flaggedMessage.id,
        messageText: flaggedMessage.text || '',
        reportedUserId: flaggedMessage.senderId || user.id || user.userId || '',
        conversationId: chatId,
        chatType: user.isGroup ? 'group' : 'private',
        reason: flagSelectedReason,
      });
      setShowFlagModal(false);
      if (result.success) {
        Alert.alert('Reported', 'Thank you — our moderation team will review this message.');
      } else {
        Alert.alert('Notice', result.error || 'Could not submit report.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit report.');
    } finally {
      setFlagLoading(false);
    }
  };

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setUnreadCount(0);
    setIsUserScrolling(false);
  }, []);

  // Render message bubble
  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageRow,
        item.from === "me" && styles.messageRowRight,
      ]}
    >
      {item.from !== "me" && (
        <Avatar name={user.name} size={28} source={user.avatar} />
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleMessageLongPress(item)}
        style={[
          styles.bubble,
          item.from === "me" ? styles.bubbleMe : styles.bubbleThem,
        ]}
      >
        {item.type === 'voice' ? (
          <View style={styles.voiceMessage}>
            <Ionicons name="play-circle" size={32} color={item.from === "me" ? "#fff" : ACCENT} />
            <Text style={[styles.bubbleText, { marginLeft: 8 }]}>
              {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        ) : item.type === 'image' ? (
          <TouchableOpacity activeOpacity={0.9}>
            <Image
              source={{ uri: item.url }}
              style={styles.attachmentImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : item.type === 'video' ? (
          <TouchableOpacity activeOpacity={0.9} style={styles.videoContainer}>
            <Image
              source={{ uri: item.url }}
              style={styles.attachmentImage}
              resizeMode="cover"
            />
            <View style={styles.videoOverlay}>
              <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={styles.bubbleText}>{item.text}</Text>
        )}
        <Text style={styles.bubbleTime}>{item.time}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Avatar name={user.name} size={40} source={user.avatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{user.name}</Text>
            <Text style={styles.headerStatus}>
              {uploadProgress || (isTyping ? 'typing...' : isOnline ? 'online' : 'offline')}
            </Text>
            {user.userId && (
              <View style={{ marginTop: 4 }}>
                <InlineStatus
                  userId={user.userId}
                  isOwnStatus={false}
                  textStyle={{ fontSize: 12, color: '#9CA3AF' }}
                />
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.headerRight}>
          <Ionicons name="information-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />

        {/* Scroll to Bottom Button */}
        <ScrollToBottomButton
          visible={showScrollToBottom}
          onPress={scrollToBottom}
          unreadCount={unreadCount}
        />

        {/* Message Box - Always Visible */}
        <MessageBox
          value={messageText}
          onChangeText={setMessageText}
          onSend={handleSend}
          onAttachPress={handleAttachment}
          onVoiceRecordStart={handleVoiceStart}
          onVoiceRecordEnd={handleVoiceEnd}
          isLoading={isLoading || uploadProgress !== null}
          isOnline={isOnline}
          inputMode={inputMode}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
        />


      </KeyboardAvoidingView>

      {/* Flag / Report Message Modal */}
      <Modal
        visible={showFlagModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFlagModal(false)}
      >
        <TouchableOpacity
          style={flagStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowFlagModal(false)}
        >
          <View style={flagStyles.sheet} onStartShouldSetResponder={() => true}>
            <View style={flagStyles.header}>
              <Text style={flagStyles.title}>Report Message</Text>
              <TouchableOpacity onPress={() => setShowFlagModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={flagStyles.subtitle}>Why are you reporting this message?</Text>

            {MESSAGE_REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  flagStyles.reasonRow,
                  flagSelectedReason === r.key && flagStyles.reasonRowSelected,
                ]}
                onPress={() => setFlagSelectedReason(r.key)}
              >
                <View style={[
                  flagStyles.radio,
                  flagSelectedReason === r.key && flagStyles.radioSelected,
                ]} />
                <Text style={flagStyles.reasonText}>{r.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[flagStyles.submitBtn, flagLoading && { opacity: 0.6 }]}
              onPress={submitFlagMessage}
              disabled={flagLoading}
            >
              {flagLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={flagStyles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  header: {
    backgroundColor: BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F25",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerStatus: { color: TEXT_DIM, fontSize: 12, marginTop: 2 },
  headerRight: { padding: 4 },
  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
    gap: 8,
  },
  messageRowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleThem: {
    backgroundColor: CARD,
    borderColor: "#23232A",
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: `${ACCENT}`,
    borderColor: `${ACCENT}`,
    borderBottomRightRadius: 4,
  },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  bubbleTime: {
    color: "#999",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  attachmentImage: {
    width: 250,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  videoContainer: {
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  avatar: {
    borderWidth: 1,
    borderColor: `${ACCENT}88`,
    backgroundColor: CARD,
  },
  avatarPlaceholder: {
    backgroundColor: `${ACCENT}33`,
    borderWidth: 1,
    borderColor: `${ACCENT}88`,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },

});

const flagStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#17171C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 14,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#17171C',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  reasonRowSelected: {
    backgroundColor: `${ACCENT}33`,
    borderColor: ACCENT,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: 12,
  },
  radioSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  reasonText: {
    color: '#fff',
    fontSize: 15,
  },
  submitBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
