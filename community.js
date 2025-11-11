import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  getFirestore, 
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function TopBar({ navigation }) {
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
            const membershipId = `${auth.currentUser.uid}_${comm.community_id || comm.id}`;
            const membershipRef = doc(db, 'communities_members', membershipId);
            await setDoc(membershipRef, {
              user_id: auth.currentUser.uid,
              community_id: comm.community_id || comm.id,
              joinedAt: new Date().toISOString(),
              validated: true,
              role: 'member'
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

              // Build update payload. Always maintain a `members` array (new field) and a numeric `members_count`.
              const updates = {
                members: arrayUnion(auth.currentUser.uid),
                members_count: increment(1),
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
  const [activeCategoryJoined, setActiveCategoryJoined] = useState('Anime & Manga');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [exploredCommunities, setExploredCommunities] = useState([]);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [managedCommunities, setManagedCommunities] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [unsubscribers, setUnsubscribers] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);

  const buttons = ['Explored', 'Joined', 'Managed by you'];

  const db = getFirestore();
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
    if (!u) return 'Guest User';
    if (u.displayName) return u.displayName;
    if (u.name) return u.name;
    if (u.username) return u.username;
    if (u.firstName || u.lastName) return `${u.firstName || ''}${u.firstName && u.lastName ? ' ' : ''}${u.lastName || ''}`.trim();
    return 'Guest User';
  }, []);

  // Helper function to filter communities by category
  const filterByCategory = useCallback((communities, category) => {
    if (!category || category === 'All') return communities;
    return communities.filter(comm => comm.community_category === category);
  }, []);

  // Update explored communities when joined communities change
  useEffect(() => {
    if (allCommunities.length > 0) {
      const joinedIds = joinedCommunities.map(comm => comm.community_id);
      const filtered = allCommunities.filter(comm => !joinedIds.includes(comm.community_id));
      setExploredCommunities(filtered);
    }
  }, [allCommunities, joinedCommunities]);

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
    setLoading(true);

    // Categories listener
    const categoriesUnsub = onSnapshot(
      collection(db, 'community_categories'),
      (snapshot) => {
        const categoriesData = snapshot.docs.map(doc => doc.data().name).filter(Boolean);
        setCategories(['All', ...categoriesData]);
      },
      (error) => console.error('Error fetching categories:', error)
    );
    newUnsubscribers.push(categoriesUnsub);

    // User profile listener
    if (auth.currentUser) {
      const userUnsub = onSnapshot(
        doc(db, 'users', auth.currentUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data());
          }
        },
        (error) => console.error('Error fetching user profile:', error)
      );
      newUnsubscribers.push(userUnsub);
    }

    // Communities listener
    const communitiesUnsub = onSnapshot(
      collection(db, 'communities'),
      async (snapshot) => {
        try {
          const possibleFields = ['profileImage', 'coverImage', 'backgroundImage', 'community_picture', 'imageUrl', 'banner', 'photo', 'picture'];

          // Build base communities array and collect adminIds to fetch when no image present
          const baseComms = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              community_id: d.id, // Ensure community_id is set
              ...data
            };
          });
          const adminIdsToFetch = new Set();

          const communities = baseComms.map(c => {
            let img = null;
            for (const field of possibleFields) {
              if (c[field]) {
                img = { uri: c[field] };
                break;
              }
            }

            if (!img && c.community_admin) {
              adminIdsToFetch.add(c.community_admin);
            }

            // Ensure community_members reflects the count: prefer members_count, then community_members, fallback to members.length
            let memberCount = c.members_count;
            if (memberCount === undefined || memberCount === null) {
              if (typeof c.community_members === 'number') {
                memberCount = c.community_members;
              } else if (Array.isArray(c.members)) {
                memberCount = c.members.length;
              } else if (Array.isArray(c.community_members)) {
                memberCount = c.community_members.length;
              } else {
                memberCount = 0;
              }
            }

            return { ...c, img, community_members: memberCount };
          });

          // If we need admin profile images, fetch those user docs
          if (adminIdsToFetch.size > 0) {
            const idArray = Array.from(adminIdsToFetch);
            const userDocs = await Promise.all(
              idArray.map(id => getDoc(doc(db, 'users', id)))
            );

            const adminImgMap = {};
            userDocs.forEach((ud, i) => {
              if (ud.exists()) {
                const d = ud.data();
                // prefer common profile image fields
                const url = d.profileImage || d.profile_image || d.profile_picture || d.photoURL || d.photo || null;
                if (url) adminImgMap[idArray[i]] = { uri: url };
              }
            });

            // Fill missing imgs from adminImgMap
            for (let i = 0; i < communities.length; i++) {
              if (!communities[i].img && communities[i].community_admin && adminImgMap[communities[i].community_admin]) {
                communities[i].img = adminImgMap[communities[i].community_admin];
              }
            }
          }

          setAllCommunities(communities);

          if (auth.currentUser) {
            // Update managed communities
            const managedComm = communities.filter(
              comm => comm.community_admin === auth.currentUser.uid
            );
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
          const joinedIds = snapshot.docs.map(doc => doc.data().community_id);
          const joinedComm = allCommunities.filter(
            comm => joinedIds.includes(comm.community_id)
          );
          setJoinedCommunities(joinedComm);
        },
        (error) => console.error('Error fetching memberships:', error)
      );
      newUnsubscribers.push(membershipUnsub);
    }

    // Events listener
    const eventsQuery = query(
      collection(db, 'community_events'),
      where('date', '>=', new Date().toISOString())
    );

    const eventsUnsub = onSnapshot(
      eventsQuery,
      async (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // If user is logged in, check which events they've joined
        if (auth.currentUser) {
          const userEventsQuery = query(
            collection(db, 'user_events'),
            where('userId', '==', auth.currentUser.uid)
          );
          
          const userEvents = await getDocs(userEventsQuery);
          const joinedEventIds = new Set(
            userEvents.docs.map(doc => doc.data().eventId)
          );

          events.forEach(event => {
            event.joined = joinedEventIds.has(event.id);
          });
        }

        setCommunityEvents(events);
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

              {selectedCommunityForValidation?.profileImage || selectedCommunityForValidation?.img ? (
                <Image source={selectedCommunityForValidation?.profileImage ? { uri: selectedCommunityForValidation.profileImage } : selectedCommunityForValidation.img} style={styles.modalAvatar} />
              ) : (
                <Image source={require('./assets/a1.png')} style={styles.modalAvatar} />
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
          <Image
            source={getUserImage(userProfile)}
            style={[
              styles.profileImage,
              { borderColor: isConnected ? '#08FFE2' : '#666' }
            ]}
          />
          <View style={styles.profileTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.profileName}>
                {getUserName(userProfile)}
              </Text>
              {userProfile?.verified && (
                <Image
                  source={require('./assets/starimage.png')}
                  style={{ width: 18, height: 18, marginLeft: 5 }}
                />
              )}
            </View>
            <Text style={[styles.profileStatus, { color: isConnected ? '#08FFE2' : '#666' }]}> 
              ● {isConnected ? 'Online' : 'Offline'}
            </Text>
          </View>
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
        </View>
      </View>

      {/* 🔘 Tabs */}
      <View style={styles.buttonContainer}>
        {buttons.map((btn) => {
          const isActive = activeButton === btn;
          return (
            <TouchableOpacity
              key={btn}
              style={{ flex: 1, marginHorizontal: 5 }}
              onPress={() => setActiveButton(btn)}
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#08FFE2" />
          <Text style={styles.loadingText}>Loading communities...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.cardContainer}>
          {/* === EXPLORED TAB === */}
          {activeButton === 'Explored' && (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Live Communities</Text>
                  <TouchableOpacity>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {categories.map((cat) => {
                    const isActive = activeCategoryLive === cat;
                    return (
                      <TouchableOpacity 
                        key={cat + '_live'} 
                        onPress={() => setActiveCategoryLive(cat)} 
                        style={styles.categoryButton}
                      >
                        <Text style={[styles.categoryText, { color: isActive ? '#fff' : '#aaa' }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.imageRow}>
                  {exploredCommunities
                    .filter(item => !activeCategoryLive || item.community_category === activeCategoryLive)
                    .slice(0, 3)
                    .map((item, index) => (
                      <TouchableOpacity 
                          key={item.community_id} 
                          onPress={() => openValidationFor(item)}
                          >
                          <ImageBackground 
                            source={item.img} 
                            style={styles.cardImage} 
                            imageStyle={{ borderRadius: 10 }}
                          >
                            {/* followed badge for explored cards */}
                            {joinedCommunities.some(j => j.community_id === (item.community_id || item.id)) && (
                              <View style={styles.followedBadgeSmall}><Text style={styles.followedBadgeText}>Followed</Text></View>
                            )}
                            <View style={styles.imageOverlay}>
                              <Text style={styles.imageText}>{item.community_title}</Text>
                            </View>
                          </ImageBackground>
                        </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 🌈 Gradient Button: View all Categories → */}
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={{ alignSelf: 'center', marginTop: 10 }}
                onPress={() => navigation.navigate('AllCategories')}
              >
                <LinearGradient
                  colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.gradientButtonText}>View all Categories </Text>
                </LinearGradient>
              </TouchableOpacity>

                  <TouchableOpacity 
                activeOpacity={0.8} 
                style={{ alignSelf: 'center', marginTop: 10 }}
                onPress={() => navigation.navigate('WhatsHappening')}
              >
                <LinearGradient
                  colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.gradientButtonText}>What's Happening </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

        {/* === JOINED TAB === */}
        {activeButton === 'Joined' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((cat) => {
                const isActive = activeCategoryJoined === cat;
                return (
                  <TouchableOpacity 
                    key={cat + '_joined'} 
                    onPress={() => setActiveCategoryJoined(cat)} 
                    style={styles.categoryButton}
                  >
                    <Text style={[styles.categoryText, { color: isActive ? '#fff' : '#aaa' }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {joinedCommunities
                .filter(item => !activeCategoryJoined || item.community_category === activeCategoryJoined)
                .map((item) => (
                  <TouchableOpacity 
                    key={item.community_id}
                    onPress={() => navigation.navigate('CommunityDetail', { communityId: item.community_id })}
                  >
                    <ImageBackground
                      source={item.img}
                      style={styles.joinedImage}
                      imageStyle={{ borderRadius: 10 }}
                    >
                      <View style={styles.imageOverlay}>
                        <Text style={styles.imageText}>{item.community_title}</Text>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 🌈 Gradient Button: Explore More → */}
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={{ alignSelf: 'center', marginTop: 15 }}
              onPress={() => navigation.navigate('ExploreCommunities')}
            >
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <Text style={styles.gradientButtonText}>Explore More </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* === MANAGED TAB === */}
        {activeButton === 'Managed by you' && (
          <View>
            <Text style={styles.cardTitle}>Communities Managed by You</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
              {managedCommunities.map((item) => (
                <TouchableOpacity 
                  key={item.community_id}
                  onPress={() => navigation.navigate('EditCommunity', { communityId: item.community_id })}
                >
                  <ImageBackground
                    source={item.img}
                    style={styles.joinedImage}
                    imageStyle={{ borderRadius: 10 }}
                  >
                    <View style={styles.imageOverlay}>
                      <Text style={styles.imageText}>{item.community_title}</Text>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ✏️ Gradient Button: Create New Community */}
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={{ alignSelf: 'center', marginTop: 15 }}
              onPress={() => navigation.navigate('CreateCommunity')}
            >
              <LinearGradient
                colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradientButton, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.gradientButtonText}>Create New Community</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      )}

      {/* 🎯 Communities Section (show communities from Firestore) */}
      {!loading && (
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>Communities</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {allCommunities && allCommunities.length > 0 ? (
              allCommunities.map((item, idx) => (
                <TouchableOpacity
                  key={item.community_id || item.id || idx}
                  style={styles.eventCard}
                    onPress={() => openValidationFor(item)}
                >
                  {/* item.img was computed earlier as either {uri:...} or a require() fallback */}
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={item.img || require('./assets/profile.png')}
                      style={styles.eventImage}
                    />
                    {joinedCommunities.some(j => j.community_id === (item.community_id || item.id)) && (
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
                    <Text style={[styles.eventDate, { color: '#aaa', marginTop: 4 }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.joinButtonText}>{item.community_members ? (Array.isArray(item.community_members) ? item.community_members.length : item.community_members) : '—'} members</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No communities found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}const styles = StyleSheet.create({
  container: { backgroundColor: '#000', flex: 1 },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#000' 
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 10,
    fontSize: 16 
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 15 },
  profileContainer: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#08FFE2' },
  profileTextContainer: { marginLeft: 15 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileStatus: { color: '#08FFE2', fontSize: 14, marginTop: 3 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 15 },

  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, paddingHorizontal: 15 },
  activeButton: { borderWidth: 1, borderColor: '#BF2EF0', borderRadius: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  activeButtonText: { color: '#fff', fontWeight: '600' },
  inactiveButton: { borderWidth: 1, borderColor: '#222', borderRadius: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  inactiveButtonText: { color: '#aaa', fontWeight: '500' },

  cardContainer: { paddingHorizontal: 15, paddingVertical: 20 },
  card: { width: 328, height: 186, borderRadius: 20, borderWidth: 1, borderColor: '#222', backgroundColor: '#111', padding: 6, alignSelf: 'center', marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#08FFE2', fontSize: 16, fontWeight: '700' },
  viewAllText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  categoryScroll: { marginBottom: 10 },
  categoryButton: { borderWidth: 0, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6 },
  categoryText: { fontSize: 12, fontWeight: '500' },
  imageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardImage: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden' },
  joinedImage: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden', marginRight: 10 },
  imageOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10 },
  imageText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // 🌈 Gradient Button Style
  gradientButton: {
    width: 328,
    height: 41,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FF069B',
    justifyContent: 'center',
    alignItems: 'center',
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

  // Events Section Styles
  eventsContainer: {
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    color: '#08FFE2',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
  },
  eventCard: {
    width: 160,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  eventImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
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
    marginBottom: 8,
  },
  joinButton: {
    backgroundColor: '#BF2EF0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
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
  noEventsContainer: {
    width: 160,
    height: 180,
    backgroundColor: '#111',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
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
});
