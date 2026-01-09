// services/freelanceService.js - Freelance marketplace integration (Viserlance/Hirezy)
import apiClient from '../api/client';

/**
 * Service for integrating freelance marketplace functionality
 * Wraps calls to Viserlance or Hirezy backend
 */
export const freelanceService = {
    /**
     * Get freelance gigs
     * @param {Object} params
     * @param {string} params.category - Gig category
     * @param {string} params.search - Search query
     * @param {string} params.sort - Sort order
     * @param {number} params.page
     * @param {number} params.limit
     */
    async getGigs(params = {}) {
        return apiClient.get('/integrations/freelance/gigs', { params });
    },

    /**
     * Get single gig details
     * @param {string} gigId
     */
    async getGigDetail(gigId) {
        return apiClient.get(`/integrations/freelance/gigs/${gigId}`);
    },

    /**
     * Create freelance order
     * @param {Object} data
     * @param {string} data.gigId
     * @param {string} data.requirements - Order requirements/instructions
     * @param {Object} data.customFields - Any custom fields
     */
    async createOrder(data) {
        return apiClient.post('/integrations/freelance/orders', data);
    },

    /**
     * Get freelance orders
     * @param {Object} params
     * @param {string} params.type - 'buyer' or 'seller'
     * @param {string} params.status
     */
    async getOrders(params = {}) {
        return apiClient.get('/integrations/freelance/orders', { params });
    },

    /**
     * Get single order details
     * @param {string} orderId
     */
    async getOrderDetail(orderId) {
        return apiClient.get(`/integrations/freelance/orders/${orderId}`);
    },

    /**
     * Seller delivers work
     * @param {string} orderId
     * @param {Object} data
     * @param {string} data.message
     * @param {Array} data.deliverables - Array of {fileName, url}
     */
    async deliverWork(orderId, data) {
        return apiClient.post(`/freelance/orders/${orderId}/deliver`, data);
    },

    /**
     * Buyer marks order as complete
     * @param {string} orderId
     * @param {Object} data
     * @param {number} data.rating
     * @param {string} data.review
     */
    async completeOrder(orderId, data) {
        return apiClient.post(`/freelance/orders/${orderId}/complete`, data);
    },

    /**
     * Open dispute for order
     * @param {string} orderId
     * @param {Object} data
     * @param {string} data.reason
     * @param {string} data.details
     */
    async openDispute(orderId, data) {
        return apiClient.post(`/freelance/orders/${orderId}/dispute`, data);
    },

    /**
     * Get freelance categories
     */
    async getCategories() {
        return apiClient.get('/integrations/freelance/categories');
    },

    /**
     * Get seller profile
     * @param {string} sellerId
     */
    async getSellerProfile(sellerId) {
        return apiClient.get(`/integrations/freelance/sellers/${sellerId}`);
    },
};
