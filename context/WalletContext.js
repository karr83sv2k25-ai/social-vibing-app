// context/WalletContext.js - Global wallet state management
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, increment } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDocWithRetry, getDocsWithRetry, setDocWithRetry } from '../utils/firestoreHelpers';

const WalletContext = createContext();

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within WalletProvider');
    }
    return context;
};

export const WalletProvider = ({ children }) => {
    const [wallet, setWallet] = useState({
        walletId: null,
        coins: 0,
        diamonds: 0,
        earningsBalance: 0,
        withdrawableBalance: 0,
        pendingEarnings: 0,
        lifetimeEarnings: 0,
        minimumWithdrawal: 50,
        loading: true,
    });

    const [transactions, setTransactions] = useState([]);

    // Get current user ID
    const getUserId = () => {
        const auth = getAuth();
        return auth.currentUser?.uid;
    };

    // Fetch wallet data from Firestore
    const fetchWallet = async () => {
        try {
            const userId = getUserId();
            if (!userId) {
                console.log('No user logged in, skipping wallet fetch');
                setWallet((prev) => ({ ...prev, loading: false }));
                return;
            }

            // Try cache first for instant UI
            const cached = await AsyncStorage.getItem('wallet');
            if (cached) {
                const cachedData = JSON.parse(cached);
                setWallet({ ...cachedData, walletId: userId, loading: false });
                console.log('💰 Using cached wallet data');
            }

            const walletRef = doc(db, 'wallets', userId);
            const walletSnap = await getDocWithRetry(walletRef, {
                timeout: 8000,
                retries: 2,
                silentFail: true,
            });

            if (walletSnap?.exists()) {
                const data = walletSnap.data();
                const walletData = {
                    walletId: userId,
                    coins: data.coins || 0,
                    diamonds: data.diamonds || 0,
                    earningsBalance: data.earningsBalance || 0,
                    withdrawableBalance: data.withdrawableBalance || 0,
                    pendingEarnings: data.pendingEarnings || 0,
                    lifetimeEarnings: data.lifetimeEarnings || 0,
                    minimumWithdrawal: data.minimumWithdrawal || 50,
                    loading: false,
                };
                setWallet(walletData);
                // Cache wallet data
                await AsyncStorage.setItem('wallet', JSON.stringify(data));
                console.log('✅ Wallet data loaded successfully');
            } else if (walletSnap) {
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
                await setDocWithRetry(walletRef, initialWallet, {
                    timeout: 10000,
                    retries: 2,
                });
                setWallet({ ...initialWallet, walletId: userId, loading: false });
                console.log('✅ New wallet created');
            } else {
                // Firestore unavailable, keep using cached data
                console.log('📴 Firestore unavailable, using cached wallet');
                setWallet((prev) => ({ ...prev, loading: false }));
            }
        } catch (error) {
            console.warn('⚠️ Failed to fetch wallet:', error.message || error.code);
            // Keep cached data loaded earlier
            setWallet((prev) => ({ ...prev, loading: false }));
        }
    };

    // Fetch transaction history from Firestore
    const fetchTransactions = async (pageLimit = 20, filters = {}) => {
        try {
            const userId = getUserId();
            if (!userId) return;

            const transactionsRef = collection(db, 'transactions');
            let q = query(
                transactionsRef,
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(pageLimit)
            );

            // Apply filters
            if (filters.type) {
                q = query(q, where('type', '==', filters.type));
            }

            const snapshot = await getDocsWithRetry(q, {
                timeout: 8000,
                retries: 2,
                silentFail: true,
            });

            if (snapshot) {
                const txs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setTransactions(txs);
                console.log('✅ Transactions loaded successfully');
            } else {
                console.log('📴 Could not load transactions (offline)');
            }
        } catch (error) {
            console.warn('⚠️ Failed to fetch transactions:', error.message);
        }
    };

    // ===== COIN OPERATIONS =====

    // Deduct coins (for AI generation)
    const deductCoins = async (amount, description = 'Coins spent') => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        if (wallet.coins < amount) {
            throw new Error('INSUFFICIENT_COINS');
        }

        try {
            // Optimistically update UI
            setWallet((prev) => ({
                ...prev,
                coins: prev.coins - amount,
            }));

            // Update Firestore
            const walletRef = doc(db, 'wallets', userId);
            await updateDoc(walletRef, {
                coins: increment(-amount),
                updatedAt: serverTimestamp(),
            });

            // Record transaction
            await addDoc(collection(db, 'transactions'), {
                userId,
                type: 'coin_deduction',
                amount: -amount,
                description,
                currency: 'coins',
                createdAt: serverTimestamp(),
            });

            return true;
        } catch (error) {
            // Rollback optimistic update
            setWallet((prev) => ({
                ...prev,
                coins: prev.coins + amount,
            }));
            throw error;
        }
    };

    // Add coins (from purchase, ads, daily reward)
    const addCoins = async (amount, source = 'purchase', description = 'Coins added') => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        try {
            setWallet((prev) => ({
                ...prev,
                coins: prev.coins + amount,
            }));

            const walletRef = doc(db, 'wallets', userId);
            await updateDoc(walletRef, {
                coins: increment(amount),
                updatedAt: serverTimestamp(),
            });

            // Record transaction
            await addDoc(collection(db, 'transactions'), {
                userId,
                type: 'coin_addition',
                amount,
                description,
                source,
                currency: 'coins',
                createdAt: serverTimestamp(),
            });

            return true;
        } catch (error) {
            setWallet((prev) => ({
                ...prev,
                coins: prev.coins - amount,
            }));
            throw error;
        }
    };

    // Claim daily reward
    const claimDailyReward = async () => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        try {
            // Check if already claimed today
            const rewardsRef = collection(db, 'dailyRewards');
            const today = new Date().toISOString().split('T')[0];
            const q = query(
                rewardsRef,
                where('userId', '==', userId),
                where('claimedDate', '==', today)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                throw new Error('ALREADY_CLAIMED_TODAY');
            }

            const rewardCoins = 50; // Daily reward amount

            // Add coins
            await addCoins(rewardCoins, 'daily_reward', 'Daily login reward');

            // Record daily reward
            await addDoc(rewardsRef, {
                userId,
                claimedDate: today,
                coinsEarned: rewardCoins,
                createdAt: serverTimestamp(),
            });

            return { totalCoins: rewardCoins };
        } catch (error) {
            throw error;
        }
    };

    // Claim ad reward
    const claimAdReward = async (adData = {}) => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        try {
            const rewardCoins = 10; // Ad reward amount

            await addCoins(rewardCoins, 'ad_reward', 'Watched advertisement');

            // Record ad reward
            await addDoc(collection(db, 'adRewards'), {
                userId,
                coinsEarned: rewardCoins,
                adId: adData.adId || null,
                adType: adData.adType || 'rewarded',
                createdAt: serverTimestamp(),
            });

            return { coinsEarned: rewardCoins };
        } catch (error) {
            throw error;
        }
    };

    // ===== DIAMOND OPERATIONS =====

    // Deduct diamonds (for product purchases)
    const deductDiamonds = async (amount, productId, description = 'Product purchase') => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        if (wallet.diamonds < amount) {
            throw new Error('INSUFFICIENT_DIAMONDS');
        }

        try {
            // Optimistically update UI
            setWallet((prev) => ({
                ...prev,
                diamonds: prev.diamonds - amount,
            }));

            // Update Firestore
            const walletRef = doc(db, 'wallets', userId);
            await updateDoc(walletRef, {
                diamonds: increment(-amount),
                updatedAt: serverTimestamp(),
            });

            // Record transaction
            await addDoc(collection(db, 'transactions'), {
                userId,
                type: 'diamond_deduction',
                amount: -amount,
                description,
                currency: 'diamonds',
                productId,
                createdAt: serverTimestamp(),
            });

            return true;
        } catch (error) {
            // Rollback
            setWallet((prev) => ({
                ...prev,
                diamonds: prev.diamonds + amount,
            }));
            throw error;
        }
    };

    // Add diamonds to earnings (when seller makes a sale)
    const addEarnings = async (amount, orderId, description = 'Product sale') => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        try {
            setWallet((prev) => ({
                ...prev,
                earningsBalance: prev.earningsBalance + amount,
                withdrawableBalance: prev.withdrawableBalance + amount,
                lifetimeEarnings: prev.lifetimeEarnings + amount,
            }));

            const walletRef = doc(db, 'wallets', userId);
            await updateDoc(walletRef, {
                earningsBalance: increment(amount),
                withdrawableBalance: increment(amount),
                lifetimeEarnings: increment(amount),
                updatedAt: serverTimestamp(),
            });

            // Record transaction
            await addDoc(collection(db, 'transactions'), {
                userId,
                type: 'earnings',
                amount,
                description,
                currency: 'diamonds',
                orderId,
                createdAt: serverTimestamp(),
            });

            return true;
        } catch (error) {
            // Rollback
            setWallet((prev) => ({
                ...prev,
                earningsBalance: prev.earningsBalance - amount,
                withdrawableBalance: prev.withdrawableBalance - amount,
                lifetimeEarnings: prev.lifetimeEarnings - amount,
            }));
            throw error;
        }
    };

    // Purchase coins or diamonds
    const purchaseCurrency = async (packageId, currencyType, amount, paymentMethod, paymentToken) => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        try {
            // For now, just add the currency (IAP verification would happen here)
            if (currencyType === 'coins') {
                await addCoins(amount, 'purchase', `Purchased ${amount} coins`);
            } else if (currencyType === 'diamonds') {
                const walletRef = doc(db, 'wallets', userId);
                await updateDoc(walletRef, {
                    diamonds: increment(amount),
                    updatedAt: serverTimestamp(),
                });

                setWallet((prev) => ({
                    ...prev,
                    diamonds: prev.diamonds + amount,
                }));

                await addDoc(collection(db, 'transactions'), {
                    userId,
                    type: 'diamond_purchase',
                    amount,
                    description: `Purchased ${amount} diamonds`,
                    currency: 'diamonds',
                    paymentMethod,
                    createdAt: serverTimestamp(),
                });
            }

            await fetchWallet(); // Refresh
            return { success: true, amount, currencyType };
        } catch (error) {
            throw error;
        }
    };

    // Request withdrawal
    const requestWithdrawal = async (amount, method, payoutDetails) => {
        const userId = getUserId();
        if (!userId) throw new Error('USER_NOT_LOGGED_IN');

        if (wallet.withdrawableBalance < amount) {
            throw new Error('INSUFFICIENT_BALANCE');
        }

        if (amount < wallet.minimumWithdrawal) {
            throw new Error('BELOW_MINIMUM');
        }

        try {
            // Update wallet
            setWallet((prev) => ({
                ...prev,
                withdrawableBalance: prev.withdrawableBalance - amount,
            }));

            const walletRef = doc(db, 'wallets', userId);
            await updateDoc(walletRef, {
                withdrawableBalance: increment(-amount),
                updatedAt: serverTimestamp(),
            });

            // Create withdrawal request
            const withdrawalRef = await addDoc(collection(db, 'withdrawals'), {
                userId,
                amount,
                method,
                status: 'pending',
                ...payoutDetails,
                requestedAt: serverTimestamp(),
            });

            // Record transaction
            await addDoc(collection(db, 'transactions'), {
                userId,
                type: 'withdrawal_request',
                amount: -amount,
                description: `Withdrawal request via ${method}`,
                currency: 'diamonds',
                withdrawalId: withdrawalRef.id,
                createdAt: serverTimestamp(),
            });

            return { withdrawalId: withdrawalRef.id, status: 'pending' };
        } catch (error) {
            // Rollback
            setWallet((prev) => ({
                ...prev,
                withdrawableBalance: prev.withdrawableBalance + amount,
            }));
            throw error;
        }
    };

    // Check if user can withdraw
    const canWithdraw = () => {
        return wallet.withdrawableBalance >= wallet.minimumWithdrawal;
    };

    // Get formatted balance
    const getFormattedBalance = (type = 'coins') => {
        const amount = wallet[type] || 0;
        return new Intl.NumberFormat('en-US').format(amount);
    };

    // Initial load
    useEffect(() => {
        fetchWallet();
    }, []);

    const value = {
        // State
        wallet,
        transactions,
        loading: wallet.loading,

        // Methods
        fetchWallet,
        fetchTransactions,

        // Coins
        deductCoins,
        addCoins,
        claimDailyReward,
        claimAdReward,

        // Diamonds
        deductDiamonds,
        addEarnings,

        // Purchases & Withdrawals
        purchaseCurrency,
        requestWithdrawal,
        canWithdraw,

        // Utilities
        getFormattedBalance,
    };

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
