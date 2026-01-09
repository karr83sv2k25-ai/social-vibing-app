// services/kingMediaService.js - King Media API Integration (Complete Fixed Version)
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://beige-crane-665569.hostingersite.com/api';
const ADMIN_URL = 'https://beige-crane-665569.hostingersite.com/admin';

//================================
// ENHANCED FETCH FOR REACT NATIVE
//================================
const fetchWithConfig = async (url, options = {}, timeout = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers,
            },
            // Critical for React Native
            credentials: 'omit',
            mode: 'cors',
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
};

//================================
// AUTH APIs
//================================

export const authAPI = {
    login: async (email, password) => {
        try {
            console.log('📡 Attempting login...');

            const response = await fetchWithConfig(`${API_URL}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            console.log('✅ Login successful');

            if (data.success && data.token) {
                await AsyncStorage.setItem('kingmedia_jwt_token', data.token);
            }

            return data;
        } catch (error) {
            console.error('❌ Login Error:', error.message);
            throw error;
        }
    },

    me: async () => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            const response = await fetchWithConfig(`${API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to get user info');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Get User Error:', error.message);
            throw error;
        }
    },

    logout: async () => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            await fetchWithConfig(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
        } finally {
            await AsyncStorage.removeItem('kingmedia_jwt_token');
        }
    },
};

//================================
// AI APIs
//================================

export const aiAPI = {
    ask: async (question, provider = 'kingai') => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            if (!token) {
                throw new Error('Not authenticated. Please login first.');
            }

            console.log('📡 Sending AI question...');

            const response = await fetchWithConfig(`${API_URL}/ai/ask`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ question, provider }),
            }, 30000);

            console.log('📊 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error:', errorText);
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Answer received');
            return data;
        } catch (error) {
            console.error('❌ AI Ask Error:', error.message);
            throw error;
        }
    },

    generateImage: async (prompt, provider = 'dalle') => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            if (!token) {
                throw new Error('Not authenticated. Please login first.');
            }

            console.log('🎨 Generating image...');
            console.log('📝 Prompt:', prompt);

            const response = await fetchWithConfig(`${API_URL}/ai/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ prompt, provider }),
            }, 60000); // 60 second timeout

            console.log('📊 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Generation Error:', errorData);
                return errorData;
            }

            const data = await response.json();
            console.log('✅ Image generated:', data);
            return data;
        } catch (error) {
            console.error('❌ Image Generation Error:', error.message);

            if (error.message.includes('Network request failed') ||
                error.message.includes('timeout') ||
                error.message.includes('Failed to fetch')) {
                console.log('⚠️ API unreachable - Server may be down or network blocked');

                return {
                    success: false,
                    message: 'API server unreachable. Please check server status or use physical device.',
                    error: error.message
                };
            }

            throw error;
        }
    },

    // VIDEO GENERATION - CRITICAL: Provider must be 'veo3'
    generateVideo: async (prompt, provider = 'veo3') => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            if (!token) {
                throw new Error('Not authenticated. Please login first.');
            }

            console.log('🎬 Generating video...');
            console.log('📝 Prompt:', prompt);
            console.log('🔧 Provider:', provider);

            const response = await fetchWithConfig(`${API_URL}/ai/video`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ prompt, provider }),
            }, 60000); // 60 second timeout

            console.log('📊 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Video Generation Error:', errorData);
                return errorData;
            }

            const data = await response.json();
            console.log('✅ Video generation started');
            console.log('📦 Response data:', data);
            return data;
        } catch (error) {
            console.error('❌ Video Generation Error:', error.message);

            if (error.message.includes('Network request failed') ||
                error.message.includes('timeout') ||
                error.message.includes('Failed to fetch')) {
                console.log('⚠️ API unreachable - Server may be down or network blocked');
                console.log('💡 Solutions:');
                console.log('   1. Check if API server is running');
                console.log('   2. Use physical device instead of emulator');
                console.log('   3. Check firewall/network settings');

                return {
                    success: false,
                    message: 'API server unreachable. Please check:\n1. Server is running\n2. Network connection\n3. Firewall settings\n\nOr use physical device instead of emulator.',
                    error: error.message
                };
            }

            throw error;
        }
    },

    getJob: async (jobId) => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetchWithConfig(`${API_URL}/ai/jobs/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to get job status');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Get Job Error:', error.message);
            throw error;
        }
    },

    listJobs: async () => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            const response = await fetchWithConfig(`${API_URL}/ai/jobs`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to list jobs');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ List Jobs Error:', error.message);
            throw error;
        }
    },

    generateThumbnail: async (videoUrl) => {
        try {
            const token = await AsyncStorage.getItem('kingmedia_jwt_token');

            const response = await fetchWithConfig(`${API_URL}/ai/thumbnail`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ video_url: videoUrl }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate thumbnail');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Generate Thumbnail Error:', error.message);
            throw error;
        }
    },
};

//================================
// UTILITIES
//================================

export const getAdminURL = () => ADMIN_URL;

export const getRateLimitInfo = (error) => {
    if (error.response?.status === 429 || error.message?.includes('Rate limit')) {
        return {
            limited: true,
            message: 'Rate limit exceeded. Please try again later.',
        };
    }
    return { limited: false };
};

export const formatError = (error) => {
    return error.response?.data?.message || error.message || 'Something went wrong';
};
