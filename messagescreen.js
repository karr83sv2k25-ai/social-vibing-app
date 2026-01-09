// MessagesScreen.js — Messages list with heading + icons + navigation to Chat
import React, { useMemo, useState, useEffect } from "react";
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
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, getDoc, doc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { getFriends } from './utils/friendHelpers';
import { cacheConversations, getCachedConversations, cacheUsers, getCachedUsers } from './utils/messageCache';
import StatusBadge from './components/StatusBadge';
import StatusSelector from './components/StatusSelector';
import { InlineStatus } from './components/StatusBadge';

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

  // FIXED: Check if source exists AND has a valid uri
  if (source && source.uri) {
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

  // FIXED: Also handle require() style sources
  if (source && typeof source === 'number') {
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

  // Show initials if no valid image
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
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('private'); // private, groups, invites, mentions
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [pinnedConversations, setPinnedConversations] = useState([]);
  const [mutedConversations, setMutedConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [statusSelectorVisible, setStatusSelectorVisible] = useState(false);
  const currentUser = auth.currentUser;

  // Handle notification button
  const handleNotificationPress = () => {
    navigation.navigate('Notification');
  };

  // Handle three dots menu
  const handleOptionsPress = () => {
    navigation.navigate('MessageOptions', {
      archivedCount: archivedConversations.length
    });
  };

  // Handle create group button
  const handleCreateGroup = () => {
    navigation.navigate('GroupChatCreation');
  };

  // Handle long-press on conversation
  const handleConversationLongPress = (item) => {
    const isPinned = pinnedConversations.includes(item.conversationId || item.userId);
    const isMuted = mutedConversations.includes(item.conversationId || item.userId);
    const isArchived = archivedConversations.includes(item.conversationId || item.userId);

    navigation.navigate('ChatActions', {
      chat: item,
      isPinned,
      isMuted,
      isArchived,
      onPin: handlePinConversation,
      onMute: handleMuteConversation,
      onArchive: handleArchiveConversation,
      onDelete: handleDeleteConversation,
      onMarkUnread: (chat) => {
        Alert.alert('Marked as Unread', `${chat.name} marked as unread`);
      },
      onBlock: (chat) => {
        Alert.alert('Blocked', `${chat.name} has been blocked`);
      },
    });
  };

  // Pin/Unpin conversation
  const handlePinConversation = (item) => {
    const id = item.conversationId || item.userId;
    setPinnedConversations(prev => {
      if (prev.includes(id)) {
        Alert.alert('Unpinned', `${item.name} has been unpinned`);
        return prev.filter(i => i !== id);
      } else {
        Alert.alert('Pinned', `${item.name} has been pinned to top`);
        return [id, ...prev];
      }
    });
  };

  // Mute/Unmute conversation
  const handleMuteConversation = (item) => {
    const id = item.conversationId || item.userId;
    setMutedConversations(prev => {
      if (prev.includes(id)) {
        Alert.alert('Unmuted', `${item.name} has been unmuted`);
        return prev.filter(i => i !== id);
      } else {
        Alert.alert('Muted', `${item.name} notifications have been muted`);
        return [id, ...prev];
      }
    });
  };

  // Archive/Unarchive conversation
  const handleArchiveConversation = (item) => {
    const id = item.conversationId || item.userId;
    setArchivedConversations(prev => {
      if (prev.includes(id)) {
        Alert.alert('Unarchived', `${item.name} has been unarchived`);
        return prev.filter(i => i !== id);
      } else {
        Alert.alert('Archived', `${item.name} has been archived`);
        return [id, ...prev];
      }
    });
  };

  // Delete conversation
  const handleDeleteConversation = (item) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete your conversation with ${item.name}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from local state
              setConversations(prev =>
                prev.filter(c => (c.conversationId || c.userId) !== (item.conversationId || item.userId))
              );
              Alert.alert('Deleted', 'Conversation has been deleted');
            } catch (error) {
              console.error('Error deleting conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation');
            }
          }
        }
      ]
    );
  };

  // Fetch friends list
  useEffect(() => {
    if (!currentUser) return;

    const loadFriends = async () => {
      try {
        const friendIds = await getFriends();
        console.log('Loaded friend IDs:', friendIds);
        setFriendsList(friendIds);
      } catch (error) {
        console.log('Could not load friends, using empty list');
        setFriendsList([]);
      }
    };

    loadFriends();

    // Delay snapshot listener setup to avoid SDK race condition
    const timeoutId = setTimeout(() => {
      try {
        // Set up real-time listener for friends updates
        const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
        const unsubscribe = onSnapshot(
          friendsRef,
          (snapshot) => {
            const ids = [];
            snapshot.forEach(doc => {
              ids.push(doc.data().userId);
            });
            console.log('Friends updated, count:', ids.length);
            setFriendsList(ids);
          },
          (error) => {
            // Silently handle errors - SDK will retry
            setFriendsList([]); // Set empty array on error
          }
        );

        return () => unsubscribe();
      } catch (error) {
        // Silently handle listener setup errors
        console.log('Friend listener setup deferred');
      }
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentUser]);

  // Fetch followers list
  useEffect(() => {
    if (!currentUser) return;

    // Delay snapshot listener setup to avoid SDK race condition
    const timeoutId = setTimeout(() => {
      try {
        const followersRef = collection(db, 'users', currentUser.uid, 'followers');
        const unsubscribe = onSnapshot(
          followersRef,
          (snapshot) => {
            const ids = [];
            snapshot.forEach(doc => {
              ids.push(doc.id);
            });
            console.log('Followers updated, count:', ids.length);
            setFollowersList(ids);
          },
          (error) => {
            // Silently handle errors - SDK will retry
            setFollowersList([]); // Set empty array on error
          }
        );

        return () => unsubscribe();
      } catch (error) {
        // Silently handle listener setup errors
        console.log('Follower listener setup deferred');
      }
    }, 1200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentUser]);

  // Fetch following list
  useEffect(() => {
    if (!currentUser) return;

    // Delay snapshot listener setup to avoid SDK race condition
    const timeoutId = setTimeout(() => {
      try {
        const followingRef = collection(db, 'users', currentUser.uid, 'following');
        const unsubscribe = onSnapshot(
          followingRef,
          (snapshot) => {
            const ids = [];
            snapshot.forEach(doc => {
              ids.push(doc.id);
            });
            console.log('Following updated, count:', ids.length);
            setFollowingList(ids);
          },
          (error) => {
            // Silently handle errors - SDK will retry
            setFollowingList([]); // Set empty array on error
          }
        );

        return () => unsubscribe();
      } catch (error) {
        // Silently handle listener setup errors
        console.log('Following listener setup deferred');
      }
    }, 1400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentUser]);

  // Fetch user data for friends, followers, and following (OPTIMIZED with caching)
  useEffect(() => {
    if (!currentUser) {
      setAllUsers([]);
      setLoading(false);
      return;
    }

    // Combine all user IDs (friends, followers, following) into one unique set
    const allUserIds = new Set([...friendsList, ...followersList, ...followingList]);

    if (allUserIds.size === 0) {
      setAllUsers([]);
      setLoading(false);
      return;
    }

    // Load cached users first
    getCachedUsers().then(cached => {
      if (cached && cached.length > 0) {
        setAllUsers(cached);
      }
    });

    // OPTIMIZATION: Fetch only specific users instead of entire collection
    const fetchUsersBatch = async () => {
      const users = [];
      const userIdsArray = Array.from(allUserIds);

      // Fetch in batches of 10 (Firestore 'in' query limit)
      for (let i = 0; i < userIdsArray.length; i += 10) {
        const batch = userIdsArray.slice(i, i + 10);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('__name__', 'in', batch));

        try {
          const snapshot = await getDocs(q);
          snapshot.forEach((doc) => {
            const userData = doc.data();

            // DEBUG: Log user data to check what fields exist
            console.log('👤 User data from batch for', doc.id, ':', {
              username: userData.username,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImage: userData.profileImage,
              profilePicture: userData.profilePicture,
              email: userData.email,
            });

            // Build display name - prioritize first + last name
            let displayName = 'User';

            if (userData.firstName || userData.lastName) {
              const first = userData.firstName || '';
              const last = userData.lastName || '';
              displayName = `${first} ${last}`.trim();
            } else if (userData.username && userData.username.trim()) {
              displayName = userData.username;
            } else if (userData.displayName && userData.displayName.trim()) {
              displayName = userData.displayName;
            } else if (userData.fullName && userData.fullName.trim()) {
              displayName = userData.fullName;
            } else if (userData.name && userData.name.trim()) {
              displayName = userData.name;
            } else if (userData.email) {
              displayName = userData.email.split('@')[0];
            }

            // Try multiple field names for avatar/profile picture
            const avatarUri = userData.profileImage ||
              userData.profilePicture ||
              userData.avatar ||
              userData.photoURL ||
              null;

            const handle = userData.username ? `@${userData.username}` :
              userData.handle ||
              (userData.email ? `@${userData.email.split('@')[0]}` : '@user');

            console.log('👤 Built user object:', {
              name: displayName,
              handle: handle,
              hasAvatar: !!avatarUri,
              avatarUri: avatarUri
            });

            // FIXED: Don't use { uri: null }, use fallback image directly
            const avatar = avatarUri ? { uri: avatarUri } : null;

            users.push({
              id: doc.id,
              name: displayName,
              handle: handle,
              avatar: avatar,
              userId: doc.id,
            });
          });
        } catch (error) {
          console.error('Error fetching user batch:', error);
        }
      }

      setAllUsers(users);
      setLoading(false);

      // Cache users for next load
      cacheUsers(users);
    };

    fetchUsersBatch();

    // No real-time listener needed here - data refreshes when lists change
  }, [currentUser, friendsList, followersList, followingList]);

  // Fetch conversations from Firestore (OPTIMIZED with caching and limit)
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Load cached conversations first for instant display
    getCachedConversations().then(cached => {
      if (cached && cached.length > 0) {
        setConversations(cached);
        setLoading(false);
      }
    });

    // Delay snapshot listener to avoid SDK race condition
    const timeoutId = setTimeout(() => {
      try {
        const conversationsRef = collection(db, 'conversations');
        const q = query(
          conversationsRef,
          where('participants', 'array-contains', currentUser.uid),
          orderBy('lastMessageTime', 'desc'),
          limit(25) // OPTIMIZATION: Reduced to 25 for faster initial load
        );

        console.log('🔍 Starting conversation listener for user:', currentUser.uid);

        const unsubscribe = onSnapshot(
          q,
          async (snapshot) => {
            console.log('📨 Conversations snapshot received, docs:', snapshot.docs.length);
            const convos = [];

            // OPTIMIZATION: Batch fetch all user IDs at once instead of one by one
            const userIds = new Set();
            snapshot.docs.forEach(docSnap => {
              const data = docSnap.data();
              const otherUserId = data.participants.find(id => id !== currentUser.uid);
              if (otherUserId) userIds.add(otherUserId);
            });

            // Fetch all users in batches
            const userDataMap = new Map();
            const userIdsArray = Array.from(userIds);

            for (let i = 0; i < userIdsArray.length; i += 10) {
              const batch = userIdsArray.slice(i, i + 10);
              try {
                const usersRef = collection(db, 'users');
                const userQuery = query(usersRef, where('__name__', 'in', batch));
                const userSnapshot = await getDocs(userQuery);

                userSnapshot.forEach(userDoc => {
                  userDataMap.set(userDoc.id, userDoc.data());
                });
              } catch (error) {
                console.error('Error fetching conversation users:', error);
              }
            }

            // Build conversations with cached user data
            const conversationUserIds = new Set(); // Track users we've already added to conversations

            for (const docSnap of snapshot.docs) {
              const data = docSnap.data();

              // Handle group conversations differently
              if (data.type === 'group') {
                const groupIcon = data.groupIcon || null;

                console.log('📦 Group conversation found:', {
                  id: docSnap.id,
                  name: data.groupName,
                  participants: data.participants?.length,
                  lastMessageTime: data.lastMessageTime?.toDate(),
                  hasLastMessageTime: !!data.lastMessageTime
                });

                convos.push({
                  id: docSnap.id,
                  name: data.groupName || 'Group Chat',
                  handle: `${data.participants?.length || 0} members`,
                  time: formatTime(data.lastMessageTime?.toDate()),
                  unread: data.unreadCount?.[currentUser.uid] || 0,
                  last: data.lastMessage?.text || data.lastMessage || '',
                  avatar: groupIcon ? { uri: groupIcon } : null,
                  conversationId: docSnap.id,
                  hasConversation: true,
                  isGroup: true,
                });
                continue;
              }

              // Handle 1-on-1 conversations
              const otherUserId = data.participants.find(id => id !== currentUser.uid);

              // Skip if we've already added this user (prevents duplicate conversations)
              if (conversationUserIds.has(otherUserId)) {
                continue;
              }
              conversationUserIds.add(otherUserId);

              const userData = userDataMap.get(otherUserId);

              if (userData) {
                // DEBUG: Log user data to see what fields are available
                console.log('🔍 User data for', otherUserId, ':', {
                  username: userData.username,
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  displayName: userData.displayName,
                  name: userData.name,
                  profileImage: userData.profileImage,
                  profilePicture: userData.profilePicture,
                  avatar: userData.avatar,
                  photoURL: userData.photoURL,
                });

                // Build display name - prioritize first + last name
                let displayName = 'User';

                if (userData.firstName || userData.lastName) {
                  const first = userData.firstName || '';
                  const last = userData.lastName || '';
                  displayName = `${first} ${last}`.trim();
                } else if (userData.username && userData.username.trim()) {
                  displayName = userData.username;
                } else if (userData.displayName && userData.displayName.trim()) {
                  displayName = userData.displayName;
                } else if (userData.fullName && userData.fullName.trim()) {
                  displayName = userData.fullName;
                } else if (userData.name && userData.name.trim()) {
                  displayName = userData.name;
                } else if (userData.email) {
                  displayName = userData.email.split('@')[0];
                }

                // Try multiple field names for avatar/profile picture
                const avatarUri = userData.profileImage ||
                  userData.profilePicture ||
                  userData.avatar ||
                  userData.photoURL ||
                  null;

                const handle = userData.username ? `@${userData.username}` :
                  userData.handle ||
                  (userData.email ? `@${userData.email.split('@')[0]}` : '@user');

                console.log('✅ Conversation built:', {
                  name: displayName,
                  handle: handle,
                  avatarUri: avatarUri,
                  hasAvatar: !!avatarUri
                });

                // FIXED: Don't use { uri: null }, use null so Avatar component shows initials
                const avatar = avatarUri ? { uri: avatarUri } : null;

                convos.push({
                  id: docSnap.id,
                  name: displayName,
                  handle: handle,
                  time: formatTime(data.lastMessageTime?.toDate()),
                  unread: data.unreadCount?.[currentUser.uid] || 0,
                  last: data.lastMessage || '',
                  avatar: avatar,
                  userId: otherUserId,
                  conversationId: docSnap.id,
                  hasConversation: true,
                  isGroup: data.type === 'group', // Add group indicator
                });
              } else {
                // If user data not found, still show conversation with minimal info
                convos.push({
                  id: docSnap.id,
                  name: 'User',
                  handle: '@user',
                  time: formatTime(data.lastMessageTime?.toDate()),
                  unread: data.unreadCount?.[currentUser.uid] || 0,
                  last: data.lastMessage || '',
                  avatar: null, // FIXED: Use null to show initials instead of trying to load image
                  userId: otherUserId,
                  conversationId: docSnap.id,
                  hasConversation: true,
                  isGroup: false,
                });
              }
            }

            // FIXED: Only show actual conversations, not all friends/followers
            // Users can start new conversations by going to profile or using Add Friends
            console.log('💬 Total conversations loaded:', convos.length);
            console.log('📊 Groups:', convos.filter(c => c.isGroup).length);
            console.log('📊 Private:', convos.filter(c => !c.isGroup).length);

            setConversations(convos);
            setLoading(false);

            // Cache conversations for next load
            cacheConversations(convos);
          },
          (error) => {
            // Silently handle errors - SDK will retry
            // Keep cached data on error
            setLoading(false);
          });

        return () => unsubscribe();
      } catch (error) {
        // Silently handle listener setup errors
        console.log('Conversation listener setup deferred');
        setLoading(false);
      }
    }, 1600);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentUser, allUsers]);

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    return date.toLocaleDateString();
  };

  const filtered = conversations.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.handle.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter((p) => {
    // Filter by active tab
    if (activeTab === 'groups') {
      // Groups tab: show only groups
      return p.isGroup === true;
    } else if (activeTab === 'private') {
      // Private tab: show ONLY private 1-on-1 chats (no groups)
      return p.isGroup !== true;
    } else if (activeTab === 'invites') {
      // Invites tab: No conversations should be shown here
      // This tab is meant for friend requests/group invites, not existing conversations
      return false;
    } else if (activeTab === 'mentions') {
      // Mentions tab: No conversations should be shown here
      // This tab is meant for messages where user is @mentioned
      return false;
    }
    return true;
  });

  console.log('📋 Filtered conversations:', {
    total: conversations.length,
    filtered: filtered.length,
    activeTab,
    groups: conversations.filter(c => c.isGroup).length
  });

  const handleChatPress = async (item) => {
    // If conversation exists, navigate directly
    if (item.conversationId) {
      navigation.navigate("Chat", {
        user: item,
        conversationId: item.conversationId,
        otherUserId: item.userId,
        isGroup: item.isGroup || false  // Pass group flag
      });
      return;
    }

    // If no conversation exists, create one using the helper
    try {
      const { getOrCreateConversation } = await import('./messageHelpers');
      const conversationId = await getOrCreateConversation(currentUser.uid, item.userId);

      navigation.navigate("Chat", {
        user: item,
        conversationId: conversationId,
        otherUserId: item.userId,
        isGroup: item.isGroup || false  // Pass group flag
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const renderItem = ({ item }) => {
    const id = item.conversationId || item.userId;
    const isPinned = pinnedConversations.includes(id);
    const isMuted = mutedConversations.includes(id);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.thread, isPinned && styles.pinnedThread]}
        onPress={() => handleChatPress(item)}
        onLongPress={() => handleConversationLongPress(item)}
      >
        <View style={styles.avatarContainer}>
          <Avatar name={item.name} source={item.avatar} />
          {item.isGroup && (
            <View style={styles.groupBadge}>
              <Ionicons name="people" size={12} color="#fff" />
            </View>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isPinned && <Ionicons name="pin" size={14} color={CYAN} />}
              <Text style={styles.name}>{item.name}</Text>
              {item.isGroup && (
                <MaterialCommunityIcons name="account-group" size={14} color={TEXT_DIM} />
              )}
              {isMuted && <Ionicons name="volume-mute" size={14} color={TEXT_DIM} />}
            </View>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={TEXT_DIM} />
            <Text numberOfLines={1} style={styles.lastMsg}>
              {"  "}{item.last}
            </Text>
          </View>
          {/* Show user's status if they have one */}
          {!item.isGroup && item.userId && (
            <View style={{ marginTop: 6 }}>
              <InlineStatus
                userId={item.userId}
                isOwnStatus={false}
                textStyle={{ fontSize: 13, color: '#9CA3AF' }}
              />
            </View>
          )}
        </View>

        {item.unread > 0 ? (
          <View style={styles.badge}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.unread}</Text>
          </View>
        ) : item.hasConversation ? (
          <Ionicons name="checkmark-done" size={18} color={TEXT_DIM} />
        ) : (
          <Ionicons name="chatbubble-outline" size={18} color={TEXT_DIM} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="chatbubbles" size={22} color={CYAN} />
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ color: TEXT_DIM, marginTop: 10 }}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* ===== Header ===== */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="chatbubbles" size={22} color={CYAN} />
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* User Status Badge - Click to edit */}
          <StatusBadge
            isOwnStatus={true}
            size="medium"
            showEditIcon={true}
            onPress={() => setStatusSelectorVisible(true)}
          />

          <TouchableOpacity
            style={styles.hIcon}
            onPress={handleNotificationPress}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hIcon}
            onPress={() => navigation.navigate('AddFriends')}
          >
            <Ionicons name="person-add-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hIcon}
            onPress={handleOptionsPress}
          >
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
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.input}
        />
        <TouchableOpacity>
          <Ionicons name="filter-outline" size={20} color={TEXT_DIM} />
        </TouchableOpacity>
      </View>

      {/* 🔹 Segments */}
      <View style={styles.segmentRow}>
        <Chip
          active={activeTab === 'private'}
          icon="lock-closed"
          label="Private"
          onPress={() => setActiveTab('private')}
        />
        <Chip
          active={activeTab === 'groups'}
          icon="people"
          label="Groups"
          onPress={() => setActiveTab('groups')}
        />
        <Chip
          active={activeTab === 'invites'}
          icon="mail-open-outline"
          label="Invites"
          onPress={() => setActiveTab('invites')}
        />
        <Chip
          active={activeTab === 'mentions'}
          icon="at"
          label="Mentions"
          onPress={() => setActiveTab('mentions')}
        />
      </View>

      {/* Create Group Button - Only show when Groups tab is active */}
      {activeTab === 'groups' && (
        <View style={styles.createGroupContainer}>
          <TouchableOpacity
            style={styles.createGroupButton}
            onPress={handleCreateGroup}
          >
            <Ionicons name="add-circle" size={20} color={CYAN} />
            <Text style={styles.createGroupText}>Create New Group</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 🧾 Messages List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.conversationId || `user-${item.userId}` || item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        style={{ paddingHorizontal: 14 }}
        ListEmptyComponent={() => {
          let icon = "chatbubbles-outline";
          let title = "No messages yet";
          let subtitle = "Start a conversation!";
          let showButton = false;

          if (activeTab === 'invites') {
            icon = "mail-open-outline";
            title = "No invites";
            subtitle = "Friend requests and group invitations will appear here";
            showButton = false;
          } else if (activeTab === 'mentions') {
            icon = "at";
            title = "No mentions";
            subtitle = "Messages where you're @mentioned will appear here";
            showButton = false;
          } else if (activeTab === 'groups') {
            icon = "people-outline";
            title = "No group chats";
            subtitle = "Create a group to start chatting with multiple people";
            showButton = false;
          } else if (allUsers.length === 0) {
            title = "No connections yet";
            subtitle = "Add friends or follow people to start chatting!";
            showButton = true;
          }

          return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 }}>
              <Ionicons name={icon} size={64} color={TEXT_DIM} />
              <Text style={{ color: TEXT_DIM, marginTop: 16, fontSize: 16 }}>
                {title}
              </Text>
              <Text style={{ color: TEXT_DIM, marginTop: 4, fontSize: 12, textAlign: 'center', paddingHorizontal: 40 }}>
                {subtitle}
              </Text>
              {showButton && (
                <TouchableOpacity
                  style={{
                    marginTop: 20,
                    backgroundColor: ACCENT,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 20
                  }}
                  onPress={() => navigation.navigate('AddFriends')}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Add Friends</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="home-outline" size={24} color="#888" />
          <Text style={styles.navButtonText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Community')}
        >
          <Ionicons name="people-outline" size={24} color="#888" />
          <Text style={styles.navButtonText}>Community</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('MarketPlace')}
        >
          <Ionicons name="cart-outline" size={24} color="#888" />
          <Text style={styles.navButtonText}>Market</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Message')}
        >
          <Ionicons name="chatbubbles" size={24} color="#08FFE2" />
          <Text style={[styles.navButtonText, { color: '#08FFE2' }]}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-outline" size={24} color="#888" />
          <Text style={styles.navButtonText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Status Selector Modal */}
      <StatusSelector
        visible={statusSelectorVisible}
        onClose={() => setStatusSelectorVisible(false)}
        title="Update Your Status"
      />
    </SafeAreaView>
  );
}

/* ---- Small Chip component ---- */
function Chip({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
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
    </TouchableOpacity>
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
  createGroupContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F25',
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CYAN + '44',
    gap: 8,
  },
  createGroupText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  thread: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#23232A",
  },
  pinnedThread: {
    backgroundColor: '#1A1A2E',
    borderColor: CYAN + '44',
    borderWidth: 1.5,
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
  avatarContainer: {
    position: 'relative',
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: ACCENT,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navButtonText: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
});


