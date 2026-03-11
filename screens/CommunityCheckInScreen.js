// screens/CommunityCheckInScreen.js
// Daily check-in screen for community with streak tracking and rewards

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { useWallet } from '../context/WalletContext';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  getUserCheckInData,
  checkInToCommunity,
  canCheckInToday,
  getUserLevel,
  getNextLevel,
  formatTimeRemaining,
  POINTS_CONFIG,
  LEVELS,
  LEVEL_IMAGES,
} from '../shared/services/communityCheckInService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#0B0B10',
  card: '#14171C',
  card2: '#1A1F27',
  border: '#232833',
  text: '#EAEAF0',
  dim: '#A2A8B3',
  purple: '#7C3AED',
  blue: '#00BFFF',
  green: '#00FF73',
  gold: '#FFD700',
  red: '#FF4757',
};

function CommunityCheckInScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { communityId, communityData } = route.params || {};
  const walletContext = useWallet();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInData, setCheckInData] = useState(null);
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showLevelsModal, setShowLevelsModal] = useState(false);
  
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  
  // Timer ref to prevent memory leaks
  const timerRef = useRef(null);
  const animationRef = useRef(null);

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    
    // Check initial state
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

  // Fetch check-in data
  const fetchData = useCallback(async () => {
    if (!communityId || !currentUser?.id) return;
    
    try {
      const data = await getUserCheckInData(db, communityId, currentUser.id);
      setCheckInData(data);
      
      const checkStatus = await canCheckInToday(db, communityId, currentUser.id);
      setCanCheckIn(checkStatus.canCheckIn);
      setTimeRemaining(checkStatus.nextRewardIn || 0);
    } catch (error) {
      console.error('Error fetching check-in data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchData();
    }
  }, [currentUser?.id, fetchData]);

  // Countdown timer - fixed memory leak
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (!canCheckIn && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setCanCheckIn(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canCheckIn, timeRemaining]);

  // Glow animation for check-in button - fixed memory leak
  useEffect(() => {
    // Stop any existing animation
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    
    if (canCheckIn) {
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      animationRef.current.start();
    }
    
    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [canCheckIn, glowAnim]);

  // Handle check-in with offline support
  const handleCheckIn = async () => {
    if (!canCheckIn || checkingIn) return;
    
    // Check online status
    if (!isOnline) {
      Alert.alert(
        '📡 No Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setCheckingIn(true);
    
    // Button press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      const result = await checkInToCommunity(db, communityId, currentUser.id, walletContext);
      
      if (result.success) {
        // Success animation
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
        
        // Show success alert
        Alert.alert(
          '🎉 Check-in Successful!',
          `+${result.pointsEarned} Points${result.multiplier > 1 ? ` (${result.multiplier}x bonus!)` : ''}\n` +
          (result.coinsEarned > 0 ? `+${result.coinsEarned} Coins\n` : '') +
          `🔥 Streak: ${result.streak} days\n\n` +
          `${result.badge.name} - Level ${result.badge.level || 1}`,
          [{ text: 'Awesome!', style: 'default' }]
        );
        
        // Refresh data
        await fetchData();
        setCanCheckIn(false);
      } else {
        Alert.alert('Already Checked In', result.message);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const userBadge = checkInData ? getUserLevel(checkInData.totalPoints || 0) : LEVELS[0];
  const nextBadgeInfo = checkInData ? getNextLevel(checkInData.totalPoints || 0) : { nextLevel: LEVELS[1], nextBadge: LEVELS[1], pointsNeeded: 50 };
  const progressToNextBadge = nextBadgeInfo.nextLevel 
    ? ((checkInData?.totalPoints || 0) - (LEVELS.find(b => b.name === userBadge.name)?.minPoints || 0)) / 
      (nextBadgeInfo.nextLevel.minPoints - (LEVELS.find(b => b.name === userBadge.name)?.minPoints || 0)) * 100
    : 100;

  const currentPoints = checkInData?.totalPoints || 0;

  // Render a single level item for the modal
  const renderLevelItem = useCallback(({ item: lvl }) => {
    const isUnlocked = currentPoints >= lvl.minPoints;
    const isCurrent = userBadge.level === lvl.level;

    return (
      <View style={[
        levelsModalStyles.levelRow,
        isCurrent && levelsModalStyles.levelRowCurrent,
        !isUnlocked && levelsModalStyles.levelRowLocked,
      ]}>
        {/* Level number */}
        <View style={[levelsModalStyles.levelNumber, { backgroundColor: isUnlocked ? lvl.color + '30' : COLORS.card2 }]}>
          <Text style={[levelsModalStyles.levelNumberText, { color: isUnlocked ? lvl.color : COLORS.dim }]}>
            {lvl.level}
          </Text>
        </View>

        {/* Badge image */}
        <View style={[levelsModalStyles.levelImageContainer, { borderColor: isUnlocked ? lvl.color : COLORS.border }]}>
          <Image source={lvl.image} style={[levelsModalStyles.levelImage, !isUnlocked && { opacity: 0.35 }]} />
        </View>

        {/* Info */}
        <View style={levelsModalStyles.levelInfo}>
          <View style={levelsModalStyles.levelNameRow}>
            <Text style={[levelsModalStyles.levelName, { color: isUnlocked ? lvl.color : COLORS.dim }]}>
              {lvl.name}
            </Text>
            {isCurrent && (
              <View style={levelsModalStyles.currentTag}>
                <Text style={levelsModalStyles.currentTagText}>CURRENT</Text>
              </View>
            )}
          </View>
          <Text style={levelsModalStyles.levelPoints}>
            {lvl.minPoints === 0 ? 'Starting level' : `${lvl.minPoints.toLocaleString()} pts required`}
          </Text>
        </View>

        {/* Status */}
        <View style={levelsModalStyles.levelStatus}>
          {isUnlocked ? (
            <Ionicons name="checkmark-circle" size={22} color={lvl.color} />
          ) : (
            <Ionicons name="lock-closed" size={18} color={COLORS.dim} />
          )}
        </View>
      </View>
    );
  }, [currentPoints, userBadge.level]);

  // Generate week days for calendar
  const renderWeekCalendar = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const currentStreak = checkInData?.currentStreak || 0;
    const today = new Date().getUTCDay();
    const todayIndex = today === 0 ? 6 : today - 1; // Convert to Mon=0 (UTC)

    // Last completed day index:
    //   - Already checked in today (canCheckIn is false) → today is done
    //   - Not yet checked in → last done day was yesterday (or earlier)
    const lastDoneIndex = canCheckIn ? todayIndex - 1 : todayIndex;
    const streakStartIndex = lastDoneIndex - (currentStreak - 1);

    return (
      <View style={styles.calendarContainer}>
        <Text style={styles.calendarTitle}>Weekly Progress</Text>
        <View style={styles.calendarRow}>
          {days.map((day, index) => {
            const isCompleted =
              currentStreak > 0 &&
              index >= Math.max(0, streakStartIndex) &&
              index <= lastDoneIndex;
            const isToday = index === todayIndex;
            
            return (
              <View key={day} style={styles.calendarDay}>
                <Text style={[styles.calendarDayLabel, isToday && styles.calendarDayLabelToday]}>
                  {day}
                </Text>
                <View style={[
                  styles.calendarDayCircle,
                  isCompleted && styles.calendarDayCompleted,
                  isToday && !isCompleted && styles.calendarDayToday,
                ]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  ) : (
                    <Text style={styles.calendarDayNumber}>{index + 1}</Text>
                  )}
                </View>
                {isToday && (
                  <View style={styles.todayIndicator} />
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.purple} />
        <Text style={styles.loadingText}>Loading check-in data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7C3AED', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Check-in</Text>
        <TouchableOpacity 
          style={styles.leaderboardButton}
          onPress={() => navigation.navigate('CommunityLeaderboard', { communityId, communityData })}
        >
          <Ionicons name="trophy" size={22} color="#FFD700" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />
        }
      >
        {/* Community Banner */}
        <View style={styles.communityBanner}>
          {(communityData?.banner || communityData?.coverImage) ? (
            <Image
              source={{ uri: communityData.banner || communityData.coverImage }}
              style={styles.bannerImage}
            />
          ) : (
            <LinearGradient
              colors={['#3B82F6', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerImage}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bannerOverlay}
          >
            <Text style={styles.communityName}>{communityData?.title || 'Community'}</Text>
          </LinearGradient>
        </View>

        {/* Streak & Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.streakSection}>
            <View style={styles.streakIconContainer}>
              <Ionicons name="flame" size={40} color="#FF6B6B" />
              <View style={styles.streakBadge}>
                <Text style={styles.streakNumber}>{checkInData?.currentStreak || 0}</Text>
              </View>
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakTitle}>Day Streak</Text>
              <Text style={styles.streakSubtitle}>
                Longest: {checkInData?.longestStreak || 0} days
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={22} color={COLORS.gold} />
              <Text style={styles.statValue}>{checkInData?.totalPoints || 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="flame" size={22} color="#FF6B6B" />
              <Text style={styles.statValue}>{checkInData?.currentStreak || 0}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="calendar" size={22} color={COLORS.blue} />
              <Text style={styles.statValue}>{checkInData?.totalCheckIns || 0}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
          </View>
        </View>

        {/* Week Calendar */}
        {renderWeekCalendar()}

        {/* Level Progress */}
        <View style={styles.badgeCard}>
          <View style={styles.badgeHeader}>
            <Text style={styles.badgeTitle}>Current Level</Text>
            <TouchableOpacity onPress={() => setShowLevelsModal(true)}>
              <Text style={styles.viewAllText}>View All Levels</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.currentBadgeRow}>
            <View style={[styles.badgeCircle, { borderColor: userBadge.color }]}>
              <Image source={userBadge.image || LEVEL_IMAGES[1]} style={styles.badgeLevelImage} />
            </View>
            <View style={styles.badgeInfo}>
              <Text style={[styles.badgeName, { color: userBadge.color }]}>Lvl {userBadge.level} - {userBadge.name}</Text>
              <Text style={styles.badgePoints}>{checkInData?.totalPoints || 0} points</Text>
            </View>
            {nextBadgeInfo.nextLevel && (
              <View style={styles.nextBadgeContainer}>
                <Text style={styles.nextBadgeLabel}>Next:</Text>
                <Image source={nextBadgeInfo.nextLevel.image} style={styles.nextBadgeLevelImage} />
                <Text style={styles.nextBadgePoints}>{nextBadgeInfo.pointsNeeded} pts</Text>
              </View>
            )}
          </View>

          {nextBadgeInfo.nextLevel && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={[userBadge.color, nextBadgeInfo.nextLevel.color]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${Math.min(progressToNextBadge, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progressToNextBadge)}%</Text>
            </View>
          )}
        </View>

        {/* Rewards Info */}
        <View style={styles.rewardsCard}>
          <Text style={styles.rewardsTitle}>📅 Daily Rewards</Text>
          <View style={styles.rewardRow}>
            <View style={styles.rewardItem}>
              <Ionicons name="star" size={18} color={COLORS.gold} />
              <Text style={styles.rewardText}>+{POINTS_CONFIG.DAILY_CHECK_IN} Points</Text>
            </View>
            <View style={styles.rewardItem}>
              <Ionicons name="flame" size={18} color="#FF6B6B" />
              <Text style={styles.rewardText}>Streak Tracking</Text>
            </View>
          </View>
          
          <View style={styles.bonusSection}>
            <Text style={styles.bonusTitle}>🎁 Streak Bonuses</Text>
            <View style={styles.bonusRow}>
              <View style={styles.bonusItem}>
                <Text style={styles.bonusLabel}>7 Days</Text>
                <Text style={styles.bonusValue}>2x Points Multiplier</Text>
              </View>
              <View style={styles.bonusItem}>
                <Text style={styles.bonusLabel}>30 Days</Text>
                <Text style={styles.bonusValue}>4x Points Multiplier</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spacer for button */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Check-in Button */}
      <View style={styles.checkInButtonContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.checkInButton,
              !canCheckIn && styles.checkInButtonDisabled,
            ]}
            onPress={handleCheckIn}
            disabled={!canCheckIn || checkingIn}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={canCheckIn ? ['#00FF73', '#00C853'] : ['#333', '#222']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.checkInButtonGradient}
            >
              {checkingIn ? (
                <ActivityIndicator color="#fff" />
              ) : canCheckIn ? (
                <>
                  <Ionicons name="checkmark-circle" size={28} color="#fff" />
                  <Text style={styles.checkInButtonText}>Check In Now</Text>
                  <View style={styles.rewardPreview}>
                    <Text style={styles.rewardPreviewText}>
                      +{POINTS_CONFIG.DAILY_CHECK_IN} pts · Keep your streak!
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="time-outline" size={28} color={COLORS.dim} />
                  <Text style={[styles.checkInButtonText, { color: COLORS.dim }]}>
                    Come Back Tomorrow
                  </Text>
                  <Text style={styles.timerText}>{formatTimeRemaining(timeRemaining)}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* All Levels Modal */}
      <Modal
        visible={showLevelsModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowLevelsModal(false)}
      >
        <View style={levelsModalStyles.overlay}>
          {/* Tap backdrop to close */}
          <TouchableOpacity
            style={levelsModalStyles.backdrop}
            activeOpacity={1}
            onPress={() => setShowLevelsModal(false)}
          />
          <View style={levelsModalStyles.container}>
            {/* Drag handle */}
            <View style={levelsModalStyles.dragHandle} />

            {/* Modal Header */}
            <View style={levelsModalStyles.header}>
              <View style={levelsModalStyles.headerLeft}>
                <Ionicons name="trophy" size={22} color={COLORS.gold} />
                <Text style={levelsModalStyles.headerTitle}>All Levels</Text>
              </View>
              <TouchableOpacity
                style={levelsModalStyles.closeButton}
                onPress={() => setShowLevelsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Current Progress Summary */}
            <View style={levelsModalStyles.progressSummary}>
              <Image source={userBadge.image || LEVEL_IMAGES[1]} style={levelsModalStyles.summaryImage} />
              <View style={levelsModalStyles.summaryInfo}>
                <Text style={levelsModalStyles.summaryLevel}>
                  Level {userBadge.level} — {userBadge.name}
                </Text>
                <Text style={levelsModalStyles.summaryPoints}>
                  {currentPoints.toLocaleString()} points earned
                </Text>
              </View>
            </View>

            {/* Separator */}
            <View style={levelsModalStyles.separator} />

            {/* Levels List */}
            <FlatList
              data={LEVELS}
              keyExtractor={(item) => String(item.level)}
              renderItem={renderLevelItem}
              style={levelsModalStyles.list}
              contentContainerStyle={levelsModalStyles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function CommunityCheckInScreenWithBoundary(props) {
  return (
    <ErrorBoundary>
      <CommunityCheckInScreen {...props} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  leaderboardButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  communityBanner: {
    height: 120,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  communityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  streakIconContainer: {
    position: 'relative',
  },
  streakBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.purple,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  streakNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  streakInfo: {
    marginLeft: 16,
  },
  streakTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  streakSubtitle: {
    fontSize: 13,
    color: COLORS.dim,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.dim,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  calendarContainer: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    alignItems: 'center',
  },
  calendarDayLabel: {
    fontSize: 11,
    color: COLORS.dim,
    marginBottom: 6,
  },
  calendarDayLabelToday: {
    color: COLORS.purple,
    fontWeight: 'bold',
  },
  calendarDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  calendarDayCompleted: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  calendarDayToday: {
    borderColor: COLORS.purple,
  },
  calendarDayNumber: {
    fontSize: 12,
    color: COLORS.dim,
    fontWeight: '600',
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.purple,
    marginTop: 4,
  },
  badgeCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  viewAllText: {
    fontSize: 12,
    color: COLORS.purple,
  },
  currentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.card2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeLevelImage: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  badgeInfo: {
    marginLeft: 14,
    flex: 1,
  },
  badgeName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  badgePoints: {
    fontSize: 13,
    color: COLORS.dim,
    marginTop: 2,
  },
  nextBadgeContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.card2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextBadgeLabel: {
    fontSize: 10,
    color: COLORS.dim,
  },
  nextBadgeEmoji: {
    fontSize: 20,
    marginVertical: 2,
  },
  nextBadgeLevelImage: {
    width: 24,
    height: 24,
    marginVertical: 2,
    resizeMode: 'contain',
  },
  nextBadgePoints: {
    fontSize: 10,
    color: COLORS.dim,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.card2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.dim,
    marginLeft: 8,
    width: 40,
  },
  rewardsCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  rewardsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rewardText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    marginLeft: 8,
  },
  bonusSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  bonusTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bonusItem: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: COLORS.card2,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  bonusLabel: {
    fontSize: 12,
    color: COLORS.purple,
    fontWeight: 'bold',
  },
  bonusValue: {
    fontSize: 10,
    color: COLORS.dim,
    marginTop: 4,
    textAlign: 'center',
  },
  checkInButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  checkInButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  checkInButtonDisabled: {
    opacity: 0.8,
  },
  checkInButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  checkInButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  rewardPreview: {
    marginTop: 4,
  },
  rewardPreviewText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timerText: {
    fontSize: 16,
    color: COLORS.dim,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
});

// ============================================
// ALL LEVELS MODAL STYLES
// ============================================
const levelsModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  container: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.dim,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
  },
  summaryImage: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  summaryInfo: {
    marginLeft: 14,
    flex: 1,
  },
  summaryLevel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  summaryPoints: {
    fontSize: 13,
    color: COLORS.dim,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
    marginVertical: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  list: {
    flexGrow: 1,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  levelRowCurrent: {
    borderWidth: 1.5,
    borderColor: COLORS.purple,
    backgroundColor: COLORS.purple + '15',
  },
  levelRowLocked: {
    opacity: 0.6,
  },
  levelNumber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  levelNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  levelImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: COLORS.card2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  levelImage: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  levelInfo: {
    flex: 1,
  },
  levelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelName: {
    fontSize: 15,
    fontWeight: '700',
  },
  currentTag: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  currentTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  levelPoints: {
    fontSize: 12,
    color: COLORS.dim,
    marginTop: 3,
  },
  levelStatus: {
    marginLeft: 8,
  },
});
