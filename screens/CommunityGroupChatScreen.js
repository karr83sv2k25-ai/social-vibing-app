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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { normalizeImageUri } from '../utils/normalizeUri';
import { getDisplayName, getUserAvatar } from '../utils/userNameHelpers';
import AnnouncementBanner from '../components/AnnouncementBanner';
import { RoleBadgePill } from '../components/ModeratorBadge';
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

  // Announcement state
  const [community, setCommunity] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isStaff, setIsStaff] = useState(false);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementsDismissed, setAnnouncementsDismissed] = useState(false);

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
      
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
      
      // Get user info
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      // Check for community nickname first
      const memberDoc = await getDoc(doc(db, 'communities', communityId, 'members', currentUser.uid));
      const memberData = memberDoc.exists() ? memberDoc.data() : {};
      const userName = memberData.communityNickname || getDisplayName(userData);
      const rawUserImage = getUserAvatar(userData);
      const userImage = normalizeImageUri(rawUserImage) || null;
      
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
    if (!text || !currentUser?.uid) return;

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
    try {
      // Get user info
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      // Check for community nickname first
      const memberDoc = await getDoc(doc(db, 'communities', communityId, 'members', currentUser.uid));
      const memberData = memberDoc.exists() ? memberDoc.data() : {};
      const userName = memberData.communityNickname || getDisplayName(userData);
      const rawUserImage = getUserAvatar(userData);
      const userImage = normalizeImageUri(rawUserImage) || null;

      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userName,
        senderImage: userImage,
        text: text,
        type: 'text',
        createdAt: serverTimestamp(),
        isDeleted: false,
      });

      // Update group's last message and message count
      const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
      await updateDoc(groupRef, {
        lastMessage: {
          text: text,
          senderId: currentUser.uid,
          senderName: userName,
          createdAt: serverTimestamp(),
        },
        messageCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      setMessageText('');
      setLastSentAt(Date.now());
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : (
            messages.map((msg) => {
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
                          ]}>{msg.senderName || 'User'}</Text>
                        </TouchableOpacity>
                        {senderRole && senderRole !== ROLES.MEMBER && (
                          <RoleBadgePill role={senderRole} size="small" />
                        )}
                      </View>
                    )}
                    <View
                      style={[
                        styles.messageBubble,
                        isCurrentUser ? styles.myMessageBubble : styles.otherMessageBubble,
                        isDeleted && styles.deletedMessageBubble,
                      ]}
                    >
                      {isDeleted ? (
                        <View style={styles.deletedRow}>
                          <Ionicons name="trash-outline" size={14} color="#666" />
                          <Text style={styles.deletedMessageText}>Message deleted</Text>
                        </View>
                      ) : (
                        <Text style={styles.messageText}>{msg.text}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

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
                <Ionicons name="time-outline" size={14} color="#F59E0B" />
                <Text style={styles.slowmodeText}>Slowmode: {groupData.slowmodeInterval}s between messages</Text>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputContainer}>
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
                style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
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

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
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
                      <Text style={styles.announcementCardTitle} numberOfLines={3}>
                        {a.title || a.caption || a.text || 'Announcement'}
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: BG,
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
    marginRight: 8,
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
    alignItems: 'center',
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
    fontWeight: '600',
    lineHeight: 20,
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
});
