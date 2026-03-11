import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export default function AddGroupMembersScreen({ navigation, route }) {
  const currentUser = auth.currentUser;
  const currentMembers = route?.params?.currentMembers || [];
  const returnScreen = route?.params?.returnScreen || 'CreateGroup';
  const groupId = route?.params?.groupId; // If adding to existing group

  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // All users from search
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Pre-select current members
    setSelectedFriends(currentMembers);
    fetchFriendsFollowersFollowing();
  }, []);

  const fetchFriendsFollowersFollowing = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const usersList = new Map(); // Use Map to avoid duplicates

      // 1. Get user's friends
      const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
      const friendsQuery = query(friendsRef, where('status', '==', 'accepted'));
      const friendsSnap = await getDocs(friendsQuery);

      for (const friendDoc of friendsSnap.docs) {
        const friendData = friendDoc.data();
        const friendId = friendData.friendId;
        if (!usersList.has(friendId)) {
          usersList.set(friendId, { userId: friendId, source: 'friend' });
        }
      }

      // 2. Get followers
      const followersRef = collection(db, 'users', currentUser.uid, 'followers');
      const followersSnap = await getDocs(followersRef);

      for (const followerDoc of followersSnap.docs) {
        const followerId = followerDoc.id;
        if (!usersList.has(followerId)) {
          usersList.set(followerId, { userId: followerId, source: 'follower' });
        }
      }

      // 3. Get following
      const followingRef = collection(db, 'users', currentUser.uid, 'following');
      const followingSnap = await getDocs(followingRef);

      for (const followingDoc of followingSnap.docs) {
        const followingId = followingDoc.id;
        if (!usersList.has(followingId)) {
          usersList.set(followingId, { userId: followingId, source: 'following' });
        }
      }

      // Fetch user data for all collected IDs
      const userIds = Array.from(usersList.keys());
      const friendsList = [];

      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('__name__', 'in', batch));
        const usersSnap = await getDocs(usersQuery);

        usersSnap.forEach(userDoc => {
          const userData = userDoc.data();
          const userInfo = usersList.get(userDoc.id);
          friendsList.push({
            userId: userDoc.id,
            displayName: userData.displayName || userData.username || userData.name || userData.fullName || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
            email: userData.email || '',
            username: userData.username || '',
            source: userInfo.source, // friend, follower, or following
          });
        });
      }

      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends/followers/following:', error);
      Alert.alert('Error', 'Failed to load contacts list.');
    } finally {
      setLoading(false);
    }
  };

  const searchAllUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setAllUsers([]);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);
      const searchLower = query.toLowerCase().trim();
      
      // Search in users collection
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      
      const searchResults = [];
      usersSnap.forEach(userDoc => {
        if (userDoc.id === currentUser.uid) return; // Skip current user
        
        const userData = userDoc.data();
        const displayName = userData.displayName || userData.username || userData.name || userData.fullName || '';
        const username = userData.username || '';
        const email = userData.email || '';
        
        // Check if matches search query
        if (
          displayName.toLowerCase().includes(searchLower) ||
          username.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower)
        ) {
          searchResults.push({
            userId: userDoc.id,
            displayName: displayName || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
            email: email,
            username: username,
            source: 'search', // Mark as search result
          });
        }
      });
      
      setAllUsers(searchResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const toggleFriend = (friend) => {
    const isSelected = selectedFriends.some(f => f.userId === friend.userId);
    
    if (isSelected) {
      setSelectedFriends(selectedFriends.filter(f => f.userId !== friend.userId));
    } else {
      setSelectedFriends([...selectedFriends, friend]);
    }
  };

  const handleDone = () => {
    if (returnScreen === 'CreateGroup') {
      navigation.navigate('CreateGroup', { selectedMembers: selectedFriends });
    } else if (returnScreen === 'GroupInfo') {
      // Handle adding members to existing group
      navigation.navigate('GroupInfo', { 
        groupId: groupId,
        newMembers: selectedFriends 
      });
    }
  };

  // Hot-loading search - filters instantly on every keystroke
  const filteredFriends = useMemo(() => {
    // If no search query, show friends/followers/following only
    if (!searchQuery || searchQuery.trim() === '') {
      return friends;
    }
    
    const searchLower = searchQuery.toLowerCase().trim();
    
    // If search is less than 2 characters, filter local friends/followers/following
    if (searchLower.length < 2) {
      return friends.filter(friend => {
        return (
          friend.displayName?.toLowerCase().includes(searchLower) ||
          friend.email?.toLowerCase().includes(searchLower) ||
          friend.username?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // If search is 2+ characters and we have search results, combine both
    // Show friends/followers/following matches first, then other users
    const localMatches = friends.filter(friend => {
      return (
        friend.displayName?.toLowerCase().includes(searchLower) ||
        friend.email?.toLowerCase().includes(searchLower) ||
        friend.username?.toLowerCase().includes(searchLower)
      );
    });
    
    // Add search results that aren't already in friends/followers/following
    const friendIds = new Set(friends.map(f => f.userId));
    const otherUsers = allUsers.filter(user => !friendIds.has(user.userId));
    
    return [...localMatches, ...otherUsers];
  }, [friends, allUsers, searchQuery]);

  // Trigger search when query changes
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2) {
      const debounceTimer = setTimeout(() => {
        searchAllUsers(searchQuery);
      }, 300); // Debounce for 300ms
      
      return () => clearTimeout(debounceTimer);
    } else {
      setAllUsers([]);
    }
  }, [searchQuery]);

  const renderFriend = ({ item }) => {
    const isSelected = selectedFriends.some(f => f.userId === item.userId);
    
    // Show badge for source (friend, follower, following, or search result)
    const getBadge = () => {
      if (item.source === 'friend') return { icon: 'people', color: ACCENT, text: 'Friend' };
      if (item.source === 'follower') return { icon: 'person-add', color: '#10B981', text: 'Follower' };
      if (item.source === 'following') return { icon: 'person-add-outline', color: '#3B82F6', text: 'Following' };
      return { icon: 'search', color: TEXT_DIM, text: 'User' };
    };
    
    const badge = getBadge();

    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => toggleFriend(item)}
      >
        <View style={styles.friendLeft}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
          )}
          <View style={styles.friendInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.friendName}>{item.displayName}</Text>
              <View style={[styles.sourceBadge, { backgroundColor: badge.color + '20' }]}>
                <Ionicons name={badge.icon} size={10} color={badge.color} />
                <Text style={[styles.sourceBadgeText, { color: badge.color }]}>
                  {badge.text}
                </Text>
              </View>
            </View>
            <Text style={styles.friendEmail} numberOfLines={1}>
              {item.username ? `@${item.username}` : item.email}
            </Text>
          </View>
        </View>
        
        <View style={[
          styles.checkbox,
          isSelected && { backgroundColor: ACCENT, borderColor: ACCENT }
        ]}>
          {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[BG, '#0F0F14', BG]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Add Members</Text>
            <Text style={styles.headerSubtitle}>
              {selectedFriends.length} selected
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleDone}
            style={styles.doneButton}
            disabled={selectedFriends.length === 0}
          >
            <Text style={[
              styles.doneText,
              selectedFriends.length === 0 && styles.doneTextDisabled
            ]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={TEXT_DIM} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends, followers, or anyone..."
              placeholderTextColor={TEXT_DIM}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={false}
              returnKeyType="search"
              enablesReturnKeyAutomatically={false}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={TEXT_DIM} />
              </TouchableOpacity>
            )}
          </View>
          {searching && (
            <View style={styles.searchingIndicator}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.searchingText}>Searching all users...</Text>
            </View>
          )}
        </View>

        {/* Selected Members Preview */}
        {selectedFriends.length > 0 && (
          <View style={styles.selectedContainer}>
            <FlatList
              horizontal
              data={selectedFriends}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <View style={styles.selectedItem}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.selectedAvatar} />
                  ) : (
                    <View style={styles.selectedAvatarPlaceholder}>
                      <Ionicons name="person" size={16} color="#fff" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => toggleFriend(item)}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.selectedName} numberOfLines={1}>
                    {item.displayName.split(' ')[0]}
                  </Text>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedList}
            />
          </View>
        )}

        {/* Friends List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={TEXT_DIM} />
            <Text style={styles.emptyText}>No contacts yet</Text>
            <Text style={styles.emptySubtext}>
              Add friends or follow users to create groups
            </Text>
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={TEXT_DIM} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery.length >= 2 
                ? 'Try a different search term'
                : 'Type at least 2 characters to search all users'}
            </Text>
          </View>
        ) : (
          <>
            {searchQuery.length >= 2 && allUsers.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {friends.some(f => 
                    f.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
                  ) ? 'Your Contacts' : 'All Users'}
                </Text>
              </View>
            )}
            <FlatList
              data={filteredFriends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.userId}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F25',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
  doneTextDisabled: {
    opacity: 0.4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  searchingText: {
    color: TEXT_DIM,
    fontSize: 12,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BG,
  },
  sectionTitle: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F25',
  },
  selectedList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  selectedItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  selectedAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  selectedAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT + '33',
    borderWidth: 2,
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  selectedName: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    maxWidth: 56,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  friendItemSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '15',
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT + '33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  friendName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  friendEmail: {
    color: TEXT_DIM,
    fontSize: 13,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: TEXT_DIM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: TEXT_DIM,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
