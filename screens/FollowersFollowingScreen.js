import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

const ACCENT = '#8B2EF0';
const BG = '#0B0B0E';
const CARD = '#17171C';

export default function FollowersFollowingScreen({ navigation, route }) {
  const { userId, type = 'followers' } = route?.params || {}; // type: 'followers' or 'following'
  const currentUser = auth.currentUser;

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingIds, setFollowingIds] = useState([]);
  const [loadingIds, setLoadingIds] = useState([]);

  // Fetch followers or following
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const collectionName = type === 'followers' ? 'followers' : 'following';
    const usersRef = collection(db, 'users', userId, collectionName);

    const unsubscribe = onSnapshot(usersRef, async (snapshot) => {
      console.log(`📊 ${type} snapshot received: ${snapshot.size} users for ${userId}`);
      console.log(`🔍 Snapshot metadata - fromCache: ${snapshot.metadata.fromCache}, hasPendingWrites: ${snapshot.metadata.hasPendingWrites}`);
      
      const userIds = snapshot.docs.map((doc) => doc.data().userId);
      
      // If no users, set empty and stop loading
      if (userIds.length === 0) {
        console.log(`❌ No ${type} found, showing empty state`);
        setUsers([]);
        setFilteredUsers([]);
        setLoading(false);
        return;
      }
      
      // Fetch user details for each ID
      const usersPromises = userIds.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            return {
              id: uid,
              ...userDoc.data(),
            };
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
        return null;
      });

      const usersList = (await Promise.all(usersPromises)).filter(Boolean);
      console.log(`✅ Successfully loaded ${usersList.length} ${type} users`);
      setUsers(usersList);
      setFilteredUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching ${type}:`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, type]);

  // Fetch current user's following list
  useEffect(() => {
    if (!currentUser?.uid) return;

    const followingRef = collection(db, 'users', currentUser.uid, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      const ids = snapshot.docs.map((doc) => doc.data().userId);
      setFollowingIds(ids);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter((user) =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleToggleFollow = async (targetUserId) => {
    if (!currentUser?.uid || targetUserId === currentUser.uid) return;
    if (loadingIds.includes(targetUserId)) return;

    console.log(`👤 Toggle follow for user: ${targetUserId}`);
    setLoadingIds((prev) => [...prev, targetUserId]);

    try {
      const followDocRef = doc(db, 'users', currentUser.uid, 'following', targetUserId);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      const targetUserRef = doc(db, 'users', targetUserId);
      const isFollowing = followingIds.includes(targetUserId);

      console.log(`${isFollowing ? '❌ Unfollowing' : '✅ Following'} user: ${targetUserId}`);

      if (isFollowing) {
        // Unfollow
        await deleteDoc(followDocRef);
        
        // Remove from target user's followers
        const followerDocRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
        await deleteDoc(followerDocRef);
        
        // Decrement counters
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
        
        // Send unfollow notification
        try {
          const currentUserDoc = await getDoc(currentUserRef);
          const currentUserData = currentUserDoc.data() || {};
          
          const notificationData = {
            type: 'unfollow',
            fromUserId: currentUser.uid,
            fromUserName: currentUserData.name || currentUserData.displayName || 'User',
            fromUserImage: currentUserData.profileImage || currentUserData.avatar || null,
            message: `${currentUserData.name || currentUserData.displayName || 'Someone'} unfollowed you`,
            createdAt: new Date().toISOString(),
            read: false,
          };
          
          const notificationsRef = collection(db, 'users', targetUserId, 'notifications');
          const notifDoc = await setDoc(doc(notificationsRef, `${currentUser.uid}_unfollow_${Date.now()}`), notificationData);
          console.log('🔔 Unfollow notification sent to user:', targetUserId);
        } catch (notifError) {
          console.error('❌ Error sending unfollow notification:', notifError);
        }
        
        setFollowingIds((prev) => prev.filter((id) => id !== targetUserId));
      } else {
        // Follow
        await setDoc(followDocRef, {
          userId: targetUserId,
          followedAt: new Date().toISOString(),
        });
        
        // Add to target user's followers
        const followerDocRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
        await setDoc(followerDocRef, {
          userId: currentUser.uid,
          followedAt: new Date().toISOString(),
        });
        
        // Increment counters
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        
        // Send notification
        try {
          const currentUserDoc = await getDoc(currentUserRef);
          const currentUserData = currentUserDoc.data() || {};
          
          const notificationData = {
            type: 'follow',
            fromUserId: currentUser.uid,
            fromUserName: currentUserData.name || currentUserData.displayName || 'User',
            fromUserImage: currentUserData.profileImage || currentUserData.avatar || null,
            message: `${currentUserData.name || currentUserData.displayName || 'Someone'} started following you`,
            createdAt: new Date().toISOString(),
            read: false,
          };
          
          const notificationsRef = collection(db, 'users', targetUserId, 'notifications');
          const notifDoc = await setDoc(doc(notificationsRef, `${currentUser.uid}_follow_${Date.now()}`), notificationData);
          console.log('🔔 Follow notification sent to user:', targetUserId);
        } catch (notifError) {
          console.error('❌ Error sending follow notification:', notifError);
        }
        
        setFollowingIds((prev) => [...prev, targetUserId]);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== targetUserId));
    }
  };

  const renderUser = ({ item }) => {
    const isFollowing = followingIds.includes(item.id);
    const isLoading = loadingIds.includes(item.id);
    const isCurrentUser = item.id === currentUser?.uid;

    return (
      <View style={styles.userCard}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('Profile', { userId: item.id })}
          activeOpacity={0.7}
        >
          {item.profileImage ? (
            <Image
              source={{ uri: item.profileImage }}
              style={styles.userAvatar}
            />
          ) : (
            <View style={[styles.userAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={30} color="#657786" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.name || item.displayName || 'User'}</Text>
            {item.bio && (
              <Text style={styles.userBio} numberOfLines={1}>
                {item.bio}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing && styles.followingButton,
              isLoading && styles.followButtonDisabled,
            ]}
            onPress={() => handleToggleFollow(item.id)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.followButtonText}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {type === 'followers' ? 'Followers' : 'Following'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Users List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#444" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No users found' : type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 13,
    color: '#888',
  },
  followButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
