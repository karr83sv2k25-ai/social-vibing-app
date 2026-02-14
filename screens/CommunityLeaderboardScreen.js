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
  { id: 'all', label: 'All Time' },
  { id: 'monthly', label: 'This Month' },
  { id: 'weekly', label: 'This Week' },
];

export default function CommunityLeaderboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
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
  const fetchData = useCallback(async (isFilterChange = false) => {
    if (!communityId) return;
    
    setError(null);
    
    try {
      const [leaderboardData, userRank] = await Promise.all([
        getCommunityLeaderboard(db, communityId, activeFilter, 50),
        currentUser?.id ? getUserRank(db, communityId, currentUser.id, activeFilter) : null,
      ]);
      
      setLeaderboard(leaderboardData || []);
      setUserRankData(userRank);
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
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (filterId) => {
    if (filterId !== activeFilter) {
      setActiveFilter(filterId);
      setContentLoading(true); // Only set content loading, not full page loading
    }
  };

  // Render filter tabs
  const renderFilters = () => (
    <View style={styles.filterContainer}>
      {FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.filterButton,
            activeFilter === filter.id && styles.filterButtonActive,
          ]}
          onPress={() => handleFilterChange(filter.id)}
        >
          <Text
            style={[
              styles.filterText,
              activeFilter === filter.id && styles.filterTextActive,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render user rank card
  const renderUserRankCard = () => {
    if (!userRankData || !userRankData.rank) return null;
    
    const { rank, totalUsers, points, userData } = userRankData;
    const badge = userData?.badge || getUserBadge(points || 0);
    
    return (
      <View style={styles.userRankCard}>
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
      </View>
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
            <Image
              source={{ uri: user?.photoURL || 'https://via.placeholder.com/100' }}
              style={[styles.podiumAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
            />
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
    
    return (
      <View style={[
        styles.leaderboardItem,
        isCurrentUser && styles.leaderboardItemCurrentUser,
      ]}>
        {/* Rank Number */}
        <View style={styles.rankContainer}>
          <Text style={styles.rankHash}>#</Text>
          <Text style={styles.rankNumber}>{rank}</Text>
        </View>

        {/* Avatar */}
        <Image
          source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
          style={styles.listAvatar}
        />

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
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.purple} />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
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
      <View style={styles.header}>
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
            <View style={styles.contentLoadingContainer}>
              <ActivityIndicator size="large" color={COLORS.purple} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
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
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  filterButtonActive: {
    backgroundColor: COLORS.purple,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dim,
  },
  filterTextActive: {
    color: '#fff',
  },
  
  // User Rank Card
  userRankCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.purple + '50',
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
