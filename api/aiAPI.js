// api/aiAPI.js - AI image generation endpoints
import apiClient from './client';

export const aiAPI = {
    /**
     * Generate AI image (text-to-image or image-to-image)
     * @param {Object} data
     * @param {string} data.type - 'text_to_image' or 'image_to_image'
     * @param {string} data.prompt - Text prompt
     * @param {string} data.negativePrompt - Optional negative prompt
     * @param {string} data.inputImage - Image URL for image-to-image
     * @param {string} data.model - Leonardo model name
     * @param {number} data.width - Image width
     * @param {number} data.height - Image height
     * @param {number} data.steps - Generation steps
     * @param {number} data.guidanceScale - Guidance scale
     */
    generateImage: (data) => {
        return apiClient.post('/ai/generate', data);
    },

    /**
     * Check AI generation status
     * @param {string} generationId
     */
    getGeneration: (generationId) => {
        return apiClient.get(`/ai/generate/${generationId}`);
    },

    /**
     * Get user's generation history
     * @param {Object} params
     * @param {number} params.page
     * @param {number} params.limit
     */
    getHistory: (params = {}) => {
        return apiClient.get('/ai/history', { params });
    },

    /**
     * Get AI generation pricing tiers
     */
    getPricing: () => {
        return apiClient.get('/ai/pricing');
    },
};
