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
  getCountFromServer,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { getDocsWithRetry, getDocWithRetry } from '../../utils/firestoreHelpers';
import LEVEL_IMAGES from '../../assets/levelImages';

// Re-export so consumers can import from this file
export { default as LEVEL_IMAGES } from '../../assets/levelImages';

// ============================================
// CONFIGURATION
// ============================================

export const POINTS_CONFIG = {
  DAILY_CHECK_IN: 10,           // Base points per check-in
  WEEKLY_STREAK_MULTIPLIER: 2,  // 2x on day 7
  MONTHLY_STREAK_MULTIPLIER: 4, // 4x on day 30
};

export const COINS_CONFIG = {
  DAILY_CHECK_IN: 0,            // Coins removed - earn via watching ads only
  WEEKLY_BONUS: 0,              // Coins removed
  MONTHLY_BONUS: 0,             // Coins removed
};

export const LEVELS = [
  { name: 'Brand New',          minPoints: 0,      color: '#4ECDC4', level: 1,  tier: 0,  image: LEVEL_IMAGES[1] },
  { name: 'Newbie',             minPoints: 5,      color: '#4ECDC4', level: 2,  tier: 1,  image: LEVEL_IMAGES[2] },
  { name: 'Apprentice',         minPoints: 10,     color: '#4ECDC4', level: 3,  tier: 2,  image: LEVEL_IMAGES[3] },
  { name: 'Jr. Member',         minPoints: 25,     color: '#FFD700', level: 4,  tier: 3,  image: LEVEL_IMAGES[4] },
  { name: 'Associate Member',   minPoints: 50,     color: '#C0C0C0', level: 5,  tier: 4,  image: LEVEL_IMAGES[5] },
  { name: 'Sr. Member',         minPoints: 100,    color: '#FFD700', level: 6,  tier: 5,  image: LEVEL_IMAGES[6] },
  { name: 'Advanced Member',    minPoints: 200,    color: '#DAA520', level: 7,  tier: 6,  image: LEVEL_IMAGES[7] },
  { name: 'Experienced Member', minPoints: 500,    color: '#DAA520', level: 8,  tier: 7,  image: LEVEL_IMAGES[8] },
  { name: 'Veteran Member',     minPoints: 1000,   color: '#DAA520', level: 9,  tier: 8,  image: LEVEL_IMAGES[9] },
  { name: 'Power Member',       minPoints: 2000,   color: '#E91E8C', level: 10, tier: 9,  image: LEVEL_IMAGES[10] },
  { name: 'Super Member',       minPoints: 3000,   color: '#9B59B6', level: 11, tier: 10, image: LEVEL_IMAGES[11] },
  { name: 'Ultra Member',       minPoints: 5000,   color: '#9B59B6', level: 12, tier: 11, image: LEVEL_IMAGES[12] },
  { name: 'Professional',       minPoints: 7000,   color: '#9B59B6', level: 13, tier: 12, image: LEVEL_IMAGES[13] },
  { name: 'Expert',             minPoints: 10000,  color: '#9B59B6', level: 14, tier: 13, image: LEVEL_IMAGES[14] },
  { name: 'Virtuoso',           minPoints: 20000,  color: '#FF4500', level: 15, tier: 14, image: LEVEL_IMAGES[15] },
  { name: 'Champion',           minPoints: 40000,  color: '#2196F3', level: 16, tier: 15, image: LEVEL_IMAGES[16] },
  { name: 'Master',             minPoints: 60000,  color: '#2196F3', level: 17, tier: 16, image: LEVEL_IMAGES[17] },
  { name: 'Celebrity',          minPoints: 100000, color: '#2196F3', level: 18, tier: 17, image: LEVEL_IMAGES[18] },
  { name: 'Legendary',          minPoints: 250000, color: '#FFD700', level: 19, tier: 18, image: LEVEL_IMAGES[19] },
  { name: 'Ultimate',           minPoints: 500000, color: '#FF2D55', level: 20, tier: 19, image: LEVEL_IMAGES[20] },
];

// Backward compatibility alias
export const BADGES = LEVELS;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate required parameters
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID (optional when requireUserId is false)
 * @param {boolean} requireUserId - Whether userId is required (default: true)
 */
const validateParams = (db, communityId, userId, requireUserId = true) => {
  if (!db) {
    throw new Error('Firestore database instance is required');
  }
  if (!communityId || typeof communityId !== 'string') {
    throw new Error('Valid community ID is required');
  }
  if (requireUserId && (!userId || typeof userId !== 'string')) {
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
 * Get user's level based on total points
 */
export const getUserLevel = (totalPoints) => {
  let level = LEVELS[0]; // Default to Beginner
  for (const l of LEVELS) {
    if (totalPoints >= l.minPoints) {
      level = l;
    }
  }
  return level;
};

// Backward compatibility alias
export const getUserBadge = getUserLevel;

/**
 * Get next level and points needed
 */
export const getNextLevel = (totalPoints) => {
  const currentLevel = getUserLevel(totalPoints);
  const nextLevelIndex = LEVELS.findIndex(l => l.name === currentLevel.name) + 1;
  
  if (nextLevelIndex >= LEVELS.length) {
    return { nextLevel: null, nextBadge: null, pointsNeeded: 0 };
  }
  
  const nextLevel = LEVELS[nextLevelIndex];
  return {
    nextLevel,
    nextBadge: nextLevel, // backward compat
    pointsNeeded: nextLevel.minPoints - totalPoints,
  };
};

// Backward compatibility alias
export const getNextBadge = getNextLevel;

/**
 * Compute the live (real-time) streak for a check-in record.
 * If lastCheckInDate is today or yesterday the streak is still alive;
 * otherwise it has expired and the effective streak is 0.
 * @param {Object} checkInData - The raw check-in document data
 * @returns {number} Live streak value
 */
export const getLiveStreak = (checkInData) => {
  if (!checkInData || !checkInData.lastCheckInDate) return 0;
  const last = checkInData.lastCheckInDate;
  if (last === getTodayDate() || last === getYesterdayDate()) {
    return checkInData.currentStreak || 0;
  }
  return 0; // streak expired
};

/**
 * Get start of current week (Monday) in UTC – consistent with getTodayDate()
 */
const getWeekStart = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - diffToMonday
  ));
  return monday.toISOString().split('T')[0];
};

/**
 * Get start of current month in UTC – consistent with getTodayDate()
 */
const getMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0];
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
      // ========================================================
      // PHASE 1: ALL READS — must complete before any writes
      // ========================================================
      const checkInSnap = await transaction.get(checkInRef);
      const walletRef = doc(db, 'wallets', userId);
      const walletSnap = await transaction.get(walletRef);
      const userProfileRef = doc(db, 'users', userId);
      const userProfileSnap = await transaction.get(userProfileRef);
      // Also read community membership doc for communityNickname
      const membershipId = `${userId}_${communityId}`;
      const membershipRef = doc(db, 'communities_members', membershipId);
      const membershipSnap = await transaction.get(membershipRef);
      // ========================================================
      // END OF READS — no more transaction.get() calls below
      // ========================================================
      
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
      
      // Denormalize displayName & photoURL for leaderboard (from the reads above)
      // Prefer community nickname over global displayName
      const membershipData = membershipSnap.exists() ? membershipSnap.data() : null;
      const communityNickname = membershipData?.communityNickname || null;
      
      if (userProfileSnap.exists()) {
        const userProfile = userProfileSnap.data();
        updateData.displayName = sanitizeDisplayName(
          communityNickname || userProfile.displayName || userProfile.username
        );
        updateData.photoURL = userProfile.photoURL || userProfile.profileImage || null;
      }

      // ========================================================
      // PHASE 2: ALL WRITES
      // ========================================================

      // Update check-in document
      transaction.set(checkInRef, updateData, { merge: true });
      
      // Only update wallet if coins earned > 0
      if (coinsEarned > 0) {
        if (walletSnap.exists()) {
          transaction.update(walletRef, {
            coins: increment(coinsEarned),
            updatedAt: serverTimestamp(),
          });
        } else {
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
      }
      
      // Add to history
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
      // Refresh wallet context after transaction (supports both fetchWallet and refreshWallet)
      const refreshFn = walletContext?.refreshWallet || walletContext?.fetchWallet;
      if (refreshFn) {
        try {
          await refreshFn();
        } catch (e) {
          console.log('Could not refresh wallet context:', e.message);
        }
      }
      
      return {
        ...result,
        message: result.coinsEarned > 0 
          ? `Check-in successful! +${result.pointsEarned} points, +${result.coinsEarned} coins`
          : `Check-in successful! +${result.pointsEarned} points`,
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
  validateParams(db, communityId, null, false);
  
  try {
    const checkInsRef = collection(db, 'communities', communityId, 'checkIns');
    
    // Determine sort field and period filter
    let sortField = 'totalPoints';
    let periodFilter = null;

    if (filter === 'weekly') {
      sortField = 'weeklyPoints';
      periodFilter = { field: 'weekStart', value: getWeekStart() };
    } else if (filter === 'monthly') {
      sortField = 'monthlyPoints';
      periodFilter = { field: 'monthStart', value: getMonthStart() };
    }
    
    // Build query – period-filtered queries require composite indexes
    // (see firestore.indexes.json: checkIns weekStart+weeklyPoints, monthStart+monthlyPoints)
    const q = periodFilter
      ? query(
          checkInsRef,
          where(periodFilter.field, '==', periodFilter.value),
          orderBy(sortField, 'desc'),
          limit(limitCount)
        )
      : query(
          checkInsRef,
          orderBy(sortField, 'desc'),
          limit(limitCount)
        );
    
    const snapshot = await getDocsWithRetry(q, { timeout: 10000, retries: 2 });
    if (!snapshot) return [];

    const leaderboard = [];
    
    // Collect all check-in docs
    const checkInData = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data(),
    }));
    
    // Collect ALL user IDs for community nickname lookup
    const allUserIds = checkInData
      .map(item => item.data.userId)
      .filter(Boolean);
    
    // Determine which user IDs are missing denormalized profile data
    const missingUserIds = checkInData
      .filter(item => !item.data.displayName)
      .map(item => item.data.userId)
      .filter(Boolean);
    
    // Batch-fetch community membership docs for community nicknames
    const nicknameMap = {};
    if (allUserIds.length > 0) {
      const nickBatchSize = 10;
      const nickBatches = [];
      for (let i = 0; i < allUserIds.length; i += nickBatchSize) {
        nickBatches.push(allUserIds.slice(i, i + nickBatchSize));
      }
      
      const nickResults = await Promise.all(
        nickBatches.map(batch =>
          Promise.all(
            batch.map(uid => {
              const membershipId = `${uid}_${communityId}`;
              return getDocWithRetry(doc(db, 'communities_members', membershipId), { silentFail: true })
                .then(snap => {
                  if (snap?.exists()) {
                    const nickname = snap.data()?.communityNickname;
                    if (nickname) nicknameMap[uid] = sanitizeDisplayName(nickname);
                  }
                })
                .catch(() => {});
            })
          )
        )
      );
    }
    
    // Batch-fetch only the users whose profile is NOT already in the checkIn doc
    const userDataMap = {};
    if (missingUserIds.length > 0) {
      const batchSize = 10;
      const userBatches = [];
      for (let i = 0; i < missingUserIds.length; i += batchSize) {
        userBatches.push(missingUserIds.slice(i, i + batchSize));
      }

      const userBatchResults = await Promise.all(
        userBatches.map(batch =>
          getDocsWithRetry(
            query(collection(db, 'users'), where('__name__', 'in', batch)),
            { timeout: 8000, retries: 1, silentFail: true }
          ).catch(e => { console.log('Could not fetch user batch:', e.message); return null; })
        )
      );
      userBatchResults.forEach(userSnapshot => {
        if (!userSnapshot) return;
        userSnapshot.docs.forEach(userDoc => {
          const ud = userDoc.data();
          userDataMap[userDoc.id] = {
            displayName: sanitizeDisplayName(ud.displayName || ud.username),
            photoURL: ud.photoURL || ud.profileImage || null,
          };
        });
      });
    }
    
    // Build leaderboard entries using denormalized data first, then fallback to fetched data
    const todayDate = getTodayDate();
    const yesterdayDate = getYesterdayDate();

    checkInData.forEach((item, index) => {
      const data = item.data;
      const userId = data.userId;

      // Prefer community nickname > denormalized displayName > fetched user data
      const displayName = nicknameMap[userId]
        || (data.displayName ? sanitizeDisplayName(data.displayName) : null)
        || userDataMap[userId]?.displayName
        || 'Unknown User';
      const photoURL = data.photoURL != null
        ? data.photoURL
        : (userDataMap[userId]?.photoURL || null);
      
      const points = filter === 'weekly' 
        ? (data.weeklyPoints || 0)
        : filter === 'monthly'
          ? (data.monthlyPoints || 0)
          : (data.totalPoints || 0);

      // Compute live streak: only show streak when user checked in today or yesterday
      const lastDate = data.lastCheckInDate;
      const liveStreak = (lastDate === todayDate || lastDate === yesterdayDate)
        ? (data.currentStreak || 0)
        : 0;
      
      leaderboard.push({
        id: item.id,
        rank: index + 1,
        userId,
        displayName,
        photoURL,
        points,
        totalCheckIns: data.totalCheckIns || 0,
        currentStreak: liveStreak,
        storedStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        lastCheckInDate: lastDate || null,
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
 * Get user's rank in community.
 * When the leaderboard data has already been fetched, pass it as `prefetchedLeaderboard`
 * to avoid redundant Firestore reads.
 * @param {Object} db - Firestore instance
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @param {string} filter - 'all', 'weekly', 'monthly'
 * @param {Array|null} prefetchedLeaderboard - Optional pre-fetched leaderboard array
 * @returns {Object} User rank and stats
 */
export const getUserRank = async (db, communityId, userId, filter = 'all', prefetchedLeaderboard = null) => {
  try {
    // If we already have the leaderboard data, try to find the user in it first
    if (prefetchedLeaderboard && prefetchedLeaderboard.length > 0) {
      const entry = prefetchedLeaderboard.find(e => e.userId === userId);
      if (entry) {
        return {
          rank: entry.rank,
          totalUsers: prefetchedLeaderboard.length,
          points: entry.points,
          userData: {
            currentStreak: entry.currentStreak,
            longestStreak: entry.longestStreak,
            totalCheckIns: entry.totalCheckIns,
            badge: entry.badge || getUserBadge(entry.points || 0),
            nextBadge: getNextBadge(entry.points || 0),
          },
        };
      }
    }

    // Fall back to server query when user is not in the fetched page
    const checkInRef = doc(db, 'communities', communityId, 'checkIns', userId);
    const checkInSnap = await getDocWithRetry(checkInRef, { timeout: 8000, retries: 2 });
    
    if (!checkInSnap || !checkInSnap.exists()) {
      return { rank: null, totalUsers: 0, points: 0, userData: null };
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
    
    // Count users with MORE points (= rank - 1) using server-side count
    const checkInsRef = collection(db, 'communities', communityId, 'checkIns');
    const higherQuery = query(
      checkInsRef,
      where(sortField, '>', userPoints)
    );
    
    const [higherCount, totalCount] = await Promise.all([
      getCountFromServer(higherQuery),
      getCountFromServer(checkInsRef),
    ]);
    const rank = higherCount.data().count + 1;
    const totalUsers = totalCount.data().count;

    // Compute live streak
    const liveStreak = getLiveStreak(userData);
    
    return {
      rank,
      totalUsers,
      points: userPoints,
      userData: {
        ...userData,
        currentStreak: liveStreak,
        storedStreak: userData.currentStreak || 0,
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
  LEVELS,
  LEVEL_IMAGES,
  getUserCheckInData,
  checkInToCommunity,
  getCommunityLeaderboard,
  getUserRank,
  getCheckInHistory,
  canCheckInToday,
  getUserBadge,
  getUserLevel,
  getNextBadge,
  getNextLevel,
  getLiveStreak,
  formatTimeRemaining,
};
