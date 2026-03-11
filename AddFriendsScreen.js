import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from './firebaseConfig';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getDisplayName, getUserAvatar } from './utils/userNameHelpers';
import CachedImage from './components/CachedImage';
import { ConversationSkeleton } from './components/SkeletonLoaders';
import {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getFriendshipStatus,
  getFriends,
} from './utils/friendHelpers';

// ─── Memoised tab config ──────────────────────────────────────
const TABS = [
  { key: 'search',      label: 'Search',      icon: 'search',       iconLib: 'Ionicons' },
  { key: 'suggestions', label: 'Suggestions', icon: 'account-group', iconLib: 'MaterialCommunityIcons' },
  { key: 'received',    label: 'Requests',    icon: 'person-add',   iconLib: 'Ionicons' },
  { key: 'sent',        label: 'Sent',        icon: 'paper-plane',  iconLib: 'Ionicons' },
];

// ─── User Row (memoised) ──────────────────────────────────────
const UserRow = React.memo(({ item, onAction, loadingId, type = 'search' }) => {
  const isLoading = loadingId === item.id;

  const ActionBtn = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.actionButton}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }
    switch (item.status) {
      case 'friends':
        return (
          <View style={styles.friendsBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={styles.friendsBadgeText}>Friends</Text>
          </View>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity
            style={styles.pendingButton}
            onPress={() => onAction('cancel', item)}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={14} color="#f59e0b" />
            <Text style={styles.pendingButtonText}>Pending</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => onAction('accept', item)}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAction('add', item)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add-outline" size={14} color="#fff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        );
    }
  }, [item.status, isLoading]);

  return (
    <View style={styles.userRow}>
      <View style={styles.avatarWrapper}>
        <CachedImage
          source={item.avatar ? { uri: item.avatar } : require('./assets/profile.png')}
          style={styles.avatar}
          contentFit="cover"
        />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
        {item.email ? (
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
        ) : null}
        {type === 'suggestions' && (
          <View style={styles.tagRow}>
            {item.isFollower && <View style={styles.tag}><Text style={styles.tagText}>Follows You</Text></View>}
            {item.isFollowing && <View style={[styles.tag, styles.tagBlue]}><Text style={styles.tagText}>Following</Text></View>}
          </View>
        )}
      </View>
      <ActionBtn />
    </View>
  );
});

// ─── Request Row (memoised) ───────────────────────────────────
const RequestRow = React.memo(({ item, direction, onAccept, onReject, onCancel, loadingId }) => {
  const isLoading = loadingId === item.id;
  const user = item.userData || {};

  return (
    <View style={styles.requestRow}>
      <View style={styles.avatarWrapper}>
        <CachedImage
          source={user.avatar ? { uri: user.avatar } : require('./assets/profile.png')}
          style={styles.avatar}
          contentFit="cover"
        />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{user.name || 'User'}</Text>
        {user.email ? <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text> : null}
        {direction === 'received' && (
          <Text style={styles.requestMeta}>Wants to be your friend</Text>
        )}
        {direction === 'sent' && (
          <Text style={styles.requestMeta}>Request pending…</Text>
        )}
      </View>
      {isLoading ? (
        <View style={styles.requestLoadingContainer}>
          <ActivityIndicator size="small" color="#7C3AED" />
        </View>
      ) : direction === 'received' ? (
        <View style={styles.requestBtns}>
          <TouchableOpacity style={styles.reqAcceptBtn} onPress={() => onAccept(item)} activeOpacity={0.7}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.reqBtnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reqDeclineBtn} onPress={() => onReject(item)} activeOpacity={0.7}>
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(item)} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function AddFriendsScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [loadingId, setLoadingId] = useState(null); // per-item action loading
  const debounceTimer = useRef(null);
  const currentUser = auth.currentUser;

  // Load friend requests, suggestions and all users on mount
  useEffect(() => {
    loadFriendRequests();
    loadSuggestions();
    loadAllUsers(); // Load all unfriend users initially
  }, []);

  // Load users when switching to search tab
  useEffect(() => {
    if (activeTab === 'search' && searchResults.length === 0 && !searchQuery) {
      loadAllUsers();
    }
  }, [activeTab]);

  const loadFriendRequests = async () => {
    try {
      const received = await getFriendRequests('received');
      const sent = await getFriendRequests('sent');

      // Fetch user data for requests
      const receivedWithData = await Promise.all(
        received.map(async (req) => {
          const userData = await getUserData(req.fromUserId);
          return { ...req, userData };
        })
      );

      const sentWithData = await Promise.all(
        sent.map(async (req) => {
          const userData = await getUserData(req.toUserId);
          return { ...req, userData };
        })
      );

      setFriendRequests(receivedWithData);
      setSentRequests(sentWithData);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      if (!currentUser) return;

      // Get followers
      const followersRef = collection(db, 'users', currentUser.uid, 'followers');
      const followersSnap = await getDocs(followersRef);
      const followerIds = followersSnap.docs.map(doc => doc.id);

      // Get following
      const followingRef = collection(db, 'users', currentUser.uid, 'following');
      const followingSnap = await getDocs(followingRef);
      const followingIds = followingSnap.docs.map(doc => doc.id);

      // Combine all connections
      const allConnectionIds = [...new Set([...followerIds, ...followingIds])];

      // Get friends to exclude them
      const friendIds = await getFriends();

      // Filter out friends and fetch user data
      const suggestionsData = await Promise.all(
        allConnectionIds
          .filter(id => !friendIds.includes(id))
          .map(async (id) => {
            const userData = await getUserData(id);
            const status = await getFriendshipStatus(id);
            return {
              ...userData,
              status: typeof status === 'object' ? status.status : status,
              requestId: typeof status === 'object' ? status.requestId : null,
              isFollower: followerIds.includes(id),
              isFollowing: followingIds.includes(id),
            };
          })
      );

      setSuggestions(suggestionsData);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const getUserData = async (userId) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('__name__', '==', userId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        
        const displayName = getDisplayName(userData);
        
        return {
          id: userId,
          name: displayName,
          email: userData.email || '',
          avatar: getUserAvatar(userData),
        };
      }
      return {
        id: userId,
        name: 'User',
        email: '',
        avatar: null,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return {
        id: userId,
        name: 'User',
        email: '',
        avatar: null,
      };
    }
  };

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading all users...');
      const usersRef = collection(db, 'users');
      const q = query(usersRef, limit(250)); // Load first 250 users
      const snapshot = await getDocs(q);
      console.log('📦 Fetched users:', snapshot.docs.length);
      
      const myFriends = await getFriends();
      console.log('👥 My friends:', myFriends.length);
      const results = [];
      
      // First pass: Build user list without status (faster)
      for (const doc of snapshot.docs) {
        if (doc.id === currentUser.uid) continue; // Skip current user only
        
        const userData = doc.data();
        
        // Build display name
        let userDisplayName = getDisplayName(userData);
        
        results.push({
          id: doc.id,
          name: userDisplayName,
          email: userData.email || '',
          avatar: userData.profilePicture || userData.profileImage || userData.avatar || userData.photoURL || null,
          status: 'none', // Default status
          requestId: null,
        });
      }
      
      console.log('✅ Initial results ready:', results.length);
      setSearchResults(results);
      setLoading(false);
      
      // Second pass: Update statuses in background - ONLY if this was called from initial load
      // Don't run background updates if search query exists
      if (!searchQuery.trim()) {
        const initialResults = [...results];
        for (let i = 0; i < initialResults.length; i++) {
          try {
            // Double-check search query before each status fetch
            if (searchQuery.trim()) {
              console.log('⏹️ Search detected, stopping background updates');
              break;
            }
            
            const status = await getFriendshipStatus(initialResults[i].id);
            initialResults[i].status = typeof status === 'object' ? status.status : status;
            initialResults[i].requestId = typeof status === 'object' ? status.requestId : null;
            
            // Update state periodically (every 5 users)
            if ((i + 1) % 5 === 0 || i === initialResults.length - 1) {
              // Final check before updating
              if (!searchQuery.trim()) {
                setSearchResults([...initialResults]);
              } else {
                console.log('⏹️ Search detected during update, stopping');
                break;
              }
            }
          } catch (err) {
            console.log('Error fetching status for user:', initialResults[i].id, err);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading all users:', error);
      setLoading(false);
    }
  };

  const searchUsers = async (queryParam) => {
    const activeQuery = queryParam !== undefined ? queryParam : searchQuery;
    if (!activeQuery.trim()) {
      // If search is empty, reload all users
      setSearchResults([]);
      loadAllUsers();
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      
      // OPTIMIZATION: Search by username or email with limit
      const searchLower = activeQuery.toLowerCase();
      
      // Use indexed queries when possible for better performance
      let snapshot;
      if (activeQuery.includes('@')) {
        // Email search - use where clause for better performance
        const q = query(usersRef, where('email', '>=', searchLower), where('email', '<=', searchLower + '\uf8ff'), limit(50));
        snapshot = await getDocs(q);
      } else {
        // General search - fetch more users to search through
        const q = query(usersRef, limit(250)); // Fetch 250 users to search through
        snapshot = await getDocs(q);
      }
      
      const results = [];
      
      for (const doc of snapshot.docs) {
        if (doc.id === currentUser.uid) continue; // Skip current user only
        
        const userData = doc.data();
        
        // Get all searchable fields
        const username = (userData.username || userData.user_name || '').toLowerCase();
        const email = (userData.email || userData.user_email || '').toLowerCase();
        const emailUsername = email ? email.split('@')[0] : '';
        const firstName = (userData.firstName || userData.user_firstname || '').toLowerCase();
        const lastName = (userData.lastName || userData.user_lastname || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const displayName = (userData.displayName || '').toLowerCase();
        const name = (userData.name || '').toLowerCase();
        
        // Check if search query matches any field
        const matches = username.includes(searchLower) ||
                       email.includes(searchLower) ||
                       emailUsername.includes(searchLower) ||
                       firstName.includes(searchLower) ||
                       lastName.includes(searchLower) ||
                       fullName.includes(searchLower) ||
                       displayName.includes(searchLower) ||
                       name.includes(searchLower);
        
        if (matches) {
          // Get friendship status
          const status = await getFriendshipStatus(doc.id);
          
          // Build display name
          let userDisplayName = 'User';
          if (userData.username && userData.username.trim()) {
            userDisplayName = userData.username;
          } else if (userData.firstName || userData.lastName) {
            const first = userData.firstName || '';
            const last = userData.lastName || '';
            userDisplayName = `${first} ${last}`.trim();
          } else if (userData.displayName && userData.displayName.trim()) {
            userDisplayName = userData.displayName;
          } else if (userData.email) {
            userDisplayName = userData.email.split('@')[0];
          }
          
          results.push({
            id: doc.id,
            name: userDisplayName,
            email: userData.email || '',
            avatar: userData.profilePicture || userData.profileImage || userData.avatar || userData.photoURL || null,
            status: typeof status === 'object' ? status.status : status,
            requestId: typeof status === 'object' ? status.requestId : null,
          });
          
          // OPTIMIZATION: Stop after finding 50 matches
          if (results.length >= 50) break;
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId) => {
    setLoadingId(userId);
    const result = await sendFriendRequest(userId);
    setLoadingId(null);
    if (result.success) {
      // Optimistically update UI
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, status: 'pending_sent' } : u));
      setSuggestions(prev => prev.map(u => u.id === userId ? { ...u, status: 'pending_sent' } : u));
      loadFriendRequests();
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleAcceptRequest = async (item) => {
    setLoadingId(item.id);
    const result = await acceptFriendRequest(item.id, item.fromUserId);
    setLoadingId(null);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== item.id));
      if (activeTab === 'search') searchUsers();
      loadSuggestions();
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleRejectRequest = async (item) => {
    setLoadingId(item.id);
    const result = await rejectFriendRequest(item.id);
    setLoadingId(null);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== item.id));
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleCancelRequest = async (item) => {
    setLoadingId(item.id);
    // item.requestId  — set for search/suggestion rows via getFriendshipStatus
    // sentRequests lookup — fallback if requestId wasn't cached yet
    // item.fromUserId check — only treat item.id as a request doc ID when the
    //   item IS a friend_request document (has fromUserId), NOT a user doc (item.id = userId)
    const requestId =
      item.requestId ||
      sentRequests.find(r => r.toUserId === item.id)?.id ||
      (item.fromUserId ? item.id : null);

    if (!requestId) {
      setLoadingId(null);
      Alert.alert('Error', 'Friend request not found. Please refresh and try again.');
      return;
    }

    const result = await cancelFriendRequest(requestId);
    setLoadingId(null);
    if (result.success) {
      setSentRequests(prev => prev.filter(r => r.id !== requestId));
      setSearchResults(prev => prev.map(u => u.id === item.id ? { ...u, status: 'none', requestId: null } : u));
      setSuggestions(prev => prev.map(u => u.id === item.id ? { ...u, status: 'none', requestId: null } : u));
    } else {
      Alert.alert('Error', result.message);
    }
  };

  // Unified action handler for UserRow items
  const handleUserAction = useCallback((action, item) => {
    if (action === 'add') handleSendRequest(item.id);
    else if (action === 'accept') handleAcceptRequest({ id: item.requestId, fromUserId: item.id });
    else if (action === 'cancel') handleCancelRequest(item);
  }, [sentRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFriendRequests(), loadSuggestions(), loadAllUsers()]);
    setRefreshing(false);
  }, []);

  const renderSearchItem = useCallback(({ item }) => (
    <UserRow item={item} onAction={handleUserAction} loadingId={loadingId} type="search" />
  ), [handleUserAction, loadingId]);

  const renderSuggestionItem = useCallback(({ item }) => (
    <UserRow item={item} onAction={handleUserAction} loadingId={loadingId} type="suggestions" />
  ), [handleUserAction, loadingId]);

  const renderRequestItem = useCallback(({ item }) => (
    <RequestRow
      item={item}
      direction={activeTab}
      onAccept={handleAcceptRequest}
      onReject={handleRejectRequest}
      onCancel={handleCancelRequest}
      loadingId={loadingId}
    />
  ), [activeTab, loadingId]);

  const listData = useMemo(() => {
    if (activeTab === 'search') return searchResults;
    if (activeTab === 'suggestions') return suggestions;
    if (activeTab === 'received') return friendRequests;
    return sentRequests;
  }, [activeTab, searchResults, suggestions, friendRequests, sentRequests]);

  const renderItem = useMemo(() => {
    if (activeTab === 'search') return renderSearchItem;
    if (activeTab === 'suggestions') return renderSuggestionItem;
    return renderRequestItem;
  }, [activeTab, renderSearchItem, renderSuggestionItem, renderRequestItem]);

  const EmptyState = useCallback(() => {
    const configs = {
      search:      { icon: 'account-search-outline', lib: 'MCI', title: 'Find friends',        sub: 'Search by username or email to connect with people.' },
      suggestions: { icon: 'account-multiple-plus-outline', lib: 'MCI', title: 'No suggestions yet', sub: 'Follow people to get friend suggestions here.' },
      received:    { icon: 'account-arrow-left-outline',    lib: 'MCI', title: 'No requests',   sub: "You don't have any pending friend requests." },
      sent:        { icon: 'account-arrow-right-outline',   lib: 'MCI', title: 'No sent requests', sub: 'Friend requests you send will appear here.' },
    };
    const cfg = configs[activeTab] || configs.search;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <MaterialCommunityIcons name={cfg.icon} size={36} color="#7C3AED" />
        </View>
        <Text style={styles.emptyTitle}>{cfg.title}</Text>
        <Text style={styles.emptySubtitle}>{cfg.sub}</Text>
      </View>
    );
  }, [activeTab]);

  // ── Search input change with debounce (passes text directly to avoid stale closure) ──
  const onSearchChange = (text) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (!text.trim()) {
        loadAllUsers();
      } else {
        searchUsers(text);
      }
    }, 350);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />

      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#12122a']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add Friends</Text>
          {friendRequests.length > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{friendRequests.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.placeholder} />
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badgeCount =
            tab.key === 'received' ? friendRequests.length :
            tab.key === 'sent'     ? sentRequests.length   :
            tab.key === 'suggestions' ? suggestions.length : 0;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabIconWrap}>
                {tab.iconLib === 'MaterialCommunityIcons'
                  ? <MaterialCommunityIcons name={tab.icon} size={18} color={isActive ? '#7C3AED' : '#555'} />
                  : <Ionicons name={tab.icon} size={18} color={isActive ? '#7C3AED' : '#555'} />
                }
                {badgeCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]} numberOfLines={1}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Bar (search tab only) */}
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#555" style={{ marginLeft: 4 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search username, name or email…"
              placeholderTextColor="#555"
              value={searchQuery}
              onChangeText={onSearchChange}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => { setSearchQuery(''); loadAllUsers(); }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close-circle" size={18} color="#555" style={{ marginRight: 4 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Section count label */}
      {!loading && listData.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>{listData.length} {listData.length === 1 ? 'person' : 'people'}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <ConversationSkeleton count={7} />
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, listData.length === 0 && { flex: 1 }]}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerBadge: {
    backgroundColor: '#ef4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  placeholder: {
    width: 38,
  },

  // ── Tab Bar ──────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    position: 'relative',
  },
  activeTab: {},
  tabIconWrap: {
    position: 'relative',
    marginBottom: 3,
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#7C3AED',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#111',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 10,
    color: '#555',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 2.5,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },

  // ── Search ───────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    height: 44,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 0,
  },

  // ── Count Row ─────────────────────────────────────────────────
  countRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── List ─────────────────────────────────────────────────────
  listContainer: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    paddingTop: 4,
  },

  // ── User Row ─────────────────────────────────────────────────
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242424',
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f0f0',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#555',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  tag: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBlue: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  tagText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Action Buttons ───────────────────────────────────────────
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
    minWidth: 72,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
    minWidth: 72,
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
    minWidth: 80,
    justifyContent: 'center',
  },
  pendingButtonText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 12,
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  friendsBadgeText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 12,
  },

  // ── Request Row ──────────────────────────────────────────────
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242424',
  },
  requestMeta: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 3,
    fontWeight: '500',
  },
  requestBtns: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  reqAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  reqDeclineBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reqBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(107,114,128,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.25)',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 13,
  },
  requestLoadingContainer: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty State ───────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d1d1d1',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
});

