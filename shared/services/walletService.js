// Shared Wallet Service
// Platform-agnostic wallet operations
import { 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  increment,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Wallet Service
 * Handles all wallet operations (coins, diamonds, earnings, transactions)
 * 
 * Usage:
 * import { db, auth } from '../firebaseConfig';
 * import * as WalletService from '../shared/services/walletService';
 */

// ==================== GET OR CREATE WALLET ====================
export const getOrCreateWallet = async (db, userId) => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);

    if (walletSnap.exists()) {
      return { success: true, data: walletSnap.data() };
    } else {
      // Create initial wallet for new user
      const initialWallet = {
        userId,
        coins: 100, // Welcome bonus
        diamonds: 0,
        earningsBalance: 0,
        withdrawableBalance: 0,
        pendingEarnings: 0,
        lifetimeEarnings: 0,
        minimumWithdrawal: 50,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(walletRef, initialWallet);
      console.log('✅ Wallet created for user:', userId);
      return { success: true, data: initialWallet };
    }
  } catch (error) {
    console.error('❌ Get/Create wallet error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET WALLET ====================
export const getWallet = async (db, userId) => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);

    if (walletSnap.exists()) {
      return { success: true, data: walletSnap.data() };
    } else {
      return { success: false, error: 'Wallet not found' };
    }
  } catch (error) {
    console.error('❌ Get wallet error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE COINS ====================
export const updateCoins = async (db, userId, amount, reason = 'manual') => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    
    await updateDoc(walletRef, {
      coins: increment(amount),
      updatedAt: serverTimestamp()
    });

    // Create transaction record
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'coins',
      amount,
      reason,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Coins updated: ${amount > 0 ? '+' : ''}${amount}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Update coins error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE DIAMONDS ====================
export const updateDiamonds = async (db, userId, amount, reason = 'manual') => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    
    await updateDoc(walletRef, {
      diamonds: increment(amount),
      updatedAt: serverTimestamp()
    });

    // Create transaction record
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'diamonds',
      amount,
      reason,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Diamonds updated: ${amount > 0 ? '+' : ''}${amount}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Update diamonds error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== ADD EARNINGS ====================
export const addEarnings = async (db, userId, amount, source = 'unknown') => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    
    await updateDoc(walletRef, {
      earningsBalance: increment(amount),
      withdrawableBalance: increment(amount),
      lifetimeEarnings: increment(amount),
      updatedAt: serverTimestamp()
    });

    // Create transaction record
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'earning',
      amount,
      source,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Earnings added: $${amount}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Add earnings error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== DEDUCT COINS (FOR PURCHASES) ====================
export const deductCoins = async (db, userId, amount, reason = 'purchase') => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);

    if (!walletSnap.exists()) {
      return { success: false, error: 'Wallet not found' };
    }

    const currentCoins = walletSnap.data().coins || 0;

    if (currentCoins < amount) {
      return { success: false, error: 'Insufficient coins' };
    }

    await updateDoc(walletRef, {
      coins: increment(-amount),
      updatedAt: serverTimestamp()
    });

    // Create transaction record
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'coins',
      amount: -amount,
      reason,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Coins deducted: -${amount}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Deduct coins error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== DEDUCT DIAMONDS (FOR PURCHASES) ====================
export const deductDiamonds = async (db, userId, amount, reason = 'purchase') => {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);

    if (!walletSnap.exists()) {
      return { success: false, error: 'Wallet not found' };
    }

    const currentDiamonds = walletSnap.data().diamonds || 0;

    if (currentDiamonds < amount) {
      return { success: false, error: 'Insufficient diamonds' };
    }

    await updateDoc(walletRef, {
      diamonds: increment(-amount),
      updatedAt: serverTimestamp()
    });

    // Create transaction record
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'diamonds',
      amount: -amount,
      reason,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Diamonds deducted: -${amount}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Deduct diamonds error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET TRANSACTIONS ====================
export const getTransactions = async (db, userId, limitCount = 20) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, data: transactions };
  } catch (error) {
    console.error('❌ Get transactions error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== PURCHASE WITH COINS ====================
export const purchaseWithCoins = async (db, userId, amount, itemName, itemId) => {
  try {
    const result = await deductCoins(db, userId, amount, `purchase:${itemName}`);
    
    if (!result.success) {
      return result;
    }

    // Record purchase
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'purchase',
      currency: 'coins',
      amount: -amount,
      itemName,
      itemId,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Purchased ${itemName} for ${amount} coins`);
    return { success: true };
  } catch (error) {
    console.error('❌ Purchase error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== PURCHASE WITH DIAMONDS ====================
export const purchaseWithDiamonds = async (db, userId, amount, itemName, itemId) => {
  try {
    const result = await deductDiamonds(db, userId, amount, `purchase:${itemName}`);
    
    if (!result.success) {
      return result;
    }

    // Record purchase
    await addDoc(collection(db, 'transactions'), {
      userId,
      type: 'purchase',
      currency: 'diamonds',
      amount: -amount,
      itemName,
      itemId,
      timestamp: serverTimestamp()
    });

    console.log(`✅ Purchased ${itemName} for ${amount} diamonds`);
    return { success: true };
  } catch (error) {
    console.error('❌ Purchase error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== REWARD DAILY LOGIN ====================
export const rewardDailyLogin = async (db, userId) => {
  try {
    // Coins removed from daily login - earn via watching ads only
    const coinsReward = 0;
    if (coinsReward > 0) {
      await updateCoins(db, userId, coinsReward, 'daily_login');
    }
    
    console.log('✅ Daily login reward claimed');
    return { success: true, reward: coinsReward };
  } catch (error) {
    console.error('❌ Daily reward error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== REWARD AD WATCH ====================
export const rewardAdWatch = async (db, userId) => {
  try {
    const coinsReward = 5;
    await updateCoins(db, userId, coinsReward, 'ad_watch');
    
    console.log('✅ Ad watch reward claimed');
    return { success: true, reward: coinsReward };
  } catch (error) {
    console.error('❌ Ad reward error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== CHECK BALANCE ====================
export const checkBalance = async (db, userId, amount, currency = 'coins') => {
  try {
    const walletSnap = await getDoc(doc(db, 'wallets', userId));
    
    if (!walletSnap.exists()) {
      return { sufficient: false, currentBalance: 0 };
    }

    const currentBalance = walletSnap.data()[currency] || 0;
    
    return { 
      sufficient: currentBalance >= amount, 
      currentBalance 
    };
  } catch (error) {
    console.error('❌ Check balance error:', error);
    return { sufficient: false, currentBalance: 0 };
  }
};
