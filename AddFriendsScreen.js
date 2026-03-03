import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getDisplayName, getUserAvatar } from './utils/userNameHelpers';
import {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getFriendshipStatus,
  getFriends,
} from './utils/friendHelpers';

export default function AddFriendsScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'received', 'sent', 'suggestions'
  const [friendStatuses, setFriendStatuses] = useState({});
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

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      // If search is empty, reload all users
      setSearchResults([]); // Clear results first
      loadAllUsers();
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      
      // OPTIMIZATION: Search by username or email with limit
      const searchLower = searchQuery.toLowerCase();
      
      // Use indexed queries when possible for better performance
      let snapshot;
      if (searchQuery.includes('@')) {
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
    const result = await sendFriendRequest(userId);
    if (result.success) {
      Alert.alert('Success', result.message);
      searchUsers(); // Refresh to update status
      loadFriendRequests();
      loadSuggestions(); // Refresh suggestions
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleAcceptRequest = async (requestId, fromUserId) => {
    const result = await acceptFriendRequest(requestId, fromUserId);
    if (result.success) {
      Alert.alert('Success', result.message);
      loadFriendRequests();
      loadSuggestions(); // Refresh suggestions
      if (activeTab === 'search') searchUsers();
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleRejectRequest = async (requestId) => {
    const result = await rejectFriendRequest(requestId);
    if (result.success) {
      loadFriendRequests();
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleCancelRequest = async (requestId) => {
    const result = await cancelFriendRequest(requestId);
    if (result.success) {
      loadFriendRequests();
      if (activeTab === 'search') searchUsers();
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const renderActionButton = (user) => {
    switch (user.status) {
      case 'friends':
        return (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.statusText}>Friends</Text>
          </View>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.pendingButton]}
            onPress={() => {
              // Find the request ID
              const request = sentRequests.find(r => r.toUserId === user.id);
              if (request) handleCancelRequest(request.id);
            }}
          >
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptRequest(user.requestId, user.id)}
          >
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSendRequest(user.id)}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Add</Text>
          </TouchableOpacity>
        );
    }
  };

  const renderSearchItem = ({ item }) => (
    <View style={styles.userItem}>
      <Image
        source={item.avatar ? { uri: item.avatar } : require('./assets/profile.png')}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      {renderActionButton(item)}
    </View>
  );

  const renderSuggestionItem = ({ item }) => (
    <View style={styles.userItem}>
      <Image
        source={item.avatar ? { uri: item.avatar } : require('./assets/profile.png')}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.isFollower && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Follower</Text>
            </View>
          )}
          {item.isFollowing && (
            <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.badgeText}>Following</Text>
            </View>
          )}
        </View>
      </View>
      {renderActionButton(item)}
    </View>
  );

  const renderRequestItem = ({ item }) => (
    <View style={styles.userItem}>
      <Image
        source={item.userData.avatar ? { uri: item.userData.avatar } : require('./assets/profile.png')}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.userData.name}</Text>
        <Text style={styles.userEmail}>{item.userData.email}</Text>
      </View>
      <View style={styles.requestActions}>
        {activeTab === 'received' ? (
          <>
            <TouchableOpacity
              style={[styles.requestButton, styles.acceptButton]}
              onPress={() => handleAcceptRequest(item.id, item.fromUserId)}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.requestButton, styles.rejectButton]}
              onPress={() => handleRejectRequest(item.id)}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.requestButton, styles.cancelButton]}
            onPress={() => handleCancelRequest(item.id)}
          >
            <Text style={styles.requestButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friends</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Ionicons name="search" size={18} color={activeTab === 'search' ? '#7C3AED' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Ionicons name="people" size={18} color={activeTab === 'suggestions' ? '#7C3AED' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
            Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => setActiveTab('received')}
        >
          <Ionicons name="person-add" size={18} color={activeTab === 'received' ? '#7C3AED' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Requests {friendRequests.length > 0 && `(${friendRequests.length})`}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => setActiveTab('sent')}
        >
          <Ionicons name="paper-plane" size={18} color={activeTab === 'sent' ? '#7C3AED' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar (only show in search tab) */}
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username or email..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                loadAllUsers(); // Reload all users when clearing search
              }}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={
            activeTab === 'search'
              ? searchResults
              : activeTab === 'suggestions'
              ? suggestions
              : activeTab === 'received'
              ? friendRequests
              : sentRequests
          }
          renderItem={
            activeTab === 'search' 
              ? renderSearchItem 
              : activeTab === 'suggestions'
              ? renderSuggestionItem
              : renderRequestItem
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={
                  activeTab === 'search'
                    ? 'search'
                    : activeTab === 'suggestions'
                    ? 'people'
                    : activeTab === 'received'
                    ? 'person-add'
                    : 'paper-plane'
                }
                size={64}
                color="#333"
              />
              <Text style={styles.emptyText}>
                {activeTab === 'search'
                  ? 'Search for users to add as friends'
                  : activeTab === 'suggestions'
                  ? 'No suggestions - follow people to see them here!'
                  : activeTab === 'received'
                  ? 'No friend requests'
                  : 'No pending requests'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#7C3AED',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#1a1a1a',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  pendingButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
  badge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 16,
    width: 'auto',
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
});
