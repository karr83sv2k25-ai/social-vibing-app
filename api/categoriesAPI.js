// api/categoriesAPI.js - Categories endpoints
import apiClient from './client';

export const categoriesAPI = {
    /**
     * Get all marketplace categories (8 monetization features)
     */
    getCategories: () => {
        return apiClient.get('/categories');
    },
};
