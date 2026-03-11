import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { answerCall, declineCall, listenToCallStatus, CALL_STATUS } from './callHelpers';

export default function IncomingCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { callData } = route.params || {};

  const [callStatus, setCallStatus] = useState(callData?.status || CALL_STATUS.RINGING);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // Start pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Wave animations
    const wave1 = Animated.loop(
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    const wave2 = Animated.loop(
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 2000,
        delay: 300,
        useNativeDriver: true,
      })
    );
    const wave3 = Animated.loop(
      Animated.timing(waveAnim3, {
        toValue: 1,
        duration: 2000,
        delay: 600,
        useNativeDriver: true,
      })
    );

    wave1.start();
    wave2.start();
    wave3.start();

    return () => {
      pulse.stop();
      wave1.stop();
      wave2.stop();
      wave3.stop();
    };
  }, []);

  // Vibration pattern
  useEffect(() => {
    if (Platform.OS === 'android') {
      Vibration.vibrate([1000, 2000], true); // Repeat vibration
    }

    return () => {
      Vibration.cancel();
    };
  }, []);

  // Listen for call status changes
  useEffect(() => {
    if (!callData?.id) return;

    const unsubscribe = listenToCallStatus(callData.id, (updatedCall) => {
      if (!updatedCall) {
        // Call was deleted/cancelled
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      setCallStatus(updatedCall.status);

      // If caller ended the call
      if (updatedCall.status === CALL_STATUS.ENDED || updatedCall.status === CALL_STATUS.DECLINED) {
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
      }
    });

    return () => unsubscribe();
  }, [callData?.id]);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      handleDecline();
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, []);

  const handleAnswer = async () => {
    try {
      Vibration.cancel();
      await answerCall(callData.id);
      
      // Navigate to CallScreen
      navigation.replace('CallScreen', {
        callId: callData.id,
        isIncoming: true,
      });
    } catch (error) {
      console.error('Error answering call:', error);
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    }
  };

  const handleDecline = async () => {
    try {
      Vibration.cancel();
      await declineCall(callData.id);
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    } catch (error) {
      console.error('Error declining call:', error);
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    }
  };

  const renderWave = (animValue, delay = 0) => {
    const scale = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.5],
    });
    const opacity = animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.7, 0.3, 0],
    });

    return (
      <Animated.View
        style={[
          styles.wave,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.callTypeBadge}>
            <MaterialCommunityIcons
              name={callData?.callType === 'video' ? 'video' : 'phone'}
              size={16}
              color="#fff"
            />
            <Text style={styles.callTypeText}>
              {callData?.callType === 'video' ? 'Video' : 'Voice'} Call
            </Text>
          </View>
        </View>

        <View style={styles.callerContainer}>
          {/* Animated waves */}
          <View style={styles.wavesContainer}>
            {renderWave(waveAnim1)}
            {renderWave(waveAnim2)}
            {renderWave(waveAnim3)}
          </View>

          {/* Caller image */}
          <Animated.View
            style={[
              styles.callerImageContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            {callData?.callerImage ? (
              <Image
                source={{ uri: callData.callerImage }}
                style={styles.callerImage}
              />
            ) : (
              <View style={styles.callerImagePlaceholder}>
                <Ionicons name="person" size={80} color="#fff" />
              </View>
            )}
          </Animated.View>

          <Text style={styles.callerName}>{callData?.callerName || 'Unknown'}</Text>
          <Text style={styles.callingText}>is calling...</Text>
        </View>

        <View style={styles.actionsContainer}>
          {/* Decline Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ff4b6e', '#ff1744']}
              style={styles.actionButtonGradient}
            >
              <Ionicons name="call" size={32} color="#fff" style={styles.declineIcon} />
            </LinearGradient>
            <Text style={styles.actionLabel}>Decline</Text>
          </TouchableOpacity>

          {/* Answer Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.answerButton]}
            onPress={handleAnswer}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#00d4aa', '#00b894']}
              style={styles.actionButtonGradient}
            >
              <Ionicons name="call" size={32} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>Answer</Text>
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
  header: {
    paddingTop: 20,
    alignItems: 'center',
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  callerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wavesContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#00d4aa',
  },
  callerImageContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#00d4aa',
    backgroundColor: '#2a2a3e',
  },
  callerImage: {
    width: '100%',
    height: '100%',
  },
  callerImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 30,
  },
  callingText: {
    fontSize: 18,
    color: '#a0a0b0',
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonGradient: {
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
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
    fontWeight: '600',
  },
});
