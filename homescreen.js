import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  runTransaction,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from './firebaseConfig';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');
const IMAGE_WIDTH = 267;
const SPACING = 10;

const images = [
  require('./assets/homebackground.jpg'),
  require('./assets/homebackground.jpg'),
  require('./assets/homebackground.jpg'),
];

const boxes = [
  {
    title: 'Text it',
    image: require('./assets/textit.png'),
    style: { borderColor: '#BF2EF0', borderWidth: 1 },
  },
  {
    title: 'Voice it',
    image: require('./assets/voiceit.png'),
    style: { borderColor: '#05FF00', borderWidth: 0.89 },
  },
  {
    title: 'Stream it',
    image: require('./assets/streamit.png'),
    style: {
      borderColor: '#FFD913',
      borderWidth: 0.89,
      shadowColor: '#FFDB203D',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 0.89,
      elevation: 3,
    },
  },
];

const buttons = ['ForYou', 'Following', 'Community', "Community's"];

const posts = [
  {
    id: 1,
    name: 'Hitachi BlackSoul',
    username: '@hitachi',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque euismod.',
    likes: 123,
    images: [
      require('./assets/post1.1.jpg'),
      require('./assets/post1.2.jpg'),
      require('./assets/post1.3.jpg'),
    ],
  },
  {
    id: 2,
    name: 'Hitachi BlackSoul',
    username: '@hitachi',
    text: 'Just tried this amazing app feature, and it’s really cool! #ReactNative #UI',
    likes: 98,
    images: [require('./assets/post2.png')],
  },
];

const Post = ({ 
  post, 
  onLike, 
  onComment, 
  onShare, 
  onFollow, 
  isLiked, 
  isFollowing, 
  likeBusy, 
  followBusy,
  currentUser
}) => {
  // Don't show follow button if post is by current logged-in user
  const showFollowButton = post.authorId && onFollow && currentUser?.id && post.authorId !== currentUser.id;
  
  return (
    <View style={styles.postContainer}>
      {/* Author Info */}
      <View style={styles.postHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={post.authorImage ? { uri: post.authorImage } : require('./assets/a1.png')}
            style={styles.postProfileImage}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.postName}>{post.authorName || 'User'}</Text>
            <Text style={styles.postUsername}>
              {post.createdAt 
                ? new Date(post.createdAt.toDate?.() || post.createdAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
                : 'Recently'
              }
            </Text>
          </View>
        </View>
        {showFollowButton && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing && styles.followButtonFollowing,
              followBusy && { opacity: 0.6 }
            ]}
            onPress={() => onFollow(post.authorId)}
            disabled={followBusy}
          >
            <Text style={[styles.followText, isFollowing && styles.followTextFollowing]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Blog Post - Show Title and Content */}
      {post.type === 'blog' && (
        <>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postText} numberOfLines={3}>{post.content}</Text>
        </>
      )}

      {/* Image Post - Show Image and Caption */}
      {post.type === 'image' && (
        <>
          {post.imageUri && (
            <Image
              source={{ uri: post.imageUri }}
              style={styles.postImageFull}
              resizeMode="cover"
            />
          )}
          {post.caption && (
            <Text style={styles.postText}>{post.caption}</Text>
          )}
        </>
      )}

      {/* Action Buttons */}
      <View style={styles.postFooter}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => onLike && onLike(post)}
          disabled={likeBusy}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#ff4b6e' : '#fff'}
          />
          <Text style={{ color: isLiked ? '#ff4b6e' : '#fff', marginLeft: 5 }}>
            {post.likes || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}
          onPress={() => onComment && onComment(post)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 5 }}>{post.comments || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}
          onPress={() => onShare && onShare(post)}
        >
          <Ionicons name="share-social-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen({ navigation }) {
  const [activeButton, setActiveButton] = useState(null);
  const [userName, setUserName] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likeProcessingIds, setLikeProcessingIds] = useState([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [selectedPostForComment, setSelectedPostForComment] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsUnsubscribe, setCommentsUnsubscribe] = useState(null);
  const [followLoadingIds, setFollowLoadingIds] = useState([]);
  const [followingUserIds, setFollowingUserIds] = useState([]);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const auth = getAuth(app);
        const db = getFirestore(app);
        
        if (auth.currentUser) {
          const userId = auth.currentUser.uid;
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
            const userName = fullName || userData.username || userData.displayName || userData.name || auth.currentUser.displayName || 'User';
            const img = userData.profileImage || userData.profile_image || userData.profile_picture || userData.photoURL || null;
            
            setUserName(userName);
            setProfileImage(img);
            setCurrentUser({
              id: userId,
              name: userName,
              profileImage: img,
              email: userData.email || auth.currentUser.email
            });
          } else {
            setCurrentUser({
              id: userId,
              name: auth.currentUser.displayName || 'User',
              profileImage: null,
              email: auth.currentUser.email
            });
          }
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    };

    fetchCurrentUser();

    // NetInfo listener
    NetInfo.fetch().then(state => setIsConnected(Boolean(state.isConnected))).catch(() => setIsConnected(false));
    const unsubscribeNet = NetInfo.addEventListener(state => setIsConnected(Boolean(state.isConnected)));

    return () => {
      unsubscribeNet();
    };
  }, []);

  // Fetch all posts and blogs from all communities
  useEffect(() => {
    const fetchAllPosts = async () => {
      setLoading(true);
      try {
        const db = getFirestore(app);
        const communitiesSnapshot = await getDocs(collection(db, 'communities'));
        const communities = communitiesSnapshot.docs;
        
        const allPostsData = [];
        
        for (const commDoc of communities) {
          const commId = commDoc.id;
          
          // Fetch blogs
          try {
            const blogsCol = collection(db, 'communities', commId, 'blogs');
            const blogsSnapshot = await getDocs(query(blogsCol, orderBy('createdAt', 'desc')));
            
            for (const blogDoc of blogsSnapshot.docs) {
              const blogData = blogDoc.data();
              const authorId = blogData.authorId;
              
              // Fetch author details
              let authorName = 'User';
              let authorImage = null;
              let username = '';
              
              if (authorId) {
                try {
                  const userRef = doc(db, 'users', authorId);
                  const userSnap = await getDoc(userRef);
                  if (userSnap.exists()) {
                    const userData = userSnap.data();
                    authorName = userData.displayName || userData.name || userData.fullName || userData.username || 'User';
                    authorImage = userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null;
                    username = userData.username || '';
                  }
                } catch (e) {
                  console.log('Error fetching author:', e);
                }
              }
              
              allPostsData.push({
                id: blogDoc.id,
                type: 'blog',
                communityId: commId,
                ...blogData,
                authorName,
                authorImage,
                username,
                likes: typeof blogData.likes === 'number' ? blogData.likes : 0,
                comments: typeof blogData.comments === 'number' ? blogData.comments : 0,
                likedBy: Array.isArray(blogData.likedBy) ? blogData.likedBy : [],
              });
            }
          } catch (e) {
            console.log('Error fetching blogs:', e);
          }
          
          // Fetch posts
          try {
            const postsCol = collection(db, 'communities', commId, 'posts');
            const postsSnapshot = await getDocs(query(postsCol, orderBy('createdAt', 'desc')));
            
            for (const postDoc of postsSnapshot.docs) {
              const postData = postDoc.data();
              const authorId = postData.authorId;
              
              // Fetch author details
              let authorName = 'User';
              let authorImage = null;
              let username = '';
              
              if (authorId) {
                try {
                  const userRef = doc(db, 'users', authorId);
                  const userSnap = await getDoc(userRef);
                  if (userSnap.exists()) {
                    const userData = userSnap.data();
                    authorName = userData.displayName || userData.name || userData.fullName || userData.username || 'User';
                    authorImage = userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null;
                    username = userData.username || '';
                  }
                } catch (e) {
                  console.log('Error fetching author:', e);
                }
              }
              
              allPostsData.push({
                id: postDoc.id,
                type: 'image',
                communityId: commId,
                ...postData,
                authorName,
                authorImage,
                username,
                likes: typeof postData.likes === 'number' ? postData.likes : 0,
                comments: typeof postData.comments === 'number' ? postData.comments : 0,
                likedBy: Array.isArray(postData.likedBy) ? postData.likedBy : [],
              });
            }
          } catch (e) {
            console.log('Error fetching posts:', e);
          }
        }
        
        // Sort by createdAt (newest first)
        allPostsData.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return bTime - aTime;
        });
        
        setAllPosts(allPostsData);
        setLoading(false);
      } catch (e) {
        console.log('Error fetching all posts:', e);
        setLoading(false);
      }
    };

    fetchAllPosts();
  }, []);

  // Real-time listeners for posts updates
  useEffect(() => {
    if (allPosts.length === 0) return;
    
    const db = getFirestore(app);
    const unsubscribes = [];
    
    allPosts.forEach((post) => {
      const collectionName = post.type === 'blog' ? 'blogs' : 'posts';
      const postRef = doc(db, 'communities', post.communityId, collectionName, post.id);
      
      const unsubscribe = onSnapshot(postRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setAllPosts((prev) =>
            prev.map((p) =>
              p.id === post.id && p.communityId === post.communityId
                ? {
                    ...p,
                    likes: typeof data.likes === 'number' ? data.likes : 0,
                    comments: typeof data.comments === 'number' ? data.comments : 0,
                    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
                  }
                : p
            )
          );
        }
      });
      
      unsubscribes.push(unsubscribe);
    });
    
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [allPosts.length]);

  // Listen to current user's following list
  useEffect(() => {
    if (!currentUser?.id) {
      setFollowingUserIds([]);
      return;
    }

    const db = getFirestore(app);
    const followCol = collection(db, 'users', currentUser.id, 'following');
    
    const unsubscribe = onSnapshot(followCol, (snapshot) => {
      const ids = snapshot.docs.map((docSnap) => docSnap.id);
      setFollowingUserIds(ids);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  // Helper function to get post document reference
  const getPostDocRef = (db, post) => {
    const collectionName = post.type === 'blog' ? 'blogs' : 'posts';
    return doc(db, 'communities', post.communityId, collectionName, post.id);
  };

  // Handler functions
  const handleToggleLike = async (post) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to like posts.');
      return;
    }
    if (!post?.id) return;

    const likeKey = `${post.type}-${post.id}-${post.communityId}`;
    if (likeProcessingIds.includes(likeKey)) return;
    setLikeProcessingIds((prev) => [...prev, likeKey]);

    try {
      const db = getFirestore(app);
      const postRef = getPostDocRef(db, post);
      let result = null;

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(postRef);
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data();
        const likedBy = Array.isArray(data.likedBy) ? [...data.likedBy] : [];
        const alreadyLiked = likedBy.includes(currentUser.id);

        let newLikedBy;
        if (alreadyLiked) {
          newLikedBy = likedBy.filter((id) => id !== currentUser.id);
        } else {
          newLikedBy = [...likedBy, currentUser.id];
        }

        const currentLikeCount =
          typeof data.likes === 'number' ? data.likes : likedBy.length;
        const newLikes = alreadyLiked
          ? Math.max(0, currentLikeCount - 1)
          : currentLikeCount + 1;

        transaction.update(postRef, {
          likedBy: newLikedBy,
          likes: newLikes,
        });

        result = { likedBy: newLikedBy, likes: newLikes };
      });

      if (result) {
        setAllPosts((prev) =>
          prev.map((p) =>
            p.id === post.id && p.communityId === post.communityId
              ? { ...p, ...result }
              : p
          )
        );
      }
    } catch (e) {
      console.log('Error toggling like:', e);
      Alert.alert('Error', 'Unable to update like right now.');
    } finally {
      setLikeProcessingIds((prev) => prev.filter((key) => key !== likeKey));
    }
  };

  const fetchCommentsForPost = async (post) => {
    if (!post?.id || !post.communityId) return;
    
    setCommentsLoading(true);
    try {
      const db = getFirestore(app);
      const collectionName = post.type === 'blog' ? 'blogs' : 'posts';
      const commentsCol = collection(
        db,
        'communities',
        post.communityId,
        collectionName,
        post.id,
        'comments'
      );
      
      const q = query(commentsCol, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const commentsPromises = snapshot.docs.map(async (docSnap) => {
          const commentData = docSnap.data();
          let userProfileImage = commentData.userImage || null;
          
          if (!userProfileImage && commentData.userId) {
            try {
              const userRef = doc(db, 'users', commentData.userId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                userProfileImage = userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null;
              }
            } catch (e) {
              console.log('Error fetching user profile for comment:', e);
            }
          }
          
          return {
            id: docSnap.id,
            ...commentData,
            userImage: userProfileImage,
          };
        });
        
        const commentsList = await Promise.all(commentsPromises);
        setPostComments(commentsList);
        setCommentsLoading(false);
      }, (error) => {
        console.log('Error fetching comments:', error);
        setCommentsLoading(false);
      });
      
      setCommentsUnsubscribe(() => unsubscribe);
    } catch (e) {
      console.log('Error setting up comments listener:', e);
      setCommentsLoading(false);
    }
  };

  const handleCommentPress = (post) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to comment on posts.');
      return;
    }
    setSelectedPostForComment(post);
    setCommentText('');
    setPostComments([]);
    setShowCommentModal(true);
    fetchCommentsForPost(post);
  };

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text) {
      Alert.alert('Comment Required', 'Please write something before posting.');
      return;
    }
    if (!currentUser?.id || !selectedPostForComment?.id) return;

    setCommentSaving(true);

    try {
      const db = getFirestore(app);
      const collectionName = selectedPostForComment.type === 'blog' ? 'blogs' : 'posts';
      const commentsCol = collection(
        db,
        'communities',
        selectedPostForComment.communityId,
        collectionName,
        selectedPostForComment.id,
        'comments'
      );
      const postRef = doc(db, 'communities', selectedPostForComment.communityId, collectionName, selectedPostForComment.id);
      
      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
          throw new Error('Post not found');
        }
        
        const currentComments = typeof postSnap.data().comments === 'number' 
          ? postSnap.data().comments 
          : 0;
        
        const commentRef = doc(commentsCol);
        transaction.set(commentRef, {
          text,
          userId: currentUser.id,
          userName: currentUser.name || 'User',
          userImage: currentUser.profileImage || null,
          createdAt: serverTimestamp(),
        });
        
        transaction.update(postRef, {
          comments: currentComments + 1,
        });
      });

      setCommentText('');
    } catch (e) {
      console.log('Error adding comment:', e);
      Alert.alert('Error', 'Unable to post comment right now.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleSharePost = async (post) => {
    try {
      const title = post.title || post.caption || 'Social Vibing';
      const shareMessage =
        post.type === 'blog'
          ? `Check out this blog "${title}" on Social Vibing!`
          : `Check out this post on Social Vibing: "${title}"`;
      await Share.share({
        message: shareMessage,
      });
    } catch (e) {
      console.log('Error sharing post:', e);
    }
  };

  const handleToggleFollow = async (targetUserId) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to follow users.');
      return;
    }
    if (!targetUserId || targetUserId === currentUser.id) return;
    if (followLoadingIds.includes(targetUserId)) return;

    setFollowLoadingIds((prev) => [...prev, targetUserId]);

    try {
      const db = getFirestore(app);
      const followDocRef = doc(db, 'users', currentUser.id, 'following', targetUserId);
      const isFollowing = followingUserIds.includes(targetUserId);

      if (isFollowing) {
        await deleteDoc(followDocRef);
        setFollowingUserIds((prev) => prev.filter((id) => id !== targetUserId));
      } else {
        await setDoc(followDocRef, {
          userId: targetUserId,
          followedAt: new Date().toISOString(),
        });
        setFollowingUserIds((prev) => [...prev, targetUserId]);
      }
    } catch (e) {
      console.log('Error toggling follow:', e);
      Alert.alert('Error', 'Unable to update follow status right now.');
    } finally {
      setFollowLoadingIds((prev) => prev.filter((id) => id !== targetUserId));
    }
  };

  return (
    <>
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={true}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.profileContainer}>
          {/* UPDATED: Wrap profile area with TouchableOpacity to open Profile */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            
              <Image
                source={profileImage ? { uri: profileImage } : require('./assets/profile.png')}
                style={[styles.profileImage, { borderColor: isConnected ? '#08FFE2' : '#666' }]}
              />
            <View style={styles.profileTextContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.profileName}>{userName || 'User'}</Text>
                <Image
                  source={require('./assets/starimage.png')}
                  style={{ width: 18, height: 18, marginLeft: 5 }}
                />
              </View>
              <Text style={[styles.profileStatus, { color: isConnected ? '#08FFE2' : '#666' }]}>● {isConnected ? 'Online' : 'Offline'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.iconsContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('SearchBar')}
          >
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notification')}
          >
            <Ionicons name="notifications" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Carousel */}
      <FlatList
        data={images}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={IMAGE_WIDTH + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: (width - IMAGE_WIDTH) / 2 }}
        renderItem={({ item }) => (
          <View style={{ marginRight: SPACING }}>
            <Image source={item} style={styles.image} />
          </View>
        )}
      />

      {/* Boxes Section */}
      <View style={styles.boxesContainer}>
        {boxes.map((box, index) => (
          <View key={index} style={[styles.box, box.style]}>
            <Text style={styles.boxText}>{box.title}</Text>
            <Image source={box.image} style={styles.boxImage} />
          </View>
        ))}
      </View>

      {/* Toggle Buttons */}
      <View style={styles.buttonsContainer}>
        {buttons.map((btn, index) => {
          const isActive = activeButton === index;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.textButton, isActive && styles.activeButtonBorder]}
              onPress={() => setActiveButton(index)}
            >
              <Text style={styles.buttonText}>{btn}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Posts */}
      {loading ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#08FFE2" />
          <Text style={{ color: '#fff', marginTop: 10 }}>Loading posts...</Text>
        </View>
      ) : allPosts.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Ionicons name="document-text-outline" size={40} color="#666" />
          <Text style={{ color: '#888', marginTop: 10 }}>No posts found</Text>
        </View>
      ) : (
        allPosts.map((post) => {
          const isLiked = Array.isArray(post.likedBy) && currentUser?.id
            ? post.likedBy.includes(currentUser.id)
            : false;
          const isFollowing = post.authorId && currentUser?.id
            ? followingUserIds.includes(post.authorId)
            : false;
          const likeKey = `${post.type}-${post.id}-${post.communityId}`;
          const likeBusy = likeProcessingIds.includes(likeKey);
          const followBusy = followLoadingIds.includes(post.authorId);
          
          return (
            <Post
              key={`${post.communityId}-${post.type}-${post.id}`}
              post={post}
              onLike={handleToggleLike}
              onComment={handleCommentPress}
              onShare={handleSharePost}
              onFollow={handleToggleFollow}
              isLiked={isLiked}
              isFollowing={isFollowing}
              likeBusy={likeBusy}
              followBusy={followBusy}
              currentUser={currentUser}
            />
          );
        })
      )}
    </ScrollView>

    {/* Comment Modal */}
    <Modal
      visible={showCommentModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (!commentSaving) {
          if (commentsUnsubscribe) {
            commentsUnsubscribe();
            setCommentsUnsubscribe(null);
          }
          setShowCommentModal(false);
          setSelectedPostForComment(null);
          setCommentText('');
          setPostComments([]);
        }
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.commentModalContainer}>
          <View style={styles.commentModalContent}>
            <View style={styles.commentModalHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (!commentSaving) {
                    if (commentsUnsubscribe) {
                      commentsUnsubscribe();
                      setCommentsUnsubscribe(null);
                    }
                    setShowCommentModal(false);
                    setSelectedPostForComment(null);
                    setCommentText('');
                    setPostComments([]);
                  }
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.commentModalTitle}>
                Comments ({postComments.length})
              </Text>
              <TouchableOpacity
                onPress={handleSubmitComment}
                disabled={commentSaving || commentText.trim().length === 0}
              >
                <Text
                  style={[
                    styles.commentModalSubmit,
                    {
                      color:
                        commentSaving || commentText.trim().length === 0 ? '#666' : '#08FFE2',
                    },
                  ]}
                >
                  {commentSaving ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Comments List */}
            <ScrollView style={styles.commentsListContainer}>
              {commentsLoading ? (
                <View style={styles.commentsLoadingContainer}>
                  <ActivityIndicator size="small" color="#08FFE2" />
                  <Text style={styles.commentsLoadingText}>Loading comments...</Text>
                </View>
              ) : postComments.length === 0 ? (
                <View style={styles.commentsEmptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={40} color="#444" />
                  <Text style={styles.commentsEmptyText}>No comments yet</Text>
                  <Text style={styles.commentsEmptySubtext}>Be the first to comment!</Text>
                </View>
              ) : (
                postComments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <Image
                      source={
                        comment.userImage
                          ? { uri: comment.userImage }
                          : require('./assets/a1.png')
                      }
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUserName}>
                          {comment.userName || 'User'}
                        </Text>
                        {comment.createdAt && (
                          <Text style={styles.commentTime}>
                            {new Date(
                              comment.createdAt.toDate?.() || comment.createdAt
                            ).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.commentText}>{comment.text}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            
            {/* Comment Input Section */}
            <View style={styles.commentModalBody}>
              <Text style={styles.commentModalPostTitle}>
                {selectedPostForComment?.title ||
                  selectedPostForComment?.caption ||
                  'Share your thoughts'}
              </Text>
              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Write something nice..."
                  placeholderTextColor="#666"
                  multiline
                  value={commentText}
                  onChangeText={setCommentText}
                  editable={!commentSaving}
                />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding to prevent content from hiding behind tab bar
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  profileContainer: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#08FFE2' },
  profileTextContainer: { marginLeft: 15 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileStatus: { color: '#08FFE2', fontSize: 14, marginTop: 3 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 15 },

  image: { width: IMAGE_WIDTH, height: 111, borderRadius: 17, borderWidth: 1.5, borderColor: '#08FFE2', shadowColor: '#08FFE280', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10.4, elevation: 5 },

  boxesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 20 },
  box: { width: 89, height: 89, borderRadius: 10.71, justifyContent: 'center', alignItems: 'center', padding: 5 },
  boxText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 5 },
  boxImage: { width: 40, height: 40, resizeMode: 'contain' },

  buttonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  textButton: { paddingVertical: 5, paddingHorizontal: 10 },
  activeButtonBorder: { borderBottomWidth: 2, borderColor: '#08FFE2' },
  buttonText: { color: '#fff', fontSize: 16 },

  postContainer: { 
    marginBottom: 20, 
    paddingHorizontal: 20,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
  },
  postHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 12 
  },
  postProfileImage: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  postName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  postUsername: { color: '#888', fontSize: 12 },
  postTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  followButton: { 
    backgroundColor: '#08FFE2', 
    borderRadius: 20, 
    paddingHorizontal: 18, 
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#08FFE2',
  },
  followButtonFollowing: {
    backgroundColor: '#181818',
    borderColor: '#8B2EF0',
  },
  followText: { color: '#000', fontWeight: '700', fontSize: 14 },
  followTextFollowing: { color: '#8B2EF0' },
  postText: { color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  postImage: { height: 100, borderRadius: 10, resizeMode: 'cover' },
  postImageFull: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
  },
  postFooter: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  // Comment Modal Styles
  commentModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  commentModalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    maxHeight: '90%',
    flex: 1,
  },
  commentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  commentModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  commentModalSubmit: {
    fontSize: 14,
    fontWeight: '700',
  },
  commentModalBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  commentModalPostTitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  commentsListContainer: {
    maxHeight: 400,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentsLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsLoadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  commentsEmptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsEmptyText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  commentsEmptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
  },
  commentText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputContainer: {
    marginTop: 12,
  },
  commentInput: {
    minHeight: 120,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 14,
  },
});


