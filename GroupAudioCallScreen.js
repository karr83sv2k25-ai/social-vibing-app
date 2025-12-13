import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Dimensions,
  Animated,
  PermissionsAndroid,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { createAgoraRtcEngine, ChannelProfileType, AudioProfileType } from 'react-native-agora';
import {
  getFirestore,
  doc,
  getDoc,
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
import { getAuth } from 'firebase/auth';
import { app as firebaseApp, db } from './firebaseConfig';
import { AGORA_CONFIG, generateChannelName, generateAgoraToken } from './agoraConfig';

const { width } = Dimensions.get('window');

export default function GroupAudioCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, roomId, callId, groupTitle } = route.params || {};
  
  // Use roomId if provided (from voice chat), otherwise use callId (from regular calls)
  const actualRoomId = roomId || callId;

  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [agoraEngine, setAgoraEngine] = useState(null);
  
  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const pulseAnims = useRef({}).current;
  const chatScrollRef = useRef(null);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const auth = getAuth(firebaseApp);
        // db is now imported globally

        if (auth.currentUser) {
          const userId = auth.currentUser.uid;
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const userName =
              userData.displayName ||
              userData.name ||
              userData.fullName ||
              userData.username ||
              userData.firstName ||
              auth.currentUser.displayName ||
              auth.currentUser.email?.split('@')[0] ||
              'User';

            console.log('[GroupCall] User loaded:', { id: userId, name: userName });

            setCurrentUser({
              id: userId,
              name: userName,
              profileImage: userData.profileImage || userData.avatar || null,
            });
          } else {
            console.log('[GroupCall] User document not found, using auth data');
            const fallbackName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User';
            setCurrentUser({
              id: userId,
              name: fallbackName,
              profileImage: null,
            });
          }
        } else {
          console.log('[GroupCall] No authenticated user');
          Alert.alert('Error', 'You must be logged in to join a call');
          navigation.goBack();
        }
      } catch (e) {
        console.log('[Agora] Error fetching user:', e);
        Alert.alert('Error', 'Failed to load user data: ' + e.message);
      }
    };

    fetchCurrentUser();
  }, []);

  // Initialize Agora and join channel
  useEffect(() => {
    if (!currentUser?.id || !communityId || !actualRoomId) return;

    let engine = null;

    const initAgora = async () => {
      try {
        // Check if Agora App ID is configured
        if (!AGORA_CONFIG.appId || AGORA_CONFIG.appId === 'YOUR_AGORA_APP_ID_HERE') {
          Alert.alert(
            'Configuration Required',
            'Please add your Agora App ID in agoraConfig.js\n\nGet it from: https://console.agora.io',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }

        // Request microphone permission on Android
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Microphone permission is required for voice calls');
            navigation.goBack();
            return;
          }
        }

        console.log('[Agora] Creating engine with App ID:', AGORA_CONFIG.appId.substring(0, 8) + '...');
        
        // Create Agora engine using v4.x API
        engine = createAgoraRtcEngine();
        await engine.initialize({
          appId: AGORA_CONFIG.appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });
        setAgoraEngine(engine);
        
        console.log('[Agora] Engine created successfully');

        // Set client role to broadcaster (required for communication profile)
        await engine.setClientRole(1); // 1 = Broadcaster, 2 = Audience

        // Enable audio
        await engine.enableAudio();

        // Enable echo cancellation and noise suppression
        await engine.setAudioProfile(
          AudioProfileType.AudioProfileMusicStandard
        );
        
        // Enable advanced audio features to prevent echo
        await engine.setAudioScenario(1); // Default scenario with echo cancellation
        
        // Adjust echo cancellation level (helps prevent feedback)
        await engine.setParameters(JSON.stringify({
          'che.audio.enable.aec': true,
          'che.audio.enable.agc': true,
          'che.audio.enable.ns': true,
        }));

        // Use earpiece instead of speaker by default to prevent echo
        await engine.setDefaultAudioRouteToSpeakerphone(false);

        // Set up event handlers
        engine.registerEventHandler({
          onJoinChannelSuccess: (connection, elapsed) => {
            console.log('[Agora] ✓✓✓ JOIN SUCCESS! Channel:', connection.channelId, 'Elapsed:', elapsed);
            setIsCallActive(true);
          },
          onUserJoined: (connection, remoteUid) => {
            console.log('[Agora] 👤 User joined:', remoteUid);
          },
          onUserOffline: (connection, remoteUid, reason) => {
            console.log('[Agora] 👋 User left:', remoteUid, 'Reason:', reason);
          },
          onAudioVolumeIndication: (connection, speakers) => {
            const speaking = speakers
              .filter((s) => s.volume > 50)
              .map((s) => s.uid);
            setSpeakingUsers(speaking);
          },
          onError: (err, msg) => {
            console.log('[Agora] ❌ Error code:', err, 'Message:', msg);
            
            // Handle specific errors
            if (err === 109) {
              Alert.alert(
                'Token Expired',
                'The Agora token has expired. Options:\\n\\n1. Generate a new token from Agora Console\\n2. OR disable App Certificate in Agora Console\\n3. Set token to null in agoraConfig.js for testing',
                [{ text: 'OK' }]
              );
            } else if (err === 110) {
              Alert.alert(
                'Connection Timeout',
                'Failed to join the voice channel. Please check:\\n\\n1. Your internet connection\\n2. Agora App Certificate is DISABLED (for testing with null token)\\n3. Or generate a valid token if App Certificate is enabled',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            }
          },
          onWarning: (warn, msg) => {
            console.log('[Agora] ⚠️ Warning:', warn, msg);
          },
          onConnectionStateChanged: (connection, state, reason) => {
            console.log('[Agora] Connection state changed:', state, 'Reason:', reason);
          },
        });

        // Enable audio volume indication
        await engine.enableAudioVolumeIndication(300, 3, false);

        // Generate channel name and token
        const channelName = actualRoomId;
        console.log('[Agora] Joining channel:', channelName);
        
        // Generate token (returns null if no token server configured)
        const token = await generateAgoraToken(channelName, 0, 1);
        
        console.log('[Agora] Token:', token ? 'Received' : 'NULL (no certificate mode)');
        
        // Join channel with correct v4.x API
        const result = await engine.joinChannel(
          token || '',                // token (empty string if null)
          channelName,                // channelId
          0,                          // uid (0 = auto-assign)
          {
            clientRoleType: 1,        // 1 = Broadcaster
          }
        );

        console.log('[Agora] Join channel result:', result);
        console.log('[Agora] Waiting for onJoinChannelSuccess callback...');
        
        // Check result code
        if (result < 0) {
          let errorMsg = 'Failed to join channel';
          let errorTitle = 'Connection Error';
          
          if (result === -102) {
            errorTitle = 'Invalid App ID';
            errorMsg = 'Please check:\n\n1. App ID is correct in agoraConfig.js\n2. Project is active in Agora Console\n3. Wait 2-3 minutes for new projects to activate';
          } else if (result === -109 || result === 109) {
            errorTitle = 'Token Error';
            errorMsg = '⚠️ App Certificate is ENABLED but no token provided.\n\nTo fix this issue:\n\n1. Go to console.agora.io\n2. Select your project\n3. Click "Configure"\n4. DISABLE "Primary Certificate"\n5. Save and wait 2 minutes\n\nOR\n\nRun token server:\ncd server\nnode agoraTokenServer.js\n\nThen update tokenServerUrl in agoraConfig.js';
          } else if (result === -110 || result === 110) {
            errorTitle = 'Connection Timeout';
            errorMsg = 'Failed to join the voice channel. Please check:\n\n1. Your internet connection\n2. Agora App Certificate is DISABLED (for testing)\n   - Go to console.agora.io\n   - Select project → Configure\n   - Disable Primary Certificate\n   - Wait 2 minutes\n\n3. Or run token server if you need certificate enabled';
          }
          
          Alert.alert(errorTitle, errorMsg);
        }

        // Add user to call participants
        console.log('[Agora] Adding user to room participants');
        
        // Ensure we have valid user data
        if (!currentUser.id || !currentUser.name) {
          console.log('[Agora] Invalid user data:', currentUser);
          Alert.alert(
            'Error', 
            'Unable to join voice room. User information is missing.\n\nPlease ensure your profile is set up correctly.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        console.log('[Agora] Joining with user:', { id: currentUser.id, name: currentUser.name });
        
        // Add to audio_calls room (for voice chat rooms from community)
        const roomRef = doc(db, 'audio_calls', communityId, 'rooms', actualRoomId);
        const roomSnap = await getDoc(roomRef);
        
        if (roomSnap.exists()) {
          const roomData = roomSnap.data();
          const participants = roomData.participants || [];
          
          // Check if already joined
          const alreadyJoined = participants.some(p => p.userId === currentUser.id);
          
          if (!alreadyJoined) {
            await updateDoc(roomRef, {
              participants: [...participants, {
                userId: currentUser.id,
                userName: currentUser.name,
                profileImage: currentUser.profileImage || null,
                joinedAt: new Date().toISOString(),
                isMuted: false,
                isSpeaking: false,
              }],
              updatedAt: new Date().toISOString(),
            });
          }
        }
        
        console.log('[Agora] Successfully joined room');
        setIsCallActive(true);
      } catch (error) {
        console.log('[Agora] ❌ Init error:', error);
        console.log('[Agora] Error details:', JSON.stringify(error, null, 2));
        
        let errorMessage = 'Failed to initialize audio call';
        
        if (error.message) {
          errorMessage = error.message;
        }
        
        // Check if it's a native module error
        if (error.message && error.message.includes('null is not an object')) {
          errorMessage = 'Agora SDK requires a development build.\n\nRun: npx expo run:android';
        }
        
        Alert.alert(
          'Initialization Failed', 
          errorMessage,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    };

    initAgora();

    // Cleanup
    return () => {
      if (engine) {
        engine.leaveChannel();
        engine.release();
        console.log('[Agora] Cleanup complete');
      }

      // Remove from Firebase
      if (currentUser?.id) {
        // db is now imported globally
        const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
        getDoc(roomRef).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const updatedParticipants = (data.participants || []).filter(
              (p) => p.userId !== currentUser.id
            );

            if (updatedParticipants.length === 0) {
              // Only delete if user is the creator
              if (data.createdBy === currentUser.id) {
                deleteDoc(roomRef).catch(err => {
                  console.log('[Agora] Error deleting room:', err.code);
                });
              } else {
                // Just update to empty participants
                updateDoc(roomRef, {
                  participants: [],
                  updatedAt: serverTimestamp(),
                }).catch(err => {
                  console.log('[Agora] Error updating room:', err.code);
                });
              }
            } else {
              updateDoc(roomRef, {
                participants: updatedParticipants,
                updatedAt: serverTimestamp(),
              }).catch(err => {
                console.log('[Agora] Error updating participants:', err.code);
              });
            }
          }
        }).catch(err => {
          console.log('[Agora] Error in cleanup:', err.code);
        });
      }
    };
  }, [currentUser?.id, communityId, callId]);

  // Listen for participants updates from voice room
  useEffect(() => {
    if (!communityId || !actualRoomId) return;

    const roomRef = doc(db, 'audio_calls', communityId, 'rooms', actualRoomId);

    const unsubscribe = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const participantsList = data.participants || [];
          
          // If room ended or inactive
          if (!data.isActive) {
            console.log('[Agora] Room ended');
            Alert.alert('Room Ended', 'The voice room has been closed', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
            return;
          }
          
          console.log('[Agora] Participants updated:', participantsList.length);
          participantsList.forEach(p => {
            console.log(`[Agora] Participant: ${p.userName || 'Unknown'}, Image: ${p.profileImage || 'none'}`);
          });
          setParticipants(participantsList);

          // Initialize animations
          participantsList.forEach((p) => {
            if (p.userId && !pulseAnims[p.userId]) {
              pulseAnims[p.userId] = new Animated.Value(1);
            }
          });
          
          setIsCallActive(data.isActive);
        } else {
          // Room was deleted
          console.log('[Agora] Room no longer exists');
          Alert.alert('Room Ended', 'This voice room has been closed', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        }
      },
      (error) => {
        console.log('[Agora] Error in room snapshot listener:', error.code);
      }
    );

    return () => unsubscribe();
  }, [communityId, actualRoomId]);

  // Listen for chat messages
  useEffect(() => {
    if (!communityId || !actualRoomId) return;

    // Listen to chat messages in audio_calls room subcollection
    const chatRef = collection(db, 'audio_calls', communityId, 'rooms', actualRoomId, 'chat');
    const q = query(chatRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        // Only show messages from users currently in participants
        const participantIds = participants.map(p => p.userId);
        const filteredMessages = messages.filter(msg => participantIds.includes(msg.senderId));
        setChatMessages(filteredMessages);

        // Update unread count if chat is closed
        if (!showChat && filteredMessages.length > 0) {
          const lastMessage = filteredMessages[filteredMessages.length - 1];
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
      },
      (error) => {
        console.log('[Agora] Error in chat snapshot listener:', error.code);
      }
    );

    return () => unsubscribe();
  }, [communityId, actualRoomId, showChat, currentUser?.id, participants]);

  // Reset unread count when chat opens
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

  // Call duration timer
  useEffect(() => {
    if (!isCallActive) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCallActive]);

  // Toggle mute
  const toggleMute = async () => {
    if (!agoraEngine) return;

    try {
      const newMutedState = !isMuted;
      await agoraEngine.muteLocalAudioStream(newMutedState);
      setIsMuted(newMutedState);
      console.log('[Agora] Mute:', newMutedState);
    } catch (e) {
      console.log('[Agora] Error toggling mute:', e);
    }
  };

  // Toggle speaker
  const toggleSpeaker = async () => {
    if (!agoraEngine) return;

    try {
      const newSpeakerState = !isSpeakerOn;
      await agoraEngine.setEnableSpeakerphone(newSpeakerState);
      setIsSpeakerOn(newSpeakerState);
      console.log('[Agora] Speaker:', newSpeakerState);
    } catch (e) {
      console.log('[Agora] Error toggling speaker:', e);
    }
  };

  // End call
  const endCall = async () => {
    try {
      const { leaveGroupCall } = require('./callHelpers');
      
      // Check if user is the creator
      const callRef = doc(db, 'calls', callId);
      const callSnap = await getDoc(callRef);
      
      if (callSnap.exists()) {
        const data = callSnap.data();
        const isCreator = data.callerId === currentUser?.id;
        
        if (isCreator) {
          // Creator leaving - offer to end session
          Alert.alert(
            'End Voice Call?',
            'You started this call. Do you want to end it for everyone?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Just Leave',
                onPress: async () => {
                  if (agoraEngine) {
                    await agoraEngine.leaveChannel();
                  }
                  await leaveGroupCall(callId, currentUser.id);
                  
                  // Update message status to ended since creator is leaving
                  try {
                    // Try community_chats first
                    const messagesRef = collection(db, 'community_chats', communityId, 'messages');
                    const q = query(messagesRef, where('roomId', '==', actualRoomId));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                      const messageDoc = snapshot.docs[0];
                      await updateDoc(messageDoc.ref, { isActive: false });
                    } else {
                      // Try conversations collection
                      // Only check conversations where current user is a participant
                      const conversationsRef = collection(db, 'conversations');
                      const userConversationsQuery = query(
                        conversationsRef,
                        where('participants', 'array-contains', currentUser.id)
                      );
                      const conversationsSnapshot = await getDocs(userConversationsQuery);
                      
                      for (const convDoc of conversationsSnapshot.docs) {
                        const convMessagesRef = collection(db, 'conversations', convDoc.id, 'messages');
                        const convQuery = query(convMessagesRef, where('roomId', '==', actualRoomId));
                        const convSnapshot = await getDocs(convQuery);
                        
                        if (!convSnapshot.empty) {
                          const messageDoc = convSnapshot.docs[0];
                          await updateDoc(messageDoc.ref, { isActive: false }).catch(err => 
                            console.log('[Agora] Error updating message:', err)
                          );
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    console.log('[Agora] Error updating message status on leave:', e);
                  }
                  
                  navigation.goBack();
                },
              },
              {
                text: 'End For All',
                style: 'destructive',
                onPress: () => {
                  endSession();
                },
              },
            ]
          );
        } else {
          // Regular participant leaving
          Alert.alert('Leave Call', 'Are you sure you want to leave this call?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                if (agoraEngine) {
                  await agoraEngine.leaveChannel();
                }
                await leaveGroupCall(callId, currentUser.id);
                navigation.goBack();
              },
            },
          ]);
        }
      } else {
        // Call doesn't exist, just leave
        if (agoraEngine) {
          await agoraEngine.leaveChannel();
        }
        navigation.goBack();
      }
    } catch (error) {
      console.log('Error leaving call:', error);
      if (agoraEngine) {
        agoraEngine.leaveChannel();
      }
      navigation.goBack();
    }
  };

  // End session (admin only)
  const endSession = () => {
    Alert.alert(
      'End Call For Everyone',
      'Are you sure you want to end this call for all participants? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Call',
          style: 'destructive',
          onPress: async () => {
            try {
              const { endGroupRoom } = require('./callHelpers');
              await endGroupRoom(communityId, actualRoomId, callDuration);
              // Update the corresponding message to isActive: false in both community_chats and conversations
              try {
                // Find the message with roomId == actualRoomId
                // Try community_chats first
                const messagesRef = collection(db, 'community_chats', communityId, 'messages');
                const q = query(messagesRef, where('roomId', '==', actualRoomId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                  const messageDoc = snapshot.docs[0];
                  await updateDoc(messageDoc.ref, { isActive: false });
                  console.log('[Agora] Updated message status to ended in community_chats');
                } else {
                  // Try conversations collection (one-on-one chat)
                  // Only check conversations where current user is a participant
                  const conversationsRef = collection(db, 'conversations');
                  const userConversationsQuery = query(
                    conversationsRef,
                    where('participants', 'array-contains', currentUser.id)
                  );
                  const conversationsSnapshot = await getDocs(userConversationsQuery);
                  
                  for (const convDoc of conversationsSnapshot.docs) {
                    const convMessagesRef = collection(db, 'conversations', convDoc.id, 'messages');
                    const convQuery = query(convMessagesRef, where('roomId', '==', actualRoomId));
                    const convSnapshot = await getDocs(convQuery);
                    
                    if (!convSnapshot.empty) {
                      const messageDoc = convSnapshot.docs[0];
                      await updateDoc(messageDoc.ref, { isActive: false }).catch(err => 
                        console.log('[Agora] Error updating message:', err)
                      );
                      console.log('[Agora] Updated message status to ended in conversations');
                      break;
                    }
                  }
                }
              } catch (e) {
                console.log('[Agora] Error updating message status:', e);
              }
              if (agoraEngine) {
                await agoraEngine.leaveChannel();
              }
              // Do not navigate away; stay on the current community screen after ending the call
            } catch (error) {
              console.log('[Agora] Error ending session:', error);
              Alert.alert('Error', 'Failed to end the call. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentUser) return;

    try {
      // Store chat in audio_calls room subcollection
      const chatRef = collection(db, 'audio_calls', communityId, 'rooms', actualRoomId, 'chat');
      
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

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // Render participant
  const renderParticipant = ({ item }) => {
    const isSpeaking = speakingUsers.includes(item.userId);
    const isCurrentUser = item.userId === currentUser?.id;
    const pulseAnim = pulseAnims[item.userId] || new Animated.Value(1);
    
    // Get display name with fallback
    const displayName = isCurrentUser ? 'You' : (item.userName || 'User');
    const avatarLetter = displayName.charAt(0).toUpperCase();

    return (
      <View style={styles.participantItem}>
        <Animated.View
          style={[
            styles.avatarContainer,
            isSpeaking && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {item.profileImage ? (
            <Image
              source={{ uri: item.profileImage }}
              style={styles.avatar}
              resizeMode="cover"
              onError={(e) => console.log('[Agora] Image load error:', displayName, e.nativeEvent.error)}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {avatarLetter}
              </Text>
            </View>
          )}
          {isSpeaking && <View style={styles.speakingIndicator} />}
          {item.isMuted && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={14} color="#fff" />
            </View>
          )}
        </Animated.View>
        <Text style={styles.participantName} numberOfLines={1}>
          {displayName}
        </Text>
        {!item.isMuted && (
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#7C3AED', '#5B21B6', '#4C1D95']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={endSession} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" onPress={async () => {
              await endSession();
              navigation.replace('CommunityDetail', { communityId });
            }} />
          </TouchableOpacity>
          <View style={styles.participantCount}>
            <Text style={styles.participantCountText}>
              {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
            </Text>
          </View>
        </View>

        {/* Voice Chat Header */}
        <View style={styles.voiceChatHeader}>
          <View style={styles.voiceChatBadge}>
            <MaterialCommunityIcons name="waveform" size={18} color="#fff" />
            <Text style={styles.voiceChatText}>Voice Chat</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              Alert.alert(
                'Voice Settings',
                'Audio Quality: High\nEcho Cancellation: On\nNoise Suppression: On',
                [{ text: 'OK' }]
              );
            }}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.endSessionButton}
            onPress={endSession}
          >
            <MaterialCommunityIcons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.powerButton}
            onPress={endSession}
          >
            <Ionicons name="power" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Status Indicator */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, isCallActive && styles.statusActive]} />
          <Text style={styles.statusText}>
            {isCallActive ? 'Connected via Agora WebRTC' : 'Connecting...'}
          </Text>
        </View>

        {/* Participants */}
        <View style={styles.participantsContainer}>
          <FlatList
            data={participants.filter((participant, index, self) => 
              index === self.findIndex(p => p.userId === participant.userId)
            )}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.userId}
            numColumns={3}
            contentContainerStyle={styles.participantsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="account-group"
                  size={64}
                  color="rgba(255,255,255,0.3)"
                />
                <Text style={styles.emptyText}>Waiting for others...</Text>
              </View>
            }
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setShowChat(!showChat)}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.micButton, isMuted && styles.micButtonMuted]}
            onPress={toggleMute}
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
            <Ionicons name="call" size={28} color="#fff" onPress={endSession} />
          </TouchableOpacity>


          <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
            <MaterialCommunityIcons
              name={isSpeakerOn ? 'volume-high' : 'volume-off'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

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
                      color={chatInput.trim() ? '#00FFFF' : '#666'} 
                    />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantCount: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  participantCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  voiceChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  voiceChatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    flex: 1,
  },
  voiceChatText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  powerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  participantsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  participantsList: {
    flexGrow: 1,
  },
  participantItem: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: width / 3,
    paddingHorizontal: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  speakingIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#7C3AED',
  },
  mutedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 16,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    backgroundColor: '#10B981',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  micButtonMuted: {
    backgroundColor: '#EF4444',
  },
  endCallButton: {
    backgroundColor: '#EF4444',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  endSessionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
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
    backgroundColor: '#00FFFF',
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    backgroundColor: '#333',
    borderBottomLeftRadius: 4,
  },
  chatSenderName: {
    color: '#00FFFF',
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

