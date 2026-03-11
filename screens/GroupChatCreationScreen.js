// screens/GroupChatCreationScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { createGroupChat } from '../utils/groupChatHelpers';
import { uploadImageToHostinger } from '../hostingerConfig';
import { normalizeBlobUri } from '../utils/normalizeUri';

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';

export default function GroupChatCreationScreen({ navigation }) {
  const [groupName, setGroupName] = useState('');
  const [groupIcon, setGroupIcon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  
  useEffect(() => {
    loadUsers();
  }, []);
  
  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchAllUsers(searchQuery);
      } else {
        setSearchUsers([]);
        setSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const searchAllUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchUsers([]);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);
      const searchLower = query.toLowerCase().trim();
      
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      
      const searchResults = [];
      usersSnap.forEach(userDoc => {
        if (userDoc.id === auth.currentUser.uid) return;
        
        const userData = userDoc.data();
        const displayName = userData.displayName || userData.username || userData.name || userData.fullName || '';
        const username = userData.username || '';
        const email = userData.email || '';
        
        if (
          displayName.toLowerCase().includes(searchLower) ||
          username.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower)
        ) {
          searchResults.push({
            id: userDoc.id,
            displayName: displayName || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
            email: email,
            username: username,
            source: 'search',
            ...userData
          });
        }
      });
      
      setSearchUsers(searchResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };
  
  const loadUsers = async () => {
    if (!auth.currentUser) return;

    try {
      setLoadingUsers(true);
      const usersList = new Map(); // Use Map to avoid duplicates

      // 1. Get user's friends
      const friendsRef = collection(db, 'users', auth.currentUser.uid, 'friends');
      const friendsQuery = query(friendsRef, where('status', '==', 'accepted'));
      const friendsSnap = await getDocs(friendsQuery);

      for (const friendDoc of friendsSnap.docs) {
        const friendData = friendDoc.data();
        const friendId = friendData.friendId;
        if (friendId && friendId !== auth.currentUser.uid) {
          usersList.set(friendId, { userId: friendId, source: 'friend' });
        }
      }

      // 2. Get followers
      const followersRef = collection(db, 'users', auth.currentUser.uid, 'followers');
      const followersSnap = await getDocs(followersRef);

      for (const followerDoc of followersSnap.docs) {
        const followerId = followerDoc.id;
        if (followerId && followerId !== auth.currentUser.uid && !usersList.has(followerId)) {
          usersList.set(followerId, { userId: followerId, source: 'follower' });
        }
      }

      // 3. Get following
      const followingRef = collection(db, 'users', auth.currentUser.uid, 'following');
      const followingSnap = await getDocs(followingRef);

      for (const followingDoc of followingSnap.docs) {
        const followingId = followingDoc.id;
        if (followingId && followingId !== auth.currentUser.uid && !usersList.has(followingId)) {
          usersList.set(followingId, { userId: followingId, source: 'following' });
        }
      }

      // Fetch user data for all collected IDs
      const userIds = Array.from(usersList.keys());
      const contactsList = [];

      // Fetch in batches of 10 (Firestore 'in' query limit)
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('__name__', 'in', batch));
        const usersSnap = await getDocs(usersQuery);

        usersSnap.forEach(userDoc => {
          const userData = userDoc.data();
          const userInfo = usersList.get(userDoc.id);
          contactsList.push({
            id: userDoc.id,
            displayName: userData.displayName || userData.username || userData.name || userData.fullName || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
            email: userData.email || '',
            username: userData.username || '',
            source: userInfo.source, // friend, follower, or following
            ...userData
          });
        });
      }
      
      setUsers(contactsList);
      console.log('Loaded contacts:', contactsList.length);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setLoadingUsers(false);
    }
  };
  
  const handlePickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      const safeUri = await normalizeBlobUri(result.assets[0].uri);
      setGroupIcon(safeUri);
    }
  };
  
  const toggleUserSelection = (user) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };
  
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one participant');
      return;
    }
    
    setLoading(true);
    
    try {
      let iconUrl = null;
      if (groupIcon) {
        iconUrl = await uploadImageToHostinger(groupIcon, 'group_icons');
      }
      
      const conversationId = await createGroupChat(auth.currentUser.uid, {
        name: groupName,
        icon: iconUrl,
        description: '',
        participantIds: selectedUsers.map(u => u.id)
      });
      
      navigation.replace('EnhancedChatV2', {
        conversationId,
        isGroup: true,
        groupName,
        groupIcon: iconUrl
      });
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };
  
  // Hot-loading search - filters instantly on every keystroke
  const filteredUsers = useMemo(() => {
    // If no search query, show all contacts
    if (!searchQuery || searchQuery.trim() === '') {
      return users;
    }
    
    // Filter local contacts first
    const searchLower = searchQuery.toLowerCase().trim();
    const localMatches = users.filter(user => {
      return (
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower) ||
        user.name?.toLowerCase().includes(searchLower) ||
        user.fullName?.toLowerCase().includes(searchLower) ||
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    });
    
    // If search query is long enough and we have search results, combine them
    if (searchQuery.trim().length >= 2 && searchUsers.length > 0) {
      const combinedMap = new Map();
      
      // Add local matches first (priority)
      localMatches.forEach(user => combinedMap.set(user.id, user));
      
      // Add search results (only if not already in contacts)
      searchUsers.forEach(user => {
        if (!combinedMap.has(user.id)) {
          combinedMap.set(user.id, user);
        }
      });
      
      return Array.from(combinedMap.values());
    }
    
    return localMatches;
  }, [users, searchQuery, searchUsers]);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity onPress={handleCreateGroup} disabled={loading}>
          <Ionicons 
            name="checkmark" 
            size={24} 
            color={loading ? "#666" : ACCENT} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Group info section */}
      <View style={styles.groupInfoSection}>
        <TouchableOpacity onPress={handlePickIcon} style={styles.iconPicker}>
          {groupIcon ? (
            <Image source={{ uri: groupIcon }} style={styles.groupIcon} />
          ) : (
            <Ionicons name="camera" size={32} color="#fff" />
          )}
        </TouchableOpacity>
        
        <TextInput
          style={styles.nameInput}
          placeholder="Group name"
          placeholderTextColor="#666"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
      </View>
      
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by name, username, or email"
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus={false}
          returnKeyType="search"
          enablesReturnKeyAutomatically={false}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching && (
          <ActivityIndicator size="small" color={ACCENT} style={{ marginLeft: 8 }} />
        )}
      </View>
      
      {/* Selected users count */}
      <Text style={styles.sectionTitle}>
        Participants: {selectedUsers.length}
      </Text>
      
      {/* Users list */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loadingUsers ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.emptyText}>Loading users...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>
                {searching ? 'Searching...' : (searchQuery ? 'No users found' : 'No contacts available')}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term' : 'Search by name, username, or email to find users'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isSelected = selectedUsers.find(u => u.id === item.id);
          
          // Show badge for source (friend, follower, following, search)
          const getBadge = () => {
            if (item.source === 'friend') return { icon: 'people', color: ACCENT, text: 'Friend' };
            if (item.source === 'follower') return { icon: 'person-add', color: '#10B981', text: 'Follower' };
            if (item.source === 'following') return { icon: 'person-add-outline', color: '#3B82F6', text: 'Following' };
            if (item.source === 'search') return { icon: 'search', color: '#6B7280', text: 'Search' };
            return null;
          };
          
          const badge = getBadge();
          
          return (
            <TouchableOpacity 
              style={styles.userItem}
              onPress={() => toggleUserSelection(item)}
            >
              <Image 
                source={{ uri: item.profileImage || item.avatar }} 
                style={styles.avatar}
              />
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>
                    {item.displayName || item.name || item.fullName || item.username || 'User'}
                  </Text>
                  {badge && (
                    <View style={[styles.sourceBadge, { backgroundColor: badge.color + '20' }]}>
                      <Ionicons name={badge.icon} size={10} color={badge.color} />
                      <Text style={[styles.sourceBadgeText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userHandle}>
                  {item.username ? `@${item.username}` : item.email || ''}
                </Text>
              </View>
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected
              ]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Creating group...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  groupInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  iconPicker: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupIcon: {
    width: 70,
    height: 70,
    borderRadius: 35
  },
  nameInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16
  },
  sectionTitle: {
    color: '#999',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    fontWeight: '600'
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    gap: 12
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333'
  },
  userInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600'
  },
  userHandle: {
    color: '#666',
    fontSize: 14
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  loadingText: {
    color: '#fff',
    fontSize: 16
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center'
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  }
});

