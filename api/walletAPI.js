// api/walletAPI.js - Wallet and currency operations
import apiClient from './client';

export const walletAPI = {
    /**
     * Get user's wallet balances
     */
    getWallet: () => {
        return apiClient.get('/wallet');
    },

    /**
     * Get transaction history
     * @param {Object} params
     * @param {string} params.type - Transaction type filter
     * @param {string} params.currency - 'coins' or 'diamonds'
     * @param {number} params.page
     * @param {number} params.limit
     */
    getTransactions: (params = {}) => {
        return apiClient.get('/wallet/transactions', { params });
    },

    /**
     * Purchase coins via IAP
     * @param {Object} data
     * @param {string} data.packageId - Package identifier
     * @param {string} data.paymentMethod - 'stripe', 'apple_iap', 'google_iap'
     * @param {string} data.paymentToken - Payment/receipt token
     */
    purchaseCoins: (data) => {
        return apiClient.post('/wallet/coins/purchase', data);
    },

    /**
     * Claim daily login reward
     */
    claimDailyReward: () => {
        return apiClient.post('/wallet/daily-reward');
    },

    /**
     * Claim rewarded ad coins
     * @param {Object} data
     * @param {string} data.adType - 'rewarded_video', 'interstitial'
     * @param {string} data.adProvider - 'admob', 'unity_ads'
     * @param {string} data.adId - Ad tracking ID
     */
    claimAdReward: (data) => {
        return apiClient.post('/wallet/ad-reward', data);
    },

    /**
     * Request withdrawal
     * @param {Object} data
     * @param {number} data.amount - Amount in diamonds
     * @param {string} data.method - 'paypal', 'cashapp', 'bank'
     * @param {string} data.paypalEmail - For PayPal withdrawals
     * @param {string} data.cashappTag - For CashApp withdrawals
     */
    requestWithdrawal: (data) => {
        return apiClient.post('/withdrawals', data);
    },

    /**
     * Get withdrawal history
     * @param {Object} params
     */
    getWithdrawals: (params = {}) => {
        return apiClient.get('/withdrawals', { params });
    },

    /**
     * Get single withdrawal status
     * @param {string} withdrawalId
     */
    getWithdrawal: (withdrawalId) => {
        return apiClient.get(`/withdrawals/${withdrawalId}`);
    },
};
