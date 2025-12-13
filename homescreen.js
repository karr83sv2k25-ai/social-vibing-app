import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  RefreshControl,
} from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  runTransaction,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { app, db } from './firebaseConfig';
import NetInfo from '@react-native-community/netinfo';
import CacheManager from './cacheManager';

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

const getPostDocInfo = (post) => {
  if (!post || !post.id) {
    return null;
  }

  const type = post.type || 'post';
  const collectionMap = {
    blog: 'blogs',
    image: 'posts',
    post: 'posts',
    poll: 'polls',
    quiz: 'quizzes',
    question: 'questions',
  };

  const commentsCollectionMap = {
    question: 'answers',
  };

  const countFieldMap = {
    question: 'answerCount',
  };

  const baseCollection = collectionMap[type] || 'posts';
  const commentsCollectionName = commentsCollectionMap[type] || 'comments';
  const countField = countFieldMap[type] || 'comments';

  if (post.scope === 'global' || !post.communityId) {
    const docRef = doc(db, baseCollection, post.id);
    const commentsCol = collection(db, baseCollection, post.id, commentsCollectionName);
    return {
      docRef,
      commentsCol,
      isGlobal: true,
      collectionName: baseCollection,
      commentsCollectionName,
      countField,
    };
  }

  const docRef = doc(db, 'communities', post.communityId, baseCollection, post.id);
  const commentsCol = collection(
    db,
    'communities',
    post.communityId,
    baseCollection,
    post.id,
    commentsCollectionName,
  );

  return {
    docRef,
    commentsCol,
    isGlobal: false,
    collectionName: baseCollection,
    commentsCollectionName,
    countField,
  };
};

const Post = ({ 
  post, 
  onLike, 
  onComment, 
  onShare, 
  onFollow, 
  onDelete,
  onPollVote,
  pollVoteBusy,
  onStartQuiz,
  onImagePress,
  onProfilePress,
  isLiked, 
  isFollowing, 
  likeBusy, 
  followBusy,
  currentUser,
  imageLoadErrors,
  setImageLoadErrors,
}) => {
  // Don't show follow button if post is by current logged-in user
  const showFollowButton = post.authorId && onFollow && currentUser?.id && post.authorId !== currentUser.id;
  const canDelete = post.authorId && currentUser?.id && post.authorId === currentUser.id;
  
  const handleDeletePress = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onDelete && onDelete(post)
        }
      ]
    );
  };

  const currentUserId = currentUser?.id || null;

  const commentCount = typeof post.commentCount === 'number'
    ? post.commentCount
    : typeof post.comments === 'number'
      ? post.comments
      : typeof post.answerCount === 'number'
        ? post.answerCount
        : 0;

  const commentLabel = post.type === 'question' ? 'Answers' : 'Comments';
  const totalPollVotes = Array.isArray(post.options)
    ? post.options.reduce((sum, option) => sum + (option.votes || 0), 0)
    : typeof post.totalVotes === 'number'
      ? post.totalVotes
      : 0;
  
  return (
    <View style={styles.postContainer}>
      {/* Author Info */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => onProfilePress && post.authorId && onProfilePress(post.authorId)}
          activeOpacity={0.7}
        >
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
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {canDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeletePress}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4b6e" />
            </TouchableOpacity>
          )}
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
          {post.imageUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onImagePress && onImagePress(post.imageUri, [post.imageUri], 0)}
            >
              <Image
                source={{ uri: post.imageUri }}
                style={styles.postImageFull}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Image load error for post:', post.id, error.nativeEvent.error);
                }}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Ionicons name="image-outline" size={48} color="#666" />
              <Text style={styles.noImageText}>No image available</Text>
            </View>
          )}
          {post.caption && (
            <Text style={styles.postText}>{post.caption}</Text>
          )}
        </>
      )}

      {/* Global/Text Post */}
      {post.type === 'post' && (
        <>
          {post.text ? <Text style={styles.postText}>{post.text}</Text> : null}
          {Array.isArray(post.images) && post.images.length > 0 && (
            <TouchableOpacity 
              style={styles.globalPostImageWrapper}
              activeOpacity={0.9}
              onPress={() => onImagePress && onImagePress(post.images[0], post.images, 0)}
            >
              {imageLoadErrors[`${post.id}-0`] ? (
                <View style={[styles.postImageFull, styles.imageFallback]}>
                  <Ionicons name="image-outline" size={48} color="#666" />
                  <Text style={styles.imageFallbackText}>Image not available</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: post.images[0] }}
                  style={styles.postImageFull}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log('Image load error:', post.images[0], error.nativeEvent?.error);
                    setImageLoadErrors(prev => ({ ...prev, [`${post.id}-0`]: true }));
                  }}
                />
              )}
              {post.images.length > 1 && (
                <View style={styles.multipleImagesBadge}>
                  <Text style={styles.multipleImagesText}>+{post.images.length - 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {Array.isArray(post.videos) && post.videos.length > 0 && (
            <View style={styles.globalPostImageWrapper}>
              <Video
                source={{ uri: post.videos[0] }}
                style={styles.postImageFull}
                useNativeControls
                resizeMode="contain"
                isLooping
              />
              {post.videos.length > 1 && (
                <View style={styles.multipleImagesBadge}>
                  <Text style={styles.multipleImagesText}>+{post.videos.length - 1}</Text>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Poll */}
      {post.type === 'poll' && (
        <View style={styles.pollContainer}>
          <Text style={styles.pollQuestion}>{post.question}</Text>
          <Text style={styles.pollMeta}>
            {totalPollVotes} vote{totalPollVotes === 1 ? '' : 's'}
            {post.allowMultipleAnswers ? ' • Multiple answers allowed' : ''}
          </Text>
          {Array.isArray(post.options) && post.options.length > 0 ? (
            post.options.map((option, index) => {
              const votes = typeof option?.votes === 'number' ? option.votes : 0;
              const voters = Array.isArray(option?.voters) ? option.voters : [];
              const percent = totalPollVotes > 0 ? Math.round((votes / totalPollVotes) * 100) : 0;
              const userSelected = currentUserId ? voters.includes(currentUserId) : false;
              const minFill = userSelected ? 12 : votes > 0 ? 8 : 0;

              return (
                <TouchableOpacity
                  key={`${option?.text || 'option'}-${index}`}
                  activeOpacity={0.85}
                  style={[
                    styles.pollOption,
                    userSelected && styles.pollOptionSelected,
                    (pollVoteBusy || !onPollVote) && styles.pollOptionDisabled,
                  ]}
                  onPress={() => onPollVote && onPollVote(post, index)}
                  disabled={pollVoteBusy || !onPollVote}
                >
                  <View style={styles.pollOptionBarTrack}>
                    <View
                      style={[
                        styles.pollOptionBarFill,
                        userSelected && styles.pollOptionBarFillSelected,
                        { width: `${Math.min(Math.max(percent, minFill), 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.pollOptionRow}>
                    <Text
                      style={[
                        styles.pollOptionText,
                        userSelected && styles.pollOptionTextSelected,
                      ]}
                    >
                      {option?.text || `Option ${index + 1}`}
                    </Text>
                    <Text style={styles.pollOptionVotes}>
                      {votes} ({percent}%)
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.pollEmptyText}>No options available.</Text>
          )}
        </View>
      )}

      {/* Quiz */}
      {post.type === 'quiz' && (
        <View style={styles.quizContainer}>
          <Text style={styles.quizTitle}>{post.title || 'Untitled Quiz'}</Text>
          <Text style={styles.quizMeta}>
            {Array.isArray(post.questions) ? post.questions.length : post.questionCount || 0} question
            {Array.isArray(post.questions) ? (post.questions.length === 1 ? '' : 's') : ((post.questionCount || 0) === 1 ? '' : 's')}
            {' • '}
            {post.attempts || 0} attempt{(post.attempts || 0) === 1 ? '' : 's'}
          </Text>
          {Array.isArray(post.questions) && post.questions.length > 0 && (
            <View style={styles.quizPreview}>
              <Text style={styles.quizPreviewLabel}>Sample question:</Text>
              <Text style={styles.quizPreviewQuestion} numberOfLines={2}>
                {post.questions[0].question}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.quizActionButton}
            activeOpacity={0.85}
            onPress={() => onStartQuiz && onStartQuiz(post)}
            disabled={!onStartQuiz}
          >
            <Text style={styles.quizActionButtonText}>Attempt Quiz</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Question */}
      {post.type === 'question' && (
        <View style={styles.questionContainer}>
          <View style={styles.questionHeaderRow}>
            <Text style={styles.questionTag}>Question</Text>
            {post.category ? (
              <Text style={styles.questionCategory}>{post.category}</Text>
            ) : null}
          </View>
          <Text style={styles.questionTitle}>{post.question}</Text>
          {post.description ? (
            <Text style={styles.questionDescription}>{post.description}</Text>
          ) : null}
          {post.image ? (
            imageLoadErrors[`${post.id}-question`] ? (
              <View style={[styles.questionImage, styles.imageFallback]}>
                <Ionicons name="image-outline" size={40} color="#666" />
              </View>
            ) : (
              <Image
                source={{ uri: post.image }}
                style={styles.questionImage}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Question image load error:', post.image, error.nativeEvent?.error);
                  setImageLoadErrors(prev => ({ ...prev, [`${post.id}-question`]: true }));
                }}
              />
            )
          ) : null}
        </View>
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
          <Text style={{ color: '#fff', marginLeft: 5 }}>{commentCount}</Text>
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

// OPTIMIZATION: Export memoized component to prevent unnecessary re-renders
const HomeScreen = React.memo(({ navigation }) => {
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
  const [pollVoteBusyIds, setPollVoteBusyIds] = useState([]);
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResponses, setQuizResponses] = useState({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [allImagesInPost, setAllImagesInPost] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const auth = getAuth(app);
        // db is now imported globally
        
        if (auth.currentUser) {
          const userId = auth.currentUser.uid;
          
          // Try to load from cache first for instant UI
          const cachedUser = await CacheManager.getUserProfile(userId);
          if (cachedUser) {
            console.log('📦 Using cached user profile');
            setUserName(cachedUser.name);
            setProfileImage(cachedUser.profileImage);
            setCurrentUser(cachedUser);
          } else {
            // Set basic user info from auth immediately if no cache
            const basicUserInfo = {
              id: userId,
              name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User',
              profileImage: auth.currentUser.photoURL || null,
              email: auth.currentUser.email
            };
            
            setUserName(basicUserInfo.name);
            setProfileImage(basicUserInfo.profileImage);
            setCurrentUser(basicUserInfo);
          }
          
          // Fetch fresh data from Firestore in background
          try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
              const userName = fullName || userData.username || userData.displayName || userData.name || auth.currentUser.displayName || 'User';
              const img = userData.profileImage || userData.profile_image || userData.profile_picture || userData.photoURL || null;
              
              const userProfile = {
                id: userId,
                name: userName,
                profileImage: img,
                email: userData.email || auth.currentUser.email,
                ...userData
              };
              
              setUserName(userName);
              setProfileImage(img);
              setCurrentUser(userProfile);
              
              // Cache the user profile
              await CacheManager.saveUserProfile(userId, userProfile);
            }
          } catch (firestoreError) {
            console.warn('⚠️  Could not fetch user from Firestore (using auth data):', firestoreError.message);
            // Continue with auth data - don't throw error
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

  const hasFetchedPosts = useRef(false);

  // Fetch all posts (global + community)
  const fetchAllPosts = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) {
      setLoading(true);
    }
    const combinedPosts = [];
    const authorCache = {}; // Cache authors to avoid duplicate fetches
    
    // Helper function to get author data with caching
    const getAuthorData = async (authorId, existingName, existingImage, existingUsername) => {
      if (!authorId || (existingName && existingImage)) {
        return { authorName: existingName || 'User', authorImage: existingImage || null, username: existingUsername || '' };
      }
      
      if (authorCache[authorId]) {
        return authorCache[authorId];
      }
      
      try {
        const userRef = doc(db, 'users', authorId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
          const result = {
            authorName: fullName || userData.displayName || userData.name || userData.username || 'User',
            authorImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
            username: userData.username || '',
          };
          authorCache[authorId] = result;
          return result;
        }
      } catch (error) {
        console.log('Error fetching author:', error);
      }
      
      return { authorName: existingName || 'User', authorImage: existingImage || null, username: existingUsername || '' };
    };
    
    try {
      // Global posts - REDUCED LIMIT
      try {
        const globalPostsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(15));
        const globalPostsSnapshot = await getDocs(globalPostsQuery);

        for (const postDoc of globalPostsSnapshot.docs) {
          const postData = postDoc.data();
          const authorId = postData.authorId || postData.userId || null;
          
          const { authorName, authorImage, username } = await getAuthorData(
            authorId,
            postData.authorName,
            postData.authorImage,
            postData.authorUsername || postData.username
          );

          const images = Array.isArray(postData.images) ? postData.images : [];

          const type = postData.type || 'post';
          const commentCount = type === 'question'
            ? typeof postData.answerCount === 'number'
              ? postData.answerCount
              : 0
            : typeof postData.comments === 'number'
              ? postData.comments
              : 0;

          combinedPosts.push({
            id: postDoc.id,
            ...postData,
            type,
            scope: 'global',
            communityId: null,
            authorId,
            authorName,
            authorImage,
            username,
            images,
            imageUri: postData.imageUri || (images.length > 0 ? images[0] : null),
            likes: typeof postData.likes === 'number' ? postData.likes : Array.isArray(postData.likedBy) ? postData.likedBy.length : 0,
            likedBy: Array.isArray(postData.likedBy) ? postData.likedBy : [],
            comments: commentCount,
            commentCount,
          });
        }
      } catch (globalError) {
        console.log('Error fetching global posts:', globalError);
      }

      // Global polls - REDUCED LIMIT
      try {
        const pollsQuery = query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(10));
        const pollsSnapshot = await getDocs(pollsQuery);

        for (const pollDoc of pollsSnapshot.docs) {
          const pollData = pollDoc.data();
          const authorId = pollData.authorId || pollData.userId || null;
          
          const { authorName, authorImage, username } = await getAuthorData(
            authorId,
            pollData.authorName,
            pollData.authorImage,
            pollData.authorUsername || pollData.username
          );

          const commentCount = typeof pollData.comments === 'number' ? pollData.comments : 0;

          combinedPosts.push({
            id: pollDoc.id,
            ...pollData,
            type: 'poll',
            scope: 'global',
            communityId: null,
            authorId,
            authorName,
            authorImage,
            username,
            likes: typeof pollData.likes === 'number' ? pollData.likes : Array.isArray(pollData.likedBy) ? pollData.likedBy.length : 0,
            likedBy: Array.isArray(pollData.likedBy) ? pollData.likedBy : [],
            comments: commentCount,
            commentCount,
            options: Array.isArray(pollData.options) ? pollData.options : [],
            totalVotes: typeof pollData.totalVotes === 'number' ? pollData.totalVotes : 0,
          });
        }
      } catch (pollError) {
        console.log('Error fetching polls:', pollError);
      }

      // Global quizzes - REDUCED LIMIT
      try {
        const quizzesQuery = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), limit(10));
        const quizzesSnapshot = await getDocs(quizzesQuery);

        for (const quizDoc of quizzesSnapshot.docs) {
          const quizData = quizDoc.data();
          const authorId = quizData.authorId || quizData.userId || null;
          
          const { authorName, authorImage, username } = await getAuthorData(
            authorId,
            quizData.authorName,
            quizData.authorImage,
            quizData.authorUsername || quizData.username
          );

          const questionCount = Array.isArray(quizData.questions) ? quizData.questions.length : quizData.questionCount || 0;
          const commentCount = typeof quizData.comments === 'number' ? quizData.comments : 0;

          combinedPosts.push({
            id: quizDoc.id,
            ...quizData,
            type: 'quiz',
            scope: 'global',
            communityId: null,
            authorId,
            authorName,
            authorImage,
            username,
            questionCount,
            likes: typeof quizData.likes === 'number' ? quizData.likes : Array.isArray(quizData.likedBy) ? quizData.likedBy.length : 0,
            likedBy: Array.isArray(quizData.likedBy) ? quizData.likedBy : [],
            comments: commentCount,
            commentCount,
            attempts: typeof quizData.attempts === 'number' ? quizData.attempts : 0,
          });
        }
      } catch (quizError) {
        console.log('Error fetching quizzes:', quizError);
      }

      // Global questions - REDUCED LIMIT
      try {
        const questionsQuery = query(collection(db, 'questions'), orderBy('createdAt', 'desc'), limit(10));
        const questionsSnapshot = await getDocs(questionsQuery);

        for (const questionDoc of questionsSnapshot.docs) {
          const questionData = questionDoc.data();
          const authorId = questionData.authorId || questionData.userId || null;
          
          const { authorName, authorImage, username } = await getAuthorData(
            authorId,
            questionData.authorName,
            questionData.authorImage,
            questionData.authorUsername || questionData.username
          );

          const answerCount = typeof questionData.answerCount === 'number' ? questionData.answerCount : 0;

          combinedPosts.push({
            id: questionDoc.id,
            ...questionData,
            type: 'question',
            scope: 'global',
            communityId: null,
            authorId,
            authorName,
            authorImage,
            username,
            likes: typeof questionData.likes === 'number' ? questionData.likes : Array.isArray(questionData.likedBy) ? questionData.likedBy.length : 0,
            likedBy: Array.isArray(questionData.likedBy) ? questionData.likedBy : [],
            comments: answerCount,
            commentCount: answerCount,
          });
        }
      } catch (questionError) {
        console.log('Error fetching questions:', questionError);
      }

      // Community posts and blogs - REDUCED LIMIT
      try {
        const communitiesQuery = query(collection(db, 'communities'), limit(5));
        const communitiesSnapshot = await getDocs(communitiesQuery);

        for (const commDoc of communitiesSnapshot.docs) {
          const commId = commDoc.id;

          // Community blogs
          try {
            const blogsCol = collection(db, 'communities', commId, 'blogs');
            const blogsQuery = query(blogsCol, orderBy('createdAt', 'desc'), limit(20));
            const blogsSnapshot = await getDocs(blogsQuery);

            for (const blogDoc of blogsSnapshot.docs) {
              const blogData = blogDoc.data();
              const authorId = blogData.authorId || null;
              
              const { authorName, authorImage, username } = await getAuthorData(
                authorId,
                blogData.authorName,
                blogData.authorImage,
                blogData.username
              );

              combinedPosts.push({
                id: blogDoc.id,
                ...blogData,
                type: 'blog',
                scope: 'community',
                communityId: commId,
                authorId,
                authorName,
                authorImage,
                username,
                likes: typeof blogData.likes === 'number' ? blogData.likes : 0,
                comments: typeof blogData.comments === 'number' ? blogData.comments : 0,
                commentCount: typeof blogData.comments === 'number' ? blogData.comments : 0,
                likedBy: Array.isArray(blogData.likedBy) ? blogData.likedBy : [],
              });
            }
          } catch (e) {
            console.log('Error fetching blogs:', e);
          }

          // Community posts - REDUCED LIMIT
          try {
            const postsCol = collection(db, 'communities', commId, 'posts');
            const postsQuery = query(postsCol, orderBy('createdAt', 'desc'), limit(10));
            const postsSnapshot = await getDocs(postsQuery);

            for (const postDoc of postsSnapshot.docs) {
              const postData = postDoc.data();
              const authorId = postData.authorId || null;
              
              const { authorName, authorImage, username } = await getAuthorData(
                authorId,
                postData.authorName,
                postData.authorImage,
                postData.username
              );

              const images = Array.isArray(postData.images) ? postData.images : [];

              combinedPosts.push({
                id: postDoc.id,
                ...postData,
                type: 'image',
                scope: 'community',
                communityId: commId,
                authorId,
                authorName,
                authorImage,
                username,
                images,
                imageUri: postData.imageUri || postData.imageUrl || postData.mediaUrl || postData.image || (images.length > 0 ? images[0] : null),
                likes: typeof postData.likes === 'number' ? postData.likes : 0,
                comments: typeof postData.comments === 'number' ? postData.comments : 0,
                commentCount: typeof postData.comments === 'number' ? postData.comments : 0,
                likedBy: Array.isArray(postData.likedBy) ? postData.likedBy : [],
              });
            }
          } catch (e) {
            console.log('Error fetching posts:', e);
          }
        }
      } catch (communityError) {
        console.log('Error fetching communities:', communityError);
      }

      combinedPosts.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return bTime - aTime;
      });

      console.log('✅ Loaded', combinedPosts.length, 'posts with', Object.keys(authorCache).length, 'unique authors');
      setAllPosts(combinedPosts.slice(0, 30));
    } catch (e) {
      console.log('Error fetching all posts:', e);
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      await fetchAllPosts();
      if (isMounted) {
        hasFetchedPosts.current = true;
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [fetchAllPosts]);

  // Real-time listeners for posts updates - OPTIMIZED
  useEffect(() => {
    if (allPosts.length === 0) return;
    
    // Limit real-time listeners to first 20 posts only for better performance
    const postsToWatch = allPosts.slice(0, 20);
    const unsubscribes = [];
    
    postsToWatch.forEach((post) => {
      const postInfo = getPostDocInfo(post);
      if (!postInfo?.docRef) {
        return;
      }

      const unsubscribe = onSnapshot(
        postInfo.docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const countField = postInfo.countField || 'comments';
            const commentCount = typeof data[countField] === 'number'
              ? data[countField]
              : typeof data.comments === 'number'
                ? data.comments
                : 0;
            setAllPosts((prev) =>
              prev.map((p) =>
                p.id === post.id && p.communityId === post.communityId && p.scope === post.scope
                  ? {
                      ...p,
                      likes: typeof data.likes === 'number' ? data.likes : 0,
                      comments: commentCount,
                      commentCount,
                      likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
                    }
                  : p
              )
            );
          }
        },
        (error) => {
          console.log(`[Firestore] Error in post snapshot listener for ${post.id}:`, error.code);
          // Silently ignore permission errors for real-time updates
        }
      );
      
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

    // db is now imported globally
    const followCol = collection(db, 'users', currentUser.id, 'following');
    
    const unsubscribe = onSnapshot(
      followCol,
      (snapshot) => {
        const ids = snapshot.docs.map((docSnap) => docSnap.id);
        setFollowingUserIds(ids);
      },
      (error) => {
        console.log('[Firestore] Error in following snapshot listener:', error.code);
        setFollowingUserIds([]);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  // Filter posts based on active tab
  const filteredPosts = useMemo(() => {
    if (activeButton === null) {
      // No tab selected, show all posts (For You)
      return allPosts;
    }

    const tabName = buttons[activeButton];

    switch (tabName) {
      case 'ForYou':
        // Show all posts
        return allPosts;
      
      case 'Following':
        // Show posts only from users the current user is following
        return allPosts.filter(post => 
          post.authorId && followingUserIds.includes(post.authorId)
        );
      
      case 'Community':
        // Show posts from communities the user has joined
        // For now, show all community posts (can be refined with membership data)
        return allPosts;
      
      case "Community's":
        // Show posts from specific communities
        // For now, show all posts (can be refined based on specific logic)
        return allPosts;
      
      default:
        return allPosts;
    }
  }, [activeButton, allPosts, followingUserIds]);

  // Handler functions
  const handleToggleLike = async (post) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to like posts.');
      return;
    }
    if (!post?.id) return;

    const likeKey = `${post.scope || 'global'}-${post.type}-${post.id}-${post.communityId || 'global'}`;
    if (likeProcessingIds.includes(likeKey)) return;
    setLikeProcessingIds((prev) => [...prev, likeKey]);

    try {
      const postInfo = getPostDocInfo(post);
      if (!postInfo?.docRef) {
        return;
      }

      const postRef = postInfo.docRef;
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
            p.id === post.id && p.communityId === post.communityId && p.scope === post.scope
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

  const handlePollVote = async (post, optionIndex) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to vote on polls.');
      return;
    }
    if (!post?.id || post.type !== 'poll' || typeof optionIndex !== 'number') {
      return;
    }

    const voteKey = `${post.scope || 'global'}-poll-${post.id}-${post.communityId || 'global'}`;
    if (pollVoteBusyIds.includes(voteKey)) {
      return;
    }
    setPollVoteBusyIds((prev) => [...prev, voteKey]);

    let result = null;

    try {
      const postInfo = getPostDocInfo(post);
      if (!postInfo?.docRef) {
        throw new Error('Missing poll reference');
      }

      await runTransaction(db, async (transaction) => {
        const pollSnap = await transaction.get(postInfo.docRef);
        if (!pollSnap.exists()) {
          throw new Error('Poll not found');
        }

        const pollData = pollSnap.data();
        const userId = currentUser.id;
        const allowMultiple = Boolean(pollData.allowMultipleAnswers);
        const rawOptions = Array.isArray(pollData.options) ? pollData.options : [];

        if (!rawOptions[optionIndex]) {
          throw new Error('Invalid poll option');
        }

        const options = rawOptions.map((opt) => ({
          ...opt,
          voters: Array.isArray(opt?.voters) ? [...opt.voters] : [],
          votes:
            typeof opt?.votes === 'number'
              ? opt.votes
              : Array.isArray(opt?.voters)
                ? opt.voters.length
                : 0,
        }));

        let totalVotes =
          typeof pollData.totalVotes === 'number'
            ? pollData.totalVotes
            : options.reduce((sum, opt) => sum + (typeof opt.votes === 'number' ? opt.votes : 0), 0);

        const userSelections = [];
        options.forEach((opt, idx) => {
          if (opt.voters.includes(userId)) {
            userSelections.push(idx);
          }
        });

        const selectedOption = options[optionIndex];
        const alreadySelected = selectedOption.voters.includes(userId);
        let changeDetected = false;
        let totalChange = 0;

        if (allowMultiple) {
          if (alreadySelected) {
            selectedOption.voters = selectedOption.voters.filter((id) => id !== userId);
            if (selectedOption.votes > 0) {
              selectedOption.votes -= 1;
              totalChange -= 1;
            }
            changeDetected = true;
          } else {
            selectedOption.voters.push(userId);
            selectedOption.votes += 1;
            totalChange += 1;
            changeDetected = true;
          }
        } else {
          if (alreadySelected) {
            changeDetected = false;
          } else {
            userSelections.forEach((idx) => {
              if (idx !== optionIndex) {
                const previousOption = options[idx];
                previousOption.voters = previousOption.voters.filter((id) => id !== userId);
                if (previousOption.votes > 0) {
                  previousOption.votes -= 1;
                  totalChange -= 1;
                }
              }
            });
            selectedOption.voters.push(userId);
            selectedOption.votes += 1;
            totalChange += 1;
            changeDetected = true;
          }
        }

        if (!changeDetected) {
          return;
        }

        totalVotes = Math.max(0, totalVotes + totalChange);

        transaction.update(postInfo.docRef, {
          options,
          totalVotes,
          updatedAt: serverTimestamp(),
        });

        result = {
          options: options.map((opt) => ({
            ...opt,
            voters: Array.isArray(opt.voters) ? [...opt.voters] : [],
          })),
          totalVotes,
        };
      });

      if (result) {
        setAllPosts((prev) =>
          prev.map((p) =>
            p.id === post.id && p.scope === post.scope && p.communityId === post.communityId
              ? {
                  ...p,
                  options: result.options,
                  totalVotes: result.totalVotes,
                }
              : p
          )
        );
      }
    } catch (e) {
      console.log('Error casting poll vote:', e);
      Alert.alert('Error', 'Unable to update vote right now.');
    } finally {
      setPollVoteBusyIds((prev) => prev.filter((id) => id !== voteKey));
    }
  };

  const handleStartQuiz = (quizPost) => {
    if (!quizPost?.id || !Array.isArray(quizPost.questions) || quizPost.questions.length === 0) {
      Alert.alert('Quiz Unavailable', 'This quiz does not have any questions yet.');
      return;
    }

    const initialResponses = {};
    quizPost.questions.forEach((_, idx) => {
      initialResponses[idx] = null;
    });

    setActiveQuiz(quizPost);
    setQuizResponses(initialResponses);
    setQuizResult(null);
    setQuizModalVisible(true);
  };

  const handleSelectQuizOption = (questionIndex, optionIndex) => {
    if (quizSubmitting || quizResult || !activeQuiz) {
      return;
    }

    setQuizResponses((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) {
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to attempt quizzes.');
      return;
    }

    const questionCount = Array.isArray(activeQuiz.questions) ? activeQuiz.questions.length : 0;
    if (questionCount === 0) {
      Alert.alert('Quiz Unavailable', 'This quiz does not have any questions yet.');
      return;
    }

    const unanswered = [];
    for (let i = 0; i < questionCount; i += 1) {
      if (quizResponses[i] === null || typeof quizResponses[i] === 'undefined') {
        unanswered.push(i + 1);
      }
    }

    if (unanswered.length > 0) {
      Alert.alert(
        'Incomplete Quiz',
        `Please answer question${unanswered.length > 1 ? 's' : ''} ${unanswered.join(', ')} before submitting.`,
      );
      return;
    }

    setQuizSubmitting(true);

    try {
      const breakdown = activeQuiz.questions.map((question, index) => {
        const selectedIndex = quizResponses[index];
        const isCorrect =
          typeof question?.correctAnswer === 'number' && question.correctAnswer === selectedIndex;
        return {
          selectedIndex,
          isCorrect,
        };
      });

      const correctCount = breakdown.filter((item) => item.isCorrect).length;
      const score = Math.round((correctCount / questionCount) * 100);

      const postInfo = getPostDocInfo(activeQuiz);
      if (postInfo?.docRef) {
        try {
          await runTransaction(db, async (transaction) => {
            const quizSnap = await transaction.get(postInfo.docRef);
            if (!quizSnap.exists()) {
              throw new Error('Quiz not found');
            }
            const quizData = quizSnap.data();
            const attempts = typeof quizData.attempts === 'number' ? quizData.attempts : 0;
            transaction.update(postInfo.docRef, {
              attempts: attempts + 1,
              updatedAt: serverTimestamp(),
            });
          });
        } catch (updateError) {
          console.log('Error recording quiz attempt:', updateError);
        }
      }

      setAllPosts((prev) =>
        prev.map((p) =>
          p.id === activeQuiz.id && p.scope === activeQuiz.scope && p.communityId === activeQuiz.communityId
            ? {
                ...p,
                attempts: (p.attempts || 0) + 1,
              }
            : p
        )
      );

      setQuizResult({
        correctCount,
        questionCount,
        score,
        breakdown,
      });
    } catch (e) {
      console.log('Error submitting quiz:', e);
      Alert.alert('Error', 'Unable to submit quiz right now.');
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleCloseQuizModal = () => {
    if (quizSubmitting) {
      return;
    }
    setQuizModalVisible(false);
    setActiveQuiz(null);
    setQuizResponses({});
    setQuizResult(null);
  };

  const fetchCommentsForPost = async (post) => {
    if (!post?.id) return;
    
    setCommentsLoading(true);
    try {
      const postInfo = getPostDocInfo(post);
      if (!postInfo?.commentsCol) {
        setCommentsLoading(false);
        return;
      }

      const q = query(postInfo.commentsCol, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
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
      const postInfo = getPostDocInfo(selectedPostForComment);
      if (!postInfo?.docRef || !postInfo?.commentsCol) {
        throw new Error('Missing post reference');
      }
      const postRef = postInfo.docRef;
      
      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
          throw new Error('Post not found');
        }
        
        const countField = postInfo.countField || 'comments';
        const postData = postSnap.data();
        const currentCount = typeof postData[countField] === 'number'
          ? postData[countField]
          : typeof postData.comments === 'number'
            ? postData.comments
            : 0;
        
        const commentRef = doc(postInfo.commentsCol);
        transaction.set(commentRef, {
          text,
          userId: currentUser.id,
          userName: currentUser.name || 'User',
          userImage: currentUser.profileImage || null,
          createdAt: serverTimestamp(),
          type: countField === 'answerCount' ? 'answer' : 'comment',
        });
        
        const updates = {
          [countField]: currentCount + 1,
        };

        if (countField !== 'comments') {
          updates.comments = currentCount + 1;
        }

        updates.updatedAt = serverTimestamp();

        transaction.update(postRef, updates);
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
      // db is now imported globally
      const followDocRef = doc(db, 'users', currentUser.id, 'following', targetUserId);
      const currentUserRef = doc(db, 'users', currentUser.id);
      const targetUserRef = doc(db, 'users', targetUserId);
      const isFollowing = followingUserIds.includes(targetUserId);

      if (isFollowing) {
        // Unfollow
        await deleteDoc(followDocRef);
        
        // Decrement counters
        await updateDoc(currentUserRef, {
          followingCount: increment(-1)
        });
        await updateDoc(targetUserRef, {
          followersCount: increment(-1)
        });
        
        setFollowingUserIds((prev) => prev.filter((id) => id !== targetUserId));
      } else {
        // Follow
        await setDoc(followDocRef, {
          userId: targetUserId,
          followedAt: new Date().toISOString(),
        });
        
        // Increment counters
        await updateDoc(currentUserRef, {
          followingCount: increment(1)
        });
        await updateDoc(targetUserRef, {
          followersCount: increment(1)
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

  const handleDeletePost = async (post) => {
    if (!currentUser?.id || !post?.id) {
      return;
    }

    // Verify user owns the post
    if (post.authorId !== currentUser.id) {
      Alert.alert('Permission Denied', 'You can only delete your own posts.');
      return;
    }

    try {
      const postInfo = getPostDocInfo(post);
      if (!postInfo?.docRef) {
        Alert.alert('Error', 'Unable to delete this post right now.');
        return;
      }
      
      // Delete the post
      await deleteDoc(postInfo.docRef);
      
      // Remove from local state
      setAllPosts((prev) => 
        prev.filter(p => !(
          p.id === post.id && 
          p.type === post.type &&
          p.scope === post.scope &&
          (p.communityId || 'global') === (post.communityId || 'global')
        ))
      );
      
      Alert.alert('Success', 'Post deleted successfully.');
    } catch (e) {
      console.log('Error deleting post:', e);
      Alert.alert('Error', 'Unable to delete post. Please try again.');
    }
  };

  const handleImagePress = (imageUri, allImages = [], startIndex = 0) => {
    setSelectedImage(imageUri);
    setAllImagesInPost(allImages.length > 0 ? allImages : [imageUri]);
    setSelectedImageIndex(startIndex);
    setImageViewerVisible(true);
  };

  const handleCloseImageViewer = () => {
    setImageViewerVisible(false);
    setSelectedImage(null);
    setAllImagesInPost([]);
    setSelectedImageIndex(0);
  };

  const handleNextImage = () => {
    if (selectedImageIndex < allImagesInPost.length - 1) {
      const newIndex = selectedImageIndex + 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(allImagesInPost[newIndex]);
    }
  };

  const handlePrevImage = () => {
    if (selectedImageIndex > 0) {
      const newIndex = selectedImageIndex - 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(allImagesInPost[newIndex]);
    }
  };

  const handleProfilePress = (userId) => {
    if (userId) {
      navigation.navigate('Profile', { userId });
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllPosts(true);
  }, [fetchAllPosts]);

  return (
    <>
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
          colors={['#BF2EF0', '#05FF00', '#FFD913']}
        />
      }
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
      ) : filteredPosts.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Ionicons name="document-text-outline" size={40} color="#666" />
          <Text style={{ color: '#888', marginTop: 10 }}>
            {activeButton === 1 ? 'No posts from people you follow' : 'No posts found'}
          </Text>
          {activeButton === 1 && (
            <Text style={{ color: '#666', marginTop: 5, fontSize: 12 }}>
              Follow some users to see their posts here
            </Text>
          )}
        </View>
      ) : (
        filteredPosts.map((post) => {
          const isLiked = Array.isArray(post.likedBy) && currentUser?.id
            ? post.likedBy.includes(currentUser.id)
            : false;
          const isFollowing = post.authorId && currentUser?.id
            ? followingUserIds.includes(post.authorId)
            : false;
          const likeKey = `${post.scope || 'community'}-${post.type}-${post.id}`;
          const likeBusy = likeProcessingIds.includes(likeKey);
          const followBusy = followLoadingIds.includes(post.authorId);
          const pollKey = `${post.scope || 'global'}-poll-${post.id}-${post.communityId || 'global'}`;
          const pollBusy = pollVoteBusyIds.includes(pollKey);
          
          return (
            <Post
              key={`${post.scope || post.communityId || 'global'}-${post.type}-${post.id}`}
              post={post}
              onLike={handleToggleLike}
              onComment={handleCommentPress}
              onShare={handleSharePost}
              onFollow={handleToggleFollow}
              onDelete={handleDeletePost}
              onPollVote={post.type === 'poll' ? handlePollVote : undefined}
              pollVoteBusy={post.type === 'poll' ? pollBusy : false}
              onStartQuiz={post.type === 'quiz' ? handleStartQuiz : undefined}
              onImagePress={handleImagePress}
              onProfilePress={handleProfilePress}
              isLiked={isLiked}
              isFollowing={isFollowing}
              likeBusy={likeBusy}
              followBusy={followBusy}
              currentUser={currentUser}
              imageLoadErrors={imageLoadErrors}
              setImageLoadErrors={setImageLoadErrors}
            />
          );
        })
      )}
    </ScrollView>

    {/* Bottom Navigation Bar */}
    <View style={styles.bottomNavBar}>
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Ionicons name="home" size={24} color="#08FFE2" />
        <Text style={[styles.navButtonText, { color: '#08FFE2' }]}>Home</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => navigation.navigate('Community')}
      >
        <Ionicons name="people-outline" size={24} color="#888" />
        <Text style={styles.navButtonText}>Community</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => navigation.navigate('MarketPlace')}
      >
        <Ionicons name="cart-outline" size={24} color="#888" />
        <Text style={styles.navButtonText}>Market</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => navigation.navigate('Message')}
      >
        <Ionicons name="chatbubbles-outline" size={24} color="#888" />
        <Text style={styles.navButtonText}>Messages</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => navigation.navigate('Profile')}
      >
        <Ionicons name="person-outline" size={24} color="#888" />
        <Text style={styles.navButtonText}>Profile</Text>
      </TouchableOpacity>
    </View>

    {/* Quiz Modal */}
    <Modal
      visible={quizModalVisible}
      animationType="slide"
      onRequestClose={handleCloseQuizModal}
      transparent={false}
    >
      <View style={styles.quizModalContainer}>
        <View style={styles.quizModalHeader}>
          <TouchableOpacity onPress={handleCloseQuizModal} disabled={quizSubmitting}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.quizModalTitle} numberOfLines={1}>
            {activeQuiz?.title || 'Quiz'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.quizModalContent}>
          {Array.isArray(activeQuiz?.questions) && activeQuiz.questions.length > 0 ? (
            activeQuiz.questions.map((question, qIndex) => {
              const selectedIndex = quizResponses[qIndex];
              const hasSubmitted = Boolean(quizResult);

              return (
                <View key={`quiz-question-${qIndex}`} style={styles.quizQuestionCard}>
                  <Text style={styles.quizQuestionHeader}>Question {qIndex + 1}</Text>
                  <Text style={styles.quizQuestionText}>{question?.question || 'No question text.'}</Text>

                  {Array.isArray(question?.options) && question.options.length > 0 ? (
                    question.options.map((option, optionIndex) => {
                      const isUserChoice = selectedIndex === optionIndex;
                      const isCorrectAnswer =
                        typeof question?.correctAnswer === 'number' &&
                        question.correctAnswer === optionIndex;

                      const optionStyles = [styles.quizOptionButton];
                      if (isUserChoice) {
                        optionStyles.push(styles.quizOptionButtonSelected);
                      }
                      if (hasSubmitted) {
                        if (isCorrectAnswer) {
                          optionStyles.push(styles.quizOptionButtonCorrect);
                        } else if (isUserChoice) {
                          optionStyles.push(styles.quizOptionButtonIncorrect);
                        }
                      }

                      return (
                        <TouchableOpacity
                          key={`quiz-question-${qIndex}-option-${optionIndex}`}
                          style={optionStyles}
                          activeOpacity={0.85}
                          onPress={() => handleSelectQuizOption(qIndex, optionIndex)}
                          disabled={hasSubmitted || quizSubmitting}
                        >
                          <View style={styles.quizOptionContent}>
                            <View style={styles.quizOptionIndicator}>
                              {hasSubmitted ? (
                                isCorrectAnswer ? (
                                  <Ionicons name="checkmark" size={18} color="#0aff8c" />
                                ) : isUserChoice ? (
                                  <Ionicons name="close" size={18} color="#ff4b6e" />
                                ) : null
                              ) : isUserChoice ? (
                                <Ionicons name="ellipse" size={14} color="#08FFE2" />
                              ) : (
                                <Ionicons name="ellipse-outline" size={14} color="#666" />
                              )}
                            </View>
                            <Text style={styles.quizOptionText}>{option || `Option ${optionIndex + 1}`}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.quizOptionEmpty}>No options available for this question.</Text>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.quizEmptyState}>
              <Ionicons name="warning-outline" size={36} color="#666" />
              <Text style={styles.quizEmptyText}>No questions available for this quiz.</Text>
            </View>
          )}
        </ScrollView>

        {quizResult ? (
          <View style={styles.quizResultSummary}>
            <Text style={styles.quizResultTitle}>Quiz complete!</Text>
            <Text style={styles.quizResultScore}>
              {quizResult.correctCount} / {quizResult.questionCount} correct ({quizResult.score}%)
            </Text>
          </View>
        ) : null}

        <View style={styles.quizModalFooter}>
          {quizResult ? (
            <TouchableOpacity style={styles.quizModalButton} onPress={handleCloseQuizModal}>
              <Text style={styles.quizModalButtonText}>Close</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.quizModalButton, quizSubmitting && styles.quizModalButtonDisabled]}
              onPress={handleSubmitQuiz}
              disabled={quizSubmitting}
            >
              <Text style={styles.quizModalButtonText}>
                {quizSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>

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

    {/* Image Viewer Modal */}
    <Modal
      visible={imageViewerVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseImageViewer}
    >
      <View style={styles.imageViewerContainer}>
        {/* Close Button */}
        <TouchableOpacity 
          style={styles.imageViewerCloseButton}
          onPress={handleCloseImageViewer}
        >
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        {/* Image Counter */}
        {allImagesInPost.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {selectedImageIndex + 1} / {allImagesInPost.length}
            </Text>
          </View>
        )}

        {/* Main Image */}
        <View style={styles.imageViewerContent}>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Navigation Arrows */}
        {allImagesInPost.length > 1 && (
          <>
            {selectedImageIndex > 0 && (
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavButtonLeft]}
                onPress={handlePrevImage}
              >
                <Ionicons name="chevron-back" size={40} color="#fff" />
              </TouchableOpacity>
            )}
            
            {selectedImageIndex < allImagesInPost.length - 1 && (
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavButtonRight]}
                onPress={handleNextImage}
              >
                <Ionicons name="chevron-forward" size={40} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Image Thumbnails */}
        {allImagesInPost.length > 1 && (
          <ScrollView 
            horizontal 
            style={styles.imageThumbnailsContainer}
            contentContainerStyle={styles.imageThumbnailsContent}
            showsHorizontalScrollIndicator={false}
          >
            {allImagesInPost.map((img, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSelectedImageIndex(index);
                  setSelectedImage(img);
                }}
                style={[
                  styles.thumbnailWrapper,
                  selectedImageIndex === index && styles.thumbnailWrapperActive
                ]}
              >
                <Image
                  source={{ uri: img }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
    </>
  );
});

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
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4b6e33',
  },
  postText: { color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  postImage: { height: 100, borderRadius: 10, resizeMode: 'cover' },
  postImageFull: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
  },
  imageFallback: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFallbackText: {
    color: '#666',
    marginTop: 8,
    fontSize: 12,
  },
  noImagePlaceholder: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  noImageText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  globalPostImageWrapper: {
    position: 'relative',
    marginTop: 12,
  },
  multipleImagesBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multipleImagesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pollContainer: {
    marginTop: 12,
    backgroundColor: '#151515',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  pollQuestion: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  pollMeta: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  pollOption: {
    marginBottom: 12,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  pollOptionBarTrack: {
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
    overflow: 'hidden',
  },
  pollOptionBarFill: {
    height: '100%',
    backgroundColor: '#08FFE233',
  },
  pollOptionBarFillSelected: {
    backgroundColor: '#08FFE299',
  },
  pollOptionRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pollOptionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  pollOptionTextSelected: {
    color: '#08FFE2',
    fontWeight: '600',
  },
  pollOptionVotes: {
    color: '#08FFE2',
    fontSize: 12,
    fontWeight: '600',
  },
  pollOptionSelected: {
    borderColor: '#08FFE255',
  },
  pollOptionDisabled: {
    opacity: 0.7,
  },
  pollEmptyText: {
    color: '#666',
    fontSize: 13,
  },
  quizContainer: {
    marginTop: 12,
    backgroundColor: '#141021',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1833',
  },
  quizTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  quizMeta: {
    color: '#8b7be5',
    fontSize: 12,
    fontWeight: '600',
  },
  quizPreview: {
    marginTop: 12,
    backgroundColor: '#1a1533',
    borderRadius: 10,
    padding: 12,
  },
  quizPreviewLabel: {
    color: '#8b7be5',
    fontSize: 12,
    marginBottom: 4,
  },
  quizPreviewQuestion: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  quizActionButton: {
    marginTop: 16,
    backgroundColor: '#08FFE2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quizActionButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  quizModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
  },
  quizModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  quizModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  quizModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  quizQuestionCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  quizQuestionHeader: {
    color: '#08FFE2',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  quizQuestionText: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 16,
  },
  quizOptionButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262626',
  },
  quizOptionButtonSelected: {
    borderColor: '#08FFE2',
    backgroundColor: '#102020',
  },
  quizOptionButtonCorrect: {
    borderColor: '#0aff8c',
    backgroundColor: '#0b261d',
  },
  quizOptionButtonIncorrect: {
    borderColor: '#ff4b6e',
    backgroundColor: '#2a1015',
  },
  quizOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quizOptionIndicator: {
    width: 28,
    alignItems: 'center',
  },
  quizOptionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  quizOptionEmpty: {
    color: '#666',
    fontSize: 13,
  },
  quizEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  quizEmptyText: {
    color: '#777',
    marginTop: 12,
    fontSize: 14,
  },
  quizResultSummary: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    backgroundColor: '#0f1416',
  },
  quizResultTitle: {
    color: '#08FFE2',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  quizResultScore: {
    color: '#fff',
    fontSize: 14,
  },
  quizModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    backgroundColor: '#000',
  },
  quizModalButton: {
    backgroundColor: '#08FFE2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  quizModalButtonDisabled: {
    opacity: 0.6,
  },
  quizModalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  questionContainer: {
    marginTop: 12,
    backgroundColor: '#101a1f',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#12333d',
  },
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionTag: {
    color: '#08FFE2',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionCategory: {
    color: '#66c9ff',
    fontSize: 12,
    fontWeight: '600',
  },
  questionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionDescription: {
    color: '#b5c6d0',
    fontSize: 13,
    lineHeight: 20,
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 12,
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
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navButtonText: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  // Image Viewer Modal Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  imageCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageViewerContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
    zIndex: 10,
  },
  imageNavButtonLeft: {
    left: 20,
  },
  imageNavButtonRight: {
    right: 20,
  },
  imageThumbnailsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    maxHeight: 80,
  },
  imageThumbnailsContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  thumbnailWrapper: {
    width: 60,
    height: 60,
    marginHorizontal: 5,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailWrapperActive: {
    borderColor: '#08FFE2',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default HomeScreen;





