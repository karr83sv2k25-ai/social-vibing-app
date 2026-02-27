import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  ActionSheetIOS,
  Platform,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, increment, collection, getDocs, query, where, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "./firebaseConfig";
import CacheManager from "./cacheManager";
import StatusBadge from "./components/StatusBadge";
import StatusSelector from "./components/StatusSelector";
import { useStatus } from "./contexts/StatusContext";
import VerifiedBadge from './components/VerifiedBadge';
import ReportUserModal from './components/ReportUserModal';
import { REPORT_TYPES } from './shared/services/reportService';

const { width } = Dimensions.get("window");
const PADDING_H = 18;

/* --------- THEME --------- */
const C = {
  bg: "#0B0B10",
  card: "#14171C",
  card2: "#1A1F27",
  border: "#242A33",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  cyan: "#08FFE2",
  gold: "#FFC93C",
  brand: "#BF2EF0",
  danger: "#FF1010",
};

/* --------- REUSABLES --------- */
const Pill = ({ label }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>{label}</Text>
  </View>
);

const Stat = ({ value, label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ alignItems: "center", width: 68 }} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
    <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{value}</Text>
    <Text style={{ color: C.dim, fontSize: 12 }}>{label}</Text>
  </TouchableOpacity>
);

const ListRow = ({ title, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.row}>
    <Text style={styles.rowTitle}>{title}</Text>
    <Feather name="chevron-right" size={20} color={C.dim} />
  </TouchableOpacity>
);

/* --------- MAIN COMPONENT --------- */
export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
  const [storyModalVisible, setStoryModalVisible] = useState(false);
  const [statusSelectorVisible, setStatusSelectorVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const lastFocusTimeRef = React.useRef(Date.now());

  // Check if updated data was passed from edit profile
  useEffect(() => {
    if (route?.params?.userData) {
      console.log('🎯 Received updated userData from navigation');
      const passedData = route.params.userData;
      setUserData(passedData);
      setFollowingCount(passedData.followingCount || 0);
      setFollowersCount(passedData.followersCount || 0);
      setLoading(false);

      // Cache the updated data immediately for immediate display
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      if (currentUser) {
        CacheManager.saveUserProfile(currentUser.uid, passedData)
          .then(() => console.log('✅ Updated profile cached immediately'))
          .catch(err => console.log('⚠️ Cache save error:', err));
      }

      // Clear the param after a short delay to ensure it's been processed
      setTimeout(() => {
        navigation.setParams({ userData: undefined });
      }, 100);
    }
  }, [route?.params?.userData, route?.params?.refresh]);

  // Only refresh when returning from edit (not on every focus)
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      const timeSinceLastFocus = now - lastFocusTimeRef.current;

      // Only refresh if more than 2 seconds passed (means navigated away and back)
      // This prevents refresh on initial mount
      if (timeSinceLastFocus > 2000) {
        console.log('🔄 Profile screen focused - checking for updates');
        setRefreshKey(prev => prev + 1);
      }

      lastFocusTimeRef.current = now;
    }, [])
  );

  const handleStoryPress = (story) => {
    setViewingStory(story);
    setStoryModalVisible(true);
  };

  const closeStoryModal = () => {
    setStoryModalVisible(false);
    setTimeout(() => setViewingStory(null), 300);
  };

  const getStoryLabel = (dateValue) => {
    if (!(dateValue instanceof Date)) {
      return "Story";
    }

    const now = new Date();
    const diffMs = now.getTime() - dateValue.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / (60 * 60000));

    if (diffMs < 0) {
      return dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (minutes < 60) {
      return `${Math.max(1, minutes)}m ago`;
    }

    if (hours < 24) {
      return `${hours}h ago`;
    }

    return dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    // db is now imported globally

    // Determine which user's profile to show
    const resolvedUserId = userId || (currentUser ? currentUser.uid : null);
    setTargetUserId(resolvedUserId);

    if (!resolvedUserId) {
      setLoading(false);
      setStories([]);
      return;
    }

    // Check if viewing own profile
    const ownProfile = currentUser && resolvedUserId === currentUser.uid;
    setIsOwnProfile(ownProfile);

    // Removed daily rewards check

    const userRef = doc(db, 'users', resolvedUserId);

    // Track if data was loaded successfully and if component is mounted
    let dataLoaded = false;
    let isMounted = true;

    // Load cached profile first for instant UI
    const loadCache = async () => {
      // First check AsyncStorage for pending updates (from edit profile)
      try {
        const pendingUpdate = await AsyncStorage.getItem(`profile_update_${resolvedUserId}`);
        if (pendingUpdate && isMounted) {
          const updatedData = JSON.parse(pendingUpdate);
          console.log('🔄 Using pending profile update from AsyncStorage');
          setUserData(updatedData);
          setFollowingCount(updatedData.followingCount || 0);
          setFollowersCount(updatedData.followersCount || 0);
          setLoading(false);
          dataLoaded = true;

          // Try to sync to Firestore in background
          const userRef = doc(db, 'users', resolvedUserId);
          updateDoc(userRef, updatedData)
            .then(() => {
              if (isMounted) {
                console.log('✅ Synced pending update to Firestore');
                AsyncStorage.removeItem(`profile_update_${resolvedUserId}`);
              }
            })
            .catch(err => console.log('⚠️ Background sync failed:', err));
          return true; // Signal that data was loaded
        }
      } catch (err) {
        console.log('⚠️ Error checking AsyncStorage:', err);
      }

      // If no pending update, use cache
      const cached = await CacheManager.getUserProfile(resolvedUserId);
      if (cached && isMounted) {
        console.log('📦 Using cached profile data');
        setUserData(cached);
        setFollowingCount(cached.followingCount || 0);
        setFollowersCount(cached.followersCount || 0);
        setLoading(false);
        dataLoaded = true;
        return true; // Signal that data was loaded
      }
      return false; // No data found
    };

    // Fallback: Try direct fetch if onSnapshot doesn't work
    const fallbackFetch = setTimeout(async () => {
      if (dataLoaded || !isMounted) {
        console.log('✅ Data already loaded or unmounted, skipping fallback');
        return;
      }

      if (!userData) {
        console.log('⏱️ onSnapshot not responding, trying direct fetch...');

        // First check AsyncStorage for recent updates
        try {
          const asyncData = await AsyncStorage.getItem(`profile_update_${resolvedUserId}`);
          if (asyncData && isMounted) {
            const parsedData = JSON.parse(asyncData);
            console.log('✅ Using AsyncStorage backup in fallback');
            setUserData(parsedData);
            setFollowingCount(parsedData.followingCount || 0);
            setFollowersCount(parsedData.followersCount || 0);
            setLoading(false);
            dataLoaded = true;
            return;
          }
        } catch (e) {
          console.log('⚠️ Error reading AsyncStorage:', e);
        }

        // Try Firestore direct fetch
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && isMounted) {
            const data = userSnap.data();
            console.log('✅ Profile data loaded via direct fetch');
            setUserData(data);
            setFollowingCount(data.followingCount || 0);
            setFollowersCount(data.followersCount || 0);
            await CacheManager.saveUserProfile(resolvedUserId, data);
          } else if (isMounted) {
            console.log('⚠️ No user document found, creating basic profile from auth');
            // Create basic profile from auth user
            const basicProfile = {
              email: currentUser?.email || '',
              firstName: currentUser?.email?.split('@')[0] || 'User',
              lastName: '',
              username: currentUser?.email?.split('@')[0] || 'user',
              profileImage: '',
              bio: '',
              followingCount: 0,
              followersCount: 0,
            };
            setUserData(basicProfile);
          }
        } catch (err) {
          console.error('❌ Direct fetch failed:', err);
          if (isMounted) {
            // Create emergency fallback profile
            const emergencyProfile = {
              email: currentUser?.email || '',
              firstName: currentUser?.email?.split('@')[0] || 'User',
              lastName: '',
              username: currentUser?.email?.split('@')[0] || 'user',
              profileImage: '',
              bio: '',
              followingCount: 0,
              followersCount: 0,
            };
            setUserData(emergencyProfile);
          }
        }
        setLoading(false);
      }
    }, 3000); // Try direct fetch after 3 seconds

    // Start loading cache
    loadCache();

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (dataLoaded || !isMounted) {
        console.log('✅ Data already loaded or unmounted, skipping timeout');
        return;
      }

      if (loading && isMounted) {
        console.log('⏱️ Profile loading timeout - forcing basic profile');
        if (!userData) {
          // Emergency: Create profile from auth even if everything fails
          const emergencyProfile = {
            email: currentUser?.email || '',
            firstName: currentUser?.email?.split('@')[0] || 'User',
            lastName: '',
            username: currentUser?.email?.split('@')[0] || 'user',
            profileImage: '',
            bio: 'Profile loading...',
            followingCount: 0,
            followersCount: 0,
          };
          setUserData(emergencyProfile);
          console.log('✅ Emergency profile created');
        }
        setLoading(false);
      }
    }, 6000); // 6 second timeout

    // Real-time listener for user document
    const unsubscribe = onSnapshot(
      userRef,
      async (snap) => {
        clearTimeout(fallbackFetch); // Cancel fallback if onSnapshot works
        if (snap.exists()) {
          const data = snap.data();
          console.log('✅ Profile data loaded from Firestore');

          // Only update if we don't have fresher data from navigation params
          const hasFreshData = route?.params?.userData;
          if (!hasFreshData) {
            setUserData(data);
            // Cache the profile data
            await CacheManager.saveUserProfile(resolvedUserId, data);
          } else {
            console.log('⏭️ Skipping Firestore update - using fresh navigation data');
          }

          // Use counts from user document if available (much faster)
          setFollowingCount(data.followingCount || 0);
          setFollowersCount(data.followersCount || 0);

          // Only fetch actual counts if not stored in document (fallback)
          if (data.followingCount === undefined) {
            try {
              const followingCol = collection(db, 'users', resolvedUserId, 'following');
              const followingSnapshot = await getDocs(followingCol);
              const count = followingSnapshot.size;
              setFollowingCount(count);

              // Update the document with the count for future use
              await updateDoc(userRef, { followingCount: count });
            } catch (e) {
              console.log('Error fetching following count:', e);
            }
          }

          // Note: Followers count should be managed when users follow/unfollow
          // For now, use stored value or show 0
        } else {
          console.log('No user data found!');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to user document:', error);
        Alert.alert('Error', 'Failed to load user data');
        setLoading(false);
      }
    );

    // Real-time listener for followers count
    const followersRef = collection(db, 'users', resolvedUserId, 'followers');
    const unsubscribeFollowers = onSnapshot(followersRef, (snapshot) => {
      const count = snapshot.size;
      console.log(`👥 Followers count updated: ${count} for user ${resolvedUserId}`);
      setFollowersCount(count);
      // Update user document with latest count
      updateDoc(userRef, { followersCount: count }).catch(() => { });
    }, (error) => {
      console.log('Error listening to followers:', error);
    });

    // Real-time listener for following count
    const followingRef = collection(db, 'users', resolvedUserId, 'following');
    const unsubscribeFollowing = onSnapshot(followingRef, (snapshot) => {
      const count = snapshot.size;
      console.log(`👤 Following count updated: ${count} for user ${resolvedUserId}`);
      setFollowingCount(count);
      // Update user document with latest count
      updateDoc(userRef, { followingCount: count }).catch(() => { });
    }, (error) => {
      console.log('Error listening to following:', error);
    });

    // Check if current user is following this profile
    let unsubscribeIsFollowing = null;
    if (!ownProfile && currentUser) {
      const myFollowingRef = doc(db, 'users', currentUser.uid, 'following', resolvedUserId);
      unsubscribeIsFollowing = onSnapshot(myFollowingRef, (docSnap) => {
        const exists = docSnap.exists();
        console.log(`👁️ Following status check: ${exists ? 'Following' : 'Not following'}`);
        setIsFollowing(exists);
      });
    }

    // Increment visit count only when viewing other user's profile (not own profile)
    if (!ownProfile && currentUser) {
      (async () => {
        try {
          await updateDoc(userRef, { visits: increment(1) });
        } catch (err) {
          // Silently ignore permission errors - visits increment is optional
        }
      })();
    }

    return () => {
      isMounted = false; // Mark component as unmounted
      clearTimeout(loadingTimeout);
      clearTimeout(fallbackFetch);
      unsubscribe();
      unsubscribeFollowers();
      unsubscribeFollowing();
      if (unsubscribeIsFollowing) {
        unsubscribeIsFollowing();
      }
    };
  }, [userId, refreshKey]);

  // Removed daily rewards functionality

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;

    if (!currentUser || !targetUserId || isOwnProfile || followLoading) return;

    setFollowLoading(true);
    console.log(`🔄 Toggling follow for user: ${targetUserId}`);
    console.log(`👤 Current user: ${currentUser.uid}`);
    console.log(`🎯 Target user: ${targetUserId}`);

    try {
      const followDocRef = doc(db, 'users', currentUser.uid, 'following', targetUserId);
      const followerDocRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      const targetUserRef = doc(db, 'users', targetUserId);

      console.log(`📄 Follow doc path: users/${currentUser.uid}/following/${targetUserId}`);
      console.log(`📄 Follower doc path: users/${targetUserId}/followers/${currentUser.uid}`);

      if (isFollowing) {
        // Unfollow
        console.log('❌ Unfollowing user');
        await deleteDoc(followDocRef);
        await deleteDoc(followerDocRef);
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
        await updateDoc(targetUserRef, { followersCount: increment(-1) });

        console.log('✅ Unfollow action completed successfully!');
        console.log(`📋 Updated following count for ${currentUser.uid}`);
        console.log(`📋 Updated followers count for ${targetUserId}`);

        // Send unfollow notification
        try {
          const currentUserDoc = await getDoc(currentUserRef);
          const currentUserData = currentUserDoc.data() || {};
          const notificationsRef = collection(db, 'users', targetUserId, 'notifications');
          await setDoc(doc(notificationsRef, `${currentUser.uid}_unfollow_${Date.now()}`), {
            type: 'unfollow',
            fromUserId: currentUser.uid,
            fromUserName: currentUserData.name || currentUserData.displayName || 'User',
            fromUserImage: currentUserData.profileImage || currentUserData.avatar || null,
            message: `${currentUserData.name || currentUserData.displayName || 'Someone'} unfollowed you`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        } catch (e) {
          console.log('⚠️ Notification error:', e);
        }

        setIsFollowing(false);
      } else {
        // Follow
        console.log('✅ Following user');
        await setDoc(followDocRef, {
          userId: targetUserId,
          followedAt: new Date().toISOString(),
        });
        await setDoc(followerDocRef, {
          userId: currentUser.uid,
          followedAt: new Date().toISOString(),
        });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        await updateDoc(targetUserRef, { followersCount: increment(1) });

        console.log('✅ Follow action completed successfully!');
        console.log(`📋 Updated following count for ${currentUser.uid}`);
        console.log(`📋 Updated followers count for ${targetUserId}`);

        // Send follow notification
        try {
          const currentUserDoc = await getDoc(currentUserRef);
          const currentUserData = currentUserDoc.data() || {};
          const notificationsRef = collection(db, 'users', targetUserId, 'notifications');
          await setDoc(doc(notificationsRef, `${currentUser.uid}_follow_${Date.now()}`), {
            type: 'follow',
            fromUserId: currentUser.uid,
            fromUserName: currentUserData.name || currentUserData.displayName || 'User',
            fromUserImage: currentUserData.profileImage || currentUserData.avatar || null,
            message: `${currentUserData.name || currentUserData.displayName || 'Someone'} started following you`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        } catch (e) {
          console.log('⚠️ Notification error:', e);
        }

        setIsFollowing(true);
      }
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    if (!targetUserId) {
      setStories([]);
      setStoriesLoading(false);
      return;
    }

    setStoriesLoading(true);

    const storiesRef = collection(db, 'stories');
    const storiesQuery = query(storiesRef, where('userId', '==', targetUserId));

    const unsubscribe = onSnapshot(
      storiesQuery,
      (snapshot) => {
        const fetchedStories = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const createdAt = data.createdAt?.toDate?.() || data.createdAt || null;
            const expiresAt = data.expiresAt?.toDate?.() || data.expiresAt || null;

            return {
              id: docSnap.id,
              ...data,
              createdAt,
              expiresAt,
            };
          })
          .sort((a, b) => {
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return bTime - aTime;
          });

        setStories(fetchedStories);
        setStoriesLoading(false);
      },
      (error) => {
        console.error('Error fetching stories:', error);
        setStories([]);
        setStoriesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [targetUserId]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36, paddingTop: 40 }}>
      {/* Back Button - Show at top when viewing other user's profile */}
      {!isOwnProfile && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 50,
            left: 10,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 20,
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      
      {/* More Options Button - Show for other users */}
      {!isOwnProfile && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 50,
            right: 10,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 20,
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  options: ['Cancel', 'Report User', 'Block User'],
                  destructiveButtonIndex: 2,
                  cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                  if (buttonIndex === 1) {
                    setShowReportModal(true);
                  } else if (buttonIndex === 2) {
                    handleBlockUser();
                  }
                }
              );
            } else {
              setShowOptionsMenu(true);
            }
          }}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      {/* ===== PROFILE CARD ===== */}
      <LinearGradient
        colors={["#0EE7B7", "#8A2BE2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileOuter}
      >
        <View style={styles.profileInner}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {userData?.profileImage || userData?.user_picture ? (
              <Image
                source={{ uri: userData.profileImage || userData.user_picture }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={30} color="#657786" />
              </View>
            )}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.name}>{userData?.firstName || userData?.user_firstname || ''} {userData?.lastName || userData?.user_lastname || ''}</Text>
                <VerifiedBadge isVerified={userData?.isVerified} size={16} style={{ marginLeft: 6 }} />
                {/* Gender Icon - Changes based on user's selected gender */}
                {userData?.gender && (
                  <Ionicons
                    name={
                      userData.gender === 'Male' ? 'male' :
                      userData.gender === 'Female' ? 'female' :
                      'male-female'
                    }
                    size={16}
                    color="#08FFE2"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.handle}>
                  {isOwnProfile
                    ? `${userData?.email || userData?.user_email || ''} · ${userData?.phoneNumber || userData?.user_phone ? `Phone: ${userData.phoneNumber || userData?.user_phone}` : 'No phone'}`
                    : `@${userData?.username || userData?.user_name || 'user'}`
                  }
                </Text>
              </View>

              {/* User Status Badge - Single status display */}
              <View style={{ marginTop: 6 }}>
                <StatusBadge
                  userId={isOwnProfile ? null : targetUserId}
                  isOwnStatus={isOwnProfile}
                  onPress={isOwnProfile ? () => setStatusSelectorVisible(true) : null}
                  size="small"
                  showEditIcon={isOwnProfile}
                />
              </View>
            </View>

            {/* Edit Profile Button - Only show for own profile */}
            {isOwnProfile && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate("EditProfile", { userData })}
                >
                  <Feather name="edit-2" size={16} color={C.text} />
                </TouchableOpacity>

                {/* Daily Check-In */}
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: 'rgba(255, 201, 60, 0.15)', borderColor: 'rgba(255, 201, 60, 0.4)' }]}
                  onPress={() => navigation.navigate("DailyReward")}
                >
                  <Ionicons name="calendar-outline" size={16} color={C.gold} />
                </TouchableOpacity>

                {/* Admin Panel Button - Only show for admins */}
                {(userData?.isAdmin || userData?.role === 'admin') && (
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: 'rgba(8, 255, 226, 0.15)' }]}
                    onPress={() => navigation.navigate("AdminModeration")}
                  >
                    <Ionicons name="shield-checkmark" size={16} color="#08FFE2" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {/* Follow Button - Show when viewing other user's profile */}
            {!isOwnProfile && (
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  isFollowing && styles.followingBtn,
                  followLoading && styles.followBtnDisabled
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
                activeOpacity={0.8}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={isFollowing ? "checkmark" : "person-add"}
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.followBtnText}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Tags */}
          <View style={{ flexDirection: "row", marginTop: 12, flexWrap: "wrap" }}>
            <Pill label="#universocraft" />
            <Pill label="#Anime" />
            <Pill label="#Cartoon" />
          </View>

          {/* Stats (real-time from Firestore) */}
          <View style={styles.statsRow}>
            <Stat
              value={followersCount}
              label="Followers"
              onPress={() => navigation.navigate('FollowersFollowing', {
                userId: targetUserId || userId,
                type: 'followers'
              })}
            />
            <Stat
              value={followingCount}
              label="Following"
              onPress={() => navigation.navigate('FollowersFollowing', {
                userId: targetUserId || userId,
                type: 'following'
              })}
            />
            <Stat value={userData?.friends ?? 0} label="Friends" />
            {isOwnProfile && <Stat value={userData?.visits ?? 0} label="Visits" />}
          </View>
        </View>
      </LinearGradient>

      {/* ===== WALLET ===== - Only show for own profile */}
      {isOwnProfile && (
        <>
          <View style={styles.walletCard}>
            <Text style={styles.walletTitle}>Wallet</Text>

            <TouchableOpacity activeOpacity={0.9} style={styles.purchaseBtn}>
              <LinearGradient
                colors={["rgba(162,162,162,0.15)", "rgba(255,251,251,0)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.purchaseBtnInner}
              >
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>Purchase</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.walletRow}>
              <View style={styles.walletChipPlain}>
                <Image source={require("./assets/goldicon.png")} style={styles.walletIconBig} />
                <Text style={styles.walletChipPlainText}>5</Text>
              </View>
              <View style={styles.walletChipPlain}>
                <Image source={require("./assets/diamond1.png")} style={styles.walletIconBig} />
                <Text style={styles.walletChipPlainText}>5</Text>
              </View>
              <View style={styles.walletChipPlain}>
                <Image source={require("./assets/trophy.png")} style={styles.walletIconBig} />
                <Text style={styles.walletChipPlainText}>5</Text>
              </View>
            </View>
          </View>

        </>
      )}

      {/* ===== STORIES ===== */}
      <Text style={styles.sectionTitle}>Stories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PADDING_H }}
      >
        {isOwnProfile && (
          <TouchableOpacity
            style={[styles.story, styles.storyAction]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("CreateStory")}
          >
            <Feather name="plus" size={24} color={C.cyan} />
            <Text style={styles.storyActionText}>Add Story</Text>
          </TouchableOpacity>
        )}

        {storiesLoading ? (
          <View style={[styles.story, styles.storyPlaceholderCard]}>
            <ActivityIndicator color={C.cyan} />
          </View>
        ) : stories.length === 0 ? (
          <View style={[styles.story, styles.storyPlaceholderCard]}>
            <Ionicons name="image-outline" size={26} color={C.dim} />
            <Text style={styles.storyPlaceholderText}>No stories yet</Text>
          </View>
        ) : (
          stories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={styles.story}
              activeOpacity={0.85}
              onPress={() => handleStoryPress(story)}
            >
              {story.image ? (
                <Image source={{ uri: story.image }} style={styles.storyImg} />
              ) : (
                <View style={[styles.storyImg, styles.storyFallback]}>
                  <Ionicons name="image-outline" size={30} color={C.dim} />
                </View>
              )}
              <Text style={styles.storyCaption}>{getStoryLabel(story.createdAt)}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ===== MORE ===== - Only show for own profile */}
      {isOwnProfile && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>More</Text>
          <View style={{ paddingHorizontal: PADDING_H }}>
            <View style={styles.listCard}>
              {/* ✅ Only My Store navigates */}
              <ListRow title="My Store" onPress={() => navigation.navigate("MyStore")} />
              <View style={styles.divider} />
              <ListRow title="Daily Check-In" onPress={() => navigation.navigate("DailyReward")} />
              <View style={styles.divider} />
              <ListRow title="Membership" onPress={() => navigation.navigate("Membership")} />
              <View style={styles.divider} />
              <ListRow title="Help Center" />
              <View style={styles.divider} />
              <ListRow title="Shop" />
              <View style={styles.divider} />
              <ListRow title="Account Setting" />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.logoutBtn}
              onPress={async () => {
                try {
                  const auth = getAuth();

                  // Clear AsyncStorage to prevent auto-login
                  console.log('🗑️ Clearing saved login state from AsyncStorage...');
                  await AsyncStorage.multiRemove(['userLoggedIn', 'userEmail']);

                  // Sign out from Firebase - navigation will happen automatically via onAuthStateChanged
                  console.log('🚪 Signing out...');
                  await signOut(auth);

                  console.log('✅ User logged out successfully');
                  // No need to manually navigate - App.js onAuthStateChanged will handle it
                } catch (error) {
                  console.error('Logout Error:', error);
                  Alert.alert('Error', 'Failed to log out. Please try again.');
                }
              }}
            >
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Story Viewer Modal */}
      <Modal
        visible={storyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeStoryModal}
      >
        <View style={styles.storyModalOverlay}>
          <TouchableOpacity
            style={styles.storyModalClose}
            onPress={closeStoryModal}
            activeOpacity={0.9}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>

          {viewingStory && (
            <View style={styles.storyModalContent}>
              {/* Story Header */}
              <View style={styles.storyModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {userData?.profileImage ? (
                    <Image
                      source={{ uri: userData.profileImage }}
                      style={styles.storyModalAvatar}
                    />
                  ) : (
                    <View style={[styles.storyModalAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="person" size={24} color="#657786" />
                    </View>
                  )}
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.storyModalName}>
                      {userData?.firstName || ''} {userData?.lastName || ''}
                    </Text>
                    <Text style={styles.storyModalTime}>
                      {getStoryLabel(viewingStory.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Story Image */}
              {viewingStory.image ? (
                <Image
                  source={{ uri: viewingStory.image }}
                  style={styles.storyModalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.storyModalImagePlaceholder}>
                  <Ionicons name="image-outline" size={80} color={C.dim} />
                  <Text style={styles.storyModalPlaceholderText}>No image</Text>
                </View>
              )}

              {/* Story Caption if exists */}
              {viewingStory.caption && (
                <View style={styles.storyModalCaptionContainer}>
                  <Text style={styles.storyModalCaption}>{viewingStory.caption}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Status Selector Modal */}
      <StatusSelector
        visible={statusSelectorVisible}
        onClose={() => setStatusSelectorVisible(false)}
        title="Update Your Status"
      />

      {/* Report User Modal */}
      {!isOwnProfile && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUser={{
            id: targetUserId,
            username: userData?.username || userData?.handle,
            name: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
          }}
          reportType={REPORT_TYPES.USER}
        />
      )}

      {/* Android Options Menu */}
      {Platform.OS === 'android' && (
        <Modal
          visible={showOptionsMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOptionsMenu(false)}
        >
          <TouchableOpacity 
            style={styles.optionsOverlay}
            activeOpacity={1}
            onPress={() => setShowOptionsMenu(false)}
          >
            <View style={styles.optionsMenu}>
              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  setShowOptionsMenu(false);
                  setShowReportModal(true);
                }}
              >
                <Ionicons name="flag-outline" size={22} color="#F59E0B" />
                <Text style={styles.optionsItemText}>Report User</Text>
              </TouchableOpacity>
              
              <View style={styles.optionsDivider} />
              
              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  setShowOptionsMenu(false);
                  handleBlockUser();
                }}
              >
                <Ionicons name="ban-outline" size={22} color="#EF4444" />
                <Text style={[styles.optionsItemText, { color: '#EF4444' }]}>Block User</Text>
              </TouchableOpacity>
              
              <View style={styles.optionsDivider} />
              
              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => setShowOptionsMenu(false)}
              >
                <Ionicons name="close-outline" size={22} color={C.dim} />
                <Text style={[styles.optionsItemText, { color: C.dim }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </ScrollView>
  );

  // Block user function
  async function handleBlockUser() {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    
    if (!currentUser || !targetUserId) {
      Alert.alert('Error', 'Unable to block user');
      return;
    }
    
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userData?.firstName || 'this user'}? They won't be able to message or follow you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const blockRef = doc(db, 'users', currentUser.uid, 'blocked', targetUserId);
              await setDoc(blockRef, {
                blockedAt: serverTimestamp(),
                reason: null,
              });
              
              Alert.alert('Blocked', `${userData?.firstName || 'User'} has been blocked`);
              navigation.goBack();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          }
        }
      ]
    );
  }
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  profileOuter: { marginTop: 18, marginHorizontal: PADDING_H, borderRadius: 18, padding: 2 },
  profileInner: { backgroundColor: C.card, borderRadius: 16, padding: 14 },
  avatar: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.border },
  name: { color: C.text, fontSize: 16, fontWeight: "800" },
  handle: { color: C.dim, fontSize: 12, marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.brand,
    borderWidth: 1,
    borderColor: C.brand,
  },
  followingBtn: {
    backgroundColor: 'rgba(191,46,240,0.2)',
    borderColor: C.brand,
  },
  followBtnDisabled: {
    opacity: 0.6,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: C.text },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: C.border,
    marginTop: 14,
    paddingTop: 14,
  },
  walletCard: {
    marginTop: 16,
    marginHorizontal: PADDING_H,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  walletTitle: { color: C.text, fontWeight: "700", fontSize: 15 },
  purchaseBtn: { position: "absolute", right: 14, top: 14, borderRadius: 10, overflow: "hidden" },
  purchaseBtnInner: { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  walletRow: {
    flexDirection: "row",
    marginTop: 14,
    justifyContent: "space-between",
    gap: 10,
  },
  walletChipPlain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  walletIconBig: { width: 22, height: 22, resizeMode: "contain" },
  walletChipPlainText: { color: C.text, fontWeight: "800", fontSize: 14 },
  sectionTitle: {
    color: C.text,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: PADDING_H,
  },
  story: {
    width: width * 0.34,
    height: width * 0.42,
    borderRadius: 16,
    backgroundColor: C.card,
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  storyImg: { width: "100%", height: "100%" },
  storyCaption: {
    position: "absolute",
    bottom: 8,
    left: 10,
    color: C.text,
    fontWeight: "700",
  },
  storyAction: {
    justifyContent: "center",
    alignItems: "center",
  },
  storyActionText: {
    color: C.cyan,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  storyPlaceholderCard: {
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  storyPlaceholderText: {
    color: C.dim,
    fontSize: 12,
  },
  storyFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  listCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 4,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 12 },
  logoutBtn: {
    marginTop: 14,
    backgroundColor: "#000",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.danger,
    alignItems: "center",
    paddingVertical: 12,
  },
  logoutText: { color: C.text, fontWeight: "800", fontSize: 14 },
  storyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  storyModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyModalHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 80,
    zIndex: 5,
  },
  storyModalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.cyan,
  },
  storyModalName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  storyModalTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  storyModalImage: {
    width: width,
    height: width * 1.5,
    maxHeight: '80%',
  },
  storyModalImagePlaceholder: {
    width: width * 0.8,
    height: width * 1.2,
    backgroundColor: C.card,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyModalPlaceholderText: {
    color: C.dim,
    fontSize: 16,
    marginTop: 12,
  },
  storyModalCaptionContainer: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 12,
  },
  storyModalCaption: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  // Options menu styles
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  optionsMenu: {
    backgroundColor: C.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 300,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  optionsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  optionsItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  optionsDivider: {
    height: 1,
    backgroundColor: C.border,
  },
});

