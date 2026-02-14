// shared/services/communityCheckInService.js
// Community Check-in, Points & Leaderboard Service
// Handles daily check-ins, streak tracking, points/coins rewards, and leaderboard

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

// ============================================
// CONFIGURATION
// ============================================

export const POINTS_CONFIG = {
  DAILY_CHECK_IN: 10,           // Base points per check-in
  WEEKLY_STREAK_MULTIPLIER: 2,  // 2x on day 7
  MONTHLY_STREAK_MULTIPLIER: 4, // 4x on day 30
};

export const COINS_CONFIG = {
  DAILY_CHECK_IN: 5,            // Base coins per check-in
  WEEKLY_BONUS: 10,             // +10 coins on day 7
  MONTHLY_BONUS: 50,            // +50 coins on day 30
};

export const BADGES = [
  { name: 'Newbie', minPoints: 0, color: '#808080', icon: '🌱', tier: 0 },
  { name: 'Bronze', minPoints: 100, color: '#CD7F32', icon: '🥉', tier: 1 },
  { name: 'Silver', minPoints: 500, color: '#C0C0C0', icon: '🥈', tier: 2 },
  { name: 'Gold', minPoints: 1000, color: '#FFD700', icon: '🥇', tier: 3 },
  { name: 'Platinum', minPoints: 2500, color: '#E5E4E2', icon: '💎', tier: 4 },
  { name: 'Diamond', minPoints: 5000, color: '#B9F2FF', icon: '💠', tier: 5 },
  { name: 'Master', minPoints: 10000, color: '#FF6B6B', icon: '👑', tier: 6 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate required parameters
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 */
const validateParams = (db, communityId, userId) => {
  if (!db) {
    throw new Error('Firestore database instance is required');
  }
  if (!communityId || typeof communityId !== 'string') {
    throw new Error('Valid community ID is required');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid user ID is required');
  }
};

/**
 * Sanitize display name to prevent XSS and ensure valid output
 * @param {string} name - Raw display name
 * @returns {string} Sanitized display name
 */
const sanitizeDisplayName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'Unknown User';
  }
  
  // Remove HTML tags and trim
  const sanitized = name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
  
  // Return sanitized name or fallback
  return sanitized.length > 0 ? sanitized : 'Unknown User';
};

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
const getTodayDate = () => {
  const now = new Date();
  const utcDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  return utcDate.toISOString().split('T')[0];
};

/**
 * Get yesterday's date in YYYY-MM-DD format (UTC)
 */
const getYesterdayDate = () => {
  const now = new Date();
  const yesterday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  ));
  return yesterday.toISOString().split('T')[0];
};

/**
 * Check if a date is yesterday
 */
const isYesterday = (dateStr) => {
  return dateStr === getYesterdayDate();
};

/**
 * Check if user already checked in today
 */
const hasCheckedInToday = (lastCheckInDate) => {
  return lastCheckInDate === getTodayDate();
};

/**
 * Calculate streak multiplier based on current streak
 */
const getStreakMultiplier = (streak) => {
  if (streak > 0 && streak % 30 === 0) {
    return POINTS_CONFIG.MONTHLY_STREAK_MULTIPLIER; // 4x on day 30, 60, 90...
  } else if (streak > 0 && streak % 7 === 0) {
    return POINTS_CONFIG.WEEKLY_STREAK_MULTIPLIER; // 2x on day 7, 14, 21...
  }
  return 1; // Normal days
};

/**
 * Calculate bonus coins based on streak
 */
const getStreakCoinsBonus = (streak) => {
  if (streak > 0 && streak % 30 === 0) {
    return COINS_CONFIG.MONTHLY_BONUS;
  } else if (streak > 0 && streak % 7 === 0) {
    return COINS_CONFIG.WEEKLY_BONUS;
  }
  return 0;
};

/**
 * Get user's badge based on total points
 */
export const getUserBadge = (totalPoints) => {
  let badge = BADGES[0]; // Default to Newbie
  for (const b of BADGES) {
    if (totalPoints >= b.minPoints) {
      badge = b;
    }
  }
  return badge;
};

/**
 * Get next badge and points needed
 */
export const getNextBadge = (totalPoints) => {
  const currentBadge = getUserBadge(totalPoints);
  const nextBadgeIndex = BADGES.findIndex(b => b.name === currentBadge.name) + 1;
  
  if (nextBadgeIndex >= BADGES.length) {
    return { nextBadge: null, pointsNeeded: 0 };
  }
  
  const nextBadge = BADGES[nextBadgeIndex];
  return {
    nextBadge,
    pointsNeeded: nextBadge.minPoints - totalPoints,
  };
};

/**
 * Get start of current week (Monday)
 */
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
};

/**
 * Get start of current month
 */
const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Get or create user's check-in document
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @returns {Object} Check-in data
 */
export const getUserCheckInData = async (db, communityId, userId) => {
  try {
    const checkInRef = doc(db, 'communities', communityId, 'checkIns', userId);
    const checkInSnap = await getDoc(checkInRef);
    
    if (checkInSnap.exists()) {
      return { id: checkInSnap.id, ...checkInSnap.data() };
    }
    
    // Create initial check-in document
    const initialData = {
      userId,
      communityId,
      lastCheckInDate: null,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      totalPoints: 0,
      weeklyPoints: 0,
      monthlyPoints: 0,
      coinsEarned: 0,
      weekStart: getWeekStart(),
      monthStart: getMonthStart(),
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
    };
    
    await setDoc(checkInRef, initialData);
    return { id: userId, ...initialData };
  } catch (error) {
    console.error('Error getting check-in data:', error);
    throw error;
  }
};

/**
 * Perform community check-in
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @param {Object} walletContext - Optional wallet context for coin updates
 * @returns {Object} Result with points, coins, streak info
 */
export const checkInToCommunity = async (db, communityId, userId, walletContext = null) => {
  validateParams(db, communityId, userId);
  
  try {
    const checkInRef = doc(db, 'communities', communityId, 'checkIns', userId);
    const today = getTodayDate();
    
    // Use transaction to prevent race conditions
    const result = await runTransaction(db, async (transaction) => {
      // IMPORTANT: All reads must happen before any writes in Firestore transactions
      const checkInSnap = await transaction.get(checkInRef);
      const walletRef = doc(db, 'wallets', userId);
      const walletSnap = await transaction.get(walletRef);
      
      let currentData = checkInSnap.exists() ? checkInSnap.data() : null;
      
      // Check if already checked in today
      if (currentData && hasCheckedInToday(currentData.lastCheckInDate)) {
        return {
          success: false,
          alreadyCheckedIn: true,
          message: 'You have already checked in today!',
          data: currentData,
        };
      }
      
      // Calculate new streak
      let newStreak = 1;
      if (currentData && isYesterday(currentData.lastCheckInDate)) {
        newStreak = (currentData.currentStreak || 0) + 1;
      }
      
      // Calculate rewards
      const multiplier = getStreakMultiplier(newStreak);
      const pointsEarned = POINTS_CONFIG.DAILY_CHECK_IN * multiplier;
      const coinsEarned = COINS_CONFIG.DAILY_CHECK_IN + getStreakCoinsBonus(newStreak);
      
      // Reset weekly/monthly if needed
      const currentWeekStart = getWeekStart();
      const currentMonthStart = getMonthStart();
      
      let weeklyPoints = pointsEarned;
      let monthlyPoints = pointsEarned;
      
      if (currentData) {
        if (currentData.weekStart === currentWeekStart) {
          weeklyPoints = (currentData.weeklyPoints || 0) + pointsEarned;
        }
        if (currentData.monthStart === currentMonthStart) {
          monthlyPoints = (currentData.monthlyPoints || 0) + pointsEarned;
        }
      }
      
      // Prepare update data
      const updateData = {
        lastCheckInDate: today,
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, currentData?.longestStreak || 0),
        totalCheckIns: (currentData?.totalCheckIns || 0) + 1,
        totalPoints: (currentData?.totalPoints || 0) + pointsEarned,
        weeklyPoints,
        monthlyPoints,
        weekStart: currentWeekStart,
        monthStart: currentMonthStart,
        coinsEarned: (currentData?.coinsEarned || 0) + coinsEarned,
        lastUpdatedAt: serverTimestamp(),
      };
      
      if (!currentData) {
        updateData.userId = userId;
        updateData.communityId = communityId;
        updateData.createdAt = serverTimestamp();
      }
      
      // Update check-in document in transaction
      transaction.set(checkInRef, updateData, { merge: true });
      
      // Update wallet in transaction (wallet reference already created above)
      if (walletSnap.exists()) {
        transaction.update(walletRef, {
          coins: increment(coinsEarned),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create wallet if it doesn't exist
        transaction.set(walletRef, {
          userId,
          coins: coinsEarned,
          diamonds: 0,
          earningsBalance: 0,
          withdrawableBalance: 0,
          pendingEarnings: 0,
          lifetimeEarnings: 0,
          minimumWithdrawal: 50,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      // Add to history in transaction
      const historyRef = doc(db, 'communities', communityId, 'checkIns', userId, 'history', today);
      transaction.set(historyRef, {
        date: today,
        streak: newStreak,
        pointsEarned,
        coinsEarned,
        multiplier,
        createdAt: serverTimestamp(),
      });
      
      return {
        success: true,
        alreadyCheckedIn: false,
        pointsEarned,
        coinsEarned,
        streak: newStreak,
        multiplier,
        totalPoints: updateData.totalPoints,
      };
    });
    
    // If transaction was successful and not already checked in, update wallet context
    if (result.success && !result.alreadyCheckedIn) {
      // Refresh wallet context after transaction
      if (walletContext && walletContext.refreshWallet) {
        try {
          await walletContext.refreshWallet();
        } catch (e) {
          console.log('Could not refresh wallet context:', e.message);
        }
      }
      
      return {
        ...result,
        message: `Check-in successful! +${result.pointsEarned} points, +${result.coinsEarned} coins`,
        badge: getUserBadge(result.totalPoints),
        nextBadge: getNextBadge(result.totalPoints),
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error checking in:', error);
    throw error;
  }
};

/**
 * Get community leaderboard
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} filter - 'all', 'weekly', 'monthly'
 * @param {number} limitCount - Max results
 * @returns {Array} Leaderboard entries
 */
export const getCommunityLeaderboard = async (db, communityId, filter = 'all', limitCount = 50) => {
  validateParams(db, communityId, 'temp');
  
  try {
    const checkInsRef = collection(db, 'communities', communityId, 'checkIns');
    
    // Determine which field to sort by
    let sortField = 'totalPoints';
    if (filter === 'weekly') {
      sortField = 'weeklyPoints';
    } else if (filter === 'monthly') {
      sortField = 'monthlyPoints';
    }
    
    const q = query(
      checkInsRef,
      orderBy(sortField, 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const leaderboard = [];
    
    // Collect all user IDs first
    const checkInData = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data(),
    }));
    
    const userIds = checkInData.map(item => item.data.userId).filter(Boolean);
    
    // Batch fetch user data (max 10 per query due to Firestore limits)
    const userDataMap = {};
    const batchSize = 10;
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      try {
        const userQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batch)
        );
        const userSnapshot = await getDocs(userQuery);
        
        userSnapshot.docs.forEach(userDoc => {
          const ud = userDoc.data();
          userDataMap[userDoc.id] = {
            displayName: sanitizeDisplayName(ud.displayName || ud.username),
            photoURL: ud.photoURL || ud.profileImage || null,
          };
        });
      } catch (e) {
        console.log('Could not fetch user batch:', e.message);
      }
    }
    
    // Build leaderboard with cached user data
    checkInData.forEach((item, index) => {
      const data = item.data;
      const userData = userDataMap[data.userId] || {
        displayName: 'Unknown User',
        photoURL: null,
      };
      
      const points = filter === 'weekly' 
        ? (data.weeklyPoints || 0)
        : filter === 'monthly'
          ? (data.monthlyPoints || 0)
          : (data.totalPoints || 0);
      
      leaderboard.push({
        id: item.id,
        rank: index + 1,
        userId: data.userId,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        points,
        totalCheckIns: data.totalCheckIns || 0,
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        badge: getUserBadge(data.totalPoints || 0),
      });
    });
    
    return leaderboard;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
};

/**
 * Get user's rank in community
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @param {string} filter - 'all', 'weekly', 'monthly'
 * @returns {Object} User rank and stats
 */
export const getUserRank = async (db, communityId, userId, filter = 'all') => {
  try {
    // Get user's check-in data
    const checkInRef = doc(db, 'communities', communityId, 'checkIns', userId);
    const checkInSnap = await getDoc(checkInRef);
    
    if (!checkInSnap.exists()) {
      return { rank: null, totalUsers: 0, userData: null };
    }
    
    const userData = checkInSnap.data();
    
    // Determine which field to use
    let userPoints = userData.totalPoints || 0;
    let sortField = 'totalPoints';
    if (filter === 'weekly') {
      userPoints = userData.weeklyPoints || 0;
      sortField = 'weeklyPoints';
    } else if (filter === 'monthly') {
      userPoints = userData.monthlyPoints || 0;
      sortField = 'monthlyPoints';
    }
    
    // Count users with more points
    const checkInsRef = collection(db, 'communities', communityId, 'checkIns');
    const higherQuery = query(
      checkInsRef,
      where(sortField, '>', userPoints)
    );
    
    const higherSnapshot = await getDocs(higherQuery);
    const rank = higherSnapshot.size + 1;
    
    // Count total users
    const allSnapshot = await getDocs(checkInsRef);
    const totalUsers = allSnapshot.size;
    
    return {
      rank,
      totalUsers,
      points: userPoints,
      userData: {
        ...userData,
        badge: getUserBadge(userData.totalPoints || 0),
        nextBadge: getNextBadge(userData.totalPoints || 0),
      },
    };
  } catch (error) {
    console.error('Error getting user rank:', error);
    throw error;
  }
};

/**
 * Get check-in history for a user
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @param {number} days - Number of past days to fetch
 * @returns {Array} Check-in history
 */
export const getCheckInHistory = async (db, communityId, userId, days = 30) => {
  try {
    const historyRef = collection(db, 'communities', communityId, 'checkIns', userId, 'history');
    const q = query(historyRef, orderBy('date', 'desc'), limit(days));
    
    const snapshot = await getDocs(q);
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return history;
  } catch (error) {
    console.error('Error getting check-in history:', error);
    throw error;
  }
};

/**
 * Check if user can check in today
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @returns {Object} { canCheckIn, lastCheckInDate, streak }
 */
export const canCheckInToday = async (db, communityId, userId) => {
  try {
    const checkInRef = doc(db, 'communities', communityId, 'checkIns', userId);
    const checkInSnap = await getDoc(checkInRef);
    
    if (!checkInSnap.exists()) {
      return { canCheckIn: true, lastCheckInDate: null, streak: 0 };
    }
    
    const data = checkInSnap.data();
    const today = getTodayDate();
    const canCheckIn = data.lastCheckInDate !== today;
    
    return {
      canCheckIn,
      lastCheckInDate: data.lastCheckInDate,
      streak: data.currentStreak || 0,
      nextRewardIn: canCheckIn ? 0 : getTimeUntilMidnight(),
    };
  } catch (error) {
    console.error('Error checking if can check in:', error);
    throw error;
  }
};

/**
 * Get time until midnight in seconds
 */
const getTimeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
};

/**
 * Format seconds to HH:MM:SS
 */
export const formatTimeRemaining = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default {
  POINTS_CONFIG,
  COINS_CONFIG,
  BADGES,
  getUserCheckInData,
  checkInToCommunity,
  getCommunityLeaderboard,
  getUserRank,
  getCheckInHistory,
  canCheckInToday,
  getUserBadge,
  getNextBadge,
  formatTimeRemaining,
};
