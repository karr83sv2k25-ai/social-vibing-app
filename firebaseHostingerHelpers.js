/**
 * Firebase + Hostinger Helper Functions
 * Common patterns for uploading media and saving to Firestore
 */

import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import {
  uploadImageToHostinger,
  uploadVideoToHostinger,
  uploadAudioToHostinger,
} from './hostingerConfig';

// ============================================
// USER OPERATIONS
// ============================================

/**
 * Update user profile picture
 * @param {string} userId - User ID
 * @param {string} imageUri - Local image URI
 * @returns {Promise<string>} - Uploaded image URL
 */
export const updateUserProfilePicture = async (userId, imageUri) => {
  try {
    // 1. Upload to Hostinger
    const imageUrl = await uploadImageToHostinger(imageUri, 'user_profiles');

    // 2. Update Firestore
    await updateDoc(doc(db, 'users', userId), {
      profileImageUrl: imageUrl,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Profile picture updated:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('❌ Error updating profile picture:', error);
    throw error;
  }
};

/**
 * Update user cover image
 * @param {string} userId - User ID
 * @param {string} imageUri - Local image URI
 * @returns {Promise<string>} - Uploaded image URL
 */
export const updateUserCoverImage = async (userId, imageUri) => {
  try {
    const imageUrl = await uploadImageToHostinger(imageUri, 'covers');

    await updateDoc(doc(db, 'users', userId), {
      coverImageUrl: imageUrl,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Cover image updated:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('❌ Error updating cover image:', error);
    throw error;
  }
};

// ============================================
// COMMUNITY OPERATIONS
// ============================================

/**
 * Create community with images
 * @param {object} communityData - Community data
 * @param {string} profileImageUri - Profile image URI (optional)
 * @param {string} coverImageUri - Cover image URI (optional)
 * @returns {Promise<string>} - Created community ID
 */
export const createCommunityWithImages = async (
  communityData,
  profileImageUri = null,
  coverImageUri = null
) => {
  try {
    let profileImageUrl = null;
    let coverImageUrl = null;

    // Upload images to Hostinger
    if (profileImageUri) {
      profileImageUrl = await uploadImageToHostinger(profileImageUri, 'community_profiles');
    }

    if (coverImageUri) {
      coverImageUrl = await uploadImageToHostinger(coverImageUri, 'community_covers');
    }

    // Create community in Firestore
    const communityRef = await addDoc(collection(db, 'communities'), {
      ...communityData,
      profileImageUrl,
      coverImageUrl,
      createdAt: serverTimestamp(),
      memberCount: 1,
      creatorId: auth.currentUser?.uid,
    });

    console.log('✅ Community created:', communityRef.id);
    return communityRef.id;
  } catch (error) {
    console.error('❌ Error creating community:', error);
    throw error;
  }
};

/**
 * Update community images
 * @param {string} communityId - Community ID
 * @param {string} imageUri - Image URI
 * @param {string} imageType - 'profile' or 'cover'
 * @returns {Promise<string>} - Uploaded image URL
 */
export const updateCommunityImage = async (communityId, imageUri, imageType = 'profile') => {
  try {
    const folder = imageType === 'profile' ? 'community_profiles' : 'community_covers';
    const imageUrl = await uploadImageToHostinger(imageUri, folder);

    const updateField = imageType === 'profile' ? 'profileImageUrl' : 'coverImageUrl';
    await updateDoc(doc(db, 'communities', communityId), {
      [updateField]: imageUrl,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Community ${imageType} image updated:`, imageUrl);
    return imageUrl;
  } catch (error) {
    console.error(`❌ Error updating community ${imageType} image:`, error);
    throw error;
  }
};

// ============================================
// MESSAGE OPERATIONS
// ============================================

/**
 * Send text message
 * @param {string} chatId - Chat ID
 * @param {string} text - Message text
 * @returns {Promise<string>} - Message ID
 */
export const sendTextMessage = async (chatId, text) => {
  try {
    const messageRef = await addDoc(collection(db, 'messages'), {
      chatId,
      senderId: auth.currentUser?.uid,
      text,
      messageType: 'text',
      createdAt: serverTimestamp(),
      isRead: false,
    });

    console.log('✅ Text message sent:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Error sending text message:', error);
    throw error;
  }
};

/**
 * Send image message
 * @param {string} chatId - Chat ID
 * @param {string} imageUri - Local image URI
 * @param {string} caption - Optional caption
 * @returns {Promise<string>} - Message ID
 */
export const sendImageMessage = async (chatId, imageUri, caption = '') => {
  try {
    // Upload image to Hostinger
    const imageUrl = await uploadImageToHostinger(imageUri, 'chat_images');

    // Save message to Firestore
    const messageRef = await addDoc(collection(db, 'messages'), {
      chatId,
      senderId: auth.currentUser?.uid,
      text: caption,
      mediaUrl: imageUrl,
      mediaType: 'image',
      messageType: 'image',
      createdAt: serverTimestamp(),
      isRead: false,
    });

    console.log('✅ Image message sent:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Error sending image message:', error);
    throw error;
  }
};

/**
 * Send video message
 * @param {string} chatId - Chat ID
 * @param {string} videoUri - Local video URI
 * @param {string} caption - Optional caption
 * @returns {Promise<string>} - Message ID
 */
export const sendVideoMessage = async (chatId, videoUri, caption = '') => {
  try {
    // Upload video to Hostinger
    const videoUrl = await uploadVideoToHostinger(videoUri, 'chat_videos');

    // Save message to Firestore
    const messageRef = await addDoc(collection(db, 'messages'), {
      chatId,
      senderId: auth.currentUser?.uid,
      text: caption,
      mediaUrl: videoUrl,
      mediaType: 'video',
      messageType: 'video',
      createdAt: serverTimestamp(),
      isRead: false,
    });

    console.log('✅ Video message sent:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Error sending video message:', error);
    throw error;
  }
};

/**
 * Send voice message
 * @param {string} chatId - Chat ID
 * @param {string} audioUri - Local audio URI
 * @param {number} duration - Audio duration in seconds (optional)
 * @returns {Promise<string>} - Message ID
 */
export const sendVoiceMessage = async (chatId, audioUri, duration = 0) => {
  try {
    // Upload audio to Hostinger
    const audioUrl = await uploadAudioToHostinger(audioUri, 'voice_messages');

    // Save message to Firestore
    const messageRef = await addDoc(collection(db, 'messages'), {
      chatId,
      senderId: auth.currentUser?.uid,
      text: '[Voice Message]',
      mediaUrl: audioUrl,
      mediaType: 'audio',
      messageType: 'audio',
      duration,
      createdAt: serverTimestamp(),
      isRead: false,
    });

    console.log('✅ Voice message sent:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Error sending voice message:', error);
    throw error;
  }
};

/**
 * Send generic media message
 * @param {string} chatId - Chat ID
 * @param {string} mediaUri - Local media URI
 * @param {string} mediaType - 'image', 'video', or 'audio'
 * @param {string} caption - Optional caption/text
 * @returns {Promise<string>} - Message ID
 */
export const sendMediaMessage = async (chatId, mediaUri, mediaType, caption = '') => {
  try {
    let mediaUrl;
    let folder;

    // Upload based on type
    switch (mediaType) {
      case 'image':
        folder = 'chat_images';
        mediaUrl = await uploadImageToHostinger(mediaUri, folder);
        break;
      case 'video':
        folder = 'chat_videos';
        mediaUrl = await uploadVideoToHostinger(mediaUri, folder);
        break;
      case 'audio':
        folder = 'voice_messages';
        mediaUrl = await uploadAudioToHostinger(mediaUri, folder);
        break;
      default:
        throw new Error(`Unsupported media type: ${mediaType}`);
    }

    // Save to Firestore
    const messageRef = await addDoc(collection(db, 'messages'), {
      chatId,
      senderId: auth.currentUser?.uid,
      text: caption || (mediaType === 'audio' ? '[Voice Message]' : ''),
      mediaUrl,
      mediaType,
      messageType: mediaType,
      createdAt: serverTimestamp(),
      isRead: false,
    });

    console.log(`✅ ${mediaType} message sent:`, messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error(`❌ Error sending ${mediaType} message:`, error);
    throw error;
  }
};

// ============================================
// ROLEPLAY OPERATIONS
// ============================================

/**
 * Create roleplay character with image
 * @param {object} characterData - Character data
 * @param {string} imageUri - Character image URI (optional)
 * @returns {Promise<string>} - Character ID
 */
export const createRoleplayCharacter = async (characterData, imageUri = null) => {
  try {
    let characterImageUrl = null;

    if (imageUri) {
      characterImageUrl = await uploadImageToHostinger(imageUri, 'roleplay_characters');
    }

    const characterRef = await addDoc(collection(db, 'roleplayCharacters'), {
      ...characterData,
      characterImageUrl,
      userId: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
    });

    console.log('✅ Roleplay character created:', characterRef.id);
    return characterRef.id;
  } catch (error) {
    console.error('❌ Error creating roleplay character:', error);
    throw error;
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Upload multiple images and return URLs
 * @param {Array<string>} imageUris - Array of local image URIs
 * @param {string} folder - Hostinger folder name
 * @returns {Promise<Array<string>>} - Array of uploaded URLs
 */
export const uploadMultipleImages = async (imageUris, folder = 'general') => {
  try {
    const uploadPromises = imageUris.map((uri) =>
      uploadImageToHostinger(uri, folder)
    );
    const urls = await Promise.all(uploadPromises);
    console.log(`✅ ${urls.length} images uploaded`);
    return urls;
  } catch (error) {
    console.error('❌ Error uploading multiple images:', error);
    throw error;
  }
};

/**
 * Test upload and Firestore connection
 * @returns {Promise<boolean>} - True if both work
 */
export const testFirebaseHostingerSetup = async () => {
  try {
    console.log('🧪 Testing Firebase + Hostinger setup...');

    // Test Firestore write
    const testRef = await addDoc(collection(db, 'test'), {
      message: 'Test message',
      createdAt: serverTimestamp(),
    });
    console.log('✅ Firestore write successful:', testRef.id);

    // Test Hostinger connection
    const { testHostingerConnection } = require('./hostingerConfig');
    const isHostingerOk = await testHostingerConnection();

    if (isHostingerOk) {
      console.log('✅ All systems operational!');
      return true;
    } else {
      console.error('❌ Hostinger connection failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Setup test failed:', error);
    return false;
  }
};
