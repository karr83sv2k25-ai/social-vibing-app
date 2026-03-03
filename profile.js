import React, { useState, useEffect, useCallback } from "react";
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
  StatusBar,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, increment, collection, getDocs, query, where, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import * as ImagePicker from 'expo-image-picker';
import { app, db } from "./firebaseConfig";
import { uploadImageToHostinger } from './hostingerConfig';
import CacheManager from "./cacheManager";
import StatusBadge from "./components/StatusBadge";
import StatusSelector from "./components/StatusSelector";
import VerifiedBadge from './components/VerifiedBadge';
import ReportUserModal from './components/ReportUserModal';
import { getDisplayName, getUserHandle } from './utils/userNameHelpers';
import { ProfileSkeleton } from './components/SkeletonLoaders';
import { REPORT_TYPES } from './shared/services/reportService';
import { useWallet } from './context/WalletContext';

const { width, height } = Dimensions.get("window");
const PADDING_H = 18;
const COVER_H = 210;
const AVATAR_SIZE = 88;

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
const TagPill = ({ label }) => (
  <View style={styles.tagPill}>
    <Text style={styles.tagPillText}>{label.startsWith('#') ? label : `#${label}`}</Text>
  </View>
);

const Stat = ({ value, label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.statBox} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const SectionHeader = ({ title, onAdd }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onAdd && (
      <TouchableOpacity onPress={onAdd} style={styles.sectionAddBtn}>
        <Ionicons name="add" size={22} color={C.text} />
      </TouchableOpacity>
    )}
  </View>
);

const ListRow = ({ title, onPress, icon, iconColor }) => (
  <TouchableOpacity onPress={onPress} style={styles.row} disabled={!onPress}>
    <Text style={styles.rowTitle}>{title}</Text>
    {onPress
      ? <Feather name="chevron-right" size={20} color={C.dim} />
      : <Text style={{ color: C.dim, fontSize: 12 }}>Coming soon</Text>
    }
  </TouchableOpacity>
);

/* --------- MAIN COMPONENT --------- */
export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const { wallet: walletData, fetchWallet } = useWallet();
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
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
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
        // Refresh wallet data when returning to profile
        fetchWallet();
      }

      lastFocusTimeRef.current = now;
    }, [])
  );

  // ——— Fetch communities the user has joined ———
  const fetchJoinedCommunities = useCallback(async (uid) => {
    if (!uid) return;
    setCommunityLoading(true);
    try {
      const membershipsQuery = query(
        collection(db, 'communities_members'),
        where('user_id', '==', uid)
      );
      const membershipsSnapshot = await getDocs(membershipsQuery);
      const communityIds = membershipsSnapshot.docs.map(d => d.data().community_id);

      if (communityIds.length === 0) {
        setJoinedCommunities([]);
        return;
      }

      const communitiesData = [];
      for (const cid of communityIds) {
        const communityDoc = await getDoc(doc(db, 'communities', cid));
        if (communityDoc.exists()) {
          const data = communityDoc.data();
          communitiesData.push({
            id: cid,
            name: data.name || data.community_title || data.title || 'Community',
            img: data.profileImage || data.img || data.image || data.community_image || data.cover_image || data.coverImage || null,
            members_count: data.members_count || data.memberCount || (Array.isArray(data.members) ? data.members.length : 0),
            category: data.category || '',
            tags: data.tags || [],
          });
        }
      }
      setJoinedCommunities(communitiesData);
    } catch (e) {
      console.warn('⚠️ Communities fetch failed:', e.message);
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  // ——— Upload cover image ———
  const handleCoverUpload = async () => {
    if (!isOwnProfile) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to change your cover photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 7],
        quality: 0.8,
      });
      if (result.canceled) return;

      setCoverUploading(true);
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      const uri = result.assets[0].uri;
      const url = await uploadImageToHostinger(uri, 'cover_images');
      if (url) {
        await updateDoc(doc(db, 'users', currentUser.uid), { coverImage: url });
        setUserData(prev => ({ ...prev, coverImage: url }));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to upload cover photo.');
    } finally {
      setCoverUploading(false);
    }
  };

  // ——— Upload avatar image ———
  const handleAvatarUpload = async () => {
    if (!isOwnProfile) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to change your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;

      setAvatarUploading(true);
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      const uri = result.assets[0].uri;
      const url = await uploadImageToHostinger(uri, 'profile_images');
      if (url) {
        await updateDoc(doc(db, 'users', currentUser.uid), { profileImage: url });
        setUserData(prev => ({ ...prev, profileImage: url }));
        await CacheManager.saveUserProfile(currentUser.uid, { ...(userData || {}), profileImage: url });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to upload profile photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

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
            fromUserName: getDisplayName(currentUserData),
            fromUserImage: currentUserData.profileImage || currentUserData.avatar || null,
            message: `${getDisplayName(currentUserData, 'Someone')} unfollowed you`,
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
            fromUserName: getDisplayName(currentUserData),
            fromUserImage: currentUserData.profileImage || currentUserData.avatar || null,
            message: `${getDisplayName(currentUserData, 'Someone')} started following you`,
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
          .filter(docSnap => {
            const d = docSnap.data();
            return !d.isRemoved && !d.isDeleted;
          })
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

  // ——— fetch communities on data load ———
  useEffect(() => {
    if (targetUserId) fetchJoinedCommunities(targetUserId);
  }, [targetUserId, fetchJoinedCommunities]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: 40 }]}>
        <ProfileSkeleton />
      </View>
    );
  }

  const displayName = getDisplayName(userData);
  const username = getUserHandle(userData);
  const joinedDate = userData?.createdAt
    ? new Date(userData.createdAt?.toDate?.() || userData.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const userTags = userData?.tags || [];
  const genderIcon = userData?.gender === 'Male' ? 'male' : userData?.gender === 'Female' ? 'female' : userData?.gender ? 'male-female' : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== COVER PHOTO ===== */}
        <View style={styles.coverContainer}>
          {userData?.coverImage ? (
            <Image source={{ uri: userData.coverImage }} style={styles.coverImage} />
          ) : (
            <LinearGradient
              colors={['#1a1a2e', '#16213e', '#0f3460']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coverImage}
            />
          )}

          {/* Dark overlay for readability */}
          <View style={styles.coverOverlay} />

          {/* Back button for other profiles */}
          {!isOwnProfile && (
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {/* More options (other profile) */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  ActionSheetIOS.showActionSheetWithOptions(
                    { options: ['Cancel', 'Report User', 'Block User'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
                    (idx) => { if (idx === 1) setShowReportModal(true); else if (idx === 2) handleBlockUser(); }
                  );
                } else {
                  setShowOptionsMenu(true);
                }
              }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Cover camera icon bottom-right (own) */}
          {isOwnProfile && (
            <TouchableOpacity style={styles.coverCameraBottomRight} onPress={handleCoverUpload} disabled={coverUploading}>
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* ===== AVATAR ROW ===== */}
        <View style={styles.avatarRow}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={isOwnProfile ? handleAvatarUpload : undefined}
            disabled={!isOwnProfile || avatarUploading}
            activeOpacity={isOwnProfile ? 0.8 : 1}
          >
            {/* Cyan ring */}
            <LinearGradient
              colors={[C.cyan, C.brand]}
              style={styles.avatarRing}
            >
              {userData?.profileImage || userData?.user_picture ? (
                <Image
                  source={{ uri: userData.profileImage || userData.user_picture }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={38} color={C.dim} />
                </View>
              )}
            </LinearGradient>
            {avatarUploading && (
              <View style={styles.avatarUploadOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {isOwnProfile && !avatarUploading && (
              <View style={styles.avatarCameraChip}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ===== IDENTITY ===== */}
        <View style={styles.identitySection}>
          {/* Name + verified + gender */}
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{displayName}</Text>
            <VerifiedBadge isVerified={userData?.isVerified} size={18} style={{ marginLeft: 6 }} />
            {genderIcon && (
              <Ionicons name={genderIcon} size={16} color={C.cyan} style={{ marginLeft: 6 }} />
            )}
            {isOwnProfile && (
              <TouchableOpacity onPress={() => navigation.navigate('EditProfile', { userData })} style={{ marginLeft: 8 }}>
                <Feather name="edit-2" size={14} color={C.dim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Verify Account button (own profile, unverified) */}
          {isOwnProfile && !userData?.isVerified && (
            <TouchableOpacity style={styles.verifyBtn} onPress={() => navigation.navigate('AccountSettings')}>
              <Ionicons name="shield-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.verifyBtnText}>Verify Account</Text>
            </TouchableOpacity>
          )}

          {/* @username and joined date */}
          <Text style={styles.usernameText}>{username}</Text>
          {joinedDate && <Text style={styles.joinedText}>Joined {joinedDate}</Text>}

          {/* Status badge */}
          <View style={{ marginTop: 10 }}>
            <StatusBadge
              userId={isOwnProfile ? null : targetUserId}
              isOwnStatus={isOwnProfile}
              onPress={isOwnProfile ? () => setStatusSelectorVisible(true) : null}
              size="small"
              showEditIcon={isOwnProfile}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat
              value={followersCount}
              label="Followers"
              onPress={() => navigation.navigate('FollowersFollowing', { userId: targetUserId, type: 'followers' })}
            />
            <View style={styles.statsDivider} />
            <Stat
              value={followingCount}
              label="Following"
              onPress={() => navigation.navigate('FollowersFollowing', { userId: targetUserId, type: 'following' })}
            />
            <View style={styles.statsDivider} />
            <Stat value={userData?.friends ?? 0} label="Friends" />
            {isOwnProfile && (
              <>
                <View style={styles.statsDivider} />
                <Stat value={userData?.visits ?? 0} label="Visits" />
              </>
            )}
          </View>

          {/* Action buttons row for other profile */}
          {!isOwnProfile && (
            <View style={styles.actionBtnsRow}>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn, followLoading && { opacity: 0.6 }]}
                onPress={handleFollowToggle}
                disabled={followLoading}
                activeOpacity={0.8}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name={isFollowing ? 'checkmark' : 'person-add'} size={15} color="#fff" />
                    <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageBtn} onPress={() => navigation.navigate('Chat', { userId: targetUserId })}>
                <Ionicons name="chatbubble-outline" size={15} color={C.text} />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Own profile quick-action row */}
          {isOwnProfile && (
            <View style={styles.actionBtnsRow}>
              <TouchableOpacity style={styles.editProfileBtn} onPress={() => navigation.navigate('EditProfile', { userData })}>
                <Feather name="edit-2" size={14} color={C.text} />
                <Text style={styles.editProfileBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkinBtn}
                onPress={() => navigation.navigate('DailyReward')}
              >
                <Ionicons name="calendar-outline" size={14} color={C.gold} />
                <Text style={[styles.editProfileBtnText, { color: C.gold }]}>Check-in</Text>
              </TouchableOpacity>
              {(userData?.isAdmin || userData?.role === 'admin') && (
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={() => navigation.navigate('AdminModeration')}
                >
                  <Ionicons name="shield-checkmark" size={14} color={C.cyan} />
                  <Text style={[styles.editProfileBtnText, { color: C.cyan }]}>Admin</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ===== WALLET (own profile) ===== */}
        {isOwnProfile && (
          <View style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <Text style={styles.walletTitle}>Wallet</Text>
              <TouchableOpacity style={styles.purchaseChip} onPress={() => navigation.navigate('CoinPurchase')}>
                <Text style={styles.purchaseChipText}>+ Purchase</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.walletRow}>
              <TouchableOpacity style={styles.walletChip} onPress={() => navigation.navigate('CoinPurchase')}>
                <Image source={require('./assets/goldicon.png')} style={styles.walletIcon} />
                <Text style={styles.walletChipText}>{walletData?.coins ?? 0}</Text>
                <Text style={styles.walletChipLabel}>Coins</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.walletChip} onPress={() => navigation.navigate('DiamondPurchase')}>
                <Image source={require('./assets/diamond1.png')} style={styles.walletIcon} />
                <Text style={styles.walletChipText}>{walletData?.diamonds ?? 0}</Text>
                <Text style={styles.walletChipLabel}>Diamonds</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.walletChip} onPress={() => navigation.navigate('Reward')}>
                <Image source={require('./assets/trophy.png')} style={styles.walletIcon} />
                <Text style={styles.walletChipText}>{walletData?.earningsBalance ?? 0}</Text>
                <Text style={styles.walletChipLabel}>Earnings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== ALL ABOUT ME ===== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>All About Me</Text>

          {/* Bio */}
          <View style={styles.aboutRow}>
            <View style={styles.aboutLabelRow}>
              <Text style={styles.aboutLabel}>Bio</Text>
              {isOwnProfile && (
                <TouchableOpacity onPress={() => navigation.navigate('EditProfile', { userData, focusBio: true })}>
                  <Feather name="edit-2" size={14} color={C.dim} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.aboutValue, !userData?.bio && styles.aboutPlaceholder]}>
              {userData?.bio || 'Tap to add bio...'}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          {/* Gender */}
          <View style={styles.aboutRow}>
            <View style={styles.aboutLabelRow}>
              <Text style={styles.aboutLabel}>Gender</Text>
              {isOwnProfile && (
                <TouchableOpacity onPress={() => navigation.navigate('EditProfile', { userData })}>
                  <Feather name="edit-2" size={14} color={C.dim} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.aboutValue, !userData?.gender && styles.aboutPlaceholder]}>
              {userData?.gender || 'Not specified'}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          {/* Tags */}
          <View style={styles.aboutRow}>
            <View style={styles.aboutLabelRow}>
              <Text style={styles.aboutLabel}>Interests</Text>
            </View>
            <View style={styles.tagsRow}>
              {userTags.length > 0
                ? userTags.map((tag, i) => <TagPill key={i} label={tag} />)
                : <Text style={styles.aboutPlaceholder}>No tags added</Text>
              }
              {isOwnProfile && (
                <TouchableOpacity
                  style={styles.addTagBtn}
                  onPress={() => navigation.navigate('EditProfile', { userData, focusTags: true })}
                >
                  <Ionicons name="add" size={14} color={C.brand} />
                  <Text style={styles.addTagBtnText}>Add Tag</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ===== COMMUNITY JOINED ===== */}
        <View style={[styles.card, { paddingBottom: 0 }]}>
          <SectionHeader
            title={`Community Joined (${joinedCommunities.length})`}
            onAdd={isOwnProfile ? () => navigation.navigate('Community') : undefined}
          />
          {communityLoading ? (
            <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={C.cyan} />
            </View>
          ) : joinedCommunities.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color={C.dim} />
              <Text style={styles.emptyStateText}>No communities joined yet</Text>
              {isOwnProfile && (
                <TouchableOpacity onPress={() => navigation.navigate('Community')}>
                  <Text style={[styles.emptyStateText, { color: C.brand, marginTop: 4 }]}>Browse Communities</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PADDING_H, paddingBottom: 16, gap: 12 }}
            >
              {joinedCommunities.map((community) => (
                <TouchableOpacity
                  key={community.id}
                  style={styles.communityCard}
                  onPress={() => navigation.navigate('CommunityDetail', { communityId: community.id })}
                  activeOpacity={0.85}
                >
                  {community.img ? (
                    <Image source={{ uri: community.img }} style={styles.communityImg} />
                  ) : (
                    <View style={[styles.communityImg, styles.communityFallback]}>
                      <Ionicons name="people" size={28} color={C.dim} />
                    </View>
                  )}
                  <View style={styles.communityCardOverlay} />
                  <View style={styles.communityCardInfo}>
                    <Text style={styles.communityCardName} numberOfLines={1}>{community.name}</Text>
                    <Text style={styles.communityCardMembers}>
                      {community.members_count ?? 0} {community.members_count === 1 ? 'Member' : 'Members'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ===== STORIES ===== */}
        <View style={[styles.card, { paddingBottom: 0 }]}>
          <SectionHeader
            title={`Stories (${stories.length})`}
            onAdd={isOwnProfile ? () => navigation.navigate('CreateStory') : undefined}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PADDING_H, paddingBottom: 16, gap: 12 }}
          >
            {storiesLoading ? (
              <View style={styles.storyPlaceholderCard}>
                <ActivityIndicator color={C.cyan} />
              </View>
            ) : stories.length === 0 ? (
              <View style={styles.storyPlaceholderCard}>
                <Ionicons name="image-outline" size={26} color={C.dim} />
                <Text style={styles.storyPlaceholderText}>No stories yet</Text>
              </View>
            ) : (
              stories.map((story) => (
                <TouchableOpacity
                  key={story.id}
                  style={styles.storyCard}
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
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.storyGradient}
                  />
                  <Text style={styles.storyCaption}>{getStoryLabel(story.createdAt)}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* ===== MORE (own profile) ===== */}
        {isOwnProfile && (
          <View style={{ paddingHorizontal: PADDING_H, marginTop: 8 }}>
            <Text style={styles.moreSectionTitle}>More</Text>
            <View style={styles.listCard}>
              <ListRow title="My Store" onPress={() => navigation.navigate('MyStore')} />
              <View style={styles.divider} />
              <ListRow title="Daily Check-In" onPress={() => navigation.navigate('DailyReward')} />
              <View style={styles.divider} />
              <ListRow title="Membership" onPress={() => navigation.navigate('Membership')} />
              <View style={styles.divider} />
              <ListRow title="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
              <View style={styles.divider} />
              <ListRow title="Account Settings" onPress={() => navigation.navigate('AccountSettings')} />
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              activeOpacity={0.85}
              onPress={async () => {
                try {
                  await AsyncStorage.multiRemove(['userLoggedIn', 'userEmail']);
                  await signOut(getAuth(app));
                } catch (e) {
                  Alert.alert('Error', 'Failed to log out. Please try again.');
                }
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={C.danger} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ===== STORY VIEWER MODAL ===== */}
      <Modal visible={storyModalVisible} transparent animationType="fade" onRequestClose={closeStoryModal}>
        <View style={styles.storyModalOverlay}>
          <TouchableOpacity style={styles.storyModalClose} onPress={closeStoryModal}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          {viewingStory && (
            <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <View style={styles.storyModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {userData?.profileImage
                    ? <Image source={{ uri: userData.profileImage }} style={styles.storyModalAvatar} />
                    : <View style={[styles.storyModalAvatar, { backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={20} color={C.dim} /></View>
                  }
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{displayName}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{getStoryLabel(viewingStory.createdAt)}</Text>
                  </View>
                </View>
              </View>
              {viewingStory.image
                ? <Image source={{ uri: viewingStory.image }} style={styles.storyModalImage} resizeMode="contain" />
                : <View style={styles.storyModalImagePlaceholder}><Ionicons name="image-outline" size={80} color={C.dim} /></View>
              }
              {viewingStory.caption && (
                <View style={styles.storyModalCaptionBox}>
                  <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>{viewingStory.caption}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Status Selector */}
      <StatusSelector visible={statusSelectorVisible} onClose={() => setStatusSelectorVisible(false)} title="Update Your Status" />

      {/* Report Modal */}
      {!isOwnProfile && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUser={{
            id: targetUserId,
            username: userData?.username || userData?.handle,
            name: displayName,
          }}
          reportType={REPORT_TYPES.USER}
        />
      )}

      {/* Android Options Menu */}
      {Platform.OS === 'android' && (
        <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
          <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptionsMenu(false)}>
            <View style={styles.optionsMenu}>
              <TouchableOpacity style={styles.optionsItem} onPress={() => { setShowOptionsMenu(false); setShowReportModal(true); }}>
                <Ionicons name="flag-outline" size={22} color="#F59E0B" />
                <Text style={styles.optionsItemText}>Report User</Text>
              </TouchableOpacity>
              <View style={styles.optionsDivider} />
              <TouchableOpacity style={styles.optionsItem} onPress={() => { setShowOptionsMenu(false); handleBlockUser(); }}>
                <Ionicons name="ban-outline" size={22} color="#EF4444" />
                <Text style={[styles.optionsItemText, { color: '#EF4444' }]}>Block User</Text>
              </TouchableOpacity>
              <View style={styles.optionsDivider} />
              <TouchableOpacity style={styles.optionsItem} onPress={() => setShowOptionsMenu(false)}>
                <Ionicons name="close-outline" size={22} color={C.dim} />
                <Text style={[styles.optionsItemText, { color: C.dim }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );

  // Block user function
  async function handleBlockUser() {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    if (!currentUser || !targetUserId) { Alert.alert('Error', 'Unable to block user'); return; }
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userData?.firstName || 'this user'}? They won't be able to message or follow you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            try {
              await setDoc(doc(db, 'users', currentUser.uid, 'blocked', targetUserId), { blockedAt: serverTimestamp(), reason: null });
              Alert.alert('Blocked', `${userData?.firstName || 'User'} has been blocked`);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          }
        }
      ]
    );
  }
}

/* ============================================================
   STYLES
   ============================================================ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  /* Cover */
  coverContainer: { width, height: COVER_H, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  backBtn: {
    position: 'absolute', top: 50, left: 14, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  coverCameraBtn: {
    position: 'absolute', top: 50, left: 14, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  moreBtn: {
    position: 'absolute', top: 50, right: 14, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  viewStoreBtn: {
    position: 'absolute', bottom: 14, right: 14, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  viewStoreBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  coverCameraBottomRight: {
    position: 'absolute', bottom: 14, right: 14, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
  },

  /* Avatar */
  avatarRow: { alignItems: 'center', marginTop: -(AVATAR_SIZE / 2) - 4, zIndex: 5 },
  avatarWrapper: { position: 'relative' },
  avatarRing: {
    width: AVATAR_SIZE + 6, height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    padding: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: { backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' },
  avatarUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: (AVATAR_SIZE + 6) / 2,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarCameraChip: {
    position: 'absolute', bottom: 2, right: 2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.brand,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: C.bg,
  },

  /* Identity */
  identitySection: { alignItems: 'center', paddingHorizontal: PADDING_H, paddingTop: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  displayName: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.brand,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24, marginTop: 10,
  },
  verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  usernameText: { color: C.dim, fontSize: 14, marginTop: 6 },
  joinedText: { color: C.dim, fontSize: 12, marginTop: 2 },

  /* Stats */
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 18, paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border,
    width: '100%',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: C.text, fontWeight: '800', fontSize: 18 },
  statLabel: { color: C.dim, fontSize: 12, marginTop: 2 },
  statsDivider: { width: 1, height: 32, backgroundColor: C.border },

  /* Action buttons */
  actionBtnsRow: {
    flexDirection: 'row', gap: 10, marginTop: 14, width: '100%', justifyContent: 'center',
  },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24,
    backgroundColor: C.brand,
  },
  followingBtn: { backgroundColor: 'rgba(191,46,240,0.2)', borderWidth: 1, borderColor: C.brand },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
  },
  messageBtnText: { color: C.text, fontWeight: '600', fontSize: 14 },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 24,
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
  },
  editProfileBtnText: { color: C.text, fontWeight: '600', fontSize: 13 },
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    backgroundColor: 'rgba(255,201,60,0.12)', borderWidth: 1, borderColor: 'rgba(255,201,60,0.4)',
  },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    backgroundColor: 'rgba(8,255,226,0.1)', borderWidth: 1, borderColor: 'rgba(8,255,226,0.35)',
  },

  /* Cards */
  card: {
    marginHorizontal: PADDING_H, marginTop: 16,
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    padding: 16,
  },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 14 },
  cardDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  /* All About Me */
  aboutRow: { gap: 6 },
  aboutLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aboutLabel: { color: C.cyan, fontWeight: '700', fontSize: 14 },
  aboutValue: { color: C.text, fontSize: 14, lineHeight: 20 },
  aboutPlaceholder: { color: C.dim, fontStyle: 'italic' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  tagPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: 'rgba(191,46,240,0.15)',
    borderWidth: 1, borderColor: 'rgba(191,46,240,0.4)',
  },
  tagPillText: { color: C.brand, fontWeight: '600', fontSize: 12 },
  addTagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: 'rgba(191,46,240,0.08)',
    borderWidth: 1, borderColor: 'rgba(191,46,240,0.3)',
  },
  addTagBtnText: { color: C.brand, fontWeight: '600', fontSize: 12 },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { color: C.text, fontWeight: '800', fontSize: 16 },
  sectionAddBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Community */
  communityCard: {
    width: width * 0.42, height: width * 0.42,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.border,
  },
  communityImg: { width: '100%', height: '100%' },
  communityFallback: { backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' },
  communityCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    background: 'transparent',
  },
  communityCardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  communityCardName: { color: '#fff', fontWeight: '700', fontSize: 13 },
  communityCardMembers: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyStateText: { color: C.dim, fontSize: 13 },

  /* Stories */
  storyCard: {
    width: width * 0.34, height: width * 0.44,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.border,
  },
  storyImg: { width: '100%', height: '100%' },
  storyGradient: { ...StyleSheet.absoluteFillObject, top: '50%' },
  storyCaption: { position: 'absolute', bottom: 8, left: 8, right: 8, color: '#fff', fontWeight: '700', fontSize: 11 },
  storyFallback: { backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' },
  storyPlaceholderCard: {
    width: width * 0.34, height: width * 0.44,
    borderRadius: 14, backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  storyPlaceholderText: { color: C.dim, fontSize: 11, textAlign: 'center' },

  /* Wallet */
  walletCard: {
    marginHorizontal: PADDING_H, marginTop: 16,
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    padding: 16,
  },
  walletHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  walletTitle: { color: C.text, fontWeight: '800', fontSize: 16 },
  purchaseChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(191,46,240,0.15)', borderWidth: 1, borderColor: 'rgba(191,46,240,0.4)',
  },
  purchaseChipText: { color: C.brand, fontWeight: '700', fontSize: 12 },
  walletRow: { flexDirection: 'row', gap: 10 },
  walletChip: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
  },
  walletIcon: { width: 26, height: 26, resizeMode: 'contain' },
  walletChipText: { color: C.text, fontWeight: '800', fontSize: 16 },
  walletChipLabel: { color: C.dim, fontSize: 11 },

  /* More list */
  moreSectionTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 12 },
  listCard: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 15, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 0 },
  logoutBtn: {
    marginTop: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.danger,
    paddingVertical: 14,
  },
  logoutText: { color: C.danger, fontWeight: '800', fontSize: 14 },

  /* Story Modal */
  storyModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  storyModalClose: { position: 'absolute', top: 50, right: 20, zIndex: 20 },
  storyModalHeader: { position: 'absolute', top: 60, left: 20, right: 80, zIndex: 10 },
  storyModalAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.cyan },
  storyModalImage: { width, height: width * 1.5, maxHeight: '80%' },
  storyModalImagePlaceholder: {
    width: width * 0.8, height: width * 1.2,
    backgroundColor: C.card, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  storyModalCaptionBox: {
    position: 'absolute', bottom: 60, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 16, borderRadius: 12,
  },

  /* Options menu */
  optionsOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  optionsMenu: {
    backgroundColor: C.card, borderRadius: 16, width: '100%', maxWidth: 300,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },
  optionsItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  optionsItemText: { fontSize: 16, fontWeight: '600', color: C.text },
  optionsDivider: { height: 1, backgroundColor: C.border },
});

