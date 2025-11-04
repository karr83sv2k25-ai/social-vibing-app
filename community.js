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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getFirestore, 
  onSnapshot,
  doc,
  setDoc
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function TopBar({ navigation }) {
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
  const [unsubscribers, setUnsubscribers] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);

  const buttons = ['Explored', 'Joined', 'Managed by you'];

  const db = getFirestore();
  const auth = getAuth();

  // Helper function to get community image URL
  const getCommunityImage = useCallback((community) => {
    const possibleFields = ['community_picture', 'imageUrl', 'banner', 'photo', 'picture'];
    for (const field of possibleFields) {
      if (community[field]) return { uri: community[field] };
    }
    // Use a placeholder image that we know exists
    return require('./assets/profile.png');
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
      (snapshot) => {
        const communities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          img: getCommunityImage(doc.data())
        }));
        setAllCommunities(communities);
        
        if (auth.currentUser) {
          // Update managed communities
          const managedComm = communities.filter(
            comm => comm.community_admin === auth.currentUser.uid
          );
          setManagedCommunities(managedComm);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 🔝 Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.profileContainer}>
          <Image
            source={userProfile?.profile_picture ? { uri: userProfile.profile_picture } : require('./assets/profile.png')}
            style={[
              styles.profileImage,
              { borderColor: userProfile?.online ? '#08FFE2' : '#666' }
            ]}
          />
          <View style={styles.profileTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.profileName}>
                {userProfile?.displayName || userProfile?.username || 'Guest User'}
              </Text>
              {userProfile?.verified && (
                <Image
                  source={require('./assets/starimage.png')}
                  style={{ width: 18, height: 18, marginLeft: 5 }}
                />
              )}
            </View>
            <Text style={[styles.profileStatus, { color: userProfile?.online ? '#08FFE2' : '#666' }]}>
              ● {userProfile?.online ? 'Online' : 'Offline'}
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
                        onPress={() => navigation.navigate('CommunityDetail', { communityId: item.community_id })}
                      >
                        <ImageBackground 
                          source={item.img} 
                          style={styles.cardImage} 
                          imageStyle={{ borderRadius: 10 }}
                        >
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

      {/* 🎯 Events Section */}
      {!loading && (
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>Community Events</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {communityEvents?.length > 0 ? (
              communityEvents.map((event, index) => (
                <View key={event.id || index} style={styles.eventCard}>
                  <Image
                    source={event.imageUrl ? { uri: event.imageUrl } : require('./assets/profile.png')}
                    style={styles.eventImage}
                    onError={(e) => {
                      // Fallback to profile image on error
                      e.target.source = require('./assets/profile.png');
                    }}
                  />
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventDate}>
                    {new Date(event.date).toLocaleDateString()}
                  </Text>
                  <TouchableOpacity 
                    style={[
                      styles.joinButton,
                      event.joined && styles.joinedButton
                    ]}
                    onPress={() => handleJoinEvent(event.id)}
                  >
                    <Text style={[
                      styles.joinButtonText,
                      event.joined && styles.joinedButtonText
                    ]}>
                      {event.joined ? 'Joined' : 'Join Event'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No upcoming events</Text>
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
});
