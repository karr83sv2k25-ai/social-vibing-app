// shared/services/dailyRewardsService.js
// Daily Rewards Service - Handles daily tasks, time tracking, and invite rewards
// Provides real-time Firebase integration for the Reward Center

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';

// ============================================
// CONFIGURATION
// ============================================

export const DAILY_TASKS = {
  CHECK_IN: {
    id: 'daily_check_in',
    title: 'Daily Check-in',
    subtitle: 'Earn 10 Coins',
    type: 'coin',
    reward: 10,
    rewardType: 'coins',
    icon: 'calendar-check',
    autoComplete: false, // User must manually claim
  },
  TIME_SPENT: {
    id: 'time_spent',
    title: 'Spend 30 mins in the app',
    subtitle: 'Earn 20 Coins',
    type: 'coin',
    reward: 20,
    rewardType: 'coins',
    requiredMinutes: 30,
    icon: 'timer',
    autoComplete: true, // Auto-unlocks when time is reached
  },
  INVITE_FRIEND: {
    id: 'invite_friend',
    title: 'Invite Friends',
    subtitle: 'Earn 50 Coins',
    type: 'coin',
    reward: 50,
    rewardType: 'coins',
    icon: 'account-plus',
    autoComplete: false,
  },
  WATCH_AD: {
    id: 'watch_ad',
    title: 'Watch an Ad',
    subtitle: 'Earn 5 Coins',
    type: 'coin',
    reward: 5,
    rewardType: 'coins',
    icon: 'video',
    autoComplete: false,
  },
  FIRST_POST: {
    id: 'first_post',
    title: 'Create a Post Today',
    subtitle: 'Earn 15 Coins',
    type: 'coin',
    reward: 15,
    rewardType: 'coins',
    icon: 'pencil',
    autoComplete: true,
  },
  FIRST_COMMENT: {
    id: 'first_comment',
    title: 'Comment on a Post',
    subtitle: 'Earn 5 Coins',
    type: 'coin',
    reward: 5,
    rewardType: 'coins',
    icon: 'comment',
    autoComplete: true,
  },
};

export const STREAK_BONUSES = [
  { days: 7, bonus: 50, label: 'Week Warrior' },
  { days: 14, bonus: 100, label: 'Fortnight Fighter' },
  { days: 30, bonus: 200, label: 'Monthly Master' },
  { days: 60, bonus: 400, label: 'Two-Month Titan' },
  { days: 100, bonus: 1000, label: 'Century Champion' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get today's date in YYYY-MM-DD format (Local timezone)
 * Uses local timezone so users see daily reset at their local midnight
 */
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get yesterday's date in YYYY-MM-DD format (Local timezone)
 */
const getYesterdayDate = () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if date is yesterday
 */
const isYesterday = (dateStr) => dateStr === getYesterdayDate();

/**
 * Check if date is today
 */
const isToday = (dateStr) => dateStr === getTodayDate();

/**
 * Get time until midnight in seconds
 */
export const getTimeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
};

/**
 * Format seconds to HH:MM:SS
 */
export const formatTimeRemaining = (seconds) => {
  if (seconds <= 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Get or create user's daily rewards document for today
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @returns {Object} Daily rewards data
 */
export const getDailyRewardsData = async (db, userId) => {
  if (!db || !userId) {
    throw new Error('Database and userId are required');
  }

  const today = getTodayDate();
  const dailyRewardRef = doc(db, 'users', userId, 'dailyRewards', today);

  try {
    const snapshot = await getDoc(dailyRewardRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      // Check if tasks reset is needed (new day)
      return {
        id: snapshot.id,
        ...data,
        tasks: data.tasks || {},
      };
    }

    // Get user's streak data
    const streakRef = doc(db, 'users', userId, 'streakData', 'global');
    const streakSnap = await getDoc(streakRef);
    const streakData = streakSnap.exists() ? streakSnap.data() : { 
      currentStreak: 0, 
      longestStreak: 0,
      lastActiveDate: null,
    };

    // Calculate new streak
    let newStreak = 1;
    if (streakData.lastActiveDate === getYesterdayDate()) {
      newStreak = (streakData.currentStreak || 0) + 1;
    } else if (streakData.lastActiveDate === today) {
      newStreak = streakData.currentStreak || 1;
    }
    // If lastActiveDate is older than yesterday, streak resets to 1

    // Check if user earned a streak bonus
    const streakBonus = STREAK_BONUSES.find(b => b.days === newStreak);
    const claimedBonuses = streakData.claimedBonuses || [];
    let bonusAwarded = null;
    
    // Award streak bonus if not already claimed
    if (streakBonus && !claimedBonuses.includes(streakBonus.days)) {
      bonusAwarded = streakBonus;
    }

    // Create initial daily rewards document
    const initialData = {
      userId,
      date: today,
      tasks: {
        [DAILY_TASKS.CHECK_IN.id]: { status: 'available', claimedAt: null },
        [DAILY_TASKS.TIME_SPENT.id]: { status: 'locked', progress: 0, claimedAt: null },
        [DAILY_TASKS.INVITE_FRIEND.id]: { status: 'locked', claimedAt: null },
        [DAILY_TASKS.WATCH_AD.id]: { status: 'available', claimedAt: null },
        [DAILY_TASKS.FIRST_POST.id]: { status: 'locked', completed: false, claimedAt: null },
        [DAILY_TASKS.FIRST_COMMENT.id]: { status: 'locked', completed: false, claimedAt: null },
      },
      timeSpentMinutes: 0,
      streak: newStreak,
      longestStreak: Math.max(newStreak, streakData.longestStreak || 0),
      coinsEarnedToday: bonusAwarded ? bonusAwarded.bonus : 0,
      streakBonusAwarded: bonusAwarded ? { ...bonusAwarded, awardedAt: new Date().toISOString() } : null,
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
    };

    await setDoc(dailyRewardRef, initialData);

    // Update streak data with claimed bonus
    const updatedClaimedBonuses = bonusAwarded 
      ? [...claimedBonuses, bonusAwarded.days] 
      : claimedBonuses;
    
    await setDoc(streakRef, {
      currentStreak: newStreak,
      longestStreak: initialData.longestStreak,
      lastActiveDate: today,
      claimedBonuses: updatedClaimedBonuses,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Award streak bonus coins to wallet
    if (bonusAwarded) {
      try {
        const walletRef = doc(db, 'wallets', userId);
        const walletSnap = await getDoc(walletRef);
        
        if (walletSnap.exists()) {
          await updateDoc(walletRef, {
            coins: increment(bonusAwarded.bonus),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(walletRef, {
            userId,
            coins: bonusAwarded.bonus,
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

        // Record the streak bonus transaction
        await setDoc(doc(collection(db, 'transactions')), {
          userId,
          type: 'streak_bonus',
          amount: bonusAwarded.bonus,
          currency: 'coins',
          description: `${bonusAwarded.label} - ${bonusAwarded.days} day streak bonus!`,
          streakDays: bonusAwarded.days,
          createdAt: serverTimestamp(),
        });
        
        console.log(`🎉 Streak bonus awarded: ${bonusAwarded.label} +${bonusAwarded.bonus} coins`);
      } catch (bonusError) {
        console.error('Error awarding streak bonus:', bonusError);
      }
    }

    return { id: today, ...initialData };
  } catch (error) {
    console.error('Error getting daily rewards data:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time daily rewards updates
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function with updated data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToDailyRewards = (db, userId, callback) => {
  if (!db || !userId) {
    console.error('Database and userId are required');
    return () => {};
  }

  const today = getTodayDate();
  const dailyRewardRef = doc(db, 'users', userId, 'dailyRewards', today);

  return onSnapshot(dailyRewardRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({
        id: snapshot.id,
        ...snapshot.data(),
      });
    } else {
      // Document doesn't exist, initialize it
      getDailyRewardsData(db, userId).then(callback).catch(console.error);
    }
  }, (error) => {
    console.error('Error in daily rewards subscription:', error);
  });
};

/**
 * Claim a daily task reward
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {string} taskId - Task ID to claim
 * @param {Object} walletContext - Wallet context for updating coins
 * @returns {Object} Result with reward info
 */
export const claimTaskReward = async (db, userId, taskId, walletContext = null) => {
  if (!db || !userId || !taskId) {
    throw new Error('Database, userId, and taskId are required');
  }

  const today = getTodayDate();
  const dailyRewardRef = doc(db, 'users', userId, 'dailyRewards', today);
  const walletRef = doc(db, 'wallets', userId);

  // Find the task config
  const taskConfig = Object.values(DAILY_TASKS).find(t => t.id === taskId);
  if (!taskConfig) {
    throw new Error('Invalid task ID');
  }

  try {
    const result = await runTransaction(db, async (transaction) => {
      // IMPORTANT: All reads must happen before any writes in Firestore transactions
      const dailyRewardSnap = await transaction.get(dailyRewardRef);
      const walletSnap = await transaction.get(walletRef);
      
      if (!dailyRewardSnap.exists()) {
        throw new Error('Daily rewards not initialized');
      }

      const data = dailyRewardSnap.data();
      const taskData = data.tasks?.[taskId];

      if (!taskData) {
        throw new Error('Task not found');
      }

      if (taskData.status === 'claimed') {
        return {
          success: false,
          message: 'Already claimed this reward today!',
          alreadyClaimed: true,
        };
      }

      if (taskData.status === 'locked') {
        return {
          success: false,
          message: 'Complete the task first to claim the reward!',
          locked: true,
        };
      }

      // Update task status
      const updatedTasks = {
        ...data.tasks,
        [taskId]: {
          ...taskData,
          status: 'claimed',
          claimedAt: new Date().toISOString(),
        },
      };

      // Update daily rewards document
      transaction.update(dailyRewardRef, {
        tasks: updatedTasks,
        coinsEarnedToday: (data.coinsEarnedToday || 0) + taskConfig.reward,
        lastUpdatedAt: serverTimestamp(),
      });

      // Check if wallet exists (already read above)
      if (walletSnap.exists()) {
        // Update existing wallet
        transaction.update(walletRef, {
          coins: increment(taskConfig.reward),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create wallet if it doesn't exist
        transaction.set(walletRef, {
          userId,
          coins: taskConfig.reward,
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

      // Record transaction
      const transactionRef = doc(collection(db, 'transactions'));
      transaction.set(transactionRef, {
        userId,
        type: 'daily_reward',
        amount: taskConfig.reward,
        currency: 'coins',
        description: `Daily task: ${taskConfig.title}`,
        taskId,
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        reward: taskConfig.reward,
        rewardType: taskConfig.rewardType,
        taskTitle: taskConfig.title,
        message: `+${taskConfig.reward} Coins earned!`,
      };
    });

    // Refresh wallet context if available (supports both fetchWallet and refreshWallet)
    if (result.success) {
      const refreshFn = walletContext?.refreshWallet || walletContext?.fetchWallet;
      if (refreshFn) {
        try {
          await refreshFn();
        } catch (e) {
          console.log('Could not refresh wallet context:', e.message);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error claiming task reward:', error);
    throw error;
  }
};

/**
 * Update time spent in app
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {number} minutesToAdd - Minutes to add
 * @returns {Object} Updated time spent data
 */
export const updateTimeSpent = async (db, userId, minutesToAdd = 1) => {
  if (!db || !userId) {
    throw new Error('Database and userId are required');
  }

  const today = getTodayDate();
  const dailyRewardRef = doc(db, 'users', userId, 'dailyRewards', today);

  try {
    const snapshot = await getDoc(dailyRewardRef);
    
    if (!snapshot.exists()) {
      // Initialize if not exists
      await getDailyRewardsData(db, userId);
      return updateTimeSpent(db, userId, minutesToAdd);
    }

    const data = snapshot.data();
    const newTimeSpent = (data.timeSpentMinutes || 0) + minutesToAdd;
    const timeTask = data.tasks?.[DAILY_TASKS.TIME_SPENT.id];
    
    // Check if time task should be unlocked
    const isTimeTaskUnlocked = newTimeSpent >= DAILY_TASKS.TIME_SPENT.requiredMinutes;
    const updatedTasks = { ...data.tasks };
    
    if (isTimeTaskUnlocked && timeTask?.status === 'locked') {
      updatedTasks[DAILY_TASKS.TIME_SPENT.id] = {
        ...timeTask,
        status: 'available',
        progress: newTimeSpent,
      };
    } else if (timeTask) {
      updatedTasks[DAILY_TASKS.TIME_SPENT.id] = {
        ...timeTask,
        progress: newTimeSpent,
      };
    }

    await updateDoc(dailyRewardRef, {
      timeSpentMinutes: newTimeSpent,
      tasks: updatedTasks,
      lastUpdatedAt: serverTimestamp(),
    });

    return {
      timeSpentMinutes: newTimeSpent,
      isTimeTaskUnlocked,
      progress: Math.min(100, (newTimeSpent / DAILY_TASKS.TIME_SPENT.requiredMinutes) * 100),
    };
  } catch (error) {
    console.error('Error updating time spent:', error);
    throw error;
  }
};

/**
 * Track activity completion (post, comment, etc.)
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {string} activityType - Type of activity ('post', 'comment', etc.)
 */
export const trackActivityCompletion = async (db, userId, activityType) => {
  if (!db || !userId || !activityType) return;

  const today = getTodayDate();
  const dailyRewardRef = doc(db, 'users', userId, 'dailyRewards', today);

  try {
    const snapshot = await getDoc(dailyRewardRef);
    if (!snapshot.exists()) {
      await getDailyRewardsData(db, userId);
      return trackActivityCompletion(db, userId, activityType);
    }

    const data = snapshot.data();
    const updatedTasks = { ...data.tasks };
    let taskUpdated = false;

    // Map activity types to task IDs
    const activityToTask = {
      'post': DAILY_TASKS.FIRST_POST.id,
      'comment': DAILY_TASKS.FIRST_COMMENT.id,
    };

    const taskId = activityToTask[activityType];
    if (taskId && updatedTasks[taskId]?.status === 'locked') {
      updatedTasks[taskId] = {
        ...updatedTasks[taskId],
        status: 'available',
        completed: true,
      };
      taskUpdated = true;
    }

    if (taskUpdated) {
      await updateDoc(dailyRewardRef, {
        tasks: updatedTasks,
        lastUpdatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error tracking activity:', error);
  }
};

/**
 * Record a successful friend invitation
 * @param {Object} db - Firestore instance
 * @param {string} userId - Inviter user ID
 * @param {string} invitedUserId - Invited user ID
 */
export const recordFriendInvite = async (db, userId, invitedUserId) => {
  if (!db || !userId || !invitedUserId) {
    throw new Error('Database, userId, and invitedUserId are required');
  }

  try {
    // Record the invite
    const inviteRef = doc(collection(db, 'users', userId, 'invites'));
    await setDoc(inviteRef, {
      invitedUserId,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error recording friend invite:', error);
    throw error;
  }
};

/**
 * Get user's invite count for today
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @returns {number} Number of successful invites today
 */
export const getTodayInviteCount = async (db, userId) => {
  if (!db || !userId) return 0;

  const today = getTodayDate();
  const todayStart = new Date(today);
  
  try {
    const invitesRef = collection(db, 'users', userId, 'invites');
    const q = query(
      invitesRef,
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    let todayCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.createdAt?.toDate() >= todayStart) {
        todayCount++;
      }
    });

    return todayCount;
  } catch (error) {
    console.error('Error getting invite count:', error);
    return 0;
  }
};

/**
 * Get streak bonus if user has earned one
 * @param {number} streak - Current streak
 * @returns {Object|null} Streak bonus info or null
 */
export const getStreakBonus = (streak) => {
  for (let i = STREAK_BONUSES.length - 1; i >= 0; i--) {
    if (streak === STREAK_BONUSES[i].days) {
      return STREAK_BONUSES[i];
    }
  }
  return null;
};

/**
 * Get next streak milestone
 * @param {number} streak - Current streak
 * @returns {Object} Next milestone info
 */
export const getNextStreakMilestone = (streak) => {
  for (const bonus of STREAK_BONUSES) {
    if (streak < bonus.days) {
      return {
        ...bonus,
        daysRemaining: bonus.days - streak,
      };
    }
  }
  return null;
};

/**
 * Unlock a locked task so it becomes claimable
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {string} taskId - Task ID to unlock
 */
export const unlockTask = async (db, userId, taskId) => {
  if (!db || !userId || !taskId) return;
  const today = getTodayDate();
  const dailyRewardRef = doc(db, 'users', userId, 'dailyRewards', today);
  try {
    const snapshot = await getDoc(dailyRewardRef);
    if (!snapshot.exists()) {
      await getDailyRewardsData(db, userId);
      return unlockTask(db, userId, taskId);
    }
    const data = snapshot.data();
    const taskData = data.tasks?.[taskId];
    if (!taskData || taskData.status !== 'locked') return;
    await updateDoc(dailyRewardRef, {
      [`tasks.${taskId}.status`]: 'available',
      lastUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error unlocking task:', error);
  }
};

/**
 * Get user's reward history
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {number} days - Number of days to fetch
 * @returns {Array} Reward history
 */
export const getRewardHistory = async (db, userId, days = 7) => {
  if (!db || !userId) return [];

  try {
    const rewardsRef = collection(db, 'users', userId, 'dailyRewards');
    const q = query(rewardsRef, orderBy('date', 'desc'), limit(days));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting reward history:', error);
    return [];
  }
};

export default {
  DAILY_TASKS,
  STREAK_BONUSES,
  getDailyRewardsData,
  subscribeToDailyRewards,
  claimTaskReward,
  updateTimeSpent,
  trackActivityCompletion,
  recordFriendInvite,
  getTodayInviteCount,
  unlockTask,
  getStreakBonus,
  getNextStreakMilestone,
  getRewardHistory,
  getTimeUntilMidnight,
  formatTimeRemaining,
};
