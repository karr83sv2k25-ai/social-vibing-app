import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { CommunitySkeleton } from './components/SkeletonLoaders';
import { getDisplayName, getUserAvatar } from './utils/userNameHelpers';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  limit,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app as firebaseApp, db } from './firebaseConfig';
import CacheManager from './cacheManager';
import StatusBadge from './components/StatusBadge';
import StatusSelector from './components/StatusSelector';
import VerifiedBadge from './components/VerifiedBadge';
import { getDailyRewardsData, claimTaskReward, DAILY_TASKS, getTimeUntilMidnight, formatTimeRemaining } from './shared/services/dailyRewardsService';
import { useWallet } from './context/WalletContext';
import ReportUserModal from './components/ReportUserModal';

// Memoized community card component for better rendering performance
const CommunityCard = React.memo(({ item, idx, onPress, onLongPress, showFollowedBadge, isJoined }) => (
  <TouchableOpacity
    key={item.community_id || item.id || idx.toString()}
    style={styles.eventCardGrid}
    onPress={() => onPress(item)}
    onLongPress={() => onLongPress && onLongPress(item)}
    activeOpacity={0.8}
    delayLongPress={500}
  >
    <View style={{ position: 'relative' }}>
      <Image
        source={item.img || require('./assets/profile.png')}
        style={styles.eventImageGrid}
      />
      {showFollowedBadge && isJoined && (
        <View style={styles.followedBadge}><Text style={styles.followedBadgeText}>Followed</Text></View>
      )}
    </View>
    <Text style={styles.eventTitle} numberOfLines={1}>
      {item.name || item.community_title || item.title || 'Community'}
    </Text>
    <Text style={styles.eventDate} numberOfLines={1}>
      {item.category || item.community_category || ''}
    </Text>
    {!!item.description && (
      <Text style={[styles.eventDate, { color: '#aaa', marginTop: 4 }]} numberOfLines={2}>
        {item.description}
      </Text>
    )}
    <View style={{ marginTop: 6 }}>
      <Text style={styles.joinButtonText}>{typeof item.community_members === 'number' ? item.community_members : (item.community_members || 0)} members</Text>
    </View>
  </TouchableOpacity>
));

export default function TopBar({ navigation, route }) {
  // validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationStep, setValidationStep] = useState(0); // 0,1,2
  const [selectedCommunityForValidation, setSelectedCommunityForValidation] = useState(null);

  const openValidationFor = async (community) => {
    // If user is logged in, do an authoritative Firestore check to see
    // whether they are already a member of this community. Relying on
    // local state (`joinedCommunities`) can be racy because listeners
    // may not have synced yet.
    const communityId = community.community_id || community.id;

    if (auth.currentUser) {
      try {
        const q = query(
          collection(db, 'communities_members'),
          where('user_id', '==', auth.currentUser.uid),
          where('community_id', '==', communityId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // User is already a member — go straight to GroupInfo
          navigation.navigate('GroupInfo', { communityId });
          return;
        }

        // Fallback: some setups store membership documents using a composite ID
        // like `${uid}_${communityId}` instead of querying fields. Try that as well.
        try {
          const membershipId = `${auth.currentUser.uid}_${communityId}`;
          const membershipDoc = await getDoc(doc(db, 'communities_members', membershipId));
          if (membershipDoc.exists()) {
            navigation.navigate('GroupInfo', { communityId });
            return;
          }
        } catch (e) {
          // ignore fallback errors and proceed to modal
        }
      } catch (err) {
        console.error('Error checking membership before opening validation:', err);
        // Fallthrough to open validation modal so user can still join
      }
    }

    // Not a member (or not logged in) — show validation flow
    setSelectedCommunityForValidation(community);
    setValidationStep(0);
    setShowValidationModal(true);
  };

  const closeValidation = () => {
    setShowValidationModal(false);
    setSelectedCommunityForValidation(null);
    setValidationStep(0);
  };

  const handleValidationNext = () => {
    if (validationStep < 2) {
      setValidationStep(prev => prev + 1);
    } else {
      // finished validations -> mark membership (if logged in) then navigate
      const comm = selectedCommunityForValidation;
      const finish = async () => {
        try {
          if (auth.currentUser && comm) {
            const communityId = comm.community_id || comm.id;

            // Check if community is private — if so, submit a join request instead of auto-joining
            if (comm.privacy === 'private') {
              try {
                // Check for existing pending request
                const existingQuery = query(
                  collection(db, 'join_requests'),
                  where('communityId', '==', communityId),
                  where('userId', '==', auth.currentUser.uid),
                  where('status', '==', 'pending')
                );
                const existingSnap = await getDocs(existingQuery);
                if (!existingSnap.empty) {
                  Alert.alert('Request Pending', 'You already have a pending join request for this community.');
                  closeValidation();
                  return;
                }

                await addDoc(collection(db, 'join_requests'), {
                  communityId,
                  userId: auth.currentUser.uid,
                  status: 'pending',
                  message: '',
                  createdAt: serverTimestamp(),
                  requestedAt: serverTimestamp(),
                });

                Alert.alert('Request Sent', 'Your join request has been sent to the community admins for approval.');
                closeValidation();
                return;
              } catch (joinReqError) {
                console.error('Failed to submit join request:', joinReqError);
                Alert.alert('Error', 'Failed to send join request. Please try again.');
                closeValidation();
                return;
              }
            }

            const membershipId = `${auth.currentUser.uid}_${communityId}`;
            const membershipRef = doc(db, 'communities_members', membershipId);
            await setDoc(membershipRef, {
              user_id: auth.currentUser.uid,
              community_id: comm.community_id || comm.id,
              joinedAt: new Date().toISOString(),
              validated: true,
              role: 'member',
              communityNickname: null,
            });

            // optimistic update: add to joinedCommunities local state
            setJoinedCommunities(prev => {
              const exists = prev.some(j => j.community_id === (comm.community_id || comm.id));
              if (exists) return prev;
              return [...prev, comm];
            });

            // Also update the community document: add uid to members array and increment numeric counts
            try {
              const communityId = comm.community_id || comm.id;
              const communityRef = doc(db, 'communities', communityId);

              // Build update payload. Always maintain a `members` array and consistent numeric counters.
              const updates = {
                members: arrayUnion(auth.currentUser.uid),
                memberIds: arrayUnion(auth.currentUser.uid),
                members_count: increment(1),
                memberCount: increment(1),
              };

              // Keep compatibility with older `community_members` field which may be a number or array.
              if (typeof comm.community_members === 'number') {
                updates.community_members = increment(1);
              } else {
                // If it's not a number (likely undefined or array), add uid to it as an array field.
                updates.community_members = arrayUnion(auth.currentUser.uid);
              }

              await updateDoc(communityRef, updates);
            } catch (e) {
              // Non-fatal: log and continue. Firestore update may fail if field types differ across docs.
              console.warn('Failed to update community members fields:', e);
            }
          }
        } catch (err) {
          console.error('Failed to save membership:', err);
        } finally {
          closeValidation();
          if (comm) navigation.navigate('GroupInfo', { communityId: comm.community_id || comm.id });
        }
      };
      finish();
    }
  };
  const [activeButton, setActiveButton] = useState('Explored');
  const [activeCategoryLive, setActiveCategoryLive] = useState('Anime & Manga');
  const [activeCategoryExplore, setActiveCategoryExplore] = useState('Anime & Manga');
  const [activeCategoryJoined, setActiveCategoryJoined] = useState('All');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [exploredCommunities, setExploredCommunities] = useState([]);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [statusSelectorVisible, setStatusSelectorVisible] = useState(false);
  const [managedCommunities, setManagedCommunities] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [unsubscribers, setUnsubscribers] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);

  // Global check-in state
  const [globalCheckInDone, setGlobalCheckInDone] = useState(false);
  const [globalStreak, setGlobalStreak] = useState(0);
  const [globalCoinsToday, setGlobalCoinsToday] = useState(0);
  const [globalCheckingIn, setGlobalCheckingIn] = useState(false);
  const [globalCountdown, setGlobalCountdown] = useState('');
  const walletContext = useWallet();
  const { wallet: walletData } = walletContext || {};

  const [refreshing, setRefreshing] = useState(false);

  // Community report/flag state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetCommunity, setReportTargetCommunity] = useState(null);

  const buttons = ['Explored', 'Joined', 'Managed by you'];

  // db is now imported globally
  const auth = getAuth();

  // Helper function to get community image URL
  const getCommunityImage = useCallback((community) => {
    // Prefer the exact fields you provided, then fall back to older field names
    const possibleFields = [
      'profileImage',
      'coverImage',
      'backgroundImage',
      'community_picture',
      'imageUrl',
      'banner',
      'photo',
      'picture',
    ];
    for (const field of possibleFields) {
      if (community[field]) return { uri: community[field] };
    }
    // Use a placeholder image that we know exists
    return require('./assets/profile.png');
  }, []);

  // Helper to get current user image from userProfile: prefer profileImage then other common fields
  const getUserImage = useCallback((u) => {
    if (!u) return require('./assets/profile.png');
    const url = u.profileImage || u.profile_image || u.profile_picture || u.photoURL || u.photo || null;
    return url ? { uri: url } : require('./assets/profile.png');
  }, []);

  // Helper to get a display name for the user
  const getUserName = useCallback((u) => {
    return getDisplayName(u, 'Guest User');
  }, []);

  // Long-press handler for flagging/reporting a community
  const handleCommunityLongPress = useCallback((community) => {
    const communityName = community.name || community.community_title || community.title || 'Community';
    Alert.alert(
      communityName,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Community',
          style: 'destructive',
          onPress: () => {
            if (!auth.currentUser) {
              Alert.alert('Sign In Required', 'Please sign in to report a community.');
              return;
            }
            setReportTargetCommunity(community);
            setShowReportModal(true);
          },
        },
      ]
    );
  }, [auth.currentUser]);

  // Helper function to filter communities by category
  const filterByCategory = useCallback((communities, category) => {
    if (!category || category === 'All') return communities;
    return communities.filter(comm => comm.community_category === category);
  }, []);

  // Memoize filtered joined communities by category for performance
  const filteredJoinedCommunities = useMemo(() => {
    if (!activeCategoryJoined || activeCategoryJoined === 'All') return joinedCommunities;
    return joinedCommunities.filter(item => {
      const itemCategory = item.category || item.community_category;
      return itemCategory === activeCategoryJoined;
    });
  }, [joinedCommunities, activeCategoryJoined]);

  // Memoize whether a community is joined for badge display
  const joinedCommunityIds = useMemo(() => {
    return new Set(joinedCommunities.map(j => j.community_id || j.id));
  }, [joinedCommunities]);

  // Update explored communities when joined communities change - memoized for performance
  const exploredCommunitiesMemo = useMemo(() => {
    if (allCommunities.length === 0) return [];
    const joinedIds = new Set(joinedCommunities.map(comm => comm.community_id || comm.id));
    return allCommunities.filter(comm => {
      const commId = comm.community_id || comm.id;
      return !joinedIds.has(commId);
    });
  }, [allCommunities, joinedCommunities]);

  useEffect(() => {
    setExploredCommunities(exploredCommunitiesMemo);
  }, [exploredCommunitiesMemo]);

  // Sync joinedCommunities when allCommunities changes - debounced for performance
  useEffect(() => {
    if (!auth.currentUser || allCommunities.length === 0) return;

    const timeoutId = setTimeout(() => {
      const syncJoinedCommunities = async () => {
        try {
          const membershipQuery = query(
            collection(db, 'communities_members'),
            where('user_id', '==', auth.currentUser.uid)
          );
          const membershipSnap = await getDocs(membershipQuery);
          const joinedIds = membershipSnap.docs.map(doc => {
            const data = doc.data();
            return data.community_id || doc.id.split('_')[1];
          }).filter(Boolean);

          const joinedIdsSet = new Set(joinedIds);
          const joinedComm = allCommunities.filter(
            comm => {
              const commId = comm.community_id || comm.id;
              return joinedIdsSet.has(commId);
            }
          );
          setJoinedCommunities(joinedComm);
        } catch (error) {
          console.error('Error syncing joined communities:', error);
        }
      };
      syncJoinedCommunities();
    }, 300); // Debounce by 300ms to avoid rapid re-fetches

    return () => clearTimeout(timeoutId);
  }, [auth.currentUser, allCommunities]);

  // Handle joining events
  const handleJoinEvent = useCallback(async (eventId) => {
    if (!auth.currentUser) {
      // Navigate to login or show login prompt
      navigation.navigate('Login');
      return;
    }

    try {
      const eventRef = doc(db, 'community_events', eventId);
      const userEventRef = doc(db, 'user_events', `${auth.currentUser.uid}_${eventId}`);

      const eventDoc = await getDocs(collection(db, 'community_events'));
      const eventExists = eventDoc.docs.some(doc => doc.id === eventId);
      if (!eventExists) {
        console.error('Event not found');
        return;
      }

      await setDoc(userEventRef, {
        userId: auth.currentUser.uid,
        eventId,
        joinedAt: new Date().toISOString(),
        status: 'joined'
      });

      // Update local state
      setCommunityEvents(prev => prev.map(event =>
        event.id === eventId ? { ...event, joined: true } : event
      ));

    } catch (error) {
      console.error('Error joining event:', error);
      // Show error toast or alert
    }
  }, [auth.currentUser, navigation]);

  // Setup auth listener and cleanup subscriptions
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserProfile(null);
        setJoinedCommunities([]);
        setManagedCommunities([]);
        setCommunityEvents([]); // Clear events when logged out
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Setup real-time listeners
  useEffect(() => {
    const newUnsubscribers = [];

    // Load cached data immediately for instant UI
    const loadCachedData = async () => {
      if (auth.currentUser) {
        const cachedProfile = await CacheManager.getUserProfile(auth.currentUser.uid);
        if (cachedProfile) {
          console.log('📦 Using cached user profile');
          setUserProfile(cachedProfile);
        }

        const cachedJoined = await CacheManager.getJoinedCommunities(auth.currentUser.uid);
        if (cachedJoined) {
          console.log('📦 Using cached joined communities');
          setJoinedCommunities(cachedJoined);
        }
      }

      const cachedCommunities = await CacheManager.getCommunities();
      if (cachedCommunities) {
        console.log('📦 Using cached communities');
        setAllCommunities(cachedCommunities);
        setLoading(false); // Show UI immediately with cached data
      }

      const cachedEvents = await CacheManager.getCommunityEvents();
      if (cachedEvents) {
        console.log('📦 Using cached events');
        setCommunityEvents(cachedEvents);
      }
    };

    loadCachedData();
    setLoading(true);

    // User profile listener
    if (auth.currentUser) {
      const userUnsub = onSnapshot(
        doc(db, 'users', auth.currentUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const profileData = snapshot.data();
            setUserProfile(profileData);
            // Cache user profile
            CacheManager.saveUserProfile(auth.currentUser.uid, profileData);
          }
        },
        (error) => console.error('Error fetching user profile:', error)
      );
      newUnsubscribers.push(userUnsub);
    }

    // Communities listener - optimized with lazy image loading and limit
    const communitiesQuery = query(collection(db, 'communities'), limit(20)); // OPTIMIZATION: Limit to 20 communities
    const communitiesUnsub = onSnapshot(
      communitiesQuery,
      (snapshot) => {
        try {
          const possibleFields = ['profileImage', 'coverImage', 'backgroundImage', 'community_picture', 'imageUrl', 'banner', 'photo', 'picture'];

          // Process communities without fetching admin images (lazy load later)
          const communities = snapshot.docs
            .filter(d => !d.data().isDisabled && !d.data().isDeleted)
            .map(d => {
            const data = d.data();
            let img = null;

            // Find first available image field
            for (const field of possibleFields) {
              if (data[field]) {
                img = { uri: data[field] };
                break;
              }
            }

            // Combine members + memberIds arrays (deduped) for the true count across all creation/join paths
            const membersArr = Array.isArray(data.members) ? data.members : [];
            const memberIdsArr = Array.isArray(data.memberIds) ? data.memberIds : [];
            const combinedIds = [...new Set([...membersArr, ...memberIdsArr])];
            const memberCount = combinedIds.length > 0
              ? combinedIds.length
              : typeof data.memberCount === 'number' && data.memberCount > 0
                ? data.memberCount
                : typeof data.members_count === 'number' && data.members_count > 0
                  ? data.members_count + (memberIdsArr.length > 0 ? 1 : 0) // add creator not counted in members_count
                  : Array.isArray(data.community_members)
                    ? data.community_members.length
                    : (typeof data.community_members === 'number' ? data.community_members : 0);

            return {
              id: d.id,
              community_id: d.id,
              ...data,
              img: img || require('./assets/profile.png'),
              community_members: memberCount
            };
          });

          setAllCommunities(communities);
          // Cache communities
          CacheManager.saveCommunities(communities);

          if (auth.currentUser) {
            // Update managed communities - ONLY check adminIds array
            // This allows super admin to fully control who can manage communities
            const managedComm = communities.filter(comm => {
              const adminIds = Array.isArray(comm.adminIds)
                ? comm.adminIds
                : Array.isArray(comm.admins)
                  ? comm.admins
                  : [];
              return adminIds.includes(auth.currentUser.uid);
            });
            setManagedCommunities(managedComm);
          }
        } catch (err) {
          console.error('Error processing communities snapshot:', err);
        }
      },
      (error) => console.error('Error fetching communities:', error)
    );
    newUnsubscribers.push(communitiesUnsub);

    // Memberships listener
    if (auth.currentUser) {
      const membershipUnsub = onSnapshot(
        query(
          collection(db, 'communities_members'),
          where('user_id', '==', auth.currentUser.uid)
        ),
        (snapshot) => {
          const joinedIds = snapshot.docs.map(doc => {
            const data = doc.data();
            return data.community_id || doc.id.split('_')[1]; // Support both field-based and composite ID
          }).filter(Boolean);

          // Update joinedCommunities based on current allCommunities
          const joinedComm = allCommunities.filter(
            comm => {
              const commId = comm.community_id || comm.id;
              return joinedIds.includes(commId);
            }
          );
          setJoinedCommunities(joinedComm);
          // Cache joined communities
          if (auth.currentUser) {
            CacheManager.saveJoinedCommunities(auth.currentUser.uid, joinedComm);
          }
        },
        (error) => console.error('Error fetching memberships:', error)
      );
      newUnsubscribers.push(membershipUnsub);
    }

    // Events listener - fetch only recent events for performance with query limit
    const eventsQuery = query(
      collection(db, 'community_events'),
      orderBy('date', 'desc'),
      limit(20) // OPTIMIZATION: Limit to 20 most recent events
    );
    const eventsUnsub = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const now = new Date().toISOString();
        const events = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            joined: false // Will be updated lazily if needed
          }))
          .filter(event => !event.date || event.date >= now);

        setCommunityEvents(events);
        // Cache events
        CacheManager.saveCommunityEvents(events);
      },
      (error) => console.error('Error fetching events:', error)
    );
    newUnsubscribers.push(eventsUnsub);

    setUnsubscribers(newUnsubscribers);
    setLoading(false);

    return () => {
      newUnsubscribers.forEach(unsub => unsub());
    };
  }, [auth.currentUser?.uid]);

  // Handle navigation from shared community posts using useFocusEffect
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.openCommunityId && route?.params?.openCommunityData) {
        // Small delay to ensure component is mounted and ready
        const timer = setTimeout(() => {
          const communityData = route.params.openCommunityData;
          console.log('Opening validation for community:', communityData.name || communityData.community_title);
          openValidationFor(communityData);

          // Clear the params after handling to prevent reopening
          navigation.setParams({ openCommunityId: undefined, openCommunityData: undefined });
        }, 150);

        return () => clearTimeout(timer);
      }
    }, [route?.params?.openCommunityId, route?.params?.openCommunityData])
  );

  // Network connectivity listener: show Online/Offline based on device connectivity
  useEffect(() => {
    let mounted = true;
    // initial fetch
    NetInfo.fetch().then(state => {
      if (mounted) setIsConnected(Boolean(state.isConnected));
    }).catch(() => {
      if (mounted) setIsConnected(false);
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      if (mounted) setIsConnected(Boolean(state.isConnected));
    });

    return () => { mounted = false; unsubscribe(); };
  }, []);

  // Load global check-in data
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getDailyRewardsData(db, userId);
        if (!mounted) return;
        const checkInTask = data?.tasks?.[DAILY_TASKS.CHECK_IN.id];
        setGlobalCheckInDone(checkInTask?.status === 'claimed');
        setGlobalStreak(data?.streak || 0);
        setGlobalCoinsToday(data?.coinsEarnedToday || 0);
      } catch (e) {
        console.log('Error loading global check-in:', e.message);
      }
    })();
    return () => { mounted = false; };
  }, [auth.currentUser?.uid]);

  // Global countdown timer
  useEffect(() => {
    if (!globalCheckInDone) { setGlobalCountdown(''); return; }
    const tick = () => setGlobalCountdown(formatTimeRemaining(getTimeUntilMidnight()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [globalCheckInDone]);

  // Global check-in handler
  const handleGlobalCheckIn = useCallback(async () => {
    if (globalCheckInDone || globalCheckingIn) {
      navigation.navigate('DailyReward');
      return;
    }
    setGlobalCheckingIn(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const result = await claimTaskReward(db, userId, DAILY_TASKS.CHECK_IN.id, walletContext);
      if (result.success) {
        setGlobalCheckInDone(true);
        setGlobalCoinsToday(prev => prev + (result.reward || 0));
        Alert.alert(
          '🎉 Daily Check-in Complete!',
          `🔥 Streak: ${globalStreak} days\nWatch ads to earn coins!`,
          [{ text: 'Awesome!' }]
        );
      } else if (result.alreadyClaimed) {
        setGlobalCheckInDone(true);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Check-in failed');
    } finally {
      setGlobalCheckingIn(false);
    }
  }, [globalCheckInDone, globalCheckingIn, globalStreak, walletContext]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {/* Validation modal shown before entering a community */}
      <Modal visible={showValidationModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={validationStep === 0 ? ['#0ea5a3', '#065f46'] : validationStep === 1 ? ['#7c3aed', '#2a0b5a'] : ['#0f9d58', '#0b6623']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 18, borderRadius: 12 }}
            >
              <Text style={styles.modalTitle}>{validationStep === 0 ? `Welcome to\n${selectedCommunityForValidation?.name || selectedCommunityForValidation?.community_title || 'Community'}` : validationStep === 1 ? 'Start connecting with other members' : 'All Set!'}</Text>

              {selectedCommunityForValidation?.profileImage || (selectedCommunityForValidation?.img?.uri) ? (
                <Image
                  source={
                    selectedCommunityForValidation?.profileImage
                      ? { uri: selectedCommunityForValidation.profileImage }
                      : selectedCommunityForValidation?.img?.uri
                        ? { uri: selectedCommunityForValidation.img.uri }
                        : selectedCommunityForValidation.img
                  }
                  style={styles.modalAvatar}
                />
              ) : (
                <View style={[styles.modalAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="people" size={44} color="#657786" />
                </View>
              )}

              <Text style={styles.modalText} numberOfLines={4}>{validationStep === 0 ? 'Hello and welcome to our community! Please read the community guidelines before getting started.' : validationStep === 1 ? 'Follow a few members to start connecting — you can follow more later.' : 'You have completed the quick setup. Tap below to open the community.'}</Text>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalButton} onPress={handleValidationNext}>
                  <Text style={styles.modalButtonText}>{validationStep === 0 ? 'Next >' : validationStep === 1 ? 'Follow & Next >' : "Let's Rock 🔥"}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* 🔝 Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.profileContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            {getUserImage(userProfile)?.uri ? (
              <Image
                source={getUserImage(userProfile)}
                style={[
                  styles.profileImage,
                  { borderColor: isConnected ? '#08FFE2' : '#666' }
                ]}
              />
            ) : (
              <View style={[
                styles.profileImage,
                { borderColor: isConnected ? '#08FFE2' : '#666', backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }
              ]}>
                <Ionicons name="person" size={30} color="#657786" />
              </View>
            )}
            <View style={styles.profileTextContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.profileName}>
                  {getUserName(userProfile)}
                </Text>
                <VerifiedBadge isVerified={userProfile?.isVerified} size={16} />
                {userProfile?.gender && (
                  <Ionicons
                    name={
                      userProfile.gender === 'Male' ? 'male' :
                      userProfile.gender === 'Female' ? 'female' :
                      'male-female'
                    }
                    size={16}
                    color="#08FFE2"
                    style={{ marginLeft: 5 }}
                  />
                )}
              </View>
              {/* User Status Badge */}
              <View style={{ marginTop: 4 }}>
                <TouchableOpacity onPress={() => setStatusSelectorVisible(true)}>
                  <StatusBadge
                    isOwnStatus={true}
                    size="small"
                    showEditIcon={false}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.iconsContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Explore')}
          >
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notification')}
          >
            <Ionicons name="notifications" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('GlobalLeaderboard')}
          >
            <Ionicons name="trophy-outline" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔘 Tabs */}
      <View style={styles.buttonContainer}>
        {buttons.map((btn) => {
          const isActive = activeButton === btn;
          return (
            <TouchableOpacity
              key={btn}
              style={{ flex: 1, marginHorizontal: 4 }}
              onPress={() => {
                setActiveButton(btn);
                if (btn === 'Joined') {
                  setActiveCategoryJoined('All');
                }
              }}
              activeOpacity={0.8}
            >
              {isActive ? (
                <LinearGradient
                  colors={['#BF2EF0', 'rgba(191, 46, 240, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeButton}
                >
                  <Text style={styles.activeButtonText}>{btn}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.inactiveButton}>
                  <Text style={styles.inactiveButtonText}>{btn}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 📸 Sections */}
      {loading ? (
        <CommunitySkeleton count={6} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                setLoading(true);
                try {
                  // Trigger re-fetch by toggling loading
                  setTimeout(() => {
                    setLoading(false);
                    setRefreshing(false);
                  }, 800);
                } catch {
                  setRefreshing(false);
                  setLoading(false);
                }
              }}
              tintColor="#fff"
              colors={['#BF2EF0', '#05FF00', '#FFD913']}
            />
          }
        >
          {/* === EXPLORED TAB === */}
          {activeButton === 'Explored' && (
            <View style={styles.sectionWrap}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Communities</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Explore')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              {allCommunities && allCommunities.length > 0 ? (
                <View style={styles.gridContainer}>
                  {allCommunities.map((item, idx) => (
                    <CommunityCard
                      key={item.community_id || item.id || idx.toString()}
                      item={item}
                      idx={idx}
                      onPress={openValidationFor}
                      onLongPress={handleCommunityLongPress}
                      showFollowedBadge={true}
                      isJoined={joinedCommunityIds.has(item.community_id || item.id)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="planet-outline" size={48} color="#333" />
                  <Text style={styles.emptyStateTitle}>No communities found</Text>
                  <Text style={styles.emptyStateSubtitle}>Pull down to refresh</Text>
                </View>
              )}
            </View>
          )}

          {/* === JOINED TAB === */}
          {activeButton === 'Joined' && (
            <View style={styles.sectionWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContent}
                style={styles.categoryScroll}
              >
                {categories.map((cat) => {
                  const isActiveCat = activeCategoryJoined === cat;
                  return (
                    <TouchableOpacity
                      key={cat + '_joined'}
                      onPress={() => setActiveCategoryJoined(cat)}
                      style={[
                        styles.categoryPill,
                        isActiveCat && styles.categoryPillActive,
                      ]}
                    >
                      <Text style={[
                        styles.categoryPillText,
                        isActiveCat && styles.categoryPillTextActive,
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Joined Communities Grid */}
              {joinedCommunities.length > 0 ? (
                <View style={styles.gridContainer}>
                  {filteredJoinedCommunities.map((item, idx) => (
                    <CommunityCard
                      key={item.community_id || item.id || idx.toString()}
                      item={item}
                      idx={idx}
                      onPress={() => navigation.navigate('GroupInfo', { communityId: item.community_id || item.id })}
                      onLongPress={handleCommunityLongPress}
                      showFollowedBadge={false}
                      isJoined={false}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="people-outline" size={48} color="#333" />
                  <Text style={styles.emptyStateTitle}>No joined communities yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Explore communities to join them</Text>
                </View>
              )}
            </View>
          )}

          {/* === MANAGED TAB === */}
          {activeButton === 'Managed by you' && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Communities Managed by You</Text>
              {managedCommunities.length > 0 ? (
                <View style={styles.gridContainer}>
                  {managedCommunities.map((item, idx) => (
                    <CommunityCard
                      key={item.community_id || item.id || idx.toString()}
                      item={item}
                      idx={idx}
                      onPress={() => navigation.navigate('GroupInfo', { communityId: item.community_id || item.id })}
                      onLongPress={handleCommunityLongPress}
                      showFollowedBadge={false}
                      isJoined={false}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="settings-outline" size={48} color="#333" />
                  <Text style={styles.emptyStateTitle}>No managed communities yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Create a community to manage it</Text>
                </View>
              )}

              {/* ✏️ Gradient Button: Create New Community */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={{ alignSelf: 'center', marginTop: 20 }}
                onPress={() => navigation.navigate('CreateCommunityScreen')}
              >
                <LinearGradient
                  colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.gradientButtonText}>Create New Community</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Status Selector Modal */}
      <StatusSelector
        visible={statusSelectorVisible}
        onClose={() => setStatusSelectorVisible(false)}
        title="Update Your Status"
      />

      {/* Report Community Modal */}
      {reportTargetCommunity && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportTargetCommunity(null);
          }}
          reportedUser={{
            id: reportTargetCommunity?.community_id || reportTargetCommunity?.id,
            username: reportTargetCommunity?.name || reportTargetCommunity?.community_title || reportTargetCommunity?.title || 'Community',
            name: reportTargetCommunity?.name || reportTargetCommunity?.community_title || reportTargetCommunity?.title || 'Community',
          }}
          reportType="community"
          contentId={reportTargetCommunity?.community_id || reportTargetCommunity?.id}
          contentType="community"
          contentPreview={reportTargetCommunity?.description || reportTargetCommunity?.name || 'Community content'}
          communityId={reportTargetCommunity?.community_id || reportTargetCommunity?.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#08FFE2' },
  profileTextContainer: { marginLeft: 12, flex: 1 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileStatus: { color: '#08FFE2', fontSize: 14, marginTop: 3 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 15 },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  activeButton: {
    borderWidth: 1,
    borderColor: '#BF2EF0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  inactiveButton: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
  },
  inactiveButtonText: { color: '#888', fontWeight: '500', fontSize: 13 },

  // Section wrapper — single layer of horizontal padding
  sectionWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  cardContainer: { paddingHorizontal: 16, paddingVertical: 20 },
  card: { width: 328, height: 186, borderRadius: 20, borderWidth: 1, borderColor: '#222', backgroundColor: '#111', padding: 6, alignSelf: 'center', marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#08FFE2', fontSize: 16, fontWeight: '700' },
  viewAllText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  // Category pills
  categoryScroll: { marginBottom: 12 },
  categoryScrollContent: { paddingRight: 16 },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: 'rgba(191, 46, 240, 0.15)',
    borderColor: '#BF2EF0',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  // Legacy category styles (kept for compat)
  categoryButton: { borderWidth: 0, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6 },
  categoryText: { fontSize: 12, fontWeight: '500' },

  imageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardImage: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden' },
  joinedImage: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden', marginRight: 10 },
  imageOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10 },
  imageText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // 🌈 Gradient Button Style
  gradientButton: {
    width: SCREEN_WIDTH - 32,
    height: 46,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FF069B',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF1468',
    shadowOpacity: 0.6,
    shadowRadius: 9.9,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(255, 6, 200, 0.1)',
  },
  gradientButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Section title
  sectionTitle: {
    color: '#08FFE2',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  // Community card grid
  eventCard: {
    width: 160,
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  eventCardGrid: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  eventImage: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    marginBottom: 8,
  },
  eventImageGrid: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
    width: '100%',
  },
  eventTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 6,
  },
  joinButton: {
    backgroundColor: '#BF2EF0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  joinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#BF2EF0',
  },
  joinedButtonText: {
    color: '#BF2EF0',
  },

  // Empty state (consistent across all tabs)
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    color: '#555',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtitle: {
    color: '#444',
    fontSize: 12,
    marginTop: 6,
  },

  // Legacy (kept for compat)
  noEventsContainer: {
    width: '100%',
    paddingVertical: 60,
    backgroundColor: '#111',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  noEventsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  // Modal / validation flow styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 12 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  modalAvatar: { width: 88, height: 88, borderRadius: 44, alignSelf: 'center', marginVertical: 8, borderWidth: 2, borderColor: '#fff' },
  modalText: { color: '#e6eef0', fontSize: 14, textAlign: 'center', marginTop: 8 },
  modalFooter: { marginTop: 16, alignItems: 'center' },
  modalButton: { backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  followedBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  followedBadgeSmall: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  followedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Global Check-in styles
  globalCheckInCard: {
    marginHorizontal: 15,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  globalCheckInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  globalCheckInLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  globalCheckInIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(191,46,240,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  globalCheckInTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  globalCheckInSub: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  globalCheckInRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  globalCheckInStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  globalCheckInStatText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '700',
  },
});

