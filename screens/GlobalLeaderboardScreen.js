// screens/GlobalLeaderboardScreen.js
// Global leaderboard screen showing app-wide user rankings

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, getDocs, getDoc, doc, where, documentId } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#0B0B0E',
  card: '#17171C',
  card2: '#1E1E24',
  border: '#2A2A30',
  text: '#FFFFFF',
  dim: '#8B9099',
  purple: '#8B2EF0',
  magenta: '#E91E8C',
  cyan: '#0EE7B7',
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
  { id: 'engagement', label: 'Engagement' },
  { id: 'coins', label: 'Coins' },
  { id: 'diamonds', label: 'Diamonds' },
  { id: 'followers', label: 'Followers' },
];

export default function GlobalLeaderboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRankData, setUserRankData] = useState(null);
  const [activeFilter, setActiveFilter] = useState('engagement');
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  
  // Animation
  const scrollY = useRef(new Animated.Value(0)).current;

  // Get current user - use state to track when user is loaded
  const [userLoaded, setUserLoaded] = useState(false);
  
  useEffect(() => {
    const auth = getAuth();
    if (auth.currentUser) {
      setCurrentUser({
        id: auth.currentUser.uid,
        email: auth.currentUser.email,
      });
    }
    setUserLoaded(true);
  }, []);

  // Fetch leaderboard data
  const fetchData = useCallback(async () => {
    // Wait for user authentication to be checked
    if (!userLoaded) return;
    
    setError(null);
    
    try {
      // Fetch all users - users collection is readable by authenticated users
      const usersQuery = query(collection(db, 'users'), limit(200));
      const usersSnapshot = await getDocs(usersQuery);
      
      // Check if current user is in the query results
      let currentUserInResults = false;
      if (currentUser?.id) {
        currentUserInResults = usersSnapshot.docs.some(doc => doc.id === currentUser.id);
      }
      
      // If current user is not in results, fetch their data separately
      let currentUserDoc = null;
      let currentUserWallet = null;
      
      if (currentUser?.id && !currentUserInResults) {
        try {
          const userDocRef = doc(db, 'users', currentUser.id);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            currentUserDoc = { id: currentUser.id, data: userDocSnap.data() };
          }
          
          // Also fetch their wallet
          try {
            const walletDocRef = doc(db, 'wallets', currentUser.id);
            const walletDocSnap = await getDoc(walletDocRef);
            if (walletDocSnap.exists()) {
              currentUserWallet = walletDocSnap.data();
            }
          } catch (e) {
            console.log('Wallet read failed for current user');
          }
        } catch (e) {
          console.log('Failed to fetch current user doc:', e.message);
        }
      }
      
      // Batch-fetch wallets using documentId() in-queries (10 per batch)
      const allUserIds = usersSnapshot.docs.map(d => d.id);
      const walletMap = {};
      const BATCH_SIZE = 10;
      for (let i = 0; i < allUserIds.length; i += BATCH_SIZE) {
        const batch = allUserIds.slice(i, i + BATCH_SIZE);
        try {
          const walletQuery = query(
            collection(db, 'wallets'),
            where(documentId(), 'in', batch)
          );
          const walletSnap = await getDocs(walletQuery);
          walletSnap.docs.forEach(wDoc => {
            walletMap[wDoc.id] = wDoc.data();
          });
        } catch (e) {
          console.log(`Wallet batch read failed (offset ${i}):`, e.message);
        }
      }
      
      // Add current user's wallet to map if fetched separately
      if (currentUser?.id && currentUserWallet) {
        walletMap[currentUser.id] = currentUserWallet;
      }
      
      // Helper function to calculate user value and build data object
      const processUserData = (userId, userData, wallet) => {
        // Get followers count (check multiple possible field names)
        const followersCount = userData.followersCount || userData.followers_count || userData.followers || 0;
        
        // Get activity stats
        const postsCount = userData.postsCount || userData.totalPosts || userData.posts_count || 0;
        const likesReceived = userData.likesReceived || userData.totalLikes || userData.likes_received || 0;
        const commentsReceived = userData.commentsReceived || userData.comments_received || 0;
        
        // Get coins/diamonds from wallet or user doc
        const userCoins = wallet?.coins || wallet?.balance || userData.coins || userData.totalCoins || 0;
        const userDiamonds = wallet?.diamonds || userData.diamonds || userData.totalDiamonds || 0;
        
        // Calculate value based on active filter
        let value = 0;
        
        switch (activeFilter) {
          case 'coins':
            value = userCoins;
            break;
          case 'diamonds':
            value = userDiamonds;
            break;
          case 'followers':
            value = followersCount;
            break;
          case 'engagement':
          default:
            // Engagement formula: posts * 10 + likes * 2 + comments * 5 + followers * 3
            value = (postsCount * 10) + (likesReceived * 2) + (commentsReceived * 5) + (followersCount * 3);
            break;
        }
        
        // Build user display name - check all possible field names
        const displayName = userData.displayName
          || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() 
          || userData.username 
          || userData.handle 
          || userData.name 
          || 'User';
        
        return {
          id: userId,
          userId: userId,
          displayName: displayName,
          photoURL: userData.profileImage || userData.profilePicture || userData.avatar || userData.photoURL || null,
          value: value,
          coins: userCoins,
          diamonds: userDiamonds,
          followers: followersCount,
          postsCount: postsCount,
          likesReceived: likesReceived,
          commentsReceived: commentsReceived,
          verified: userData.verified || userData.isVerified || false,
          isCurrentUser: userId === currentUser?.id,
        };
      };
      
      const leaderboardData = [];
      
      // Process each user with their wallet data
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const wallet = walletMap[userId];
        
        leaderboardData.push(processUserData(userId, userData, wallet));
      }
      
      // Add current user if they weren't in the initial query results
      if (currentUserDoc && !currentUserInResults) {
        leaderboardData.push(processUserData(
          currentUserDoc.id, 
          currentUserDoc.data, 
          walletMap[currentUserDoc.id]
        ));
      }
      
      // Sort ALL users by value (descending) to calculate accurate ranks
      leaderboardData.sort((a, b) => b.value - a.value);
      
      // Filter out users with 0 value for display, but keep track of all for rank calculation
      const activeUsers = leaderboardData.filter(user => user.value > 0);
      
      // Assign ranks based on position in sorted activeUsers list
      activeUsers.forEach((item, index) => {
        item.rank = index + 1;
      });
      
      // Find current user in the active users list
      const currentUserEntry = currentUser?.id 
        ? activeUsers.find(u => u.userId === currentUser.id)
        : null;
      
      // Get top 50 for display
      let displayData = activeUsers.slice(0, 50);
      
      // If current user is ranked but not in top 50, add them at the end
      if (currentUserEntry && currentUserEntry.rank > 50) {
        // Check if current user is already in display (should not be if rank > 50)
        const isInDisplay = displayData.some(u => u.userId === currentUser.id);
        if (!isInDisplay) {
          displayData.push({
            ...currentUserEntry,
            isCurrentUserOutsideTop: true,
          });
        }
      }
      
      setLeaderboard(displayData);
      
      // Set current user rank data
      if (currentUser?.id) {
        if (currentUserEntry) {
          setUserRankData({
            rank: currentUserEntry.rank,
            value: currentUserEntry.value,
            totalUsers: activeUsers.length,
            userData: {
              displayName: currentUserEntry.displayName,
              photoURL: currentUserEntry.photoURL,
              coins: currentUserEntry.coins,
              diamonds: currentUserEntry.diamonds,
              followers: currentUserEntry.followers,
              postsCount: currentUserEntry.postsCount,
            },
          });
        } else {
          // User exists but has 0 value - still show their rank info
          const userInAllData = leaderboardData.find(u => u.userId === currentUser.id);
          if (userInAllData) {
            setUserRankData({
              rank: 'Unranked',
              value: 0,
              totalUsers: activeUsers.length,
              userData: {
                displayName: userInAllData.displayName,
                photoURL: userInAllData.photoURL,
                coins: userInAllData.coins,
                diamonds: userInAllData.diamonds,
                followers: userInAllData.followers,
                postsCount: userInAllData.postsCount,
              },
            });
          } else {
            setUserRankData(null);
          }
        }
      } else {
        setUserRankData(null);
      }
    } catch (err) {
      console.error('Error fetching global leaderboard:', err);
      setError('Failed to load leaderboard. Please try again.');
      setLeaderboard([]);
    } finally {
      setLoading(false);
      setContentLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, activeFilter, userLoaded]);

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
      setContentLoading(true);
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
    if (!userRankData) return null;
    
    const { rank, value, totalUsers, userData } = userRankData;
    const valueIcon = getValueIcon();
    
    return (
      <View style={styles.userRankCard}>
        <View style={styles.userRankHeader}>
          <Text style={styles.userRankTitle}>Your Ranking</Text>
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{FILTERS.find(f => f.id === activeFilter)?.label || 'Engagement'}</Text>
          </View>
        </View>
        
        {/* User Profile Section */}
        <View style={styles.userProfileSection}>
          {userData?.photoURL ? (
            <Image source={{ uri: userData.photoURL }} style={styles.userRankAvatar} />
          ) : (
            <View style={[styles.userRankAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={32} color={COLORS.dim} />
            </View>
          )}
          <View style={styles.userProfileInfo}>
            <Text style={styles.userProfileName} numberOfLines={1}>{userData?.displayName || 'You'}</Text>
            <View style={styles.userProfileStats}>
              <Ionicons name="trophy" size={14} color={COLORS.purple} />
              <Text style={styles.userProfileRank}>
                Rank #{rank !== 'Unranked' ? rank : '-'} {rank !== 'Unranked' && `of ${totalUsers}`}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Stats Section */}
        <View style={styles.userRankStatsContainer}>
          <View style={styles.userRankStat}>
            <View style={styles.userRankStatIcon}>
              {typeof valueIcon === 'string' ? (
                <Ionicons name={valueIcon} size={20} color={COLORS.purple} />
              ) : (
                <Image source={valueIcon} style={styles.valueIconLarge} />
              )}
            </View>
            <Text style={styles.userRankValue}>{formatValue(value)}</Text>
            <Text style={styles.userRankLabel}>{getValueLabel()}</Text>
          </View>
          
          {activeFilter === 'engagement' && (
            <>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Ionicons name="newspaper-outline" size={20} color={COLORS.cyan} />
                <Text style={styles.userRankValue}>{userData?.postsCount || 0}</Text>
                <Text style={styles.userRankLabel}>Posts</Text>
              </View>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Ionicons name="people-outline" size={20} color={COLORS.green} />
                <Text style={styles.userRankValue}>{formatValue(userData?.followers || 0)}</Text>
                <Text style={styles.userRankLabel}>Followers</Text>
              </View>
            </>
          )}
          
          {activeFilter === 'coins' && userData && (
            <>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Image source={require('../assets/diamond1.png')} style={styles.valueIconLarge} />
                <Text style={styles.userRankValue}>{formatValue(userData.diamonds || 0)}</Text>
                <Text style={styles.userRankLabel}>Diamonds</Text>
              </View>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Ionicons name="people-outline" size={20} color={COLORS.green} />
                <Text style={styles.userRankValue}>{formatValue(userData.followers || 0)}</Text>
                <Text style={styles.userRankLabel}>Followers</Text>
              </View>
            </>
          )}
          
          {activeFilter === 'diamonds' && userData && (
            <>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Image source={require('../assets/goldicon.png')} style={styles.valueIconLarge} />
                <Text style={styles.userRankValue}>{formatValue(userData.coins || 0)}</Text>
                <Text style={styles.userRankLabel}>Coins</Text>
              </View>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Ionicons name="people-outline" size={20} color={COLORS.green} />
                <Text style={styles.userRankValue}>{formatValue(userData.followers || 0)}</Text>
                <Text style={styles.userRankLabel}>Followers</Text>
              </View>
            </>
          )}
          
          {activeFilter === 'followers' && userData && (
            <>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Image source={require('../assets/goldicon.png')} style={styles.valueIconLarge} />
                <Text style={styles.userRankValue}>{formatValue(userData.coins || 0)}</Text>
                <Text style={styles.userRankLabel}>Coins</Text>
              </View>
              <View style={styles.userRankDivider} />
              <View style={styles.userRankStat}>
                <Ionicons name="newspaper-outline" size={20} color={COLORS.cyan} />
                <Text style={styles.userRankValue}>{userData.postsCount || 0}</Text>
                <Text style={styles.userRankLabel}>Posts</Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const formatValue = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val;
  };

  const getValueLabel = () => {
    switch (activeFilter) {
      case 'coins': return 'Coins';
      case 'diamonds': return 'Diamonds';
      case 'followers': return 'Followers';
      case 'engagement':
      default: return 'Score';
    }
  };

  const getValueIcon = () => {
    switch (activeFilter) {
      case 'coins': return require('../assets/goldicon.png');
      case 'diamonds': return require('../assets/diamond1.png');
      case 'followers': return 'people';
      case 'engagement':
      default: return 'trending-up';
    }
  };

  // Render top 3 podium
  const renderPodium = () => {
    if (leaderboard.length === 0) return null;
    
    const first = leaderboard[0] || null;
    const second = leaderboard[1] || null;
    const third = leaderboard[2] || null;
    
    const renderPodiumUser = (user, rank) => {
      if (!user) {
        return (
          <View style={styles.podiumUserContainer}>
            <View style={[styles.emptyPodiumSlot, { opacity: 0.3 }]}>
              <Ionicons name="person-outline" size={32} color={COLORS.dim} />
            </View>
          </View>
        );
      }
      
      const avatarSize = rank === 1 ? 100 : 75;
      const ringSize = avatarSize + 8;
      const isFirst = rank === 1;
      
      return (
        <TouchableOpacity 
          style={[styles.podiumUserContainer, isFirst && styles.podiumFirstContainer]}
          onPress={() => navigation.navigate('Profile', { userId: user.userId })}
          activeOpacity={0.8}
        >
          {isFirst && (
            <View style={styles.crownContainer}>
              <MaterialCommunityIcons name="crown" size={32} color={COLORS.gold} />
            </View>
          )}
          
          <View style={[
            styles.avatarRing,
            { width: ringSize, height: ringSize, borderColor: RANK_COLORS[rank] },
            isFirst && styles.avatarRingFirst,
          ]}>
            {user.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={[styles.podiumAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
              />
            ) : (
              <View style={[styles.podiumAvatar, styles.avatarPlaceholder, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                <Ionicons name="person" size={avatarSize * 0.5} color={COLORS.dim} />
              </View>
            )}
          </View>
          
          <View style={[
            styles.medalBadge,
            { backgroundColor: MEDAL_COLORS[rank].bg },
            isFirst && styles.medalBadgeFirst,
          ]}>
            <Text style={[styles.medalText, { color: MEDAL_COLORS[rank].text }]}>{rank}</Text>
          </View>
          
          <View style={styles.podiumNameContainer}>
            <Text style={styles.podiumName} numberOfLines={1}>
              {user.displayName}
            </Text>
            {user.verified && (
              <Image source={require('../assets/starimage.png')} style={styles.verifiedBadge} />
            )}
          </View>
          
          <View style={styles.podiumValueContainer}>
            {activeFilter === 'coins' && (
              <Image source={require('../assets/goldicon.png')} style={styles.podiumValueIcon} />
            )}
            {activeFilter === 'diamonds' && (
              <Image source={require('../assets/diamond1.png')} style={styles.podiumValueIcon} />
            )}
            {activeFilter === 'followers' && (
              <Ionicons name="people" size={14} color={isFirst ? COLORS.gold : COLORS.dim} />
            )}
            {activeFilter === 'engagement' && (
              <Ionicons name="trending-up" size={14} color={isFirst ? COLORS.gold : COLORS.dim} />
            )}
            <Text style={[styles.podiumValue, isFirst && styles.podiumValueFirst]}>
              {formatValue(user.value)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    };
    
    return (
      <View style={styles.podiumContainer}>
        <View style={styles.podiumPosition}>
          {renderPodiumUser(second, 2)}
        </View>
        <View style={[styles.podiumPosition, styles.podiumCenterPosition]}>
          {renderPodiumUser(first, 1)}
        </View>
        <View style={styles.podiumPosition}>
          {renderPodiumUser(third, 3)}
        </View>
      </View>
    );
  };

  // Get secondary stats text based on filter
  const getSecondaryStats = (item) => {
    switch (activeFilter) {
      case 'coins':
        return (
          <>
            <Image source={require('../assets/diamond1.png')} style={{ width: 12, height: 12 }} />
            <Text style={styles.levelText}>{formatValue(item.diamonds)} diamonds</Text>
            <Ionicons name="people-outline" size={12} color={COLORS.dim} style={{ marginLeft: 8 }} />
            <Text style={styles.levelText}>{formatValue(item.followers)}</Text>
          </>
        );
      case 'diamonds':
        return (
          <>
            <Image source={require('../assets/goldicon.png')} style={{ width: 12, height: 12 }} />
            <Text style={styles.levelText}>{formatValue(item.coins)} coins</Text>
            <Ionicons name="people-outline" size={12} color={COLORS.dim} style={{ marginLeft: 8 }} />
            <Text style={styles.levelText}>{formatValue(item.followers)}</Text>
          </>
        );
      case 'followers':
        return (
          <>
            <Ionicons name="newspaper-outline" size={12} color={COLORS.dim} />
            <Text style={styles.levelText}>{item.postsCount || 0} posts</Text>
            <Ionicons name="heart-outline" size={12} color={COLORS.dim} style={{ marginLeft: 8 }} />
            <Text style={styles.levelText}>{formatValue(item.likesReceived)} likes</Text>
          </>
        );
      case 'engagement':
      default:
        return (
          <>
            <Ionicons name="newspaper-outline" size={12} color={COLORS.dim} />
            <Text style={styles.levelText}>{item.postsCount || 0} posts</Text>
            <Ionicons name="people-outline" size={12} color={COLORS.dim} style={{ marginLeft: 8 }} />
            <Text style={styles.levelText}>{formatValue(item.followers)} followers</Text>
          </>
        );
    }
  };

  // Render leaderboard item
  const renderLeaderboardItem = ({ item, index }) => {
    if (index < 3) return null;
    
    const isCurrentUser = currentUser?.id === item.userId;
    const rank = item.rank || index + 1;
    const valueIcon = getValueIcon();
    
    return (
      <TouchableOpacity
        style={[
          styles.leaderboardItem,
          isCurrentUser && styles.leaderboardItemCurrentUser,
        ]}
        onPress={() => navigation.navigate('Profile', { userId: item.userId })}
        activeOpacity={0.8}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rankHash}>#</Text>
          <Text style={styles.rankNumber}>{rank}</Text>
        </View>

        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.listAvatar} />
        ) : (
          <View style={[styles.listAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color={COLORS.dim} />
          </View>
        )}

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, isCurrentUser && styles.userNameCurrentUser]} numberOfLines={1}>
              {item.displayName}
            </Text>
            {item.verified && (
              <Image source={require('../assets/starimage.png')} style={styles.verifiedBadgeSmall} />
            )}
          </View>
          <View style={styles.userStatsRow}>
            {getSecondaryStats(item)}
          </View>
        </View>

        <View style={styles.valueBadge}>
          {typeof valueIcon === 'string' ? (
            <Ionicons name={valueIcon} size={18} color={COLORS.purple} />
          ) : (
            <Image source={valueIcon} style={styles.valueIcon} />
          )}
          <Text style={styles.valueText}>{formatValue(item.value)}</Text>
        </View>
      </TouchableOpacity>
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
      {/* Header */}
      <LinearGradient
        colors={['#0EE7B7', '#8A2BE2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 6 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="trophy" size={28} color="#fff" />
            <Text style={styles.headerTitle}>Global Leaderboard</Text>
          </View>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </LinearGradient>

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {contentLoading ? (
            <View style={styles.contentLoadingContainer}>
              <ActivityIndicator size="large" color={COLORS.purple} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              {renderUserRankCard()}
              {leaderboard.length > 0 && renderPodium()}

              <View style={styles.leaderboardContainer}>
                {leaderboard.length > 3 ? (
                  leaderboard.slice(3).map((item, index) => {
                    // Show separator before current user if they're outside top 50
                    const showSeparator = item.isCurrentUserOutsideTop;
                    
                    return (
                      <View key={item.id || item.userId}>
                        {showSeparator && (
                          <View style={styles.yourRankSeparator}>
                            <View style={styles.separatorLine} />
                            <Text style={styles.separatorText}>Your Position</Text>
                            <View style={styles.separatorLine} />
                          </View>
                        )}
                        {renderLeaderboardItem({ item, index: index + 3 })}
                      </View>
                    );
                  })
                ) : leaderboard.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={64} color={COLORS.dim} />
                    <Text style={styles.emptyText}>No data yet</Text>
                    <Text style={styles.emptySubtext}>Start engaging to climb the leaderboard!</Text>
                  </View>
                ) : null}
              </View>

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
  headerGradient: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  
  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
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
    fontSize: 12,
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
    marginBottom: 12,
  },
  userRankTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  filterBadge: {
    backgroundColor: COLORS.card2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  userProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userRankAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  userProfileInfo: {
    flex: 1,
  },
  userProfileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userProfileStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userProfileRank: {
    fontSize: 13,
    color: COLORS.dim,
    marginLeft: 4,
  },
  userRankStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  userRankStat: {
    alignItems: 'center',
    flex: 1,
  },
  userRankStatIcon: {
    marginBottom: 4,
  },
  userRankValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.purple,
    marginTop: 4,
  },
  userRankLabel: {
    fontSize: 11,
    color: COLORS.dim,
    marginTop: 2,
  },
  valueIconLarge: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  userRankDivider: {
    width: 1,
    height: 40,
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
    marginTop: -20,
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
  podiumFirstContainer: {
    // First place styles
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
  avatarPlaceholder: {
    backgroundColor: COLORS.card2,
    justifyContent: 'center',
    alignItems: 'center',
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
  podiumNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  podiumName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    maxWidth: 90,
    textAlign: 'center',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  podiumValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  podiumValueIcon: {
    width: 14,
    height: 14,
  },
  podiumValue: {
    fontSize: 13,
    color: COLORS.dim,
    marginTop: 2,
  },
  podiumValueFirst: {
    color: COLORS.gold,
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
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userNameCurrentUser: {
    color: COLORS.purple,
  },
  verifiedBadgeSmall: {
    width: 14,
    height: 14,
    marginLeft: 4,
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
  valueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.purple + '25',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  valueIcon: {
    width: 18,
    height: 18,
    marginRight: 4,
  },
  valueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.purple,
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
  
  // Your rank separator (for users outside top 50)
  yourRankSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.purple + '40',
  },
  separatorText: {
    color: COLORS.purple,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
