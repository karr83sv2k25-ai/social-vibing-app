import { db, auth } from '../firebaseConfig';
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs,
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

/**
 * Send a friend request to another user
 * @param {string} toUserId - The user ID to send the request to
 * @returns {Promise<object>} Result object with success status
 */
export async function sendFriendRequest(toUserId) {
  try {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('User not authenticated');
    if (currentUserId === toUserId) throw new Error('Cannot send friend request to yourself');

    // Check if already friends
    const isFriend = await checkIfFriends(currentUserId, toUserId);
    if (isFriend) {
      return { success: false, message: 'Already friends' };
    }

    // Check if request already exists
    const requestsRef = collection(db, 'friend_requests');
    const existingQuery = query(
      requestsRef,
      where('fromUserId', '==', currentUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    const existingSnap = await getDocs(existingQuery);
    
    if (!existingSnap.empty) {
      return { success: false, message: 'Friend request already sent' };
    }

    // Check if there's a pending request from them to you
    const reverseQuery = query(
      requestsRef,
      where('fromUserId', '==', toUserId),
      where('toUserId', '==', currentUserId),
      where('status', '==', 'pending')
    );
    const reverseSnap = await getDocs(reverseQuery);
    
    if (!reverseSnap.empty) {
      return { success: false, message: 'This user already sent you a friend request' };
    }

    // Create friend request
    await addDoc(requestsRef, {
      fromUserId: currentUserId,
      toUserId: toUserId,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return { success: true, message: 'Friend request sent' };
  } catch (error) {
    console.error('Error sending friend request:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Accept a friend request
 * @param {string} requestId - The friend request document ID
 * @param {string} fromUserId - The user who sent the request
 * @returns {Promise<object>} Result object with success status
 */
export async function acceptFriendRequest(requestId, fromUserId) {
  try {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('User not authenticated');

    const batch = writeBatch(db);

    // Update request status
    const requestRef = doc(db, 'friend_requests', requestId);
    batch.update(requestRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    });

    // Add to both users' friends subcollections
    const currentUserFriendRef = doc(db, 'users', currentUserId, 'friends', fromUserId);
    batch.set(currentUserFriendRef, {
      userId: fromUserId,
      addedAt: serverTimestamp(),
    });

    const otherUserFriendRef = doc(db, 'users', fromUserId, 'friends', currentUserId);
    batch.set(otherUserFriendRef, {
      userId: currentUserId,
      addedAt: serverTimestamp(),
    });

    await batch.commit();

    // Create a private conversation between the two users
    try {
      const conversationsRef = collection(db, 'conversations');
      
      // Check if conversation already exists
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', currentUserId)
      );
      
      const snapshot = await getDocs(q);
      let conversationExists = false;
      
      // Check if conversation with this user already exists
      for (const docSnap of snapshot.docs) {
        const participants = docSnap.data().participants;
        // Support both array of strings and array of objects
        const hasUser = Array.isArray(participants) && participants.length > 0 &&
          (typeof participants[0] === 'string'
            ? participants.includes(fromUserId)
            : participants.some(p => p.userId === fromUserId));
        if (hasUser && participants.length === 2) {
          conversationExists = true;
          break;
        }
      }
      
      // Create new conversation if it doesn't exist
      if (!conversationExists) {
        const newConversationRef = doc(conversationsRef);
        await setDoc(newConversationRef, {
          type: 'private',
          participants: [currentUserId, fromUserId],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCount: {
            [currentUserId]: 0,
            [fromUserId]: 0,
          },
        });
        console.log('✅ Private conversation created between users');
      } else {
        console.log('✅ Conversation already exists');
      }
    } catch (convError) {
      console.error('Error creating conversation:', convError);
      // Don't fail the friend request acceptance if conversation creation fails
    }

    return { success: true, message: 'Friend request accepted' };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Reject a friend request
 * @param {string} requestId - The friend request document ID
 * @returns {Promise<object>} Result object with success status
 */
export async function rejectFriendRequest(requestId) {
  try {
    const requestRef = doc(db, 'friend_requests', requestId);
    await deleteDoc(requestRef);
    return { success: true, message: 'Friend request rejected' };
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Cancel a sent friend request
 * @param {string} requestId - The friend request document ID
 * @returns {Promise<object>} Result object with success status
 */
export async function cancelFriendRequest(requestId) {
  try {
    if (!requestId) throw new Error('Invalid request ID');
    const requestRef = doc(db, 'friend_requests', requestId);
    await deleteDoc(requestRef);
    return { success: true, message: 'Friend request cancelled' };
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Remove a friend
 * @param {string} friendId - The friend's user ID
 * @returns {Promise<object>} Result object with success status
 */
export async function removeFriend(friendId) {
  try {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('User not authenticated');

    const batch = writeBatch(db);

    // Remove from both users' friends subcollections
    const currentUserFriendRef = doc(db, 'users', currentUserId, 'friends', friendId);
    batch.delete(currentUserFriendRef);

    const otherUserFriendRef = doc(db, 'users', friendId, 'friends', currentUserId);
    batch.delete(otherUserFriendRef);

    await batch.commit();

    return { success: true, message: 'Friend removed' };
  } catch (error) {
    console.error('Error removing friend:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get all friends for a user
 * @param {string} userId - The user ID (defaults to current user)
 * @returns {Promise<Array>} Array of friend user IDs
 */
export async function getFriends(userId = null) {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) throw new Error('User not authenticated');

    const friendsRef = collection(db, 'users', targetUserId, 'friends');
    const friendsSnap = await getDocs(friendsRef);
    
    const friendIds = [];
    friendsSnap.forEach(doc => {
      friendIds.push(doc.data().userId);
    });

    return friendIds;
  } catch (error) {
    console.error('Error getting friends:', error);
    return [];
  }
}

/**
 * Check if two users are friends
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<boolean>} True if users are friends
 */
export async function checkIfFriends(userId1, userId2) {
  try {
    const friendRef = doc(db, 'users', userId1, 'friends', userId2);
    const friendSnap = await getDoc(friendRef);
    return friendSnap.exists();
  } catch (error) {
    console.error('Error checking friendship:', error);
    return false;
  }
}

/**
 * Get pending friend requests for current user
 * @param {string} type - 'received' or 'sent'
 * @returns {Promise<Array>} Array of friend request objects
 */
export async function getFriendRequests(type = 'received') {
  try {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('User not authenticated');

    const requestsRef = collection(db, 'friend_requests');
    const field = type === 'received' ? 'toUserId' : 'fromUserId';
    
    const q = query(
      requestsRef,
      where(field, '==', currentUserId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const requests = [];
    
    snapshot.forEach(doc => {
      requests.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return requests;
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return [];
  }
}

/**
 * Get friendship status between current user and another user
 * @param {string} userId - The other user's ID
 * @returns {Promise<string>} Status: 'friends', 'pending_sent', 'pending_received', 'none'
 */
export async function getFriendshipStatus(userId) {
  try {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return 'none';
    if (currentUserId === userId) return 'self';

    // Check if friends
    const isFriend = await checkIfFriends(currentUserId, userId);
    if (isFriend) return 'friends';

    // Check for pending requests
    const requestsRef = collection(db, 'friend_requests');
    
    // Check sent requests
    const sentQuery = query(
      requestsRef,
      where('fromUserId', '==', currentUserId),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const sentSnap = await getDocs(sentQuery);
    if (!sentSnap.empty) return {
      status: 'pending_sent',
      requestId: sentSnap.docs[0].id,
    };

    // Check received requests
    const receivedQuery = query(
      requestsRef,
      where('fromUserId', '==', userId),
      where('toUserId', '==', currentUserId),
      where('status', '==', 'pending')
    );
    const receivedSnap = await getDocs(receivedQuery);
    if (!receivedSnap.empty) {
      return {
        status: 'pending_received',
        requestId: receivedSnap.docs[0].id
      };
    }

    return 'none';
  } catch (error) {
    console.error('Error getting friendship status:', error);
    return 'none';
  }
}
