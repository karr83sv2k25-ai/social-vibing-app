// App-wide Constants
// Shared between mobile and web

// ==================== API & URLS ====================
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.yourapp.com';

// ==================== APP CONFIG ====================
export const APP_CONFIG = {
  name: 'Social Vibing',
  version: '1.0.0',
  minAge: 13,
  maxBioLength: 500,
  maxPostLength: 5000,
  maxUsernameLength: 20,
  minPasswordLength: 6,
  maxAnnouncements: 3, // Maximum pinned announcements per community
  maxFeaturedPosts: 10, // Maximum featured posts to display
};

// ==================== FIRESTORE COLLECTIONS ====================
export const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  COMMENTS: 'comments',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  COMMUNITIES: 'communities',
  STORIES: 'stories',
  MARKETPLACE: 'marketplace_products',
  ORDERS: 'marketplace_orders',
  POLLS: 'polls',
  QUIZZES: 'quizzes',
};

// ==================== USER ROLES ====================
export const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  VERIFIED: 'verified',
};

// ==================== POST TYPES ====================
export const POST_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  POLL: 'poll',
  LINK: 'link',
};

// ==================== NOTIFICATION TYPES ====================
export const NOTIFICATION_TYPES = {
  FOLLOW: 'follow',
  LIKE: 'like',
  COMMENT: 'comment',
  MENTION: 'mention',
  MESSAGE: 'message',
  POST: 'post',
  COMMUNITY_INVITE: 'community_invite',
};

// ==================== MEDIA TYPES ====================
export const MEDIA_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEO: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// ==================== FILE SIZE LIMITS ====================
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 50 * 1024 * 1024, // 50MB
  AUDIO: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 5 * 1024 * 1024, // 5MB
};

// ==================== PAGINATION ====================
export const PAGINATION = {
  POSTS_PER_PAGE: 10,
  USERS_PER_PAGE: 20,
  MESSAGES_PER_PAGE: 50,
  COMMENTS_PER_PAGE: 10,
};

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  AUTH_ERROR: 'Authentication error. Please login again.',
  PERMISSION_DENIED: 'You don\'t have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  FILE_TOO_LARGE: 'File size is too large.',
  INVALID_FILE_TYPE: 'Invalid file type.',
  REQUIRED_FIELD: 'This field is required.',
};

// ==================== SUCCESS MESSAGES ====================
export const SUCCESS_MESSAGES = {
  POST_CREATED: 'Post created successfully!',
  POST_UPDATED: 'Post updated successfully!',
  POST_DELETED: 'Post deleted successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  COMMENT_ADDED: 'Comment added successfully!',
  MESSAGE_SENT: 'Message sent successfully!',
  USER_FOLLOWED: 'User followed successfully!',
  USER_UNFOLLOWED: 'User unfollowed successfully!',
};

// ==================== REGEX PATTERNS ====================
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\d\s\-\+\(\)]{10,}$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  HASHTAG: /#[a-zA-Z0-9_]+/g,
  MENTION: /@[a-zA-Z0-9_]+/g,
};

// ==================== COINS & REWARDS ====================
export const REWARDS = {
  DAILY_LOGIN: 10,
  POST_CREATED: 5,
  COMMENT_ADDED: 2,
  PROFILE_COMPLETED: 50,
  FIRST_POST: 20,
  INVITE_FRIEND: 25,
};

// ==================== MEMBERSHIP TIERS ====================
export const MEMBERSHIP_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  VIP: 'vip',
};

// ==================== STORAGE PATHS ====================
export const STORAGE_PATHS = {
  PROFILE_PICTURES: 'profile_pictures',
  POST_IMAGES: 'post_images',
  POST_VIDEOS: 'post_videos',
  STORY_MEDIA: 'story_media',
  MESSAGE_MEDIA: 'message_media',
  COMMUNITY_IMAGES: 'community_images',
  MARKETPLACE_IMAGES: 'marketplace_images',
};

// ==================== TIME CONSTANTS ====================
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
};

// ==================== STORY DURATION ====================
export const STORY_DURATION = 24 * TIME.HOUR; // 24 hours

// ==================== COLORS (optional - can be platform-specific) ====================
export const COLORS = {
  PRIMARY: '#FF6B35',
  SECONDARY: '#004E89',
  SUCCESS: '#06D6A0',
  WARNING: '#FFD166',
  ERROR: '#EF476F',
  INFO: '#118AB2',
  BACKGROUND: '#FFFFFF',
  TEXT: '#000000',
};

// ==================== SOCKET EVENTS (if using real-time) ====================
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  NEW_MESSAGE: 'new_message',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
};
