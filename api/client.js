// api/client.js - Base API client with authentication
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your actual backend URL
const API_BASE_URL = __DEV__
    ? 'http://localhost:3000/api/v1'
    : 'https://api.socialvibing.com/v1';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Failed to get auth token:', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
    (response) => {
        // Return the data directly
        return response.data;
    },
    async (error) => {
        if (error.response) {
            const { status, data } = error.response;

            // Handle 401 Unauthorized - logout user
            if (status === 401) {
                await AsyncStorage.removeItem('authToken');
                // TODO: Navigate to login screen
                // You can emit an event here or use a global navigation ref
            }

            // Handle 429 Rate Limit
            if (status === 429) {
                console.warn('Rate limit exceeded');
            }

            // Return structured error
            return Promise.reject(data || { error: { code: 'UNKNOWN_ERROR', message: error.message } });
        }

        // Network error
        if (error.request) {
            return Promise.reject({
                error: {
                    code: 'NETWORK_ERROR',
                    message: 'Unable to connect to server. Please check your internet connection.',
                },
            });
        }

        // Other errors
        return Promise.reject({
            error: {
                code: 'REQUEST_ERROR',
                message: error.message,
            },
        });
    }
);

export default apiClient;
