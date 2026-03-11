import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { createAgoraRtcEngine } from 'react-native-agora';
import { getAuth } from 'firebase/auth';
import { app as firebaseApp } from './firebaseConfig';
import {
  getCallDetails,
  endCall,
  listenToCallStatus,
  CALL_STATUS,
} from './callHelpers';
import { AGORA_CONFIG } from './agoraConfig';

export default function CallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, isIncoming } = route.params || {};

  const [currentUser, setCurrentUser] = useState(null);
  const [callData, setCallData] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState(CALL_STATUS.RINGING);
  const [agoraEngine, setAgoraEngine] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef(null);

  // Fetch current user
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    if (auth.currentUser) {
      setCurrentUser({
        id: auth.currentUser.uid,
        name: auth.currentUser.displayName || 'User',
      });
    }
  }, []);

  // Load call data
  useEffect(() => {
    const loadCallData = async () => {
      try {
        const call = await getCallDetails(callId);
        if (call) {
          setCallData(call);
          setCallStatus(call.status);
          
          // Determine other user
          const isUserCaller = call.callerId === currentUser?.id;
          setOtherUser({
            id: isUserCaller ? call.receiverId : call.callerId,
            name: isUserCaller ? call.receiverName : call.callerName,
            image: isUserCaller ? call.receiverImage : call.callerImage,
          });
        }
      } catch (error) {
        console.error('Error loading call:', error);
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
      }
    };

    if (currentUser?.id) {
      loadCallData();
    }
  }, [currentUser, callId]);

  // Listen for call status changes
  useEffect(() => {
    if (!callId) return;

    const unsubscribe = listenToCallStatus(callId, (updatedCall) => {
      if (!updatedCall) {
        handleCallEnded();
        return;
      }

      setCallStatus(updatedCall.status);

      if (updatedCall.status === CALL_STATUS.ENDED || updatedCall.status === CALL_STATUS.DECLINED) {
        handleCallEnded();
      }
    });

    return () => unsubscribe();
  }, [callId]);

  // Initialize Agora when call is answered
  useEffect(() => {
    if (callStatus !== CALL_STATUS.ANSWERED || !callData?.channelName) return;

    let engine = null;

    const initAgora = async () => {
      try {
        // Request microphone permission
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Microphone permission is required');
            handleEndCall();
            return;
          }
        }

        console.log('[Call] Initializing Agora...');
        engine = createAgoraRtcEngine();
        await engine.initialize({
          appId: AGORA_CONFIG.appId,
        });

        setAgoraEngine(engine);

        // Register event handlers
        engine.registerEventHandler({
          onJoinChannelSuccess: (connection, elapsed) => {
            console.log('[Call] ✓ Joined channel successfully');
            startCallTimer();
          },
          onUserJoined: (connection, remoteUid, elapsed) => {
            console.log('[Call] ✓ Remote user joined:', remoteUid);
          },
          onUserOffline: (connection, remoteUid, reason) => {
            console.log('[Call] Remote user left:', remoteUid);
            handleCallEnded('Other user left the call');
          },
          onError: (err, msg) => {
            console.log('[Call] ❌ Error:', err, msg);
            if (err === 110) {
              Alert.alert(
                'Connection Error',
                'Please disable App Certificate in Agora Console for testing',
                [{ text: 'OK', onPress: () => handleEndCall() }]
              );
            }
          },
        });

        // Enable audio
        await engine.enableAudio();
        await engine.setEnableSpeakerphone(isSpeakerOn);

        // Join channel
        console.log('[Call] Joining channel:', callData.channelName);
        const result = await engine.joinChannel(
          AGORA_CONFIG.token || '',
          callData.channelName,
          0,
          { clientRoleType: 1 }
        );

        console.log('[Call] Join result:', result);
      } catch (error) {
        console.error('[Call] Init error:', error);
        Alert.alert('Error', 'Failed to initialize call');
        handleEndCall();
      }
    };

    initAgora();

    return () => {
      if (engine) {
        engine.leaveChannel();
        engine.release();
      }
      stopCallTimer();
    };
  }, [callStatus, callData?.channelName]);

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = async () => {
    if (agoraEngine) {
      await agoraEngine.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = async () => {
    if (agoraEngine) {
      await agoraEngine.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  const handleEndCall = async () => {
    try {
      if (agoraEngine) {
        agoraEngine.leaveChannel();
      }
      await endCall(callId, callDuration);
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    } catch (error) {
      console.error('Error ending call:', error);
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    }
  };

  const handleCallEnded = (message = 'Call ended') => {
    stopCallTimer();
    if (agoraEngine) {
      agoraEngine.leaveChannel();
    }
    Alert.alert('Call Ended', message, [
      { text: 'OK', onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradient}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, callStatus === CALL_STATUS.ANSWERED && styles.statusDotActive]} />
            <Text style={styles.statusText}>
              {callStatus === CALL_STATUS.ANSWERED ? formatDuration(callDuration) : 'Calling...'}
            </Text>
          </View>
        </View>

        {/* Other User Info */}
        <View style={styles.userContainer}>
          <Animated.View style={[styles.userImageContainer, { transform: [{ scale: pulseAnim }] }]}>
            {otherUser?.image ? (
              <Image source={{ uri: otherUser.image }} style={styles.userImage} />
            ) : (
              <View style={styles.userImagePlaceholder}>
                <Ionicons name="person" size={80} color="#fff" />
              </View>
            )}
          </Animated.View>
          <Text style={styles.userName}>{otherUser?.name || 'Unknown'}</Text>
          {isMuted && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={16} color="#ff4b6e" />
              <Text style={styles.mutedText}>You're muted</Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.controlsRow}>
            {/* Mute */}
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color={isMuted ? '#ff4b6e' : '#fff'}
              />
              <Text style={styles.controlLabel}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            {/* Speaker */}
            <TouchableOpacity
              style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
              onPress={toggleSpeaker}
            >
              <Ionicons
                name={isSpeakerOn ? 'volume-high' : 'volume-low'}
                size={28}
                color={isSpeakerOn ? '#00d4aa' : '#fff'}
              />
              <Text style={styles.controlLabel}>Speaker</Text>
            </TouchableOpacity>
          </View>

          {/* End Call */}
          <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
            <LinearGradient colors={['#ff4b6e', '#ff1744']} style={styles.endCallGradient}>
              <Ionicons name="call" size={32} color="#fff" style={styles.endCallIcon} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  statusBar: {
    paddingTop: 20,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffa500',
  },
  statusDotActive: {
    backgroundColor: '#00d4aa',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userImageContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#00d4aa',
    backgroundColor: '#2a2a3e',
  },
  userImage: {
    width: '100%',
    height: '100%',
  },
  userImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 30,
  },
  mutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 75, 110, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  mutedText: {
    color: '#ff4b6e',
    fontSize: 14,
    fontWeight: '600',
  },
  controlsContainer: {
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 40,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 80,
    paddingVertical: 20,
    borderRadius: 20,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
  },
  endCallButton: {
    alignSelf: 'center',
  },
  endCallGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
