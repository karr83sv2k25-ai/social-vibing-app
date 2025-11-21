import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Share,
  Keyboard,
} from 'react-native';

import { Ionicons, Entypo, AntDesign, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  increment,
  setDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app as firebaseApp } from './firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync, uploadAudioAsync, uploadVideoAsync } from './cloudinaryConfig';
import { Audio, Video } from 'expo-av';


export default function GroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, groupTitle } = route.params || {};
  const [selectedButton, setSelectedButton] = useState('Explore');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  // Chat loading state
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatImage, setSelectedChatImage] = useState(null);
  const [selectedChatVideo, setSelectedChatVideo] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [voiceSound, setVoiceSound] = useState(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [videoRefs, setVideoRefs] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiftOptions, setShowGiftOptions] = useState(false);
  const [selectedGiftOption, setSelectedGiftOption] = useState(null);
  const [activeVoiceChats, setActiveVoiceChats] = useState({}); // Track active voice chats: { messageId: [participantIds] }
  const [showVoiceChatInterface, setShowVoiceChatInterface] = useState(false);
  const [currentVoiceChatSession, setCurrentVoiceChatSession] = useState(null); // { messageId, adminId, participants }
  const [voiceChatMessages, setVoiceChatMessages] = useState([]);
  const [voiceChatInput, setVoiceChatInput] = useState('');
  const [voiceChatParticipants, setVoiceChatParticipants] = useState([]); // Array of user objects with id, name, profileImage
  const [voiceChatRecording, setVoiceChatRecording] = useState(null);
  const [voiceChatRecordingUri, setVoiceChatRecordingUri] = useState(null);
  const [isVoiceChatRecording, setIsVoiceChatRecording] = useState(false);
  const [playingVoiceChatId, setPlayingVoiceChatId] = useState(null);
  const [voiceChatSound, setVoiceChatSound] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false); // Real-time mic state
  const [speakingUsers, setSpeakingUsers] = useState([]); // Users currently speaking
  const [continuousRecording, setContinuousRecording] = useState(null); // Continuous recording for real-time
  const [audioChunkInterval, setAudioChunkInterval] = useState(null); // Interval for audio chunks
  const [playingAudioChunks, setPlayingAudioChunks] = useState({}); // Currently playing audio chunks: { userId: sound }
  const [playedAudioUrls, setPlayedAudioUrls] = useState({}); // Track played URLs: { userId: lastUrl }
  const voiceChatScrollRef = useRef(null);
  const inputRef = useRef(null);
  const [community, setCommunity] = useState(null);
  const [showVoiceRoomButton, setShowVoiceRoomButton] = useState(true);
  const scrollOffsetRef = useRef(0);
  const [members, setMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [recentlyJoined, setRecentlyJoined] = useState([]);
  const [activityStats, setActivityStats] = useState({
    chatting: 0,
    liveChatting: 0,
    readingPosts: 0,
    browsing: 0,
  });
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [selectedPostForComment, setSelectedPostForComment] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsUnsubscribe, setCommentsUnsubscribe] = useState(null);
  const [likeProcessingIds, setLikeProcessingIds] = useState([]);
  const [followLoadingIds, setFollowLoadingIds] = useState([]);
  const [followingUserIds, setFollowingUserIds] = useState([]);
  const [userStats, setUserStats] = useState({
    following: 0,
    followers: 0,
    totalLikes: 0,
    totalBlogs: 0,
    totalPosts: 0,
    ranking: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('community');
  const [showAddModal, setShowAddModal] = useState(false);
  const [communitySection, setCommunitySection] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogs, setBlogs] = useState([]);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]); // Combined blogs and image posts
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  
  // Active audio call state
  const [activeAudioCall, setActiveAudioCall] = useState(null);
  const [audioCallParticipants, setAudioCallParticipants] = useState([]);
  
  // Ref for scrolling to bottom of chat
  const chatScrollRef = React.useRef(null);

  // Add options for the + tab
  const addOptions = [
    { id: 'link', name: 'Link', icon: 'link', color: '#4A69FF', iconFamily: 'FontAwesome5' },
    { id: 'live', name: 'Go Live', icon: 'video', color: '#E440FC', iconFamily: 'FontAwesome5' },
    { id: 'image', name: 'Image', icon: 'image', color: '#FF4A4A', iconFamily: 'FontAwesome5' },
    { id: 'chat', name: 'Public Chatroom', icon: 'chat', color: '#40FC6F', iconFamily: 'MaterialCommunityIcons' },
    { id: 'blog', name: 'Blog', icon: 'newspaper', color: '#40DFFC', iconFamily: 'FontAwesome5' },
    { id: 'drafts', name: 'Drafts', icon: 'file-document-outline', color: '#4D4D6B', iconFamily: 'MaterialCommunityIcons' },
  ];

  // Fetch community details from Firestore (Real-time)
  useEffect(() => {
    if (!communityId) return;
    let unsubscribe;

    const setupListener = async () => {
      setLoading(true);
      setError(null);

        const db = getFirestore(firebaseApp);
        const communityRef = doc(db, 'communities', communityId);

      const firestore = await import('firebase/firestore');
      unsubscribe = firestore.onSnapshot(communityRef, async (communitySnap) => {
        try {
        if (communitySnap.exists()) {
          const data = communitySnap.data();
          // Get member count: prefer members_count, then community_members, then calculate from members array
          let memberCount = 0;
          if (typeof data.members_count === 'number') {
            memberCount = data.members_count;
          } else if (typeof data.community_members === 'number') {
            memberCount = data.community_members;
          } else if (Array.isArray(data.members)) {
            memberCount = data.members.length;
          } else if (Array.isArray(data.community_members)) {
            memberCount = data.community_members.length;
            } else if (Array.isArray(data.memberIds)) {
              memberCount = data.memberIds.length;
          }
          setCommunity({ 
            id: communitySnap.id, 
            ...data,
              memberCount: memberCount
            });
            
            // Extract member IDs from various possible formats
            let memberIds = [];
            
            // Format 1: memberIds array
          if (data.memberIds && Array.isArray(data.memberIds)) {
              memberIds = data.memberIds;
            }
            // Format 2: members array
            else if (data.members && Array.isArray(data.members)) {
              memberIds = data.members;
            }
            // Format 3: community_members array
            else if (data.community_members && Array.isArray(data.community_members)) {
              memberIds = data.community_members;
            }
            // Format 4: Numeric keys (0, 1, 2, etc.) - extract from object
            else {
              const numericKeys = Object.keys(data).filter(key => /^\d+$/.test(key) && typeof data[key] === 'string' && data[key].trim() !== '');
              if (numericKeys.length > 0) {
                memberIds = numericKeys.map(key => data[key]).filter(Boolean);
                console.log('Extracted member IDs from numeric keys:', memberIds);
              }
            }
            
            console.log('Member IDs found:', memberIds.length, memberIds);
            
            // Also check uid field (owner/admin) - add it to memberIds if not already present
            if (data.uid && typeof data.uid === 'string' && data.uid.trim() !== '' && !memberIds.includes(data.uid)) {
              memberIds.push(data.uid);
            }
            
            // If still no members, try fetching from communities_members subcollection
            if (memberIds.length === 0) {
              try {
                const membersCol = collection(db, 'communities', communityId, 'communities_members');
                const membersSnapshot = await getDocs(membersCol);
                const subcollectionMemberIds = membersSnapshot.docs.map(doc => {
                  const memberData = doc.data();
                  return memberData.user_id || memberData.userId || memberData.uid || doc.id;
                }).filter(Boolean);
                if (subcollectionMemberIds.length > 0) {
                  memberIds = subcollectionMemberIds;
                }
              } catch (e) {
                console.log('Error fetching from communities_members subcollection:', e);
              }
            }
            
            console.log('Final member IDs to fetch:', memberIds.length, memberIds);
            
            // Fetch members from users collection
            if (memberIds.length > 0) {
            const usersCol = collection(db, 'users');
              
              // Fetch first 5 for preview
            const memberDocs = await Promise.all(
                memberIds.slice(0, 5).map(async (uid) => {
                  try {
                const userDoc = await getDoc(doc(usersCol, uid));
                return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
                  } catch (e) {
                    return null;
                  }
              })
            );
            setMembers(memberDocs.filter(Boolean));
              
              // Store admin and moderator IDs from community data
              const adminIds = Array.isArray(data.adminIds)
                ? data.adminIds
                : Array.isArray(data.admins)
                ? data.admins
                : data.uid && typeof data.uid === 'string'
                ? [data.uid]
                : [];
              const moderatorIds = Array.isArray(data.moderatorIds)
                ? data.moderatorIds
                : Array.isArray(data.moderators)
                ? data.moderators
                : [];
              
              // Ensure adminIds and moderatorIds are always arrays
              const safeAdminIds = Array.isArray(adminIds) ? adminIds : [];
              const safeModeratorIds = Array.isArray(moderatorIds) ? moderatorIds : [];
              
              // Fetch all members for "Who's Online" section
              const allMemberDocs = await Promise.all(
                memberIds.map(async (uid) => {
                  try {
                    if (!uid || typeof uid !== 'string') return null;
                    const userDoc = await getDoc(doc(usersCol, uid));
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      return {
                        id: userDoc.id,
                        name: userData.displayName || userData.name || userData.fullName || userData.username || 'User',
                        profileImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
                        email: userData.email || null,
                        joinedAt: userData.joinedAt || userData.createdAt || null,
                        isAdmin: safeAdminIds.includes(uid),
                        isModerator: safeModeratorIds.includes(uid),
                      };
                    }
                  } catch (e) {
                    console.log('Error fetching user:', uid, e);
                  }
                  return null;
                })
              );
              const validMembers = allMemberDocs.filter(Boolean);
              setAllMembers(validMembers);
              
              // Separate admins, moderators, and recently joined
              setAdmins(validMembers.filter(m => m.isAdmin));
              setModerators(validMembers.filter(m => m.isModerator && !m.isAdmin));
              
              // Recently joined (last 10, sorted by joinedAt)
              const recentlyJoinedList = validMembers
                .filter(m => !m.isAdmin && !m.isModerator)
                .sort((a, b) => {
                  const aTime = a.joinedAt?.toDate?.() || a.joinedAt || new Date(0);
                  const bTime = b.joinedAt?.toDate?.() || b.joinedAt || new Date(0);
                  return bTime - aTime;
                })
                .slice(0, 10);
              setRecentlyJoined(recentlyJoinedList);
            } else {
              // Try fetching from communities_members collection (separate collection)
              try {
                const membersCol = collection(db, 'communities_members');
                const q = firestore.query(
                  membersCol,
                  firestore.where('community_id', '==', communityId)
                );
                const membersSnapshot = await firestore.getDocs(q);
                const memberUserIds = membersSnapshot.docs.map(doc => {
                  const memberData = doc.data();
                  return memberData.user_id || memberData.userId || memberData.uid;
                }).filter(Boolean);
                
                if (memberUserIds.length > 0) {
                  const usersCol = collection(db, 'users');
                  const allMemberDocs = await Promise.all(
                    memberUserIds.map(async (uid) => {
                      try {
                        const userDoc = await getDoc(doc(usersCol, uid));
                        if (userDoc.exists()) {
                          const userData = userDoc.data();
                          return {
                            id: userDoc.id,
                            name: userData.displayName || userData.name || userData.fullName || userData.username || 'User',
                            profileImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
                            email: userData.email || null,
                            joinedAt: userData.joinedAt || userData.createdAt || null,
                            isAdmin: false,
                            isModerator: false,
                          };
                        }
                      } catch (e) {
                        console.log('Error fetching user:', uid, e);
                      }
                      return null;
                    })
                  );
                  const validMembers = allMemberDocs.filter(Boolean);
                  setAllMembers(validMembers);
                  setMembers(validMembers.slice(0, 5));
                  setRecentlyJoined(validMembers.slice(0, 10));
          } else {
            setMembers([]);
                  setAllMembers([]);
                  setAdmins([]);
                  setModerators([]);
                  setRecentlyJoined([]);
                }
              } catch (e) {
                console.log('Error fetching from communities_members collection:', e);
                setMembers([]);
                setAllMembers([]);
                setAdmins([]);
                setModerators([]);
                setRecentlyJoined([]);
              }
          }
        } else {
          setError('Community not found');
        }
          setLoading(false);
      } catch (e) {
          console.log('Error processing community snapshot:', e);
        setError('Failed to load community');
          setLoading(false);
      }
      }, (error) => {
        console.log('Error fetching community:', error);
        setError('Failed to load community');
      setLoading(false);
      });
    };

    setupListener();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [communityId]);

  // Listen for active audio calls in this community
  useEffect(() => {
    if (!communityId) return;
    let unsubscribe;

    const setupAudioCallListener = async () => {
      const db = getFirestore(firebaseApp);
      const audioCallsCol = collection(db, 'audio_calls', communityId, 'rooms');
      
      const firestore = await import('firebase/firestore');
      const q = firestore.query(
        audioCallsCol,
        firestore.where('isActive', '==', true),
        firestore.orderBy('createdAt', 'desc'),
        firestore.limit(1)
      );

      unsubscribe = firestore.onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const activeRoom = snapshot.docs[0];
          const roomData = activeRoom.data();
          setActiveAudioCall({
            roomId: activeRoom.id,
            ...roomData,
          });
          setAudioCallParticipants(roomData.participants || []);
        } else {
          setActiveAudioCall(null);
          setAudioCallParticipants([]);
        }
      }, (error) => {
        console.log('Error listening to audio calls:', error);
        setActiveAudioCall(null);
        setAudioCallParticipants([]);
      });
    };

    setupAudioCallListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [communityId]);

  // Real-time listener for communities_members collection (backup if members not in community doc)
  useEffect(() => {
    if (!communityId || allMembers.length > 0) return; // Skip if we already have members
    let unsubscribe;

    const setupBackupListener = async () => {
      const db = getFirestore(firebaseApp);

      try {
        const firestore = await import('firebase/firestore');
        const membersCol = collection(db, 'communities_members');
        const q = firestore.query(
          membersCol,
          firestore.where('community_id', '==', communityId)
        );

        unsubscribe = firestore.onSnapshot(q, async (snapshot) => {
          if (snapshot.size > 0) {
            const memberUserIds = snapshot.docs.map(doc => {
              const memberData = doc.data();
              return memberData.user_id || memberData.userId || memberData.uid;
            }).filter(Boolean);

            if (memberUserIds.length > 0) {
              const usersCol = collection(db, 'users');
              const allMemberDocs = await Promise.all(
                memberUserIds.map(async (uid) => {
                  try {
                    const userDoc = await getDoc(doc(usersCol, uid));
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      return {
                        id: userDoc.id,
                        name: userData.displayName || userData.name || userData.fullName || userData.username || 'User',
                        profileImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
                        email: userData.email || null,
                        joinedAt: userData.joinedAt || userData.createdAt || null,
                        isAdmin: false,
                        isModerator: false,
                      };
                    }
                  } catch (e) {
                    console.log('Error fetching user:', uid, e);
                  }
                  return null;
                })
              );
              const validMembers = allMemberDocs.filter(Boolean);
              if (validMembers.length > 0) {
                setAllMembers(validMembers);
                setMembers(validMembers.slice(0, 5));
                setRecentlyJoined(validMembers.slice(0, 10));
              }
            }
          }
        }, (error) => {
          console.log('Error listening to communities_members:', error);
        });
      } catch (e) {
        console.log('Error setting up communities_members listener:', e);
      }
    };

    setupBackupListener();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [communityId, allMembers.length]);

  // Fetch current user from Firestore (for chat messaging)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const auth = getAuth(firebaseApp);
        const db = getFirestore(firebaseApp);
        
        // Get currently logged-in user from Firebase Auth
        if (auth.currentUser) {
          const userId = auth.currentUser.uid;
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            // Try multiple fields to get user name from Firestore
            const userName = userData.displayName 
              || userData.name 
              || userData.fullName 
              || userData.username 
              || auth.currentUser.displayName 
              || 'User';
            
            setCurrentUser({ 
              id: userId, 
              name: userName,
              profileImage: userData.profileImage || userData.avatar || null,
              email: userData.email || auth.currentUser.email
            });
            console.log('Current user loaded:', userName);
          } else {
            // If user doc doesn't exist, use auth data
            setCurrentUser({ 
              id: userId, 
              name: auth.currentUser.displayName || 'User',
              profileImage: null,
              email: auth.currentUser.email
            });
          }
        } else {
          // No user logged in
          console.log('No user logged in');
          setCurrentUser(null);
        }
      } catch (e) {
        console.log('Error fetching current user:', e);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Fetch user stats (following, followers, likes, blogs, posts, ranking)
  useEffect(() => {
    if (!currentUser?.id) return;

    const db = getFirestore(firebaseApp);
    const userId = currentUser.id;

    const fetchUserStats = async () => {
      try {

        // Fetch following count (users this user is following)
        const followingCol = collection(db, 'users', userId, 'following');
        const followingSnapshot = await getDocs(followingCol);
        const followingCount = followingSnapshot.size;

        // Fetch followers count (users following this user)
        // Check each user's following subcollection for current user
        let followersCount = 0;
        try {
          const allUsersSnapshot = await getDocs(collection(db, 'users'));
          const checkFollowersPromises = allUsersSnapshot.docs.map(async (userDoc) => {
            if (userDoc.id === userId) return false; // Skip self
            try {
              const followDocRef = doc(db, 'users', userDoc.id, 'following', userId);
              const followDoc = await getDoc(followDocRef);
              return followDoc.exists();
            } catch (e) {
              return false;
            }
          });
          const followersResults = await Promise.all(checkFollowersPromises);
          followersCount = followersResults.filter(Boolean).length;
        } catch (e) {
          console.log('Error fetching followers:', e);
        }

        // Fetch total likes received on user's blogs and posts
        let totalLikes = 0;
        let totalBlogs = 0;
        let totalPosts = 0;

        // Get all communities to check user's posts
        const communitiesSnapshot = await getDocs(collection(db, 'communities'));
        const communities = communitiesSnapshot.docs;

        for (const commDoc of communities) {
          const commId = commDoc.id;
          
          // Check blogs
          try {
            const blogsCol = collection(db, 'communities', commId, 'blogs');
            const blogsSnapshot = await getDocs(blogsCol);
            blogsSnapshot.docs.forEach((blogDoc) => {
              const blogData = blogDoc.data();
              if (blogData.authorId === userId) {
                totalBlogs++;
                totalLikes += blogData.likes || 0;
              }
            });
          } catch (e) {
            console.log('Error fetching blogs:', e);
          }

          // Check posts
          try {
            const postsCol = collection(db, 'communities', commId, 'posts');
            const postsSnapshot = await getDocs(postsCol);
            postsSnapshot.docs.forEach((postDoc) => {
              const postData = postDoc.data();
              if (postData.authorId === userId) {
                totalPosts++;
                totalLikes += postData.likes || 0;
              }
            });
          } catch (e) {
            console.log('Error fetching posts:', e);
          }
        }

        // Calculate ranking based on total likes compared to all users
        let ranking = 0;
        if (totalLikes > 0) {
          // Get all users and their total likes
          const allUsersLikes = [];
          for (const commDoc of communities) {
            const commId = commDoc.id;
            
            // Check blogs
            try {
              const blogsCol = collection(db, 'communities', commId, 'blogs');
              const blogsSnapshot = await getDocs(blogsCol);
              blogsSnapshot.docs.forEach((blogDoc) => {
                const blogData = blogDoc.data();
                if (blogData.authorId) {
                  const existing = allUsersLikes.find(u => u.userId === blogData.authorId);
                  if (existing) {
                    existing.likes += blogData.likes || 0;
                  } else {
                    allUsersLikes.push({ userId: blogData.authorId, likes: blogData.likes || 0 });
                  }
                }
              });
            } catch (e) {
              // Ignore errors
            }

            // Check posts
            try {
              const postsCol = collection(db, 'communities', commId, 'posts');
              const postsSnapshot = await getDocs(postsCol);
              postsSnapshot.docs.forEach((postDoc) => {
                const postData = postDoc.data();
                if (postData.authorId) {
                  const existing = allUsersLikes.find(u => u.userId === postData.authorId);
                  if (existing) {
                    existing.likes += postData.likes || 0;
                  } else {
                    allUsersLikes.push({ userId: postData.authorId, likes: postData.likes || 0 });
                  }
                }
              });
            } catch (e) {
              // Ignore errors
            }
          }
          
          // Sort by likes descending
          allUsersLikes.sort((a, b) => b.likes - a.likes);
          
          // Find user's position
          const userIndex = allUsersLikes.findIndex(u => u.userId === userId);
          ranking = userIndex >= 0 ? userIndex + 1 : allUsersLikes.length + 1;
        }

        setUserStats({
          following: followingCount,
          followers: followersCount,
          totalLikes,
          totalBlogs,
          totalPosts,
          ranking,
        });
      } catch (e) {
        console.log('Error fetching user stats:', e);
      }
    };

    fetchUserStats();
    
    // Set up real-time listener for following count
    let followingUnsubscribe = null;
    let followersUnsubscribe = null;
    
    const setupRealTimeStats = async () => {
      try {
        const firestore = await import('firebase/firestore');
        
        // Real-time listener for following count
        const followingCol = collection(db, 'users', userId, 'following');
        followingUnsubscribe = firestore.onSnapshot(followingCol, (snapshot) => {
          setUserStats((prev) => ({
            ...prev,
            following: snapshot.size,
          }));
        });
        
        // Periodic refresh for followers count (since it's expensive to listen to all users)
        const refreshFollowersCount = async () => {
          let followersCount = 0;
          try {
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            const checkFollowersPromises = allUsersSnapshot.docs.map(async (userDoc) => {
              if (userDoc.id === userId) return false;
              try {
                const followDocRef = doc(db, 'users', userDoc.id, 'following', userId);
                const followDoc = await getDoc(followDocRef);
                return followDoc.exists();
              } catch (e) {
                return false;
              }
            });
            const followersResults = await Promise.all(checkFollowersPromises);
            followersCount = followersResults.filter(Boolean).length;
            setUserStats((prev) => ({
              ...prev,
              followers: followersCount,
            }));
          } catch (e) {
            console.log('Error refreshing followers count:', e);
          }
        };
        
        // Refresh immediately and then every 30 seconds
        refreshFollowersCount();
        const followersInterval = setInterval(refreshFollowersCount, 30000);
        
        return () => {
          clearInterval(followersInterval);
        };
      } catch (e) {
        console.log('Error setting up real-time stats:', e);
        return null;
      }
    };
    
    let cleanupInterval = null;
    
    setupRealTimeStats().then((cleanup) => {
      if (cleanup) cleanupInterval = cleanup;
    });
    
    return () => {
      if (followingUnsubscribe) followingUnsubscribe();
      if (followersUnsubscribe) followersUnsubscribe();
      if (cleanupInterval) cleanupInterval();
    };
  }, [currentUser?.id]);

  // Listen to current user's following list
  useEffect(() => {
    if (!currentUser?.id) {
      setFollowingUserIds([]);
      return;
    }

    const db = getFirestore(firebaseApp);
    let unsubscribe;

    const setupFollowingListener = async () => {
      try {
        const firestore = await import('firebase/firestore');
        const followCol = collection(db, 'users', currentUser.id, 'following');
        unsubscribe = firestore.onSnapshot(followCol, (snapshot) => {
          const ids = snapshot.docs.map((docSnap) => docSnap.id);
          setFollowingUserIds(ids);
        });
      } catch (e) {
        console.log('Error listening to following collection:', e);
      }
    };

    setupFollowingListener();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser?.id]);

  // Chat: Listen for messages in Firestore
  useEffect(() => {
    if (!communityId) return;
    setChatLoading(true);
    const db = getFirestore(firebaseApp);
    const chatCol = collection(db, 'community_chats', communityId, 'messages');
    
    // Cache to avoid multiple Firestore reads for same user
    const userCache = {};
    
    // Real-time listener
    import('firebase/firestore').then(firestore => {
      const q = firestore.query(chatCol, firestore.orderBy('createdAt', 'asc'));
      const unsubscribe = firestore.onSnapshot(q, async (snapshot) => {
        const msgs = [];
        
        // Process all messages and fetch sender details
        const promises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let senderData = { name: data.sender || 'Unknown', profileImage: null };
          
          // Check if we have sender ID
          const senderId = data.senderId;
          if (senderId) {
            // Check cache first
            if (userCache[senderId]) {
              senderData = userCache[senderId];
            } else {
              // Fetch from Firestore users collection
              try {
                const userRef = firestore.doc(db, 'users', senderId);
                const userSnap = await firestore.getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  // Try multiple fields to get user name
                  const senderName = userData.displayName 
                    || userData.name 
                    || userData.fullName 
                    || userData.username 
                    || data.sender 
                    || 'Unknown';
                  
                  senderData = {
                    name: senderName,
                    profileImage: userData.profileImage || userData.avatar || null,
                  };
                  // Cache it
                  userCache[senderId] = senderData;
                  console.log('Fetched sender:', senderName);
                }
              } catch (e) {
                console.log('Error fetching sender details:', e);
              }
            }
          }
          
          return {
            id: docSnap.id,
            text: data.text || '',
            sender: senderData.name,
            senderId: senderId,
            profileImage: senderData.profileImage,
            imageUrl: data.imageUrl || null,
            videoUrl: data.videoUrl || null,
            voiceUrl: data.voiceUrl || null,
            type: data.type || 'text',
            duration: data.duration || null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || null),
          };
        });
        
        // Wait for all messages to be processed
        const processedMsgs = await Promise.all(promises);
        setChatMessages(processedMsgs);
        setChatLoading(false);
      });
      
      // Cleanup
      return () => {
        unsubscribe();
      };
    });
  }, [communityId]);

  // Cleanup voice sound on unmount or when component changes
  useEffect(() => {
    return () => {
      if (voiceSound) {
        voiceSound.stopAsync().then(() => voiceSound.unloadAsync()).catch(() => {});
      }
    };
  }, [voiceSound]);

  // Cleanup video refs on unmount
  useEffect(() => {
    return () => {
      Object.values(videoRefs).forEach((ref) => {
        if (ref && ref.stopAsync) {
          ref.stopAsync().catch(() => {});
          ref.unloadAsync().catch(() => {});
        }
      });
    };
  }, [videoRefs]);

  // Fetch participant user details
  const fetchParticipantDetails = async (participantIds) => {
    if (!participantIds || participantIds.length === 0) {
      setVoiceChatParticipants([]);
      return;
    }
    
    const db = getFirestore(firebaseApp);
    const participantPromises = participantIds.map(async (userId) => {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          return {
            id: userId,
            name: userData.displayName || userData.name || userData.fullName || userData.username || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
          };
        }
        return {
          id: userId,
          name: 'User',
          profileImage: null,
        };
      } catch (error) {
        console.error('Error fetching participant:', error);
        return {
          id: userId,
          name: 'User',
          profileImage: null,
        };
      }
    });
    
    const participants = await Promise.all(participantPromises);
    setVoiceChatParticipants(participants);
  };

  // Listen for Voice Chat participants updates and fetch initial participants
  useEffect(() => {
    if (!currentVoiceChatSession?.messageId || !communityId) return;
    
    // Fetch initial participant details
    if (currentVoiceChatSession.participants && currentVoiceChatSession.participants.length > 0) {
      fetchParticipantDetails(currentVoiceChatSession.participants);
    }
    
    const db = getFirestore(firebaseApp);
    const messageRef = doc(db, 'community_chats', communityId, 'messages', currentVoiceChatSession.messageId);
    
    const unsubscribe = onSnapshot(messageRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const participants = data.participants || [];
        setCurrentVoiceChatSession(prev => ({
          ...prev,
          participants: participants,
        }));
        
        // Fetch participant details
        await fetchParticipantDetails(participants);
      }
    });
    
    return () => unsubscribe();
  }, [currentVoiceChatSession?.messageId, communityId]);

  // Listen for Voice Chat Messages
  useEffect(() => {
    if (!currentVoiceChatSession?.messageId || !communityId) return;
    
    const db = getFirestore(firebaseApp);
    const voiceChatMessagesCol = collection(
      db, 
      'community_chats', 
      communityId, 
      'messages', 
      currentVoiceChatSession.messageId,
      'voiceChatMessages'
    );
    
    let unsubscribe;
    
    import('firebase/firestore').then(firestore => {
      const q = firestore.query(voiceChatMessagesCol, firestore.orderBy('createdAt', 'asc'));
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        const msgs = [];
        
        // Cache to avoid multiple Firestore reads for same user
        const userCache = {};
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          let senderData = { name: data.sender || 'Unknown', profileImage: null };
          
          // Check if we have sender ID
          const senderId = data.senderId;
          if (senderId && !userCache[senderId]) {
            try {
              const userRef = doc(db, 'users', senderId);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const userData = userSnap.data();
                senderData = {
                  name: userData.displayName || userData.name || userData.fullName || userData.username || data.sender || 'User',
                  profileImage: userData.profileImage || userData.avatar || null,
                };
              }
              userCache[senderId] = senderData;
            } catch (error) {
              console.error('Error fetching user:', error);
            }
          } else if (senderId && userCache[senderId]) {
            senderData = userCache[senderId];
          }
          
          msgs.push({
            id: docSnap.id,
            sender: senderData.name,
            senderId: senderId,
            profileImage: senderData.profileImage || data.profileImage || null,
            text: data.text || null,
            voiceUrl: data.voiceUrl || null,
            type: data.type || 'text',
            duration: data.duration || null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || null),
          });
        }
        
        setVoiceChatMessages(msgs);
        
        // Scroll to bottom
        setTimeout(() => {
          voiceChatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentVoiceChatSession?.messageId, communityId]);

  // Cleanup voice chat sound on unmount
  useEffect(() => {
    return () => {
      if (voiceChatSound) {
        voiceChatSound.stopAsync().then(() => voiceChatSound.unloadAsync()).catch(() => {});
      }
    };
  }, [voiceChatSound]);

  // Listen for Real-time Audio Chunks from Other Participants
  useEffect(() => {
    if (!currentVoiceChatSession?.messageId || !communityId || !currentUser) return;
    
    const db = getFirestore(firebaseApp);
    const realTimeAudioCol = collection(
      db,
      'community_chats',
      communityId,
      'messages',
      currentVoiceChatSession.messageId,
      'realTimeAudio'
    );
    
    let unsubscribe;
    
    import('firebase/firestore').then(firestore => {
      unsubscribe = onSnapshot(realTimeAudioCol, async (snapshot) => {
        const speakingList = [];
        const newAudioChunks = {};
        
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          const userId = docSnap.id;
          
          // Don't process current user's own audio
          if (userId === currentUser.id) return;
          
          // Check if user is speaking
          if (data.isSpeaking && data.audioUrl) {
            speakingList.push({
              userId: userId,
              userName: data.userName || 'User',
            });
            
          // Check if this is a new audio chunk (different URL)
          // Also check timestamp to ensure it's a recent chunk (within last 3 seconds for live audio)
          const lastPlayedUrl = playedAudioUrls[userId];
          const chunkTimestamp = data.timestamp?.toDate?.() || data.timestamp;
          const now = new Date();
          const isRecentChunk = chunkTimestamp ? (now - new Date(chunkTimestamp)) < 3000 : true; // 3 seconds for live audio
          
          if (data.audioUrl && data.audioUrl !== lastPlayedUrl && isRecentChunk) {
            newAudioChunks[userId] = data.audioUrl;
            setPlayedAudioUrls(prev => ({
              ...prev,
              [userId]: data.audioUrl,
            }));
          }
          }
        });
        
        setSpeakingUsers(speakingList);
        
        // Play new audio chunks immediately for live communication
        Object.entries(newAudioChunks).forEach(async ([userId, audioUrl]) => {
          if (audioUrl) {
            // Play immediately without waiting
            playRealTimeAudioChunk(userId, audioUrl).catch(error => {
              console.error(`Error playing audio for user ${userId}:`, error);
            });
          }
        });
      });
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentVoiceChatSession?.messageId, communityId, currentUser?.id]);

  // Play Real-time Audio Chunk
  const playRealTimeAudioChunk = async (userId, audioUrl) => {
    if (!audioUrl) return;
    
    try {
      // Stop any currently playing audio for this user (to avoid overlap)
      if (playingAudioChunks[userId]) {
        try {
          const sound = playingAudioChunks[userId];
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (error) {
          // Ignore errors if already stopped
        }
      }
      
      // Configure audio mode for playback while recording - Use speaker
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false, // false = use speaker
      });
      
      // Create and play new sound on speaker immediately for live communication
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: false, // Don't auto-play, we'll play manually
          volume: 1.0,
          isMuted: false,
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );
      
      // Track this playing audio
      setPlayingAudioChunks(prev => ({
        ...prev,
        [userId]: sound,
      }));
      
      // Play immediately through speaker
      await sound.playAsync();
      
      // Cleanup when finished
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingAudioChunks(prev => {
            const updated = { ...prev };
            delete updated[userId];
            return updated;
          });
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (error) {
      console.error('Error playing real-time audio chunk:', error);
      // Remove from playing list on error
      setPlayingAudioChunks(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    }
  };

  // Cleanup real-time recording and audio on unmount
  useEffect(() => {
    return () => {
      // Stop continuous recording
      if (continuousRecording) {
        continuousRecording.stopAndUnloadAsync().catch(() => {});
      }
      
      // Clear interval
      if (audioChunkInterval) {
        clearInterval(audioChunkInterval);
      }
      
      // Stop all playing audio chunks
      Object.values(playingAudioChunks).forEach(sound => {
        sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
      });
    };
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
      // Use multiple attempts to ensure scroll happens
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 500);
    }
  }, [chatMessages]);

  // Fetch blogs from Firestore
  useEffect(() => {
    if (!communityId) return;
    const db = getFirestore(firebaseApp);
    const blogsCol = collection(db, 'communities', communityId, 'blogs');
    
    // Real-time listener for blogs
    import('firebase/firestore').then(firestore => {
      const q = firestore.query(blogsCol, firestore.orderBy('createdAt', 'desc'));
      const unsubscribe = firestore.onSnapshot(q, (snapshot) => {
        const blogsList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
          id: docSnap.id,
            type: 'blog', // Mark as blog type
            ...data,
            likes: typeof data.likes === 'number' ? data.likes : 0,
            comments: typeof data.comments === 'number' ? data.comments : 0,
            likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          };
        });
        setBlogs(blogsList);
        console.log('Blogs loaded:', blogsList.length);
      });
      
      // Cleanup
      return () => unsubscribe();
    });
  }, [communityId]);

  // Fetch image posts from Firestore
  useEffect(() => {
    if (!communityId) return;
    const db = getFirestore(firebaseApp);
    const postsCol = collection(db, 'communities', communityId, 'posts');
    
    // Real-time listener for image posts
    import('firebase/firestore').then(firestore => {
      const q = firestore.query(postsCol, firestore.orderBy('createdAt', 'desc'));
      const unsubscribe = firestore.onSnapshot(q, (snapshot) => {
        const postsList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            type: 'image', // Mark as image post type
            ...data,
            likes: typeof data.likes === 'number' ? data.likes : 0,
            comments: typeof data.comments === 'number' ? data.comments : 0,
            likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          };
        });
        setPosts(postsList);
        console.log('Image posts loaded:', postsList.length);
      });
      
      // Cleanup
      return () => unsubscribe();
    });
  }, [communityId]);

  // Combine blogs and posts, sort by createdAt
  useEffect(() => {
    const combined = [...blogs, ...posts];
    // Sort by createdAt (newest first)
    combined.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
      const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
      return bTime - aTime; // Descending order
    });
    setAllPosts(combined);
  }, [blogs, posts]);

  // Fetch drafts from Firestore
  useEffect(() => {
    if (!communityId || !currentUser?.id) return;
    const db = getFirestore(firebaseApp);
    const draftsCol = collection(db, 'communities', communityId, 'drafts');
    
    // Real-time listener for drafts
    import('firebase/firestore').then(firestore => {
      const q = firestore.query(
        draftsCol, 
        firestore.where('authorId', '==', currentUser.id)
      );
      const unsubscribe = firestore.onSnapshot(q, (snapshot) => {
        const draftsList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Sort by updatedAt on client side
        draftsList.sort((a, b) => {
          const aTime = a.updatedAt?.toDate?.() || a.updatedAt || new Date(0);
          const bTime = b.updatedAt?.toDate?.() || b.updatedAt || new Date(0);
          return bTime - aTime; // Descending order
        });
        setDrafts(draftsList);
        console.log('Drafts loaded:', draftsList.length);
      });
      
      // Cleanup
      return () => unsubscribe();
    });
  }, [communityId, currentUser?.id]);

  // Fetch activity stats and online members in real-time
  useEffect(() => {
    if (!communityId) return;
    const db = getFirestore(firebaseApp);
    
    // Listen for online members (users currently viewing this community)
    // This would require a separate collection to track active users
    // For now, we'll use member count as a proxy
    const updateActivityStats = () => {
      // Simulate activity stats based on member count
      // In production, you'd track this in Firestore
      const totalMembers = allMembers.length;
      setActivityStats({
        chatting: Math.floor(totalMembers * 0.3),
        liveChatting: Math.floor(totalMembers * 0.2),
        readingPosts: Math.floor(totalMembers * 0.4),
        browsing: Math.floor(totalMembers * 0.3),
      });
    };
    
    updateActivityStats();
    
    // Update stats when members change
    const interval = setInterval(updateActivityStats, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [communityId, allMembers.length]);

  // Use category from Firestore as tag
  const tags = community?.category ? [`#${community.category}`] : ['#Uncategorized'];
  const bottomButtons = ['Explore', 'Post', 'Chat', 'Info', 'Members'];
  const categories = community?.categories || [
    'Anime & Manga',
    'Role play',
    'Art & Aesthetic',
    'Fandom',
    'Animals & Pets',
  ];

  const TagButton = ({ title, colorActive }) => (
    <TouchableOpacity style={[styles.tagButton, { borderColor: colorActive }]}> 
      <Text style={[styles.tagButtonText, { color: colorActive }]}> 
        {title}
      </Text>
    </TouchableOpacity>
  );

  // Handle image picker for chat
  const handlePickChatImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedChatImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('ImagePicker error', e);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Handle video picker
  const handlePickChatVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedChatVideo(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('ImagePicker error', e);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  // Handle voice recording
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to record audio is required!');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = recording.getURI();
    setRecordingUri(uri);
    setRecording(null);
  };

  const cancelRecording = async () => {
    if (!recording) return;
    
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    setRecording(null);
    setRecordingUri(null);
  };

  const isVoiceRoomType = (type) => {
    if (typeof type !== 'string') return false;
    const normalized = type.toLowerCase();
    return normalized.includes('voice') && normalized.includes('room');
  };

  // Handle Voice Room button - Opens audio call screen
  const handleVoiceChatClick = () => {
    setShowGiftOptions(false);
    setSelectedGiftOption(null);
    handleStartAudioCall();
  };

  // Fetch Voice Chat Details
  const fetchVoiceChatDetails = async (messageId) => {
    if (!communityId || !messageId) return;
    
    try {
      const db = getFirestore(firebaseApp);
      const messageRef = doc(db, 'community_chats', communityId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      
      if (messageSnap.exists()) {
        const data = messageSnap.data();
        return {
          messageId: messageSnap.id,
          adminId: data.senderId,
          participants: data.participants || [],
          sender: data.sender,
          createdAt: data.createdAt,
          roomId: data.roomId || null,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching voice chat details:', error);
      return null;
    }
  };

  // Voice Chat Recording Functions
  const startVoiceChatRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to record audio is required!');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setVoiceChatRecording(recording);
      setIsVoiceChatRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopVoiceChatRecording = async () => {
    if (!voiceChatRecording) return;
    
    setIsVoiceChatRecording(false);
    await voiceChatRecording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = voiceChatRecording.getURI();
    setVoiceChatRecordingUri(uri);
    setVoiceChatRecording(null);
  };

  const cancelVoiceChatRecording = async () => {
    if (!voiceChatRecording) return;
    
    setIsVoiceChatRecording(false);
    await voiceChatRecording.stopAndUnloadAsync();
    setVoiceChatRecording(null);
    setVoiceChatRecordingUri(null);
  };

  // Voice Communication - Toggle Microphone (placeholder)
  const toggleRealTimeMic = () => {
    const newMicState = !isMicOn;
    setIsMicOn(newMicState);
    Alert.alert(
      'Voice Rooms Unavailable',
      newMicState
        ? 'Live mic controls are disabled until a new voice provider is configured.'
        : 'Microphone muted.'
    );
  };

  // Start Real-time Continuous Recording
  const startRealTimeRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to record audio is required!');
        return;
      }

      // Configure audio for speaker output (not earpiece)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false, // false = use speaker (allows live voice communication)
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setContinuousRecording(recording);
      
      // Start recording chunks every 1 second for live real-time communication
      const interval = setInterval(async () => {
        if (isMicOn && continuousRecording) {
          await captureAndUploadAudioChunk();
        }
      }, 1000); // 1 second chunks for live real-time voice communication
      
      setAudioChunkInterval(interval);
    } catch (err) {
      console.error('Failed to start real-time recording', err);
      Alert.alert('Error', 'Failed to start microphone');
      setIsMicOn(false);
    }
  };

  // Stop Real-time Recording
  const stopRealTimeRecording = async () => {
    if (continuousRecording) {
      try {
        await continuousRecording.stopAndUnloadAsync();
        setContinuousRecording(null);
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
    
    if (audioChunkInterval) {
      clearInterval(audioChunkInterval);
      setAudioChunkInterval(null);
    }
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
  };

  // Capture and Upload Audio Chunk
  const captureAndUploadAudioChunk = async () => {
    if (!continuousRecording || !currentVoiceChatSession?.messageId || !currentUser) return;
    
    try {
      // Stop current recording to get chunk
      await continuousRecording.stopAndUnloadAsync();
      const uri = continuousRecording.getURI();
      
      if (uri) {
        // Upload chunk to Cloudinary
        const audioUrl = await uploadAudioAsync(uri, {
          folder: 'voice_chat_realtime',
          resource_type: 'video', // Use video resource type for faster processing
        });
        
        // Save chunk URL to Firestore for other participants
        const db = getFirestore(firebaseApp);
        const firestore = await import('firebase/firestore');
        const audioChunkRef = doc(
          db,
          'community_chats',
          communityId,
          'messages',
          currentVoiceChatSession.messageId,
          'realTimeAudio',
          currentUser.id
        );
        
        await updateDoc(audioChunkRef, {
          audioUrl: audioUrl,
          timestamp: firestore.serverTimestamp(),
          isSpeaking: true,
        });
      }
      
      // Restart recording for next chunk
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setContinuousRecording(recording);
    } catch (error) {
      console.error('Error capturing audio chunk:', error);
      
      // Restart recording even if upload failed
      try {
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setContinuousRecording(recording);
      } catch (err) {
        console.error('Error restarting recording:', err);
      }
    }
  };

  // Send Voice Message in Voice Chat
  const sendVoiceChatMessage = async () => {
    if (!currentVoiceChatSession?.messageId || !communityId || !currentUser) return;
    
    // Check if sending text or voice
    if (!voiceChatInput.trim() && !voiceChatRecordingUri) return;
    
    try {
      const db = getFirestore(firebaseApp);
      const firestore = await import('firebase/firestore');
      
      // Use a subcollection for voice chat messages
      const voiceChatMessagesCol = collection(
        db, 
        'community_chats', 
        communityId, 
        'messages', 
        currentVoiceChatSession.messageId,
        'voiceChatMessages'
      );
      
      const messageData = {
        sender: currentUser?.name || 'User',
        senderId: currentUser?.id || 'user',
        profileImage: currentUser?.profileImage || null,
        createdAt: firestore.serverTimestamp(),
        type: voiceChatRecordingUri ? 'voice' : 'text',
      };
      
      // Add text if present
      if (voiceChatInput.trim()) {
        messageData.text = voiceChatInput.trim();
      }
      
      // Add voice if present
      if (voiceChatRecordingUri) {
        try {
          const voiceUrl = await uploadAudioAsync(voiceChatRecordingUri, {
            folder: 'voice_chat_audio'
          });
          messageData.voiceUrl = voiceUrl;
          messageData.type = voiceChatInput.trim() ? 'text_voice' : 'voice';
          messageData.duration = 0; // You can calculate duration if needed
          setVoiceChatRecordingUri(null);
        } catch (error) {
          console.error('Error uploading voice:', error);
          Alert.alert('Error', 'Failed to upload voice message');
          return;
        }
      }
      
      await firestore.addDoc(voiceChatMessagesCol, messageData);
      setVoiceChatInput('');
    } catch (error) {
      console.error('Error sending voice chat message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Handle Join Voice Room (disabled placeholder)
  const handleJoinVoiceChat = () => {
    Alert.alert(
      'Voice Rooms Unavailable',
      'Joining live voice rooms is disabled in this build.'
    );
  };

  const handleSendMessage = async () => {
    // Check if there's anything to send
    if (chatInput.trim() === '' && !selectedChatImage && !selectedChatVideo && !recordingUri) return;
    
    setChatLoading(true);
    const db = getFirestore(firebaseApp);
    const chatCol = collection(db, 'community_chats', communityId, 'messages');
    
    try {
      const messageData = {
        sender: currentUser?.name || 'User',
        senderId: currentUser?.id || 'user',
        profileImage: currentUser?.profileImage || null,
        createdAt: (await import('firebase/firestore')).serverTimestamp(),
        type: 'text', // default type
      };

      // Handle text message
      if (chatInput.trim() !== '') {
        messageData.text = chatInput.trim();
      }

      // Handle image message
      if (selectedChatImage) {
        try {
          const imageUrl = await uploadImageAsync(selectedChatImage, {
            folder: 'chat_images'
          });
          messageData.imageUrl = imageUrl;
          messageData.type = messageData.text ? 'text_image' : 'image';
          setSelectedChatImage(null);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload image');
          setChatLoading(false);
          return;
        }
      }

      // Handle video message
      if (selectedChatVideo) {
        try {
          const videoUrl = await uploadVideoAsync(selectedChatVideo, {
            folder: 'chat_videos'
          });
          messageData.videoUrl = videoUrl;
          messageData.type = messageData.text ? 'text_video' : (messageData.imageUrl ? 'image_video' : 'video');
          setSelectedChatVideo(null);
        } catch (error) {
          console.error('Error uploading video:', error);
          Alert.alert('Error', 'Failed to upload video');
          setChatLoading(false);
          return;
        }
      }

      // Handle voice message
      if (recordingUri) {
        try {
          // Upload voice file to Cloudinary
          const voiceUrl = await uploadAudioAsync(recordingUri, {
            folder: 'chat_voice'
          });
          messageData.voiceUrl = voiceUrl;
          // Update type considering video
          if (messageData.videoUrl) {
            messageData.type = messageData.text ? 'text_video_voice' : (messageData.imageUrl ? 'image_video_voice' : 'video_voice');
          } else {
            messageData.type = messageData.text ? 'text_voice' : (messageData.imageUrl ? 'image_voice' : 'voice');
          }
          messageData.duration = 0; // You can calculate duration if needed
          setRecordingUri(null);
        } catch (error) {
          console.error('Error uploading voice:', error);
          Alert.alert('Error', 'Failed to upload voice message. Please try again.');
          setChatLoading(false);
          return;
        }
      }

    // Add message to Firestore
      const firestore = await import('firebase/firestore');
      await firestore.addDoc(chatCol, messageData);
      
        setChatInput('');
        setChatLoading(false);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setChatLoading(false);
    }
  };

  const getPostDocRef = (db, post) => {
    const collectionName = post.type === 'blog' ? 'blogs' : 'posts';
    return doc(db, 'communities', communityId, collectionName, post.id);
  };

  const updateLocalPostState = (postId, type, transform) => {
    if (type === 'blog') {
      setBlogs((prev) =>
        prev.map((item) => {
          if (item.id !== postId) return item;
          const changes = transform(item) || {};
          return { ...item, ...changes };
        })
      );
    } else {
      setPosts((prev) =>
        prev.map((item) => {
          if (item.id !== postId) return item;
          const changes = transform(item) || {};
          return { ...item, ...changes };
        })
      );
    }
  };

  const handleToggleLike = async (post) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to like posts.');
      return;
    }
    if (!post?.id) return;

    const likeKey = `${post.type}-${post.id}`;
    if (likeProcessingIds.includes(likeKey)) return;
    setLikeProcessingIds((prev) => [...prev, likeKey]);

    try {
      const db = getFirestore(firebaseApp);
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
        updateLocalPostState(post.id, post.type, () => result);
      }
    } catch (e) {
      console.log('Error toggling like:', e);
      Alert.alert('Error', 'Unable to update like right now.');
    } finally {
      setLikeProcessingIds((prev) => prev.filter((key) => key !== likeKey));
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
    // Fetch comments for this post
    fetchCommentsForPost(post);
  };

  // Fetch comments for a specific post
  const fetchCommentsForPost = async (post) => {
    if (!post?.id || !communityId) return;
    
    setCommentsLoading(true);
    try {
      const db = getFirestore(firebaseApp);
      const collectionName = post.type === 'blog' ? 'blogs' : 'posts';
      const commentsCol = collection(
        db,
        'communities',
        communityId,
        collectionName,
        post.id,
        'comments'
      );
      
      const firestore = await import('firebase/firestore');
      const q = firestore.query(commentsCol, firestore.orderBy('createdAt', 'desc'));
      
      const unsubscribe = firestore.onSnapshot(q, async (snapshot) => {
        const commentsPromises = snapshot.docs.map(async (docSnap) => {
          const commentData = docSnap.data();
          let userProfileImage = commentData.userImage || null;
          
          // If userImage is not in comment, fetch from users collection
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
      
      // Store unsubscribe function for cleanup
      setCommentsUnsubscribe(() => unsubscribe);
    } catch (e) {
      console.log('Error setting up comments listener:', e);
      setCommentsLoading(false);
    }
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
      const db = getFirestore(firebaseApp);
      const collectionName = selectedPostForComment.type === 'blog' ? 'blogs' : 'posts';
      const commentsCol = collection(
        db,
        'communities',
        communityId,
        collectionName,
        selectedPostForComment.id,
        'comments'
      );
      const postRef = doc(db, 'communities', communityId, collectionName, selectedPostForComment.id);
      const firestore = await import('firebase/firestore');
      
      // Use transaction to atomically add comment and update count
      await runTransaction(db, async (transaction) => {
        // First, read the current post document to get comment count
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
          throw new Error('Post not found');
        }
        
        const currentComments = typeof postSnap.data().comments === 'number' 
          ? postSnap.data().comments 
          : 0;
        
        // Add the comment document
        const commentRef = doc(commentsCol);
        transaction.set(commentRef, {
          text,
          userId: currentUser.id,
          userName: currentUser.name || 'User',
          userImage: currentUser.profileImage || null,
          createdAt: firestore.serverTimestamp(),
        });
        
        // Update comment count atomically
        transaction.update(postRef, {
          comments: currentComments + 1,
        });
      });

      // Don't update local state - let the real-time listener handle it
      // Comments will be updated automatically via the real-time listener
      setCommentText('');
      // Keep modal open to show the new comment
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
      const db = getFirestore(firebaseApp);
      const followDocRef = doc(db, 'users', currentUser.id, 'following', targetUserId);
      const isFollowing = followingUserIds.includes(targetUserId);

      if (isFollowing) {
        await deleteDoc(followDocRef);
        // Update local state
        setFollowingUserIds((prev) => prev.filter((id) => id !== targetUserId));
      } else {
        await setDoc(followDocRef, {
          userId: targetUserId,
          followedAt: new Date().toISOString(),
        });
        // Update local state
        setFollowingUserIds((prev) => [...prev, targetUserId]);
      }
      
      // Refresh user stats after follow/unfollow
      if (currentUser?.id) {
        const db = getFirestore(firebaseApp);
        const userId = currentUser.id;
        
        // Update following count
        const followingCol = collection(db, 'users', userId, 'following');
        const followingSnapshot = await getDocs(followingCol);
        setUserStats((prev) => ({
          ...prev,
          following: followingSnapshot.size,
        }));
        
        // Update followers count for current user (if someone follows/unfollows current user)
        // Also update if we're following/unfollowing someone (their followers count changes)
        const updateFollowersCount = async (userIdToCheck) => {
          if (!userIdToCheck) return;
          let followersCount = 0;
          try {
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            const checkFollowersPromises = allUsersSnapshot.docs.map(async (userDoc) => {
              if (userDoc.id === userIdToCheck) return false;
              try {
                const followDocRef = doc(db, 'users', userDoc.id, 'following', userIdToCheck);
                const followDoc = await getDoc(followDocRef);
                return followDoc.exists();
              } catch (e) {
                return false;
              }
            });
            const followersResults = await Promise.all(checkFollowersPromises);
            followersCount = followersResults.filter(Boolean).length;
            
            // Update stats if it's current user
            if (userIdToCheck === currentUser.id) {
              setUserStats((prev) => ({
                ...prev,
                followers: followersCount,
              }));
            }
          } catch (e) {
            console.log('Error updating followers count:', e);
          }
        };
        
        // Update current user's followers count
        await updateFollowersCount(currentUser.id);
      }
    } catch (e) {
      console.log('Error toggling follow:', e);
      Alert.alert('Error', 'Unable to update follow status right now.');
    } finally {
      setFollowLoadingIds((prev) => prev.filter((id) => id !== targetUserId));
    }
  };

  const renderFollowButton = (targetUserId) => {
    if (!targetUserId || targetUserId === currentUser?.id) return null;
    const isFollowing = followingUserIds.includes(targetUserId);
    const isLoading = followLoadingIds.includes(targetUserId);

    return (
      <TouchableOpacity
        style={{
          backgroundColor: '#181818',
          borderWidth: 2,
          borderColor: isFollowing ? '#8B2EF0' : '#00FF47',
          borderRadius: 20,
          paddingHorizontal: 18,
          paddingVertical: 6,
          opacity: isLoading ? 0.6 : 1,
        }}
        onPress={() => handleToggleFollow(targetUserId)}
        disabled={isLoading}
      >
        <Text
          style={{
            color: isFollowing ? '#8B2EF0' : '#00FF47',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Handlers for add options
  const handleAddOption = (option) => {
    console.log('Selected:', option.name);
    setShowAddModal(false);
    // Handle different add options
    switch (option.id) {
      case 'link':
        console.log('Opening Link creation');
        break;
      case 'live':
        console.log('Starting Live stream');
        break;
      case 'image':
        setShowImageModal(true);
        break;
      case 'chat':
        // Navigate to chat tab
        setActiveTab('chat');
        break;
      case 'blog':
        setShowBlogModal(true);
        break;
      case 'drafts':
        setShowDraftsModal(true);
        break;
      default:
        break;
    }
  };

  // Save Blog as Draft
  const handleSaveBlogDraft = async () => {
    if (blogTitle.trim() === '' && blogContent.trim() === '') {
      setShowBlogModal(false);
      setBlogTitle('');
      setBlogContent('');
      return;
    }

    try {
      const db = getFirestore(firebaseApp);
      const draftsCol = collection(db, 'communities', communityId, 'drafts');
      
      import('firebase/firestore').then(firestore => {
        firestore.addDoc(draftsCol, {
          type: 'blog',
          title: blogTitle,
          content: blogContent,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.name || 'User',
          authorImage: currentUser?.profileImage || null,
          createdAt: firestore.serverTimestamp(),
          updatedAt: firestore.serverTimestamp(),
        }).then(() => {
          setBlogTitle('');
          setBlogContent('');
          setShowBlogModal(false);
          alert('Blog saved as draft!');
        }).catch((error) => {
          console.log('Error saving draft:', error);
        });
      });
    } catch (e) {
      console.log('Error:', e);
    }
  };

  // Handle Blog Creation
  const handleCreateBlog = async () => {
    if (blogTitle.trim() === '' || blogContent.trim() === '') {
      alert('Please fill in both title and content');
      return;
    }

    setBlogLoading(true);
    try {
      const db = getFirestore(firebaseApp);
      const blogsCol = collection(db, 'communities', communityId, 'blogs');
      
      // Add blog to Firestore
      import('firebase/firestore').then(firestore => {
        firestore.addDoc(blogsCol, {
          title: blogTitle,
          content: blogContent,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.name || 'User',
          authorImage: currentUser?.profileImage || null,
          createdAt: firestore.serverTimestamp(),
          updatedAt: firestore.serverTimestamp(),
          likes: 0,
          comments: 0,
          likedBy: [],
        }).then(() => {
          // Delete draft if it was loaded from a draft
          if (selectedDraft && selectedDraft.id) {
            const draftRef = firestore.doc(db, 'communities', communityId, 'drafts', selectedDraft.id);
            firestore.deleteDoc(draftRef).catch(err => console.log('Error deleting draft:', err));
          }
          setBlogLoading(false);
          setBlogTitle('');
          setBlogContent('');
          setSelectedDraft(null);
          setShowBlogModal(false);
          alert('Blog created successfully!');
          console.log('Blog created successfully');
        }).catch((error) => {
          setBlogLoading(false);
          alert('Error creating blog: ' + error.message);
          console.log('Error creating blog:', error);
        });
      });
    } catch (e) {
      setBlogLoading(false);
      alert('Error: ' + e.message);
      console.log('Error:', e);
    }
  };

  // Save Image as Draft
  const handleSaveImageDraft = async () => {
    if (!selectedImage && imageCaption.trim() === '') {
      setShowImageModal(false);
      setImageCaption('');
      setSelectedImage(null);
      return;
    }

    try {
      const db = getFirestore(firebaseApp);
      const draftsCol = collection(db, 'communities', communityId, 'drafts');
      
      import('firebase/firestore').then(firestore => {
        firestore.addDoc(draftsCol, {
          type: 'image',
          caption: imageCaption,
          imageUri: selectedImage,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.name || 'User',
          authorImage: currentUser?.profileImage || null,
          createdAt: firestore.serverTimestamp(),
          updatedAt: firestore.serverTimestamp(),
        }).then(() => {
          setImageCaption('');
          setSelectedImage(null);
          setShowImageModal(false);
          alert('Image saved as draft!');
        }).catch((error) => {
          console.log('Error saving draft:', error);
        });
      });
    } catch (e) {
      console.log('Error:', e);
    }
  };

  // Handle Image Upload
  const handleUploadImage = async () => {
    if (!selectedImage) {
      alert('Please select an image');
      return;
    }

    setImageLoading(true);
    try {
      // For now, we'll create a post with base64 image or URL
      // In production, you'd upload to Firebase Storage first
      const db = getFirestore(firebaseApp);
      const postsCol = collection(db, 'communities', communityId, 'posts');
      
      import('firebase/firestore').then(firestore => {
        firestore.addDoc(postsCol, {
          caption: imageCaption,
          imageUri: selectedImage, // In production, upload to Storage and get download URL
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.name || 'User',
          authorImage: currentUser?.profileImage || null,
          createdAt: firestore.serverTimestamp(),
          likes: 0,
          comments: 0,
          likedBy: [],
        }).then(() => {
          // Delete draft if it was loaded from a draft
          if (selectedDraft && selectedDraft.id) {
            const draftRef = firestore.doc(db, 'communities', communityId, 'drafts', selectedDraft.id);
            firestore.deleteDoc(draftRef).catch(err => console.log('Error deleting draft:', err));
          }
          setImageLoading(false);
          setImageCaption('');
          setSelectedImage(null);
          setSelectedDraft(null);
          setShowImageModal(false);
          alert('Image posted successfully!');
          console.log('Image posted successfully');
        }).catch((error) => {
          setImageLoading(false);
          alert('Error posting image: ' + error.message);
          console.log('Error posting image:', error);
        });
      });
    } catch (e) {
      setImageLoading(false);
      alert('Error: ' + e.message);
      console.log('Error:', e);
    }
  };

  // Load Draft into Editor
  const handleLoadDraft = (draft) => {
    if (draft.type === 'blog') {
      setBlogTitle(draft.title || '');
      setBlogContent(draft.content || '');
      setShowDraftsModal(false);
      setShowBlogModal(true);
      setSelectedDraft(draft);
    } else if (draft.type === 'image') {
      setImageCaption(draft.caption || '');
      setSelectedImage(draft.imageUri || null);
      setShowDraftsModal(false);
      setShowImageModal(true);
      setSelectedDraft(draft);
    }
  };

  // Delete Draft
  const handleDeleteDraft = async (draftId) => {
    try {
      const db = getFirestore(firebaseApp);
      const draftRef = doc(db, 'communities', communityId, 'drafts', draftId);
      
      import('firebase/firestore').then(firestore => {
        firestore.deleteDoc(draftRef).then(() => {
          alert('Draft deleted successfully!');
        }).catch((error) => {
          alert('Error deleting draft: ' + error.message);
          console.log('Error deleting draft:', error);
        });
      });
    } catch (e) {
      alert('Error: ' + e.message);
      console.log('Error:', e);
    }
  };

  // Handle Image Selection
  const handleSelectImage = async () => {
    Alert.alert(
      'Select Image',
      'Choose image source',
      [
        {
          text: 'Camera',
          onPress: async () => {
            // Request camera permissions
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
              return;
            }

            // Launch camera
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              setSelectedImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            // Request media library permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery permission is required to select images.');
              return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
              allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              setSelectedImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
      ]
    );
  };

  // Render icon based on icon family
  const renderIcon = (iconFamily, iconName, color, size = 24) => {
    if (iconFamily === 'FontAwesome5') {
      return <FontAwesome5 name={iconName} size={size} color={color} />;
    } else if (iconFamily === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
    }
    return null;
  };

  // Handle Start Audio Call
  const handleStartAudioCall = async () => {
    if (!currentUser?.id || !communityId) {
      Alert.alert('Error', 'Unable to start audio call');
      return;
    }

    try {
      const db = getFirestore(firebaseApp);
      
      // Create a new audio room
      const roomId = `room_${Date.now()}_${currentUser.id}`;
      const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
      
      const now = new Date().toISOString();
      
      await setDoc(roomRef, {
        communityId: communityId,
        communityName: community?.name || groupTitle || 'Community',
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.id,
          userName: currentUser.name,
          profileImage: currentUser.profileImage,
          joinedAt: now,
          isMuted: false,
          isSpeaking: false,
        }],
        isActive: true,
      });

      // Navigate to audio call screen
      navigation.navigate('GroupAudioCall', {
        communityId: communityId,
        roomId: roomId,
        groupTitle: community?.name || groupTitle || 'Community',
      });
    } catch (e) {
      console.log('Error starting audio call:', e);
      Alert.alert('Error', 'Failed to start audio call: ' + e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{community?.name || groupTitle || 'Community'}</Text>
        <View style={{width: 24}} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff' }}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Content Area */}
          <ScrollView 
            style={{ flex: 1 }}
            onScroll={(event) => {
              const currentOffset = event.nativeEvent.contentOffset.y;
              const scrollDiff = currentOffset - scrollOffsetRef.current;
              
              // Hide button when scrolling down (scrollDiff > 0)
              // Show button when scrolling up (scrollDiff < 0)
              if (scrollDiff > 10) {
                setShowVoiceRoomButton(false);
              } else if (scrollDiff < -10) {
                setShowVoiceRoomButton(true);
              }
              
              scrollOffsetRef.current = currentOffset;
            }}
            scrollEventThrottle={16}
          >
            {/* Tab 1: Community */}
            {activeTab === 'community' && (
              <>
                {/* Group Card */}
                <View style={styles.cardContainer}>
                  <Image
                    source={community?.profileImage ? { uri: community.profileImage } : require('./assets/posticon.jpg')}
                    style={styles.groupImage}
                    resizeMode="cover"
                  />
                  <View style={styles.infoWrapperHorizontal}>
                    <Text style={styles.groupName}>{community?.name || groupTitle || 'Community'}</Text>
                    <Text style={styles.groupSubtitle}>{community?.id || communityId} | {community?.language || 'English'}</Text>

                    {/* Members (mini preview) */}
                    <View style={styles.membersWrapper}>
                      <View style={styles.membersImages}>
                        {members.length > 0 ? (
                          members.map((user, index) => (
                            <Image
                              key={user.id}
                              source={user.profileImage ? { uri: user.profileImage } : require('./assets/a1.png')}
                              style={[
                                styles.memberImage,
                                index !== 0 && { marginLeft: -10 },
                              ]}
                            />
                          ))
                        ) : (
                          <Image source={require('./assets/a1.png')} style={styles.memberImage} />
                        )}
                      </View>
                      <Text style={styles.membersText}>{community?.memberCount || members.length || 0} members</Text>
                    </View>

                    {/* Tags */}
                    <View style={styles.tagsWrapper}>
                      {[community?.category ? `#${community.category}` : '#Uncategorized'].map((tag, i) => (
                        <TouchableOpacity key={i} style={[styles.tagButton, { borderColor: '#4da6ff' }]}>
                          <Text style={[styles.tagButtonText, { color: '#4da6ff' }]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Button Bar */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{paddingHorizontal: 16, paddingVertical: 12}}>
                  <TouchableOpacity 
                    onPress={() => setCommunitySection('all')}
                    style={{backgroundColor: communitySection === 'all' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'all' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12}}>
                    <Text style={{color: '#fff', fontWeight: '600', fontSize: 14}}>Explore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setCommunitySection('posts')}
                    style={{backgroundColor: communitySection === 'posts' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'posts' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12}}>
                    <Text style={{color: '#fff', fontWeight: '600', fontSize: 14}}>Posts</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setCommunitySection('parties')}
                    style={{backgroundColor: communitySection === 'parties' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'parties' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12}}>
                    <Text style={{color: '#fff', fontWeight: '600', fontSize: 14}}>Parties</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setCommunitySection('info')}
                    style={{backgroundColor: communitySection === 'info' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'info' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12}}>
                    <Text style={{color: '#fff', fontWeight: '600', fontSize: 14}}>Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setCommunitySection('achievements')}
                    style={{backgroundColor: communitySection === 'achievements' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'achievements' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center'}}>
                    <Text style={{color: '#fff', fontWeight: '600', fontSize: 14}}>Achievements</Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* Achievements Section */}
                {(communitySection === 'all' || communitySection === 'achievements') && (
                <View style={{paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8}}>
                  <Text style={{color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12}}>Achievements</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                    {[
                      {id: '1', name: 'Regina', time: '1 hour ago', avatar: require('./assets/a1.png')},
                      {id: '2', name: 'Judith', time: '1 hour ago', avatar: require('./assets/a1.png')},
                      {id: '3', name: 'Julie', time: '1 hour ago', avatar: require('./assets/a1.png')},
                      {id: '4', name: 'Colleen', time: '1 hour ago', avatar: require('./assets/a1.png')},
                      {id: '5', name: 'Courtney', time: '1 hour ago', avatar: require('./assets/a1.png')},
                    ].map((user) => (
                      <View key={user.id} style={{alignItems: 'center', marginRight: 16}}>
                        <Image source={user.avatar} style={{width: 56, height: 56, borderRadius: 28, marginBottom: 6}} />
                        <Text style={{color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center', width: 60}}>{user.name}</Text>
                        <Text style={{color: '#888', fontSize: 10, marginTop: 2}}>{user.time}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
                )}

                {/* Live Parties Section */}
                {(communitySection === 'all' || communitySection === 'parties') && (
                <View style={{paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                    <Text style={{color: '#fff', fontSize: 16, fontWeight: '700'}}>Live Parties</Text>
                    <TouchableOpacity>
                      <Text style={{color: '#8B2EF0', fontSize: 13, fontWeight: '600'}}>View all  →</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {[
                      {id: '1', title: 'Anime&Manga', image: require('./assets/posticon.jpg')},
                      {id: '2', title: 'Role play', image: require('./assets/posticon.jpg')},
                      {id: '3', title: 'Art & Aesthetic', image: require('./assets/posticon.jpg')},
                      {id: '4', title: 'Fandom', image: require('./assets/posticon.jpg')},
                    ].map((party) => (
                      <View key={party.id} style={{marginRight: 12}}>
                        <Image source={party.image} style={{width: 140, height: 160, borderRadius: 12}} />
                        <Text style={{color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 6, maxWidth: 140}}>{party.title}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
                )}

                {/* Info Section */}
                {(communitySection === 'info') && (
                <View style={{paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20}}>
                  <View style={{backgroundColor: '#1e1e1e', borderRadius: 12, padding: 16, marginBottom: 12}}>
                    {/* Category */}
                    <View style={{marginBottom: 20}}>
                      <Text style={{color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6}}>CATEGORY</Text>
                      <Text style={{color: '#fff', fontSize: 16, fontWeight: '700'}}>{community?.category || 'N/A'}</Text>
                    </View>

                    {/* Created At */}
                    <View style={{marginBottom: 20}}>
                      <Text style={{color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6}}>CREATED AT</Text>
                      <Text style={{color: '#fff', fontSize: 16, fontWeight: '700'}}>
                        {community?.createdAt 
                          ? new Date(community.createdAt.toDate?.() || community.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'N/A'
                        }
                      </Text>
                    </View>

                    {/* Description */}
                    <View>
                      <Text style={{color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6}}>DESCRIPTION</Text>
                      <Text style={{color: '#ccc', fontSize: 14, lineHeight: 20}}>
                        {community?.description || 'No description available'}
                      </Text>
                    </View>
                  </View>
                </View>
                )}

                {/* Social Parties Section / Posts */}
                {(communitySection === 'all' || communitySection === 'posts') && (
                <View style={{paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                    <Text style={{color: '#fff', fontSize: 16, fontWeight: '700'}}>Posts</Text>
                    <TouchableOpacity>
                      <Text style={{color: '#8B2EF0', fontSize: 13, fontWeight: '600'}}>View all  →</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {allPosts.length === 0 ? (
                    <View style={{backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, alignItems: 'center'}}>
                      <Ionicons name="document-text-outline" size={40} color="#666" />
                      <Text style={{color: '#888', fontSize: 14, marginTop: 8}}>No posts yet</Text>
                    </View>
                  ) : (
                    allPosts.map((post) => {
                      const isLiked = Array.isArray(post.likedBy) && currentUser?.id
                        ? post.likedBy.includes(currentUser.id)
                        : false;
                      const likeKey = `${post.type}-${post.id}`;
                      const likeBusy = likeProcessingIds.includes(likeKey);
                      return (
                      <View key={post.id} style={{backgroundColor: '#1e1e1e', borderRadius: 12, padding: 12, marginBottom: 12}}>
                        {/* Author Info */}
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12}}>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Image 
                              source={post.authorImage ? { uri: post.authorImage } : require('./assets/a1.png')} 
                              style={{width: 44, height: 44, borderRadius: 22, marginRight: 10}} 
                            />
                            <View>
                              <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>{post.authorName || 'User'}</Text>
                              <Text style={{color: '#888', fontSize: 12}}>
                                {post.createdAt 
                                  ? new Date(post.createdAt.toDate?.() || post.createdAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
                                  : 'Recently'
                                }
                              </Text>
                            </View>
                          </View>
                          {renderFollowButton(post.authorId)}
                        </View>

                        {/* Blog Post - Show Title and Content */}
                        {post.type === 'blog' && (
                          <>
                        <Text style={{color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8}}>
                              {post.title}
                        </Text>
                        <Text style={{color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12}} numberOfLines={3}>
                              {post.content}
                        </Text>
                          </>
                        )}

                        {/* Image Post - Show Image and Caption */}
                        {post.type === 'image' && (
                          <>
                            {post.imageUri && (
                              <Image 
                                source={{ uri: post.imageUri }} 
                                style={{width: '100%', height: 250, borderRadius: 12, marginBottom: 12, resizeMode: 'cover'}} 
                              />
                            )}
                            {post.caption && (
                              <Text style={{color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12}}>
                                {post.caption}
                              </Text>
                            )}
                          </>
                        )}

                        {/* Action Buttons */}
                        <View style={{flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222'}}>
                          <TouchableOpacity
                            style={{flexDirection: 'row', alignItems: 'center', gap: 4}}
                            onPress={() => handleToggleLike(post)}
                            disabled={likeBusy}
                          >
                            <Ionicons
                              name={isLiked ? 'heart' : 'heart-outline'}
                              size={20}
                              color={isLiked ? '#ff4b6e' : '#888'}
                            />
                            <Text style={{color: isLiked ? '#ff4b6e' : '#888', fontSize: 12}}>
                              {post.likes || 0}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{flexDirection: 'row', alignItems: 'center', gap: 4}}
                            onPress={() => handleCommentPress(post)}
                          >
                            <Ionicons name="chatbubble-outline" size={20} color="#888" />
                            <Text style={{color: '#888', fontSize: 12}}>{post.comments || 0}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleSharePost(post)}>
                            <Ionicons name="share-social-outline" size={20} color="#888" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                    })
                  )}
                </View>
                )}
              </>
            )}





            {/* Tab 2: Who's Online */}
            {activeTab === 'online' && (
              <>
                {/* Header */}
                <View style={{paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                    <Text style={{color: '#FFD600', fontWeight: 'bold', fontSize: 16}}>⚡ What's Happening Now!</Text>
                    <TouchableOpacity>
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4}}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#40FC6F', marginRight: 6}} />
                      <Text style={{color: '#fff', fontWeight: '600', fontSize: 14}}>Members online ({allMembers.length})</Text>
                    </View>
                    <View style={{flex: 1}} />
                    <TouchableOpacity>
                      <Text style={{color: '#8B2EF0', fontWeight: '600', fontSize: 14}}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                    {allMembers.length === 0 ? (
                      <View style={{paddingVertical: 20, alignItems: 'center', width: Dimensions.get('window').width - 32}}>
                        <Text style={{color: '#888', fontSize: 14}}>No members found</Text>
                      </View>
                    ) : (
                      allMembers.map((member, idx) => (
                        <View key={member.id || idx} style={{alignItems: 'center', marginRight: 18}}>
                          <Image 
                            source={member.profileImage ? { uri: member.profileImage } : require('./assets/a1.png')} 
                            style={{width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#8B2EF0'}} 
                          />
                          <Text style={{color: '#fff', fontSize: 12, fontWeight: '500', marginTop: 4, maxWidth: 60}} numberOfLines={1}>
                            {member.name || 'User'}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>

                {/* Activity Cards */}
                <View style={{paddingHorizontal: 16}}>
                  {/* Card 1: Chatting */}
                  <View style={{backgroundColor: '#0D8F8F', borderRadius: 16, marginBottom: 16, padding: 16}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={{backgroundColor: '#0D8F8F', borderRadius: 8, padding: 8, marginRight: 12}}>
                          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>{activityStats.chatting} Members</Text>
                          <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>Chatting</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{color: '#cfcfcf', marginTop: 12, fontSize: 12}}>
                      Count updates whenever members start a new chat thread.
                    </Text>
                  </View>

                  {/* Card 2: Live Chatting */}
                  <View style={{backgroundColor: '#8B2EF0', borderRadius: 16, marginBottom: 16, padding: 16}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={{backgroundColor: '#8B2EF0', borderRadius: 8, padding: 8, marginRight: 12}}>
                          <Ionicons name="videocam-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>{activityStats.liveChatting} Members</Text>
                          <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>Live Chatting</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{color: '#dbd1ff', marginTop: 12, fontSize: 12}}>
                      Goes up when members start live sessions or audio rooms.
                    </Text>
                  </View>

                  {/* Card 3: Reading Posts */}
                  <View style={{backgroundColor: '#0D8F8F', borderRadius: 16, marginBottom: 16, padding: 16}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={{backgroundColor: '#0D8F8F', borderRadius: 8, padding: 8, marginRight: 12}}>
                          <Ionicons name="document-text-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>{activityStats.readingPosts} Members</Text>
                          <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>Reading Posts</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{color: '#cfcfcf', marginTop: 12, fontSize: 12}}>
                      Reflects members reading posts or community blogs right now.
                    </Text>
                  </View>

                  {/* Card 4: Browsing */}
                  <View style={{backgroundColor: '#8B2EF0', borderRadius: 16, marginBottom: 16, padding: 16}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={{backgroundColor: '#8B2EF0', borderRadius: 8, padding: 8, marginRight: 12}}>
                          <Ionicons name="eye-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>{activityStats.browsing} Members</Text>
                          <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>Browsing</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{color: '#dbd1ff', marginTop: 12, fontSize: 12}}>
                      Shows members scrolling through feeds, profiles, or stores.
                    </Text>
                  </View>
                  {/* Part 2: Categorized Member List */}
                  <View style={{marginTop: 8, backgroundColor: '#181818', borderRadius: 8, marginHorizontal: 0, marginBottom: 24}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222'}}>
                      <Ionicons name="people" size={20} color="#fff" style={{marginRight: 8}} />
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>All Members ({allMembers.length})</Text>
                    </View>
                    {/* Admins */}
                    {admins.length > 0 && (
                    <View style={{paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4}}>
                      <Text style={{color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10}}>Admins</Text>
                        {admins.map((member) => (
                        <View key={member.id} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                          <View style={{flexDirection:'row',alignItems:'center'}}>
                              <Image 
                                source={member.profileImage ? { uri: member.profileImage } : require('./assets/a1.png')} 
                                style={{width:48,height:48,borderRadius:24,marginRight:12}} 
                              />
                            <Text style={{color:'#fff',fontSize:15,fontWeight:'500'}}>{member.name}</Text>
                          </View>
                            {renderFollowButton(member.id)}
                        </View>
                      ))}
                    </View>
                    )}
                    {/* Moderators */}
                    {moderators.length > 0 && (
                    <View style={{paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4}}>
                      <Text style={{color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10}}>Moderators</Text>
                        {moderators.map((member) => (
                        <View key={member.id} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                          <View style={{flexDirection:'row',alignItems:'center'}}>
                              <Image 
                                source={member.profileImage ? { uri: member.profileImage } : require('./assets/a1.png')} 
                                style={{width:48,height:48,borderRadius:24,marginRight:12}} 
                              />
                            <Text style={{color:'#fff',fontSize:15,fontWeight:'500'}}>{member.name}</Text>
                          </View>
                            {renderFollowButton(member.id)}
                        </View>
                      ))}
                    </View>
                    )}
                    {/* Recently Joined */}
                    {recentlyJoined.length > 0 && (
                    <View style={{paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16}}>
                      <Text style={{color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10}}>Recently Joined</Text>
                        {recentlyJoined.map((member) => (
                        <View key={member.id} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                          <View style={{flexDirection:'row',alignItems:'center'}}>
                              <Image 
                                source={member.profileImage ? { uri: member.profileImage } : require('./assets/a1.png')} 
                                style={{width:48,height:48,borderRadius:24,marginRight:12}} 
                              />
                            <Text style={{color:'#fff',fontSize:15,fontWeight:'500'}}>{member.name}</Text>
                          </View>
                            {renderFollowButton(member.id)}
                        </View>
                      ))}
                    </View>
                    )}
                    {admins.length === 0 && moderators.length === 0 && recentlyJoined.length === 0 && (
                      <View style={{paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16, alignItems: 'center'}}>
                        <Text style={{color: '#888', fontSize: 14}}>No members to display</Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}

            {/* Tab 3: Add (Modal-based) */}
            {activeTab === 'add' && (
              <View style={styles.addSection}>
                <Text style={styles.sectionTitle}>Create or Share</Text>
                <View style={styles.addGrid}>
                  {addOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={styles.addOption}
                      onPress={() => handleAddOption(option)}
                    >
                      <View style={[styles.addIconContainer, { backgroundColor: option.color + '20' }]}>
                        {renderIcon(option.iconFamily, option.icon, option.color, 28)}
                      </View>
                      <Text style={styles.addOptionName}>{option.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Tab 4: Chat */}
            {activeTab === 'chat' && (
              <View style={{ flex: 1 }}>
              <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              >
                  <View style={{ flex: 1, flexDirection: 'column' }}>
                    {/* Active Audio Call Banner */}
                    {activeAudioCall && showVoiceRoomButton && (
                      <TouchableOpacity
                        style={styles.activeCallBanner}
                        onPress={() => {
                          navigation.navigate('GroupAudioCall', {
                            communityId: communityId,
                            roomId: activeAudioCall.roomId,
                            groupTitle: community?.name || groupTitle || 'Community',
                          });
                        }}
                      >
                        <LinearGradient
                          colors={['#8B2EF0', '#6A1BB8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.activeCallGradient}
                        >
                          <View style={styles.activeCallContent}>
                            <View style={styles.activeCallLeft}>
                              <View style={styles.audioWaveContainer}>
                                <MaterialCommunityIcons name="phone-in-talk" size={20} color="#fff" />
                                <View style={styles.audioWaveAnimation}>
                                  <View style={[styles.audioWave, { animationDelay: '0s' }]} />
                                  <View style={[styles.audioWave, { animationDelay: '0.2s' }]} />
                                  <View style={[styles.audioWave, { animationDelay: '0.4s' }]} />
                                </View>
                              </View>
                              <View style={styles.activeCallText}>
                                <Text style={styles.activeCallTitle}>Audio Call in Progress</Text>
                                <View style={styles.participantsRow}>
                                  {audioCallParticipants.slice(0, 3).map((participant, index) => (
                                    <Image
                                      key={`participant-${participant.userId}-${index}`}
                                      source={{ uri: participant.profileImage || 'https://via.placeholder.com/40' }}
                                      style={[
                                        styles.participantAvatar,
                                        index > 0 && { marginLeft: -8 }
                                      ]}
                                    />
                                  ))}
                                  <Text style={styles.participantsCount}>
                                    {audioCallParticipants.length > 3
                                      ? `+${audioCallParticipants.length - 3} more`
                                      : audioCallParticipants.map(p => p.userName).join(', ')}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.activeCallRight}>
                              <Text style={styles.joinButton}>JOIN</Text>
                              <Ionicons name="chevron-forward" size={20} color="#fff" />
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    
                    {/* Messages ScrollView */}
                  <ScrollView 
                    ref={chatScrollRef}
                    style={{ flex: 1 }}
                      contentContainerStyle={styles.chatScrollContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      contentInsetAdjustmentBehavior="automatic"
                  >
                    {chatLoading ? (
                        <View style={styles.chatLoadingContainer}>
                          <ActivityIndicator size="small" color="#8B2EF0" />
                      <Text style={styles.noMessagesText}>Loading chat...</Text>
                        </View>
                    ) : chatMessages.length === 0 ? (
                        <View style={styles.chatEmptyContainer}>
                          <Ionicons name="chatbubbles-outline" size={60} color="#444" />
                          <Text style={styles.noMessagesText}>No messages yet</Text>
                          <Text style={styles.emptySubtext}>Start the conversation!</Text>
                        </View>
                      ) : (
                        chatMessages.map((msg) => {
                          // Check if message is from current logged-in user
                          const isCurrentUser = currentUser && (msg.senderId === currentUser.id || msg.senderId === currentUser?.id);
                          
                          return (
                        <View
                          key={msg.id}
                              style={[
                                styles.chatMessageContainer,
                                isCurrentUser ? styles.chatMessageContainerRight : styles.chatMessageContainerLeft
                              ]}
                        >
                              {!isCurrentUser && (
                          <Image
                            source={msg.profileImage ? { uri: msg.profileImage } : require('./assets/a1.png')}
                            style={styles.profilePic}
                          />
                              )}
                              <View 
                                style={[
                                  styles.chatMessageBox, 
                                  isCurrentUser 
                                    ? styles.chatMessageBoxOwn 
                                    : styles.chatMessageBoxOther
                                ]}
                              >
                                {!isCurrentUser && (
                            <Text style={styles.chatMessageTitle}>{msg.sender || 'User'}</Text>
                                )}
                                
                                {/* Image Message */}
                                {msg.imageUrl && (
                                  <TouchableOpacity 
                                    onPress={() => setSelectedImageModal(msg.imageUrl)}
                                    activeOpacity={0.9}
                                  >
                                    <Image 
                                      source={{ uri: msg.imageUrl }} 
                                      style={styles.chatMessageImage}
                                      resizeMode="cover"
                                    />
                                  </TouchableOpacity>
                                )}

                                {/* Video Message */}
                                {msg.videoUrl && (
                                  <View style={styles.chatVideoContainer}>
                                    <Video
                                      ref={(ref) => {
                                        if (ref) {
                                          setVideoRefs(prev => ({ ...prev, [msg.id]: ref }));
                                        }
                                      }}
                                      source={{ uri: msg.videoUrl }}
                                      style={styles.chatMessageVideo}
                                      useNativeControls
                                      resizeMode="contain"
                                      onPlaybackStatusUpdate={(status) => {
                                        if (status.isPlaying) {
                                          setPlayingVideoId(msg.id);
                                        } else if (status.didJustFinish || !status.isPlaying) {
                                          if (playingVideoId === msg.id) {
                                            setPlayingVideoId(null);
                                          }
                                        }
                                      }}
                                    />
                                  </View>
                                )}

                                {/* Voice Room Message */}
                                {(msg.type === 'voiceChat' || isVoiceRoomType(msg.type)) && (
                                  <TouchableOpacity
                                    style={styles.voiceChatMessageContainer}
                                    onPress={() => handleJoinVoiceChat(msg.id, msg.participants || [])}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.voiceChatHeader}>
                                      <Ionicons name="mic" size={24} color="#40FF00" />
                                      <Text style={styles.voiceChatTitle}>Voice Room</Text>
                                    </View>
                                    <Text style={styles.voiceChatText}>
                                      {msg.sender || 'User'} started a live voice room
                                    </Text>
                                    <Text style={styles.voiceChatParticipants}>
                                      {msg.participants?.length || 1} participant{msg.participants?.length !== 1 ? 's' : ''}
                                    </Text>
                                    {!isCurrentUser && !msg.participants?.includes(currentUser?.id) && (
                                      <View style={styles.joinVoiceChatButton}>
                                        <Ionicons name="mic" size={18} color="#fff" />
                                        <Text style={styles.joinVoiceChatText}>Join Voice Chat</Text>
                                      </View>
                                    )}
                                    {msg.participants?.includes(currentUser?.id) && (
                                      <View style={styles.joinedVoiceChatBadge}>
                                        <Ionicons name="checkmark-circle" size={18} color="#40FF00" />
                                        <Text style={styles.joinedVoiceChatText}>You're in this chat - Tap to open</Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                )}

                                {/* Voice Message */}
                                {msg.voiceUrl && msg.type !== 'voiceChat' && !isVoiceRoomType(msg.type) && (
                                  <View style={styles.chatVoiceContainer}>
                                    <TouchableOpacity 
                                      style={[
                                        styles.chatVoiceButton,
                                        playingVoiceId === msg.id && styles.chatVoiceButtonPlaying
                                      ]}
                                      onPress={async () => {
                                        try {
                                          // If this voice is already playing, pause it
                                          if (playingVoiceId === msg.id && voiceSound) {
                                            await voiceSound.pauseAsync();
                                            setPlayingVoiceId(null);
                                            setVoiceSound(null);
                                            return;
                                          }
                                          
                                          // Stop any currently playing voice
                                          if (voiceSound) {
                                            await voiceSound.stopAsync();
                                            await voiceSound.unloadAsync();
                                          }
                                          
                                          // Create and play new sound
                                          const { sound } = await Audio.Sound.createAsync(
                                            { uri: msg.voiceUrl },
                                            { shouldPlay: true }
                                          );
                                          
                                          setVoiceSound(sound);
                                          setPlayingVoiceId(msg.id);
                                          
                                          // Listen for playback status
                                          sound.setOnPlaybackStatusUpdate((status) => {
                                            if (status.didJustFinish) {
                                              setPlayingVoiceId(null);
                                              setVoiceSound(null);
                                              sound.unloadAsync();
                                            }
                                          });
                                          
                                          await sound.playAsync();
                                        } catch (error) {
                                          console.error('Error playing voice:', error);
                                          Alert.alert('Error', 'Failed to play voice message');
                                          setPlayingVoiceId(null);
                                          setVoiceSound(null);
                                        }
                                      }}
                                    >
                                      <Ionicons 
                                        name={playingVoiceId === msg.id ? "pause" : "play"} 
                                        size={20} 
                                        color="#fff" 
                                      />
                                      <Text style={styles.chatVoiceText}>
                                        {msg.duration ? `${Math.floor(msg.duration)}s` : 'Voice message'}
                                      </Text>
                                    </TouchableOpacity>
                          </View>
                                )}

                                {/* Text Message */}
                                {msg.text && msg.type !== 'voiceChat' && !isVoiceRoomType(msg.type) && (
                                  <Text style={[
                                    styles.chatMessageText,
                                    isCurrentUser && styles.chatMessageTextOwn
                                  ]}>
                                    {msg.text}
                                  </Text>
                                )}

                                {msg.createdAt && (
                                  <Text style={[
                                    styles.chatMessageTime,
                                    isCurrentUser && styles.chatMessageTimeOwn
                                  ]}>
                                    {new Date(msg.createdAt.toDate?.() || msg.createdAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Text>
                                )}
                        </View>
                              {isCurrentUser && (
                                <Image
                                  source={currentUser?.profileImage ? { uri: currentUser.profileImage } : require('./assets/a1.png')}
                                  style={styles.profilePic}
                                />
                              )}
                            </View>
                          );
                        })
                    )}
                  </ScrollView>

                    {/* Chat Input - Always visible at bottom */}
                  <View style={styles.chatInputContainer}>
                      {/* Selected Image Preview */}
                      {selectedChatImage && (
                        <View style={styles.chatImagePreview}>
                          <Image source={{ uri: selectedChatImage }} style={styles.chatPreviewImage} />
                          <TouchableOpacity 
                            style={styles.chatRemoveImage}
                            onPress={() => setSelectedChatImage(null)}
                          >
                            <Ionicons name="close-circle" size={24} color="#ff4444" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Selected Video Preview */}
                      {selectedChatVideo && (
                        <View style={styles.chatImagePreview}>
                          <Video
                            source={{ uri: selectedChatVideo }}
                            style={styles.chatPreviewImage}
                            useNativeControls
                            resizeMode="contain"
                          />
                          <TouchableOpacity 
                            style={styles.chatRemoveImage}
                            onPress={() => setSelectedChatVideo(null)}
                          >
                            <Ionicons name="close-circle" size={24} color="#ff4444" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Voice Recording Indicator */}
                      {isRecording && (
                        <View style={styles.recordingIndicator}>
                          <View style={styles.recordingDot} />
                          <Text style={styles.recordingText}>Recording... Tap stop to finish</Text>
                          <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecordingButton}>
                            <Text style={styles.cancelRecordingText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Voice Recording Ready Indicator */}
                      {recordingUri && !isRecording && (
                        <View style={styles.recordingReadyIndicator}>
                          <Ionicons name="mic" size={20} color="#8B2EF0" />
                          <Text style={styles.recordingReadyText}>Voice message ready</Text>
                          <TouchableOpacity 
                            onPress={() => {
                              setRecordingUri(null);
                            }} 
                            style={styles.removeRecordingButton}
                          >
                            <Ionicons name="close-circle" size={20} color="#ff4444" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Message Input Field */}
                      <View style={styles.messageInputContainer}>
                        <TextInput
                          ref={inputRef}
                          placeholder="Message"
                          placeholderTextColor="#999"
                          style={styles.messageInputField}
                          value={chatInput}
                          onChangeText={setChatInput}
                          onFocus={() => {
                            setShowEmojiPicker(false);
                            setShowGiftOptions(false);
                          }}
                          multiline
                          maxLength={500}
                          returnKeyType="send"
                          onSubmitEditing={handleSendMessage}
                          blurOnSubmit={false}
                          textAlignVertical="top"
                        />
                        <TouchableOpacity 
                          onPress={handleSendMessage} 
                          style={[
                            styles.sendButton,
                            (chatInput.trim() === '' && !selectedChatImage && !selectedChatVideo && !recordingUri && !isRecording) && styles.sendButtonDisabled
                          ]} 
                          disabled={chatLoading || isRecording || (chatInput.trim() === '' && !selectedChatImage && !selectedChatVideo && !recordingUri)}
                        >
                          {chatLoading ? (
                            <ActivityIndicator size="small" color="#8B2EF0" />
                          ) : (
                            <Ionicons 
                              name="send" 
                              size={20} 
                              color={(chatInput.trim() === '' && !selectedChatImage && !selectedChatVideo && !recordingUri && !isRecording) ? '#444' : '#fff'} 
                            />
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Action Icons Row */}
                      <View style={styles.chatActionIconsRow}>
                        {/* Voice/Audio Icon */}
                        {!isRecording ? (
                          <TouchableOpacity 
                            onPress={startRecording}
                            style={styles.chatActionIcon}
                          >
                            <Ionicons name="mic-outline" size={24} color="#ccc" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            onPress={stopRecording}
                            style={styles.chatActionIcon}
                          >
                            <Ionicons name="stop" size={24} color="#ff4444" />
                          </TouchableOpacity>
                        )}

                        {/* Image/Gallery Icon */}
                        <TouchableOpacity 
                          onPress={handlePickChatImage}
                          style={styles.chatActionIcon}
                        >
                          <Ionicons name="image-outline" size={24} color="#ccc" />
                        </TouchableOpacity>

                        {/* Emoji Icon */}
                        <TouchableOpacity 
                          onPress={() => {
                            Keyboard.dismiss();
                            setShowEmojiPicker(true);
                            setShowGiftOptions(false);
                          }}
                          style={styles.chatActionIcon}
                        >
                          <Ionicons name="happy-outline" size={24} color={showEmojiPicker ? "#8B2EF0" : "#ccc"} />
                        </TouchableOpacity>

                        {/* Party Popper/Confetti Icon */}
                        <TouchableOpacity 
                          onPress={() => {
                            Keyboard.dismiss();
                            setShowGiftOptions(true);
                            setShowEmojiPicker(false);
                          }}
                          style={styles.chatActionIcon}
                        >
                          <Ionicons name="gift-outline" size={24} color={showGiftOptions ? "#8B2EF0" : "#ccc"} />
                        </TouchableOpacity>

                      
                      </View>

                      {/* Emoji Picker - Shows instead of keyboard */}
                      {showEmojiPicker && (
                        <View style={styles.emojiPickerContainer}>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            style={styles.emojiPickerScroll}
                            contentContainerStyle={styles.emojiPickerContent}
                          >
                            {['😀', '😂', '🥰', '😍', '🤔', '😎', '🥳', '😭', '😡', '🤯', '👍', '👎', '❤️', '🔥', '💯', '✨', '🎉', '🎊', '🎈', '🎁', '🎂', '🍕', '🍔', '🍟', '🍰', '☕', '🚀', '⭐', '🌟', '💫'].map((emoji, index) => (
                              <TouchableOpacity
                                key={index}
                                style={styles.emojiItem}
                                onPress={() => {
                                  setChatInput(prev => prev + emoji);
                                  setShowEmojiPicker(false);
                                  if (inputRef.current) {
                                    inputRef.current.focus();
                                  }
                                }}
                              >
                                <Text style={styles.emojiText}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {/* Gift Options Modal - Shows instead of keyboard */}
                      {showGiftOptions && (
                        <View style={styles.giftOptionsContainer}>
                          <TouchableOpacity
                            style={styles.giftOption}
                            onPress={() => {
                              setSelectedGiftOption('voiceChat');
                              handleVoiceChatClick();
                            }}
                          >
                            <View style={[
                              styles.giftOptionIconContainer, 
                              { backgroundColor: 'rgba(64, 255, 0, 0.2)' },
                              selectedGiftOption === 'voiceChat' && styles.giftOptionSelected
                            ]}>
                              <Ionicons name="mic" size={32} color="#40FF00" />
                            </View>
                            <Text style={[
                              styles.giftOptionText,
                              selectedGiftOption === 'voiceChat' && styles.giftOptionTextSelected
                            ]}>Voice Room</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.giftOption}
                            onPress={() => {
                              setSelectedGiftOption('roleplay');
                              // Roleplay functionality
                              Alert.alert('Roleplay', 'Roleplay feature coming soon');
                            }}
                          >
                            <View style={[
                              styles.giftOptionIconContainer, 
                              { backgroundColor: 'rgba(255, 0, 255, 0.2)' },
                              selectedGiftOption === 'roleplay' && styles.giftOptionSelected
                            ]}>
                              <Ionicons name="person-circle" size={32} color="#FF00FF" />
                            </View>
                            <Text style={[
                              styles.giftOptionText,
                              selectedGiftOption === 'roleplay' && styles.giftOptionTextSelected
                            ]}>Roleplay</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.giftOption}
                            onPress={() => {
                              setSelectedGiftOption('screeningRoom');
                              // Screening Room functionality
                              Alert.alert('Screening Room', 'Screening Room feature coming soon');
                            }}
                          >
                            <View style={[
                              styles.giftOptionIconContainer, 
                              { backgroundColor: 'rgba(148, 0, 211, 0.2)' },
                              selectedGiftOption === 'screeningRoom' && styles.giftOptionSelected
                            ]}>
                              <Ionicons name="tv" size={32} color="#9400D3" />
                            </View>
                            <Text style={[
                              styles.giftOptionText,
                              selectedGiftOption === 'screeningRoom' && styles.giftOptionTextSelected
                            ]}>Screening Room</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                  </View>
                </View>
              </KeyboardAvoidingView>
              </View>
            )}

            {/* Tab 5: Account */}
            {activeTab === 'account' && (
              <View style={styles.accountSection}>
                <View style={styles.accountCard}>
                  <View style={styles.accountAvatarContainer}>
                    <Image 
                      source={currentUser?.profileImage ? { uri: currentUser.profileImage } : require('./assets/a1.png')} 
                      style={styles.accountAvatar} 
                    />
                    <View style={styles.accountBadge}>
                      <Ionicons name="checkmark-circle" size={24} color="#00FF47" />
                    </View>
                  </View>
                  
                  <Text style={styles.accountName}>{currentUser?.name || 'User'}</Text>
                  
                  <View style={styles.accountEmailContainer}>
                    <Ionicons name="mail-outline" size={16} color="#8B2EF0" />
                    <Text style={styles.accountEmail}>{currentUser?.email || 'user@example.com'}</Text>
                  </View>

                  {/* Stats Grid */}
                  <View style={styles.accountStatsGrid}>
                    <View style={styles.accountStatItem}>
                      <Text style={styles.accountStatValue}>{userStats.following}</Text>
                      <Text style={styles.accountStatLabel}>Following</Text>
                    </View>
                    <View style={styles.accountStatItem}>
                      <Text style={styles.accountStatValue}>{userStats.followers}</Text>
                      <Text style={styles.accountStatLabel}>Followers</Text>
                    </View>
                    <View style={styles.accountStatItem}>
                      <Text style={styles.accountStatValue}>{userStats.totalLikes}</Text>
                      <Text style={styles.accountStatLabel}>Likes</Text>
                    </View>
                  </View>

                  {/* Content Stats */}
                  <View style={styles.accountContentStats}>
                    <View style={styles.accountContentStatItem}>
                      <Ionicons name="document-text" size={20} color="#40DFFC" />
                      <View style={styles.accountContentStatText}>
                        <Text style={styles.accountContentStatValue}>{userStats.totalBlogs}</Text>
                        <Text style={styles.accountContentStatLabel}>Blogs</Text>
                      </View>
                    </View>
                    <View style={styles.accountContentStatItem}>
                      <Ionicons name="image" size={20} color="#FF4A4A" />
                      <View style={styles.accountContentStatText}>
                        <Text style={styles.accountContentStatValue}>{userStats.totalPosts}</Text>
                        <Text style={styles.accountContentStatLabel}>Posts</Text>
                      </View>
                    </View>
                  </View>

                  {/* Ranking/Leaderboard */}
                  <View style={styles.accountRankingContainer}>
                    <View style={styles.accountRankingHeader}>
                      <Ionicons name="trophy" size={24} color="#FFD700" />
                      <Text style={styles.accountRankingTitle}>Your Ranking</Text>
                    </View>
                    <View style={styles.accountRankingBadge}>
                      <Text style={styles.accountRankingNumber}>#{userStats.ranking || 'N/A'}</Text>
                      <Text style={styles.accountRankingSubtext}>Based on total likes</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Tab Bar at Bottom */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'community' && styles.tabItemActive]}
              onPress={() => setActiveTab('community')}
            >
              <Ionicons name="home" size={24} color={activeTab === 'community' ? '#8B2EF0' : '#666'} />
              <Text style={[styles.tabLabel, { color: activeTab === 'community' ? '#8B2EF0' : '#666' }]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'online' && styles.tabItemActive]}
              onPress={() => setActiveTab('online')}
            >
              <Ionicons name="people" size={24} color={activeTab === 'online' ? '#8B2EF0' : '#666'} />
              <Text style={[styles.tabLabel, { color: activeTab === 'online' ? '#8B2EF0' : '#666' }]}>Online</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, styles.tabItemCenter]}
              onPress={() => setActiveTab('add')}
            >
              <View style={styles.addIconBg}>
                <AntDesign name="plus" size={28} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'chat' && styles.tabItemActive]}
              onPress={() => setActiveTab('chat')}
            >
              <Ionicons name="chatbubbles" size={24} color={activeTab === 'chat' ? '#8B2EF0' : '#666'} />
              <Text style={[styles.tabLabel, { color: activeTab === 'chat' ? '#8B2EF0' : '#666' }]}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'account' && styles.tabItemActive]}
              onPress={() => setActiveTab('account')}
            >
              <Ionicons name="person" size={24} color={activeTab === 'account' ? '#8B2EF0' : '#666'} />
              <Text style={[styles.tabLabel, { color: activeTab === 'account' ? '#8B2EF0' : '#666' }]}>Account</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Image Upload Modal */}
      <Modal
        visible={showImageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          {/* Header */}
          <View style={styles.imageModalHeader}>
            <TouchableOpacity onPress={() => {
              // Save as draft if there's content
              if (selectedImage || imageCaption.trim() !== '') {
                handleSaveImageDraft();
              } else {
                setShowImageModal(false);
              }
            }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.imageModalTitle}>Upload Image</Text>
            <TouchableOpacity 
              onPress={handleUploadImage}
              disabled={imageLoading}
              style={{opacity: imageLoading ? 0.6 : 1}}
            >
              <Text style={[styles.imageModalPublish, {color: imageLoading ? '#aaa' : '#8B2EF0'}]}>
                {imageLoading ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Modal Content */}
          <ScrollView style={styles.imageModalContent}>
            {/* Image Selection */}
            <View style={styles.imageFormGroup}>
              <Text style={styles.imageFormLabel}>Select Image</Text>
              <TouchableOpacity 
                style={styles.imagePickerBox}
                onPress={handleSelectImage}
              >
                {selectedImage ? (
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.selectedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={40} color="#666" />
                    <Text style={styles.imagePickerText}>Tap to select image</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Caption Input */}
            <View style={styles.imageFormGroup}>
              <Text style={styles.imageFormLabel}>Caption</Text>
              <TextInput
                placeholder="Write a caption for your image..."
                placeholderTextColor="#666"
                style={styles.imageCaptionInput}
                value={imageCaption}
                onChangeText={setImageCaption}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{imageCaption.length}/500</Text>
            </View>

            {/* Author Info */}
            <View style={styles.imageAuthorInfo}>
              <Image
                source={currentUser?.profileImage ? { uri: currentUser.profileImage } : require('./assets/a1.png')}
                style={styles.imageAuthorAvatar}
              />
              <View style={{flex: 1}}>
                <Text style={styles.imageAuthorName}>{currentUser?.name || 'User'}</Text>
                <Text style={styles.imageAuthorEmail}>{currentUser?.email || 'user@example.com'}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Blog Creation Modal */}
      <Modal
        visible={showBlogModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBlogModal(false)}
      >
        <View style={styles.blogModalContainer}>
          {/* Header */}
          <View style={styles.blogModalHeader}>
            <TouchableOpacity onPress={() => {
              // Save as draft if there's content
              if (blogTitle.trim() !== '' || blogContent.trim() !== '') {
                handleSaveBlogDraft();
              } else {
                setShowBlogModal(false);
              }
            }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.blogModalTitle}>Create Blog</Text>
            <TouchableOpacity 
              onPress={handleCreateBlog}
              disabled={blogLoading}
              style={{opacity: blogLoading ? 0.6 : 1}}
            >
              <Text style={[styles.blogModalPublish, {color: blogLoading ? '#aaa' : '#8B2EF0'}]}>
                {blogLoading ? 'Publishing...' : 'Publish'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Blog Form */}
          <ScrollView style={styles.blogModalContent}>
            {/* Title Input */}
            <View style={styles.blogFormGroup}>
              <Text style={styles.blogFormLabel}>Blog Title</Text>
              <TextInput
                placeholder="Enter blog title..."
                placeholderTextColor="#666"
                style={styles.blogTitleInput}
                value={blogTitle}
                onChangeText={setBlogTitle}
                maxLength={100}
              />
              <Text style={styles.charCount}>{blogTitle.length}/100</Text>
            </View>

            {/* Content Input */}
            <View style={styles.blogFormGroup}>
              <Text style={styles.blogFormLabel}>Blog Content</Text>
              <TextInput
                placeholder="Write your blog content here..."
                placeholderTextColor="#666"
                style={styles.blogContentInput}
                value={blogContent}
                onChangeText={setBlogContent}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={styles.charCount}>{blogContent.length}/2000</Text>
            </View>

            {/* Author Info */}
            <View style={styles.blogAuthorInfo}>
              <Image
                source={currentUser?.profileImage ? { uri: currentUser.profileImage } : require('./assets/a1.png')}
                style={styles.blogAuthorAvatar}
              />
              <View style={{flex: 1}}>
                <Text style={styles.blogAuthorName}>{currentUser?.name || 'User'}</Text>
                <Text style={styles.blogAuthorEmail}>{currentUser?.email || 'user@example.com'}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!commentSaving) {
            // Cleanup comments listener
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
        <View style={styles.commentModalContainer}>
          <View style={styles.commentModalContent}>
            <View style={styles.commentModalHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (!commentSaving) {
                    // Cleanup comments listener
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
                        commentSaving || commentText.trim().length === 0 ? '#666' : '#8B2EF0',
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
                  <ActivityIndicator size="small" color="#8B2EF0" />
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
      </Modal>

      {/* Drafts Modal */}
      <Modal
        visible={showDraftsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDraftsModal(false)}
      >
        <View style={styles.draftsModalContainer}>
          {/* Header */}
          <View style={styles.draftsModalHeader}>
            <TouchableOpacity onPress={() => setShowDraftsModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.draftsModalTitle}>Drafts</Text>
            <View style={{width: 28}} />
          </View>

          {/* Drafts List */}
          <ScrollView style={styles.draftsModalContent}>
            {drafts.length === 0 ? (
              <View style={styles.draftsEmptyContainer}>
                <Ionicons name="document-text-outline" size={60} color="#444" />
                <Text style={styles.draftsEmptyText}>No drafts yet</Text>
                <Text style={styles.draftsEmptySubtext}>Your incomplete posts will appear here</Text>
              </View>
            ) : (
              drafts.map((draft) => (
                <View key={draft.id} style={styles.draftItem}>
                  <TouchableOpacity 
                    style={styles.draftContent}
                    onPress={() => handleLoadDraft(draft)}
                  >
                    {draft.type === 'image' && draft.imageUri && (
                      <Image 
                        source={{ uri: draft.imageUri }} 
                        style={styles.draftImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.draftInfo}>
                      <View style={styles.draftHeader}>
                        <Ionicons 
                          name={draft.type === 'blog' ? 'document-text' : 'image'} 
                          size={20} 
                          color={draft.type === 'blog' ? '#40DFFC' : '#FF4A4A'} 
                        />
                        <Text style={styles.draftType}>
                          {draft.type === 'blog' ? 'Blog' : 'Image Post'}
                        </Text>
                        <Text style={styles.draftDate}>
                          {draft.updatedAt 
                            ? new Date(draft.updatedAt.toDate?.() || draft.updatedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Recently'
                          }
                        </Text>
                      </View>
                      {draft.type === 'blog' ? (
                        <>
                          <Text style={styles.draftTitle} numberOfLines={1}>
                            {draft.title || 'Untitled Blog'}
                          </Text>
                          <Text style={styles.draftPreview} numberOfLines={2}>
                            {draft.content || 'No content'}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.draftPreview} numberOfLines={2}>
                          {draft.caption || 'No caption'}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.draftDeleteButton}
                    onPress={() => {
                      Alert.alert(
                        'Delete Draft',
                        'Are you sure you want to delete this draft?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: () => handleDeleteDraft(draft.id)
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Voice Chat Interface Modal */}
      <Modal
        visible={showVoiceChatInterface}
        animationType="slide"
        onRequestClose={() => {
          setShowVoiceChatInterface(false);
          setCurrentVoiceChatSession(null);
          setVoiceChatParticipants([]);
        }}
      >
        <View style={styles.voiceChatInterfaceContainer}>
          {/* Header */}
          <View style={styles.voiceChatHeader}>
            <View style={styles.voiceChatHeaderLeft}>
              <Ionicons name="musical-notes" size={24} color="#8B2EF0" />
              <Text style={styles.voiceChatHeaderTitle}>Voice Room</Text>
            </View>
            <View style={styles.voiceChatHeaderRight}>
              <TouchableOpacity style={styles.voiceChatHeaderIcon}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.voiceChatHeaderIcon}
                onPress={() => {
                  setShowVoiceChatInterface(false);
                  setCurrentVoiceChatSession(null);
                  setVoiceChatParticipants([]);
                  setSpeakingUsers([]);
                  setIsMicOn(false);
                }}
              >
                <Ionicons name="power" size={24} color="#ff4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Participants Display - Triangular Layout */}
          <View style={styles.voiceChatParticipantsContainer}>
            {voiceChatParticipants.length > 0 ? (
              voiceChatParticipants.slice(0, 3).map((participant, index) => (
                <View
                  key={participant.id}
                  style={[
                    styles.voiceChatParticipantAvatar,
                    index === 0 && styles.voiceChatParticipantTop,
                    index === 1 && styles.voiceChatParticipantBottomLeft,
                    index === 2 && styles.voiceChatParticipantBottomRight,
                    currentVoiceChatSession?.adminId === participant.id && styles.voiceChatParticipantAdmin,
                  ]}
                >
                  <Image
                    source={participant.profileImage ? { uri: participant.profileImage } : require('./assets/a1.png')}
                    style={[
                      styles.voiceChatParticipantImage,
                      speakingUsers.some(s => s.userId === participant.id) && styles.voiceChatParticipantSpeaking
                    ]}
                  />
                  {speakingUsers.some(s => s.userId === participant.id) && (
                    <View style={styles.speakingIndicator}>
                      <View style={styles.speakingPulse} />
                    </View>
                  )}
                  {currentVoiceChatSession?.adminId === participant.id && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  <Text style={styles.voiceChatParticipantName} numberOfLines={1}>
                    {participant.name}
                    {speakingUsers.some(s => s.userId === participant.id) && ' 🔊'}
                  </Text>
                </View>
              ))
            ) : (
              currentVoiceChatSession && (
                <View style={styles.voiceChatParticipantAvatar}>
                  <Image
                    source={currentUser?.profileImage ? { uri: currentUser.profileImage } : require('./assets/a1.png')}
                    style={styles.voiceChatParticipantImage}
                  />
                  {currentVoiceChatSession?.adminId === currentUser?.id && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  <Text style={styles.voiceChatParticipantName} numberOfLines={1}>
                    {currentUser?.name || 'You'}
                  </Text>
                </View>
              )
            )}
          </View>

          {/* Real-time Mic Toggle Button */}
          <View style={styles.voiceChatMicToggleContainer}>
            <TouchableOpacity
              style={[
                styles.voiceChatMicToggleButton,
                isMicOn && styles.voiceChatMicToggleButtonOn
              ]}
              onPress={toggleRealTimeMic}
            >
              <Ionicons 
                name={isMicOn ? "mic" : "mic-off"} 
                size={32} 
                color={isMicOn ? "#fff" : "#ff4444"} 
              />
            </TouchableOpacity>
            <Text style={styles.voiceChatMicToggleText}>
              {isMicOn ? 'Live Audio On - Speaking' : 'Tap to Enable Live Audio'}
            </Text>
            {isMicOn && (
              <View style={styles.voiceChatMicLiveIndicator}>
                <View style={styles.voiceChatMicLiveDot} />
                <Text style={styles.voiceChatMicLiveText}>Live Audio Streaming</Text>
              </View>
            )}
          </View>

          {/* Chat Messages Area */}
          <ScrollView 
            ref={voiceChatScrollRef}
            style={styles.voiceChatMessagesArea} 
            contentContainerStyle={styles.voiceChatMessagesContent}
          >
            {voiceChatMessages.length === 0 ? (
              <View style={styles.voiceChatEmptyMessages}>
                <Text style={styles.voiceChatEmptyText}>Live audio communication enabled - speak and other members will hear you!</Text>
              </View>
            ) : (
              voiceChatMessages.map((msg) => {
                const isCurrentUser = currentUser && (msg.senderId === currentUser.id || msg.senderId === currentUser?.id);
                
                return (
                  <View 
                    key={msg.id} 
                    style={[
                      styles.voiceChatMessageContainer,
                      isCurrentUser ? styles.voiceChatMessageContainerOwn : styles.voiceChatMessageContainerOther
                    ]}
                  >
                    {!isCurrentUser && (
                      <Image
                        source={msg.profileImage ? { uri: msg.profileImage } : require('./assets/a1.png')}
                        style={styles.voiceChatMessageAvatar}
                      />
                    )}
                    <View style={[
                      styles.voiceChatMessageBox,
                      isCurrentUser ? styles.voiceChatMessageBoxOwn : styles.voiceChatMessageBoxOther
                    ]}>
                      {!isCurrentUser && (
                        <Text style={styles.voiceChatMessageSender}>{msg.sender || 'User'}</Text>
                      )}
                      
                      {/* Voice Message */}
                      {msg.voiceUrl && (
                        <TouchableOpacity 
                          style={[
                            styles.voiceChatVoiceButton,
                            playingVoiceChatId === msg.id && styles.voiceChatVoiceButtonPlaying
                          ]}
                          onPress={async () => {
                            try {
                              // If this voice is already playing, pause it
                              if (playingVoiceChatId === msg.id && voiceChatSound) {
                                await voiceChatSound.pauseAsync();
                                setPlayingVoiceChatId(null);
                                setVoiceChatSound(null);
                                return;
                              }
                              
                              // Stop any currently playing voice
                              if (voiceChatSound) {
                                await voiceChatSound.stopAsync();
                                await voiceChatSound.unloadAsync();
                              }
                              
                              // Create and play new sound
                              const { sound } = await Audio.Sound.createAsync(
                                { uri: msg.voiceUrl },
                                { shouldPlay: true }
                              );
                              
                              setVoiceChatSound(sound);
                              setPlayingVoiceChatId(msg.id);
                              
                              // Listen for playback status
                              sound.setOnPlaybackStatusUpdate((status) => {
                                if (status.didJustFinish) {
                                  setPlayingVoiceChatId(null);
                                  setVoiceChatSound(null);
                                  sound.unloadAsync();
                                }
                              });
                              
                              await sound.playAsync();
                            } catch (error) {
                              console.error('Error playing voice:', error);
                              Alert.alert('Error', 'Failed to play voice message');
                              setPlayingVoiceChatId(null);
                              setVoiceChatSound(null);
                            }
                          }}
                        >
                          <Ionicons 
                            name={playingVoiceChatId === msg.id ? "pause" : "play"} 
                            size={20} 
                            color="#fff" 
                          />
                          <Text style={styles.voiceChatVoiceText}>
                            {msg.duration ? `${Math.floor(msg.duration)}s` : 'Voice message'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      {/* Text Message */}
                      {msg.text && (
                        <Text style={styles.voiceChatMessageText}>
                          {msg.text}
                        </Text>
                      )}
                      
                      {msg.createdAt && (
                        <Text style={styles.voiceChatMessageTime}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                    </View>
                    {isCurrentUser && (
                      <Image
                        source={currentUser?.profileImage ? { uri: currentUser.profileImage } : require('./assets/a1.png')}
                        style={styles.voiceChatMessageAvatar}
                      />
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={styles.voiceChatInputContainer}>
            {/* Voice Recording Indicator */}
            {isVoiceChatRecording && (
              <View style={styles.voiceChatRecordingIndicator}>
                <View style={styles.voiceChatRecordingDot} />
                <Text style={styles.voiceChatRecordingText}>Recording... Tap stop to finish</Text>
                <TouchableOpacity onPress={cancelVoiceChatRecording} style={styles.voiceChatCancelRecordingButton}>
                  <Text style={styles.voiceChatCancelRecordingText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Voice Recording Ready Indicator */}
            {voiceChatRecordingUri && !isVoiceChatRecording && (
              <View style={styles.voiceChatRecordingReadyIndicator}>
                <Ionicons name="mic" size={20} color="#8B2EF0" />
                <Text style={styles.voiceChatRecordingReadyText}>Voice message ready</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setVoiceChatRecordingUri(null);
                  }} 
                  style={styles.voiceChatRemoveRecordingButton}
                >
                  <Ionicons name="close-circle" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              placeholder="Message"
              placeholderTextColor="#666"
              style={styles.voiceChatInput}
              value={voiceChatInput}
              onChangeText={setVoiceChatInput}
              multiline
              onSubmitEditing={sendVoiceChatMessage}
            />
            <View style={styles.voiceChatInputIcons}>
              {!isVoiceChatRecording ? (
                <TouchableOpacity 
                  style={styles.voiceChatInputIcon}
                  onPress={startVoiceChatRecording}
                >
                  <Ionicons name="mic-outline" size={24} color="#ccc" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.voiceChatInputIcon}
                  onPress={stopVoiceChatRecording}
                >
                  <Ionicons name="stop" size={24} color="#ff4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.voiceChatInputIcon}
                onPress={sendVoiceChatMessage}
                disabled={!voiceChatInput.trim() && !voiceChatRecordingUri}
              >
                <Ionicons 
                  name="send" 
                  size={24} 
                  color={(!voiceChatInput.trim() && !voiceChatRecordingUri) ? '#444' : '#8B2EF0'} 
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceChatInputIcon}>
                <Ionicons name="happy-outline" size={24} color="#ccc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceChatInputIcon}>
                <Ionicons name="gift-outline" size={24} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal
        visible={selectedImageModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImageModal(null)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalCloseButton}
            onPress={() => setSelectedImageModal(null)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImageModal && (
            <Image 
              source={{ uri: selectedImageModal }} 
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: { flex: 1, backgroundColor: '#121212' },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#0a0a0a',
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Tab Bar (Bottom)
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingBottom: 20,
    paddingTop: 10,
    height: 90,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabItemActive: {
    opacity: 1,
  },
  tabItemCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B2EF0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },

  // Sections
  descriptionSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  descriptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  descriptionText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },

  onlineSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  membersScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  memberItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  onlineAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#8B2EF0',
  },
  memberName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  activitiesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  activityCard: {
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
  },
  activityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  memberCategories: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberRowName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  followButton: {
    backgroundColor: '#8B2EF0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  addSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  addOption: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
  },
  addIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  addOptionName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  chatScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
    flexGrow: 1,
    minHeight: '100%',
  },
  chatLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  chatEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noMessagesText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#666',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 4,
  },
  chatMessageContainer: {
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    width: '100%',
  },
  chatMessageContainerRight: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  chatMessageContainerLeft: {
    justifyContent: 'flex-start',
    flexDirection: 'row',
  },
  profilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  chatMessageBox: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  chatMessageBoxOwn: {
    backgroundColor: '#8B2EF0',
    borderColor: '#8B2EF0',
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  chatMessageBoxOther: {
    backgroundColor: '#1c1c1c',
    borderColor: '#ff8c00',
    borderBottomLeftRadius: 4,
    marginRight: 'auto',
  },
  chatMessageTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff8c00',
    marginBottom: 4,
  },
  chatMessageText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  chatMessageTextOwn: {
    color: '#fff',
  },
  chatMessageTime: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  chatMessageTimeOwn: {
    alignSelf: 'flex-end',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  chatInputContainer: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingBottom: Platform.OS === 'ios' ? 10 : 12,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    minHeight: 60,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  messageInputField: {
    flex: 1,
    backgroundColor: '#2a1f3d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    minHeight: 44,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  chatActionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  chatActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emojiPickerContainer: {
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#222',
    maxHeight: 120,
    paddingVertical: 8,
  },
  emojiPickerScroll: {
    flexGrow: 0,
  },
  emojiPickerContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  emojiItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  emojiText: {
    fontSize: 24,
  },
  giftOptionsContainer: {
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#222',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  giftOption: {
    alignItems: 'center',
    flex: 1,
  },
  giftOptionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  giftOptionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  giftOptionSelected: {
    borderWidth: 2,
    borderColor: '#8B2EF0',
  },
  giftOptionTextSelected: {
    color: '#8B2EF0',
    fontWeight: '600',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B2EF0',
    shadowColor: '#8B2EF0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#1e1e1e',
    shadowOpacity: 0,
    elevation: 0,
  },
  chatAttachmentButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    marginRight: 8,
  },
  stopRecordingButton: {
    backgroundColor: '#ff4444',
  },
  chatImagePreview: {
    position: 'relative',
    marginBottom: 8,
    marginHorizontal: 16,
    alignSelf: 'flex-start',
  },
  chatPreviewImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  chatRemoveImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff4444',
    marginBottom: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cancelRecordingButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cancelRecordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chatMessageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  chatVideoContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  chatMessageVideo: {
    width: 200,
    height: 200,
    backgroundColor: '#000',
  },
  chatVoiceContainer: {
    marginBottom: 8,
  },
  chatVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B2EF0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  chatVoiceButtonPlaying: {
    backgroundColor: '#6B1EB0',
    opacity: 0.9,
  },
  chatVoiceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  voiceChatMessageContainer: {
    backgroundColor: 'rgba(64, 255, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(64, 255, 0, 0.3)',
  },
  voiceChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  voiceChatTitle: {
    color: '#40FF00',
    fontSize: 16,
    fontWeight: '700',
  },
  voiceChatText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  voiceChatParticipants: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  joinVoiceChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#40FF00',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  joinVoiceChatText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  joinedVoiceChatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(64, 255, 0, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#40FF00',
  },
  joinedVoiceChatText: {
    color: '#40FF00',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingReadyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e1e1e',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B2EF0',
  },
  recordingReadyText: {
    color: '#8B2EF0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  removeRecordingButton: {
    padding: 4,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  imageModalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },

  accountSection: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#8B2EF0',
  },
  accountAvatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  accountAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#8B2EF0',
  },
  accountBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: '#00FF47',
  },
  accountName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  accountEmailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: '100%',
  },
  accountEmail: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  accountStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  accountStatItem: {
    alignItems: 'center',
  },
  accountStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  accountStatLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  accountContentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  accountContentStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
  },
  accountContentStatText: {
    marginLeft: 12,
  },
  accountContentStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  accountContentStatLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  accountRankingContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
    alignItems: 'center',
  },
  accountRankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountRankingTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  accountRankingBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    minWidth: 150,
  },
  accountRankingNumber: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  accountRankingSubtext: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  accountIdContainer: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
  },
  accountIdLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  accountIdValue: {
    color: '#8B2EF0',
    fontSize: 14,
    fontWeight: '600',
  },

  // Card Container
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    margin: 16,
    alignItems: 'center',
  },
  groupImage: { width: 100, height: 100, borderRadius: 12 },
  infoWrapperHorizontal: { flex: 1, marginLeft: 12 },
  groupName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  groupSubtitle: { color: '#888', fontSize: 14, marginTop: 2 },

  // Members (card header)
  membersWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  membersImages: { flexDirection: 'row' },
  memberImage: { width: 30, height: 30, borderRadius: 15 },
  membersText: { color: '#fff', marginLeft: 8 },

  // Tags
  tagsWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  tagButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  tagButtonText: { fontSize: 12, color: '#fff' },

  // Blog Modal
  blogModalContainer: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  blogModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  blogModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  blogModalPublish: {
    fontSize: 14,
    fontWeight: '700',
  },
  blogModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  blogFormGroup: {
    marginBottom: 24,
  },
  blogFormLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  blogTitleInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#333',
  },
  blogContentInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 200,
  },
  charCount: {
    color: '#888',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  blogAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  blogAuthorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  blogAuthorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  blogAuthorEmail: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },

  // Image Modal
  imageModalContainer: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  imageModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  imageModalPublish: {
    fontSize: 14,
    fontWeight: '700',
  },
  imageModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  imageFormGroup: {
    marginBottom: 24,
  },
  imageFormLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  imagePickerBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    overflow: 'hidden',
    height: 200,
  },
  imagePickerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imageCaptionInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 100,
  },
  imageAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  imageAuthorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  imageAuthorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageAuthorEmail: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },

  // Comment Modal
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

  // Drafts Modal
  draftsModalContainer: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  draftsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  draftsModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  draftsModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  draftsEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  draftsEmptyText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  draftsEmptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  draftItem: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  draftContent: {
    flex: 1,
    flexDirection: 'row',
  },
  draftImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  draftInfo: {
    flex: 1,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  draftType: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  draftDate: {
    color: '#888',
    fontSize: 11,
    marginLeft: 'auto',
  },
  draftTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  draftPreview: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  draftDeleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Voice Chat Interface Styles
  voiceChatInterfaceContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  voiceChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: '#8B2EF0',
    borderBottomWidth: 1,
    borderBottomColor: '#6B1EB0',
  },
  voiceChatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceChatHeaderTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  voiceChatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  voiceChatHeaderIcon: {
    padding: 4,
  },
  voiceChatParticipantsContainer: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    position: 'relative',
  },
  voiceChatParticipantAvatar: {
    alignItems: 'center',
    position: 'absolute',
  },
  voiceChatParticipantTop: {
    top: 0,
    alignSelf: 'center',
  },
  voiceChatParticipantBottomLeft: {
    bottom: 0,
    left: '20%',
  },
  voiceChatParticipantBottomRight: {
    bottom: 0,
    right: '20%',
  },
  voiceChatParticipantAdmin: {
    borderWidth: 3,
    borderColor: '#FFD700',
    borderRadius: 50,
    padding: 3,
  },
  voiceChatParticipantImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#8B2EF0',
  },
  voiceChatParticipantName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    maxWidth: 80,
    textAlign: 'center',
  },
  adminBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  adminBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  voiceChatMessagesArea: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  voiceChatMessagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  voiceChatEmptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  voiceChatEmptyText: {
    color: '#666',
    fontSize: 14,
  },
  voiceChatMessage: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  voiceChatMessageText: {
    color: '#fff',
    fontSize: 14,
  },
  voiceChatInputContainer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  voiceChatInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
    marginBottom: 8,
  },
  voiceChatInputIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  voiceChatInputIcon: {
    padding: 8,
  },
  voiceChatMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  voiceChatMessageContainerOwn: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  voiceChatMessageContainerOther: {
    justifyContent: 'flex-start',
    flexDirection: 'row',
  },
  voiceChatMessageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  voiceChatMessageBox: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  voiceChatMessageBoxOwn: {
    backgroundColor: '#8B2EF0',
    borderColor: '#8B2EF0',
    borderBottomRightRadius: 4,
  },
  voiceChatMessageBoxOther: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
    borderBottomLeftRadius: 4,
  },
  voiceChatMessageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B2EF0',
    marginBottom: 4,
  },
  voiceChatMessageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  voiceChatMessageTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  voiceChatVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 46, 240, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    marginBottom: 4,
  },
  voiceChatVoiceButtonPlaying: {
    backgroundColor: 'rgba(139, 46, 240, 0.5)',
    opacity: 0.9,
  },
  voiceChatVoiceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  voiceChatRecordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff4444',
    marginBottom: 8,
    borderRadius: 8,
  },
  voiceChatRecordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  voiceChatRecordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  voiceChatCancelRecordingButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  voiceChatCancelRecordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  voiceChatRecordingReadyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e1e1e',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B2EF0',
  },
  voiceChatRecordingReadyText: {
    color: '#8B2EF0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  voiceChatRemoveRecordingButton: {
    padding: 4,
  },
  voiceChatMicToggleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  voiceChatMicToggleButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ff4444',
    marginBottom: 12,
  },
  voiceChatMicToggleButtonOn: {
    backgroundColor: '#8B2EF0',
    borderColor: '#40FF00',
  },
  voiceChatMicToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  voiceChatMicLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(64, 255, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#40FF00',
    marginTop: 8,
  },
  voiceChatMicLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#40FF00',
    marginRight: 8,
  },
  voiceChatMicLiveText: {
    color: '#40FF00',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceChatParticipantSpeaking: {
    borderWidth: 3,
    borderColor: '#40FF00',
    shadowColor: '#40FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  speakingIndicator: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakingPulse: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#40FF00',
    opacity: 0.8,
  },
  // Active Audio Call Banner Styles
  activeCallBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8B2EF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  activeCallGradient: {
    padding: 16,
    borderRadius: 16,
  },
  activeCallContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  audioWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  audioWaveAnimation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 3,
  },
  audioWave: {
    width: 3,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
    opacity: 0.8,
  },
  activeCallText: {
    flex: 1,
  },
  activeCallTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  participantsCount: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 8,
    opacity: 0.9,
  },
  activeCallRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  joinButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginRight: 4,
    letterSpacing: 0.5,
  },
});
