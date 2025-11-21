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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app as firebaseApp } from './firebaseConfig';
import { uploadAudioAsync } from './cloudinaryConfig';

const { width, height } = Dimensions.get('window');

export default function GroupAudioCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, roomId, groupTitle } = route.params || {};

  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const recordingRef = useRef(null);
  const isMutedRef = useRef(false);
  const audioChunkIntervalRef = useRef(null);
  const activeSoundsRef = useRef({});
  const uploadFailureCountRef = useRef(0);
  const [audioChunkInterval, setAudioChunkInterval] = useState(null);
  const [playingAudioChunks, setPlayingAudioChunks] = useState({});
  const [playedAudioUrls, setPlayedAudioUrls] = useState({});
  const [speakingUsers, setSpeakingUsers] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);

  // Animation values for speaking indicators
  const pulseAnims = useRef({}).current;

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const auth = getAuth(firebaseApp);
        const db = getFirestore(firebaseApp);

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
              auth.currentUser.displayName ||
              'User';

            setCurrentUser({
              id: userId,
              name: userName,
              profileImage: userData.profileImage || userData.avatar || null,
              email: userData.email || auth.currentUser.email,
            });
          } else {
            setCurrentUser({
              id: userId,
              name: auth.currentUser.displayName || 'User',
              profileImage: null,
              email: auth.currentUser.email,
            });
          }
        }
      } catch (e) {
        console.log('Error fetching current user:', e);
      }
    };

    fetchCurrentUser();
  }, []);

  // Join audio room when component mounts
  useEffect(() => {
    if (!currentUser?.id || !communityId || !roomId) return;

    const joinRoom = async () => {
      try {
        const db = getFirestore(firebaseApp);
        const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);

        const now = new Date().toISOString();
        
        // Check if user already exists to prevent duplicates
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          const existingParticipants = data.participants || [];
          const userExists = existingParticipants.some(p => p.userId === currentUser.id);
          
          if (!userExists) {
            // Add current user to participants only if not already there
            await updateDoc(roomRef, {
              participants: arrayUnion({
                userId: currentUser.id,
                userName: currentUser.name,
                profileImage: currentUser.profileImage,
                joinedAt: now,
                isMuted: false,
                isSpeaking: false,
              }),
              updatedAt: serverTimestamp(),
            });
          } else {
            console.log('[Join] User already in participants, skipping add');
          }
        }

        setIsCallActive(true);
      } catch (e) {
        console.log('Error joining room:', e);
        Alert.alert('Error', 'Failed to join audio call');
      }
    };

    joinRoom();

    // Leave room on unmount
    return () => {
      if (currentUser?.id && communityId && roomId) {
        const leaveRoom = async () => {
          try {
            const db = getFirestore(firebaseApp);
            const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (roomSnap.exists()) {
              const data = roomSnap.data();
              const updatedParticipants = (data.participants || []).filter(
                (p) => p.userId !== currentUser.id
              );

              if (updatedParticipants.length === 0) {
                // Delete room if no participants left
                await deleteDoc(roomRef);
              } else {
                // Remove current user from participants
                await updateDoc(roomRef, {
                  participants: updatedParticipants,
                  updatedAt: serverTimestamp(),
                });
              }
            }

            // Clean up user's audio chunk
            const audioChunkRef = doc(
              db,
              'audio_calls',
              communityId,
              'rooms',
              roomId,
              'audioChunks',
              currentUser.id
            );
            await deleteDoc(audioChunkRef).catch(() => {});
          } catch (e) {
            console.log('Error leaving room:', e);
          }
        };

        leaveRoom();
      }
    };
  }, [currentUser?.id, communityId, roomId]);

  // Auto-start recording when call becomes active
  useEffect(() => {
    if (isCallActive && !isMuted && currentUser?.id) {
      console.log('[Recording] Call active, user unmuted - starting recording...');
      startRecording().catch(err => {
        console.error('[Recording] Failed to auto-start:', err.message);
      });
    }

    return () => {
      if (recording) {
        console.log('[Recording] Stopping recording on cleanup');
        stopRecording();
      }
    };
  }, [isCallActive, currentUser?.id]);

  // Listen for participants updates
  useEffect(() => {
    if (!communityId || !roomId) return;

    const db = getFirestore(firebaseApp);
    const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);

    const unsubscribe = onSnapshot(
      roomRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const participantsList = data.participants || [];
          setParticipants(participantsList);

          // Initialize pulse animations for new participants
          participantsList.forEach((p) => {
            if (!pulseAnims[p.userId]) {
              pulseAnims[p.userId] = new Animated.Value(1);
            }
          });
        } else {
          // Room deleted, end call
          setIsCallActive(false);
          Alert.alert('Call Ended', 'The audio call has ended');
          navigation.goBack();
        }
      },
      (error) => {
        console.log('Room snapshot permission error:', error.message);
        Alert.alert(
          'Firebase Permission Error',
          'Please update Firebase Firestore security rules.\n\nCheck FIREBASE_SETUP_REQUIRED.md file in your project.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    );

    return () => unsubscribe();
  }, [communityId, roomId]);

  // Listen for audio chunks from other participants
  useEffect(() => {
    if (!communityId || !roomId || !currentUser?.id) return;

    const db = getFirestore(firebaseApp);
    const audioChunksCol = collection(
      db,
      'audio_calls',
      communityId,
      'rooms',
      roomId,
      'audioChunks'
    );

    const unsubscribe = onSnapshot(
      audioChunksCol,
      (snapshot) => {
        const speakingList = [];
        
        console.log(`[Audio] Received ${snapshot.docs.length} audio chunk(s)`);

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const userId = docSnap.id;

          console.log(`[Audio] Processing chunk from ${userId}:`, {
            isSpeaking: data.isSpeaking,
            hasAudioUrl: !!data.audioUrl,
            isCurrentUser: userId === currentUser.id
          });

          // Don't process current user's own audio
          if (userId === currentUser.id) return;

          // Check if user is speaking
          if (data.isSpeaking && data.audioUrl) {
            const participant = participants.find((p) => p.userId === userId);
            speakingList.push({
              userId: userId,
              userName: participant?.userName || 'User',
            });

            // Check if this is a new audio chunk
            const lastPlayedUrl = playedAudioUrls[userId];
            const chunkTimestamp = data.timestamp?.toDate?.() || data.timestamp;
            const now = new Date();
            
            let isRecentChunk = true;
            if (chunkTimestamp) {
              try {
                const chunkDate = chunkTimestamp instanceof Date ? chunkTimestamp : new Date(chunkTimestamp);
                const timeDiff = now - chunkDate;
                isRecentChunk = timeDiff < 4000; // 4s window - balance between freshness and reliability
                console.log(`[Audio] Chunk age: ${timeDiff}ms, isRecent: ${isRecentChunk}`);
              } catch (e) {
                console.log('[Audio] Error parsing timestamp:', e);
              }
            }

            const isNewChunk = data.audioUrl !== lastPlayedUrl;
            console.log(`[Audio] IsNew: ${isNewChunk}, IsRecent: ${isRecentChunk}, URL: ${data.audioUrl?.substring(0, 50)}...`);

            if (data.audioUrl && isNewChunk && isRecentChunk) {
              console.log(`[Audio] ✓ Playing audio from ${participant?.userName || userId}`);
              setPlayedAudioUrls((prev) => ({
                ...prev,
                [userId]: data.audioUrl,
              }));

              // Play audio chunk
              playAudioChunk(userId, data.audioUrl);
            }
          }
        });

        setSpeakingUsers(speakingList);
      },
      (error) => {
        console.log('AudioChunks snapshot permission error:', error.message);
        // Don't show alert here as it would be too intrusive during call
        // The main room listener will handle the alert
      }
    );

    return () => unsubscribe();
  }, [communityId, roomId, currentUser?.id, participants]);

  // Animate speaking indicators
  useEffect(() => {
    speakingUsers.forEach((user) => {
      const anim = pulseAnims[user.userId];
      if (anim) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    });

    // Stop animations for users who stopped speaking
    participants.forEach((p) => {
      const isSpeaking = speakingUsers.some((u) => u.userId === p.userId);
      if (!isSpeaking && pulseAnims[p.userId]) {
        pulseAnims[p.userId].setValue(1);
      }
    });
  }, [speakingUsers, participants]);

  // Call duration timer
  useEffect(() => {
    if (!isCallActive) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCallActive]);

  // Play audio chunk
  const playAudioChunk = async (userId, audioUrl) => {
    if (!audioUrl) {
      console.log('[Audio] No audio URL provided');
      return;
    }

    console.log(`[Audio] Starting playback for ${userId}: ${audioUrl.substring(0, 60)}...`);

    try {
      // Don't stop previous audio - let chunks play sequentially for continuity
      // Only stop if a chunk is still playing when next arrives (defensive)
      if (playingAudioChunks[userId]) {
        try {
          const status = await playingAudioChunks[userId].getStatusAsync();
          if (status.isPlaying) {
            console.log(`[Audio] Previous chunk still playing, will overlap`);
            // Don't stop - let it finish naturally for smooth transition
          }
        } catch (error) {
          console.log('[Audio] Error checking previous audio status:', error.message);
        }
      }

      // Configure audio mode for playback through speaker
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false, // Don't duck for smoother audio
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      // Create and play new sound with optimized settings for streaming
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        {
          shouldPlay: true,
          volume: 1.0,
          isMuted: false,
          rate: 1.0,
          shouldCorrectPitch: true,
          isLooping: false,
          progressUpdateIntervalMillis: 100, // Smooth progress updates
        },
        (status) => {
          // Auto-cleanup when finished - safe for threading
          if (status.didJustFinish) {
            try {
              // Defer to main thread to avoid ExoPlayer threading issues
              setTimeout(() => {
                sound.unloadAsync().catch(() => {});
              }, 0);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        },
        false // Don't download entire file first - stream it
      );

      console.log(`[Audio] ✓ Sound created and playing for ${userId}`);

      // Track this playing audio
      setPlayingAudioChunks((prev) => ({
        ...prev,
        [userId]: sound,
      }));

      // Cleanup when finished
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            console.log(`[Audio] Playback finished for ${userId}`);
            setPlayingAudioChunks((prev) => {
              const updated = { ...prev };
              delete updated[userId];
              return updated;
            });
            sound.unloadAsync().catch(() => {});
          } else if (status.error) {
            console.error(`[Audio] Playback error for ${userId}:`, status.error);
          }
        }
      });
    } catch (error) {
      console.error('[Audio] ✗ Error playing audio chunk:', error.message);
      console.error('[Audio] Error details:', {
        userId,
        audioUrl: audioUrl.substring(0, 60)
      });
      setPlayingAudioChunks((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    }
  };

  // Toggle microphone
  const toggleMute = async () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    isMutedRef.current = newMutedState;
    console.log(`[Recording] Mute toggled: ${newMutedState ? 'MUTED' : 'UNMUTED'}`);

    if (newMutedState) {
      // Stop recording
      await stopRecording();
    } else {
      // Stop recording first (if any exists)
      await stopRecording();
      // Minimal wait for instant unmute response
      await new Promise(resolve => setTimeout(resolve, 100));
      // Start recording
      await startRecording();
    }

    // Update participant's muted status in Firestore
    try {
      const db = getFirestore(firebaseApp);
      const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const updatedParticipants = (data.participants || []).map((p) => {
          if (p.userId === currentUser.id) {
            return { ...p, isMuted: newMutedState };
          }
          return p;
        });

        await updateDoc(roomRef, {
          participants: updatedParticipants,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.log('Error updating mute status:', e);
    }
  };

  // Toggle speaker
  const toggleSpeaker = async () => {
    const newSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(newSpeakerState);

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: !newSpeakerState,
      });
    } catch (e) {
      console.log('Error toggling speaker:', e);
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      // Check if recording already exists
      if (recordingRef.current || recording) {
        console.log('[Recording] Recording already active, skipping start');
        return;
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Permission to record audio is required!'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      recordingRef.current = recording;
      setIsRecording(true);
      console.log('[Recording] Recording started successfully');

      // Start recording chunks every 800ms (optimal for reliable realtime audio)
      const interval = setInterval(async () => {
        console.log('[Recording] \u23f0 Interval tick - attempting capture...');
        await captureAndUploadAudioChunk();
      }, 800); // 800ms = reliable audio data + realtime feel

      audioChunkIntervalRef.current = interval;
      setAudioChunkInterval(interval);
      console.log('[Recording] \u2705 Chunk upload interval started (800ms)');
    } catch (err) {
      console.error('[Recording] \u274c Failed to start recording:', err.message);
      Alert.alert('Error', 'Failed to start microphone');
      setIsMuted(true);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    console.log('[Recording] Stopping recording...');
    
    if (recording || recordingRef.current) {
      try {
        const recordingToStop = recordingRef.current || recording;
        await recordingToStop.stopAndUnloadAsync();
        setRecording(null);
        recordingRef.current = null;
        console.log('[Recording] ✓ Recording stopped and unloaded');
      } catch (error) {
        console.error('[Recording] Error stopping recording:', error);
      }
    }

    if (audioChunkIntervalRef.current) {
      clearInterval(audioChunkIntervalRef.current);
      audioChunkIntervalRef.current = null;
      setAudioChunkInterval(null);
      console.log('[Recording] ✓ Interval cleared');
    }

    setIsRecording(false);

    // Update Firestore to mark user as not speaking
    try {
      const db = getFirestore(firebaseApp);
      const audioChunkRef = doc(
        db,
        'audio_calls',
        communityId,
        'rooms',
        roomId,
        'audioChunks',
        currentUser.id
      );

      await setDoc(audioChunkRef, {
        isSpeaking: false,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.log('Error updating speaking status:', e);
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
  };

  // Capture and upload audio chunk
  const captureAndUploadAudioChunk = async () => {
    const currentRecording = recordingRef.current;
    const currentlyMuted = isMutedRef.current;
    
    if (!currentRecording || !currentUser?.id || currentlyMuted) {
      console.log('[Upload] Skipping:', { 
        hasRecording: !!currentRecording, 
        hasUser: !!currentUser?.id, 
        isMuted: currentlyMuted 
      });
      return;
    }

    console.log('[Upload] \u25b6\ufe0f Starting chunk capture...');

    try {
      console.log('[Upload] Getting recording status...');
      
      // Check recording status BEFORE stopping
      const status = await currentRecording.getStatusAsync();
      console.log('[Upload] Status:', {
        isRecording: status.isRecording,
        duration: status.durationMillis + 'ms',
      });

      // Skip if not actually recording
      if (!status.isRecording) {
        console.log('[Upload] ⚠️ Skipping - recording not active');
        return;
      }
      
      // Require minimum audio data (100ms) to avoid "no valid audio data" errors
      if (status.durationMillis < 100) {
        console.log('[Upload] ⚠️ Too short, skipping');
        return;
      }

      // Get the URI before stopping
      const uri = currentRecording.getURI();
      console.log('[Upload] Recording URI:', uri);
      
      // Stop and unload current recording
      await currentRecording.stopAndUnloadAsync();
      
      // Clear the ref immediately
      recordingRef.current = null;
      setRecording(null);

      if (uri && status.durationMillis >= 100) {
        console.log('[Upload] Audio chunk captured, uploading to Cloudinary...');

        // Retry logic with faster backoff for streaming
        let uploadSuccess = false;
        let audioUrl = null;
        const maxRetries = 2; // Reduce retries for streaming (faster fail)
        
        for (let attempt = 1; attempt <= maxRetries && !uploadSuccess; attempt++) {
          try {
            
            // Upload chunk to Cloudinary with reasonable timeout
            const uploadPromise = uploadAudioAsync(uri, {
              folder: 'audio_call_chunks',
              resource_type: 'video',
            });

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Upload timeout')), 6000) // 6s for reliable upload
            );

            audioUrl = await Promise.race([uploadPromise, timeoutPromise]);
            uploadSuccess = true;
            uploadFailureCountRef.current = 0; // Reset failure count on success
            console.log('[Upload] ✓ Uploaded');
          } catch (uploadError) {
            
            if (attempt < maxRetries) {
              const delayMs = 400; // Balanced retry delay
              await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
              // Final attempt failed - skip this chunk and continue
              console.error('[Upload] ✗ Chunk failed, continuing stream...');
            }
          }
        }        // If upload succeeded, save to Firestore
        if (uploadSuccess && audioUrl) {
          try {
            const db = getFirestore(firebaseApp);
            const audioChunkRef = doc(
              db,
              'audio_calls',
              communityId,
              'rooms',
              roomId,
              'audioChunks',
              currentUser.id
            );

            await setDoc(audioChunkRef, {
              audioUrl: audioUrl,
              timestamp: serverTimestamp(),
              isSpeaking: true,
              userName: currentUser.name,
            });

            console.log('[Upload] ✓ Audio chunk saved to Firestore');
          } catch (firestoreError) {
            console.error('[Upload] ✗ Firestore save failed:', firestoreError.message);
          }
        } else {
          uploadFailureCountRef.current += 1;
          console.error('[Upload] ✗ All upload attempts failed - skipping chunk');
          console.error(`[Upload] 📊 Consecutive failures: ${uploadFailureCountRef.current}`);
          
          if (uploadFailureCountRef.current >= 5) {
            console.error('[Upload] ⚠️ Too many failures - consider checking:');
            console.error('[Upload]   1. Internet connection');
            console.error('[Upload]   2. Cloudinary upload preset configuration');
            console.error('[Upload]   3. Audio file format compatibility');
          }
        }
      } else {
        console.log('[Upload] Skipping - recording too short or no URI');
      }

      // Restart recording with safe delay for audio system
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      recordingRef.current = newRecording;
      console.log('[Upload] Recording restarted for next chunk');
    } catch (error) {
      // Handle "no valid audio data" errors gracefully
      if (error.message.includes('no valid audio data')) {
        console.log('[Upload] No audio data captured (silence), continuing...');
      } else {
        console.error('[Upload] ✗ Error capturing audio chunk:', error.message);
      }

      // Recovery delay for audio system stability
      await new Promise(resolve => setTimeout(resolve, 150));

      // Restart recording even if upload failed
      try {
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(newRecording);
        recordingRef.current = newRecording;
        console.log('[Upload] Recording restarted after error');
      } catch (err) {
        console.error('[Upload] Error restarting recording:', err.message);
      }
    }
  };

  // End call
  const endCall = async () => {
    Alert.alert('End Call', 'Are you sure you want to leave the call?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await stopRecording();
          setIsCallActive(false);

          // Remove user from participants
          try {
            const db = getFirestore(firebaseApp);
            const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (roomSnap.exists()) {
              const data = roomSnap.data();
              const updatedParticipants = (data.participants || []).filter(
                (p) => p.userId !== currentUser.id
              );

              if (updatedParticipants.length === 0) {
                // Delete room if no participants left
                await deleteDoc(roomRef);
              } else {
                await updateDoc(roomRef, {
                  participants: updatedParticipants,
                  updatedAt: serverTimestamp(),
                });
              }
            }

            // Clean up user's audio chunk
            const audioChunkRef = doc(
              db,
              'audio_calls',
              communityId,
              'rooms',
              roomId,
              'audioChunks',
              currentUser.id
            );
            await deleteDoc(audioChunkRef).catch(() => {});
          } catch (e) {
            console.log('Error leaving call:', e);
          }

          navigation.goBack();
        },
      },
    ]);
  };

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[Cleanup] Component unmounting - cleaning up resources');

      // Stop recording (async operations)
      try {
        stopRecording().catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }

      // Clear interval using ref
      if (audioChunkIntervalRef.current) {
        clearInterval(audioChunkIntervalRef.current);
        audioChunkIntervalRef.current = null;
      }

      // Clean up all playing audio - wrap in try/catch for thread safety
      try {
        Object.values(playingAudioChunks).forEach((sound) => {
          if (sound) {
            // Use setTimeout to defer to next tick (main thread)
            setTimeout(() => {
              sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
            }, 0);
          }
        });
      } catch (e) {
        // Ignore cleanup errors
      }

      // Clean up sounds tracked in ref - wrap in try/catch
      try {
        Object.values(activeSoundsRef.current).forEach((sound) => {
          if (sound) {
            setTimeout(() => {
              sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
            }, 0);
          }
        });
        activeSoundsRef.current = {};
      } catch (e) {
        // Ignore cleanup errors
      }

      // Clean up recording ref
      if (recordingRef.current) {
        setTimeout(() => {
          recordingRef.current?.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
        }, 0);
      }
    };
  }, []);  // Render participant item
  const renderParticipant = ({ item }) => {
    const isSpeaking = speakingUsers.some((u) => u.userId === item.userId);
    const isCurrentUser = item.userId === currentUser?.id;
    const pulseAnim = pulseAnims[item.userId] || new Animated.Value(1);

    return (
      <View style={styles.participantItem}>
        <Animated.View
          style={[
            styles.avatarContainer,
            isSpeaking && {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {item.profileImage ? (
            <Image
              source={{ uri: item.profileImage }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Active/Speaking Indicator - Green dot */}
          {isSpeaking && <View style={styles.speakingIndicator} />}
          {/* Muted Badge - Red microphone off icon */}
          {item.isMuted && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={14} color="#fff" />
            </View>
          )}
        </Animated.View>
        {/* Member name */}
        <Text style={styles.participantName} numberOfLines={1}>
          {isCurrentUser ? 'You' : item.userName}
        </Text>
        {/* Status badge below name */}
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
        {/* Close Button */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.participantCount}>
            <Text style={styles.participantCountText}>{participants.length} of {participants.length}</Text>
          </View>
        </View>

        {/* Voice Chat Header */}
        <View style={styles.voiceChatHeader}>
          <View style={styles.voiceChatBadge}>
            <MaterialCommunityIcons name="waveform" size={18} color="#fff" />
            <Text style={styles.voiceChatText}>Voice Chat</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </View>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.powerButton}>
            <Ionicons name="power" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Participants Grid */}
        <View style={styles.participantsContainer}>
          <FlatList
            data={participants}
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
                <Text style={styles.emptyText}>
                  Waiting for others to join...
                </Text>
              </View>
            }
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="mail-outline" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.micButton]}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
            <Ionicons name="call" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="remove-outline" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleSpeaker}
          >
            <MaterialCommunityIcons
              name={isSpeakerOn ? 'phone-in-talk' : 'phone-hangup'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
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
    borderWidth: 0,
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
  statusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
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
    borderWidth: 0,
  },
  micButton: {
    backgroundColor: '#10B981',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  endCallButton: {
    backgroundColor: '#EF4444',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
