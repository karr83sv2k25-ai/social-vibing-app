// messageHelpers.js - Helper functions for messaging functionality
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Build a deterministic conversation ID from two user IDs.
 * Sorting guarantees the same ID regardless of who initiates.
 */
function buildConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

/**
 * Get or create a 1-on-1 conversation between two users.
 * Uses a deterministic conversation ID to avoid collection queries
 * (which can hit Firestore list-permission issues).
 * @param {string} currentUserId - Current user's ID
 * @param {string} otherUserId - Other user's ID
 * @returns {Promise<string>} - Conversation ID
 */
export async function getOrCreateConversation(currentUserId, otherUserId) {
  try {
    const convId = buildConversationId(currentUserId, otherUserId);
    const convRef = doc(db, 'conversations', convId);
    const convSnap = await getDoc(convRef);

    if (convSnap.exists()) {
      return convId;
    }

    // Conversation doesn't exist yet — create it
    await setDoc(convRef, {
      participants: [currentUserId, otherUserId],
      type: 'private',
      createdBy: currentUserId,
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp(),
      unreadCount: {
        [currentUserId]: 0,
        [otherUserId]: 0,
      },
    });

    return convId;
  } catch (error) {
    console.error('Error getting/creating conversation:', error);
    throw error;
  }
}

/**
 * Navigate to chat with a specific user
 * Usage: From profile screen, add a "Message" button that calls this
 * 
 * Example:
 * <TouchableOpacity onPress={() => startConversation(auth.currentUser.uid, profileUserId, navigation)}>
 *   <Text>Message</Text>
 * </TouchableOpacity>
 */
export async function startConversation(currentUserId, otherUserId, otherUserData, navigation) {
  try {
    const conversationId = await getOrCreateConversation(currentUserId, otherUserId);
    
    navigation.navigate('Chat', {
      user: {
        name: otherUserData.username || otherUserData.name || 'User',
        handle: otherUserData.username ? `@${otherUserData.username}` : (otherUserData.handle || '@user'),
        avatar: otherUserData.profilePicture ? { uri: otherUserData.profilePicture } : null,
        userId: otherUserId,
      },
      conversationId,
      otherUserId,
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    alert('Failed to start conversation. Please try again.');
  }
}
