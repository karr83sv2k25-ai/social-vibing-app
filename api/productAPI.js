// api/productAPI.js - Product-related API calls
import apiClient from './client';

export const productAPI = {
    /**
     * Get paginated product listings
     * @param {Object} params - Query parameters
     * @param {string} params.type - Product type filter
     * @param {string} params.category - Category filter
     * @param {string} params.sort - Sort order
     * @param {string} params.search - Search query
     * @param {number} params.page - Page number
     * @param {number} params.limit - Items per page
     * @param {string} params.sellerId - Filter by seller
     */
    getProducts: (params = {}) => {
        return apiClient.get('/products', { params });
    },

    /**
     * Get single product details
     * @param {string} productId
     */
    getProduct: (productId) => {
        return apiClient.get(`/products/${productId}`);
    },

    /**
     * Create new product
     * @param {Object} data - Product data
     */
    createProduct: (data) => {
        return apiClient.post('/products', data);
    },

    /**
     * Update existing product
     * @param {string} productId
     * @param {Object} data - Updated product data
     */
    updateProduct: (productId, data) => {
        return apiClient.put(`/products/${productId}`, data);
    },

    /**
     * Delete/unpublish product
     * @param {string} productId
     */
    deleteProduct: (productId) => {
        return apiClient.delete(`/products/${productId}`);
    },

    /**
     * Get product reviews
     * @param {string} productId
     * @param {Object} params - Query parameters
     */
    getProductReviews: (productId, params = {}) => {
        return apiClient.get(`/products/${productId}/reviews`, { params });
    },

    /**
     * Create order (purchase product)
     * @param {Object} data
     * @param {string} data.productId
     * @param {string} data.paymentMethod
     */
    createOrder: (data) => {
        return apiClient.post('/orders', data);
    },

    /**
     * Get user's orders
     * @param {Object} params
     * @param {string} params.type - 'purchases' or 'sales'
     * @param {string} params.status
     * @param {number} params.page
     */
    getOrders: (params = {}) => {
        return apiClient.get('/orders', { params });
    },

    /**
     * Get single order details
     * @param {string} orderId
     */
    getOrder: (orderId) => {
        return apiClient.get(`/orders/${orderId}`);
    },

    /**
     * Submit review for purchased product
     * @param {string} orderId
     * @param {Object} data
     * @param {number} data.rating - 1-5
     * @param {string} data.comment
     */
    submitReview: (orderId, data) => {
        return apiClient.post(`/orders/${orderId}/review`, data);
    },

    /**
     * Get secure download link
     * @param {string} orderId
     */
    getDownloadLink: (orderId) => {
        return apiClient.get(`/orders/${orderId}/download`);
    },

    /**
     * Upload asset file
     * @param {string} uri - File URI
     * @param {string} type - File type: 'image', 'video', 'pdf', 'zip'
     */
    uploadAsset: async (uri, type) => {
        const formData = new FormData();

        // Extract file name and extension
        const uriParts = uri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        const fileExtension = fileName.split('.').pop() || 'dat';

        // Determine MIME type
        let mimeType = 'application/octet-stream';
        if (type === 'image') {
            mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
        } else if (type === 'video') {
            mimeType = 'video/mp4';
        } else if (type === 'pdf') {
            mimeType = 'application/pdf';
        } else if (type === 'zip') {
            mimeType = 'application/zip';
        }

        formData.append('file', {
            uri,
            type: mimeType,
            name: fileName || `upload_${Date.now()}.${fileExtension}`,
        });
        formData.append('type', type);

        return apiClient.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 60000, // 60 seconds for file uploads
        });
    },

    /**
     * Report a product
     * @param {string} productId
     * @param {Object} data
     * @param {string} data.reason
     * @param {string} data.details
     */
    reportProduct: (productId, data) => {
        return apiClient.post(`/products/${productId}/report`, data);
    },
};
