// Shared User Service
// Works on both React Native and React Web
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc,
  updateDoc, 
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * User Service
 * Platform-agnostic user data operations
 * 
 * Usage:
 * import { db } from '../firebaseConfig'; // Mobile
 * import { db } from '../shared/firebaseConfig.web'; // Web
 * import * as UserService from '../shared/services/userService';
 * 
 * UserService.getUserProfile(db, userId);
 */

// ==================== GET USER PROFILE ====================
export const getUserProfile = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('❌ Get user profile error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE USER PROFILE ====================
export const updateUserProfile = async (db, userId, updates) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Update user profile error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== SEARCH USERS ====================
export const searchUsers = async (db, searchTerm, maxResults = 10) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('displayName', '>=', searchTerm),
      where('displayName', '<=', searchTerm + '\uf8ff'),
      limit(maxResults)
    );
    
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, data: users };
  } catch (error) {
    console.error('❌ Search users error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== FOLLOW USER ====================
export const followUser = async (db, currentUserId, targetUserId) => {
  try {
    // Add to current user's following
    await updateDoc(doc(db, 'users', currentUserId), {
      following: arrayUnion(targetUserId),
      updatedAt: serverTimestamp()
    });

    // Add to target user's followers
    await updateDoc(doc(db, 'users', targetUserId), {
      followers: arrayUnion(currentUserId),
      updatedAt: serverTimestamp()
    });

    // Create notification (optional)
    await setDoc(doc(collection(db, 'notifications')), {
      type: 'follow',
      fromUserId: currentUserId,
      toUserId: targetUserId,
      createdAt: serverTimestamp(),
      read: false
    });

    console.log('✅ User followed');
    return { success: true };
  } catch (error) {
    console.error('❌ Follow user error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UNFOLLOW USER ====================
export const unfollowUser = async (db, currentUserId, targetUserId) => {
  try {
    // Remove from current user's following
    await updateDoc(doc(db, 'users', currentUserId), {
      following: arrayRemove(targetUserId),
      updatedAt: serverTimestamp()
    });

    // Remove from target user's followers
    await updateDoc(doc(db, 'users', targetUserId), {
      followers: arrayRemove(currentUserId),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User unfollowed');
    return { success: true };
  } catch (error) {
    console.error('❌ Unfollow user error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET FOLLOWERS ====================
export const getFollowers = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { success: false, error: 'User not found' };
    }

    const followers = userDoc.data().followers || [];
    
    // Get follower details
    const followerDetails = await Promise.all(
      followers.map(async (followerId) => {
        const followerDoc = await getDoc(doc(db, 'users', followerId));
        return followerDoc.exists() ? { id: followerId, ...followerDoc.data() } : null;
      })
    );

    return { success: true, data: followerDetails.filter(f => f !== null) };
  } catch (error) {
    console.error('❌ Get followers error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET FOLLOWING ====================
export const getFollowing = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { success: false, error: 'User not found' };
    }

    const following = userDoc.data().following || [];
    
    // Get following details
    const followingDetails = await Promise.all(
      following.map(async (followingId) => {
        const followingDoc = await getDoc(doc(db, 'users', followingId));
        return followingDoc.exists() ? { id: followingId, ...followingDoc.data() } : null;
      })
    );

    return { success: true, data: followingDetails.filter(f => f !== null) };
  } catch (error) {
    console.error('❌ Get following error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== BLOCK USER ====================
export const blockUser = async (db, currentUserId, targetUserId) => {
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      blockedUsers: arrayUnion(targetUserId),
      updatedAt: serverTimestamp()
    });

    // Optionally unfollow both ways
    await unfollowUser(db, currentUserId, targetUserId);
    await unfollowUser(db, targetUserId, currentUserId);

    console.log('✅ User blocked');
    return { success: true };
  } catch (error) {
    console.error('❌ Block user error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UNBLOCK USER ====================
export const unblockUser = async (db, currentUserId, targetUserId) => {
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      blockedUsers: arrayRemove(targetUserId),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User unblocked');
    return { success: true };
  } catch (error) {
    console.error('❌ Unblock user error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE COINS ====================
export const updateCoins = async (db, userId, amount) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      coins: increment(amount),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Update coins error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE DIAMONDS ====================
export const updateDiamonds = async (db, userId, amount) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      diamonds: increment(amount),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Update diamonds error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET USER BY EMAIL ====================
export const getUserByEmail = async (db, email) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { success: true, data: { id: doc.id, ...doc.data() } };
    } else {
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('❌ Get user by email error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== DELETE USER ====================
export const deleteUserAccount = async (db, userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    console.log('✅ User account deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Delete user error:', error);
    return { success: false, error: error.message };
  }
};
