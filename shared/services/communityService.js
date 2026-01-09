// Shared Community Service
// Platform-agnostic community operations including announcements and featured posts
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
 * Community Service
 * Handles communities, announcements, and featured posts
 * 
 * Usage:
 * import { db } from '../firebaseConfig';
 * import * as CommunityService from '../shared/services/communityService';
 */

// ==================== CREATE COMMUNITY ====================
export const createCommunity = async (db, creatorId, communityData) => {
  try {
    const communityRef = doc(collection(db, 'communities'));
    
    await setDoc(communityRef, {
      id: communityRef.id,
      name: communityData.name,
      description: communityData.description || '',
      imageUrl: communityData.imageUrl || '',
      coverImage: communityData.coverImage || '',
      tags: communityData.tags || [],
      creatorId: creatorId,
      moderators: [creatorId],
      members: [creatorId],
      memberCount: 1,
      postCount: 0,
      announcements: [], // Array of pinned post IDs (max 3)
      featuredPosts: [], // Array of featured post IDs
      rules: communityData.rules || [],
      isPrivate: communityData.isPrivate || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Community created:', communityRef.id);
    return { success: true, communityId: communityRef.id };
  } catch (error) {
    console.error('❌ Create community error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET COMMUNITY ====================
export const getCommunity = async (db, communityId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    if (communityDoc.exists()) {
      return { success: true, data: communityDoc.data() };
    } else {
      return { success: false, error: 'Community not found' };
    }
  } catch (error) {
    console.error('❌ Get community error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE COMMUNITY ====================
export const updateCommunity = async (db, communityId, updates) => {
  try {
    await updateDoc(doc(db, 'communities', communityId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Update community error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== PIN POST AS ANNOUNCEMENT ====================
export const pinPostAsAnnouncement = async (db, communityId, postId, userId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const communityData = communityDoc.data();
    
    // Check if user is creator or moderator
    if (communityData.creatorId !== userId && !communityData.moderators?.includes(userId)) {
      return { success: false, error: 'Only moderators can pin announcements' };
    }

    const currentAnnouncements = communityData.announcements || [];
    
    // Check if already pinned
    if (currentAnnouncements.includes(postId)) {
      return { success: false, error: 'Post already pinned' };
    }

    // Max 3 announcements
    if (currentAnnouncements.length >= 3) {
      return { success: false, error: 'Maximum 3 announcements allowed. Please unpin one first.' };
    }

    // Add to announcements array
    await updateDoc(doc(db, 'communities', communityId), {
      announcements: arrayUnion(postId),
      updatedAt: serverTimestamp()
    });

    // Update post to mark as announcement
    await updateDoc(doc(db, 'posts', postId), {
      isPinned: true,
      pinnedAt: serverTimestamp(),
      pinnedBy: userId
    });

    console.log('✅ Post pinned as announcement');
    return { success: true };
  } catch (error) {
    console.error('❌ Pin announcement error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UNPIN ANNOUNCEMENT ====================
export const unpinAnnouncement = async (db, communityId, postId, userId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const communityData = communityDoc.data();
    
    // Check if user is creator or moderator
    if (communityData.creatorId !== userId && !communityData.moderators?.includes(userId)) {
      return { success: false, error: 'Only moderators can unpin announcements' };
    }

    // Remove from announcements array
    await updateDoc(doc(db, 'communities', communityId), {
      announcements: arrayRemove(postId),
      updatedAt: serverTimestamp()
    });

    // Update post to unmark as announcement
    await updateDoc(doc(db, 'posts', postId), {
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null
    });

    console.log('✅ Announcement unpinned');
    return { success: true };
  } catch (error) {
    console.error('❌ Unpin announcement error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET ANNOUNCEMENTS ====================
export const getAnnouncements = async (db, communityId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const announcementIds = communityDoc.data().announcements || [];
    
    if (announcementIds.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch announcement posts
    const announcements = await Promise.all(
      announcementIds.map(async (postId) => {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
          return { id: postId, ...postDoc.data() };
        }
        return null;
      })
    );

    return { success: true, data: announcements.filter(a => a !== null) };
  } catch (error) {
    console.error('❌ Get announcements error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== FEATURE POST ====================
export const featurePost = async (db, communityId, postId, userId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const communityData = communityDoc.data();
    
    // Check if user is creator or moderator
    if (communityData.creatorId !== userId && !communityData.moderators?.includes(userId)) {
      return { success: false, error: 'Only moderators can feature posts' };
    }

    const currentFeatured = communityData.featuredPosts || [];
    
    // Check if already featured
    if (currentFeatured.includes(postId)) {
      return { success: false, error: 'Post already featured' };
    }

    // Add to featured posts
    await updateDoc(doc(db, 'communities', communityId), {
      featuredPosts: arrayUnion(postId),
      updatedAt: serverTimestamp()
    });

    // Update post to mark as featured
    await updateDoc(doc(db, 'posts', postId), {
      isFeatured: true,
      featuredAt: serverTimestamp(),
      featuredBy: userId
    });

    console.log('✅ Post featured');
    return { success: true };
  } catch (error) {
    console.error('❌ Feature post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UNFEATURE POST ====================
export const unfeaturePost = async (db, communityId, postId, userId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const communityData = communityDoc.data();
    
    // Check if user is creator or moderator
    if (communityData.creatorId !== userId && !communityData.moderators?.includes(userId)) {
      return { success: false, error: 'Only moderators can unfeature posts' };
    }

    // Remove from featured posts
    await updateDoc(doc(db, 'communities', communityId), {
      featuredPosts: arrayRemove(postId),
      updatedAt: serverTimestamp()
    });

    // Update post to unmark as featured
    await updateDoc(doc(db, 'posts', postId), {
      isFeatured: false,
      featuredAt: null,
      featuredBy: null
    });

    console.log('✅ Post unfeatured');
    return { success: true };
  } catch (error) {
    console.error('❌ Unfeature post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET FEATURED POSTS ====================
export const getFeaturedPosts = async (db, communityId, limitCount = 10) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const featuredIds = communityDoc.data().featuredPosts || [];
    
    if (featuredIds.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch featured posts
    const featured = await Promise.all(
      featuredIds.slice(0, limitCount).map(async (postId) => {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
          return { id: postId, ...postDoc.data() };
        }
        return null;
      })
    );

    // Sort by featuredAt timestamp (most recent first)
    const sortedFeatured = featured
      .filter(p => p !== null)
      .sort((a, b) => {
        const aTime = a.featuredAt?.toMillis?.() || 0;
        const bTime = b.featuredAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    return { success: true, data: sortedFeatured };
  } catch (error) {
    console.error('❌ Get featured posts error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET COMMUNITY POSTS ====================
export const getCommunityPosts = async (db, communityId, limitCount = 20) => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('communityId', '==', communityId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, data: posts };
  } catch (error) {
    console.error('❌ Get community posts error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== JOIN COMMUNITY ====================
export const joinCommunity = async (db, communityId, userId) => {
  try {
    await updateDoc(doc(db, 'communities', communityId), {
      members: arrayUnion(userId),
      memberCount: increment(1),
      updatedAt: serverTimestamp()
    });

    // Add to user's joined communities
    await updateDoc(doc(db, 'users', userId), {
      joinedCommunities: arrayUnion(communityId),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User joined community');
    return { success: true };
  } catch (error) {
    console.error('❌ Join community error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== LEAVE COMMUNITY ====================
export const leaveCommunity = async (db, communityId, userId) => {
  try {
    await updateDoc(doc(db, 'communities', communityId), {
      members: arrayRemove(userId),
      memberCount: increment(-1),
      updatedAt: serverTimestamp()
    });

    // Remove from user's joined communities
    await updateDoc(doc(db, 'users', userId), {
      joinedCommunities: arrayRemove(communityId),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User left community');
    return { success: true };
  } catch (error) {
    console.error('❌ Leave community error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== ADD MODERATOR ====================
export const addModerator = async (db, communityId, userId, targetUserId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const communityData = communityDoc.data();
    
    // Only creator can add moderators
    if (communityData.creatorId !== userId) {
      return { success: false, error: 'Only community creator can add moderators' };
    }

    await updateDoc(doc(db, 'communities', communityId), {
      moderators: arrayUnion(targetUserId),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Moderator added');
    return { success: true };
  } catch (error) {
    console.error('❌ Add moderator error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== REMOVE MODERATOR ====================
export const removeModerator = async (db, communityId, userId, targetUserId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return { success: false, error: 'Community not found' };
    }

    const communityData = communityDoc.data();
    
    // Only creator can remove moderators
    if (communityData.creatorId !== userId) {
      return { success: false, error: 'Only community creator can remove moderators' };
    }

    // Cannot remove creator
    if (targetUserId === communityData.creatorId) {
      return { success: false, error: 'Cannot remove community creator' };
    }

    await updateDoc(doc(db, 'communities', communityId), {
      moderators: arrayRemove(targetUserId),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Moderator removed');
    return { success: true };
  } catch (error) {
    console.error('❌ Remove moderator error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== CHECK IF USER IS MODERATOR ====================
export const isModerator = async (db, communityId, userId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    
    if (!communityDoc.exists()) {
      return false;
    }

    const communityData = communityDoc.data();
    return communityData.creatorId === userId || communityData.moderators?.includes(userId);
  } catch (error) {
    console.error('❌ Check moderator error:', error);
    return false;
  }
};

// ==================== SEARCH COMMUNITIES ====================
export const searchCommunities = async (db, searchTerm, limitCount = 10) => {
  try {
    const communitiesRef = collection(db, 'communities');
    const q = query(
      communitiesRef,
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const communities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, data: communities };
  } catch (error) {
    console.error('❌ Search communities error:', error);
    return { success: false, error: error.message };
  }
};
