// api/creatorAPI.js - Creator/seller dashboard endpoints
import apiClient from './client';

export const creatorAPI = {
    /**
     * Get seller statistics and analytics
     */
    getStats: () => {
        return apiClient.get('/creator/stats');
    },

    /**
     * Get seller's products (including drafts)
     * @param {Object} params
     * @param {string} params.status - 'draft', 'published', 'suspended'
     */
    getProducts: (params = {}) => {
        return apiClient.get('/creator/products', { params });
    },
};
