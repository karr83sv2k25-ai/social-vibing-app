import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { uploadVideoToHostinger } from './hostingerConfig';
import { 
  
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  where,
} from 'firebase/firestore';
import { app as firebaseApp, db } from './firebaseConfig';

export default function ScreenSharingRoom() {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, groupTitle, roomId: existingRoomId } = route.params || {};

  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Room creator (not community admin)
  const [isSharing, setIsSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [roomId, setRoomId] = useState(existingRoomId || null);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistVideos, setPlaylistVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const videoRef = useRef(null);
  const [videoStatus, setVideoStatus] = useState({});
  
  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const auth = getAuth(firebaseApp);
        // db is now imported globally

        if (auth.currentUser) {
          const userId = auth.currentUser.uid;
          
          // Get user data
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          
          setCurrentUser({
            id: userId,
            name: userData.displayName || userData.name || auth.currentUser.displayName || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
          });

          // Create or join screening room
          await joinScreeningRoom(userId, userData);
        }
        setLoading(false);
      } catch (e) {
        console.log('Error checking user role:', e);
        setLoading(false);
      }
    };

    checkUserRole();
    
    // Listen for dimension changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const { width, height } = window;
      // Auto-detect landscape mode
    });

    return () => {
      subscription?.remove();
    };
  }, [communityId]);

  const joinScreeningRoom = async (userId, userData) => {
    try {
      // db is now imported globally
      // Use existing roomId from params or create a new one
      const screenRoomId = existingRoomId || `screen_${communityId}_${Date.now()}`;
      const screenRoomRef = doc(db, 'screening_rooms', screenRoomId);
      
      setRoomId(screenRoomId);

      const roomSnap = await getDoc(screenRoomRef);

      if (!roomSnap.exists()) {
        // Create new screening room - creator becomes admin
        await setDoc(screenRoomRef, {
          communityId: communityId,
          communityName: groupTitle || 'Community',
          createdBy: userId,
          createdAt: serverTimestamp(),
          isActive: true,
          sharingUserId: null,
          participants: [{
            userId: userId,
            userName: userData.displayName || userData.name || 'User',
            profileImage: userData.profileImage || userData.avatar || null,
            isCreator: true,
            joinedAt: new Date().toISOString(),
          }],
        });
        // User created the room, so they are the admin
        setIsAdmin(true);
      } else {
        // Join existing room
        const data = roomSnap.data();
        const existingParticipants = data.participants || [];
        const userExists = existingParticipants.some(p => p.userId === userId);

        if (!userExists) {
          await updateDoc(screenRoomRef, {
            participants: arrayUnion({
              userId: userId,
              userName: userData.displayName || userData.name || 'User',
              profileImage: userData.profileImage || userData.avatar || null,
              isCreator: false,
              joinedAt: new Date().toISOString(),
            }),
          });
        }

        // Check if current user is the room creator
        setIsAdmin(data.createdBy === userId);
        setScreenShareActive(data.sharingUserId !== null);
      }

      // Listen to room updates
      const unsubscribe = onSnapshot(screenRoomRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('Room update received:', {
            participants: data.participants?.length,
            sharingUserId: data.sharingUserId,
            currentVideo: data.currentVideo?.title,
            playlistCount: data.playlist?.length
          });
          
          setParticipants(data.participants || []);
          setScreenShareActive(data.sharingUserId !== null);
          
          // Load playlist
          if (data.playlist) {
            setPlaylistVideos(data.playlist);
          }
          
          // Load current video
          if (data.currentVideo) {
            console.log('Setting current video:', data.currentVideo.title);
            setCurrentVideo(data.currentVideo);
          } else {
            console.log('No current video');
            setCurrentVideo(null);
          }
        }
      });

      return () => unsubscribe();
    } catch (e) {
      console.log('Error joining screening room:', e);
    }
  };

  // Listen for chat messages
  useEffect(() => {
    if (!communityId || !roomId) return;

    // db is now imported globally
    const chatRef = collection(db, 'screening_rooms', roomId, 'chat');
    const q = query(chatRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setChatMessages(messages);
      
      // Update unread count if chat is closed
      if (!showChat && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.senderId !== currentUser?.id) {
          setUnreadCount(prev => prev + 1);
        }
      }
      
      // Auto scroll to bottom
      setTimeout(() => {
        if (chatScrollRef.current && showChat) {
          chatScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [communityId, roomId, showChat, currentUser?.id]);

  // Reset unread count when chat opens
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

  const handleStartSharing = async () => {
    if (!isAdmin) {
      Alert.alert('Admin Only', 'Only admins can share their screen');
      return;
    }

    try {
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);

      if (!isSharing) {
        // Start sharing
        await updateDoc(screenRoomRef, {
          sharingUserId: currentUser.id,
          sharingUserName: currentUser.name,
        });
        setIsSharing(true);
        Alert.alert('Screen Sharing Started', 'Your screen is now being shared with all participants');
      } else {
        // Stop sharing
        await updateDoc(screenRoomRef, {
          sharingUserId: null,
          sharingUserName: null,
        });
        setIsSharing(false);
      }
    } catch (e) {
      console.log('Error toggling screen share:', e);
      Alert.alert('Error', 'Failed to start screen sharing');
    }
  };

  const toggleFullscreen = async () => {
    if (videoRef.current) {
      if (isFullscreen) {
        await videoRef.current.dismissFullscreenPlayer();
        setIsFullscreen(false);
      } else {
        await videoRef.current.presentFullscreenPlayer();
        setIsFullscreen(true);
      }
    }
  };

  const handlePickVideo = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need media library permissions to pick videos');
        return;
      }

      // Launch video picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const video = result.assets[0];
        console.log('Video picked:', video.uri);
        
        // Show loading alert
        Alert.alert('Uploading Video', 'Please wait while the video is being uploaded...');
        
        try {
          // Upload video to Hostinger so everyone can access it
          console.log('Uploading video to Hostinger...');
          const uploadedUrl = await uploadVideoToHostinger(video.uri, 'screening_room_videos');
          
          console.log('Video uploaded successfully:', uploadedUrl);
          
          // Add to playlist with the cloud URL
          const newVideo = {
            id: Date.now().toString(),
            url: uploadedUrl,
            title: videoTitle.trim() || `Video ${Date.now()}`,
            duration: video.duration,
            isLocal: false, // Changed to false since it's now uploaded to cloud
            addedBy: currentUser.id,
            addedAt: new Date().toISOString(),
          };

          // Update Firestore with the uploaded video
          // db is now imported globally
          const screenRoomRef = doc(db, 'screening_rooms', roomId);
          await updateDoc(screenRoomRef, {
            playlist: arrayUnion(newVideo),
          });

          setVideoUrl('');
          setVideoTitle('');
          setShowAddVideo(false);
          Alert.alert('Success', 'Video uploaded and added to playlist! Everyone can now see it.');
        } catch (uploadError) {
          console.log('Error uploading video:', uploadError);
          Alert.alert('Upload Failed', 'Could not upload video. Please try a smaller video or check your connection.');
        }
      }
    } catch (e) {
      console.log('Error picking video:', e);
      Alert.alert('Error', 'Failed to pick video: ' + e.message);
    }
  };

  const handleAddVideo = async () => {
    if (!videoUrl.trim()) {
      Alert.alert('Error', 'Please enter a YouTube video URL');
      return;
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?\:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const match = videoUrl.trim().match(youtubeRegex);
    
    if (!match) {
      Alert.alert('Invalid URL', 'Please enter a valid YouTube video URL');
      return;
    }

    const videoId = match[4];
    // Use youtube-nocookie.com and add parameters to bypass restrictions and fix Error 4
    // fs=1 enables fullscreen, iv_load_policy=3 hides annotations
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&controls=1&modestbranding=1&rel=0&fs=1&iv_load_policy=3&widget_referrer=https://localhost`;

    try {
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);

      const newVideo = {
        id: Date.now().toString(),
        url: embedUrl,
        originalUrl: videoUrl.trim(),
        videoId: videoId,
        title: videoTitle.trim() || `YouTube Video ${videoId}`,
        isYouTube: true,
        addedBy: currentUser.id,
        addedAt: new Date().toISOString(),
      };

      await updateDoc(screenRoomRef, {
        playlist: arrayUnion(newVideo),
      });

      setVideoUrl('');
      setVideoTitle('');
      setShowAddVideo(false);
      Alert.alert('Success', 'YouTube video added to playlist');
    } catch (e) {
      console.log('Error adding video:', e);
      Alert.alert('Error', 'Failed to add video to playlist');
    }
  };

  const handleRemoveVideo = async (videoToRemove) => {
    if (!isAdmin) {
      Alert.alert('Creator Only', 'Only the room creator can remove videos');
      return;
    }

    try {
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);
      const roomSnap = await getDoc(screenRoomRef);

      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const updatedPlaylist = (data.playlist || []).filter(v => v.id !== videoToRemove.id);

        await updateDoc(screenRoomRef, {
          playlist: updatedPlaylist,
        });

        // If removed video was currently playing, stop it
        if (currentVideo?.id === videoToRemove.id) {
          await updateDoc(screenRoomRef, {
            currentVideo: null,
            sharingUserId: null,
            sharingUserName: null,
          });
          setCurrentVideo(null);
        }

        Alert.alert('Success', 'Video removed from playlist');
      }
    } catch (e) {
      console.log('Error removing video:', e);
      Alert.alert('Error', 'Failed to remove video');
    }
  };

  const handleReorderVideo = async (videoId, direction) => {
    if (!isAdmin) {
      Alert.alert('Creator Only', 'Only the room creator can reorder videos');
      return;
    }

    try {
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);
      const roomSnap = await getDoc(screenRoomRef);

      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const playlist = [...(data.playlist || [])];
        const currentIndex = playlist.findIndex(v => v.id === videoId);

        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        
        if (newIndex < 0 || newIndex >= playlist.length) return;

        // Swap videos
        [playlist[currentIndex], playlist[newIndex]] = [playlist[newIndex], playlist[currentIndex]];

        await updateDoc(screenRoomRef, {
          playlist: playlist,
        });
      }
    } catch (e) {
      console.log('Error reordering video:', e);
      Alert.alert('Error', 'Failed to reorder video');
    }
  };

  const handlePlayVideo = async (video) => {
    if (!isAdmin) {
      Alert.alert('Creator Only', 'Only the room creator can play videos');
      return;
    }

    try {
      console.log('Playing video:', video.title, video.url);
      
      // All videos now have URLs (either direct or uploaded to cloud)
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);

      await updateDoc(screenRoomRef, {
        currentVideo: video,
        sharingUserId: currentUser.id,
        sharingUserName: currentUser.name,
      });

      console.log('Video updated in Firestore - all participants can now see it');
      setCurrentVideo(video);
      setLocalVideoUri(null);
      setShowPlaylist(false);
      setIsSharing(true);
    } catch (e) {
      console.log('Error playing video:', e);
      Alert.alert('Error', 'Failed to play video: ' + e.message);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentUser) return;

    try {
      // db is now imported globally
      const chatRef = collection(db, 'screening_rooms', roomId, 'chat');
      
      await addDoc(chatRef, {
        text: chatInput.trim(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderImage: currentUser.profileImage,
        createdAt: serverTimestamp(),
      });
      
      setChatInput('');
      Keyboard.dismiss();
    } catch (error) {
      console.log('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleStopVideo = async () => {
    if (!isAdmin) {
      Alert.alert('Creator Only', 'Only the room creator can stop videos');
      return;
    }
    
    try {
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);

      await updateDoc(screenRoomRef, {
        currentVideo: null,
        sharingUserId: null,
        sharingUserName: null,
      });

      setCurrentVideo(null);
      setLocalVideoUri(null);
      setIsSharing(false);
    } catch (e) {
      console.log('Error stopping video:', e);
    }
  };

  // End session (admin only)
  const handleEndSession = () => {
    Alert.alert(
      'End Screening Room',
      'Are you sure you want to end this screening room for everyone? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              // db is now imported globally
              const screenRoomRef = doc(db, 'screening_rooms', roomId);
              
              // Find and update the chat message in both community_chats and conversations
              const updatePromises = [];
              
              // Check community_chats
              const chatRef = collection(db, 'community_chats', communityId, 'messages');
              const q = query(
                chatRef,
                where('type', '==', 'screeningRoom'),
                where('roomId', '==', roomId)
              );
              const messagesSnap = await getDocs(q);
              
              messagesSnap.docs.forEach(msgDoc => {
                updatePromises.push(
                  updateDoc(doc(db, 'community_chats', communityId, 'messages', msgDoc.id), {
                    isActive: false,
                    closedAt: serverTimestamp(),
                    closedBy: currentUser.id,
                  })
                );
              });
              
              // Check conversations collection (one-on-one chat)
              // Only check conversations where current user is a participant
              const conversationsRef = collection(db, 'conversations');
              const userConversationsQuery = query(
                conversationsRef,
                where('participants', 'array-contains', currentUser.id)
              );
              const conversationsSnapshot = await getDocs(userConversationsQuery);
              
              for (const convDoc of conversationsSnapshot.docs) {
                const convMessagesRef = collection(db, 'conversations', convDoc.id, 'messages');
                const convQuery = query(
                  convMessagesRef,
                  where('type', '==', 'screeningRoom'),
                  where('roomId', '==', roomId)
                );
                const convSnapshot = await getDocs(convQuery);
                
                convSnapshot.docs.forEach(msgDoc => {
                  updatePromises.push(
                    updateDoc(doc(db, 'conversations', convDoc.id, 'messages', msgDoc.id), {
                      isActive: false,
                      closedAt: serverTimestamp(),
                      closedBy: currentUser.id,
                    }).catch(err => console.log('Error updating conversation message:', err))
                  );
                });
              }

              // Update room status instead of deleting
              updatePromises.push(
                updateDoc(screenRoomRef, {
                  isActive: false,
                  closedAt: serverTimestamp(),
                  closedBy: currentUser.id,
                }).catch(err => console.log('Error updating screening room:', err))
              );
              
              // Wait for all operations to complete
              await Promise.allSettled(updatePromises);
              
              Alert.alert('Session Ended', 'The screening room has been closed for all participants.');
              navigation.goBack();
            } catch (error) {
              console.error('Error ending session:', error);
              Alert.alert('Error', 'Failed to end session. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveRoom = async () => {
    try {
      // db is now imported globally
      const screenRoomRef = doc(db, 'screening_rooms', roomId);
      
      const roomSnap = await getDoc(screenRoomRef);
      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const isCreator = data.createdBy === currentUser?.id;
        
        if (isCreator) {
          // Creator leaving - offer to end session
          Alert.alert(
            'End Screening Room?',
            'You are the creator of this screening room. Do you want to end it for everyone?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Just Leave',
                onPress: async () => {
                  try {
                    const updatedParticipants = (data.participants || []).filter(
                      (p) => p.userId !== currentUser.id
                    );

                    if (updatedParticipants.length === 0) {
                      // Delete room if no participants
                      await deleteDoc(screenRoomRef);
                    } else {
                      // Remove user from participants
                      await updateDoc(screenRoomRef, {
                        participants: updatedParticipants,
                        ...(data.sharingUserId === currentUser.id && {
                          sharingUserId: null,
                          sharingUserName: null,
                          currentVideo: null,
                        }),
                      });
                    }
                    
                    navigation.goBack();
                  } catch (e) {
                    console.log('Error leaving room:', e);
                    navigation.goBack();
                  }
                },
              },
              {
                text: 'End Session',
                style: 'destructive',
                onPress: () => {
                  handleEndSession();
                },
              },
            ]
          );
        } else {
          // Regular participant leaving
          Alert.alert(
            'Leave Room',
            'Are you sure you want to leave this screening room?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const updatedParticipants = (data.participants || []).filter(
                      (p) => p.userId !== currentUser.id
                    );

                    if (updatedParticipants.length === 0) {
                      // Delete room if no participants
                      await deleteDoc(screenRoomRef);
                    } else {
                      // Remove user from participants
                      await updateDoc(screenRoomRef, {
                        participants: updatedParticipants,
                        ...(data.sharingUserId === currentUser.id && {
                          sharingUserId: null,
                          sharingUserName: null,
                          currentVideo: null,
                        }),
                      });
                    }
                    
                    navigation.goBack();
                  } catch (e) {
                    console.log('Error leaving room:', e);
                    navigation.goBack();
                  }
                },
              },
            ]
          );
        }
      } else {
        navigation.goBack();
      }
    } catch (e) {
      console.log('Error leaving room:', e);
      navigation.goBack();
    }
  };

  const renderParticipant = ({ item }) => {
    const isCurrentUser = item.userId === currentUser?.id;
    
    return (
      <View style={styles.participantItem}>
        <View style={styles.participantAvatarContainer}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.participantAvatar} />
          ) : (
            <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
              <Text style={styles.participantAvatarText}>
                {item.userName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          {item.isAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
            </View>
          )}
        </View>
        <Text style={styles.participantName} numberOfLines={1}>
          {isCurrentUser ? 'You' : item.userName}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleLeaveRoom} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{groupTitle || 'Screening Room'}</Text>
              <Text style={styles.headerSubtitle}>
                {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
              </Text>
            </View>
            <TouchableOpacity style={styles.infoButton}>
              <Ionicons name="information-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Main Screen Area */}
      <View style={styles.screenContainer}>
        {(currentVideo && currentVideo.url) ? (
          <View style={styles.videoContainer}>
            {currentVideo.isYouTube ? (
              // YouTube videos use WebView with HTML wrapper for better compatibility
              <WebView
                key={currentVideo.id}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';">
                        <style>
                          * { margin: 0; padding: 0; overflow: hidden; }
                          html, body { height: 100%; width: 100%; background-color: #000; }
                          .video-container {
                            position: relative;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                          }
                          iframe {
                            width: 100%;
                            height: 100%;
                            border: none;
                          }
                        </style>
                      </head>
                      <body>
                        <div class="video-container">
                          <iframe
                            id="ytplayer"
                            src="${currentVideo.url.replace('youtube.com', 'youtube-nocookie.com')}"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen
                            webkitallowfullscreen
                            mozallowfullscreen
                            loading="eager"
                          ></iframe>
                        </div>
                      </body>
                    </html>
                  `,
                  baseUrl: 'https://localhost'
                }}
                style={styles.video}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                mixedContentMode="always"
                originWhitelist={['*']}
                allowsProtectedMedia={true}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                cacheEnabled={true}
                cacheMode="LOAD_DEFAULT"
                renderLoading={() => (
                  <View style={styles.loadingVideo}>
                    <ActivityIndicator size="large" color="#667eea" />
                    <Text style={styles.loadingText}>Loading video...</Text>
                  </View>
                )}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.log('WebView error:', nativeEvent);
                  Alert.alert('Video Error', 'Failed to load YouTube video. Error: ' + (nativeEvent.description || 'Unknown'));
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.log('HTTP error:', nativeEvent);
                }}
                onLoadEnd={() => {
                  console.log('YouTube video loaded successfully');
                }}
              />
            ) : (
              // Regular videos use Video component
              <Video
                key={currentVideo.id}
                ref={videoRef}
                source={{ uri: currentVideo.url }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping
                shouldPlay
                onPlaybackStatusUpdate={(status) => {
                  setVideoStatus(() => status);
                  if (status.error) {
                    console.log('Video error:', status.error);
                    Alert.alert('Video Error', 'Failed to load video. Please check the URL.');
                  }
                }}
                onLoad={() => console.log('Video loaded:', currentVideo.title)}
                onError={(error) => {
                  console.log('Video load error:', error);
                  Alert.alert('Video Error', 'Could not load video. Please check the URL.');
                }}
                onFullscreenUpdate={({ fullscreenUpdate }) => {
                  if (fullscreenUpdate === 0 || fullscreenUpdate === 2) {
                    setIsFullscreen(false);
                  } else if (fullscreenUpdate === 1 || fullscreenUpdate === 3) {
                    setIsFullscreen(true);
                  }
                }}
              />
            )}
            <View style={styles.videoOverlay}>
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  {currentVideo.title}
                </Text>
                {!currentVideo.isYouTube && (
                  <TouchableOpacity onPress={toggleFullscreen} style={styles.orientationButton}>
                    <Ionicons 
                      name={isFullscreen ? "contract" : "expand"} 
                      size={20} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : screenShareActive ? (
          <View style={styles.activeScreenShare}>
            <MaterialCommunityIcons name="monitor-share" size={80} color="#667eea" />
            <Text style={styles.sharingText}>
              {isSharing ? 'You are sharing your screen' : 'Admin is sharing their screen'}
            </Text>
            <Text style={styles.sharingSubtext}>
              Screen content will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.waitingScreen}>
            <MaterialCommunityIcons name="monitor-off" size={80} color="#999" />
            <Text style={styles.waitingText}>Waiting for screen share</Text>
            <Text style={styles.waitingSubtext}>
              {isAdmin ? 'Click playlist to play videos' : 'Creator will start sharing soon'}
            </Text>
          </View>
        )}
      </View>

      {/* Participants List */}
      <View style={styles.participantsContainer}>
        <Text style={styles.participantsTitle}>Participants</Text>
        <FlatList
          data={participants}
          renderItem={renderParticipant}
          keyExtractor={(item) => item.userId}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.participantsList}
        />
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {isAdmin && (
          <TouchableOpacity
            style={styles.playlistButton}
            onPress={() => setShowPlaylist(true)}
          >
            <MaterialCommunityIcons name="playlist-play" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Playlist ({playlistVideos.length})</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => setShowChat(!showChat)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {isAdmin && currentVideo ? (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopVideo}
          >
            <MaterialCommunityIcons name="stop" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Stop</Text>
          </TouchableOpacity>
        ) : !isAdmin ? (
          <View style={styles.viewerInfo}>
            <Ionicons name="eye-outline" size={20} color="#667eea" />
            <Text style={styles.viewerText}>Viewing Mode</Text>
          </View>
        ) : null}

        {isAdmin && (
          <TouchableOpacity style={styles.endSessionButton} onPress={handleEndSession}>
            <MaterialCommunityIcons name="close-circle" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>End</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
          <Ionicons name="exit-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Playlist Modal */}
      <Modal
        visible={showPlaylist}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlaylist(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.playlistModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Video Playlist</Text>
              <TouchableOpacity onPress={() => setShowPlaylist(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.playlistScroll}>
              {playlistVideos.map((video, index) => (
                <View key={video.id} style={styles.playlistItemWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.playlistItem,
                      currentVideo?.id === video.id && styles.activePlaylistItem
                    ]}
                    onPress={() => handlePlayVideo(video)}
                  >
                    <View style={styles.playlistItemIcon}>
                      <MaterialCommunityIcons 
                        name={currentVideo?.id === video.id ? "play-circle" : "play"} 
                        size={24} 
                        color={currentVideo?.id === video.id ? "#667eea" : "#999"} 
                      />
                    </View>
                    <View style={styles.playlistItemContent}>
                      <Text style={styles.playlistItemTitle}>
                        {video.title}
                      </Text>
                      <Text style={styles.playlistItemUrl} numberOfLines={1}>
                        {video.isYouTube ? '🎬 YouTube' : video.url}
                      </Text>
                    </View>
                    <Text style={styles.playlistItemNumber}>{index + 1}</Text>
                  </TouchableOpacity>
                  
                  {isAdmin && (
                    <View style={styles.playlistControls}>
                      {/* Reorder Up */}
                      {index > 0 && (
                        <TouchableOpacity
                          style={styles.playlistControlButton}
                          onPress={() => handleReorderVideo(video.id, 'up')}
                        >
                          <Ionicons name="arrow-up" size={20} color="#4CAF50" />
                        </TouchableOpacity>
                      )}
                      
                      {/* Reorder Down */}
                      {index < playlistVideos.length - 1 && (
                        <TouchableOpacity
                          style={styles.playlistControlButton}
                          onPress={() => handleReorderVideo(video.id, 'down')}
                        >
                          <Ionicons name="arrow-down" size={20} color="#4CAF50" />
                        </TouchableOpacity>
                      )}
                      
                      {/* Remove */}
                      <TouchableOpacity
                        style={styles.playlistControlButton}
                        onPress={() => {
                          Alert.alert(
                            'Remove Video',
                            'Are you sure you want to remove this video from the playlist?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Remove', style: 'destructive', onPress: () => handleRemoveVideo(video) }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="trash" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {playlistVideos.length === 0 && (
                <View style={styles.emptyPlaylist}>
                  <MaterialCommunityIcons name="youtube" size={60} color="#FF0000" />
                  <Text style={styles.emptyPlaylistText}>No videos in playlist</Text>
                  <Text style={styles.emptyPlaylistSubtext}>Add YouTube videos to start watching together</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.addVideoButtonsContainer}>
              <TouchableOpacity
                style={styles.addVideoButton}
                onPress={() => {
                  setShowPlaylist(false);
                  setShowAddVideo(true);
                }}
              >
                <MaterialCommunityIcons name="youtube" size={24} color="#fff" />
                <Text style={styles.addVideoButtonText}>Add YouTube Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Video Modal */}
      <Modal
        visible={showAddVideo}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddVideo(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.addVideoModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Video</Text>
              <TouchableOpacity onPress={() => setShowAddVideo(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Video Title (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter video title"
                placeholderTextColor="#666"
                value={videoTitle}
                onChangeText={setVideoTitle}
              />

              <Text style={styles.inputLabel}>YouTube Video URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor="#666"
                value={videoUrl}
                onChangeText={setVideoUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              
              <View style={styles.helpTextContainer}>
                <Ionicons name="information-circle-outline" size={16} color="#FF0000" />
                <Text style={styles.helpText}>
                  Only YouTube video URLs are supported. Paste the full URL from YouTube.
                </Text>
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleAddVideo}>
                <Text style={styles.submitButtonText}>Add to Playlist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Chat Overlay */}
      {showChat && (
        <View style={styles.chatOverlay}>
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Chat</Text>
              <TouchableOpacity onPress={() => setShowChat(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              ref={chatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
            >
              {chatMessages.map((msg) => {
                const isOwnMessage = msg.senderId === currentUser?.id;
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatMessage,
                      isOwnMessage ? styles.chatMessageOwn : styles.chatMessageOther
                    ]}
                  >
                    {!isOwnMessage && (
                      <Image
                        source={msg.senderImage ? { uri: msg.senderImage } : require('./assets/a1.png')}
                        style={styles.chatAvatar}
                      />
                    )}
                    <View style={[
                      styles.chatBubble,
                      isOwnMessage ? styles.chatBubbleOwn : styles.chatBubbleOther
                    ]}>
                      {!isOwnMessage && (
                        <Text style={styles.chatSenderName}>{msg.senderName}</Text>
                      )}
                      <Text style={styles.chatText}>{msg.text}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#666"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={styles.chatSendButton}
                  onPress={sendChatMessage}
                  disabled={!chatInput.trim()}
                >
                  <Ionicons 
                    name="send" 
                    size={20} 
                    color={chatInput.trim() ? '#FF00FF' : '#666'} 
                  />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  header: {
    paddingBottom: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  infoButton: {
    padding: 8,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    margin: 15,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeScreenShare: {
    alignItems: 'center',
    padding: 30,
  },
  sharingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  sharingSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  waitingScreen: {
    alignItems: 'center',
    padding: 30,
  },
  waitingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 20,
    textAlign: 'center',
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  participantsContainer: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginLeft: 15,
    marginBottom: 10,
  },
  participantsList: {
    paddingHorizontal: 15,
  },
  participantItem: {
    alignItems: 'center',
    marginRight: 15,
    width: 70,
  },
  participantAvatarContainer: {
    position: 'relative',
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  participantAvatarPlaceholder: {
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  adminBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  participantName: {
    fontSize: 12,
    color: '#fff',
    marginTop: 6,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  viewerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  viewerText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 10,
    color: '#667eea',
    fontSize: 14,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 10,
  },
  orientationButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  playlistButton: {
    flex: 1,
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  playlistModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  addVideoModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  playlistScroll: {
    maxHeight: 400,
  },
  playlistItemWrapper: {
    marginBottom: 2,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1a1a1a',
  },
  activePlaylistItem: {
    backgroundColor: '#2a2a2a',
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  playlistControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#0a0a0a',
    gap: 10,
  },
  playlistControlButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  playlistItemIcon: {
    marginRight: 12,
  },
  playlistItemContent: {
    flex: 1,
  },
  playlistItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  playlistItemUrl: {
    fontSize: 12,
    color: '#999',
  },
  playlistItemNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginLeft: 10,
  },
  emptyPlaylist: {
    alignItems: 'center',
    padding: 40,
  },
  emptyPlaylistText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 15,
  },
  emptyPlaylistSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  addVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    margin: 15,
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  addVideoButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  addVideoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  inputContainer: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 25,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  helpTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  chatButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,255,0.3)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  chatOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 16,
  },
  chatMessage: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  chatMessageOwn: {
    justifyContent: 'flex-end',
  },
  chatMessageOther: {
    justifyContent: 'flex-start',
  },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  chatBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 16,
  },
  chatBubbleOwn: {
    backgroundColor: '#FF00FF',
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    backgroundColor: '#333',
    borderBottomLeftRadius: 4,
  },
  chatSenderName: {
    color: '#FF00FF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatText: {
    color: '#fff',
    fontSize: 15,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

