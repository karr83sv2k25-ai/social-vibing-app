// screens/CommunityLeaderboardScreen.js
// Leaderboard screen showing community rankings with filters
// Redesigned with podium-style top 3 layout

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  getCommunityLeaderboard,
  getUserRank,
  getUserBadge,
  BADGES,
} from '../shared/services/communityCheckInService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#1A1D24',
  card: '#2A2F3A',
  card2: '#353B48',
  border: '#3D4452',
  text: '#FFFFFF',
  dim: '#8B9099',
  purple: '#7C3AED',
  magenta: '#E91E8C',
  blue: '#00BFFF',
  green: '#00FF73',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  red: '#FF4757',
  orange: '#FF8C42',
};

const RANK_COLORS = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver
  3: '#CD7F32', // Bronze
};

const MEDAL_COLORS = {
  1: { bg: '#FFD700', text: '#000' }, // Gold
  2: { bg: '#C0C0C0', text: '#000' }, // Silver
  3: { bg: '#CD7F32', text: '#FFF' }, // Bronze
};

const FILTERS = [
  { id: 'all', label: 'All Time', icon: 'infinite-outline' },
  { id: 'monthly', label: 'Month', icon: 'calendar-outline' },
  { id: 'weekly', label: 'Week', icon: 'today-outline' },
];

// Animated skeleton placeholder
const SkeletonCommunityItem = () => {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[skeletonStyles.row, { opacity: pulse }]}>
      <View style={skeletonStyles.rank} />
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.lines}>
        <View style={skeletonStyles.line1} />
        <View style={skeletonStyles.line2} />
      </View>
      <View style={skeletonStyles.badge} />
    </Animated.View>
  );
};

const SkeletonCommunityLoading = () => (
  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
    {[...Array(8)].map((_, i) => <SkeletonCommunityItem key={i} />)}
  </View>
);

const skeletonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2F3A', borderRadius: 16, padding: 14, marginBottom: 10 },
  rank: { width: 32, height: 18, borderRadius: 4, backgroundColor: '#353B48', marginRight: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#353B48', marginRight: 14 },
  lines: { flex: 1, gap: 7 },
  line1: { height: 14, borderRadius: 6, backgroundColor: '#353B48', width: '65%' },
  line2: { height: 11, borderRadius: 6, backgroundColor: '#353B48', width: '42%' },
  badge: { width: 52, height: 34, borderRadius: 20, backgroundColor: '#353B48' },
});

const getCommunityRankColor = (rank) => {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  if (rank <= 10) return '#FF8C42';
  return '#8B9099';
};

function CommunityLeaderboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { communityId, communityData } = route.params || {};
  
  const [loading, setLoading] = useState(true); // Initial full page load
  const [contentLoading, setContentLoading] = useState(false); // For filter changes - only content area
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRankData, setUserRankData] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState(null);
  
  // Animation
  const scrollY = useRef(new Animated.Value(0)).current;

  // Per-filter cache to avoid redundant Firestore fetches
  const leaderboardCache = useRef({});

  // Animation: sliding filter indicator + list fade-in
  const filterIndicatorAnim = useRef(new Animated.Value(0)).current;
  const listFadeAnim = useRef(new Animated.Value(0)).current;

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    
    return () => unsubscribe();
  }, []);

  // Get current user
  useEffect(() => {
    const auth = getAuth();
    if (auth.currentUser) {
      setCurrentUser({
        id: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
      });
    }
  }, []);

  // Fetch leaderboard data
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!communityId) return;

    setError(null);

    // Return cached data immediately if available and not a manual refresh
    if (!forceRefresh && leaderboardCache.current[activeFilter]) {
      const cached = leaderboardCache.current[activeFilter];
      setLeaderboard(cached.leaderboard);
      setUserRankData(cached.userRankData);
      setLoading(false);
      setContentLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [leaderboardData, userRank] = await Promise.all([
        getCommunityLeaderboard(db, communityId, activeFilter, 50),
        currentUser?.id ? getUserRank(db, communityId, currentUser.id, activeFilter) : null,
      ]);

      setLeaderboard(leaderboardData || []);
      setUserRankData(userRank);
      leaderboardCache.current[activeFilter] = { leaderboard: leaderboardData || [], userRankData: userRank };
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard. Please try again.');
      setLeaderboard([]);
    } finally {
      setLoading(false);
      setContentLoading(false);
      setRefreshing(false);
    }
  }, [communityId, currentUser?.id, activeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    // Invalidate cache so a full re-fetch happens
    leaderboardCache.current = {};
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const handleFilterChange = (filterId) => {
    if (filterId !== activeFilter) {
      const toIndex = FILTERS.findIndex(f => f.id === filterId);
      Animated.spring(filterIndicatorAnim, {
        toValue: toIndex,
        useNativeDriver: true,
        tension: 68,
        friction: 10,
      }).start();
      setActiveFilter(filterId);
      // Only show spinner if we don't already have cached data for this filter
      if (!leaderboardCache.current[filterId]) {
        setContentLoading(true);
      }
    }
  };

  // Fade list in whenever leaderboard data changes
  useEffect(() => {
    if (leaderboard.length > 0) {
      listFadeAnim.setValue(0);
      Animated.timing(listFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [leaderboard]);

  // Render filter tabs
  const renderFilters = () => {
    const TAB_WIDTH = (SCREEN_WIDTH - 32 - 8) / FILTERS.length;
    return (
      <View style={styles.filterContainer}>
        <Animated.View
          style={[
            styles.filterIndicator,
            {
              width: TAB_WIDTH,
              transform: [{
                translateX: filterIndicatorAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [0, TAB_WIDTH, TAB_WIDTH * 2],
                }),
              }],
            },
          ]}
        />
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={styles.filterButton}
              onPress={() => handleFilterChange(filter.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={filter.icon}
                size={14}
                color={isActive ? '#fff' : '#8B9099'}
                style={{ marginBottom: 2 }}
              />
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Render user rank card
  const renderUserRankCard = () => {
    if (!userRankData || !userRankData.rank) return null;

    const { rank, totalUsers, points, userData } = userRankData;
    const badge = userData?.badge || getUserBadge(points || 0);

    return (
      <LinearGradient
        colors={['#7C3AED25', '#E91E8C10', '#2A2F3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.userRankCard}>
        <View style={styles.userRankHeader}>
          <Text style={styles.userRankTitle}>Your Ranking</Text>
          <View style={styles.userRankBadge}>
            <Text style={styles.badgeIcon}>{badge?.icon || '🌱'}</Text>
            <Text style={styles.badgeName}>{badge?.name || 'Newbie'}</Text>
          </View>
        </View>
        <View style={styles.userRankStats}>
          <View style={styles.userRankStat}>
            <Text style={styles.userRankValue}>#{rank}</Text>
            <Text style={styles.userRankLabel}>Rank</Text>
          </View>
          <View style={styles.userRankDivider} />
          <View style={styles.userRankStat}>
            <Text style={styles.userRankValue}>{points || 0}</Text>
            <Text style={styles.userRankLabel}>Points</Text>
          </View>
          <View style={styles.userRankDivider} />
          <View style={styles.userRankStat}>
            <Text style={styles.userRankValue}>{userData?.currentStreak || 0}</Text>
            <Text style={styles.userRankLabel}>Streak 🔥</Text>
          </View>
          <View style={styles.userRankDivider} />
          <View style={styles.userRankStat}>
            <Text style={styles.userRankValue}>{totalUsers}</Text>
            <Text style={styles.userRankLabel}>Total</Text>
          </View>
        </View>
      </LinearGradient>
    );
  };

  // Render top 3 podium - redesigned layout
  const renderPodium = () => {
    if (leaderboard.length === 0) return null;
    
    // Handle cases with less than 3 users
    const first = leaderboard[0] || null;
    const second = leaderboard[1] || null;
    const third = leaderboard[2] || null;
    
    const renderPodiumUser = (user, rank, size = 'medium') => {
      if (!user) {
        // Empty placeholder for missing podium positions
        return (
          <View style={styles.podiumUserContainer}>
            <View style={[styles.emptyPodiumSlot, { opacity: 0.3 }]}>
              <Ionicons name="person-outline" size={32} color={COLORS.dim} />
              <Text style={styles.emptyPodiumText}>-</Text>
            </View>
          </View>
        );
      }
      
      const avatarSize = rank === 1 ? 100 : 75;
      const ringSize = avatarSize + 8;
      const medalSize = rank === 1 ? 28 : 24;
      const isFirst = rank === 1;
      
      return (
        <View style={[styles.podiumUserContainer, isFirst && styles.podiumFirstContainer]}>
          {/* Crown for #1 */}
          {isFirst && (
            <View style={styles.crownContainer}>
              <MaterialCommunityIcons name="crown" size={32} color={COLORS.gold} />
            </View>
          )}
          
          {/* Avatar with colored ring */}
          <View style={[
            styles.avatarRing,
            { width: ringSize, height: ringSize, borderColor: RANK_COLORS[rank] },
            isFirst && styles.avatarRingFirst,
          ]}>
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={[styles.podiumAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
              />
            ) : (
              <View style={[styles.podiumAvatar, styles.avatarFallback, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                <Ionicons name="person" size={avatarSize * 0.5} color={COLORS.dim} />
              </View>
            )}
          </View>
          
          {/* Medal badge */}
          <View style={[
            styles.medalBadge,
            { backgroundColor: MEDAL_COLORS[rank].bg },
            isFirst && styles.medalBadgeFirst,
          ]}>
            <Text style={[styles.medalText, { color: MEDAL_COLORS[rank].text }]}>{rank}</Text>
          </View>
          
          {/* Username */}
          <Text style={styles.podiumName} numberOfLines={1}>
            {user?.displayName || 'User'}
          </Text>
          
          {/* Streak days */}
          <Text style={[styles.podiumStreak, isFirst && styles.podiumStreakFirst]}>
            {user?.currentStreak || 0} days
          </Text>
        </View>
      );
    };
    
    return (
      <View style={styles.podiumContainer}>
        {/* Second Place - Left */}
        <View style={styles.podiumPosition}>
          {renderPodiumUser(second, 2)}
        </View>

        {/* First Place - Center (larger) */}
        <View style={[styles.podiumPosition, styles.podiumCenterPosition]}>
          {renderPodiumUser(first, 1)}
        </View>

        {/* Third Place - Right */}
        <View style={styles.podiumPosition}>
          {renderPodiumUser(third, 3)}
        </View>
      </View>
    );
  };

  // Render leaderboard item - redesigned for #4 and below
  const renderLeaderboardItem = ({ item, index }) => {
    if (index < 3) return null; // Top 3 shown in podium

    const isCurrentUser = currentUser?.id === item.userId;
    const badge = item.badge || getUserBadge(item.points || 0);
    const rank = item.rank || index + 1;
    const rankColor = getCommunityRankColor(rank);

    return (
      <Animated.View style={{ opacity: listFadeAnim }}>
      <View style={[
        styles.leaderboardItem,
        isCurrentUser && styles.leaderboardItemCurrentUser,
      ]}>
        {/* Rank Number */}
        <View style={styles.rankContainer}>
          <Text style={[styles.rankHash, { color: rankColor }]}>#</Text>
          <Text style={[styles.rankNumber, { color: rankColor }]}>{rank}</Text>
        </View>

        {/* Avatar */}
        {item.photoURL ? (
          <Image
            source={{ uri: item.photoURL }}
            style={styles.listAvatar}
          />
        ) : (
          <View style={[styles.listAvatar, styles.avatarFallback]}>
            <Ionicons name="person" size={20} color={COLORS.dim} />
          </View>
        )}

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isCurrentUser && styles.userNameCurrentUser]} numberOfLines={1}>
            {item.displayName || 'User'}
          </Text>
          <View style={styles.userStatsRow}>
            <Ionicons name="star-outline" size={12} color={COLORS.dim} />
            <Text style={styles.levelText}>Lvl {badge.tier + 1}</Text>
            <Ionicons name="trending-up" size={12} color={COLORS.dim} style={{ marginLeft: 8 }} />
            <Text style={styles.pointsSmallText}>{item.points || 0} pts</Text>
          </View>
        </View>

        {/* Streak Fire Badge */}
        <View style={styles.streakBadge}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={styles.streakNumber}>{item.currentStreak || 0}</Text>
        </View>
      </View>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="trophy" size={24} color={COLORS.magenta} />
            <Text style={styles.headerTitle}>Leaderboard</Text>
          </View>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <SkeletonCommunityLoading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
          <Text style={styles.offlineBannerText}>You're offline. Showing cached data.</Text>
        </View>
      )}

      {/* Header - Simplified dark style */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="trophy" size={24} color={COLORS.magenta} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Filter Tabs */}
      {renderFilters()}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      {!error && (
        <Animated.ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.magenta} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* Content Loading State - shows when filter changes */}
          {contentLoading ? (
            <SkeletonCommunityLoading />
          ) : (
            <>
              {/* User Rank Card */}
              {renderUserRankCard()}

              {/* Podium - Top 3 (or less) */}
              {leaderboard.length > 0 && renderPodium()}

              {/* Leaderboard List - #4 and below */}
              <View style={styles.leaderboardContainer}>
                {leaderboard.length > 3 ? (
                  leaderboard.slice(3).map((item, index) => (
                    <View key={item.id || item.userId}>
                      {renderLeaderboardItem({ item: { ...item, rank: index + 4 }, index: index + 3 })}
                    </View>
                  ))
                ) : leaderboard.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={64} color={COLORS.dim} />
                    <Text style={styles.emptyText}>No check-ins yet</Text>
                    <Text style={styles.emptySubtext}>Be the first to check in and claim the top spot!</Text>
                    <TouchableOpacity
                      style={styles.checkInPromptButton}
                      onPress={() => navigation.navigate('CommunityCheckIn', { communityId, communityData })}
                    >
                      <Text style={styles.checkInPromptText}>Check In Now</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {/* Bottom spacing */}
              <View style={{ height: 40 }} />
            </>
          )}
        </Animated.ScrollView>
      )}
    </View>
  );
}

export default function CommunityLeaderboardScreenWithBoundary(props) {
  return (
    <ErrorBoundary>
      <CommunityLeaderboardScreen {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.dim,
    marginTop: 12,
    fontSize: 14,
  },
  contentLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  
  // Header – paddingTop driven by safe-area insets at runtime
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  headerRightPlaceholder: {
    width: 44,
  },
  
  // Offline Banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  
  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#2A2F3A',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  filterIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 2,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B9099',
  },
  filterTextActive: {
    color: '#fff',
  },
  
  // User Rank Card
  userRankCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7C3AED50',
    overflow: 'hidden',
  },
  userRankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userRankTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userRankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  userRankStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  userRankStat: {
    alignItems: 'center',
  },
  userRankValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.purple,
  },
  userRankLabel: {
    fontSize: 12,
    color: COLORS.dim,
    marginTop: 4,
  },
  userRankDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.dim,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  
  // Podium Styles
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 30,
  },
  podiumPosition: {
    flex: 1,
    alignItems: 'center',
  },
  podiumCenterPosition: {
    marginTop: -20, // Raise center position up
  },
  podiumUserContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  emptyPodiumSlot: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.card2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyPodiumText: {
    fontSize: 12,
    color: COLORS.dim,
    marginTop: 4,
  },
  podiumFirstContainer: {
    // First place container styles
  },
  crownContainer: {
    marginBottom: 8,
  },
  avatarRing: {
    borderWidth: 3,
    borderRadius: 100,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRingFirst: {
    borderWidth: 4,
  },
  podiumAvatar: {
    backgroundColor: COLORS.card,
  },
  medalBadge: {
    position: 'absolute',
    bottom: 45,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  medalBadgeFirst: {
    width: 28,
    height: 28,
    borderRadius: 14,
    bottom: 55,
  },
  medalText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  podiumName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 10,
    maxWidth: 100,
    textAlign: 'center',
  },
  podiumStreak: {
    fontSize: 13,
    color: COLORS.dim,
    marginTop: 2,
  },
  podiumStreakFirst: {
    color: COLORS.magenta,
    fontWeight: '600',
  },
  
  // Leaderboard List
  leaderboardContainer: {
    paddingHorizontal: 16,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  leaderboardItemCurrentUser: {
    backgroundColor: COLORS.purple + '30',
    borderWidth: 1,
    borderColor: COLORS.purple,
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 14,
    minWidth: 35,
  },
  rankHash: {
    fontSize: 14,
    color: COLORS.dim,
    fontWeight: '500',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dim,
  },
  listAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
    backgroundColor: COLORS.card2,
  },
  avatarFallback: {
    backgroundColor: COLORS.card2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userNameCurrentUser: {
    color: COLORS.purple,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  levelText: {
    fontSize: 12,
    color: COLORS.dim,
    marginLeft: 4,
  },
  pointsSmallText: {
    fontSize: 12,
    color: COLORS.dim,
    marginLeft: 4,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orange + '25',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fireEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  streakNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.orange,
  },
  
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.dim,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  checkInPromptButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  checkInPromptText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
  },
});
