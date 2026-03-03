import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { app, db } from './firebaseConfig';

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState([]);
  const [followLoading, setFollowLoading] = useState([]);
  const auth = getAuth(app);
  const currentUser = auth.currentUser;

  // Fetch user's following list
  useEffect(() => {
    if (!currentUser) return;

    const followingRef = collection(db, 'users', currentUser.uid, 'following');
    const unsubscribe = onSnapshot(
      followingRef,
      (snapshot) => {
        const ids = snapshot.docs.map((doc) => doc.id);
        setFollowingIds(ids);
      },
      (error) => {
        console.log('Error fetching following list:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Fetch notifications
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Query notifications from user's subcollection
    const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');

    const unsubscribe = onSnapshot(
      notificationsRef,
      (snapshot) => {
        console.log(`🔔 Notifications snapshot received: ${snapshot.size} notifications`);
        
        const fetchedNotifications = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Handle both ISO string and Firestore timestamp
          let createdAt = new Date();
          if (data.createdAt) {
            if (typeof data.createdAt === 'string') {
              createdAt = new Date(data.createdAt);
            } else if (data.createdAt.toDate) {
              createdAt = data.createdAt.toDate();
            }
          }
          
          return {
            id: doc.id,
            ...data,
            createdAt,
          };
        });
        
        // Sort by createdAt descending (newest first) on client side
        const sortedNotifications = fetchedNotifications.sort((a, b) => {
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        console.log(`✅ Loaded and sorted ${sortedNotifications.length} notifications`);
        setNotifications(sortedNotifications);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error fetching notifications:', error);
        console.error('Error details:', error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleFollow = async (userId) => {
    if (!currentUser || !userId) return;
    if (followLoading.includes(userId)) return;

    setFollowLoading((prev) => [...prev, userId]);

    try {
      const isFollowing = followingIds.includes(userId);
      const followDocRef = doc(db, 'users', currentUser.uid, 'following', userId);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      const targetUserRef = doc(db, 'users', userId);

      if (isFollowing) {
        // Unfollow
        await deleteDoc(followDocRef);
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
      } else {
        // Follow
        await setDoc(followDocRef, {
          userId: userId,
          followedAt: serverTimestamp(),
        });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Unable to update follow status');
    } finally {
      setFollowLoading((prev) => prev.filter((id) => id !== userId));
    }
  };

  const groupNotificationsByTime = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayNotifs = [];
    const yesterdayNotifs = [];
    const lastWeekNotifs = [];

    notifications.forEach((notif) => {
      const notifDate = new Date(notif.createdAt);
      if (notifDate >= today) {
        todayNotifs.push(notif);
      } else if (notifDate >= yesterday) {
        yesterdayNotifs.push(notif);
      } else if (notifDate >= lastWeek) {
        lastWeekNotifs.push(notif);
      }
    });

    return { todayNotifs, yesterdayNotifs, lastWeekNotifs };
  };

  const { todayNotifs, yesterdayNotifs, lastWeekNotifs } = groupNotificationsByTime();
  const renderNotification = ({ item }) => {
    // Support both old (senderId) and new (fromUserId) field names
    const userId = item.fromUserId || item.senderId;
    const userName = item.fromUserName || item.senderName;
    const userImage = item.fromUserImage || item.senderImage;
    
    const isFollowing = followingIds.includes(userId);
    const isFollowBusy = followLoading.includes(userId);

    const getActionText = () => {
      switch (item.type) {
        case 'follow':
          return 'started following you';
        case 'unfollow':
          return 'unfollowed you';
        case 'like':
          return 'liked your post';
        case 'comment':
          return 'commented on your post';
        case 'mention':
          return 'mentioned you';
        case 'moderation_action':
          return item.message || 'An action has been taken on your account';
        case 'warning':
          return item.message || 'You have received a warning from moderation';
        case 'content_removed':
          return item.message || 'Your content has been removed for violating guidelines';
        case 'ban':
          return item.message || 'Your account has been restricted';
        case 'suspension':
          return item.message || 'Your account has been suspended';
        case 'unban':
          return item.message || 'Your account restriction has been lifted';
        default:
          return item.message || item.action || 'interacted with your content';
      }
    };

    if (item.type === 'follow' || item.type === 'unfollow') {
      return (
        <TouchableOpacity 
          style={styles.notificationItem}
          onPress={() => navigation.navigate('Profile', { userId })}
          activeOpacity={0.8}
        >
          <Image
            source={
              userImage
                ? { uri: userImage }
                : require('./assets/profile.png')
            }
            style={styles.profileImage}
          />
          <View style={styles.textContainer}>
            <Text style={styles.notificationText}>
              <Text style={styles.userName}>{userName || 'User'} </Text>
              {getActionText()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleFollow(userId);
            }}
            disabled={isFollowBusy}
          >
            <LinearGradient
              colors={
                isFollowing
                  ? ['rgba(191,46,240,0.25)', 'rgba(191,46,240,0)']
                  : ['rgba(162,162,162,0.25)', 'rgba(255,251,251,0)']
              }
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.followButton}
            >
              {isFollowBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.followButtonText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.notificationItem}
        onPress={() => navigation.navigate('Profile', { userId })}
        activeOpacity={0.8}
      >
        <Image
          source={
            userImage
              ? { uri: userImage }
              : require('./assets/profile.png')
          }
          style={styles.profileImage}
        />
        <View style={styles.textContainer}>
          <Text style={styles.notificationText}>
            <Text style={styles.userName}>{userName || 'User'} </Text>
            {getActionText()}
          </Text>
        </View>
        {item.postImage && (
          <Image source={{ uri: item.postImage }} style={styles.postImage} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#08FFE2" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Notification</Text>
        <View style={{ width: 28 }} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll see notifications here when people interact with your content
          </Text>
        </View>
      ) : (
        <>
          {/* Today Section */}
          {todayNotifs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Today</Text>
              <FlatList
                data={todayNotifs}
                keyExtractor={(item) => `today-${item.id}`}
                renderItem={renderNotification}
                scrollEnabled={false}
              />
            </>
          )}

          {/* Yesterday Section */}
          {yesterdayNotifs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Yesterday</Text>
              <FlatList
                data={yesterdayNotifs}
                keyExtractor={(item) => `yesterday-${item.id}`}
                renderItem={renderNotification}
                scrollEnabled={false}
              />
            </>
          )}

          {/* Last Week Section */}
          {lastWeekNotifs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Last Week</Text>
              <FlatList
                data={lastWeekNotifs}
                keyExtractor={(item) => `lastweek-${item.id}`}
                renderItem={renderNotification}
                scrollEnabled={false}
              />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  heading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#08FFE2',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    marginTop: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
  },
  userName: {
    fontWeight: 'bold',
    color: '#fff',
  },
  postImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  followButton: {
    width: 68,
    height: 26,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

