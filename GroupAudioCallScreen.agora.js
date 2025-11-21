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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import RtcEngine, { ChannelProfileType, AudioProfileType } from 'react-native-agora';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app as firebaseApp } from './firebaseConfig';
import { AGORA_CONFIG, generateChannelName } from './agoraConfig';

const { width } = Dimensions.get('window');

export default function GroupAudioCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, roomId, groupTitle } = route.params || {};

  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [agoraEngine, setAgoraEngine] = useState(null);

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
            });
          } else {
            setCurrentUser({
              id: userId,
              name: auth.currentUser.displayName || 'User',
              profileImage: null,
            });
          }
        }
      } catch (e) {
        console.log('[Agora] Error fetching user:', e);
      }
    };

    fetchCurrentUser();
  }, []);

  // Initialize Agora and join channel
  useEffect(() => {
    if (!currentUser?.id || !communityId || !roomId) return;

    let engine = null;

    const initAgora = async () => {
      try {
        // Request microphone permission on Android
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
        }

        // Create Agora engine
        engine = await RtcEngine.create(AGORA_CONFIG.appId);
        setAgoraEngine(engine);

        // Enable audio
        await engine.enableAudio();

        // Set channel profile for voice call
        await engine.setChannelProfile(ChannelProfileType.Communication);

        // Set audio profile for high quality
        await engine.setAudioProfile(
          AudioProfileType.MusicStandard,
          AGORA_CONFIG.audioScenario
        );

        // Enable speaker by default
        await engine.setEnableSpeakerphone(true);

        // Set up event handlers
        engine.addListener('UserJoined', (uid) => {
          console.log('[Agora] 👤 User joined:', uid);
        });

        engine.addListener('UserOffline', (uid) => {
          console.log('[Agora] 👋 User left:', uid);
        });

        engine.addListener('JoinChannelSuccess', (channel, uid) => {
          console.log('[Agora] ✓ Joined channel:', channel, 'as uid:', uid);
          setIsCallActive(true);
        });

        engine.addListener('AudioVolumeIndication', (speakers) => {
          const speaking = speakers
            .filter((s) => s.volume > 50)
            .map((s) => s.uid);
          setSpeakingUsers(speaking);
        });

        engine.addListener('Error', (error) => {
          console.log('[Agora] ❌ Error:', error);
        });

        // Enable audio volume indication
        await engine.enableAudioVolumeIndication(300, 3, false);

        // Generate channel name and join
        const channelName = generateChannelName(communityId, roomId);
        await engine.joinChannel(AGORA_CONFIG.token, channelName, null, 0);

        console.log('[Agora] ✓ Engine initialized');

        // Add user to Firebase participants
        const db = getFirestore(firebaseApp);
        const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
          const data = roomSnap.data();
          const existingParticipants = data.participants || [];
          const userExists = existingParticipants.some(p => p.userId === currentUser.id);

          if (!userExists) {
            await updateDoc(roomRef, {
              participants: arrayUnion({
                userId: currentUser.id,
                userName: currentUser.name,
                profileImage: currentUser.profileImage,
                joinedAt: new Date().toISOString(),
                isMuted: false,
                isSpeaking: false,
              }),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        console.log('[Agora] ❌ Init error:', error);
        Alert.alert('Error', 'Failed to initialize audio call');
      }
    };

    initAgora();

    // Cleanup
    return () => {
      if (engine) {
        engine.leaveChannel();
        engine.destroy();
        console.log('[Agora] Cleanup complete');
      }

      // Remove from Firebase
      if (currentUser?.id) {
        const db = getFirestore(firebaseApp);
        const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
        getDoc(roomRef).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const updatedParticipants = (data.participants || []).filter(
              (p) => p.userId !== currentUser.id
            );

            if (updatedParticipants.length === 0) {
              deleteDoc(roomRef);
            } else {
              updateDoc(roomRef, {
                participants: updatedParticipants,
                updatedAt: serverTimestamp(),
              });
            }
          }
        });
      }
    };
  }, [currentUser?.id, communityId, roomId]);

  // Listen for participants updates
  useEffect(() => {
    if (!communityId || !roomId) return;

    const db = getFirestore(firebaseApp);
    const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);

    const unsubscribe = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setParticipants(data.participants || []);

        // Initialize animations
        (data.participants || []).forEach((p) => {
          if (!pulseAnims[p.userId]) {
            pulseAnims[p.userId] = new Animated.Value(1);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [communityId, roomId]);

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
  const endCall = () => {
    Alert.alert('End Call', 'Are you sure you want to leave the call?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          if (agoraEngine) {
            agoraEngine.leaveChannel();
          }
          navigation.goBack();
        },
      },
    ]);
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
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.userName.charAt(0).toUpperCase()}
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
          {isCurrentUser ? 'You' : item.userName}
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.participantCount}>
            <Text style={styles.participantCountText}>
              {participants.length} of {participants.length}
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
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.powerButton}>
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
                <Text style={styles.emptyText}>Waiting for others...</Text>
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
            style={[styles.controlButton, styles.micButton, isMuted && styles.micButtonMuted]}
            onPress={toggleMute}
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
            <Ionicons name="call" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="remove-outline" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
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
});
