import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Keyboard,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio, Video } from 'expo-av';
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc, arrayUnion, arrayRemove, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { uploadImageToHostinger, uploadAudioToHostinger } from '../hostingerConfig';
import { normalizeImageUri } from '../utils/normalizeUri';
import { getDisplayName, getUserAvatar } from '../utils/userNameHelpers';
import useUserNames from '../hooks/useUserNames';
import AnnouncementBanner from '../components/AnnouncementBanner';
import { RoleBadgePill } from '../components/ModeratorBadge';
import { StickerPicker } from '../components/StickerPicker';
import * as ModerationService from '../shared/services/moderationService';

const { ROLES, MOD_ACTIONS, STRIKE_DURATIONS, STRIKE_DURATION_LABELS } = ModerationService;

const ACCENT = '#8B2EF0';
const BG = '#0B0B0E';
const CARD = '#17171C';

export default function CommunityGroupChatScreen({ navigation, route }) {
  const { communityId, groupId, groupName, groupImage, groupEmoji, groupColor } = route?.params || {};
  const currentUser = auth.currentUser;

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const scrollViewRef = useRef(null);
  const flatListRef = useRef(null);
  const activeRoomMsgsRef = useRef(new Set());

  // ─── Role & Moderation State ───
  const [myRole, setMyRole] = useState(null); // owner|admin|leader|curator|member|null
  const [memberRoles, setMemberRoles] = useState({}); // { [uid]: 'owner'|'leader'|'curator'|... }
  const [isActionBlocked, setIsActionBlocked] = useState(false); // struck/banned
  const [blockReason, setBlockReason] = useState('');
  const [isMuted, setIsMuted] = useState(false); // muted in this specific chat

  // Moderation Modal State
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showModModal, setShowModModal] = useState(false);
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [strikeTarget, setStrikeTarget] = useState(null);
  const [strikeDuration, setStrikeDuration] = useState(ModerationService.STRIKE_DURATIONS.ONE_HOUR);
  const [strikeReason, setStrikeReason] = useState('');
  const [modActionLoading, setModActionLoading] = useState(false);

  // Slowmode state
  const [lastSentAt, setLastSentAt] = useState(0);
  const [slowmodeCooldown, setSlowmodeCooldown] = useState(0);
  const slowmodeTimerRef = useRef(null);

  // Announcement state
  const [community, setCommunity] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isStaff, setIsStaff] = useState(false);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementsDismissed, setAnnouncementsDismissed] = useState(false);

  // ─── Media State ───
  const [selectedChatImage, setSelectedChatImage] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [voiceSound, setVoiceSound] = useState(null);
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // ─── Feature Modal State ───
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showMiniScreen, setShowMiniScreen] = useState(null); // 'voice' | 'screening' | 'roleplay'
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // ─── Roleplay State ───
  const [roleplayPage, setRoleplayPage] = useState(1);
  const [pendingRoleplayJoin, setPendingRoleplayJoin] = useState(null);
  const [selectedCharactersForSession, setSelectedCharactersForSession] = useState([]);
  const [characterCollection, setCharacterCollection] = useState([]);
  const [roleplayScenario, setRoleplayScenario] = useState('');
  const [roleplayRoles, setRoleplayRoles] = useState([{ id: '1', name: '', description: '' }]);

  // ─── Reply State ───
  const [replyTo, setReplyTo] = useState(null);

  // ── RC-fix: cache current user's community nickname + avatar in refs ────────
  // resolveCurrentUserInfo (called on EVERY send) used to do 2 fresh Firestore
  // reads per message. Instead we subscribe once here and cache the results so
  // sends are instant and race-condition-free even if the nickname is changed
  // mid-session on another device.
  const currentUserNameRef  = useRef(null); // active name (nickname ?? globalName)
  const currentUserGlobalNameRef = useRef(null); // pure global name for fallback
  const currentUserImageRef = useRef(null); // resolved once, updated live

  // Subscribe to the current user's profile and community membership doc.
  // Updates the refs whenever either document changes.
  useEffect(() => {
    if (!currentUser?.uid || !communityId) return;
    const unsubs = [];

    // 1. Live profile — keeps globalName + avatar warm
    unsubs.push(
      onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
        if (snap.exists()) {
          const userData = snap.data();
          const globalName = getDisplayName(userData);
          const rawImage   = getUserAvatar(userData);
          currentUserGlobalNameRef.current = globalName;
          // Only overwrite active name if no nickname is set
          if (!currentUserNameRef.current) {
            currentUserNameRef.current = globalName;
          }
          currentUserImageRef.current = normalizeImageUri(rawImage) || null;
        }
      }, () => {})
    );

    // 2. Live community membership — nickname takes priority; clears fall back to globalName
    const membershipId = `${currentUser.uid}_${communityId}`;
    unsubs.push(
      onSnapshot(doc(db, 'communities_members', membershipId), (snap) => {
        if (snap.exists()) {
          const nick = snap.data()?.communityNickname;
          if (nick && nick.trim()) {
            currentUserNameRef.current = nick.trim();
          } else {
            // Nickname cleared — fall back to cached global name immediately
            currentUserNameRef.current = currentUserGlobalNameRef.current || null;
          }
        } else {
          // No membership doc — use global name
          currentUserNameRef.current = currentUserGlobalNameRef.current || null;
        }
      }, () => {})
    );

    return () => unsubs.forEach((u) => u());
  }, [currentUser?.uid, communityId]);

  // ── Live username resolution for message bubbles ─────────────────────────
  // Collect all unique sender IDs from loaded messages.
  const senderIds = useMemo(
    () => messages.map((m) => m.senderId).filter(Boolean),
    [messages]
  );
  // Subscribe to Firestore so any name/nickname change is reflected instantly.
  const liveNames = useUserNames(senderIds, communityId);

  // Fetch group data and check membership
  useEffect(() => {
    if (!communityId || !groupId || !currentUser?.uid) return;

    const fetchGroupData = async () => {
      try {
        const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (groupSnap.exists()) {
          const data = groupSnap.data();
          setGroupData(data);
          
          // Check if user is already a member
          const memberRef = doc(db, 'communities', communityId, 'groups', groupId, 'members', currentUser.uid);
          const memberSnap = await getDoc(memberRef);
          setIsMember(memberSnap.exists());
        }
      } catch (error) {
        console.error('Error fetching group data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [communityId, groupId, currentUser?.uid]);

  // Listen to community data for announcements & role check
  useEffect(() => {
    if (!communityId || !currentUser?.uid) return;

    const communityRef = doc(db, 'communities', communityId);
    const unsubscribe = onSnapshot(communityRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setCommunity(data);

        // Resolve role for current user (Discord-like hierarchy)
        const uid = currentUser.uid;
        let resolvedRole = ROLES.MEMBER;
        if (data.creatorId === uid) resolvedRole = ROLES.OWNER;
        else if (data.adminIds?.includes(uid)) resolvedRole = ROLES.ADMIN;
        else if (data.leaders?.includes(uid)) resolvedRole = ROLES.LEADER;
        else if (data.curators?.includes(uid)) resolvedRole = ROLES.CURATOR;
        else if (data.moderators?.includes(uid)) resolvedRole = ROLES.LEADER; // legacy moderators → treat as leader
        setMyRole(resolvedRole);
        setIsStaff(resolvedRole !== ROLES.MEMBER);

        // Build a roles map for all known staff UIDs
        const rolesMap = {};
        if (data.creatorId) rolesMap[data.creatorId] = ROLES.OWNER;
        (data.adminIds || []).forEach(id => { if (!rolesMap[id]) rolesMap[id] = ROLES.ADMIN; });
        (data.leaders || []).forEach(id => { if (!rolesMap[id]) rolesMap[id] = ROLES.LEADER; });
        (data.curators || []).forEach(id => { if (!rolesMap[id]) rolesMap[id] = ROLES.CURATOR; });
        (data.moderators || []).forEach(id => { if (!rolesMap[id]) rolesMap[id] = ROLES.LEADER; });
        setMemberRoles(rolesMap);

        // Resolve announcement posts from IDs
        const announcementIds = data.announcements || [];
        if (announcementIds.length === 0) {
          setAnnouncements([]);
        } else {
          resolveAnnouncements(announcementIds);
        }
      }
    }, (err) => console.error('Error listening to community:', err));

    return () => unsubscribe();
  }, [communityId, currentUser?.uid]);

  // Check if current user is struck/banned (blocks sending)
  useEffect(() => {
    if (!currentUser?.uid || !communityId) return;

    const checkActionAllowed = async () => {
      try {
        const result = await ModerationService.checkUserActionAllowed(db, currentUser.uid, 'message', communityId);
        if (!result.allowed) {
          setIsActionBlocked(true);
          setBlockReason(result.message || 'You are restricted from sending messages.');
        } else {
          setIsActionBlocked(false);
          setBlockReason('');
        }
      } catch (e) {
        console.error('Error checking action allowed:', e);
      }
    };

    checkActionAllowed();
  }, [currentUser?.uid, communityId]);

  // Check if user is muted in this specific group chat
  useEffect(() => {
    if (!currentUser?.uid || !communityId || !groupId) return;

    const memberRef = doc(db, 'communities', communityId, 'groups', groupId, 'members', currentUser.uid);
    const unsubscribe = onSnapshot(memberRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.isMuted) {
          // Check if mute has expired
          if (data.muteExpiresAt) {
            const expires = data.muteExpiresAt.toDate ? data.muteExpiresAt.toDate() : new Date(data.muteExpiresAt);
            setIsMuted(expires > new Date());
          } else {
            setIsMuted(true); // permanent mute
          }
        } else {
          setIsMuted(false);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid, communityId, groupId]);

  // Permission helper — can current user perform action?
  const can = useCallback((action) => {
    return ModerationService.hasPermission(myRole, action);
  }, [myRole]);

  // Check if current user outranks a target user by role
  const outranks = useCallback((targetUid) => {
    const myLevel = ModerationService.getRoleLevel(myRole);
    const targetLevel = ModerationService.getRoleLevel(memberRoles[targetUid] || ROLES.MEMBER);
    return myLevel > targetLevel;
  }, [myRole, memberRoles]);

  // Resolve announcement IDs to full post objects
  const resolveAnnouncements = useCallback(async (ids) => {
    try {
      const results = await Promise.all(
        ids.map(async (postId) => {
          // Try posts subcollection first
          let snap = await getDoc(doc(db, 'communities', communityId, 'posts', postId));
          if (snap.exists()) return { id: snap.id, ...snap.data() };
          // Fall back to blogs
          snap = await getDoc(doc(db, 'communities', communityId, 'blogs', postId));
          if (snap.exists()) return { id: snap.id, ...snap.data() };
          return null;
        })
      );
      setAnnouncements(results.filter(Boolean));
    } catch (err) {
      console.error('Error resolving announcements:', err);
    }
  }, [communityId]);

  // ─── Announcement handlers ───
  const handleCreateAnnouncement = useCallback(async () => {
    const text = announcementText.trim();
    if (!text || !currentUser?.uid || !communityId) return;

    setCreatingAnnouncement(true);
    try {
      // Create announcement as a post in the community posts subcollection
      const postsRef = collection(db, 'communities', communityId, 'posts');
      const postDoc = await addDoc(postsRef, {
        text: text,
        title: text.length > 80 ? text.substring(0, 80) + '...' : text,
        type: 'announcement',
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Staff',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPinned: true,
        pinnedAt: serverTimestamp(),
        pinnedBy: currentUser.uid,
        likes: 0,
        likedBy: [],
        comments: 0,
      });

      // Pin it as an announcement on the community doc
      const communityRef = doc(db, 'communities', communityId);
      const currentAnnouncements = community?.announcements || [];

      // Auto-remove oldest if at max (3)
      if (currentAnnouncements.length >= 3) {
        await updateDoc(communityRef, {
          announcements: arrayRemove(currentAnnouncements[0]),
        });
      }

      await updateDoc(communityRef, {
        announcements: arrayUnion(postDoc.id),
        updatedAt: serverTimestamp(),
      });

      // Send system message to chat about the announcement
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'System',
        senderImage: null,
        text: `📢 New Announcement: ${text.length > 100 ? text.substring(0, 100) + '...' : text}`,
        type: 'announcement',
        createdAt: serverTimestamp(),
        isDeleted: false,
        announcementId: postDoc.id,
      });

      setAnnouncementText('');
      setShowCreateAnnouncement(false);
      Alert.alert('Success', 'Announcement created and pinned!');
    } catch (error) {
      console.error('Error creating announcement:', error);
      Alert.alert('Error', 'Failed to create announcement');
    } finally {
      setCreatingAnnouncement(false);
    }
  }, [announcementText, currentUser?.uid, communityId, groupId, community?.announcements]);

  const handleUnpinAnnouncement = useCallback(async (postId) => {
    if (!isStaff) {
      Alert.alert('Permission Denied', 'Only staff can manage announcements');
      return;
    }
    try {
      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, {
        announcements: arrayRemove(postId),
        updatedAt: serverTimestamp(),
      });
      // Clear pin flag on the post
      try {
        await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
          isPinned: false, pinnedAt: null, pinnedBy: null,
        });
      } catch {
        try {
          await updateDoc(doc(db, 'communities', communityId, 'blogs', postId), {
            isPinned: false, pinnedAt: null, pinnedBy: null,
          });
        } catch { /* non-critical */ }
      }
      Alert.alert('Success', 'Announcement unpinned');
    } catch (error) {
      console.error('Error unpinning:', error);
      Alert.alert('Error', 'Failed to unpin announcement');
    }
  }, [communityId, isStaff]);

  // Listen to messages
  useEffect(() => {
    if (!communityId || !groupId) return;

    const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMessages(messagesList);
      // FlatList is inverted — new messages auto-scroll, no manual scrollToEnd needed
    }, (error) => {
      console.error('Error fetching messages:', error);
    });

    return () => unsubscribe();
  }, [communityId, groupId]);

  const handleJoinGroup = async () => {
    if (!currentUser?.uid) {
      Alert.alert('Error', 'Please login to join this group.');
      return;
    }

    setJoining(true);
    try {
      const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
      
      // Get user info — read from cached refs (populated by the live subscription)
      // to avoid an extra round-trip; fall back to a fresh read on first join.
      let userName  = currentUserNameRef.current;
      let userImage = currentUserImageRef.current;
      if (!userName) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const membershipId = `${currentUser.uid}_${communityId}`;
        const memberDoc = await getDoc(doc(db, 'communities_members', membershipId));
        const memberData = memberDoc.exists() ? memberDoc.data() : {};
        userName  = memberData.communityNickname || getDisplayName(userData);
        userImage = normalizeImageUri(getUserAvatar(userData)) || null;
        currentUserNameRef.current  = userName;
        currentUserImageRef.current = userImage;
      }
      
      // Add member to members subcollection
      const memberRef = doc(db, 'communities', communityId, 'groups', groupId, 'members', currentUser.uid);
      await setDoc(memberRef, {
        userId: currentUser.uid,
        userName: userName,
        userImage: userImage,
        joinedAt: serverTimestamp(),
        role: 'member',
      });
      
      // Increment member count
      await updateDoc(groupRef, {
        memberCount: increment(1),
      });

      // Add join message
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'System',
        senderImage: null,
        text: `${userName} joined the group`,
        type: 'system',
        createdAt: serverTimestamp(),
        isDeleted: false,
      });

      setIsMember(true);
      Alert.alert('Success', 'You have joined the group!');
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to join group. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleSendMessage = async () => {
    const text = messageText.trim();
    const hasContent = text || selectedChatImage || recordingUri;
    if (!hasContent || !currentUser?.uid) return;

    // ── Moderation Guards ─────────────────────────────────────
    if (isActionBlocked) {
      Alert.alert('Restricted', blockReason || 'You cannot send messages right now.');
      return;
    }
    if (isMuted) {
      Alert.alert('Muted', 'You are muted in this chat. You can read but not send messages.');
      return;
    }
    // Locked chat — only staff can send
    if (groupData?.isLocked && !isStaff) {
      Alert.alert('Chat Locked', 'This chat is locked. Only staff can send messages.');
      return;
    }
    // Slowmode enforcement (skip for staff)
    const slowmodeInterval = groupData?.slowmodeInterval || 0;
    if (slowmodeInterval > 0 && !isStaff) {
      const elapsed = (Date.now() - lastSentAt) / 1000;
      if (elapsed < slowmodeInterval) {
        const remaining = Math.ceil(slowmodeInterval - elapsed);
        Alert.alert('Slowmode', `Please wait ${remaining}s before sending another message.`);
        return;
      }
    }

    setSending(true);
    setUploadingMedia(false);
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();

      let imageUrl = null;
      let voiceUrl = null;
      let msgType = 'text';

      // Upload image if selected
      if (selectedChatImage) {
        setUploadingMedia(true);
        try {
          imageUrl = await uploadImageToHostinger(selectedChatImage, 'group_chat');
          msgType = 'image';
        } catch (e) {
          Alert.alert('Upload Error', 'Failed to upload image. Try again.');
          setSending(false);
          setUploadingMedia(false);
          return;
        }
        setUploadingMedia(false);
      }

      // Upload voice if recorded
      if (recordingUri) {
        setUploadingMedia(true);
        try {
          voiceUrl = await uploadAudioToHostinger(recordingUri, 'group_chat_voice');
          msgType = 'voice';
        } catch (e) {
          Alert.alert('Upload Error', 'Failed to upload voice message. Try again.');
          setSending(false);
          setUploadingMedia(false);
          return;
        }
        setUploadingMedia(false);
      }

      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      const msgData = {
        senderId: currentUser.uid,
        senderName: userName,
        senderImage: userImage,
        text: text || '',
        type: msgType,
        createdAt: serverTimestamp(),
        isDeleted: false,
      };
      if (imageUrl) msgData.imageUrl = imageUrl;
      if (voiceUrl) msgData.voiceUrl = voiceUrl;
      if (replyTo) {
        msgData.replyTo = {
          messageId: replyTo.id,
          senderName: replyTo.senderName || replyTo.sender || 'User',
          text: replyTo.text || (replyTo.imageUrl ? '📷 Image' : replyTo.voiceUrl ? '🎤 Voice' : ''),
        };
      }

      await addDoc(messagesRef, msgData);

      const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
      const lastMsgText = imageUrl ? '📷 Image' : voiceUrl ? '🎤 Voice message' : text;
      await updateDoc(groupRef, {
        lastMessage: { text: lastMsgText, senderId: currentUser.uid, senderName: userName, createdAt: serverTimestamp() },
        messageCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      setMessageText('');
      setSelectedChatImage(null);
      setRecordingUri(null);
      setReplyTo(null);
      setLastSentAt(Date.now());
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  // ─── Moderation Action Handlers ───────────────────────────

  const handleLongPressMessage = useCallback((msg) => {
    if (msg.senderId === 'system' || msg.type === 'system') return;
    setSelectedMessage(msg);
    setShowModModal(true);
  }, []);

  const handleDeleteMessage = useCallback(async () => {
    if (!selectedMessage || !can(MOD_ACTIONS.DELETE_MESSAGE)) return;
    setModActionLoading(true);
    try {
      await ModerationService.deleteMessage(db, currentUser.uid, communityId, groupId, selectedMessage.id, 'Removed by staff');
      setShowModModal(false);
      setSelectedMessage(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to delete message');
    } finally {
      setModActionLoading(false);
    }
  }, [selectedMessage, communityId, groupId, currentUser?.uid]);

  // Regular user deleting their own message (no mod permission required)
  const handleDeleteOwnMessage = useCallback(async () => {
    if (!selectedMessage || selectedMessage.senderId !== currentUser?.uid) return;
    setModActionLoading(true);
    try {
      const msgRef = doc(db, 'communities', communityId, 'groups', groupId, 'messages', selectedMessage.id);
      await updateDoc(msgRef, {
        isDeleted: true,
        text: 'This message was deleted.',
        deletedAt: serverTimestamp(),
        deletedBy: currentUser.uid,
      });
      setShowModModal(false);
      setSelectedMessage(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to delete message');
    } finally {
      setModActionLoading(false);
    }
  }, [selectedMessage, communityId, groupId, currentUser?.uid]);

  const handleWarnUser = useCallback(async (reason) => {
    if (!selectedMessage || !can(MOD_ACTIONS.WARN_USER)) return;
    if (!outranks(selectedMessage.senderId)) {
      Alert.alert('Error', 'Cannot warn a user of equal or higher role');
      return;
    }
    setModActionLoading(true);
    try {
      await ModerationService.warnUser(db, currentUser.uid, communityId, selectedMessage.senderId, reason || 'Chat rule violation');
      Alert.alert('Done', `${selectedMessage.senderName} has been warned.`);
      setShowModModal(false);
      setSelectedMessage(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to warn user');
    } finally {
      setModActionLoading(false);
    }
  }, [selectedMessage, communityId, currentUser?.uid]);

  const handleKickUser = useCallback(async () => {
    if (!selectedMessage || !can(MOD_ACTIONS.KICK_USER)) return;
    if (!outranks(selectedMessage.senderId)) {
      Alert.alert('Error', 'Cannot kick a user of equal or higher role');
      return;
    }
    Alert.alert(
      'Kick User',
      `Remove ${selectedMessage.senderName} from this community? They can rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick', style: 'destructive', onPress: async () => {
            setModActionLoading(true);
            try {
              await ModerationService.kickUser(db, currentUser.uid, communityId, selectedMessage.senderId, 'Kicked from group chat');
              Alert.alert('Done', `${selectedMessage.senderName} has been kicked.`);
              setShowModModal(false);
              setSelectedMessage(null);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to kick user');
            } finally {
              setModActionLoading(false);
            }
          }
        }
      ]
    );
  }, [selectedMessage, communityId, currentUser?.uid]);

  const handleMuteUser = useCallback(async () => {
    if (!selectedMessage || !can(MOD_ACTIONS.MUTE_USER_IN_CHAT)) return;
    if (!outranks(selectedMessage.senderId)) {
      Alert.alert('Error', 'Cannot mute a user of equal or higher role');
      return;
    }
    Alert.alert(
      'Mute User',
      `Mute ${selectedMessage.senderName} in this chat?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '10 min', onPress: () => executeMute(10 * 60 * 1000) },
        { text: '1 hour', onPress: () => executeMute(60 * 60 * 1000) },
        { text: '24 hours', onPress: () => executeMute(24 * 60 * 60 * 1000) },
      ]
    );
  }, [selectedMessage, communityId, groupId, currentUser?.uid]);

  const executeMute = useCallback(async (durationMs) => {
    if (!selectedMessage) return;
    setModActionLoading(true);
    try {
      await ModerationService.muteUserInChat(db, currentUser.uid, communityId, groupId, selectedMessage.senderId, durationMs, 'Muted in chat');
      Alert.alert('Done', `${selectedMessage.senderName} has been muted.`);
      setShowModModal(false);
      setSelectedMessage(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to mute user');
    } finally {
      setModActionLoading(false);
    }
  }, [selectedMessage, communityId, groupId, currentUser?.uid]);

  const handleOpenStrike = useCallback(() => {
    if (!selectedMessage || !can(MOD_ACTIONS.STRIKE_USER)) return;
    if (!outranks(selectedMessage.senderId)) {
      Alert.alert('Error', 'Cannot strike a user of equal or higher role');
      return;
    }
    setStrikeTarget(selectedMessage);
    setStrikeDuration(STRIKE_DURATIONS.ONE_HOUR);
    setStrikeReason('');
    setShowModModal(false);
    setShowStrikeModal(true);
  }, [selectedMessage]);

  const handleStrikeUser = useCallback(async () => {
    if (!strikeTarget) return;
    setModActionLoading(true);
    try {
      await ModerationService.strikeUser(db, currentUser.uid, communityId, strikeTarget.senderId, strikeDuration, strikeReason || 'Rule violation');
      Alert.alert('Done', `${strikeTarget.senderName} has been struck (view-only mode).`);
      setShowStrikeModal(false);
      setStrikeTarget(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to strike user');
    } finally {
      setModActionLoading(false);
    }
  }, [strikeTarget, communityId, strikeDuration, strikeReason, currentUser?.uid]);

  const handleBanUser = useCallback(async () => {
    if (!selectedMessage || !can(MOD_ACTIONS.BAN_USER)) return;
    if (!outranks(selectedMessage.senderId)) {
      Alert.alert('Error', 'Cannot ban a user of equal or higher role');
      return;
    }
    Alert.alert(
      'Ban User',
      `Permanently ban ${selectedMessage.senderName} from this community?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban', style: 'destructive', onPress: async () => {
            setModActionLoading(true);
            try {
              await ModerationService.banUser(db, currentUser.uid, communityId, selectedMessage.senderId, 'Banned from group chat');
              Alert.alert('Done', `${selectedMessage.senderName} has been banned.`);
              setShowModModal(false);
              setSelectedMessage(null);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to ban user');
            } finally {
              setModActionLoading(false);
            }
          }
        }
      ]
    );
  }, [selectedMessage, communityId, currentUser?.uid]);

  const handleToggleLockChat = useCallback(async () => {
    if (!can(MOD_ACTIONS.LOCK_CHAT)) return;
    setModActionLoading(true);
    try {
      if (groupData?.isLocked) {
        await ModerationService.unlockChat(db, currentUser.uid, communityId, groupId);
        Alert.alert('Chat Unlocked', 'All members can send messages again.');
      } else {
        await ModerationService.lockChat(db, currentUser.uid, communityId, groupId, 'Locked by staff');
        Alert.alert('Chat Locked', 'Only staff can send messages now.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to toggle chat lock');
    } finally {
      setModActionLoading(false);
    }
  }, [groupData?.isLocked, communityId, groupId, currentUser?.uid]);

  const handleDeleteGroup = useCallback(() => {
    if (myRole !== ROLES.OWNER) return;
    Alert.alert(
      'Delete Group',
      `Are you sure you want to permanently delete "${groupData?.name || groupName || 'this group'}"? All messages will be erased and this cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              const batch = writeBatch(db);

              // Delete all messages
              const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
              const messagesSnap = await getDocs(messagesRef);
              messagesSnap.forEach((msgDoc) => batch.delete(msgDoc.ref));

              // Delete the group document itself
              batch.delete(doc(db, 'communities', communityId, 'groups', groupId));

              await batch.commit();

              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
            } catch (e) {
              console.error('Error deleting group:', e);
              Alert.alert('Error', 'Failed to delete the group. Please try again.');
            }
          },
        },
      ]
    );
  }, [myRole, communityId, groupId, groupData?.name, groupName]);

  const handleSetSlowmode = useCallback(async () => {
    if (!can(MOD_ACTIONS.SET_SLOWMODE)) return;
    const currentInterval = groupData?.slowmodeInterval || 0;
    const options = [
      { text: 'Off', onPress: () => executeSlowmode(0) },
      { text: '5s', onPress: () => executeSlowmode(5) },
      { text: '10s', onPress: () => executeSlowmode(10) },
      { text: '30s', onPress: () => executeSlowmode(30) },
      { text: '1min', onPress: () => executeSlowmode(60) },
      { text: '5min', onPress: () => executeSlowmode(300) },
    ];
    Alert.alert(
      'Set Slowmode',
      `Current: ${currentInterval > 0 ? `${currentInterval}s` : 'Off'}`,
      [{ text: 'Cancel', style: 'cancel' }, ...options]
    );
  }, [groupData?.slowmodeInterval, communityId, groupId, currentUser?.uid]);

  const executeSlowmode = useCallback(async (seconds) => {
    try {
      await ModerationService.setSlowmode(db, currentUser.uid, communityId, groupId, seconds);
      Alert.alert('Done', seconds > 0 ? `Slowmode set to ${seconds}s` : 'Slowmode disabled');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to set slowmode');
    }
  }, [communityId, groupId, currentUser?.uid]);

  const handleReportMessage = useCallback(async () => {
    if (!selectedMessage) return;
    const reasons = ModerationService.MESSAGE_REPORT_REASONS;
    Alert.alert(
      'Report Message',
      'Why are you reporting this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        ...reasons.map(r => ({
          text: r.label,
          onPress: async () => {
            try {
              const reporter = auth.currentUser;
              if (!reporter) throw new Error('Not signed in');
              const result = await ModerationService.flagMessage(db, reporter.uid, {
                messageId: selectedMessage.id,
                messageText: selectedMessage.text || '',
                reportedUserId: selectedMessage.senderId || selectedMessage.userId || 'unknown',
                reporterUsername: reporter.displayName || reporter.email || 'Unknown User',
                reportedUsername: selectedMessage.senderName || selectedMessage.sender || 'Unknown User',
                conversationId: `${communityId}_${groupId}`,
                chatType: 'group',
                reason: r.key,
                communityId: communityId,
                groupId: groupId,
              });
              if (result.success) {
                Alert.alert('Reported', 'Thank you. Our team will review this.');
              } else {
                Alert.alert('Info', result.error || 'Could not submit report.');
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to submit report');
            }
            setShowModModal(false);
            setSelectedMessage(null);
          },
        })),
      ]
    );
  }, [selectedMessage, communityId, groupId]);

  // ─── Load character collection ───
  useEffect(() => {
    if (!currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setCharacterCollection(snap.data().characterCollection || []);
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // ─── Room status listeners (voice/screening/roleplay) ───
  // Mirror of chatscreen.js: keeps message isActive in sync when a room ends
  useEffect(() => {
    if (!communityId || !groupId || !messages.length) return;

    const newRoomMsgs = messages.filter((m) =>
      ((m.type === 'voiceChat' && m.roomId) ||
        (m.type === 'screeningRoom' && m.roomId) ||
        (m.type === 'roleplay' && m.sessionId)) &&
      m.isActive &&
      !activeRoomMsgsRef.current.has(m.id)
    );
    if (newRoomMsgs.length === 0) return;

    const unsubs = [];
    newRoomMsgs.forEach((msg) => {
      activeRoomMsgsRef.current.add(msg.id);
      const msgRef = doc(db, 'communities', communityId, 'groups', groupId, 'messages', msg.id);

      if (msg.type === 'voiceChat' && msg.roomId) {
        const roomRef = doc(db, 'audio_calls', communityId, 'rooms', msg.roomId);
        const unsub = onSnapshot(roomRef, async (snap) => {
          if (!snap.exists() || (snap.exists() && !snap.data().isActive)) {
            try { await updateDoc(msgRef, { isActive: false }); } catch (_) {}
          }
        }, () => {});
        unsubs.push(unsub);
      } else if (msg.type === 'screeningRoom' && msg.roomId) {
        const roomRef = doc(db, 'screening_rooms', msg.roomId);
        const unsub = onSnapshot(roomRef, async (snap) => {
          if (!snap.exists() || (snap.exists() && !snap.data().isActive)) {
            try { await updateDoc(msgRef, { isActive: false }); } catch (_) {}
          }
        }, () => {});
        unsubs.push(unsub);
      } else if (msg.type === 'roleplay' && msg.sessionId) {
        const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', msg.sessionId);
        const unsub = onSnapshot(sessionRef, async (snap) => {
          if (!snap.exists() || (snap.exists() && snap.data().status === 'ended')) {
            try { await updateDoc(msgRef, { isActive: false }); } catch (_) {}
          }
        }, () => {});
        unsubs.push(unsub);
      }
    });

    return () => {
      unsubs.forEach((u) => u());
      newRoomMsgs.forEach((m) => activeRoomMsgsRef.current.delete(m.id));
    };
  }, [communityId, groupId, messages]);

  // ─── Slowmode countdown timer ───
  useEffect(() => {
    const interval = groupData?.slowmodeInterval || 0;
    if (interval <= 0 || isStaff) {
      setSlowmodeCooldown(0);
      return;
    }
    const remaining = Math.max(0, Math.ceil(interval - (Date.now() - lastSentAt) / 1000));
    if (remaining <= 0) { setSlowmodeCooldown(0); return; }
    setSlowmodeCooldown(remaining);
    slowmodeTimerRef.current = setInterval(() => {
      const r = Math.max(0, Math.ceil(interval - (Date.now() - lastSentAt) / 1000));
      setSlowmodeCooldown(r);
      if (r <= 0) clearInterval(slowmodeTimerRef.current);
    }, 1000);
    return () => clearInterval(slowmodeTimerRef.current);
  }, [lastSentAt, groupData?.slowmodeInterval, isStaff]);

  // ─── Helpers: resolve current user info ───
  // RC-fix: reads from the live-updated refs above instead of doing 2 fresh
  // Firestore reads on every send. Falls back to a one-time Firestore read only
  // if the subscription hasn't resolved yet (first call after cold mount).
  const resolveCurrentUserInfo = useCallback(async () => {
    if (currentUserNameRef.current && currentUserImageRef.current !== undefined) {
      return {
        userName: currentUserNameRef.current,
        userImage: currentUserImageRef.current,
      };
    }
    // First-call fallback: subscription hasn't fired yet — do the read once.
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const membershipId = `${currentUser.uid}_${communityId}`;
    const memberDoc = await getDoc(doc(db, 'communities_members', membershipId));
    const memberData = memberDoc.exists() ? memberDoc.data() : {};
    const userName  = memberData.communityNickname || getDisplayName(userData);
    const userImage = normalizeImageUri(getUserAvatar(userData)) || null;
    // Seed all refs so subsequent sends are instant and nickname-clear works
    currentUserGlobalNameRef.current = getDisplayName(userData);
    currentUserNameRef.current  = userName;
    currentUserImageRef.current = userImage;
    return { userName, userImage };
  }, [currentUser?.uid, communityId]);

  // ─── Send Sticker ───
  const handleSendSticker = useCallback(async (sticker) => {
    if (!currentUser?.uid || !communityId || !groupId) return;
    if (isActionBlocked || isMuted) return;
    if (groupData?.isLocked && !isStaff) return;
    setShowStickerPicker(false);
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userName,
        senderImage: userImage,
        text: sticker,
        type: 'sticker',
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
      await updateDoc(groupRef, {
        lastMessage: { text: '🎨 Sticker', senderId: currentUser.uid, senderName: userName, createdAt: serverTimestamp() },
        messageCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send sticker.');
    }
  }, [currentUser?.uid, communityId, groupId, isActionBlocked, isMuted, groupData?.isLocked, isStaff, resolveCurrentUserInfo]);

  // ─── Image Picker ───
  const handlePickChatImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Gallery access is needed to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelectedChatImage(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  // ─── Voice Recording ───
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is needed to record audio.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    setRecordingUri(uri);
    setRecording(null);
  }, [recording]);

  const cancelRecording = useCallback(async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    setRecording(null);
    setRecordingUri(null);
  }, [recording]);

  // ─── Create Voice Room ───
  const createVoiceRoomMessage = useCallback(async () => {
    if (!currentUser?.uid || !communityId || !groupId) {
      Alert.alert('Error', 'Unable to create voice room');
      return;
    }
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();
      const roomId = `room_${Date.now()}_${currentUser.uid}`;
      const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
      const now = new Date().toISOString();
      await setDoc(roomRef, {
        communityId,
        groupId,
        communityName: community?.name || groupName || 'Group',
        createdBy: currentUser.uid,
        createdByName: userName,
        createdAt: now,
        updatedAt: now,
        participants: [{ userId: currentUser.uid, userName, profileImage: userImage || null, joinedAt: now, isMuted: false, isSpeaking: false }],
        isActive: true,
      });
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userName,
        senderImage: userImage,
        sender: userName,
        profileImage: userImage,
        createdAt: serverTimestamp(),
        type: 'voiceChat',
        roomId,
        participants: [currentUser.uid],
        isActive: true,
        text: '',
        isDeleted: false,
      });
      setShowMiniScreen(null);
      setTimeout(() => {
        navigation.navigate('GroupAudioCall', {
          communityId,
          roomId,
          groupTitle: community?.name || groupName || 'Group',
        });
      }, 400);
    } catch (e) {
      Alert.alert('Error', 'Failed to create voice room: ' + e.message);
    }
  }, [currentUser?.uid, communityId, groupId, community, groupName, resolveCurrentUserInfo, navigation]);

  // ─── Create Screening Room ───
  const createScreeningRoomMessage = useCallback(async () => {
    if (!currentUser?.uid || !communityId || !groupId) {
      Alert.alert('Error', 'Unable to create screening room');
      return;
    }
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();
      const roomId = `screening_${Date.now()}_${currentUser.uid}`;
      const roomRef = doc(db, 'screening_rooms', roomId);
      const now = new Date().toISOString();
      await setDoc(roomRef, {
        communityId,
        groupId,
        communityName: community?.name || groupName || 'Group',
        createdBy: currentUser.uid,
        createdByName: userName,
        createdAt: now,
        updatedAt: now,
        participants: [{ userId: currentUser.uid, userName, profileImage: userImage || null, joinedAt: now }],
        isActive: true,
        playlist: [],
        currentVideo: null,
      });
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userName,
        senderImage: userImage,
        sender: userName,
        profileImage: userImage,
        createdAt: serverTimestamp(),
        type: 'screeningRoom',
        roomId,
        participants: [currentUser.uid],
        isActive: true,
        text: '',
        isDeleted: false,
      });
      setShowMiniScreen(null);
      setTimeout(() => {
        navigation.navigate('ScreenSharingRoom', {
          communityId,
          roomId,
          groupTitle: community?.name || groupName || 'Group',
        });
      }, 400);
    } catch (e) {
      Alert.alert('Error', 'Failed to create screening room: ' + e.message);
    }
  }, [currentUser?.uid, communityId, groupId, community, groupName, resolveCurrentUserInfo, navigation]);

  // ─── Roleplay: start a new session with selected characters ───
  const startRoleplayWithCharacters = useCallback(async () => {
    if (selectedCharactersForSession.length === 0) {
      Alert.alert('No Characters', 'Please select at least one character for the roleplay session');
      return;
    }
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();
      const now = new Date().toISOString();

      if (pendingRoleplayJoin) {
        // Joining existing session
        const { messageId, sessionId } = pendingRoleplayJoin;
        const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) {
          Alert.alert('Error', 'Roleplay session no longer exists');
          return;
        }
        const sessionData = sessionSnap.data();
        const existingIdx = (sessionData.participants || []).findIndex(p => p.userId === currentUser.uid);
        let updatedParticipants = [...(sessionData.participants || [])];
        let updatedCharacters = [...(sessionData.characters || [])];

        if (existingIdx >= 0) {
          updatedCharacters = updatedCharacters.filter(c => c.ownerId !== currentUser.uid);
          updatedParticipants[existingIdx].characters = selectedCharactersForSession.map(c => c.id);
        } else {
          updatedParticipants.push({ userId: currentUser.uid, userName, profileImage: userImage, joinedAt: now, characters: selectedCharactersForSession.map(c => c.id) });
        }
        selectedCharactersForSession.forEach(char => {
          updatedCharacters.push({ ...char, ownerId: currentUser.uid, ownerName: userName, available: true });
        });
        await updateDoc(sessionRef, { participants: updatedParticipants, characters: updatedCharacters, updatedAt: now });
        if (messageId) {
          try {
            await updateDoc(doc(db, 'communities', communityId, 'groups', groupId, 'messages', messageId), {
              participants: arrayUnion(currentUser.uid),
              participantsDetails: arrayUnion({ userId: currentUser.uid, userName, profileImage: userImage }),
            });
          } catch (_) {}
        }
        const toGo = selectedCharactersForSession.slice();
        setSelectedCharactersForSession([]);
        setPendingRoleplayJoin(null);
        setShowMiniScreen(null);
        navigation.navigate('RoleplayScreen', { communityId, sessionId, groupTitle: community?.name || groupName || 'Roleplay', myCharacters: toGo });
        return;
      }

      // Create new session
      const sessionId = Date.now().toString();
      const sessionData = {
        sessionId,
        communityId,
        groupId,
        createdBy: currentUser.uid,
        createdByName: userName,
        createdAt: now,
        updatedAt: now,
        characters: selectedCharactersForSession.map(char => ({ ...char, ownerId: currentUser.uid, ownerName: userName, available: true })),
        participants: [{ userId: currentUser.uid, userName, profileImage: userImage, joinedAt: now, characters: selectedCharactersForSession.map(c => c.id) }],
        status: 'active',
      };
      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
      await setDoc(sessionRef, sessionData);
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userName,
        senderImage: userImage,
        sender: userName,
        profileImage: userImage,
        text: `Started a roleplay session with ${selectedCharactersForSession.length} character(s)`,
        createdAt: serverTimestamp(),
        type: 'roleplay',
        sessionId,
        characters: selectedCharactersForSession.map(char => ({ id: char.id, name: char.name, avatar: char.avatar, subtitle: char.subtitle, themeColor: char.themeColor, gender: char.gender, age: char.age, language: char.language, tags: char.tags, description: char.description, greeting: char.greeting, ownerName: userName })),
        participants: [currentUser.uid],
        participantsDetails: [{ userId: currentUser.uid, userName, profileImage: userImage }],
        isActive: true,
        availableCharacters: selectedCharactersForSession.length,
        isDeleted: false,
      });
      const toGo = selectedCharactersForSession.slice();
      setSelectedCharactersForSession([]);
      setShowMiniScreen(null);
      setRoleplayPage(1);
      navigation.navigate('RoleplayScreen', { communityId, sessionId, groupTitle: community?.name || groupName || 'Roleplay', myCharacters: toGo });
    } catch (e) {
      Alert.alert('Error', 'Failed to start roleplay: ' + e.message);
    }
  }, [selectedCharactersForSession, pendingRoleplayJoin, currentUser?.uid, communityId, groupId, community, groupName, resolveCurrentUserInfo, navigation]);

  // ─── Join Voice Room ───
  const handleJoinVoiceChat = useCallback(async (messageId, roomId, currentParticipants = []) => {
    if (!currentUser?.uid || !communityId || !roomId) {
      Alert.alert('Error', 'Unable to join voice room');
      return;
    }
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();
      const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
      const messageRef = doc(db, 'communities', communityId, 'groups', groupId, 'messages', messageId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) { Alert.alert('Room Unavailable', 'This voice room no longer exists.'); return; }
      if (!roomSnap.data().isActive) { Alert.alert('Room Inactive', 'This voice room has ended.'); return; }
      const hasUser = Array.isArray(currentParticipants) && currentParticipants.includes(currentUser.uid);
      if (!hasUser) {
        const now = new Date().toISOString();
        await updateDoc(roomRef, { participants: arrayUnion({ userId: currentUser.uid, userName, profileImage: userImage || null, joinedAt: now, isMuted: false, isSpeaking: false }), updatedAt: now });
        await updateDoc(messageRef, { participants: arrayUnion(currentUser.uid) });
      }
      navigation.navigate('GroupAudioCall', { communityId, roomId, groupTitle: community?.name || groupName || 'Group' });
    } catch (e) {
      Alert.alert('Error', 'Failed to join voice room: ' + e.message);
    }
  }, [currentUser?.uid, communityId, groupId, community, groupName, resolveCurrentUserInfo, navigation]);

  // ─── Join Screening Room ───
  const handleJoinScreeningRoom = useCallback(async (messageId, roomId, currentParticipants = []) => {
    if (!currentUser?.uid || !communityId || !roomId) {
      Alert.alert('Error', 'Unable to join screening room');
      return;
    }
    try {
      const { userName, userImage } = await resolveCurrentUserInfo();
      const roomRef = doc(db, 'screening_rooms', roomId);
      const messageRef = doc(db, 'communities', communityId, 'groups', groupId, 'messages', messageId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) { Alert.alert('Room Unavailable', 'This screening room no longer exists.'); return; }
      if (!roomSnap.data().isActive) { Alert.alert('Room Inactive', 'This screening room has ended.'); return; }
      const hasUser = Array.isArray(currentParticipants) && currentParticipants.includes(currentUser.uid);
      if (!hasUser) {
        const now = new Date().toISOString();
        await updateDoc(roomRef, { participants: arrayUnion({ userId: currentUser.uid, userName, profileImage: userImage || null, joinedAt: now }), updatedAt: now });
        await updateDoc(messageRef, { participants: arrayUnion(currentUser.uid) });
      }
      navigation.navigate('ScreenSharingRoom', { communityId, roomId, groupTitle: community?.name || groupName || 'Group' });
    } catch (e) {
      Alert.alert('Error', 'Failed to join screening room: ' + e.message);
    }
  }, [currentUser?.uid, communityId, groupId, community, groupName, resolveCurrentUserInfo, navigation]);

  // ─── Join Roleplay ───
  const handleJoinRoleplay = useCallback(async (messageId, sessionId, roles, currentParticipants = []) => {
    if (!currentUser?.uid || !communityId || !sessionId) {
      Alert.alert('Error', 'Unable to join roleplay session');
      return;
    }
    try {
      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) { Alert.alert('Error', 'Roleplay session no longer exists'); return; }
      const sessionData = sessionSnap.data();
      const availableRoles = (sessionData.roles || []).filter(r => !r.taken);
      setPendingRoleplayJoin({ messageId, sessionId, availableRoles });
      setShowMiniScreen('roleplay');
      setRoleplayPage(1);
    } catch (e) {
      Alert.alert('Error', 'Failed to join roleplay: ' + e.message);
    }
  }, [currentUser?.uid, communityId]);

  // ─── Format message timestamp ───
  const formatMessageTime = useCallback((createdAt) => {
    if (!createdAt) return '';
    const date = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const hh = (h % 12 || 12);
    if (isToday) return `${hh}:${m} ${ampm}`;
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${hh}:${m} ${ampm}`;
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hh}:${m} ${ampm}`;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading group...</Text>
      </View>
    );
  }

  if (!isMember) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{groupName || 'Group'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.joinContainer}>
          <View style={[styles.groupIconLarge, { backgroundColor: groupColor || ACCENT }]}>
            {normalizeImageUri(groupImage) ? (
              <Image source={{ uri: normalizeImageUri(groupImage) }} style={styles.groupIconLarge} />
            ) : (
              <Text style={{ fontSize: 48 }}>{groupEmoji || '💬'}</Text>
            )}
          </View>

          <Text style={styles.joinTitle}>{groupName}</Text>
          {groupData?.description && (
            <Text style={styles.joinDescription}>{groupData.description}</Text>
          )}

          <View style={styles.joinStats}>
            <View style={styles.joinStat}>
              <Ionicons name="people" size={20} color="#888" />
              <Text style={styles.joinStatText}>{groupData?.memberCount || 0} members</Text>
            </View>
            {groupData?.settings?.privacy === 'private' && (
              <View style={styles.joinStat}>
                <Ionicons name="lock-closed" size={20} color="#888" />
                <Text style={styles.joinStatText}>Private</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.joinButton, joining && styles.joinButtonDisabled]}
            onPress={handleJoinGroup}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.joinButtonText}>Join Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => navigation.navigate('GroupDetails', {
            communityId,
            groupId,
            groupName: groupName || groupData?.name,
            groupImage,
            groupEmoji,
            groupColor,
          })}
          activeOpacity={0.7}
        >
          <View style={[styles.groupIcon, { backgroundColor: groupColor || ACCENT }]}>
            {normalizeImageUri(groupImage) ? (
              <Image source={{ uri: normalizeImageUri(groupImage) }} style={styles.groupIcon} />
            ) : (
              <Text style={{ fontSize: 20 }}>{groupEmoji || '💬'}</Text>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{groupName || 'Group'}</Text>
            <Text style={styles.headerSubtitle}>{groupData?.memberCount || 0} members</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigation.navigate('GroupDetails', {
            communityId,
            groupId,
            groupName: groupName || groupData?.name,
            groupImage,
            groupEmoji,
            groupColor,
          })}
        >
          <Ionicons name="information-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Announcement button for staff */}
        {isStaff && (
          <TouchableOpacity
            onPress={() => setShowAnnouncementsModal(true)}
            style={{ marginLeft: 8 }}
          >
            <MaterialCommunityIcons name="bullhorn" size={22} color={ACCENT} />
            {announcements.length > 0 && (
              <View style={styles.announceBadge}>
                <Text style={styles.announceBadgeText}>{announcements.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Staff tools: Lock, Slowmode, Moderation Panel */}
        {isStaff && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Staff Tools',
                `Role: ${myRole?.toUpperCase()}\nChat: ${groupData?.isLocked ? 'Locked 🔒' : 'Open'}\nSlowmode: ${groupData?.slowmodeInterval ? `${groupData.slowmodeInterval}s` : 'Off'}`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: groupData?.isLocked ? 'Unlock Chat' : 'Lock Chat',
                    onPress: handleToggleLockChat,
                  },
                  { text: 'Set Slowmode', onPress: handleSetSlowmode },
                  {
                    text: 'Mod Panel',
                    onPress: () => navigation.navigate('CommunityModeration', { communityId }),
                  },
                  ...(myRole === ROLES.OWNER ? [{
                    text: 'Delete Group',
                    style: 'destructive',
                    onPress: handleDeleteGroup,
                  }] : []),
                ]
              );
            }}
            style={{ marginLeft: 8 }}
          >
            <MaterialCommunityIcons name="shield-check" size={22} color={
              myRole === ROLES.OWNER ? '#FFD700' :
              myRole === ROLES.ADMIN ? '#FF5555' :
              myRole === ROLES.LEADER ? '#3B82F6' : '#10B981'
            } />
          </TouchableOpacity>
        )}
      </View>

      {/* Locked chat indicator */}
      {groupData?.isLocked && (
        <View style={styles.lockedBanner}>
          <Ionicons name="lock-closed" size={14} color="#F59E0B" />
          <Text style={styles.lockedBannerText}>
            Chat is locked — {isStaff ? 'only staff can send' : 'read-only'}
          </Text>
        </View>
      )}

      {/* Announcement Banner */}
      {announcements.length > 0 && !announcementsDismissed && (
        <AnnouncementBanner
          announcements={announcements}
          variant="compact"
          onPress={(a) => {
            // Show the full announcements modal when tapped
            setShowAnnouncementsModal(true);
          }}
          onDismiss={() => setAnnouncementsDismissed(true)}
        />
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          style={styles.messagesContainer}
          contentContainerStyle={[styles.messagesContent, { flexGrow: 1 }]}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
          renderItem={({ item: msg }) => {
            const isSystem = msg.type === 'system' || msg.type === 'announcement' || msg.senderId === 'system';
              const isAnnouncement = msg.type === 'announcement';
              const isCurrentUser = msg.senderId === currentUser?.uid;
              const isDeleted = msg.isDeleted;
              const senderRole = memberRoles[msg.senderId] || null;

              if (isSystem) {
                return (
                  <View key={msg.id} style={[
                    styles.systemMessageContainer,
                    isAnnouncement && styles.announcementMessageContainer,
                  ]}>
                    {isAnnouncement && (
                      <MaterialCommunityIcons name="bullhorn" size={14} color={ACCENT} style={{ marginRight: 6 }} />
                    )}
                    <Text style={[
                      styles.systemMessageText,
                      isAnnouncement && styles.announcementMessageText,
                    ]}>{msg.text}</Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={msg.id}
                  activeOpacity={0.8}
                  onLongPress={() => handleLongPressMessage(msg)}
                  delayLongPress={400}
                  style={[
                    styles.messageContainer,
                    isCurrentUser ? styles.myMessage : styles.otherMessage,
                  ]}
                >
                  {!isCurrentUser && (
                    <TouchableOpacity
                      onPress={() => {
                        if (msg.senderId && msg.senderId !== 'system') {
                          navigation.navigate('Profile', { userId: msg.senderId });
                        }
                      }}
                    >
                      <Image
                        source={normalizeImageUri(msg.senderImage) ? { uri: normalizeImageUri(msg.senderImage) } : require('../assets/a1.png')}
                        style={styles.messageAvatar}
                      />
                    </TouchableOpacity>
                  )}
                  <View style={styles.messageContent}>
                    {!isCurrentUser && (
                      <View style={styles.senderRow}>
                        <TouchableOpacity
                          onPress={() => {
                            if (msg.senderId && msg.senderId !== 'system') {
                              navigation.navigate('Profile', { userId: msg.senderId });
                            }
                          }}
                        >
                          <Text style={[
                            styles.messageSender,
                            senderRole && senderRole !== ROLES.MEMBER && {
                              color: ModerationService.getRoleDisplayInfo(senderRole).color,
                            },
                          ]}>{liveNames[msg.senderId] || msg.senderName || 'User'}</Text>
                        </TouchableOpacity>
                        {senderRole && senderRole !== ROLES.MEMBER && (
                          <RoleBadgePill role={senderRole} size="small" />
                        )}
                      </View>
                    )}

                    {/* Voice Room Card */}
                    {(msg.type === 'voiceChat' || msg.type === 'voice_room') && (
                      <TouchableOpacity
                        style={[styles.featureCard_msg, { borderColor: '#00FFFF44', opacity: msg.isActive ? 1 : 0.55 }]}
                        onPress={() => msg.isActive && handleJoinVoiceChat(msg.id, msg.roomId, msg.participants || [])}
                        disabled={!msg.isActive}
                        activeOpacity={0.75}
                      >
                        <View style={styles.featureCardRow}>
                          <View style={[styles.featureCardIcon, { backgroundColor: '#00FFFF22' }]}>
                            <MaterialCommunityIcons name="waveform" size={26} color="#00FFFF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.featureCardTitle_msg, { color: '#00FFFF' }]}>Live Voice Room</Text>
                            <Text style={styles.featureCardSub}>{liveNames[msg.senderId] || msg.senderName || 'User'} started a voice room</Text>
                            <Text style={styles.featureCardParticipants}>👥 {msg.participants?.length || 1} in room</Text>
                          </View>
                          <View style={[styles.liveChip, { backgroundColor: msg.isActive ? '#00FFFF22' : '#33333366' }]}>
                            <View style={[styles.liveDot, { backgroundColor: msg.isActive ? '#00FFFF' : '#666' }]} />
                            <Text style={[styles.liveText, { color: msg.isActive ? '#00FFFF' : '#666' }]}>{msg.isActive ? 'LIVE' : 'ENDED'}</Text>
                          </View>
                        </View>
                        {msg.isActive && (
                          <View style={styles.joinChip}>
                            <Ionicons name={msg.participants?.includes(currentUser?.uid) ? 'checkmark-circle' : 'enter-outline'} size={16} color="#000" />
                            <Text style={styles.joinChipText}>{msg.participants?.includes(currentUser?.uid) ? 'Rejoin Room' : 'Tap to Join'}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Screening Room Card */}
                    {msg.type === 'screeningRoom' && (
                      <TouchableOpacity
                        style={[styles.featureCard_msg, { borderColor: msg.isActive ? '#FF00FF44' : '#33333366', opacity: msg.isActive ? 1 : 0.55 }]}
                        onPress={() => msg.isActive && handleJoinScreeningRoom(msg.id, msg.roomId, msg.participants || [])}
                        disabled={!msg.isActive}
                        activeOpacity={0.75}
                      >
                        <View style={styles.featureCardRow}>
                          <View style={[styles.featureCardIcon, { backgroundColor: msg.isActive ? '#FF00FF22' : '#33333322' }]}>
                            <MaterialCommunityIcons name="television-play" size={26} color={msg.isActive ? '#FF00FF' : '#666'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.featureCardTitle_msg, { color: msg.isActive ? '#FF00FF' : '#888' }]}>Screening Room</Text>
                            <Text style={styles.featureCardSub}>{liveNames[msg.senderId] || msg.senderName || 'User'} started a screening room</Text>
                            <Text style={styles.featureCardParticipants}>🎬 {msg.participants?.length || 1} viewer(s)</Text>
                          </View>
                          <View style={[styles.liveChip, { backgroundColor: msg.isActive ? '#FF00FF22' : '#33333366' }]}>
                            <View style={[styles.liveDot, { backgroundColor: msg.isActive ? '#FF00FF' : '#666' }]} />
                            <Text style={[styles.liveText, { color: msg.isActive ? '#FF00FF' : '#666' }]}>{msg.isActive ? 'LIVE' : 'ENDED'}</Text>
                          </View>
                        </View>
                        {msg.isActive && (
                          <View style={[styles.joinChip, { backgroundColor: '#FF00FF' }]}>
                            <Ionicons name={msg.participants?.includes(currentUser?.uid) ? 'checkmark-circle' : 'play-outline'} size={16} color="#000" />
                            <Text style={styles.joinChipText}>{msg.participants?.includes(currentUser?.uid) ? 'Rejoin Room' : 'Watch Now'}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Roleplay Session Card */}
                    {msg.type === 'roleplay' && (
                      <TouchableOpacity
                        style={[styles.featureCard_msg, { borderColor: msg.isActive ? '#FFD70044' : '#33333366', opacity: msg.isActive ? 1 : 0.55 }]}
                        onPress={() => msg.isActive && handleJoinRoleplay(msg.id, msg.sessionId, msg.roles || [], msg.participants || [])}
                        disabled={!msg.isActive}
                        activeOpacity={0.75}
                      >
                        <View style={styles.featureCardRow}>
                          <View style={[styles.featureCardIcon, { backgroundColor: '#FFD70022' }]}>
                            <MaterialCommunityIcons name="drama-masks" size={26} color="#FFD700" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.featureCardTitle_msg, { color: msg.isActive ? '#FFD700' : '#888' }]}>Roleplay Session</Text>
                            <Text style={styles.featureCardSub}>{liveNames[msg.senderId] || msg.senderName || 'User'} started a roleplay session</Text>
                            <Text style={styles.featureCardParticipants}>🎭 {msg.participants?.length || 1} player(s) • {msg.availableCharacters || msg.characters?.length || 0} characters</Text>
                          </View>
                          <View style={[styles.liveChip, { backgroundColor: msg.isActive ? '#FFD70022' : '#33333366' }]}>
                            <View style={[styles.liveDot, { backgroundColor: msg.isActive ? '#FFD700' : '#666' }]} />
                            <Text style={[styles.liveText, { color: msg.isActive ? '#FFD700' : '#666' }]}>{msg.isActive ? 'LIVE' : 'ENDED'}</Text>
                          </View>
                        </View>
                        {/* Characters preview */}
                        {msg.characters && msg.characters.length > 0 && (
                          <View style={styles.roleplayCharactersRow}>
                            {msg.characters.slice(0, 3).map((char, idx) => (
                              <View key={idx} style={styles.roleplayCharChip}>
                                {char.avatar ? (
                                  <Image source={{ uri: char.avatar }} style={styles.roleplayCharAvatar} />
                                ) : (
                                  <View style={[styles.roleplayCharAvatar, { backgroundColor: char.themeColor || '#FFD700', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ fontSize: 12 }}>🎭</Text>
                                  </View>
                                )}
                                <Text style={[styles.roleplayCharName, char.themeColor && { color: char.themeColor }]} numberOfLines={1}>{char.name}</Text>
                              </View>
                            ))}
                            {msg.characters.length > 3 && (
                              <Text style={styles.moreCharsText}>+{msg.characters.length - 3} more</Text>
                            )}
                          </View>
                        )}
                        {msg.isActive && (
                          <View style={[styles.joinChip, { backgroundColor: '#FFD700' }]}>
                            <Ionicons name={msg.participants?.includes(currentUser?.uid) ? 'checkmark-circle' : 'person-add-outline'} size={16} color="#000" />
                            <Text style={styles.joinChipText}>{msg.participants?.includes(currentUser?.uid) ? 'Continue Playing' : 'Tap to Join'}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Sticker bubble */}
                    {msg.type === 'sticker' && !msg.isDeleted && (
                      <View style={styles.stickerBubble}>
                        <Text style={styles.stickerText}>{msg.text}</Text>
                        <Text style={[styles.msgTimestamp, isCurrentUser && styles.msgTimestampMine]}>
                          {formatMessageTime(msg.createdAt)}
                        </Text>
                      </View>
                    )}

                    {/* Regular message bubble */}
                    {msg.type !== 'voiceChat' && msg.type !== 'voice_room' && msg.type !== 'screeningRoom' && msg.type !== 'roleplay' && msg.type !== 'sticker' && (
                      <View
                        style={[
                          styles.messageBubble,
                          isCurrentUser ? styles.myMessageBubble : styles.otherMessageBubble,
                          isDeleted && styles.deletedMessageBubble,
                        ]}
                      >
                        {/* Reply preview */}
                        {msg.replyTo && !isDeleted && (
                          <View style={styles.replyPreviewBubble}>
                            <View style={styles.replyPreviewBar} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.replyPreviewSender} numberOfLines={1}>{msg.replyTo.senderName}</Text>
                              <Text style={styles.replyPreviewText} numberOfLines={1}>{msg.replyTo.text}</Text>
                            </View>
                          </View>
                        )}
                        {isDeleted ? (
                          <View style={styles.deletedRow}>
                            <Ionicons name="trash-outline" size={14} color="#666" />
                            <Text style={styles.deletedMessageText}>Message deleted</Text>
                          </View>
                        ) : (
                          <>
                            {/* Image */}
                            {msg.imageUrl && (
                              <TouchableOpacity onPress={() => setSelectedImageModal(msg.imageUrl)} activeOpacity={0.9}>
                                <Image source={{ uri: msg.imageUrl }} style={styles.chatMsgImage} resizeMode="cover" />
                              </TouchableOpacity>
                            )}
                            {/* Voice message */}
                            {msg.voiceUrl && (
                              <TouchableOpacity
                                style={[styles.voiceMsgBtn, playingVoiceId === msg.id && { backgroundColor: '#8B2EF0' }]}
                                onPress={async () => {
                                  try {
                                    if (playingVoiceId === msg.id && voiceSound) {
                                      await voiceSound.pauseAsync();
                                      setPlayingVoiceId(null);
                                      setVoiceSound(null);
                                      return;
                                    }
                                    if (voiceSound) { await voiceSound.stopAsync(); await voiceSound.unloadAsync(); }
                                    const { sound } = await Audio.Sound.createAsync({ uri: msg.voiceUrl }, { shouldPlay: true });
                                    setVoiceSound(sound);
                                    setPlayingVoiceId(msg.id);
                                    sound.setOnPlaybackStatusUpdate((status) => {
                                      if (status.didJustFinish) { setPlayingVoiceId(null); setVoiceSound(null); sound.unloadAsync(); }
                                    });
                                  } catch (e) { Alert.alert('Error', 'Failed to play voice message'); }
                                }}
                              >
                                <Ionicons name={playingVoiceId === msg.id ? 'pause' : 'play'} size={18} color="#fff" />
                                <Text style={styles.voiceMsgText}>{msg.duration ? `${Math.floor(msg.duration)}s` : '🎤 Voice message'}</Text>
                              </TouchableOpacity>
                            )}
                            {/* Text */}
                            {!!msg.text && <Text style={styles.messageText}>{msg.text}</Text>}
                            {/* Timestamp */}
                            <Text style={[styles.msgTimestamp, isCurrentUser && styles.msgTimestampMine]}>
                              {formatMessageTime(msg.createdAt)}
                            </Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
          }}
        />

        {/* Locked / Restricted / Muted Banner */}
        {(groupData?.isLocked && !isStaff) ? (
          <View style={styles.restrictedBanner}>
            <Ionicons name="lock-closed" size={16} color="#ff4b6e" />
            <Text style={styles.restrictedText}>This chat is locked. Only staff can send messages.</Text>
          </View>
        ) : isActionBlocked ? (
          <View style={styles.restrictedBanner}>
            <Ionicons name="ban" size={16} color="#ff4b6e" />
            <Text style={styles.restrictedText}>{blockReason || 'You are restricted from sending messages.'}</Text>
          </View>
        ) : isMuted ? (
          <View style={styles.restrictedBanner}>
            <Ionicons name="volume-mute" size={16} color="#ff4b6e" />
            <Text style={styles.restrictedText}>You are muted in this chat.</Text>
          </View>
        ) : (
          <>
            {/* Slowmode indicator */}
            {groupData?.slowmodeInterval > 0 && !isStaff && (
              <View style={styles.slowmodeBanner}>
                <Ionicons name="time-outline" size={14} color={slowmodeCooldown > 0 ? '#EF4444' : '#F59E0B'} />
                <Text style={[styles.slowmodeText, slowmodeCooldown > 0 && { color: '#EF4444' }]}>
                  {slowmodeCooldown > 0
                    ? `⏳ Wait ${slowmodeCooldown}s before sending`
                    : `Slowmode: ${groupData.slowmodeInterval}s between messages`}
                </Text>
              </View>
            )}

            {/* Reply preview */}
            {replyTo && (
              <View style={styles.replyPreviewBar_outer}>
                <View style={styles.replyPreviewBarAccent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyPreviewSender_outer} numberOfLines={1}>{replyTo.senderName || replyTo.sender || 'User'}</Text>
                  <Text style={styles.replyPreviewText_outer} numberOfLines={1}>{replyTo.text || (replyTo.imageUrl ? '📷 Image' : replyTo.voiceUrl ? '🎤 Voice' : '')}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={18} color="#888" />
                </TouchableOpacity>
              </View>
            )}

            {/* Image preview */}
            {selectedChatImage && (
              <View style={styles.mediaPreviewRow}>
                <Image source={{ uri: selectedChatImage }} style={styles.mediaPreviewImg} resizeMode="cover" />
                <TouchableOpacity style={styles.mediaPreviewClose} onPress={() => setSelectedChatImage(null)}>
                  <Ionicons name="close-circle" size={22} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}

            {/* Voice recording indicators */}
            {isRecording && (
              <View style={styles.recordingBanner}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording… tap ■ to stop</Text>
                <TouchableOpacity onPress={cancelRecording} style={{ marginLeft: 8 }}>
                  <Text style={{ color: '#ff4444', fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
            {recordingUri && !isRecording && (
              <View style={styles.recordingBanner}>
                <Ionicons name="mic" size={18} color={ACCENT} />
                <Text style={[styles.recordingText, { color: ACCENT }]}>Voice message ready</Text>
                <TouchableOpacity onPress={() => setRecordingUri(null)} style={{ marginLeft: 8 }}>
                  <Ionicons name="close-circle" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}

            {/* Input row */}
            <View style={styles.inputContainer}>
              {/* Action icons */}
              <TouchableOpacity onPress={handlePickChatImage} style={styles.inputIconBtn}>
                <Ionicons name="image-outline" size={22} color="#aaa" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                style={styles.inputIconBtn}
              >
                <Ionicons name={isRecording ? 'stop-circle' : 'mic-outline'} size={22} color={isRecording ? '#ff4444' : '#aaa'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setShowFeatureModal(true); }}
                style={styles.inputIconBtn}
              >
                <Text style={{ fontSize: 18 }}>🎉</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setShowStickerPicker(true); }}
                style={styles.inputIconBtn}
              >
                <Text style={{ fontSize: 18 }}>🎨</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#666"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!(messageText.trim() || selectedChatImage || recordingUri) || sending || uploadingMedia || slowmodeCooldown > 0) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!(messageText.trim() || selectedChatImage || recordingUri) || sending || uploadingMedia || slowmodeCooldown > 0}
              >
                {sending || uploadingMedia ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : slowmodeCooldown > 0 ? (
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{slowmodeCooldown}s</Text>
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* ─── Moderation Actions Modal (long-press on message) ─── */}
      <Modal
        visible={showModModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowModModal(false); setSelectedMessage(null); }}
      >
        <TouchableWithoutFeedback onPress={() => { setShowModModal(false); setSelectedMessage(null); }}>
          <View style={styles.modModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modModalContent}>
                <Text style={styles.modModalTitle}>Message Actions</Text>
                {selectedMessage && (
                  <Text style={styles.modModalSubtitle} numberOfLines={2}>
                    {selectedMessage.senderName}: "{selectedMessage.text}"
                  </Text>
                )}

                {/* Copy message text — always available for non-deleted messages */}
                {!!selectedMessage?.text && !selectedMessage?.isDeleted && (
                  <TouchableOpacity
                    style={styles.modAction}
                    onPress={() => {
                      Clipboard.setStringAsync(selectedMessage.text);
                      setShowModModal(false);
                      setSelectedMessage(null);
                      Alert.alert('Copied', 'Message copied to clipboard.');
                    }}
                  >
                    <Ionicons name="copy-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.modActionText}>Copy Text</Text>
                  </TouchableOpacity>
                )}

                {/* Reply */}
                {!selectedMessage?.isDeleted && selectedMessage?.senderId !== 'system' && (
                  <TouchableOpacity
                    style={styles.modAction}
                    onPress={() => {
                      setReplyTo(selectedMessage);
                      setShowModModal(false);
                      setSelectedMessage(null);
                    }}
                  >
                    <Ionicons name="arrow-undo-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.modActionText}>Reply</Text>
                  </TouchableOpacity>
                )}

                {/* Report — show for any message that isn't positively confirmed as own */}
                {!(selectedMessage?.senderId && selectedMessage.senderId === auth.currentUser?.uid) &&
                  !selectedMessage?.isDeleted && (
                  <TouchableOpacity style={styles.modAction} onPress={handleReportMessage}>
                    <Ionicons name="flag" size={20} color="#F59E0B" />
                    <Text style={styles.modActionText}>Report Message</Text>
                  </TouchableOpacity>
                )}

                {/* Staff: delete any message */}
                {can(MOD_ACTIONS.DELETE_MESSAGE) &&
                  selectedMessage?.senderId !== auth.currentUser?.uid && (
                  <TouchableOpacity style={styles.modAction} onPress={handleDeleteMessage} disabled={modActionLoading}>
                    <Ionicons name="trash" size={20} color="#ff4b6e" />
                    <Text style={[styles.modActionText, { color: '#ff4b6e' }]}>Delete Message</Text>
                  </TouchableOpacity>
                )}

                {can(MOD_ACTIONS.WARN_USER) &&
                  selectedMessage?.senderId !== auth.currentUser?.uid &&
                  outranks(selectedMessage?.senderId) && (
                  <TouchableOpacity style={styles.modAction} onPress={() => {
                    Alert.prompt
                      ? Alert.prompt('Warn User', 'Enter reason:', (r) => handleWarnUser(r), 'plain-text', '', 'default')
                      : handleWarnUser('Chat rule violation');
                  }} disabled={modActionLoading}>
                    <Ionicons name="warning" size={20} color="#F59E0B" />
                    <Text style={styles.modActionText}>Warn User</Text>
                  </TouchableOpacity>
                )}

                {can(MOD_ACTIONS.MUTE_USER_IN_CHAT) &&
                  selectedMessage?.senderId !== auth.currentUser?.uid &&
                  outranks(selectedMessage?.senderId) && (
                  <TouchableOpacity style={styles.modAction} onPress={handleMuteUser} disabled={modActionLoading}>
                    <Ionicons name="volume-mute" size={20} color="#F59E0B" />
                    <Text style={styles.modActionText}>Mute in Chat</Text>
                  </TouchableOpacity>
                )}

                {can(MOD_ACTIONS.STRIKE_USER) &&
                  selectedMessage?.senderId !== auth.currentUser?.uid &&
                  outranks(selectedMessage?.senderId) && (
                  <TouchableOpacity style={styles.modAction} onPress={handleOpenStrike} disabled={modActionLoading}>
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FF5555" />
                    <Text style={[styles.modActionText, { color: '#FF5555' }]}>Strike (Timeout)</Text>
                  </TouchableOpacity>
                )}

                {can(MOD_ACTIONS.KICK_USER) &&
                  selectedMessage?.senderId !== auth.currentUser?.uid &&
                  outranks(selectedMessage?.senderId) && (
                  <TouchableOpacity style={styles.modAction} onPress={handleKickUser} disabled={modActionLoading}>
                    <MaterialCommunityIcons name="account-remove" size={20} color="#ff4b6e" />
                    <Text style={[styles.modActionText, { color: '#ff4b6e' }]}>Kick from Community</Text>
                  </TouchableOpacity>
                )}

                {can(MOD_ACTIONS.BAN_USER) &&
                  selectedMessage?.senderId !== auth.currentUser?.uid &&
                  outranks(selectedMessage?.senderId) && (
                  <TouchableOpacity style={styles.modAction} onPress={handleBanUser} disabled={modActionLoading}>
                    <MaterialCommunityIcons name="cancel" size={20} color="#ff4b6e" />
                    <Text style={[styles.modActionText, { color: '#ff4b6e' }]}>Ban from Community</Text>
                  </TouchableOpacity>
                )}

                {/* Current user can delete their own message */}
                {selectedMessage?.senderId === auth.currentUser?.uid && !selectedMessage?.isDeleted && (
                  <TouchableOpacity style={styles.modAction} onPress={handleDeleteOwnMessage} disabled={modActionLoading}>
                    <Ionicons name="trash-outline" size={20} color="#ff4b6e" />
                    <Text style={[styles.modActionText, { color: '#ff4b6e' }]}>Delete My Message</Text>
                  </TouchableOpacity>
                )}

                {modActionLoading && (
                  <ActivityIndicator color={ACCENT} style={{ marginTop: 12 }} />
                )}

                <TouchableOpacity
                  style={styles.modCancelBtn}
                  onPress={() => { setShowModModal(false); setSelectedMessage(null); }}
                >
                  <Text style={styles.modCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── Strike Modal (duration + reason picker) ─── */}
      <Modal
        visible={showStrikeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStrikeModal(false)}
      >
        <View style={styles.modModalOverlay}>
          <View style={styles.strikeModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Strike User</Text>
              <TouchableOpacity onPress={() => setShowStrikeModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {strikeTarget && (
              <Text style={styles.strikeTargetName}>
                Striking: {strikeTarget.senderName}
              </Text>
            )}

            <Text style={styles.strikeSectionLabel}>Duration</Text>
            <View style={styles.strikeDurationRow}>
              {Object.entries(STRIKE_DURATION_LABELS).map(([ms, label]) => {
                const val = ms === 'null' ? null : Number(ms);
                const isSelected = strikeDuration === val;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.strikeDurationBtn, isSelected && styles.strikeDurationBtnActive]}
                    onPress={() => setStrikeDuration(val)}
                  >
                    <Text style={[styles.strikeDurationText, isSelected && styles.strikeDurationTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.strikeSectionLabel}>Reason</Text>
            <TextInput
              style={styles.strikeReasonInput}
              placeholder="Enter reason for strike..."
              placeholderTextColor="#666"
              value={strikeReason}
              onChangeText={setStrikeReason}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.publishBtn, modActionLoading && styles.publishBtnDisabled]}
              onPress={handleStrikeUser}
              disabled={modActionLoading}
            >
              {modActionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color="#fff" />
                  <Text style={styles.publishBtnText}>Apply Strike</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Announcements Management Modal ─── */}
      <Modal
        visible={showAnnouncementsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAnnouncementsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Announcements ({announcements.length}/3)
              </Text>
              <TouchableOpacity onPress={() => setShowAnnouncementsModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}>
              {/* Pinned announcements list */}
              {announcements.length === 0 ? (
                <View style={styles.emptyAnnouncements}>
                  <MaterialCommunityIcons name="bullhorn-outline" size={56} color="#444" />
                  <Text style={styles.emptyAnnouncementsTitle}>No announcements yet</Text>
                  <Text style={styles.emptyAnnouncementsSub}>
                    {isStaff ? 'Tap the + button to create one' : 'Community staff will post announcements here'}
                  </Text>
                </View>
              ) : (
                announcements.map((a) => (
                  <View key={a.id} style={styles.announcementCard}>
                    <View style={styles.announcementCardLeft}>
                      <MaterialCommunityIcons name="bullhorn" size={18} color={ACCENT} />
                    </View>
                    <View style={styles.announcementCardBody}>
                      <Text style={styles.announcementCardTitle}>
                        {a.text || a.caption || a.title || 'Announcement'}
                      </Text>
                      <Text style={styles.announcementCardDate}>
                        {a.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recent'}
                      </Text>
                    </View>
                    {isStaff && (
                      <TouchableOpacity
                        style={styles.unpinBtn}
                        onPress={() => {
                          Alert.alert('Unpin Announcement', 'Remove this announcement?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Unpin', style: 'destructive', onPress: () => handleUnpinAnnouncement(a.id) },
                          ]);
                        }}
                      >
                        <MaterialIcons name="push-pin" size={18} color="#ff4b6e" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {/* Create announcement button (staff only) */}
            {isStaff && (
              <TouchableOpacity
                style={styles.createAnnouncementBtn}
                onPress={() => {
                  setShowAnnouncementsModal(false);
                  setShowCreateAnnouncement(true);
                }}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.createAnnouncementText}>New Announcement</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Create Announcement Modal ─── */}
      <Modal
        visible={showCreateAnnouncement}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateAnnouncement(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Announcement</Text>
              <TouchableOpacity onPress={() => setShowCreateAnnouncement(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16, flex: 1 }}>
              <Text style={styles.createLabel}>Announcement Message</Text>
              <TextInput
                style={styles.createInput}
                placeholder="Write your announcement..."
                placeholderTextColor="#666"
                value={announcementText}
                onChangeText={setAnnouncementText}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{announcementText.length}/500</Text>

              <View style={styles.createInfo}>
                <Ionicons name="information-circle" size={16} color="#888" />
                <Text style={styles.createInfoText}>
                  This announcement will be pinned at the top of the group chat and visible to all members. Max 3 pinned at a time.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.publishBtn,
                (!announcementText.trim() || creatingAnnouncement) && styles.publishBtnDisabled,
              ]}
              onPress={handleCreateAnnouncement}
              disabled={!announcementText.trim() || creatingAnnouncement}
            >
              {creatingAnnouncement ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="bullhorn" size={18} color="#fff" />
                  <Text style={styles.publishBtnText}>Publish Announcement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Feature Selection Modal ─── */}
      <Modal visible={showFeatureModal} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowFeatureModal(false)}>
        <View style={styles.featureModalOverlay}>
          <View style={styles.featureModalContainer}>
            <View style={styles.featureModalHeader}>
              <Text style={styles.featureModalTitle}>Choose Activity</Text>
              <TouchableOpacity onPress={() => setShowFeatureModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.featuresGrid}>
              <TouchableOpacity style={styles.featureCardBtn} onPress={() => { setShowFeatureModal(false); setShowMiniScreen('voice'); }}>
                <LinearGradient colors={['#00FFFF', '#00CED1']} style={styles.featureGradient}>
                  <Ionicons name="call" size={40} color="#fff" />
                  <Text style={styles.featureCardBtnTitle}>Voice Room</Text>
                  <Text style={styles.featureCardBtnDesc}>Live audio with the group</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.featureCardBtn} onPress={() => { setShowFeatureModal(false); setShowMiniScreen('screening'); }}>
                <LinearGradient colors={['#FF00FF', '#DA70D6']} style={styles.featureGradient}>
                  <Ionicons name="tv" size={40} color="#fff" />
                  <Text style={styles.featureCardBtnTitle}>Screening Room</Text>
                  <Text style={styles.featureCardBtnDesc}>Watch videos together</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.featureCardBtn} onPress={() => { setShowFeatureModal(false); setPendingRoleplayJoin(null); setSelectedCharactersForSession([]); setShowMiniScreen('roleplay'); setRoleplayPage(1); }}>
                <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.featureGradient}>
                  <MaterialCommunityIcons name="drama-masks" size={40} color="#fff" />
                  <Text style={styles.featureCardBtnTitle}>Roleplay</Text>
                  <Text style={styles.featureCardBtnDesc}>Create characters & scenarios</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Voice Room Mini Screen ─── */}
      <Modal visible={showMiniScreen === 'voice'} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowMiniScreen(null)}>
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.miniScreenContent}>
              <View style={styles.miniScreenHeader}>
                <TouchableOpacity onPress={() => setShowMiniScreen(null)}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.miniScreenTitle}>Voice Room</Text>
                <View style={{ width: 28 }} />
              </View>
              <View style={styles.miniScreenBody}>
                <View style={[styles.miniScreenIcon, { backgroundColor: '#00FFFF22' }]}>
                  <Ionicons name="call" size={60} color="#00FFFF" />
                </View>
                <Text style={styles.miniScreenDesc}>Start a live voice room for real-time audio conversations with all group members.</Text>
              </View>
              <View style={styles.miniScreenActions}>
                <TouchableOpacity style={[styles.miniScreenBtn, { backgroundColor: '#00FFFF' }]} onPress={createVoiceRoomMessage}>
                  <Text style={styles.miniScreenBtnText}>Start Voice Room</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* ─── Screening Room Mini Screen ─── */}
      <Modal visible={showMiniScreen === 'screening'} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowMiniScreen(null)}>
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.miniScreenContent}>
              <View style={styles.miniScreenHeader}>
                <TouchableOpacity onPress={() => setShowMiniScreen(null)}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.miniScreenTitle}>Screening Room</Text>
                <View style={{ width: 28 }} />
              </View>
              <View style={styles.miniScreenBody}>
                <View style={[styles.miniScreenIcon, { backgroundColor: '#FF00FF22' }]}>
                  <Ionicons name="tv" size={60} color="#FF00FF" />
                </View>
                <Text style={styles.miniScreenDesc}>Create a screening room where everyone in the group can watch YouTube videos together in sync.</Text>
              </View>
              <View style={styles.miniScreenActions}>
                <TouchableOpacity style={[styles.miniScreenBtn, { backgroundColor: '#FF00FF' }]} onPress={createScreeningRoomMessage}>
                  <Text style={styles.miniScreenBtnText}>Start Screening Room</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* ─── Roleplay Mini Screen ─── */}
      <Modal visible={showMiniScreen === 'roleplay'} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => { setShowMiniScreen(null); setPendingRoleplayJoin(null); }}>
        <View style={styles.miniScreenOverlay}>
          <View style={[styles.miniScreenContainer, { maxHeight: '90%' }]}>
            <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={[styles.miniScreenContent, { paddingBottom: 24 }]}>
              <View style={styles.miniScreenHeader}>
                <TouchableOpacity onPress={() => { setShowMiniScreen(null); setPendingRoleplayJoin(null); setSelectedCharactersForSession([]); }}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.miniScreenTitle}>{pendingRoleplayJoin ? 'Join Roleplay' : 'New Roleplay'}</Text>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                {/* Character selection from collection */}
                <Text style={styles.roleplaySectionLabel}>Select your characters</Text>
                <Text style={styles.roleplaySectionSub}>Choose from your collection or create a new session</Text>

                {characterCollection.length === 0 ? (
                  <View style={styles.emptyCharsBox}>
                    <MaterialCommunityIcons name="drama-masks" size={40} color="#444" />
                    <Text style={styles.emptyCharsText}>No characters yet</Text>
                    <Text style={styles.emptyCharsSub}>Build your character collection in Roleplay to participate</Text>
                  </View>
                ) : (
                  <FlatList
                    data={characterCollection}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    numColumns={2}
                    contentContainerStyle={{ gap: 10 }}
                    columnWrapperStyle={{ gap: 10 }}
                    renderItem={({ item }) => {
                      const isSelected = selectedCharactersForSession.some(c => c.id === item.id);
                      return (
                        <TouchableOpacity
                          style={[styles.charCard, isSelected && styles.charCardSelected]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedCharactersForSession(prev => prev.filter(c => c.id !== item.id));
                            } else {
                              setSelectedCharactersForSession(prev => [...prev, item]);
                            }
                          }}
                        >
                          {item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.charCardAvatar} />
                          ) : (
                            <View style={[styles.charCardAvatar, { backgroundColor: item.themeColor || '#FFD700', justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ fontSize: 22 }}>🎭</Text>
                            </View>
                          )}
                          <Text style={[styles.charCardName, item.themeColor && { color: item.themeColor }]} numberOfLines={1}>{item.name}</Text>
                          {item.subtitle ? <Text style={styles.charCardSub} numberOfLines={1}>{item.subtitle}</Text> : null}
                          {isSelected && (
                            <View style={styles.charCardCheckmark}>
                              <Ionicons name="checkmark-circle" size={20} color="#FFD700" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                <TouchableOpacity
                  style={[styles.miniScreenBtn, { backgroundColor: '#FFD700', opacity: selectedCharactersForSession.length === 0 ? 0.5 : 1 }]}
                  onPress={startRoleplayWithCharacters}
                  disabled={selectedCharactersForSession.length === 0}
                >
                  <MaterialCommunityIcons name="drama-masks" size={20} color="#000" />
                  <Text style={[styles.miniScreenBtnText, { color: '#000', marginLeft: 8 }]}>
                    {pendingRoleplayJoin ? 'Join Session' : 'Start Roleplay'} {selectedCharactersForSession.length > 0 ? `(${selectedCharactersForSession.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* ─── Fullscreen Image Modal ─── */}
      <Modal visible={!!selectedImageModal} animationType="fade" transparent onRequestClose={() => setSelectedImageModal(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedImageModal(null)}>
          <View style={styles.imageFullscreenOverlay}>
            {selectedImageModal && (
              <Image source={{ uri: selectedImageModal }} style={styles.imageFullscreen} resizeMode="contain" />
            )}
            <TouchableOpacity style={styles.imageFullscreenClose} onPress={() => setSelectedImageModal(null)}>
              <Ionicons name="close-circle" size={36} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── Sticker Picker Modal ─── */}
      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={handleSendSticker}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '70%',
  },
  messageSender: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: ACCENT,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: CARD,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  msgTimestamp: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  msgTimestampMine: {
    alignSelf: 'flex-end',
  },
  stickerBubble: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  stickerText: {
    fontSize: 56,
    lineHeight: 68,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: BG,
    gap: 4,
  },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  joinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  groupIconLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  joinTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  joinDescription: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  joinStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 32,
  },
  joinStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinStatText: {
    color: '#888',
    fontSize: 14,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ─── Announcement styles ───
  announceBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ff4b6e',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  announceBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  announcementMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B2EF015',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
  },
  announcementMessageText: {
    color: ACCENT,
    fontWeight: '600',
    fontStyle: 'normal',
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#17171C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Announcements list
  emptyAnnouncements: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyAnnouncementsTitle: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyAnnouncementsSub: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e24',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  announcementCardLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B2EF015',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  announcementCardBody: {
    flex: 1,
  },
  announcementCardTitle: {
    color: '#eee',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  announcementCardDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  unpinBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff4b6e15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  createAnnouncementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  createAnnouncementText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Create announcement modal
  createLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  createInput: {
    backgroundColor: '#1e1e24',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#333',
  },
  charCount: {
    color: '#555',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  createInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e24',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  createInfoText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Role & Moderation Styles ───
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 12,
  },
  deletedMessageBubble: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deletedMessageText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  restrictedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ff4b6e10',
    borderTopWidth: 1,
    borderTopColor: '#ff4b6e30',
  },
  restrictedText: {
    color: '#ff4b6e',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  slowmodeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#F59E0B10',
  },
  slowmodeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F59E0B10',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B20',
  },
  lockedBannerText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },

  // Mod action modal
  modModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modModalContent: {
    backgroundColor: '#1e1e24',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 340,
  },
  modModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modModalSubtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a30',
  },
  modActionText: {
    color: '#eee',
    fontSize: 15,
    fontWeight: '500',
  },
  modCancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  modCancelText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },

  // Strike modal
  strikeModalContent: {
    backgroundColor: '#1e1e24',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '70%',
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  strikeTargetName: {
    color: '#FF5555',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  strikeSectionLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  strikeDurationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  strikeDurationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a30',
    borderWidth: 1,
    borderColor: '#333',
  },
  strikeDurationBtnActive: {
    backgroundColor: '#FF555520',
    borderColor: '#FF5555',
  },
  strikeDurationText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  strikeDurationTextActive: {
    color: '#FF5555',
  },
  strikeReasonInput: {
    backgroundColor: '#17171C',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
    textAlignVertical: 'top',
  },

  // ─── Input bar enhancements ───
  inputIconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  mediaPreviewImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  mediaPreviewClose: {
    position: 'absolute',
    top: 4,
    left: 68,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff444410',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 13,
    flex: 1,
  },

  // ─── Reply preview in input ───
  replyPreviewBar_outer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#8B2EF015',
    borderTopWidth: 1,
    borderTopColor: '#8B2EF030',
  },
  replyPreviewBarAccent: {
    width: 3,
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginRight: 10,
    minHeight: 32,
  },
  replyPreviewSender_outer: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyPreviewText_outer: {
    color: '#aaa',
    fontSize: 12,
  },

  // ─── Reply preview inside message bubble ───
  replyPreviewBubble: {
    flexDirection: 'row',
    backgroundColor: '#ffffff10',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    gap: 8,
  },
  replyPreviewBar: {
    display: 'none', // handled by borderLeft
  },
  replyPreviewSender: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyPreviewText: {
    color: '#bbb',
    fontSize: 11,
  },

  // ─── Image message ───
  chatMsgImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 4,
  },

  // ─── Voice message ───
  voiceMsgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B2EF0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 4,
  },
  voiceMsgText: {
    color: '#fff',
    fontSize: 13,
  },

  // ─── Feature message cards (in chat) ───
  featureCard_msg: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#17171C',
    maxWidth: 260,
    marginBottom: 4,
  },
  featureCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCardTitle_msg: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureCardSub: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 2,
  },
  featureCardParticipants: {
    color: '#888',
    fontSize: 11,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
  },
  joinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00FFFF',
    borderRadius: 20,
    paddingVertical: 8,
    gap: 6,
  },
  joinChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  roleplayCharactersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  roleplayCharChip: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 60,
  },
  roleplayCharAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  roleplayCharName: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 60,
  },
  moreCharsText: {
    color: '#888',
    fontSize: 11,
    alignSelf: 'center',
  },

  // ─── Feature Modal ───
  featureModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  featureModalContainer: {
    backgroundColor: '#17171C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  featureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  featureModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    justifyContent: 'space-around',
  },
  featureCardBtn: {
    width: '30%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    minHeight: 110,
    gap: 6,
  },
  featureCardBtnTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  featureCardBtnDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    textAlign: 'center',
  },

  // ─── Mini Screens ───
  miniScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  miniScreenContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  miniScreenContent: {
    flex: 1,
  },
  miniScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  miniScreenTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  miniScreenBody: {
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  miniScreenIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniScreenDesc: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  miniScreenActions: {
    padding: 20,
    gap: 12,
  },
  miniScreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  miniScreenBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Roleplay character picker ───
  roleplaySectionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  roleplaySectionSub: {
    color: '#888',
    fontSize: 13,
    marginBottom: 16,
  },
  emptyCharsBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyCharsText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyCharsSub: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },
  charCard: {
    flex: 1,
    backgroundColor: '#1e1e24',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: '45%',
  },
  charCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#FFD70010',
  },
  charCardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  charCardName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  charCardSub: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  charCardCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // ─── Fullscreen image ───
  imageFullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFullscreen: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.85,
  },
  imageFullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
});
