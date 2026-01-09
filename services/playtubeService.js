// services/playtubeService.js - PlayTube video platform integration
import apiClient from '../api/client';

/**
 * Service for integrating PlayTube video platform
 * Enables channel subscriptions and diamond tips (like Twitch bits)
 */
export const playtubeService = {
    /**
     * Get channel information
     * @param {string} channelId
     */
    async getChannel(channelId) {
        return apiClient.get(`/integrations/playtube/channels/${channelId}`);
    },

    /**
     * Get channel videos
     * @param {string} channelId
     * @param {Object} params
     */
    async getChannelVideos(channelId, params = {}) {
        return apiClient.get(`/integrations/playtube/channels/${channelId}/videos`, { params });
    },

    /**
     * Subscribe to channel with diamonds (premium subscription)
     * @param {Object} data
     * @param {string} data.channelId
     * @param {number} data.diamondsAmount - Diamond amount for subscription
     * @param {number} data.durationMonths - Subscription duration
     */
    async subscribe(data) {
        return apiClient.post('/integrations/playtube/subscribe', data);
    },

    /**
     * Tip channel creator with diamonds (like Twitch bits)
     * @param {Object} data
     * @param {string} data.channelId
     * @param {number} data.diamonds - Diamond amount
     * @param {string} data.message - Optional tip message
     */
    async tipChannel(data) {
        return apiClient.post('/integrations/playtube/tip', data);
    },

    /**
     * Get user's subscriptions
     */
    async getMySubscriptions() {
        return apiClient.get('/integrations/playtube/subscriptions');
    },

    /**
     * Check if user is subscribed to channel
     * @param {string} channelId
     */
    async checkSubscription(channelId) {
        return apiClient.get(`/integrations/playtube/subscriptions/${channelId}/status`);
    },

    /**
     * Get subscription tiers for a channel
     * @param {string} channelId
     */
    async getSubscriptionTiers(channelId) {
        return apiClient.get(`/integrations/playtube/channels/${channelId}/tiers`);
    },

    /**
     * Get tip leaderboard for channel
     * @param {string} channelId
     * @param {Object} params
     * @param {string} params.period - 'day', 'week', 'month', 'all'
     */
    async getTipLeaderboard(channelId, params = {}) {
        return apiClient.get(`/integrations/playtube/channels/${channelId}/leaderboard`, { params });
    },
};
