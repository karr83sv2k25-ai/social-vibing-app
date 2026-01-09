// Shared Post Service
// Platform-agnostic post operations
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
 * Post Service
 * Handles all post operations (create, update, delete, like, comment, etc.)
 * 
 * Usage:
 * import { db } from '../firebaseConfig';
 * import * as PostService from '../shared/services/postService';
 */

// Post types
export const POST_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  POLL: 'poll',
  QUIZ: 'quiz',
  QUESTION: 'question',
  BLOG: 'blog',
  LINK: 'link',
};

// ==================== CREATE POST ====================
export const createPost = async (db, userId, postData) => {
  try {
    const postRef = doc(collection(db, 'posts'));
    
    await setDoc(postRef, {
      id: postRef.id,
      userId: userId,
      communityId: postData.communityId || null,
      type: postData.type || POST_TYPES.TEXT,
      title: postData.title || '',
      content: postData.content || '',
      mediaUrls: postData.mediaUrls || [],
      tags: postData.tags || [],
      likes: [],
      likeCount: 0,
      comments: [],
      commentCount: 0,
      shares: 0,
      views: 0,
      isPinned: false,
      isFeatured: false,
      pinnedAt: null,
      pinnedBy: null,
      featuredAt: null,
      featuredBy: null,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...postData // Any additional fields
    });

    // Update community post count if posted in community
    if (postData.communityId) {
      await updateDoc(doc(db, 'communities', postData.communityId), {
        postCount: increment(1)
      });
    }

    console.log('✅ Post created:', postRef.id);
    return { success: true, postId: postRef.id };
  } catch (error) {
    console.error('❌ Create post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET POST ====================
export const getPost = async (db, postId) => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (postDoc.exists()) {
      return { success: true, data: { id: postId, ...postDoc.data() } };
    } else {
      return { success: false, error: 'Post not found' };
    }
  } catch (error) {
    console.error('❌ Get post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE POST ====================
export const updatePost = async (db, postId, userId, updates) => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    
    if (!postDoc.exists()) {
      return { success: false, error: 'Post not found' };
    }

    // Check if user owns the post
    if (postDoc.data().userId !== userId) {
      return { success: false, error: 'Only post owner can update the post' };
    }

    await updateDoc(doc(db, 'posts', postId), {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Post updated');
    return { success: true };
  } catch (error) {
    console.error('❌ Update post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== DELETE POST ====================
export const deletePost = async (db, postId, userId) => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    
    if (!postDoc.exists()) {
      return { success: false, error: 'Post not found' };
    }

    const postData = postDoc.data();

    // Check if user owns the post
    if (postData.userId !== userId) {
      return { success: false, error: 'Only post owner can delete the post' };
    }

    // Soft delete (mark as deleted instead of actually deleting)
    await updateDoc(doc(db, 'posts', postId), {
      isDeleted: true,
      deletedAt: serverTimestamp()
    });

    // Update community post count if was in community
    if (postData.communityId) {
      await updateDoc(doc(db, 'communities', postData.communityId), {
        postCount: increment(-1)
      });
    }

    console.log('✅ Post deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Delete post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== LIKE POST ====================
export const likePost = async (db, postId, userId) => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    
    if (!postDoc.exists()) {
      return { success: false, error: 'Post not found' };
    }

    const likes = postDoc.data().likes || [];
    
    // Check if already liked
    if (likes.includes(userId)) {
      return { success: false, error: 'Post already liked' };
    }

    await updateDoc(doc(db, 'posts', postId), {
      likes: arrayUnion(userId),
      likeCount: increment(1)
    });

    // Create notification for post owner
    const postOwnerId = postDoc.data().userId;
    if (postOwnerId !== userId) {
      await setDoc(doc(collection(db, 'notifications')), {
        type: 'like',
        fromUserId: userId,
        toUserId: postOwnerId,
        postId: postId,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    console.log('✅ Post liked');
    return { success: true };
  } catch (error) {
    console.error('❌ Like post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UNLIKE POST ====================
export const unlikePost = async (db, postId, userId) => {
  try {
    await updateDoc(doc(db, 'posts', postId), {
      likes: arrayRemove(userId),
      likeCount: increment(-1)
    });

    console.log('✅ Post unliked');
    return { success: true };
  } catch (error) {
    console.error('❌ Unlike post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== ADD COMMENT ====================
export const addComment = async (db, postId, userId, commentText) => {
  try {
    const commentRef = doc(collection(db, 'comments'));
    
    await setDoc(commentRef, {
      id: commentRef.id,
      postId: postId,
      userId: userId,
      content: commentText,
      likes: [],
      likeCount: 0,
      replies: [],
      replyCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update post comment count
    await updateDoc(doc(db, 'posts', postId), {
      commentCount: increment(1)
    });

    // Create notification for post owner
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (postDoc.exists()) {
      const postOwnerId = postDoc.data().userId;
      if (postOwnerId !== userId) {
        await setDoc(doc(collection(db, 'notifications')), {
          type: 'comment',
          fromUserId: userId,
          toUserId: postOwnerId,
          postId: postId,
          commentId: commentRef.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
    }

    console.log('✅ Comment added');
    return { success: true, commentId: commentRef.id };
  } catch (error) {
    console.error('❌ Add comment error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET POST COMMENTS ====================
export const getPostComments = async (db, postId, limitCount = 20) => {
  try {
    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef,
      where('postId', '==', postId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, data: comments };
  } catch (error) {
    console.error('❌ Get comments error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== INCREMENT POST VIEWS ====================
export const incrementViews = async (db, postId) => {
  try {
    await updateDoc(doc(db, 'posts', postId), {
      views: increment(1)
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Increment views error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== SHARE POST ====================
export const sharePost = async (db, postId) => {
  try {
    await updateDoc(doc(db, 'posts', postId), {
      shares: increment(1)
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Share post error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET USER POSTS ====================
export const getUserPosts = async (db, userId, limitCount = 20) => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('userId', '==', userId),
      where('isDeleted', '==', false),
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
    console.error('❌ Get user posts error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET FEED POSTS ====================
export const getFeedPosts = async (db, userId, limitCount = 20) => {
  try {
    // Get user's following list
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { success: false, error: 'User not found' };
    }

    const following = userDoc.data().following || [];
    
    // Get posts from followed users
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('userId', 'in', [...following, userId]),
      where('isDeleted', '==', false),
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
    console.error('❌ Get feed posts error:', error);
    return { success: false, error: error.message };
  }
};
