// services/komikoService.js - Komiko comic creation integration
import apiClient from '../api/client';

/**
 * Service for integrating Komiko comic/manga creation tool
 * Enables creators to build comics and publish them as marketplace products
 */
export const komikoService = {
    /**
     * Create new comic project
     * @param {Object} data
     * @param {string} data.title
     * @param {string} data.description
     * @param {string} data.genre
     * @param {string} data.language
     */
    async createComic(data) {
        return apiClient.post('/integrations/komiko/comic/create', data);
    },

    /**
     * Get comic project
     * @param {string} comicId
     */
    async getComic(comicId) {
        return apiClient.get(`/integrations/komiko/comic/${comicId}`);
    },

    /**
     * Upload comic pages
     * @param {string} comicId
     * @param {Array} pages - Array of page objects
     */
    async uploadPages(comicId, pages) {
        const formData = new FormData();

        pages.forEach((page, index) => {
            formData.append('pages', {
                uri: page.uri,
                type: 'image/jpeg',
                name: `page_${index + 1}.jpg`,
            });
            formData.append('pageNumbers', page.pageNumber || index + 1);
        });

        return apiClient.post(`/integrations/komiko/comic/${comicId}/pages`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    /**
     * Update comic page
     * @param {string} comicId
     * @param {number} pageNumber
     * @param {Object} data - Page data
     */
    async updatePage(comicId, pageNumber, data) {
        return apiClient.put(`/integrations/komiko/comic/${comicId}/pages/${pageNumber}`, data);
    },

    /**
     * Delete comic page
     * @param {string} comicId
     * @param {number} pageNumber
     */
    async deletePage(comicId, pageNumber) {
        return apiClient.delete(`/integrations/komiko/comic/${comicId}/pages/${pageNumber}`);
    },

    /**
     * Export comic as PDF or CBZ
     * @param {string} comicId
     * @param {string} format - 'pdf' or 'cbz'
     */
    async exportComic(comicId, format = 'pdf') {
        return apiClient.post(`/integrations/komiko/comic/${comicId}/export`, { format });
    },

    /**
     * Publish comic to marketplace
     * This creates a marketplace product from the comic
     * @param {string} comicId
     * @param {Object} data
     * @param {number} data.price
     * @param {string} data.currency
     * @param {string} data.coverImage
     */
    async publishToMarketplace(comicId, data) {
        return apiClient.post(`/integrations/komiko/comic/${comicId}/publish`, data);
    },

    /**
     * Get user's comic projects
     */
    async getMyComics() {
        return apiClient.get('/integrations/komiko/comics');
    },
};
