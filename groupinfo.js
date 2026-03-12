// Helper to send a system message to chat when session ends
async function sendSessionEndSystemMessage(communityId, currentUser) {
  try {
    if (!communityId || !currentUser) return;
    const firestore = await import('firebase/firestore');
    const chatCol = collection(db, 'community_chats', communityId, 'messages');
    await firestore.addDoc(chatCol, {
      text: 'Session ended',
      type: 'system',
      sender: 'System',
      senderId: 'system',
      profileImage: null,
      createdAt: firestore.serverTimestamp(),
    });
  } catch (e) {
    console.log('Error sending session end system message:', e);
  }
}
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
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
  InteractionManager,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons, Entypo, AntDesign, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  increment,
  setDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app as firebaseApp, db } from './firebaseConfig';
import CacheManager from './cacheManager';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { uploadImageToHostinger, uploadAudioToHostinger, uploadVideoToHostinger } from './hostingerConfig';
import { normalizeBlobUri, normalizeImageUri } from './utils/normalizeUri';
import { Audio, Video } from 'expo-av';
import ReportUserModal from './components/ReportUserModal';
import PostOptionsModal from './components/PostOptionsModal';
import FeaturedFeed from './components/FeaturedFeed';
import CommunitySidebar from './components/CommunitySidebar';
import { canCheckInToday, getUserCheckInData, checkInToCommunity, COINS_CONFIG, POINTS_CONFIG } from './shared/services/communityCheckInService';
import { useWallet } from './context/WalletContext';
import useUserNames from './hooks/useUserNames';

// Animated heart button for instant like feedback
const AnimatedHeartButton = memo(({ isLiked, likes, onPress, size = 20 }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
    onPress && onPress();
  }, [onPress, scale]);

  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={size}
          color={isLiked ? '#ff4b6e' : '#888'}
        />
      </Animated.View>
      <Text style={{ color: isLiked ? '#ff4b6e' : '#888', fontSize: 12 }}>
        {likes || 0}
      </Text>
    </TouchableOpacity>
  );
});
AnimatedHeartButton.displayName = 'AnimatedHeartButton';

// Helper function to check if message type is a voice room
const isVoiceRoomType = (type) => {
  return type === 'voiceChat' || type === 'voice_room' || type === 'voice chat';
};

// Optimized RenderMessages component with useMemo to prevent array recreation
const RenderMessages = memo(({
  messages,
  currentUser,
  setSelectedImageModal,
  setVideoRefs,
  playingVideoId,
  setPlayingVideoId,
  handleJoinVoiceChat,
  handleJoinScreeningRoom,
  handleJoinRoleplay,
  handleProfilePress,
  navigation,
  communityId,
  community,
  groupTitle,
  playingVoiceId,
  voiceSound,
  setPlayingVoiceId,
  setVoiceSound,
  onLongPressMessage,
  liveNames = {},
}) => {
  // Memoize current user ID to avoid recalculation
  const currentUserId = useMemo(() => currentUser?.id, [currentUser?.id]);

  // Memoize the entire message list to prevent recreation on every render
  const messageElements = useMemo(() => {
    return messages.map((msg) => {
      const isCurrentUser = currentUserId && msg.senderId === currentUserId;

      return (
        <MessageRow
          key={msg.id}
          msg={msg}
          isCurrentUser={isCurrentUser}
          currentUser={currentUser}
          setSelectedImageModal={setSelectedImageModal}
          setVideoRefs={setVideoRefs}
          playingVideoId={playingVideoId}
          setPlayingVideoId={setPlayingVideoId}
          handleJoinVoiceChat={handleJoinVoiceChat}
          handleJoinScreeningRoom={handleJoinScreeningRoom}
          handleJoinRoleplay={handleJoinRoleplay}
          handleProfilePress={handleProfilePress}
          navigation={navigation}
          communityId={communityId}
          community={community}
          groupTitle={groupTitle}
          playingVoiceId={playingVoiceId}
          voiceSound={voiceSound}
          setPlayingVoiceId={setPlayingVoiceId}
          setVoiceSound={setVoiceSound}
          onLongPressMessage={onLongPressMessage}
          liveNames={liveNames}
        />
      );
    });
  }, [messages, currentUserId, currentUser, playingVideoId, playingVoiceId,
    navigation, communityId, community, groupTitle, voiceSound, handleJoinVoiceChat, handleJoinScreeningRoom, handleJoinRoleplay, handleProfilePress, onLongPressMessage, liveNames]);

  return <>{messageElements}</>;
});

// Memoized Message Row component
const MessageRow = memo(({
  msg,
  isCurrentUser,
  currentUser,
  setSelectedImageModal,
  setVideoRefs,
  playingVideoId,
  setPlayingVideoId,
  handleJoinVoiceChat,
  handleJoinScreeningRoom,
  handleJoinRoleplay,
  handleProfilePress,
  navigation,
  communityId,
  community,
  groupTitle,
  playingVoiceId,
  voiceSound,
  setPlayingVoiceId,
  setVoiceSound,
  onLongPressMessage,
  liveNames = {},
}) => {
  return (
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={() => onLongPressMessage && onLongPressMessage(msg)}
      delayLongPress={400}
      style={[
        styles.chatMessageContainer,
        isCurrentUser ? styles.chatMessageContainerRight : styles.chatMessageContainerLeft
      ]}
    >
      {!isCurrentUser && (
        <TouchableOpacity
          onPress={() => handleProfilePress(msg.senderId)}
          activeOpacity={0.7}
        >
          {msg.profileImage ? (
            <Image
              source={{ uri: msg.profileImage }}
              style={styles.profilePic}
            />
          ) : (
            <View style={[styles.profilePic, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={24} color="#657786" />
            </View>
          )}
        </TouchableOpacity>
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
          <Text style={styles.chatMessageTitle}>{liveNames[msg.senderId] || msg.sender || 'User'}</Text>
        )}

        {/* Image Message */}
        {!!msg.imageUrl && (
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
        {!!msg.videoUrl && (
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

        {/* Voice Room Message - Only show active rooms */}
        {(msg.type === 'voiceChat' || isVoiceRoomType(msg.type)) && (
          <View>
            <View style={msg.isActive ? undefined : { alignItems: 'center', marginBottom: 4 }}>
              {!msg.isActive && (
                <View style={{ backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Voice Chat Ended</Text>
                </View>
              )}
              <TouchableOpacity
                style={msg.isActive ? [styles.voiceChatMessageContainer, { flexWrap: 'wrap', minHeight: 80 }] : [styles.voiceChatMessageContainer, { opacity: 0.7, flexWrap: 'wrap', minHeight: 80 }]}
                disabled={!msg.isActive}
                onPress={() => msg.isActive && handleJoinVoiceChat(msg.id, msg.roomId, msg.participants || [])}
                activeOpacity={0.7}
              >
                <View style={styles.voiceChatHeader}>
                  <View style={styles.voiceIconPulse}>
                    <MaterialCommunityIcons name="waveform" size={28} color="#00FFFF" />
                  </View>
                  <Text style={styles.voiceChatTitle} numberOfLines={1} ellipsizeMode="tail">Live Voice Room</Text>
                  <Text style={styles.voiceChatParticipants}>
                    👥 {msg.participants?.length || 1} {msg.participants?.length === 1 ? 'person' : 'people'} in room
                  </Text>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>
                      {msg.isActive ? 'LIVE' : 'ENDED'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.voiceChatText} numberOfLines={2} ellipsizeMode="tail">
                  {liveNames[msg.senderId] || msg.sender || 'User'} started a voice room
                </Text>
                {msg.isActive && (msg.participants?.includes(currentUser?.id) ? (
                  <View style={styles.joinedVoiceChatBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#00FFFF" />
                    <Text style={styles.joinedVoiceChatText}>You're in - Tap to rejoin</Text>
                  </View>
                ) : (
                  <View style={styles.joinVoiceChatButton}>
                    <Ionicons name="enter-outline" size={18} color="#000" />
                    <Text style={styles.joinVoiceChatText}>Tap to Join</Text>
                  </View>
                ))}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Screening Room Message - Only show active rooms */}
        {msg.type === 'screeningRoom' && msg.isActive && (
          <TouchableOpacity
            style={styles.screeningRoomMessageContainer}
            onPress={() => handleJoinScreeningRoom(msg.id, msg.roomId, msg.participants || [])}
            activeOpacity={0.7}
          >
            <View style={styles.voiceChatHeader}>
              <View style={styles.screeningIconPulse}>
                <MaterialCommunityIcons name="television-play" size={28} color="#FF00FF" />
              </View>
              <Text style={styles.screeningRoomTitle} numberOfLines={1} ellipsizeMode="tail">Screening Room</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.screeningRoomText} numberOfLines={2} ellipsizeMode="tail">
              {liveNames[msg.senderId] || msg.sender || 'User'} started a screening room
            </Text>
            <Text style={styles.screeningRoomParticipants}>
              🎬 {msg.participants?.length || 1} {msg.participants?.length === 1 ? 'viewer' : 'viewers'}
            </Text>
            {msg.participants?.includes(currentUser?.id) ? (
              <View style={styles.joinedScreeningBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#FF00FF" />
                <Text style={styles.joinedScreeningText}>You're watching - Tap to rejoin</Text>
              </View>
            ) : (
              <View style={styles.joinScreeningButton}>
                <Ionicons name="play-outline" size={18} color="#000" />
                <Text style={styles.joinScreeningText}>Watch Now</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Roleplay Message - Only show active sessions */}
        {msg.type === 'roleplay' && msg.isActive && (
          <TouchableOpacity
            style={styles.roleplayMessageContainer}
            onPress={() => {
              // Always show mini screens for joining - user needs to select/create character
              handleJoinRoleplay(msg.id, msg.sessionId, msg.roles || [], msg.participants || []);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.voiceChatHeader}>
              <View style={styles.roleplayIconPulse}>
                <MaterialCommunityIcons name="drama-masks" size={28} color="#FFD700" />
              </View>
              <Text style={styles.roleplayTitle} numberOfLines={1} ellipsizeMode="tail">Roleplay Session</Text>
              {msg.isActive && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{msg.isActive ? 'LIVE' : 'ENDED'}</Text>
                </View>
              )}
            </View>

            <Text style={styles.roleplayText} numberOfLines={2} ellipsizeMode="tail">
              {liveNames[msg.senderId] || msg.senderName || 'User'} started a roleplay session
            </Text>

            {/* Display Characters */}
            {msg.characters && msg.characters.length > 0 && (
              <View style={styles.roleplayCharactersContainer}>
                <Text style={styles.roleplayCharactersLabel}>
                  {msg.characters.length} {msg.characters.length === 1 ? 'Character' : 'Characters'}:
                </Text>
                <View style={styles.roleplayCharactersList}>
                  {msg.characters.map((char, index) => (
                    <View key={index} style={styles.roleplayCharacterCard}>
                      {/* Character Avatar */}
                      {char.avatar ? (
                        <Image
                          source={{ uri: char.avatar }}
                          style={styles.roleplayCharacterAvatar}
                        />
                      ) : (
                        <View style={styles.roleplayCharacterAvatarPlaceholder}>
                          <Ionicons name="person" size={24} color="#666" />
                        </View>
                      )}

                      <View style={styles.roleplayCharacterInfo}>
                        {/* Character Name with Theme Color */}
                        <Text
                          style={[
                            styles.roleplayCharacterName,
                            char.themeColor && { color: char.themeColor }
                          ]}
                          numberOfLines={1}
                        >
                          {char.name}
                        </Text>

                        {/* Subtitle */}
                        {!!char.subtitle && (
                          <Text style={styles.roleplayCharacterSubtitle} numberOfLines={1}>
                            {char.subtitle}
                          </Text>
                        )}

                        {/* Author */}
                        <Text style={styles.roleplayCharacterAuthor}>
                          by @{char.ownerName || liveNames[msg.senderId] || msg.senderName || 'Unknown'}
                        </Text>

                        {/* Tags */}
                        {char.tags && char.tags.length > 0 && (
                          <View style={styles.roleplayCharacterTags}>
                            {char.tags.slice(0, 2).map((tag, tagIndex) => (
                              <View key={tagIndex} style={styles.roleplayCharacterTag}>
                                <Text style={styles.roleplayCharacterTagText}>{tag}</Text>
                              </View>
                            ))}
                            {char.tags.length > 2 && (
                              <Text style={styles.roleplayCharacterMoreTags}>+{char.tags.length - 2}</Text>
                            )}
                          </View>
                        )}

                        {/* Attributes */}
                        <View style={styles.roleplayCharacterAttributes}>
                          {!!char.gender && (
                            <Text style={styles.roleplayCharacterAttribute}>
                              {char.gender}
                            </Text>
                          )}
                          {!!char.age && (
                            <Text style={styles.roleplayCharacterAttribute}>
                              • {char.age} yrs
                            </Text>
                          )}
                          {!!char.language && (
                            <Text style={styles.roleplayCharacterAttribute}>
                              • {char.language}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Display Participants with Avatars */}
            {msg.participantsDetails && msg.participantsDetails.length > 0 && (
              <View style={styles.roleplayParticipantsAvatars}>
                <Text style={styles.roleplayParticipantsLabel}>Players:</Text>
                <View style={styles.participantsAvatarRow}>
                  {msg.participantsDetails.slice(0, 7).map((participant, index) => {
                    const isCreator = participant.userId === msg.senderId;

                    return (
                      <View key={index} style={styles.participantAvatarContainer}>
                        {isCreator && (
                          <View style={styles.crownBadge}>
                            <Ionicons name="crown" size={12} color="#FFD700" />
                          </View>
                        )}
                        <Image
                          source={{
                            uri: participant.profileImage || 'https://via.placeholder.com/50'
                          }}
                          style={styles.participantAvatar}
                        />
                      </View>
                    );
                  })}
                  {msg.participantsDetails.length > 7 && (
                    <View style={styles.moreParticipants}>
                      <Text style={styles.moreParticipantsText}>+{msg.participantsDetails.length - 7}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={styles.roleplayStats}>
              <Text style={styles.roleplayParticipants}>
                🎭 {msg.participants?.length || 1} {msg.participants?.length === 1 ? 'player' : 'players'}
              </Text>
              <Text style={styles.roleplayAvailableRoles}>
                • {msg.availableCharacters || msg.characters?.length || 0} characters
              </Text>
            </View>
            {msg.participants?.includes(currentUser?.id) ? (
              <View style={styles.joinedRoleplayBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#FFD700" />
                <Text style={styles.joinedRoleplayText}>Tap to Join/Continue</Text>
              </View>
            ) : (
              <View style={styles.joinRoleplayButton}>
                <Ionicons name="person-add-outline" size={18} color="#000" />
                <Text style={styles.joinRoleplayText}>Tap to Join</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Community Invite Message */}
        {msg.type === 'community_invite' && (
          <TouchableOpacity
            style={styles.communityInviteContainer}
            onPress={() => {
              // Navigate to the community
              if (msg.communityId) {
                navigation.navigate('GroupInfo', {
                  communityId: msg.communityId,
                  groupTitle: msg.communityName || 'Community'
                });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.communityInviteHeader}>
              <MaterialIcons name="groups" size={24} color="#8B2EF0" />
              <Text style={styles.communityInviteTitle}>Community Invitation</Text>
            </View>

            {!!msg.communityImage && (
              <Image
                source={{ uri: msg.communityImage }}
                style={styles.communityInviteImage}
                resizeMode="cover"
              />
            )}

            <View style={styles.communityInviteContent}>
              <Text style={styles.communityInviteName}>{msg.communityName}</Text>
              <Text style={styles.communityInviteText}>
                {msg.sender} invites you to join this community! 🎉
              </Text>
            </View>

            <View style={styles.communityInviteButton}>
              <MaterialIcons name="login" size={18} color="#fff" />
              <Text style={styles.communityInviteButtonText}>Tap to Join</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Voice Message */}
        {!!msg.voiceUrl && msg.type !== 'voiceChat' && !isVoiceRoomType(msg.type) && (
          <View style={styles.chatVoiceContainer}>
            <TouchableOpacity
              style={[
                styles.chatVoiceButton,
                playingVoiceId === msg.id && styles.chatVoiceButtonPlaying
              ]}
              onPress={async () => {
                try {
                  if (playingVoiceId === msg.id && voiceSound) {
                    await voiceSound.pauseAsync();
                    setPlayingVoiceId(null);
                    setVoiceSound(null);
                    return;
                  }

                  if (voiceSound) {
                    await voiceSound.stopAsync();
                    await voiceSound.unloadAsync();
                  }

                  const { sound } = await Audio.Sound.createAsync(
                    { uri: msg.voiceUrl },
                    { shouldPlay: true }
                  );

                  setVoiceSound(sound);
                  setPlayingVoiceId(msg.id);

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
        {!!msg.text && msg.type !== 'voiceChat' && !isVoiceRoomType(msg.type) && (
          <Text style={[
            styles.chatMessageText,
            isCurrentUser && styles.chatMessageTextOwn,
            msg.textColor && { color: msg.textColor }
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
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo - return TRUE to skip re-render when props are same

  // Fast path: check simple props first
  if (
    prevProps.msg.id !== nextProps.msg.id ||
    prevProps.msg.text !== nextProps.msg.text ||
    prevProps.msg.imageUrl !== nextProps.msg.imageUrl ||
    prevProps.msg.videoUrl !== nextProps.msg.videoUrl ||
    prevProps.msg.voiceUrl !== nextProps.msg.voiceUrl ||
    prevProps.playingVideoId !== nextProps.playingVideoId ||
    prevProps.playingVoiceId !== nextProps.playingVoiceId ||
    prevProps.msg.isActive !== nextProps.msg.isActive ||
    prevProps.isCurrentUser !== nextProps.isCurrentUser
  ) {
    return false;
  }

  // Optimized array comparison - only if fast path passes
  const prevParticipants = prevProps.msg.participants;
  const nextParticipants = nextProps.msg.participants;

  if (!prevParticipants && !nextParticipants) return true;
  if (!prevParticipants || !nextParticipants) return false;
  if (prevParticipants.length !== nextParticipants.length) return false;

  // Shallow comparison of array elements (IDs are strings/numbers)
  return prevParticipants.every((id, index) => id === nextParticipants[index]);
});


export default function GroupInfoScreen() {
  // Call this after ending a voice room session
  const handleMsgLongPress = useCallback((msg) => {
    if (msg.type === 'system' || msg.type === 'announcement' || msg.senderId === 'system') return;
    setSelectedMsg(msg);
    setShowMsgOptions(true);
  }, []);

  const handleCopyChatMsg = useCallback(async () => {
    if (selectedMsg?.text) {
      await Clipboard.setStringAsync(selectedMsg.text);
      Alert.alert('Copied', 'Message copied to clipboard');
    }
    setShowMsgOptions(false);
    setSelectedMsg(null);
  }, [selectedMsg]);

  const handleDeleteOwnChatMsg = useCallback(async () => {
    if (!selectedMsg || selectedMsg.senderId !== currentUser?.id) return;
    try {
      const msgRef = doc(db, 'community_chats', communityId, 'messages', selectedMsg.id);
      await updateDoc(msgRef, {
        isDeleted: true,
        text: 'This message was deleted.',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to delete message');
    }
    setShowMsgOptions(false);
    setSelectedMsg(null);
  }, [selectedMsg, communityId, currentUser?.id]);

  const handleVoiceRoomSessionEnd = useCallback(async (messageId) => {
    // 1. Send system message
    await sendSessionEndSystemMessage(communityId, currentUser);
    // 2. Update the voice room message's isActive to false in Firestore
    try {
      if (!communityId || !messageId) return;
      const firestore = await import('firebase/firestore');
      const messageRef = firestore.doc(db, 'community_chats', communityId, 'messages', messageId);
      await firestore.updateDoc(messageRef, { isActive: false });
    } catch (e) {
      console.log('Error updating voice room message to ended:', e);
    }
  }, [communityId, currentUser]);
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, groupTitle, openCharacterSelector, roleplaySessionId, returnToRoleplay, initialTab, openModal } = route.params || {};
  const auth = getAuth(firebaseApp);
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
  const [currentAdminIds, setCurrentAdminIds] = useState([]);
  const [currentModeratorIds, setCurrentModeratorIds] = useState([]);
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
  const likeDebounceRef = useRef(new Set());
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
  const [activeTab, setActiveTab] = useState(initialTab || 'community');
  const [showAddModal, setShowAddModal] = useState(false);

  // Respond to initialTab param changes (e.g. sidebar navigation from CommunityDetail)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Auto-open modals when navigated with openModal param (e.g. from Admin Portal)
  useEffect(() => {
    if (openModal === 'announcements') {
      setShowAnnouncementsModal(true);
    } else if (openModal === 'featured') {
      setShowFeaturedModal(true);
    }
  }, [openModal]);

  const [communitySection, setCommunitySection] = useState('all');
  const [communityGroups, setCommunityGroups] = useState([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showMsgOptions, setShowMsgOptions] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogs, setBlogs] = useState([]);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]); // Combined blogs and image posts

  // ── Live name resolution: re-fetches on every name/nickname change ─────────────
  const _chatSenderIds = useMemo(
    () => chatMessages.map((m) => m.senderId).filter(Boolean),
    [chatMessages]
  );
  const _postAuthorIds = useMemo(
    () => [...posts, ...allPosts].map((p) => p.authorId || p.createdById).filter(Boolean),
    [posts, allPosts]
  );
  const _liveNameIds = useMemo(
    () => [...new Set([..._chatSenderIds, ..._postAuthorIds])],
    [_chatSenderIds, _postAuthorIds]
  );
  // liveNames: { [uid]: currentDisplayName } — community nickname preferred if set
  const liveNames = useUserNames(_liveNameIds, communityId);
  const [refreshing, setRefreshing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersModalContext, setMembersModalContext] = useState('all'); // 'all' or 'online'
  const [showShareModal, setShowShareModal] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInStreak, setCheckInStreak] = useState(0);
  const [checkInPoints, setCheckInPoints] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const walletContext = useWallet();
  const { wallet: walletData } = walletContext;
  const [inviteLink, setInviteLink] = useState('');
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [showComposeAnnouncementModal, setShowComposeAnnouncementModal] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementBody, setNewAnnouncementBody] = useState('');
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementsTab, setAnnouncementsTab] = useState('pinned'); // 'pinned' | 'posts'
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState(null);
  const annScrollRef = useRef(null);
  const annBodyRef = useRef(null);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  // Report user state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetMember, setReportTargetMember] = useState(null);
  const [reportTargetPost, setReportTargetPost] = useState(null);
  const memberStatusUnsubscribersRef = useRef([]);

  // Community Nickname state
  const [communityNickname, setCommunityNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [memberNicknames, setMemberNicknames] = useState({}); // { memberId: nickname }
  // Ref mirror so closures (Firestore listeners) always read the latest nicknames
  // without needing to be re-subscribed every time the state changes.
  const memberNicknamesRef = useRef({});
  // Ref mirrors for admin/mod IDs so the backup real-time listener can read
  // them without being re-subscribed on every state change.
  const currentAdminIdsRef = useRef([]);
  const currentModeratorIdsRef = useRef([]);

  // Active audio call state
  const [activeAudioCall, setActiveAudioCall] = useState(null);
  const [audioCallParticipants, setAudioCallParticipants] = useState([]);

  // Roleplay setup modal
  const [showRoleplaySetup, setShowRoleplaySetup] = useState(false);
  const [roleplayScenario, setRoleplayScenario] = useState('');
  const [roleplayRoles, setRoleplayRoles] = useState([{ id: 1, name: '', description: '', taken: false, takenBy: null }]);
  const [nextRoleId, setNextRoleId] = useState(2);
  const [showRoleSelectModal, setShowRoleSelectModal] = useState(false);
  const [selectedRoleplayToJoin, setSelectedRoleplayToJoin] = useState(null);
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRoleDescription, setCustomRoleDescription] = useState('');
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(false);

  // Character selection for joining roleplay
  const [showCharacterSelectorForJoin, setShowCharacterSelectorForJoin] = useState(false);
  const [selectedCharacterForRoleplay, setSelectedCharacterForRoleplay] = useState(null);
  const [pendingRoleplayJoin, setPendingRoleplayJoin] = useState(null); // Store messageId, sessionId, roles

  // Feature selection modal
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showMiniScreen, setShowMiniScreen] = useState(null); // 'voice', 'screening', 'roleplay'

  // Roleplay character creation (3 pages)
  const [roleplayPage, setRoleplayPage] = useState(1); // 1, 2, 3, 4
  const [characterAvatar, setCharacterAvatar] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterSubtitle, setCharacterSubtitle] = useState('');
  const [characterThemeColor, setCharacterThemeColor] = useState('#FFD700');
  const [characterGender, setCharacterGender] = useState('');
  const [characterLanguage, setCharacterLanguage] = useState('English');
  const [characterTags, setCharacterTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [characterAge, setCharacterAge] = useState('');
  const [characterHeight, setCharacterHeight] = useState('');
  const [characterDescription, setCharacterDescription] = useState('');
  const [characterGreeting, setCharacterGreeting] = useState('');
  const [characterCollection, setCharacterCollection] = useState([]); // All created characters
  const [selectedCharactersForSession, setSelectedCharactersForSession] = useState([]); // Characters selected for this roleplay
  const [editingCharacterId, setEditingCharacterId] = useState(null); // For editing existing character

  // Predefined tag suggestions
  const suggestedTags = ['Friendly', 'Romantic', 'Mysterious', 'Adventurous', 'Wise', 'Playful', 'Serious', 'Funny', 'Creative', 'Athletic', 'Intellectual', 'Caring'];
  const themeColors = ['#FFD700', '#FF6B6B', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4', '#8BC34A', '#FF5722'];
  const languages = ['English', 'Urdu', 'Hindi', 'Arabic', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Chinese'];

  // Text color picker
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState('#fff');
  const textColors = ['#fff', '#FF4444', '#FF6B6B', '#FFA500', '#FFD700', '#4CAF50', '#00CED1', '#4169E1', '#8B2EF0', '#FF1493'];

  // Ref for scrolling to bottom of chat
  const chatScrollRef = React.useRef(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  const scrollTimeoutRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardScrollTimeoutRef = useRef(null);

  // Add options for the + tab
  const addOptions = [
    { id: 'link', name: 'Link', icon: 'link', color: '#4A69FF', iconFamily: 'FontAwesome5' },
    { id: 'live', name: 'Go Live', icon: 'video', color: '#E440FC', iconFamily: 'FontAwesome5' },
    { id: 'image', name: 'Image', icon: 'image', color: '#FF4A4A', iconFamily: 'FontAwesome5' },
    { id: 'chat', name: 'Public Chatroom', icon: 'chat', color: '#40FC6F', iconFamily: 'MaterialCommunityIcons' },
    { id: 'blog', name: 'Blog', icon: 'newspaper', color: '#40DFFC', iconFamily: 'FontAwesome5' },
    { id: 'drafts', name: 'Drafts', icon: 'file-document-outline', color: '#4D4D6B', iconFamily: 'MaterialCommunityIcons' },
  ];

  // Load user's character collection
  useEffect(() => {
    const loadCharacterCollection = async () => {
      if (!currentUser?.id) return;

      try {
        // db is now imported globally
        const userRef = doc(db, 'users', currentUser.id);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCharacterCollection(userData.characterCollection || []);
        }
      } catch (error) {
        console.log('Error loading character collection:', error);
      }
    };

    loadCharacterCollection();
  }, [currentUser]);

  // Load check-in status for this community (re-runs on focus so it stays
  // fresh after the user checks in via the full CommunityCheckInScreen)
  useFocusEffect(
    useCallback(() => {
      const loadCheckInStatus = async () => {
        const userId = auth.currentUser?.uid;
        if (!communityId || !userId) return;
        try {
          const [checkStatus, data] = await Promise.all([
            canCheckInToday(db, communityId, userId),
            getUserCheckInData(db, communityId, userId),
          ]);
          setHasCheckedIn(!checkStatus?.canCheckIn);
          setCheckInStreak(data?.currentStreak ?? 0);
          setCheckInPoints(data?.totalPoints ?? 0);
        } catch (e) {
          // non-fatal
        }
      };
      loadCheckInStatus();
    }, [communityId, auth.currentUser?.uid])
  );

  // Handle opening character selector when navigating from RoleplayScreen
  useEffect(() => {
    if (openCharacterSelector && roleplaySessionId) {
      // Set pending roleplay join with session details
      setPendingRoleplayJoin({
        sessionId: roleplaySessionId,
        returnToRoleplay: returnToRoleplay
      });

      // Open the mini screen for roleplay character selection
      setShowMiniScreen('roleplay');
      setRoleplayPage(1); // Start at character selection page
    }
  }, [openCharacterSelector, roleplaySessionId, returnToRoleplay]);

  // Fetch community details from Firestore (Real-time)
  useEffect(() => {
    if (!communityId) return;
    let unsubscribe;

    const setupListener = async () => {
      setLoading(true);
      setError(null);

      // Check if the current user is banned from this community before loading anything
      const currentUserId = auth.currentUser?.uid;
      if (currentUserId) {
        try {
          const banRef = doc(db, 'communities', communityId, 'bans', currentUserId);
          const banSnap = await getDoc(banRef);
          if (banSnap.exists()) {
            const banData = banSnap.data();
            const isActiveBan = banData.isActive && (
              !banData.banExpiresAt ||
              (banData.banExpiresAt?.toDate
                ? banData.banExpiresAt.toDate().getTime()
                : new Date(banData.banExpiresAt).getTime()) > Date.now()
            );
            if (isActiveBan) {
              setLoading(false);
              setError('banned');
              return; // bail out — the render block below will show the ban screen
            }
          }
        } catch (e) {
          console.log('Ban check error:', e?.message);
        }
      }

      // db is now imported globally
      const communityRef = doc(db, 'communities', communityId);

      const firestore = await import('firebase/firestore');
      unsubscribe = firestore.onSnapshot(communityRef, async (communitySnap) => {
        try {
          if (communitySnap.exists()) {
            const data = communitySnap.data();
            // Combine members + memberIds arrays (deduped) for the true count.
            // Creator lives in memberIds, joiners in members — union gives the real total.
            const _mArr = Array.isArray(data.members) ? data.members : [];
            const _miArr = Array.isArray(data.memberIds) ? data.memberIds : [];
            const _combined = [...new Set([..._mArr, ..._miArr])];
            let memberCount = 0;
            if (_combined.length > 0) {
              memberCount = _combined.length;
            } else if (typeof data.memberCount === 'number' && data.memberCount > 0) {
              memberCount = data.memberCount;
            } else if (Array.isArray(data.community_members)) {
              memberCount = data.community_members.length;
            } else if (typeof data.members_count === 'number') {
              memberCount = data.members_count;
            } else if (typeof data.community_members === 'number') {
              memberCount = data.community_members;
            }
            setCommunity({
              id: communitySnap.id,
              ...data,
              memberCount: memberCount
            });

            // Determine admin ids from possible fields and check admin status
            const _adminIds = Array.isArray(data.adminIds)
              ? data.adminIds
              : Array.isArray(data.admins)
                ? data.admins
                : data.uid && typeof data.uid === 'string'
                  ? [data.uid]
                  : [];

            // Check if current user is admin - ONLY based on adminIds array
            // This allows super admin to fully revoke admin privileges from anyone, including the creator
            const isCurrentAdmin = auth.currentUser && _adminIds.includes(auth.currentUser.uid);
            const _moderatorIds = [
              ...(Array.isArray(data.moderatorIds) ? data.moderatorIds : Array.isArray(data.moderators) ? data.moderators : []),
              ...(Array.isArray(data.curators) ? data.curators : []),
              ...(Array.isArray(data.leaders) ? data.leaders : []),
            ];
            const isCurrentModerator = auth.currentUser && _moderatorIds.includes(auth.currentUser.uid);

            setIsAdmin(Boolean(isCurrentAdmin));
            setIsModerator(Boolean(isCurrentModerator));
            // Generate invite link for all members
            setInviteLink(`socialvibing://community/${communityId}`);
            setQrCodeValue(`socialvibing://community/${communityId}`);

            // Extract member IDs — combine members + memberIds (deduped) so creator is always included
            let memberIds = [];

            const _membersField = Array.isArray(data.members) ? data.members : [];
            const _memberIdsField = Array.isArray(data.memberIds) ? data.memberIds : [];
            const _communityMembersField = Array.isArray(data.community_members) ? data.community_members : [];

            // Union all three arrays and deduplicate
            const _unionIds = [...new Set([..._membersField, ..._memberIdsField, ..._communityMembersField])];

            if (_unionIds.length > 0) {
              memberIds = _unionIds;
            } else {
              // Format 4: Numeric keys (0, 1, 2, etc.) - extract from object
              const numericKeys = Object.keys(data).filter(key => /^\d+$/.test(key) && typeof data[key] === 'string' && data[key].trim() !== '');
              if (numericKeys.length > 0) {
                memberIds = numericKeys.map(key => data[key]).filter(Boolean);
                console.log('Extracted member IDs from numeric keys:', memberIds);
              }
            }

            // Normalize memberIds: extract uid string from object entries (e.g. {displayName, profileImage, uid})
            memberIds = memberIds.map(item => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                return item.uid || item.user_id || item.userId || item.id || null;
              }
              return null;
            }).filter(id => id && typeof id === 'string' && id.trim() !== '');

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

            // Extract admin/mod IDs from community doc — done before the if/else so
            // both branches can use them and the reactive useEffect always has them.
            const adminIds = Array.isArray(data.adminIds)
              ? data.adminIds
              : Array.isArray(data.admins)
                ? data.admins
                : data.uid && typeof data.uid === 'string'
                  ? [data.uid]
                  : [];
            const moderatorIds = [
              ...(Array.isArray(data.moderatorIds) ? data.moderatorIds : Array.isArray(data.moderators) ? data.moderators : []),
              ...(Array.isArray(data.curators) ? data.curators : []),
              ...(Array.isArray(data.leaders) ? data.leaders : []),
            ];
            const safeAdminIds = Array.isArray(adminIds) ? adminIds : [];
            const safeModeratorIds = [...new Set(moderatorIds)];
            setCurrentAdminIds(safeAdminIds);
            setCurrentModeratorIds(safeModeratorIds);

            // Fetch members from users collection
            if (memberIds.length > 0) {
              const usersCol = collection(db, 'users');

              // Fetch first 5 for preview
              const memberDocs = await Promise.all(
                memberIds.slice(0, 5).map(async (uid) => {
                  try {
                    if (!uid || typeof uid !== 'string') return null;
                    const userDoc = await getDoc(doc(usersCol, uid));
                    return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
                  } catch (e) {
                    return null;
                  }
                })
              );
              setMembers(memberDocs.filter(Boolean));

              // Fetch all members for "Who's Online" section
              const allMemberDocs = await Promise.all(
                memberIds.map(async (uid) => {
                  try {
                    if (!uid || typeof uid !== 'string') return null;
                    const membershipId = `${uid}_${communityId}`;
                    const [userDoc, membershipDoc] = await Promise.all([
                      getDoc(doc(usersCol, uid)),
                      getDoc(doc(db, 'communities_members', membershipId)),
                    ]);
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      const globalName = userData.displayName || userData.name || userData.fullName || userData.username || 'User';
                      // RC-fix: read from ref so we always get the latest even when listener
                      // was set up before nicknames loaded.
                      const nickname = memberNicknamesRef.current[uid];
                      // Prefer community join date over account creation date
                      const membershipData = membershipDoc.exists() ? membershipDoc.data() : null;
                      const joinedAt = membershipData?.joinedAt || userData.joinedAt || userData.createdAt || null;
                      return {
                        id: userDoc.id,
                        name: nickname || globalName,
                        globalName: globalName,
                        communityNickname: nickname || null,
                        profileImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
                        email: userData.email || null,
                        joinedAt,
                        isAdmin: safeAdminIds.includes(uid),
                        isModerator: safeModeratorIds.includes(uid),
                        currentStatus: userData.currentStatus || null,
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

              // Set up real-time listeners for each member's status
              const statusUnsubscribers = validMembers.map((member) => {
                const userRef = doc(db, 'users', member.id);
                return onSnapshot(userRef, (userSnap) => {
                  if (userSnap.exists()) {
                    const userData = userSnap.data();
                    setAllMembers(prevMembers =>
                      prevMembers.map(m =>
                        m.id === member.id
                          ? { ...m, currentStatus: userData.currentStatus || 'offline' }
                          : m
                      )
                    );
                  }
                }, (error) => {
                  console.log('Error listening to member status:', error);
                });
              });

              // Clean up old listeners before setting new ones
              memberStatusUnsubscribersRef.current.forEach(unsub => {
                if (typeof unsub === 'function') {
                  unsub();
                }
              });

              // Store unsubscribers to clean up later
              memberStatusUnsubscribersRef.current = statusUnsubscribers;

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
                const q = query(
                  membersCol,
                  where('community_id', '==', communityId)
                );
                const membersSnapshot = await getDocs(q);
                const memberUserIds = membersSnapshot.docs.map(doc => {
                  const memberData = doc.data();
                  return memberData.user_id || memberData.userId || memberData.uid;
                }).filter(Boolean);

                // Build a uid → membership doc data map to get join dates
                const membershipDataMap = {};
                membersSnapshot.docs.forEach(docSnap => {
                  const mData = docSnap.data();
                  const uid = mData.user_id || mData.userId || mData.uid;
                  if (uid) membershipDataMap[uid] = mData;
                });

                if (memberUserIds.length > 0) {
                  const usersCol = collection(db, 'users');
                  const allMemberDocs = await Promise.all(
                    memberUserIds.map(async (uid) => {
                      try {
                        const userDoc = await getDoc(doc(usersCol, uid));
                        if (userDoc.exists()) {
                          const userData = userDoc.data();
                          const backupGlobalName = userData.displayName || userData.name || userData.fullName || userData.username || 'User';
                          const backupNickname = memberNicknamesRef.current[userDoc.id];
                          const membershipEntry = membershipDataMap[uid];
                          return {
                            id: userDoc.id,
                            name: backupNickname || backupGlobalName,
                            globalName: backupGlobalName,
                            communityNickname: backupNickname || null,
                            profileImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
                            email: userData.email || null,
                            joinedAt: membershipEntry?.joinedAt || userData.joinedAt || userData.createdAt || null,
                            isAdmin: safeAdminIds.includes(userDoc.id),
                            isModerator: safeModeratorIds.includes(userDoc.id),
                            currentStatus: userData.currentStatus || 'offline',
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

                  // Set up real-time listeners for each member's status
                  const statusUnsubscribers = validMembers.map((member) => {
                    const userRef = doc(db, 'users', member.id);
                    return onSnapshot(userRef, (userSnap) => {
                      if (userSnap.exists()) {
                        const userData = userSnap.data();
                        setAllMembers(prevMembers =>
                          prevMembers.map(m =>
                            m.id === member.id
                              ? { ...m, currentStatus: userData.currentStatus || 'offline' }
                              : m
                          )
                        );
                      }
                    }, (error) => {
                      console.log('Error listening to member status:', error);
                    });
                  });

                  // Clean up old listeners before setting new ones
                  memberStatusUnsubscribersRef.current.forEach(unsub => {
                    if (typeof unsub === 'function') {
                      unsub();
                    }
                  });

                  // Store unsubscribers to clean up later
                  memberStatusUnsubscribersRef.current = statusUnsubscribers;

                  setMembers(validMembers.slice(0, 5));
                  setAdmins(validMembers.filter(m => m.isAdmin));
                  setModerators(validMembers.filter(m => m.isModerator && !m.isAdmin));
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
      // Clean up member status listeners
      memberStatusUnsubscribersRef.current.forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, [communityId]);

  // Recalculate admin/moderator status for all members when admin/mod lists change
  useEffect(() => {
    if (allMembers.length === 0) return;

    // RC-fix: update allMembers AND derive admins/mods from the freshly-mapped array,
    // not from the stale `allMembers` state variable in the outer closure.
    setAllMembers(prevMembers => {
      const updated = prevMembers.map(member => ({
        ...member,
        isAdmin: currentAdminIds.includes(member.id),
        isModerator: currentModeratorIds.includes(member.id),
      }));
      // Derive and apply in the same batch so React can coalesce the updates.
      setAdmins(updated.filter(m => m.isAdmin));
      setModerators(updated.filter(m => m.isModerator && !m.isAdmin));
      return updated;
    });
  }, [currentAdminIds, currentModeratorIds]);

  // Listen for active audio calls in this community
  useEffect(() => {
    if (!communityId) return;
    let unsubscribe;

    const setupAudioCallListener = async () => {
      // db is now imported globally
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
    if (!communityId) return;
    let unsubscribe;

    const setupBackupListener = async () => {
      // db is now imported globally

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
              // Also extract nicknames from the membership docs
              const backupNicknames = {};
              snapshot.docs.forEach(docSnap => {
                const mData = docSnap.data();
                const uid = mData.user_id || mData.userId || mData.uid;
                if (uid && mData.communityNickname) {
                  backupNicknames[uid] = mData.communityNickname;
                }
              });
              // Merge into memberNicknames state
              if (Object.keys(backupNicknames).length > 0) {
                setMemberNicknames(prev => ({ ...prev, ...backupNicknames }));
              }

              const allMemberDocs = await Promise.all(
                memberUserIds.map(async (uid) => {
                  try {
                    const userDoc = await getDoc(doc(usersCol, uid));
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      const globalName = userData.displayName || userData.name || userData.fullName || userData.username || 'User';
                      const nickname = backupNicknames[uid] || memberNicknamesRef.current[uid];
                      return {
                        id: userDoc.id,
                        name: nickname || globalName,
                        globalName: globalName,
                        communityNickname: nickname || null,
                        profileImage: userData.profileImage || userData.avatar || userData.profile_image || userData.photoURL || null,
                        email: userData.email || null,
                        joinedAt: userData.joinedAt || userData.createdAt || null,
                        isAdmin: currentAdminIdsRef.current.includes(userDoc.id),
                        isModerator: currentModeratorIdsRef.current.includes(userDoc.id),
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
                setAdmins(validMembers.filter(m => m.isAdmin));
                setModerators(validMembers.filter(m => m.isModerator && !m.isAdmin));
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
        // db is now imported globally

        // Get currently logged-in user from Firebase Auth
        if (auth.currentUser) {
          const userId = auth.currentUser.uid;

          // Try to load from cache first
          const cachedUser = await CacheManager.getUserProfile(userId);
          if (cachedUser) {
            console.log('📦 Using cached current user:', cachedUser.name);
            setCurrentUser({
              id: userId,
              name: cachedUser.name || cachedUser.displayName || 'User',
              profileImage: cachedUser.profileImage || cachedUser.avatar || null,
              email: cachedUser.email || auth.currentUser.email
            });
          }

          // Fetch fresh data from Firestore in background
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

            const userProfile = {
              id: userId,
              name: userName,
              profileImage: userData.profileImage || userData.avatar || null,
              email: userData.email || auth.currentUser.email,
              ...userData
            };

            setCurrentUser(userProfile);
            // Cache the user profile
            await CacheManager.saveUserProfile(userId, userProfile);
            console.log('✅ Current user loaded:', userName);
          } else {
            // If user doc doesn't exist, use auth data
            const basicUser = {
              id: userId,
              name: auth.currentUser.displayName || 'User',
              profileImage: null,
              email: auth.currentUser.email
            };
            setCurrentUser(basicUser);
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

  // Fetch current user's community nickname
  useEffect(() => {
    if (!auth.currentUser?.uid || !communityId) return;
    const fetchCommunityNickname = async () => {
      try {
        const membershipId = `${auth.currentUser.uid}_${communityId}`;
        const membershipRef = doc(db, 'communities_members', membershipId);
        const membershipSnap = await getDoc(membershipRef);
        if (membershipSnap.exists()) {
          const data = membershipSnap.data();
          if (data.communityNickname) {
            setCommunityNickname(data.communityNickname);
          }
        }
      } catch (e) {
        console.log('Error fetching community nickname:', e);
      }
    };
    fetchCommunityNickname();
  }, [communityId]);

  // Sync community nickname to currentUser when either changes
  useEffect(() => {
    if (!currentUser) return;
    if (communityNickname && currentUser.communityNickname !== communityNickname) {
      setCurrentUser(prev => prev ? { ...prev, communityNickname } : prev);
    }
  }, [communityNickname, currentUser?.id]);

  // RC-fix: keep memberNicknamesRef in sync with state so all Firestore listener
  // closures (community, backup, chat) always read the freshest nickname map
  // without requiring a re-subscription.
  useEffect(() => {
    memberNicknamesRef.current = memberNicknames;
  }, [memberNicknames]);

  // Keep admin/mod ID refs in sync so the backup real-time listener closures
  // always reflect the latest values without needing re-subscription.
  useEffect(() => {
    currentAdminIdsRef.current = currentAdminIds;
  }, [currentAdminIds]);
  useEffect(() => {
    currentModeratorIdsRef.current = currentModeratorIds;
  }, [currentModeratorIds]);

  // RC-fix: when memberNicknames loads / updates, re-apply nicknames to every
  // already-built member object so the UI reflects them immediately.
  // Also re-derives admins, moderators, and recentlyJoined from the fresh list.
  useEffect(() => {
    if (Object.keys(memberNicknames).length === 0) return;
    setAllMembers(prev => {
      const updated = prev.map(m => {
        const nick = memberNicknames[m.id];
        return {
          ...m,
          name: nick || m.globalName || m.name,
          communityNickname: nick || null,
        };
      });
      // Re-derive dependent lists from the freshly-named array.
      setAdmins(updated.filter(m => m.isAdmin));
      setModerators(updated.filter(m => m.isModerator && !m.isAdmin));
      setRecentlyJoined(
        updated
          .filter(m => !m.isAdmin && !m.isModerator)
          .sort((a, b) => {
            const aT = a.joinedAt?.toDate?.() || a.joinedAt || new Date(0);
            const bT = b.joinedAt?.toDate?.() || b.joinedAt || new Date(0);
            return bT - aT;
          })
          .slice(0, 10)
      );
      return updated;
    });
  }, [memberNicknames]);

  // RC-fix: real-time listener for member nicknames so changes by any user
  // (including the current user on another device) are reflected instantly.
  // Uses onSnapshot instead of the old one-time getDocs.
  useEffect(() => {
    if (!communityId) return;
    let unsubNicknames = null;
    (async () => {
      try {
        const { query: fsQuery, where: fsWhere, onSnapshot: fsOnSnapshot } = await import('firebase/firestore');
        const membersRef = collection(db, 'communities_members');
        const q = fsQuery(membersRef, fsWhere('community_id', '==', communityId));
        unsubNicknames = fsOnSnapshot(q, (snap) => {
          const nicknames = {};
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.communityNickname && data.user_id) {
              nicknames[data.user_id] = data.communityNickname;
            }
          });
          setMemberNicknames(nicknames);
        }, (e) => {
          console.log('Error listening to member nicknames:', e);
        });
      } catch (e) {
        console.log('Error setting up member nickname listener:', e);
      }
    })();
    return () => {
      if (typeof unsubNicknames === 'function') unsubNicknames();
    };
  }, [communityId]);

  // Save community nickname handler
  const handleSaveNickname = async () => {
    if (!auth.currentUser?.uid || !communityId) return;
    const trimmed = nicknameInput.trim();
    if (trimmed.length > 30) {
      Alert.alert('Too Long', 'Nickname must be 30 characters or less.');
      return;
    }
    setNicknameSaving(true);
    try {
      const membershipId = `${auth.currentUser.uid}_${communityId}`;
      const membershipRef = doc(db, 'communities_members', membershipId);
      await setDoc(membershipRef, {
        user_id: auth.currentUser.uid,
        community_id: communityId,
        communityNickname: trimmed || null, // null removes nickname
      }, { merge: true });
      setCommunityNickname(trimmed || '');
      // Update memberNicknames cache
      setMemberNicknames(prev => {
        const updated = { ...prev };
        if (trimmed) {
          updated[auth.currentUser.uid] = trimmed;
        } else {
          delete updated[auth.currentUser.uid];
        }
        return updated;
      });
      // Update currentUser name so chat uses it immediately
      if (trimmed) {
        setCurrentUser(prev => prev ? { ...prev, communityNickname: trimmed } : prev);
      } else {
        setCurrentUser(prev => {
          if (!prev) return prev;
          const { communityNickname: _, ...rest } = prev;
          return rest;
        });
      }
      setShowNicknameModal(false);
      Alert.alert('Success', trimmed ? `Your community nickname is now "${trimmed}"` : 'Community nickname removed. Your global name will be used.');
    } catch (e) {
      console.error('Error saving community nickname:', e);
      Alert.alert('Error', 'Failed to save nickname. Please try again.');
    } finally {
      setNicknameSaving(false);
    }
  };

  // Fetch user stats (following, followers, likes, blogs, posts, ranking)
  useEffect(() => {
    if (!currentUser?.id) return;

    // db is now imported globally
    const userId = currentUser.id;

    const fetchUserStats = async () => {
      try {
        // Get user document which now stores all counts
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          // Use stored counts (much faster)
          const followingCount = userData.followingCount || 0;
          const followersCount = userData.followersCount || 0;

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
          {
            // Always calculate ranking regardless of like count
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

            // Ensure current user is in the list (even with 0 likes)
            if (!allUsersLikes.find(u => u.userId === userId)) {
              allUsersLikes.push({ userId, likes: 0 });
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
        } // Close if (userSnap.exists())
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
        // Use stored follower/following counts from user document (much faster)
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserStats((prev) => ({
            ...prev,
            following: userData.followingCount || 0,
            followers: userData.followersCount || 0,
          }));
        }

        // Listen to user document for real-time updates
        const unsubscribeUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const userData = snap.data();
            setUserStats((prev) => ({
              ...prev,
              following: userData.followingCount || 0,
              followers: userData.followersCount || 0,
            }));
          }
        });

        return () => {
          unsubscribeUser();
        };
      } catch (e) {
        console.log('Error setting up real-time stats:', e);
        return null;
      }
    };

    let cleanupUnsubscribe = null;

    setupRealTimeStats().then((cleanup) => {
      if (cleanup) cleanupUnsubscribe = cleanup;
    });

    return () => {
      if (followingUnsubscribe) followingUnsubscribe();
      if (followersUnsubscribe) followersUnsubscribe();
      if (cleanupUnsubscribe) cleanupUnsubscribe();
    };
  }, [currentUser?.id]);

  // Listen to current user's following list
  useEffect(() => {
    if (!currentUser?.id) {
      setFollowingUserIds([]);
      return;
    }

    // db is now imported globally
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

    // db is now imported globally
    const chatCol = collection(db, 'community_chats', communityId, 'messages');

    // Cache to avoid multiple Firestore reads for same user
    const userCache = {};

    // Import firestore dynamically but handle listener synchronously
    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
        const q = firestore.query(chatCol, firestore.orderBy('createdAt', 'asc'));

        unsubscribe = firestore.onSnapshot(q, async (snapshot) => {
          console.log('Chat messages snapshot received:', snapshot.docs.length, 'messages');

          // Process all messages and fetch sender details
          const promises = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            console.log('Processing message:', docSnap.id, 'type:', data.type);

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

            // RC-fix: read from ref — the onSnapshot closure captures state at
            // mount time; the ref always holds the current value.
            const senderNickname = senderId ? memberNicknamesRef.current[senderId] : null;

            return {
              id: docSnap.id,
              text: data.text || '',
              sender: senderNickname || senderData.name || data.sender || data.senderName || 'User',
              senderName: senderNickname || senderData.name || data.senderName || data.sender || 'User',
              senderId: senderId || data.senderId,
              profileImage: senderData.profileImage || data.senderImage || data.profileImage,
              imageUrl: data.imageUrl || null,
              videoUrl: data.videoUrl || null,
              voiceUrl: data.voiceUrl || null,
              type: data.type || 'text',
              duration: data.duration || null,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.timestamp ? new Date(data.timestamp) : null),
              roomId: data.roomId || null,
              sessionId: data.sessionId || null,
              participants: data.participants || [],
              isActive: data.isActive !== false,
              scenario: data.scenario || null,
              roles: data.roles || [],
              availableRoles: data.availableRoles || 0,
              characters: data.characters || [],
              availableCharacters: data.availableCharacters || 0,
            };
          });

          // Wait for all messages to be processed
          const processedMsgs = await Promise.all(promises);
          console.log('Processed messages:', processedMsgs.length, 'Voice rooms:', processedMsgs.filter(m => m.type === 'voiceChat').length);
          setChatMessages(processedMsgs);
          setChatLoading(false);

          // Don't scroll here - let useEffect handle it to avoid race conditions
        });
      } catch (error) {
        console.error('Error setting up chat listener:', error);
        setChatLoading(false);
      }
    })();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [communityId]);

  // Cleanup voice sound on unmount only (not on every sound change)
  useEffect(() => {
    return () => {
      if (voiceSound) {
        voiceSound.stopAsync().then(() => voiceSound.unloadAsync()).catch(() => { });
      }
      // Clean up scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []); // Empty deps - only cleanup on unmount

  // Handle keyboard show/hide events for proper scrolling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardHeight(event.endCoordinates.height);
        setIsUserScrolling(false);

        // Clear any existing timeout
        if (keyboardScrollTimeoutRef.current) {
          clearTimeout(keyboardScrollTimeoutRef.current);
        }

        // Scroll to bottom when keyboard opens with multiple attempts
        const scrollToBottomMultipleTimes = () => {
          // First scroll immediately
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollToEnd({ animated: false });
          }

          // Second scroll after 100ms
          setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollToEnd({ animated: true });
            }
          }, 100);

          // Third scroll after 300ms (ensures keyboard is fully shown)
          setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollToEnd({ animated: true });
            }
          }, 300);

          // Final scroll after 500ms
          keyboardScrollTimeoutRef.current = setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollToEnd({ animated: true });
            }
          }, 500);
        };

        scrollToBottomMultipleTimes();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);

        // Clear keyboard scroll timeout
        if (keyboardScrollTimeoutRef.current) {
          clearTimeout(keyboardScrollTimeoutRef.current);
        }
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      if (keyboardScrollTimeoutRef.current) {
        clearTimeout(keyboardScrollTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup video refs on unmount only
  useEffect(() => {
    return () => {
      Object.values(videoRefs).forEach((ref) => {
        if (ref && ref.stopAsync) {
          ref.stopAsync().catch(() => { });
          ref.unloadAsync().catch(() => { });
        }
      });
    };
  }, []); // Empty deps - only run on unmount

  // Auto-scroll to bottom when Chat tab is opened
  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length > 0 && !chatLoading) {
      // Reset user scrolling state when switching to chat
      setIsUserScrolling(false);

      // IMPORTANT: Reset lastMessageId to trigger scroll on every tab open
      // This ensures reload/tab switch always scrolls to bottom
      setLastMessageId(null);

      // Update last message ID to current latest after a delay
      const latestMessage = chatMessages[chatMessages.length - 1];
      setTimeout(() => {
        if (latestMessage?.id) {
          setLastMessageId(latestMessage.id);
        }
      }, 700);

      // Immediate scroll without animation
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollToEnd({ animated: false });
      }

      // First animated scroll after 100ms
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 100);

      // Second scroll after 300ms to ensure all messages are rendered
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 300);

      // Final scroll after 500ms
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 500);
    }
  }, [activeTab, chatLoading, chatMessages.length]);

  // Scroll to bottom whenever messages load or reload (if chat tab is active)
  useEffect(() => {
    if (chatMessages.length > 0 && !chatLoading && activeTab === 'chat') {
      const latestMessage = chatMessages[chatMessages.length - 1];
      const latestMessageId = latestMessage?.id;

      // If no lastMessageId set, this is initial load or reload - always scroll
      if (!lastMessageId && latestMessageId) {
        setLastMessageId(latestMessageId);

        // Multiple scroll attempts to ensure we reach bottom
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollToEnd({ animated: false });
          }
        }, 100);

        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollToEnd({ animated: true });
          }
        }, 300);

        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollToEnd({ animated: true });
          }
        }, 600);
      }
    }
  }, [chatMessages.length, chatLoading, activeTab, lastMessageId]);

  // Fetch participant user details
  // Optimized participant fetching with caching potential
  const fetchParticipantDetails = useCallback(async (participantIds) => {
    if (!participantIds || participantIds.length === 0) {
      setVoiceChatParticipants([]);
      return;
    }

    try {
      // db is now imported globally
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
          console.error('Error fetching participant:', userId, error);
          return {
            id: userId,
            name: 'User',
            profileImage: null,
          };
        }
      });

      const participants = await Promise.all(participantPromises);
      setVoiceChatParticipants(participants);
    } catch (error) {
      console.error('Error in fetchParticipantDetails:', error);
      setVoiceChatParticipants([]);
    }
  }, []);

  // Listen for Voice Chat participants updates and fetch initial participants
  useEffect(() => {
    if (!currentVoiceChatSession?.messageId || !communityId) return;

    // Fetch initial participant details
    if (currentVoiceChatSession.participants && currentVoiceChatSession.participants.length > 0) {
      fetchParticipantDetails(currentVoiceChatSession.participants);
    }

    // db is now imported globally
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

    // db is now imported globally
    const voiceChatMessagesCol = collection(
      db,
      'community_chats',
      communityId,
      'messages',
      currentVoiceChatSession.messageId,
      'voiceChatMessages'
    );

    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
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
      } catch (error) {
        console.error('Error setting up voice chat messages listener:', error);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentVoiceChatSession?.messageId, communityId]);

  // Cleanup voice chat sound on unmount
  useEffect(() => {
    return () => {
      if (voiceChatSound) {
        voiceChatSound.stopAsync().then(() => voiceChatSound.unloadAsync()).catch(() => { });
      }
    };
  }, [voiceChatSound]);

  // Listen for Real-time Audio Chunks from Other Participants
  useEffect(() => {
    if (!currentVoiceChatSession?.messageId || !communityId || !currentUser) return;

    // db is now imported globally
    const realTimeAudioCol = collection(
      db,
      'community_chats',
      communityId,
      'messages',
      currentVoiceChatSession.messageId,
      'realTimeAudio'
    );

    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
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
      } catch (error) {
        console.error('Error setting up real-time audio listener:', error);
      }
    })();

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
          sound.unloadAsync().catch(() => { });
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
        continuousRecording.stopAndUnloadAsync().catch(() => { });
      }

      // Clear interval
      if (audioChunkInterval) {
        clearInterval(audioChunkInterval);
      }

      // Stop all playing audio chunks
      Object.values(playingAudioChunks).forEach(sound => {
        sound.stopAsync().then(() => sound.unloadAsync()).catch(() => { });
      });
    };
  }, []);

  // Memoized scroll handler to prevent recreation
  const handleScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    // Show button if user scrolled up more than 100px from bottom
    setShowScrollToBottom(distanceFromBottom > 100);

    // Consider user is scrolling if more than 80px from bottom
    // Use a threshold that prevents false positives from new message rendering
    const isManuallyScrolledUp = distanceFromBottom > 80;
    setIsUserScrolling(isManuallyScrolledUp);

    // Clear any pending auto-scroll if user manually scrolled
    if (isManuallyScrolledUp && scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  // Memoized scroll to bottom function
  const scrollToBottom = useCallback(() => {
    chatScrollRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if user isn't scrolling up)
  useEffect(() => {
    if (chatMessages.length === 0 || chatLoading) return;

    // Get the latest message ID
    const latestMessage = chatMessages[chatMessages.length - 1];
    const latestMessageId = latestMessage?.id;

    // Check if this is a new message
    const isNewMessage = latestMessageId && latestMessageId !== lastMessageId;

    if (isNewMessage) {
      setLastMessageId(latestMessageId);

      // Auto-scroll only if user hasn't manually scrolled up
      if (!isUserScrolling && chatScrollRef.current) {
        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Scroll immediately first
        chatScrollRef.current.scrollToEnd({ animated: false });

        // Then scroll again with animation after render completes
        scrollTimeoutRef.current = setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollToEnd({ animated: true });
          }
          scrollTimeoutRef.current = null;
        }, 200); // Increased delay to ensure message is fully rendered
      }
    }
  }, [chatMessages, isUserScrolling, chatLoading, lastMessageId]);

  // Fetch blogs from Firestore
  useEffect(() => {
    if (!communityId) return;
    // db is now imported globally
    const blogsCol = collection(db, 'communities', communityId, 'blogs');

    // Real-time listener for blogs
    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
        const q = firestore.query(blogsCol, firestore.orderBy('createdAt', 'desc'));
        unsubscribe = firestore.onSnapshot(q, (snapshot) => {
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
      } catch (error) {
        console.error('Error setting up blogs listener:', error);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [communityId]);

  // Fetch image posts from Firestore
  useEffect(() => {
    if (!communityId) return;
    // db is now imported globally
    const postsCol = collection(db, 'communities', communityId, 'posts');

    // Real-time listener for image posts
    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
        const q = firestore.query(postsCol, firestore.orderBy('createdAt', 'desc'));
        unsubscribe = firestore.onSnapshot(q, (snapshot) => {
          const postsList = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const rawImageUri = data.imageUri || data.imageUrl || data.mediaUrl || data.image || null;
            const rawImageURL = data.imageURL || null;
            return {
              id: docSnap.id,
              type: 'image', // Mark as image post type
              ...data,
              imageUri: normalizeImageUri(rawImageUri, 'posts'),
              imageURL: normalizeImageUri(rawImageURL, 'posts'),
              likes: typeof data.likes === 'number' ? data.likes : 0,
              comments: typeof data.comments === 'number' ? data.comments : 0,
              likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
            };
          });
          setPosts(postsList);
          console.log('Image posts loaded:', postsList.length);
        });
      } catch (error) {
        console.error('Error setting up posts listener:', error);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [communityId]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh will be handled automatically by the existing listeners
      // Just wait a moment for the listeners to update
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log('Error refreshing posts:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Combine blogs and posts, sort by createdAt with pinned announcements at top
  useEffect(() => {
    const uid = currentUser?.id || currentUser?.uid;
    const isCommunityStaff = !!(community && uid && (
      community.creatorId === uid ||
      (community.leaders || []).includes(uid) ||
      (community.curators || []).includes(uid)
    ));
    // Non-staff cannot see disabled, hidden, or soft-deleted posts in the feed.
    // Staff still see disabled/hidden posts so they can re-enable from the moderation panel,
    // but hard-deleted posts (isDeleted) are hidden for everyone.
    const combined = isCommunityStaff
      ? [...blogs, ...posts].filter(p => !p.isDeleted)
      : [...blogs, ...posts].filter(p => !p.isDisabled && !p.isHidden && !p.isDeleted);
    const announcementIds = community?.announcements || [];
    const featuredIds = community?.featuredPosts || [];
    
    // Sort: pinned announcements first, then featured, then by date
    combined.sort((a, b) => {
      const aIsPinned = announcementIds.includes(a.id);
      const bIsPinned = announcementIds.includes(b.id);
      const aIsFeatured = featuredIds.includes(a.id);
      const bIsFeatured = featuredIds.includes(b.id);
      
      // 1. Pinned posts have highest priority
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // 2. If both pinned or both not pinned, check featured status
      if (aIsPinned === bIsPinned) {
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;
        
        // 3. If both have same pinned and featured status, sort by date
        if (aIsFeatured === bIsFeatured) {
          const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return bTime - aTime; // Descending order (newest first)
        }
      }
      
      return 0;
    });
    setAllPosts(combined);
  }, [blogs, posts, community?.announcements, community?.featuredPosts, community?.creatorId, community?.leaders, community?.curators, currentUser]);

  // Fetch drafts from Firestore
  useEffect(() => {
    if (!communityId || !currentUser?.id) return;
    // db is now imported globally
    const draftsCol = collection(db, 'communities', communityId, 'drafts');

    // Real-time listener for drafts
    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
        const q = firestore.query(
          draftsCol,
          firestore.where('authorId', '==', currentUser.id)
        );
        unsubscribe = firestore.onSnapshot(q, (snapshot) => {
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
      } catch (error) {
        console.error('Error setting up drafts listener:', error);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [communityId, currentUser?.id]);

  // Real-time listener for community groups
  useEffect(() => {
    if (!communityId) return;

    let unsubscribe = null;

    (async () => {
      try {
        const firestore = await import('firebase/firestore');
        const groupsCol = collection(db, 'communities', communityId, 'groups');
        // Simplified query - just filter by isActive, sort on client side
        const q = firestore.query(
          groupsCol,
          firestore.where('isActive', '==', true)
        );

        unsubscribe = firestore.onSnapshot(q, (snapshot) => {
          const groupsList = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          // Sort by createdAt on client side
          groupsList.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
            const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
            return bTime - aTime; // Descending order (newest first)
          });

          setCommunityGroups(groupsList);
          console.log('Community groups loaded:', groupsList.length);
        }, (error) => {
          console.error('Error fetching community groups:', error);
        });
      } catch (error) {
        console.error('Error setting up groups listener:', error);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [communityId]);

  // Check which groups current user has joined
  useEffect(() => {
    if (!communityId || !currentUser?.id || communityGroups.length === 0) return;

    const checkJoinedGroups = async () => {
      try {
        const joinedIds = [];

        for (const group of communityGroups) {
          const memberRef = doc(db, 'communities', communityId, 'groups', group.id, 'members', currentUser.id);
          const memberSnap = await getDoc(memberRef);

          if (memberSnap.exists()) {
            joinedIds.push(group.id);
          }
        }

        setJoinedGroupIds(joinedIds);
      } catch (error) {
        console.error('Error checking joined groups:', error);
      }
    };

    checkJoinedGroups();
  }, [communityId, currentUser?.id, communityGroups]);

  // Fetch activity stats and online members in real-time
  useEffect(() => {
    if (!communityId) return;
    // db is now imported globally

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
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const safeUri = await normalizeBlobUri(result.assets[0].uri);
        setSelectedChatImage(safeUri);
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
        mediaTypes: ['videos'],
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
  const handleVoiceChatClick = async () => {
    setShowGiftOptions(false);
    setSelectedGiftOption(null);

    // Create voice room message in chat
    await createVoiceRoomMessage();
  };

  const createVoiceRoomMessage = async () => {
    if (!currentUser?.id || !communityId) {
      Alert.alert('Error', 'Unable to create voice room');
      return;
    }

    try {
      // db is now imported globally
      const firestore = await import('firebase/firestore');

      // Create a new audio room first
      const roomId = `room_${Date.now()}_${currentUser.id}`;
      const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);

      const now = new Date().toISOString();

      console.log('Creating audio room:', roomId);
      await setDoc(roomRef, {
        communityId: communityId,
        communityName: community?.name || groupTitle || 'Community',
        createdBy: currentUser.id,
        createdByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
          joinedAt: now,
          isMuted: false,
          isSpeaking: false,
        }],
        isActive: true,
      });

      // Create voice room message in chat
      const chatCol = collection(db, 'community_chats', communityId, 'messages');

      const messageData = {
        sender: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        senderId: currentUser?.id || 'user',
        profileImage: currentUser?.profileImage || null,
        createdAt: firestore.serverTimestamp(),
        type: 'voiceChat',
        roomId: roomId,
        participants: [currentUser.id],
        isActive: true,
        text: '', // Add empty text field
      };

      console.log('Creating voice room message:', messageData);
      const docRef = await firestore.addDoc(chatCol, messageData);
      console.log('Voice room message created with ID:', docRef.id);

      Alert.alert('Success', 'Voice room created! Others can now join from chat.');

      // Auto-join the room
      setTimeout(() => {
        navigation.navigate('GroupAudioCall', {
          communityId: communityId,
          roomId: roomId,
          groupTitle: community?.name || groupTitle || 'Community',
        });
      }, 500);
    } catch (e) {
      console.log('Error creating voice room:', e);
      Alert.alert('Error', 'Failed to create voice room: ' + e.message);
    }
  };

  const createScreeningRoomMessage = async () => {
    if (!currentUser?.id || !communityId) {
      Alert.alert('Error', 'Unable to create screening room');
      return;
    }

    try {
      // db is now imported globally
      const firestore = await import('firebase/firestore');

      // Create a new screening room
      const roomId = `screening_${Date.now()}_${currentUser.id}`;
      const roomRef = doc(db, 'screening_rooms', roomId);

      const now = new Date().toISOString();

      console.log('Creating screening room:', roomId);
      await setDoc(roomRef, {
        communityId: communityId,
        communityName: community?.name || groupTitle || 'Community',
        createdBy: currentUser.id,
        createdByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
          joinedAt: now,
        }],
        isActive: true,
        playlist: [],
        currentVideo: null,
      });

      // Create screening room message in chat
      const chatCol = collection(db, 'community_chats', communityId, 'messages');

      const messageData = {
        sender: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        senderId: currentUser?.id || 'user',
        profileImage: currentUser?.profileImage || null,
        createdAt: firestore.serverTimestamp(),
        type: 'screeningRoom',
        roomId: roomId,
        participants: [currentUser.id],
        isActive: true,
        text: '',
      };

      console.log('Creating screening room message:', messageData);
      const docRef = await firestore.addDoc(chatCol, messageData);
      console.log('Screening room message created with ID:', docRef.id);

      Alert.alert('Success', 'Screening room created! Others can now join from chat.');

      // Auto-join the room
      setTimeout(() => {
        navigation.navigate('ScreenSharingRoom', {
          communityId: communityId,
          roomId: roomId,
          groupTitle: community?.name || groupTitle || 'Community',
        });
      }, 500);
    } catch (e) {
      console.log('Error creating screening room:', e);
      Alert.alert('Error', 'Failed to create screening room: ' + e.message);
    }
  };

  const createRoleplayMessage = async (scenario, roles) => {
    if (!currentUser?.id || !communityId) {
      Alert.alert('Error', 'Unable to create roleplay session');
      return;
    }

    if (!scenario.trim()) {
      Alert.alert('Error', 'Please enter a scenario for the roleplay');
      return;
    }

    if (roles.length === 0 || roles.every(r => !r.name.trim())) {
      Alert.alert('Error', 'Please add at least one role');
      return;
    }

    try {
      // db is now imported globally
      const firestore = await import('firebase/firestore');

      // Create a new roleplay session
      const sessionId = `roleplay_${Date.now()}_${currentUser.id}`;
      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);

      const now = new Date().toISOString();

      // Filter out empty roles and add taken status
      const validRoles = roles
        .filter(r => r.name.trim())
        .map(r => ({
          id: r.id,
          name: r.name.trim(),
          description: r.description.trim(),
          taken: false,
          takenBy: null,
          takenByName: null,
        }));

      console.log('Creating roleplay session:', sessionId);
      await setDoc(sessionRef, {
        communityId: communityId,
        communityName: community?.name || groupTitle || 'Community',
        createdBy: currentUser.id,
        createdByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
          joinedAt: now,
          role: 'Host',
          roleId: null,
        }],
        isActive: true,
        scenario: scenario.trim(),
        roles: validRoles,
        messages: [],
      });

      // Create roleplay message in chat
      const chatCol = collection(db, 'community_chats', communityId, 'messages');

      const messageData = {
        sender: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        senderId: currentUser?.id || 'user',
        profileImage: currentUser?.profileImage || null,
        createdAt: firestore.serverTimestamp(),
        type: 'roleplay',
        sessionId: sessionId,
        participants: [currentUser.id],
        isActive: true,
        text: '',
        scenario: scenario.trim(),
        roles: validRoles,
        availableRoles: validRoles.length,
      };

      console.log('Creating roleplay message:', messageData);
      const docRef = await firestore.addDoc(chatCol, messageData);
      console.log('Roleplay message created with ID:', docRef.id);

      Alert.alert('Success', 'Roleplay session created! Others can now join and select roles.');

      // Reset form
      setRoleplayScenario('');
      setRoleplayRoles([{ id: 1, name: '', description: '', taken: false, takenBy: null }]);
      setNextRoleId(2);
      setShowRoleplaySetup(false);
    } catch (e) {
      console.log('Error creating roleplay session:', e);
      Alert.alert('Error', 'Failed to create roleplay session: ' + e.message);
    }
  };

  // Fetch Voice Chat Details
  const fetchVoiceChatDetails = async (messageId) => {
    if (!communityId || !messageId) return;

    try {
      // db is now imported globally
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
        // Upload chunk to Hostinger
        const audioUrl = await uploadAudioToHostinger(uri, 'voice_chat_realtime');

        // Save chunk URL to Firestore for other participants
        // db is now imported globally
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
      // db is now imported globally
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
        sender: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
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
          const voiceUrl = await uploadAudioToHostinger(voiceChatRecordingUri, 'voice_chat_audio');
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
  const handleJoinVoiceChat = async (messageId, roomId, currentParticipants = []) => {
    if (!currentUser?.id || !communityId || !roomId) {
      Alert.alert('Error', 'Unable to join voice room. Missing required information.');
      return;
    }

    try {
      // db is now imported globally
      const roomRef = doc(db, 'audio_calls', communityId, 'rooms', roomId);
      const messageRef = doc(db, 'community_chats', communityId, 'messages', messageId);

      // Check if room exists
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        Alert.alert('Room Unavailable', 'This voice room no longer exists.');
        return;
      }

      const roomData = roomSnap.data();
      if (!roomData.isActive) {
        Alert.alert('Room Inactive', 'This voice room has ended.');
        return;
      }

      // Add user to participants if not already there
      // Support both array of strings and array of objects
      const hasUser = Array.isArray(currentParticipants) && currentParticipants.length > 0 &&
        (typeof currentParticipants[0] === 'string'
          ? currentParticipants.includes(currentUser.id)
          : currentParticipants.some(p => p.userId === currentUser.id));
      if (!hasUser) {
        const now = new Date().toISOString();

        // Update room participants
        await updateDoc(roomRef, {
          participants: arrayUnion({
            userId: currentUser.id,
            userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
            profileImage: currentUser.profileImage || null,
            joinedAt: now,
            isMuted: false,
            isSpeaking: false,
          }),
          updatedAt: now,
        });

        // Update message participants
        await updateDoc(messageRef, {
          participants: arrayUnion(currentUser.id),
        });
      }

      // Navigate to audio call screen
      navigation.navigate('GroupAudioCall', {
        communityId: communityId,
        roomId: roomId,
        groupTitle: community?.name || groupTitle || 'Community',
      });
    } catch (e) {
      console.error('Error joining voice chat:', e);
      Alert.alert('Error', 'Failed to join voice room. Please try again.');
    }
  };

  const handleJoinScreeningRoom = async (messageId, roomId, currentParticipants = []) => {
    if (!currentUser?.id || !communityId || !roomId) {
      Alert.alert('Error', 'Unable to join screening room. Missing required information.');
      return;
    }

    try {
      // db is now imported globally
      const roomRef = doc(db, 'screening_rooms', roomId);
      const messageRef = doc(db, 'community_chats', communityId, 'messages', messageId);

      // Check if room exists
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        Alert.alert('Room Unavailable', 'This screening room no longer exists.');
        return;
      }

      const roomData = roomSnap.data();
      if (!roomData.isActive) {
        Alert.alert('Room Inactive', 'This screening room has ended.');
        return;
      }

      // Add user to participants if not already there
      // Support both array of strings and array of objects
      const hasUser2 = Array.isArray(currentParticipants) && currentParticipants.length > 0 &&
        (typeof currentParticipants[0] === 'string'
          ? currentParticipants.includes(currentUser.id)
          : currentParticipants.some(p => p.userId === currentUser.id));
      if (!hasUser2) {
        const now = new Date().toISOString();

        // Update room participants
        await updateDoc(roomRef, {
          participants: arrayUnion({
            userId: currentUser.id,
            userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
            profileImage: currentUser.profileImage || null,
            joinedAt: now,
          }),
          updatedAt: now,
        });

        // Update message participants
        await updateDoc(messageRef, {
          participants: arrayUnion(currentUser.id),
        });
      }

      // Navigate to screening room
      navigation.navigate('ScreenSharingRoom', {
        communityId: communityId,
        roomId: roomId,
        groupTitle: community?.name || groupTitle || 'Community',
      });
    } catch (e) {
      console.log('Error joining screening room:', e);
      Alert.alert('Error', 'Failed to join screening room: ' + e.message);
    }
  };

  // Character Collection Management Functions
  const saveCharacterToCollection = async () => {
    if (!characterName.trim()) {
      Alert.alert('Required', 'Please enter a character name');
      return;
    }

    try {
      // db is now imported globally
      const userRef = doc(db, 'users', currentUser.id);

      let updatedCollection;

      if (editingCharacterId) {
        // Update existing character
        updatedCollection = characterCollection.map(char =>
          char.id === editingCharacterId
            ? {
              ...char,
              avatar: characterAvatar,
              name: characterName.trim(),
              subtitle: characterSubtitle.trim(),
              themeColor: characterThemeColor,
              gender: characterGender,
              language: characterLanguage,
              tags: characterTags,
              age: characterAge,
              height: characterHeight,
              description: characterDescription.trim(),
              greeting: characterGreeting.trim(),
              updatedAt: new Date().toISOString(),
            }
            : char
        );
      } else {
        // Add new character
        const newCharacter = {
          id: Date.now().toString(),
          avatar: characterAvatar,
          name: characterName.trim(),
          subtitle: characterSubtitle.trim(),
          themeColor: characterThemeColor,
          gender: characterGender,
          language: characterLanguage,
          tags: characterTags,
          age: characterAge,
          height: characterHeight,
          description: characterDescription.trim(),
          greeting: characterGreeting.trim(),
          createdAt: new Date().toISOString(),
        };
        updatedCollection = [...characterCollection, newCharacter];
      }

      // Save to Firestore
      await updateDoc(userRef, {
        characterCollection: updatedCollection,
      });

      // Update local state
      setCharacterCollection(updatedCollection);

      // Check if this character creation was for joining a roleplay
      if (pendingRoleplayJoin) {
        // User was creating character to join roleplay
        const createdCharacter = editingCharacterId
          ? updatedCollection.find(c => c.id === editingCharacterId)
          : updatedCollection[updatedCollection.length - 1];

        // Close roleplay creation screen
        setShowMiniScreen(null);
        setRoleplayPage(1);

        // Reset form
        setCharacterAvatar('');
        setCharacterName('');
        setCharacterSubtitle('');
        setCharacterThemeColor('#FFD700');
        setCharacterGender('');
        setCharacterLanguage('English');
        setCharacterTags([]);
        setCharacterAge('');
        setCharacterHeight('');
        setCharacterDescription('');
        setCharacterGreeting('');
        setEditingCharacterId(null);

        // Set selected character and proceed to role selection
        setSelectedCharacterForRoleplay(createdCharacter);

        Alert.alert(
          'Character Created!',
          `"${createdCharacter.name}" is ready! Now select a role for this roleplay.`,
          [
            {
              text: 'Choose Role',
              onPress: () => {
                proceedToRoleSelection();
              }
            }
          ]
        );
      } else {
        // Normal character creation for roleplay session
        // Reset form and go to collection page
        setCharacterAvatar('');
        setCharacterName('');
        setCharacterSubtitle('');
        setCharacterThemeColor('#FFD700');
        setCharacterGender('');
        setCharacterLanguage('English');
        setCharacterTags([]);
        setCharacterAge('');
        setCharacterHeight('');
        setCharacterDescription('');
        setCharacterGreeting('');
        setEditingCharacterId(null);
        setRoleplayPage(5);

        Alert.alert('Success', editingCharacterId ? 'Character updated!' : 'Character saved!');
      }
    } catch (error) {
      console.log('Error saving character:', error);
      Alert.alert('Error', 'Failed to save character: ' + error.message);
    }
  };

  const removeCharacterFromCollection = async (characterId) => {
    try {
      // db is now imported globally
      const userRef = doc(db, 'users', currentUser.id);

      const updatedCollection = characterCollection.filter(char => char.id !== characterId);

      await updateDoc(userRef, {
        characterCollection: updatedCollection,
      });

      setCharacterCollection(updatedCollection);

      // Also remove from selected if it was selected
      setSelectedCharactersForSession(prev => prev.filter(char => char.id !== characterId));

      Alert.alert('Success', 'Character removed from collection');
    } catch (error) {
      console.log('Error removing character:', error);
      Alert.alert('Error', 'Failed to remove character: ' + error.message);
    }
  };

  const startRoleplayWithCharacters = async () => {
    if (selectedCharactersForSession.length === 0) {
      Alert.alert('No Characters', 'Please select at least one character for the roleplay session');
      return;
    }

    try {
      // Check if we're joining an existing roleplay or creating a new one
      if (pendingRoleplayJoin) {
        // Join existing roleplay with selected character(s)
        const { messageId, sessionId, returnToRoleplay } = pendingRoleplayJoin;
        const now = new Date().toISOString();

        if (!sessionId) {
          Alert.alert('Error', 'Invalid session ID');
          return;
        }

        const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
        const messageRef = messageId ? doc(db, 'community_chats', communityId, 'messages', messageId) : null;

        // Get current session data
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) {
          Alert.alert('Error', 'Roleplay session no longer exists');
          return;
        }

        const sessionData = sessionSnap.data();
        const isReturningToRoleplay = returnToRoleplay === true;

        console.log('Character switch debug:', {
          isReturningToRoleplay,
          sessionId,
          hasMessageId: !!messageId,
          selectedCharactersCount: selectedCharactersForSession.length,
          currentUserId: currentUser.id,
        });

        // Check if user is already a participant
        const existingParticipantIndex = (sessionData.participants || []).findIndex(
          p => p && p.userId === currentUser.id
        );

        console.log('Existing participant index:', existingParticipantIndex);

        let updatedParticipants = [...(sessionData.participants || [])];
        let updatedCharacters = [...(sessionData.characters || [])];

        if (isReturningToRoleplay && existingParticipantIndex >= 0) {
          // User is switching character - update existing participant
          console.log('Switching character for existing participant');

          // Remove old characters owned by this user
          updatedCharacters = updatedCharacters.filter(char => char && char.ownerId !== currentUser.id);

          console.log('Characters after removing old:', updatedCharacters.length);

          // Add new selected characters
          const newCharacters = selectedCharactersForSession.map(char => ({
            id: char.id || `char_${Date.now()}`,
            name: char.name || 'Unnamed Character',
            avatar: char.avatar || char.imageUrl || '',
            themeColor: char.themeColor || char.frameColor || '#FFD700',
            description: char.description || '',
            ownerId: currentUser.id,
            ownerName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
            available: true,
          }));

          updatedCharacters.push(...newCharacters);
          console.log('Characters after adding new:', updatedCharacters.length);

          // Update participant's character list
          updatedParticipants[existingParticipantIndex].characters = selectedCharactersForSession.map(c => c.id);

          console.log('Updating session with new character data...');

          // Update session with modified arrays
          await updateDoc(sessionRef, {
            participants: updatedParticipants,
            characters: updatedCharacters,
            updatedAt: now,
          });

          console.log('Session updated successfully');

        } else {
          // New user joining - add as new participant
          console.log('Adding new participant to roleplay');

          const newParticipant = {
            userId: currentUser.id,
            userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
            profileImage: currentUser.profileImage || currentUser.avatar || null,
            joinedAt: now,
            characters: selectedCharactersForSession.map(c => c.id || `char_${Date.now()}`),
          };

          updatedParticipants.push(newParticipant);

          // Add new characters
          const newCharacters = selectedCharactersForSession.map(char => ({
            id: char.id || `char_${Date.now()}`,
            name: char.name || 'Unnamed Character',
            avatar: char.avatar || char.imageUrl || '',
            themeColor: char.themeColor || char.frameColor || '#FFD700',
            description: char.description || '',
            ownerId: currentUser.id,
            ownerName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
            available: true,
          }));

          updatedCharacters.push(...newCharacters);

          console.log('Updating session with new participant...');

          // Update session
          await updateDoc(sessionRef, {
            participants: updatedParticipants,
            characters: updatedCharacters,
            updatedAt: now,
          });

          console.log('Session updated with new participant');

          // Update message (only for new joins and if messageRef exists)
          if (messageRef && messageId) {
            try {
              await updateDoc(messageRef, {
                participants: arrayUnion(currentUser.id),
                participantsDetails: arrayUnion({
                  userId: currentUser.id,
                  userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
                  profileImage: currentUser.profileImage,
                }),
                availableCharacters: updatedCharacters.length,
              });
            } catch (msgError) {
              console.log('Error updating message (non-critical):', msgError);
              // Continue even if message update fails
            }
          }
        }

        // Clear state
        const wasReturningToRoleplay = returnToRoleplay === true;
        setSelectedCharactersForSession([]);
        setPendingRoleplayJoin(null);
        setRoleplayPage(1);

        // Navigate to RoleplayScreen
        navigation.navigate('RoleplayScreen', {
          communityId: communityId,
          sessionId: sessionId,
          groupTitle: community?.name || groupTitle || 'Roleplay',
          myCharacters: selectedCharactersForSession,
          characterSwitched: wasReturningToRoleplay, // Flag to indicate character was switched
        });

        return;
      }

      // Create new roleplay session
      // db is now imported globally
      const sessionId = Date.now().toString();
      const now = new Date().toISOString();

      // Create roleplay session document
      const sessionData = {
        sessionId: sessionId,
        communityId: communityId,
        createdBy: currentUser.id,
        createdByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        createdAt: now,
        updatedAt: now,
        characters: selectedCharactersForSession.map(char => ({
          ...char,
          ownerId: currentUser.id,
          ownerName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          available: true,
        })),
        participants: [{
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
          joinedAt: now,
          characters: selectedCharactersForSession.map(c => c.id),
        }],
        status: 'active',
      };

      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
      await setDoc(sessionRef, sessionData);

      // Create message in community chat
      const firestore = await import('firebase/firestore');
      const messageRef = doc(collection(db, 'community_chats', communityId, 'messages'));
      const messageData = {
        senderId: currentUser.id,
        sender: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        senderName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        profileImage: currentUser.profileImage,
        text: `Started a roleplay session with ${selectedCharactersForSession.length} character(s)`,
        createdAt: firestore.serverTimestamp(),
        type: 'roleplay',
        sessionId: sessionId,
        characters: selectedCharactersForSession.map(char => ({
          id: char.id,
          name: char.name,
          avatar: char.avatar,
          subtitle: char.subtitle,
          themeColor: char.themeColor,
          gender: char.gender,
          age: char.age,
          height: char.height,
          language: char.language,
          tags: char.tags,
          description: char.description,
          greeting: char.greeting,
          ownerName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        })),
        participants: [currentUser.id],
        participantsDetails: [{
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
        }],
        isActive: true,
        availableCharacters: selectedCharactersForSession.length,
      };

      await setDoc(messageRef, messageData);

      // Clear selection
      setSelectedCharactersForSession([]);
      setRoleplayPage(1);

      // Navigate to RoleplayScreen
      navigation.navigate('RoleplayScreen', {
        communityId: communityId,
        sessionId: sessionId,
        groupTitle: community?.name || groupTitle || 'Roleplay',
        myCharacters: selectedCharactersForSession,
      });
    } catch (error) {
      console.log('Error starting roleplay:', error);
      Alert.alert('Error', 'Failed to start roleplay session: ' + error.message);
    }
  };

  const handleJoinRoleplay = async (messageId, sessionId, roles, currentParticipants = []) => {
    if (!currentUser?.id || !communityId || !sessionId) {
      Alert.alert('Error', 'Unable to join roleplay session');
      return;
    }

    try {
      // db is now imported globally
      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);

      // Check if session exists
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) {
        Alert.alert('Error', 'Roleplay session no longer exists');
        return;
      }

      const sessionData = sessionSnap.data();
      const availableRoles = (sessionData.roles || []).filter(r => !r.taken);

      // Check if user already has characters in this session
      const userCharacters = (sessionData.characters || []).filter(
        char => char.ownerId === currentUser.id
      );

      // If user has characters, they can rejoin - but still need to select character via mini screen
      // Always show mini screens - user must select/create character to join

      // Store roleplay join details for later use
      setPendingRoleplayJoin({ messageId, sessionId, availableRoles });

      // Directly show mini screens for roleplay
      setShowMiniScreen('roleplay');
      setRoleplayPage(1); // Start at character creation page
    } catch (e) {
      console.log('Error joining roleplay:', e);
      Alert.alert('Error', 'Failed to join roleplay session: ' + e.message);
    }
  };

  // After character is selected, proceed to roleplay mini screens
  const proceedToRoleSelection = () => {
    if (!pendingRoleplayJoin) return;

    // Close character selector
    setShowCharacterSelectorForJoin(false);

    // Show mini screen with roleplay character creation/selection
    setShowMiniScreen('roleplay');
    setRoleplayPage(1); // Start at character creation page
  };

  const confirmRoleSelection = async (selectedRole) => {
    if (!selectedRoleplayToJoin || !selectedRole) return;

    const { messageId, sessionId } = selectedRoleplayToJoin;

    try {
      // db is now imported globally
      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
      const messageRef = doc(db, 'community_chats', communityId, 'messages', messageId);
      const now = new Date().toISOString();

      // Get current session data
      const sessionSnap = await getDoc(sessionRef);
      const sessionData = sessionSnap.data();

      // Update the selected role as taken
      const updatedRoles = sessionData.roles.map(r =>
        r.id === selectedRole.id
          ? { ...r, taken: true, takenBy: currentUser.id, takenByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User' }
          : r
      );

      // Update session
      await updateDoc(sessionRef, {
        participants: arrayUnion({
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
          joinedAt: now,
          role: selectedRole.name,
          roleId: selectedRole.id,
        }),
        roles: updatedRoles,
        updatedAt: now,
      });

      // Update message
      const availableRolesCount = updatedRoles.filter(r => !r.taken).length;
      await updateDoc(messageRef, {
        participants: arrayUnion(currentUser.id),
        roles: updatedRoles,
        availableRoles: availableRolesCount,
      });

      setShowRoleSelectModal(false);
      setSelectedRoleplayToJoin(null);

      // Navigate to RoleplayScreen
      navigation.navigate('RoleplayScreen', {
        communityId: communityId,
        sessionId: sessionId,
        groupTitle: community?.name || groupTitle || 'Roleplay',
        selectedRole: selectedRole,
      });

    } catch (e) {
      console.log('Error confirming role:', e);
      Alert.alert('Error', 'Failed to join with selected role: ' + e.message);
    }
  };

  const createAndJoinCustomRole = async () => {
    if (!customRoleName.trim()) {
      Alert.alert('Error', 'Please enter a role name');
      return;
    }

    if (!selectedRoleplayToJoin) return;

    const { messageId, sessionId } = selectedRoleplayToJoin;

    try {
      // db is now imported globally
      const sessionRef = doc(db, 'roleplay_sessions', communityId, 'sessions', sessionId);
      const messageRef = doc(db, 'community_chats', communityId, 'messages', messageId);
      const now = new Date().toISOString();

      // Get current session data
      const sessionSnap = await getDoc(sessionRef);
      const sessionData = sessionSnap.data();

      // Create new custom role
      const newRoleId = `custom_${Date.now()}_${currentUser.id}`;
      const customRole = {
        id: newRoleId,
        name: customRoleName.trim(),
        description: customRoleDescription.trim(),
        taken: true,
        takenBy: currentUser.id,
        takenByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
        isCustom: true,
      };

      // Add custom role to roles array
      const updatedRoles = [...(sessionData.roles || []), customRole];

      // Update session
      await updateDoc(sessionRef, {
        participants: arrayUnion({
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          profileImage: currentUser.profileImage,
          joinedAt: now,
          role: customRole.name,
          roleId: customRole.id,
        }),
        roles: updatedRoles,
        updatedAt: now,
      });

      // Update message
      const availableRolesCount = updatedRoles.filter(r => !r.taken).length;
      await updateDoc(messageRef, {
        participants: arrayUnion(currentUser.id),
        roles: updatedRoles,
        availableRoles: availableRolesCount,
      });

      // Reset custom role inputs
      setCustomRoleName('');
      setCustomRoleDescription('');
      setShowCustomRoleInput(false);
      setShowRoleSelectModal(false);
      setSelectedRoleplayToJoin(null);

      // Navigate to RoleplayScreen
      navigation.navigate('RoleplayScreen', {
        communityId: communityId,
        sessionId: sessionId,
        groupTitle: community?.name || groupTitle || 'Roleplay',
        selectedRole: customRole,
      });

    } catch (e) {
      console.log('Error creating custom role:', e);
      Alert.alert('Error', 'Failed to create custom role: ' + e.message);
    }
  };

  const handleSendMessage = useCallback(async () => {
    // Check if there's anything to send
    if (chatInput.trim() === '' && !selectedChatImage && !selectedChatVideo && !recordingUri) return;

    // Prevent multiple simultaneous sends
    if (chatLoading) return;

    // Store message data locally before clearing input
    const messageText = chatInput.trim();
    const imageToSend = selectedChatImage;
    const videoToSend = selectedChatVideo;
    const voiceToSend = recordingUri;

    // React 18 automatically batches these state updates for optimal performance
    // Clear input and attachments immediately for better UX
    setChatInput('');
    setSelectedChatImage(null);
    setSelectedChatVideo(null);
    setRecordingUri(null);
    setChatLoading(true);

    try {
      // db is now imported globally
      const chatCol = collection(db, 'community_chats', communityId, 'messages');

      const messageData = {
        sender: currentUser?.communityNickname || communityNickname || currentUser?.name || currentUser?.displayName || 'User',
        senderName: currentUser?.communityNickname || communityNickname || currentUser?.name || currentUser?.displayName || 'User',
        senderId: currentUser?.id || 'user',
        profileImage: currentUser?.profileImage || null,
        createdAt: (await import('firebase/firestore')).serverTimestamp(),
        type: 'text', // default type
        textColor: selectedTextColor, // Add text color to message
      };

      // Handle text message
      if (messageText !== '') {
        messageData.text = messageText;
      }

      // Handle image message
      if (imageToSend) {
        try {
          const imageUrl = await uploadImageToHostinger(imageToSend, 'chat_images');
          messageData.imageUrl = imageUrl;
          messageData.type = messageData.text ? 'text_image' : 'image';
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload image');
          // Restore the input on error
          setChatInput(messageText);
          setSelectedChatImage(imageToSend);
          setChatLoading(false);
          return;
        }
      }

      // Handle video message
      if (videoToSend) {
        try {
          const videoUrl = await uploadVideoToHostinger(videoToSend, 'chat_videos');
          messageData.videoUrl = videoUrl;
          messageData.type = messageData.text ? 'text_video' : (messageData.imageUrl ? 'image_video' : 'video');
        } catch (error) {
          console.error('Error uploading video:', error);
          Alert.alert('Error', 'Failed to upload video');
          // Restore the input on error
          setChatInput(messageText);
          setSelectedChatVideo(videoToSend);
          setChatLoading(false);
          return;
        }
      }

      // Handle voice message
      if (voiceToSend) {
        try {
          // Upload voice file to Hostinger
          const voiceUrl = await uploadAudioToHostinger(voiceToSend, 'chat_voice');
          messageData.voiceUrl = voiceUrl;
          // Update type considering video
          if (messageData.videoUrl) {
            messageData.type = messageData.text ? 'text_video_voice' : (messageData.imageUrl ? 'image_video_voice' : 'video_voice');
          } else {
            messageData.type = messageData.text ? 'text_voice' : (messageData.imageUrl ? 'image_voice' : 'voice');
          }
          messageData.duration = 0; // You can calculate duration if needed
        } catch (error) {
          console.error('Error uploading voice:', error);
          Alert.alert('Error', 'Failed to upload voice message. Please try again.');
          // Restore the input on error
          setRecordingUri(voiceToSend);
          setChatLoading(false);
          return;
        }
      }

      // Add message to Firestore
      const firestore = await import('firebase/firestore');
      await firestore.addDoc(chatCol, messageData);

      // Success - reset scroll state to re-enable auto-scroll
      setIsUserScrolling(false);

      // Force scroll to bottom after sending message with longer delay
      // This ensures the message is received from Firestore listener and rendered
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 300);

      // Additional scroll after a bit more time to ensure rendering is complete
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 600);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      // Restore the input on error
      setChatInput(messageText);
      if (imageToSend) setSelectedChatImage(imageToSend);
      if (videoToSend) setSelectedChatVideo(videoToSend);
      if (voiceToSend) setRecordingUri(voiceToSend);
    } finally {
      // Always clear loading state
      setChatLoading(false);
    }
  }, [chatInput, selectedChatImage, selectedChatVideo, recordingUri, currentUser, communityId, selectedTextColor]);

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

  // Optimistic like (Facebook-style: instant UI, background Firestore)
  const handleToggleLike = useCallback((post) => {
    if (!currentUser?.id) {
      Alert.alert('Login Required', 'Please log in to like posts.');
      return;
    }
    if (!post?.id) {
      console.warn('handleToggleLike: Invalid post');
      return;
    }

    const likeKey = `${post.type}-${post.id}`;
    // Ref-based debounce — no re-render, instant check
    if (likeDebounceRef.current.has(likeKey)) return;
    likeDebounceRef.current.add(likeKey);

    // Compute optimistic state from current local data
    const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
    const alreadyLiked = likedBy.includes(currentUser.id);
    const newLikedBy = alreadyLiked
      ? likedBy.filter((id) => id !== currentUser.id)
      : [...likedBy, currentUser.id];
    const currentLikeCount = typeof post.likes === 'number' ? post.likes : likedBy.length;
    const newLikes = alreadyLiked ? Math.max(0, currentLikeCount - 1) : currentLikeCount + 1;

    // 1. Instant UI update — no waiting for Firestore
    updateLocalPostState(post.id, post.type, () => ({ likedBy: newLikedBy, likes: newLikes }));

    // 2. Haptic feedback
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}

    // 3. Background Firestore write — fire and forget
    const postRef = getPostDocRef(db, post);
    updateDoc(postRef, {
      likedBy: alreadyLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
      likes: increment(alreadyLiked ? -1 : 1),
    }).catch((err) => {
      // Silent rollback on failure
      console.log('Like sync failed, rolling back:', err);
      updateLocalPostState(post.id, post.type, () => ({ likedBy, likes: currentLikeCount }));
    }).finally(() => {
      likeDebounceRef.current.delete(likeKey);
    });
  }, [currentUser, communityId]);

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

  // Navigate to user profile when clicking on profile icon
  const handleProfilePress = (userId) => {
    if (userId && userId !== currentUser?.id) {
      navigation.navigate('Profile', { userId });
    }
  };

  // Fetch comments for a specific post
  const fetchCommentsForPost = async (post) => {
    if (!post?.id || !communityId) return;

    setCommentsLoading(true);
    try {
      // db is now imported globally
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
    if (!currentUser?.id || !selectedPostForComment?.id) {
      console.warn('handleSubmitComment: Missing required data');
      return;
    }

    setCommentSaving(true);

    try {
      // db is now imported globally
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

        const postData = postSnap.data();
        const currentComments = typeof postData.comments === 'number'
          ? postData.comments
          : 0;

        // Add the comment document
        const commentRef = doc(commentsCol);
        transaction.set(commentRef, {
          text,
          userId: currentUser.id,
          userName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
          userImage: currentUser.profileImage || null,
          createdAt: firestore.serverTimestamp(),
        });

        // Update comment count atomically
        transaction.update(postRef, {
          comments: currentComments + 1,
        });
      });

      // Real-time listener will update the UI
      setCommentText('');
      // Keep modal open to show the new comment
    } catch (e) {
      console.error('Error adding comment:', e);
      Alert.alert('Error', 'Unable to post comment. Please try again.');
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

        // Update local state
        setFollowingUserIds((prev) => prev.filter((id) => id !== targetUserId));
        setUserStats((prev) => ({
          ...prev,
          following: Math.max(0, prev.following - 1),
        }));
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

        // Update local state
        setFollowingUserIds((prev) => [...prev, targetUserId]);
        setUserStats((prev) => ({
          ...prev,
          following: prev.following + 1,
        }));
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
      // db is now imported globally
      const draftsCol = collection(db, 'communities', communityId, 'drafts');

      import('firebase/firestore').then(firestore => {
        firestore.addDoc(draftsCol, {
          type: 'blog',
          title: blogTitle,
          content: blogContent,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
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
      // db is now imported globally
      const blogsCol = collection(db, 'communities', communityId, 'blogs');

      // Add blog to Firestore
      import('firebase/firestore').then(firestore => {
        firestore.addDoc(blogsCol, {
          title: blogTitle,
          content: blogContent,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
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
      // db is now imported globally
      const draftsCol = collection(db, 'communities', communityId, 'drafts');

      import('firebase/firestore').then(firestore => {
        firestore.addDoc(draftsCol, {
          type: 'image',
          caption: imageCaption,
          imageUri: selectedImage,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
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
      // Upload image to Hostinger first
      console.log('📤 Uploading community post image to Hostinger...');
      const uploadedUrl = await uploadImageToHostinger(selectedImage, 'posts');
      if (!uploadedUrl || !/^https?:\/\//i.test(uploadedUrl) || uploadedUrl.includes('blob:')) {
        setImageLoading(false);
        alert('Upload returned an invalid URL. Please try again.');
        return;
      }
      console.log('✅ Community post image uploaded:', uploadedUrl);

      // db is now imported globally
      const postsCol = collection(db, 'communities', communityId, 'posts');

      import('firebase/firestore').then(firestore => {
        firestore.addDoc(postsCol, {
          caption: imageCaption,
          imageUri: uploadedUrl,
          authorId: currentUser?.id || 'user',
          authorName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'User',
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
      // db is now imported globally
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
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              const safeUri = await normalizeBlobUri(result.assets[0].uri);
              setSelectedImage(safeUri);
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
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
              allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              const safeUri = await normalizeBlobUri(result.assets[0].uri);
              setSelectedImage(safeUri);
            }
          },
        },
        {
          text: 'Cancel',
          onPress: () => { },
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

  // Handle Leave Community
  const handleLeaveCommunity = () => {
    Alert.alert(
      'Leave Community',
      `Are you sure you want to leave "${community?.name || 'this community'}"? You will be removed from the members list.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Leave & Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!auth.currentUser || !communityId) {
                Alert.alert('Error', 'Unable to leave community at this time.');
                return;
              }

              const userId = auth.currentUser.uid;
              const membershipId = `${userId}_${communityId}`;

              // Delete membership document
              const membershipRef = doc(db, 'communities_members', membershipId);
              await deleteDoc(membershipRef);

              // Update community document - remove user from members array
              const communityRef = doc(db, 'communities', communityId);
              await runTransaction(db, async (transaction) => {
                const communitySnap = await transaction.get(communityRef);
                if (!communitySnap.exists()) {
                  throw new Error('Community not found');
                }

                const communityData = communitySnap.data();

                // Remove from both members and memberIds arrays
                const updatedMembers = Array.isArray(communityData.members)
                  ? communityData.members.filter(id => id !== userId) : [];
                const updatedMemberIds = Array.isArray(communityData.memberIds)
                  ? communityData.memberIds.filter(id => id !== userId) : undefined;

                // Compute true current count using the same combined union logic, then subtract 1
                const _mArr = Array.isArray(communityData.members) ? communityData.members : [];
                const _miArr = Array.isArray(communityData.memberIds) ? communityData.memberIds : [];
                const currentCount = new Set([..._mArr, ..._miArr]).size ||
                  communityData.memberCount || 0;
                const newCount = Math.max(0, currentCount - 1);

                const leaveUpdate = {
                  members: updatedMembers,
                  memberCount: newCount,
                  members_count: Math.max(0, (communityData.members_count || 0) - 1),
                  updatedAt: new Date()
                };
                if (updatedMemberIds !== undefined) {
                  leaveUpdate.memberIds = updatedMemberIds;
                }
                transaction.update(communityRef, leaveUpdate);
              });

              Alert.alert(
                'Left Successfully',
                'You have been removed from the community.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')
                  }
                ]
              );
            } catch (error) {
              console.error('Error leaving community:', error);
              Alert.alert('Error', 'Failed to leave community. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Handle Kick Member (Admin Only)
  const handleKickMember = (memberId, memberName) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only admins can kick members.');
      return;
    }

    Alert.alert(
      'Kick Member',
      `Are you sure you want to remove ${memberName} from this community?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!communityId || !memberId) {
                Alert.alert('Error', 'Unable to remove member at this time.');
                return;
              }

              const membershipId = `${memberId}_${communityId}`;

              // Delete membership document
              const membershipRef = doc(db, 'communities_members', membershipId);
              await deleteDoc(membershipRef);

              // Update community document - remove user from members array
              const communityRef = doc(db, 'communities', communityId);
              await runTransaction(db, async (transaction) => {
                const communitySnap = await transaction.get(communityRef);
                if (!communitySnap.exists()) {
                  throw new Error('Community not found');
                }

                const communityData = communitySnap.data();
                let updatedMembers = [];

                // Handle members array
                if (Array.isArray(communityData.members)) {
                  updatedMembers = communityData.members.filter(id => id !== memberId);
                }

                // Decrement member count
                const currentCount = communityData.memberCount ||
                  (Array.isArray(communityData.members) ? communityData.members.length : 0);
                const newCount = Math.max(0, currentCount - 1);

                transaction.update(communityRef, {
                  members: updatedMembers,
                  memberCount: newCount,
                  updatedAt: new Date()
                });
              });

              // Refresh members list
              setAllMembers(prevMembers => prevMembers.filter(m => m.id !== memberId));
              Alert.alert('Success', `${memberName} has been removed from the community.`);
            } catch (error) {
              console.error('Error kicking member:', error);
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Handle Share Community - Show options
  const handleShareCommunity = () => {
    Alert.alert(
      'Share Community',
      'How would you like to share this community?',
      [
        {
          text: 'Share as Post',
          onPress: handleShareAsPost
        },
        {
          text: 'Share Link',
          onPress: handleShareLink
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // Share via native share dialog
  const handleShareLink = async () => {
    try {
      const result = await Share.share({
        message: `Join "${community?.name || 'our community'}" on Social Vibing!\n\n${inviteLink}`,
        title: `Join ${community?.name || 'our community'}`,
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Community shared successfully!');
      }
    } catch (error) {
      console.error('Error sharing community:', error);
      Alert.alert('Error', 'Failed to share community.');
    }
  };

  // Share as a post in the community
  const handleShareAsPost = async () => {
    try {
      if (!communityId || !currentUser) {
        Alert.alert('Error', 'Unable to share at this time.');
        return;
      }

      const firestore = await import('firebase/firestore');

      // Create post data
      const postData = {
        text: `Check out ${community?.name || 'this community'}! 🎉\n\nJoin us to connect with amazing people and share great content!`,
        authorId: currentUser.id,
        authorName: currentUser.communityNickname || communityNickname || currentUser.name || 'User',
        authorImage: currentUser.profileImage || null,
        communityId: communityId,
        communityName: community?.name || 'Community',
        communityImage: community?.profileImage || null,
        communityDescription: community?.description || '',
        memberCount: community?.memberCount || 0,
        type: 'community_share',
        inviteLink: inviteLink,
        likes: 0,
        comments: 0,
        likedBy: [],
        createdAt: firestore.serverTimestamp(),
      };

      // Post to community's posts collection
      const communityPostsCol = collection(db, 'communities', communityId, 'posts');
      await firestore.addDoc(communityPostsCol, postData);

      // Also post to home feed (main posts collection for discovery)
      const homePostsCol = collection(db, 'posts');
      await firestore.addDoc(homePostsCol, {
        ...postData,
        visibility: 'public',
      });

      Alert.alert('Success', 'Community shared as post!');
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing as post:', error);
      Alert.alert('Error', 'Failed to share community as post.');
    }
  };

  // Handle Copy Invite Link
  const handleCopyInviteLink = async () => {
    try {
      if (!inviteLink) {
        Alert.alert('Error', 'No invite link available.');
        return;
      }
      await Clipboard.setStringAsync(inviteLink);
      Alert.alert('Copied!', 'Invite link copied to clipboard.');
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Error', 'Failed to copy link.');
    }
  };

  // Handle QR Code Download
  const handleDownloadQRCode = async () => {
    try {
      if (!qrCodeValue) {
        Alert.alert('Error', 'No QR code available.');
        return;
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save the QR code to your photos.');
        return;
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCodeValue)}&color=000000&bgcolor=FFFFFF&margin=2`;
      const fileUri = FileSystem.cacheDirectory + `community_qr_${communityId}.png`;
      const downloadRes = await FileSystem.downloadAsync(qrUrl, fileUri);
      const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
      await MediaLibrary.createAlbumAsync('Social Vibing', asset, false);
      Alert.alert('Saved!', 'QR Code saved to your Photos album.');
    } catch (error) {
      console.error('Error downloading QR code:', error);
      Alert.alert('Error', 'Failed to save QR code.');
    }
  };

  // Handle Delete Community
  const handleDeleteCommunity = () => {
    Alert.alert(
      'Delete Community',
      `Are you sure you want to permanently delete "${community?.name || 'this community'}"? This action cannot be undone and will remove all posts, members, and data.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!communityId || !isAdmin) {
                Alert.alert('Error', 'Only admins can delete communities.');
                return;
              }

              // Delete community document
              const communityRef = doc(db, 'communities', communityId);
              await deleteDoc(communityRef);

              // Delete all membership documents
              const membershipsQuery = collection(db, 'communities_members');
              const firestore = await import('firebase/firestore');
              const q = firestore.query(membershipsQuery, firestore.where('community_id', '==', communityId));
              const membershipsSnapshot = await firestore.getDocs(q);

              const deletePromises = membershipsSnapshot.docs.map(doc => deleteDoc(doc.ref));
              await Promise.all(deletePromises);

              // Delete all chat messages (optional - can be heavy operation)
              // For now, just delete the main community

              Alert.alert(
                'Community Deleted',
                'The community has been permanently deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')
                  }
                ]
              );
            } catch (error) {
              console.error('Error deleting community:', error);
              Alert.alert('Error', 'Failed to delete community. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Load announcements when community loads
  useEffect(() => {
    if (!communityId || !community) return;
    
    const loadAnnouncements = async () => {
      setAnnouncementsLoading(true);
      try {
        const announcementIds = community.announcements || [];
        if (announcementIds.length === 0) {
          setAnnouncements([]);
          return;
        }

        // Fetch announcement posts from allPosts
        const announcementPosts = allPosts.filter(post => announcementIds.includes(post.id));
        setAnnouncements(announcementPosts);
      } catch (error) {
        console.error('Error loading announcements:', error);
      } finally {
        setAnnouncementsLoading(false);
      }
    };

    loadAnnouncements();
  }, [communityId, community, allPosts]);

  // Load featured posts when community loads
  useEffect(() => {
    if (!communityId || !community) return;
    
    const loadFeaturedPosts = async () => {
      try {
        const featuredIds = community.featuredPosts || [];
        // Store just the IDs, not the full post objects
        setFeaturedPosts(featuredIds);
      } catch (error) {
        console.error('Error loading featured posts:', error);
      }
    };

    loadFeaturedPosts();
  }, [communityId, community, allPosts]);

  // Handle Pin Post as Announcement
  // Sequence: hide manage sheet → then open compose (iOS can't stack transparent + opaque modal)
  const openComposeAnnouncement = () => {
    setShowAnnouncementsModal(false);
    setTimeout(() => setShowComposeAnnouncementModal(true), 350);
  };

  // Sequence: close compose → then reopen manage sheet
  const closeComposeAnnouncement = (reopenManage = true) => {
    setShowComposeAnnouncementModal(false);
    setNewAnnouncementTitle('');
    setNewAnnouncementBody('');
    if (reopenManage) setTimeout(() => setShowAnnouncementsModal(true), 350);
  };

  // Create a brand-new announcement post and auto-pin it
  const handleCreateAnnouncement = async () => {
    if (!isAdmin && !isModerator) {
      Alert.alert('Permission Denied', 'Only admins and moderators can create announcements');
      return;
    }
    if (!newAnnouncementTitle.trim() && !newAnnouncementBody.trim()) {
      Alert.alert('Empty Announcement', 'Please enter a title or message.');
      return;
    }
    setCreatingAnnouncement(true);
    try {
      const firestore = await import('firebase/firestore');
      const postsCol = collection(db, 'communities', communityId, 'posts');
      const postData = {
        title: newAnnouncementTitle.trim(),
        text: newAnnouncementBody.trim(),
        content: newAnnouncementBody.trim(),
        authorId: currentUser?.id || auth.currentUser?.uid || '',
        authorName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'Staff',
        authorImage: currentUser?.profileImage || null,
        communityId,
        type: 'announcement',
        isAnnouncement: true,
        isPinned: false,
        likes: 0,
        comments: 0,
        likedBy: [],
        createdAt: firestore.serverTimestamp(),
        createdById: currentUser?.id || auth.currentUser?.uid || '',
        createdByName: currentUser?.communityNickname || communityNickname || currentUser?.name || 'Staff',
      };
      const docRef = await firestore.addDoc(postsCol, postData);

      // Pin it as an announcement
      const communityRef = doc(db, 'communities', communityId);
      const currentAnnouncements = community?.announcements || [];
      if (currentAnnouncements.length >= 3) {
        await updateDoc(communityRef, {
          announcements: firestore.arrayRemove(currentAnnouncements[0]),
        });
      }
      await updateDoc(communityRef, {
        announcements: firestore.arrayUnion(docRef.id),
      });

      setNewAnnouncementTitle('');
      setNewAnnouncementBody('');
      setShowComposeAnnouncementModal(false);
      setTimeout(() => {
        setShowAnnouncementsModal(true);
        Alert.alert('✅ Posted', 'Announcement created and pinned!');
      }, 350);
    } catch (error) {
      console.error('Error creating announcement:', error);
      Alert.alert('Error', 'Failed to create announcement.');
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const handlePinAnnouncement = async (postId) => {
    if (!isAdmin && !isModerator) {
      Alert.alert('Permission Denied', 'Only admins and moderators can pin announcements');
      return;
    }

    try {
      const currentAnnouncements = community.announcements || [];
      
      if (currentAnnouncements.includes(postId)) {
        Alert.alert('Already Pinned', 'This post is already pinned as an announcement');
        return;
      }

      const firestore = await import('firebase/firestore');
      const communityRef = doc(db, 'communities', communityId);
      
      // If already at max (3), remove the oldest announcement first
      if (currentAnnouncements.length >= 3) {
        const oldestAnnouncementId = currentAnnouncements[0]; // First one is oldest
        await updateDoc(communityRef, {
          announcements: firestore.arrayRemove(oldestAnnouncementId)
        });
      }
      
      // Add new announcement
      await updateDoc(communityRef, {
        announcements: firestore.arrayUnion(postId)
      });

      Alert.alert('Success', currentAnnouncements.length >= 3 ? 'Post pinned! Oldest announcement was auto-removed.' : 'Post pinned as announcement!');
    } catch (error) {
      console.error('Error pinning announcement:', error);
      Alert.alert('Error', 'Failed to pin announcement');
    }
  };

  // Handle Unpin Announcement
  const handleUnpinAnnouncement = async (postId) => {
    if (!isAdmin && !isModerator) {
      Alert.alert('Permission Denied', 'Only admins and moderators can unpin announcements');
      return;
    }

    try {
      const firestore = await import('firebase/firestore');
      const communityRef = doc(db, 'communities', communityId);
      
      await updateDoc(communityRef, {
        announcements: firestore.arrayRemove(postId)
      });

      Alert.alert('Success', 'Announcement unpinned!');
    } catch (error) {
      console.error('Error unpinning announcement:', error);
      Alert.alert('Error', 'Failed to unpin announcement');
    }
  };

  // Handle Post Options Menu (for admins) – opens PostOptionsModal
  const [postOptionsVisible, setPostOptionsVisible] = useState(false);
  const [postOptionsTarget, setPostOptionsTarget] = useState(null);

  const handlePostOptions = (post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPostOptionsTarget(post);
    setPostOptionsVisible(true);
  };

  // Handle Feature Post
  const handleFeaturePost = async (postId) => {
    if (!isAdmin && !isModerator) {
      Alert.alert('Permission Denied', 'Only admins and moderators can feature posts');
      return;
    }

    try {
      const currentFeatured = community.featuredPosts || [];
      
      if (currentFeatured.includes(postId)) {
        Alert.alert('Already Featured', 'This post is already featured');
        return;
      }

      const firestore = await import('firebase/firestore');
      const communityRef = doc(db, 'communities', communityId);
      
      // Add to featured posts array on community doc
      await updateDoc(communityRef, {
        featuredPosts: firestore.arrayUnion(postId)
      });

      // Also mark the post doc as featured (same as announcements mark isPinned)
      try {
        await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
          isFeatured: true,
          featuredAt: firestore.serverTimestamp(),
          featuredBy: currentUser?.id
        });
      } catch {
        try {
          await updateDoc(doc(db, 'communities', communityId, 'blogs', postId), {
            isFeatured: true,
            featuredAt: firestore.serverTimestamp(),
            featuredBy: currentUser?.id
          });
        } catch {
          console.warn('Could not mark post/blog doc as featured');
        }
      }

      Alert.alert('Success', 'Post added to featured!');
    } catch (error) {
      console.error('Error featuring post:', error);
      Alert.alert('Error', 'Failed to feature post');
    }
  };

  // Handle Unfeature Post
  const handleUnfeaturePost = async (postId) => {
    if (!isAdmin && !isModerator) {
      Alert.alert('Permission Denied', 'Only admins and moderators can remove featured posts');
      return;
    }

    try {
      const firestore = await import('firebase/firestore');
      const communityRef = doc(db, 'communities', communityId);
      
      await updateDoc(communityRef, {
        featuredPosts: firestore.arrayRemove(postId)
      });

      // Also unmark the post doc (same as announcements unmark isPinned)
      try {
        await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
          isFeatured: false,
          featuredAt: null,
          featuredBy: null
        });
      } catch {
        try {
          await updateDoc(doc(db, 'communities', communityId, 'blogs', postId), {
            isFeatured: false,
            featuredAt: null,
            featuredBy: null
          });
        } catch {
          console.warn('Could not unmark post/blog doc as featured');
        }
      }

      Alert.alert('Success', 'Post removed from featured!');
    } catch (error) {
      console.error('Error unfeaturing post:', error);
      Alert.alert('Error', 'Failed to remove from featured');
    }
  };

  // Handle Delete Post
  const handleDeletePost = async (postId, postType) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const collectionName = postType === 'blog' ? 'blogs' : 'posts';
              const postRef = doc(db, 'communities', communityId, collectionName, postId);
              await deleteDoc(postRef);
              
              // Also remove from announcements if pinned
              const currentAnnouncements = community?.announcements || [];
              if (currentAnnouncements.includes(postId)) {
                const firestore = await import('firebase/firestore');
                const communityRef = doc(db, 'communities', communityId);
                await updateDoc(communityRef, {
                  announcements: firestore.arrayRemove(postId)
                });
              }

              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  // Handle Hide Post — staff-only moderation action
  const handleHidePost = async (postId, postType) => {
    if (!isAdmin && !isModerator) {
      Alert.alert('Permission Denied', 'Only community staff can hide posts');
      return;
    }
    try {
      const firestore = await import('firebase/firestore');
      const hiddenFields = {
        isHidden: true,
        hiddenAt: firestore.serverTimestamp(),
        hiddenBy: currentUser?.id,
      };
      // Check preferred sub-collection first, fall back to the other
      const preferredSub = postType === 'blog' ? 'blogs' : 'posts';
      const fallbackSub  = postType === 'blog' ? 'posts'  : 'blogs';
      const preferredRef = doc(db, 'communities', communityId, preferredSub, postId);
      const preferredSnap = await getDoc(preferredRef);
      if (preferredSnap.exists()) {
        await updateDoc(preferredRef, hiddenFields);
      } else {
        const fallbackRef = doc(db, 'communities', communityId, fallbackSub, postId);
        await updateDoc(fallbackRef, hiddenFields);
      }
      Alert.alert('Post Hidden', 'This post is now hidden from members.');
    } catch (error) {
      console.error('Error hiding post:', error);
      Alert.alert('Error', 'Failed to hide post');
    }
  };

  // Handle Start Audio Call

  // Ban wall — shown when the user is banned from this community
  if (error === 'banned') {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]} edges={['top']}>
        <Ionicons name="ban-outline" size={72} color="#FF3232" />
        <Text style={{ color: '#FF3232', fontSize: 22, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
          You Have Been Banned
        </Text>
        <Text style={{ color: '#A2A8B3', fontSize: 15, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
          You have been banned from this community and cannot access its content.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 32, backgroundColor: '#1A1F27', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 24, borderWidth: 1, borderColor: '#242A33' }}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
        >
          <Text style={{ color: '#08FFE2', fontSize: 15, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.topBarTitle} numberOfLines={1}>{community?.name || groupTitle || 'Community'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          {isAdmin && (
            <TouchableOpacity onPress={() => navigation.navigate('CommunityAdminPortal', { communityId, communityData: community })}>
              <MaterialIcons name="admin-panel-settings" size={24} color="#FFD700" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLeaveCommunity}>
            <MaterialIcons name="exit-to-app" size={24} color="#ff4b6e" />
          </TouchableOpacity>
        </View>
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
          {/* Content Area - Chat tab is rendered outside ScrollView to avoid nesting */}
          {activeTab !== 'chat' ? (
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#8B2EF0"
                colors={['#8B2EF0']}
              />
            }
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
                            user.profileImage ? (
                              <Image
                                key={user.id}
                                source={{ uri: user.profileImage }}
                                style={[
                                  styles.memberImage,
                                  index !== 0 && { marginLeft: -10 },
                                ]}
                              />
                            ) : (
                              <View key={user.id} style={[styles.memberImage, index !== 0 && { marginLeft: -10 }, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="person" size={20} color="#657786" />
                              </View>
                            )
                          ))
                        ) : (
                          <View style={[styles.memberImage, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="person" size={20} color="#657786" />
                          </View>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('all')}
                    style={{ backgroundColor: communitySection === 'all' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'all' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Explore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('featured')}
                    style={{ backgroundColor: communitySection === 'featured' ? '#FFD700' : 'transparent', borderWidth: communitySection === 'featured' ? 0 : 1, borderColor: '#FFD700', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="star" size={16} color={communitySection === 'featured' ? '#000' : '#FFD700'} />
                    <Text style={{ color: communitySection === 'featured' ? '#000' : '#FFD700', fontWeight: '700', fontSize: 14 }}>Featured</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('announcements')}
                    style={{ backgroundColor: communitySection === 'announcements' ? '#FF6B6B' : 'transparent', borderWidth: communitySection === 'announcements' ? 0 : 1, borderColor: '#FF6B6B', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="megaphone" size={15} color={communitySection === 'announcements' ? '#fff' : '#FF6B6B'} />
                    <Text style={{ color: communitySection === 'announcements' ? '#fff' : '#FF6B6B', fontWeight: '700', fontSize: 14 }}>Announcements</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('posts')}
                    style={{ backgroundColor: communitySection === 'posts' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'posts' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Posts</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('parties')}
                    style={{ backgroundColor: communitySection === 'parties' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'parties' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Parties</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('info')}
                    style={{ backgroundColor: communitySection === 'info' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'info' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommunitySection('groups')}
                    style={{ backgroundColor: communitySection === 'groups' ? '#8B2EF0' : 'transparent', borderWidth: communitySection === 'groups' ? 0 : 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Groups</Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* Featured Posts Section */}
                {communitySection === 'featured' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                    {featuredPosts.length === 0 ? (
                      <View style={{ backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, alignItems: 'center' }}>
                        <MaterialIcons name="star-border" size={40} color="#666" />
                        <Text style={{ color: '#888', fontSize: 14, marginTop: 8 }}>No featured posts yet</Text>
                        {(isAdmin || isModerator) && (
                          <Text style={{ color: '#666', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                            Long-press any post and select "Add to Featured"
                          </Text>
                        )}
                      </View>
                    ) : (
                      <FeaturedFeed
                        featuredPosts={featuredPosts
                          .map((postId) => allPosts.find(p => p.id === postId))
                          .filter(Boolean)}
                        communityId={communityId}
                        onPress={(post) => {
                          handlePostOptions(post);
                        }}
                        isStaff={isAdmin || isModerator}
                        onManage={() => setShowFeaturedModal(true)}
                      />
                    )}
                  </View>
                )}

                {/* Announcements Section */}
                {(communitySection === 'announcements' || communitySection === 'all') && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: '#FF6B6B22', borderRadius: 8, padding: 6 }}>
                          <Ionicons name="megaphone" size={18} color="#FF6B6B" />
                        </View>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Announcements</Text>
                        {announcements.length > 0 && (
                          <View style={{ backgroundColor: '#FF6B6B', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{announcements.length}</Text>
                          </View>
                        )}
                      </View>
                      {(isAdmin || isModerator) && (
                        <TouchableOpacity
                          onPress={() => setShowAnnouncementsModal(true)}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B6B22', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, gap: 4 }}
                        >
                          <Ionicons name="settings-outline" size={14} color="#FF6B6B" />
                          <Text style={{ color: '#FF6B6B', fontSize: 12, fontWeight: '600' }}>Manage</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {announcements.length === 0 ? (
                      <View style={{ backgroundColor: '#1e1e1e', borderRadius: 12, padding: 28, alignItems: 'center' }}>
                        <Ionicons name="megaphone-outline" size={44} color="#444" />
                        <Text style={{ color: '#888', fontSize: 15, fontWeight: '600', marginTop: 10 }}>No announcements yet</Text>
                        <Text style={{ color: '#555', fontSize: 12, marginTop: 6, textAlign: 'center' }}>Important updates from staff will appear here</Text>
                        {(isAdmin || isModerator) && (
                          <Text style={{ color: '#666', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                            Long-press any post and select "Pin as Announcement"
                          </Text>
                        )}
                      </View>
                    ) : (
                      announcements.map((post, index) => {
                        const isExpanded = expandedAnnouncementId === (post.id || index);
                        const announcementText = post.text || post.content || post.title || '';
                        return (
                        <TouchableOpacity
                          key={post.id || index}
                          onPress={() => setExpandedAnnouncementId(isExpanded ? null : (post.id || index))}
                          onLongPress={() => handlePostOptions(post)}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#1a1a1a',
                            borderRadius: 14,
                            marginBottom: 12,
                            overflow: 'hidden',
                            borderLeftWidth: 4,
                            borderLeftColor: '#FF6B6B',
                          }}
                        >
                          <View style={{ padding: 14 }}>
                            {/* Badge + Date row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ backgroundColor: '#FF6B6B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="megaphone" size={11} color="#fff" />
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>ANNOUNCEMENT</Text>
                                </View>
                              </View>
                              {post.createdAt && (
                                <Text style={{ color: '#555', fontSize: 11 }}>
                                  {new Date(post.createdAt?.seconds ? post.createdAt.seconds * 1000 : post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </Text>
                              )}
                            </View>

                            {/* Full content (expanded) or preview (collapsed) */}
                            {announcementText ? (
                              <>
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '400', lineHeight: 22, marginBottom: 6 }}
                                  numberOfLines={isExpanded ? undefined : 3}
                                >
                                  {announcementText}
                                </Text>
                                {!isExpanded && announcementText.length > 120 && (
                                  <Text style={{ color: '#FF6B6B', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Tap to read more</Text>
                                )}
                              </>
                            ) : null}

                            {/* Author */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <Ionicons name="person-circle-outline" size={14} color="#888" />
                              <Text style={{ color: '#777', fontSize: 12 }}>
                                {liveNames[post.authorId || post.createdById] || post.createdByName || post.authorName || 'Staff'}
                              </Text>
                            </View>
                          </View>

                          {/* Thumbnail image if present */}
                          {(post.imageUrl || post.images?.[0]) && (
                            <Image
                              source={{ uri: post.imageUrl || post.images[0] }}
                              style={{ width: '100%', height: 160, resizeMode: 'cover' }}
                            />
                          )}
                        </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}

                {/* Groups Section */}
                {(communitySection === 'all' || communitySection === 'groups') && communitySection !== 'featured' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                        Groups {communityGroups.length > 0 && `(${communityGroups.length})`}
                      </Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('CommunityCreateGroup', {
                          communityId: communityId,
                          communityName: community?.name || groupTitle
                        })}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#8B2EF0',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                          gap: 6
                        }}
                      >
                        <Ionicons name="add-circle" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Create Group</Text>
                      </TouchableOpacity>
                    </View>

                    {communityGroups.length === 0 ? (
                      <View style={{ backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={40} color="#666" />
                        <Text style={{ color: '#888', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                          No groups yet. Create a group to organize discussions!
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {communityGroups.map((group) => {
                          const isJoined = joinedGroupIds.includes(group.id);
                          const uid = currentUser?.id || currentUser?.uid;
                          const _isCommunityStaff = !!(community && uid && (
                            community.creatorId === uid ||
                            (community.leaders || []).includes(uid) ||
                            (community.curators || []).includes(uid)
                          ));
                          // Non-staff should not see disabled groups at all
                          if (group.isDisabled && !_isCommunityStaff) return null;
                          return (
                            <TouchableOpacity
                              key={group.id}
                              style={{
                                backgroundColor: group.isDisabled ? '#1a1010' : '#1e1e1e',
                                borderRadius: 12,
                                padding: 14,
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: group.isDisabled ? '#8B2020' : isJoined ? '#8B2EF0' : '#333',
                                opacity: group.isDisabled ? 0.7 : 1,
                              }}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (group.isDisabled) {
                                  Alert.alert(
                                    'Group Disabled',
                                    'This group has been temporarily disabled by a moderator.',
                                    [{ text: 'OK' }]
                                  );
                                  return;
                                }
                                navigation.navigate('CommunityGroupChat', {
                                  communityId: communityId,
                                  groupId: group.id,
                                  groupName: group.name,
                                  groupImage: group.groupImage,
                                  groupEmoji: group.theme?.emoji,
                                  groupColor: group.theme?.color,
                                });
                              }}
                            >
                              {/* Group Image/Emoji */}
                              <View style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: group.theme?.color || '#8B2EF0',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 12,
                                overflow: 'hidden'
                              }}>
                                {group.groupImage ? (
                                  <Image
                                    source={{ uri: group.groupImage }}
                                    style={{ width: 56, height: 56 }}
                                  />
                                ) : (
                                  <Text style={{ fontSize: 28 }}>
                                    {group.theme?.emoji || '💬'}
                                  </Text>
                                )}
                              </View>

                              {/* Group Info */}
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Text style={{
                                    color: '#fff',
                                    fontSize: 16,
                                    fontWeight: '700',
                                  }}>
                                    {group.name}
                                  </Text>
                                  {group.isDisabled ? (
                                    <View style={{
                                      backgroundColor: '#8B2020',
                                      paddingHorizontal: 8,
                                      paddingVertical: 3,
                                      borderRadius: 10,
                                    }}>
                                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                                        DISABLED
                                      </Text>
                                    </View>
                                  ) : isJoined && (
                                    <View style={{
                                      backgroundColor: '#8B2EF0',
                                      paddingHorizontal: 8,
                                      paddingVertical: 3,
                                      borderRadius: 10,
                                    }}>
                                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                                        JOINED
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {group.description ? (
                                  <Text style={{
                                    color: '#888',
                                    fontSize: 13,
                                    marginBottom: 4
                                  }} numberOfLines={1}>
                                    {group.description}
                                  </Text>
                                ) : null}

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="people" size={14} color="#666" />
                                    <Text style={{ color: '#666', fontSize: 12 }}>
                                      {group.memberCount || 0} members
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              {/* Arrow */}
                              <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* Info Section */}
                {(communitySection === 'info') && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                    <View style={{ backgroundColor: '#1e1e1e', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      {/* Category */}
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>CATEGORY</Text>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{community?.category || 'N/A'}</Text>
                      </View>

                      {/* Created At */}
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>CREATED AT</Text>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
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
                        <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>DESCRIPTION</Text>
                        <Text style={{ color: '#ccc', fontSize: 14, lineHeight: 20 }}>
                          {community?.description || 'No description available'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Social Parties Section / Posts */}
                {(communitySection === 'all' || communitySection === 'posts') && communitySection !== 'featured' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Posts</Text>
                      <TouchableOpacity onPress={() => setCommunitySection('posts')}>
                        <Text style={{ color: '#8B2EF0', fontSize: 13, fontWeight: '600' }}>View all  →</Text>
                      </TouchableOpacity>
                    </View>

                    {allPosts.length === 0 ? (
                      <View style={{ backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, alignItems: 'center' }}>
                        <Ionicons name="document-text-outline" size={40} color="#666" />
                        <Text style={{ color: '#888', fontSize: 14, marginTop: 8 }}>No posts yet</Text>
                      </View>
                    ) : (
                      allPosts.map((post) => {
                        const isLiked = Array.isArray(post.likedBy) && currentUser?.id
                          ? post.likedBy.includes(currentUser.id)
                          : false;
                        const likeKey = `${post.type}-${post.id}`;
                        const likeBusy = likeProcessingIds.includes(likeKey);
                        const currentAnnouncements = community?.announcements || [];
                        const currentFeatured = community?.featuredPosts || [];
                        const isPinned = currentAnnouncements.includes(post.id);
                        const isFeatured = currentFeatured.includes(post.id);
                        
                        return (
                          <TouchableOpacity
                            key={post.id}
                            style={{ 
                              backgroundColor: '#1e1e1e', 
                              borderRadius: 12, 
                              padding: 12, 
                              marginBottom: 12, 
                              borderWidth: isPinned ? 2 : (isFeatured ? 2 : 0), 
                              borderColor: isPinned ? '#8B2EF0' : (isFeatured ? '#FFD700' : 'transparent') 
                            }}
                            onLongPress={() => handlePostOptions(post)}
                            activeOpacity={0.9}
                          >
                            {isPinned && (
                              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#8B2EF0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 1 }}>
                                <MaterialCommunityIcons name="bullhorn" size={12} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>PINNED</Text>
                              </View>
                            )}
                            {isFeatured && !isPinned && (
                              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 1 }}>
                                <MaterialIcons name="star" size={12} color="#000" />
                                <Text style={{ color: '#000', fontSize: 10, fontWeight: '700' }}>FEATURED</Text>
                              </View>
                            )}
                            {/* Author Info */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {post.authorImage ? (
                                  <Image
                                    source={{ uri: post.authorImage }}
                                    style={{ width: 44, height: 44, borderRadius: 22, marginRight: 10 }}
                                  />
                                ) : (
                                  <View style={{ width: 44, height: 44, borderRadius: 22, marginRight: 10, backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="person" size={30} color="#657786" />
                                  </View>
                                )}
                                <View>
                                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{liveNames[post.authorId] || (post.authorId && memberNicknames[post.authorId]) || post.authorName || 'User'}</Text>
                                  <Text style={{ color: '#888', fontSize: 12 }}>
                                    {post.createdAt
                                      ? new Date(post.createdAt.toDate?.() || post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>
                                  {post.title}
                                </Text>
                                <Text style={{ color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12 }} numberOfLines={3}>
                                  {post.content}
                                </Text>
                              </>
                            )}

                            {/* Image Post - Show Image and Caption */}
                            {post.type === 'image' && (
                              <>
                                {!!post.imageUri && (
                                  <Image
                                    source={{ uri: post.imageUri }}
                                    style={{ width: '100%', height: 250, borderRadius: 12, marginBottom: 12, resizeMode: 'cover' }}
                                  />
                                )}
                                {!!post.caption && (
                                  <Text style={{ color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                                    {post.caption}
                                  </Text>
                                )}
                              </>
                            )}

                            {/* Community Share - Show shared community */}
                            {post.type === 'community_share' && (
                              <>
                                <Text style={{ color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                                  {post.text}
                                </Text>
                                <TouchableOpacity
                                  style={{
                                    backgroundColor: '#252525',
                                    borderRadius: 12,
                                    padding: 14,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: '#333',
                                  }}
                                  onPress={() => {
                                    if (post.communityId) {
                                      // Navigate to Community screen which will handle validation flow
                                      navigation.navigate('Community', {
                                        openCommunityId: post.communityId,
                                        openCommunityData: {
                                          id: post.communityId,
                                          community_id: post.communityId,
                                          name: post.communityName,
                                          community_title: post.communityName,
                                          profileImage: post.communityImage,
                                          img: post.communityImage ? { uri: post.communityImage } : null,
                                          description: post.communityDescription,
                                          community_members: post.memberCount || 0,
                                        }
                                      });
                                    }
                                  }}
                                >
                                  {post.communityImage ? (
                                    <Image
                                      source={{ uri: post.communityImage }}
                                      style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }}
                                    />
                                  ) : (
                                    <View style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }}>
                                      <Ionicons name="people" size={28} color="#666" />
                                    </View>
                                  )}
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                                      {post.communityName || 'Community'}
                                    </Text>
                                    {post.communityDescription ? (
                                      <Text style={{ color: '#888', fontSize: 13, marginBottom: 4 }} numberOfLines={2}>
                                        {post.communityDescription}
                                      </Text>
                                    ) : null}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Ionicons name="people" size={14} color="#666" />
                                      <Text style={{ color: '#666', fontSize: 12 }}>
                                        {post.memberCount || 0} members
                                      </Text>
                                    </View>
                                  </View>
                                  <Ionicons name="chevron-forward" size={20} color="#666" />
                                </TouchableOpacity>
                              </>
                            )}

                            {/* Action Buttons */}
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222' }}>
                              <AnimatedHeartButton
                                isLiked={isLiked}
                                likes={post.likes}
                                onPress={() => handleToggleLike(post)}
                              />
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                onPress={() => handleCommentPress(post)}
                              >
                                <Ionicons name="chatbubble-outline" size={20} color="#888" />
                                <Text style={{ color: '#888', fontSize: 12 }}>{post.comments || 0}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleSharePost(post)}>
                                <Ionicons name="share-social-outline" size={20} color="#888" />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}
              </>
            )}





            {/* Tab 1.5: Featured Feed */}
            {activeTab === 'featured' && (
              <>
                {/* Header */}
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 18 }}>⭐ Featured Posts</Text>
                    {(isAdmin || isModerator) && (
                      <TouchableOpacity onPress={() => setShowFeaturedModal(true)}>
                        <MaterialIcons name="settings" size={24} color="#FFD700" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Featured Posts Content */}
                <ScrollView style={{ flex: 1 }}>
                  {featuredPosts.length === 0 ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <MaterialIcons name="star-border" size={60} color="#444" />
                      <Text style={{ color: '#888', fontSize: 16, marginTop: 12 }}>No featured posts yet</Text>
                      {(isAdmin || isModerator) && (
                        <Text style={{ color: '#666', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                          Long-press any post and select "Add to Featured"
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                      {/* First Featured Post - Large Display */}
                      {featuredPosts.length > 0 && (() => {
                        const firstFeaturedPostId = featuredPosts[0];
                        const firstPost = allPosts.find(p => p.id === firstFeaturedPostId);
                        
                        if (!firstPost) return null;

                        return (
                          <TouchableOpacity
                            key={firstPost.id}
                            style={[styles.postCard, { marginBottom: 20, borderWidth: 2, borderColor: '#FFD700' }]}
                            onPress={() => navigation.navigate('CommunityPostDetail', { post: firstPost })}
                            onLongPress={() => handlePostOptions(firstPost)}
                            activeOpacity={0.95}
                          >
                            {/* Featured Badge */}
                            <View style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                              <MaterialIcons name="star" size={14} color="#000" />
                              <Text style={{ color: '#000', fontSize: 11, fontWeight: 'bold', marginLeft: 4 }}>FEATURED</Text>
                            </View>

                            {/* Author Info */}
                            <View style={styles.postHeader}>
                              {firstPost.authorImage ? (
                                <Image source={{ uri: firstPost.authorImage }} style={styles.postAvatar} />
                              ) : (
                                <View style={[styles.postAvatar, { backgroundColor: '#555' }]}>
                                  <Ionicons name="person" size={20} color="#fff" />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={styles.postAuthor}>{liveNames[firstPost.authorId] || (firstPost.authorId && memberNicknames[firstPost.authorId]) || firstPost.authorName || 'Unknown'}</Text>
                                <Text style={styles.postTime}>
                                  {firstPost.createdAt ? new Date(firstPost.createdAt.seconds * 1000).toLocaleDateString() : ''}
                                </Text>
                              </View>
                            </View>

                            {/* Post Image - Large */}
                            {normalizeImageUri(firstPost.imageURL, 'posts') && (
                              <Image source={{ uri: normalizeImageUri(firstPost.imageURL, 'posts') }} style={{ width: '100%', height: 400, borderRadius: 8, marginTop: 8 }} />
                            )}

                            {/* Post Content */}
                            <Text style={[styles.postContent, { fontSize: 18, fontWeight: '600', marginTop: 12 }]} numberOfLines={3}>
                              {firstPost.title || firstPost.caption}
                            </Text>

                            {/* Stats */}
                            <View style={styles.postStats}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="heart" size={18} color="#FF4458" />
                                <Text style={styles.postStatText}>{firstPost.likesCount || 0}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="chatbubble" size={18} color="#8B2EF0" />
                                <Text style={styles.postStatText}>{firstPost.commentsCount || 0}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })()}

                      {/* Remaining Featured Posts - 2 Column Grid */}
                      {featuredPosts.length > 1 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                          {featuredPosts.slice(1).map((postId, index) => {
                            const post = allPosts.find(p => p.id === postId);
                            if (!post) return null;

                            return (
                              <TouchableOpacity
                                key={post.id}
                                style={[styles.postCard, { width: '48%', marginBottom: 16, borderWidth: 1.5, borderColor: '#FFD700' }]}
                                onPress={() => navigation.navigate('CommunityPostDetail', { post })}
                                onLongPress={() => handlePostOptions(post)}
                                activeOpacity={0.95}
                              >
                                {/* Featured Badge - Smaller */}
                                <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: '#FFD700', padding: 4, borderRadius: 8 }}>
                                  <MaterialIcons name="star" size={12} color="#000" />
                                </View>

                                {/* Post Image */}
                                {normalizeImageUri(post.imageURL, 'posts') && (
                                  <Image source={{ uri: normalizeImageUri(post.imageURL, 'posts') }} style={{ width: '100%', height: 150, borderRadius: 8 }} />
                                )}

                                {/* Post Content */}
                                <Text style={[styles.postContent, { fontSize: 14, marginTop: 8 }]} numberOfLines={2}>
                                  {post.title || post.caption}
                                </Text>

                                {/* Author Info - Compact */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                  {post.authorImage ? (
                                    <Image source={{ uri: post.authorImage }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                                  ) : (
                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center' }}>
                                      <Ionicons name="person" size={12} color="#fff" />
                                    </View>
                                  )}
                                  <Text style={{ color: '#fff', fontSize: 12, marginLeft: 6, flex: 1 }} numberOfLines={1}>
                                    {liveNames[post.authorId] || (post.authorId && memberNicknames[post.authorId]) || post.authorName || 'Unknown'}
                                  </Text>
                                </View>

                                {/* Stats - Compact */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'space-around' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="heart" size={14} color="#FF4458" />
                                    <Text style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>{post.likesCount || 0}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="chatbubble" size={14} color="#8B2EF0" />
                                    <Text style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>{post.commentsCount || 0}</Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </ScrollView>
              </>
            )}

            {/* Tab 2: Who's Online */}
            {activeTab === 'online' && (
              <>
                {/* Header */}
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#FFD600', fontWeight: 'bold', fontSize: 16 }}>⚡ What's Happening Now!</Text>
                    <TouchableOpacity>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Search Bar for Members */}
                  <View style={styles.memberSearchContainer}>
                    <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.memberSearchInput}
                      placeholder="Search members..."
                      placeholderTextColor="#888"
                      value={memberSearchQuery}
                      onChangeText={setMemberSearchQuery}
                    />
                    {memberSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#888" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#40FC6F', marginRight: 6 }} />
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                        Members ({allMembers.filter(m =>
                          m.currentStatus && m.currentStatus === 'online' &&
                          (!memberSearchQuery ||
                            m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                            m.globalName?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                            m.email?.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                        ).length})
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => {
                      setMembersModalContext('online');
                      setShowMembersModal(true);
                    }}>
                      <Text style={{ color: '#8B2EF0', fontWeight: '600', fontSize: 14 }}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {allMembers.filter(m =>
                      m.currentStatus && m.currentStatus === 'online' &&
                      (!memberSearchQuery ||
                        m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                        m.globalName?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                        m.email?.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                    ).length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center', width: Dimensions.get('window').width - 32 }}>
                        <Text style={{ color: '#888', fontSize: 14 }}>
                          {memberSearchQuery ? 'No members match your search' : 'No members found'}
                        </Text>
                      </View>
                    ) : (
                      allMembers
                        .filter(m =>
                          m.currentStatus && m.currentStatus === 'online' &&
                          (!memberSearchQuery ||
                            m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                            m.globalName?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                            m.email?.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                        )
                        .map((member, idx) => (
                          <TouchableOpacity
                            key={member.id || idx}
                            style={{ alignItems: 'center', marginRight: 18 }}
                            onPress={() => navigation.navigate('Profile', { userId: member.id })}
                            activeOpacity={0.7}
                          >
                            {member.profileImage ? (
                              <Image
                                source={{ uri: member.profileImage }}
                                style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#8B2EF0' }}
                              />
                            ) : (
                              <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#8B2EF0', backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="person" size={30} color="#657786" />
                              </View>
                            )}
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500', marginTop: 4, maxWidth: 60 }} numberOfLines={1}>
                              {member.name || 'User'}
                            </Text>
                          </TouchableOpacity>
                        ))
                    )}
                  </ScrollView>
                </View>

                {/* Activity Cards */}
                <View style={{ paddingHorizontal: 16 }}>
                  {/* Card 1: Chatting */}
                  <View style={{ backgroundColor: '#0D8F8F', borderRadius: 16, marginBottom: 16, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#0D8F8F', borderRadius: 8, padding: 8, marginRight: 12 }}>
                          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{activityStats.chatting} Members</Text>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Chatting</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{ color: '#cfcfcf', marginTop: 12, fontSize: 12 }}>
                      Count updates whenever members start a new chat thread.
                    </Text>
                  </View>

                  {/* Card 2: Live Chatting */}
                  <View style={{ backgroundColor: '#8B2EF0', borderRadius: 16, marginBottom: 16, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#8B2EF0', borderRadius: 8, padding: 8, marginRight: 12 }}>
                          <Ionicons name="videocam-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{activityStats.liveChatting} Members</Text>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Live Chatting</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{ color: '#dbd1ff', marginTop: 12, fontSize: 12 }}>
                      Goes up when members start live sessions or audio rooms.
                    </Text>
                  </View>

                  {/* Card 3: Reading Posts */}
                  <View style={{ backgroundColor: '#0D8F8F', borderRadius: 16, marginBottom: 16, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#0D8F8F', borderRadius: 8, padding: 8, marginRight: 12 }}>
                          <Ionicons name="document-text-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{activityStats.readingPosts} Members</Text>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Reading Posts</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{ color: '#cfcfcf', marginTop: 12, fontSize: 12 }}>
                      Reflects members reading posts or community blogs right now.
                    </Text>
                  </View>

                  {/* Card 4: Browsing */}
                  <View style={{ backgroundColor: '#8B2EF0', borderRadius: 16, marginBottom: 16, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#8B2EF0', borderRadius: 8, padding: 8, marginRight: 12 }}>
                          <Ionicons name="eye-outline" size={20} color="#fff" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{activityStats.browsing} Members</Text>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Browsing</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </View>
                    <Text style={{ color: '#dbd1ff', marginTop: 12, fontSize: 12 }}>
                      Shows members scrolling through feeds, profiles, or stores.
                    </Text>
                  </View>
                  {/* Part 2: Categorized Member List */}
                  <View style={{ marginTop: 8, backgroundColor: '#181818', borderRadius: 8, marginHorizontal: 0, marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' }}>
                      <Ionicons name="people" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>All Members ({allMembers.length})</Text>
                    </View>
                    {/* Admins */}
                    {admins.length > 0 && (
                      <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10 }}>Admins</Text>
                        {admins.map((member) => (
                          <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity
                                onPress={() => navigation.navigate('Profile', { userId: member.id })}
                                activeOpacity={0.7}
                              >
                                {member.profileImage ? (
                                  <Image
                                    source={{ uri: member.profileImage }}
                                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                                  />
                                ) : (
                                  <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="person" size={30} color="#657786" />
                                  </View>
                                )}
                              </TouchableOpacity>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>{member.name}</Text>
                            </View>
                            {renderFollowButton(member.id)}
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Moderators */}
                    {moderators.length > 0 && (
                      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10 }}>Moderators</Text>
                        {moderators.map((member) => (
                          <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity
                                onPress={() => navigation.navigate('Profile', { userId: member.id })}
                                activeOpacity={0.7}
                              >
                                {member.profileImage ? (
                                  <Image
                                    source={{ uri: member.profileImage }}
                                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                                  />
                                ) : (
                                  <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="person" size={30} color="#657786" />
                                  </View>
                                )}
                              </TouchableOpacity>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>{member.name}</Text>
                            </View>
                            {renderFollowButton(member.id)}
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Recently Joined */}
                    {recentlyJoined.length > 0 && (
                      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10 }}>Recently Joined</Text>
                        {recentlyJoined.map((member) => (
                          <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity
                                onPress={() => navigation.navigate('Profile', { userId: member.id })}
                                activeOpacity={0.7}
                              >
                                {member.profileImage ? (
                                  <Image
                                    source={{ uri: member.profileImage }}
                                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                                  />
                                ) : (
                                  <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="person" size={30} color="#657786" />
                                  </View>
                                )}
                              </TouchableOpacity>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>{member.name}</Text>
                            </View>
                            {renderFollowButton(member.id)}
                          </View>
                        ))}
                      </View>
                    )}
                    {admins.length === 0 && moderators.length === 0 && recentlyJoined.length === 0 && (
                      <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#888', fontSize: 14 }}>No members to display</Text>
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

            {/* Tab 5: Account */}
            {activeTab === 'account' && (
              <View style={styles.accountSection}>
                {/* Avatar + Name header area */}
                <View style={styles.accountHeaderArea}>
                  <View style={styles.accountAvatarContainer}>
                    <LinearGradient
                      colors={['#08FFE2', '#8B2EF0']}
                      style={styles.accountAvatarRing}
                    >
                      {currentUser?.profileImage ? (
                        <Image
                          source={{ uri: currentUser.profileImage }}
                          style={styles.accountAvatar}
                        />
                      ) : (
                        <View style={[styles.accountAvatar, styles.accountAvatarFallback]}>
                          <Ionicons name="person" size={42} color="#657786" />
                        </View>
                      )}
                    </LinearGradient>
                    <View style={styles.accountBadge}>
                      <Ionicons name="checkmark-circle" size={22} color="#00FF47" />
                    </View>
                  </View>

                  <View style={styles.accountNameRow}>
                    <Text style={styles.accountName}>{currentUser?.communityNickname || communityNickname || currentUser?.name || 'User'}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNicknameInput(communityNickname || '');
                        setShowNicknameModal(true);
                      }}
                      style={styles.accountEditNameBtn}
                    >
                      <MaterialIcons name="edit" size={15} color="#A2A8B3" />
                    </TouchableOpacity>
                  </View>

                  {currentUser?.email ? (
                    <Text style={styles.accountEmailText}>{currentUser.email}</Text>
                  ) : null}
                </View>

                {/* Stats Row */}
                <View style={styles.accountStatsCard}>
                  <View style={styles.accountStatsGrid}>
                    <View style={styles.accountStatItem}>
                      <Text style={styles.accountStatValue}>{userStats.followers}</Text>
                      <Text style={styles.accountStatLabel}>Followers</Text>
                    </View>
                    <View style={styles.accountStatsDivider} />
                    <View style={styles.accountStatItem}>
                      <Text style={styles.accountStatValue}>{userStats.following}</Text>
                      <Text style={styles.accountStatLabel}>Following</Text>
                    </View>
                    <View style={styles.accountStatsDivider} />
                    <View style={styles.accountStatItem}>
                      <Text style={styles.accountStatValue}>{userStats.totalLikes}</Text>
                      <Text style={styles.accountStatLabel}>Likes</Text>
                    </View>
                  </View>
                </View>

                {/* Content Stats */}
                <View style={styles.accountContentStatsRow}>
                  <View style={styles.accountContentStatChip}>
                    <Ionicons name="document-text" size={18} color="#08FFE2" />
                    <Text style={styles.accountContentStatValue}>{userStats.totalBlogs}</Text>
                    <Text style={styles.accountContentStatLabel}>Blogs</Text>
                  </View>
                  <View style={styles.accountContentStatChip}>
                    <Ionicons name="image" size={18} color="#FF6B6B" />
                    <Text style={styles.accountContentStatValue}>{userStats.totalPosts}</Text>
                    <Text style={styles.accountContentStatLabel}>Posts</Text>
                  </View>
                </View>

                {/* Ranking */}
                <View style={styles.accountRankingCard}>
                  <View style={styles.accountRankingHeader}>
                    <Ionicons name="trophy" size={20} color="#FFD700" />
                    <Text style={styles.accountRankingTitle}>Your Ranking</Text>
                  </View>
                  <View style={styles.accountRankingBadge}>
                    <Text style={styles.accountRankingNumber}>
                      {userStats.ranking ? `#${userStats.ranking}` : '—'}
                    </Text>
                    <Text style={styles.accountRankingSubtext}>
                      {userStats.ranking ? 'Based on total likes' : 'Keep engaging to get ranked!'}
                    </Text>
                  </View>
                </View>

                  {/* Daily Check-in Card */}
                  <View style={styles.checkInCard}>
                    <View style={styles.checkInCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="flame" size={16} color="#FF6B6B" />
                        <Text style={styles.checkInCardTitle}>Community Check-in</Text>
                      </View>
                      {hasCheckedIn ? (
                        <View style={styles.checkInDonePill}>
                          <Ionicons name="checkmark-circle" size={13} color="#00FF73" />
                          <Text style={styles.checkInDonePillText}>Done today</Text>
                        </View>
                      ) : (
                        <View style={styles.checkInPendingPill}>
                          <Text style={styles.checkInPendingPillText}>Earn rewards</Text>
                        </View>
                      )}
                    </View>

                    {/* Stats row */}
                    <View style={styles.checkInStatsRow}>
                      <View style={styles.checkInStatChip}>
                        <Ionicons name="flame" size={20} color="#FF6B6B" />
                        <Text style={styles.checkInStatValue}>{checkInStreak}</Text>
                        <Text style={styles.checkInStatLabel}>Streak</Text>
                      </View>
                      <View style={styles.checkInStatChip}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={styles.checkInStatValue}>{checkInPoints}</Text>
                        <Text style={styles.checkInStatLabel}>Points</Text>
                      </View>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                      style={[styles.checkInCTA, hasCheckedIn && styles.checkInCTADone]}
                      onPress={async () => {
                        if (hasCheckedIn || checkingIn) {
                          navigation.navigate('CommunityCheckIn', { communityId, communityData: community });
                          return;
                        }
                        setCheckingIn(true);
                        try {
                          const userId = auth.currentUser?.uid;
                          if (!userId) return;
                          const result = await checkInToCommunity(db, communityId, userId, walletContext);
                          if (result.success) {
                            setHasCheckedIn(true);
                            setCheckInStreak(result.streak);
                            setCheckInPoints((prev) => prev + result.pointsEarned);
                            Alert.alert(
                              '🎉 Check-in Successful!',
                              `+${result.pointsEarned} Points${result.multiplier > 1 ? ` (${result.multiplier}x bonus!)` : ''}\n` +
                              `🔥 Streak: ${result.streak} days`,
                              [{ text: 'Awesome!' }]
                            );
                          }
                        } catch (e) {
                          Alert.alert('Error', e.message || 'Check-in failed');
                        } finally {
                          setCheckingIn(false);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={hasCheckedIn ? ['#1A2A1A', '#1A2A1A'] : ['#8B2EF0', '#6A1BB8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.checkInCTAGradient}
                      >
                        {checkingIn ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons
                              name={hasCheckedIn ? 'checkmark-circle' : 'gift-outline'}
                              size={18}
                              color={hasCheckedIn ? '#00FF73' : '#fff'}
                            />
                            <Text style={[styles.checkInCTAText, hasCheckedIn && { color: '#00FF73' }]}>
                              {hasCheckedIn
                                ? 'Checked In ✓'
                                : `Check In · +${POINTS_CONFIG.DAILY_CHECK_IN} pts`}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
              </View>
            )}
          </ScrollView>
          ) : null}

          {/* Tab 4: Chat - Rendered OUTSIDE ScrollView to avoid nested scroll issues */}
          {activeTab === 'chat' && (
            <KeyboardAvoidingView
              behavior={'padding'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
              enabled={true}
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

                    {/* Messages ScrollView - Optimized */}
                    <ScrollView
                      ref={chatScrollRef}
                      style={{ flex: 1 }}
                      contentContainerStyle={styles.chatScrollContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      onScroll={handleScroll}
                      scrollEventThrottle={400}
                      nestedScrollEnabled={false}
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
                        <RenderMessages
                          messages={chatMessages}
                          currentUser={currentUser}
                          setSelectedImageModal={setSelectedImageModal}
                          setVideoRefs={setVideoRefs}
                          playingVideoId={playingVideoId}
                          setPlayingVideoId={setPlayingVideoId}
                          handleJoinVoiceChat={handleJoinVoiceChat}
                          handleJoinScreeningRoom={handleJoinScreeningRoom}
                          handleJoinRoleplay={handleJoinRoleplay}
                          handleProfilePress={handleProfilePress}
                          navigation={navigation}
                          communityId={communityId}
                          community={community}
                          groupTitle={groupTitle}
                          playingVoiceId={playingVoiceId}
                          voiceSound={voiceSound}
                          setPlayingVoiceId={setPlayingVoiceId}
                          setVoiceSound={setVoiceSound}
                          onLongPressMessage={handleMsgLongPress}
                          liveNames={liveNames}
                        />
                      )}
                    </ScrollView>
                    {/* Floating Scroll to Bottom Button */}
                    {showScrollToBottom && (
                      <TouchableOpacity
                        style={styles.scrollToBottomButton}
                        onPress={scrollToBottom}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chevron-down" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>

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

                    {/* Action Icons Row */}
                    <View style={styles.chatActionIconsRow}>
                      {/* Image/Gallery Icon */}
                      <TouchableOpacity
                        onPress={handlePickChatImage}
                        style={styles.chatActionIcon}
                      >
                        <Ionicons name="image-outline" size={24} color="#ccc" />
                      </TouchableOpacity>

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

                      {/* Party Icon - Opens Feature Modal (Voice, Screening, Roleplay) */}
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowFeatureModal(true);
                          setShowGiftOptions(false);
                          setShowColorPicker(false);
                        }}
                        style={styles.chatActionIcon}
                      >
                        <Text style={styles.partyEmoji}>🎉</Text>
                      </TouchableOpacity>

                      {/* Text Color Picker */}
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowColorPicker(!showColorPicker);
                          setShowGiftOptions(false);
                        }}
                        style={styles.chatActionIcon}
                      >
                        <View style={[styles.colorIndicator, { backgroundColor: selectedTextColor }]} />
                      </TouchableOpacity>
                    </View>

                    {/* Message Input Field */}
                    <View style={styles.messageInputContainer}>
                      <TextInput
                        ref={inputRef}
                        placeholder="Message"
                        placeholderTextColor="#999"
                        style={[styles.messageInputField, { color: selectedTextColor }]}
                        value={chatInput}
                        onChangeText={setChatInput}
                        onFocus={() => {
                          setShowGiftOptions(false);
                          setShowColorPicker(false);
                          // Reset scrolling state and scroll to bottom
                          setIsUserScrolling(false);

                          // Additional scroll on focus
                          setTimeout(() => {
                            if (chatScrollRef.current) {
                              chatScrollRef.current.scrollToEnd({ animated: true });
                            }
                          }, 200);
                        }}
                        multiline
                        maxLength={500}
                        returnKeyType="send"
                        onSubmitEditing={handleSendMessage}
                        blurOnSubmit={false}
                        textAlignVertical="top"
                        editable={!chatLoading}
                      />
                      <TouchableOpacity
                        onPress={handleSendMessage}
                        activeOpacity={0.7}
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

                    {/* Color Picker - Shows instead of keyboard */}
                    {showColorPicker && (
                      <View style={styles.colorPickerContainer}>
                        <Text style={styles.colorPickerTitle}>Choose Text Color</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.colorPickerScroll}
                          contentContainerStyle={styles.colorPickerContent}
                        >
                          {textColors.map((color, index) => (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.colorItem,
                                { backgroundColor: color },
                                selectedTextColor === color && styles.colorItemSelected
                              ]}
                              onPress={() => {
                                setSelectedTextColor(color);
                                setShowColorPicker(false);
                                if (inputRef.current) {
                                  inputRef.current.focus();
                                }
                              }}
                            >
                              {selectedTextColor === color && (
                                <Ionicons name="checkmark" size={20} color={color === '#fff' ? '#000' : '#fff'} />
                              )}
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
                            { backgroundColor: 'rgba(0, 255, 255, 0.2)' },
                            selectedGiftOption === 'voiceChat' && styles.giftOptionSelected
                          ]}>
                            <MaterialCommunityIcons name="waveform" size={32} color="#00FFFF" />
                          </View>
                          <Text style={[
                            styles.giftOptionText,
                            selectedGiftOption === 'voiceChat' && styles.giftOptionTextSelected
                          ]}>Voice Chat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.giftOption}
                          onPress={() => {
                            setSelectedGiftOption('roleplay');
                            setShowGiftOptions(false);
                            setShowRoleplaySetup(true);
                          }}
                        >
                          <View style={[
                            styles.giftOptionIconContainer,
                            { backgroundColor: 'rgba(255, 215, 0, 0.2)' },
                            selectedGiftOption === 'roleplay' && styles.giftOptionSelected
                          ]}>
                            <MaterialCommunityIcons name="drama-masks" size={32} color="#FFD700" />
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
                            setShowGiftOptions(false);
                            createScreeningRoomMessage();
                          }}
                        >
                          <View style={[
                            styles.giftOptionIconContainer,
                            { backgroundColor: 'rgba(255, 0, 255, 0.2)' },
                            selectedGiftOption === 'screeningRoom' && styles.giftOptionSelected
                          ]}>
                            <MaterialCommunityIcons name="television-play" size={32} color="#FF00FF" />
                          </View>
                          <Text style={[
                            styles.giftOptionText,
                            selectedGiftOption === 'screeningRoom' && styles.giftOptionTextSelected
                          ]}>Screening Room</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
            </KeyboardAvoidingView>
          )}

          {/* Tab Bar at Bottom - Hidden when keyboard is active on chat tab */}
          {!(activeTab === 'chat' && keyboardHeight > 0) && (
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
          )}
        </>
      )}

      {/* Image Upload Modal */}
      <Modal
        visible={showImageModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
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
              style={{ opacity: imageLoading ? 0.6 : 1 }}
            >
              <Text style={[styles.imageModalPublish, { color: imageLoading ? '#aaa' : '#8B2EF0' }]}>
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
              {currentUser?.profileImage ? (
                <Image
                  source={{ uri: currentUser.profileImage }}
                  style={styles.imageAuthorAvatar}
                />
              ) : (
                <View style={[styles.imageAuthorAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={30} color="#657786" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.imageAuthorName}>{currentUser?.communityNickname || communityNickname || currentUser?.name || 'User'}</Text>
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
        presentationStyle="overFullScreen"
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
              style={{ opacity: blogLoading ? 0.6 : 1 }}
            >
              <Text style={[styles.blogModalPublish, { color: blogLoading ? '#aaa' : '#8B2EF0' }]}>
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
              {currentUser?.profileImage ? (
                <Image
                  source={{ uri: currentUser.profileImage }}
                  style={styles.blogAuthorAvatar}
                />
              ) : (
                <View style={[styles.blogAuthorAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={30} color="#657786" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.blogAuthorName}>{currentUser?.communityNickname || communityNickname || currentUser?.name || 'User'}</Text>
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
        presentationStyle="overFullScreen"
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
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowDraftsModal(false)}
      >
        <View style={styles.draftsModalContainer}>
          {/* Header */}
          <View style={styles.draftsModalHeader}>
            <TouchableOpacity onPress={() => setShowDraftsModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.draftsModalTitle}>Drafts</Text>
            <View style={{ width: 28 }} />
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
                  {participant.profileImage ? (
                    <Image
                      source={{ uri: participant.profileImage }}
                      style={[
                        styles.voiceChatParticipantImage,
                        speakingUsers.some(s => s.userId === participant.id) && styles.voiceChatParticipantSpeaking
                      ]}
                    />
                  ) : (
                    <View style={[
                      styles.voiceChatParticipantImage,
                      speakingUsers.some(s => s.userId === participant.id) && styles.voiceChatParticipantSpeaking,
                      { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }
                    ]}>
                      <Ionicons name="person" size={40} color="#657786" />
                    </View>
                  )}
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
                  {currentUser?.profileImage ? (
                    <Image
                      source={{ uri: currentUser.profileImage }}
                      style={styles.voiceChatParticipantImage}
                    />
                  ) : (
                    <View style={[styles.voiceChatParticipantImage, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="person" size={40} color="#657786" />
                    </View>
                  )}
                  {currentVoiceChatSession?.adminId === currentUser?.id && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  <Text style={styles.voiceChatParticipantName} numberOfLines={1}>
                    {currentUser?.communityNickname || communityNickname || currentUser?.name || 'You'}
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
                      msg.profileImage ? (
                        <Image
                          source={{ uri: msg.profileImage }}
                          style={styles.voiceChatMessageAvatar}
                        />
                      ) : (
                        <View style={[styles.voiceChatMessageAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={24} color="#657786" />
                        </View>
                      )
                    )}
                    <View style={[
                      styles.voiceChatMessageBox,
                      isCurrentUser ? styles.voiceChatMessageBoxOwn : styles.voiceChatMessageBoxOther
                    ]}>
                      {!isCurrentUser && (
                        <Text style={styles.voiceChatMessageSender}>{msg.sender || 'User'}</Text>
                      )}

                      {/* Voice Message */}
                      {!!msg.voiceUrl && (
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
                      {!!msg.text && (
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
                      currentUser?.profileImage ? (
                        <Image
                          source={{ uri: currentUser.profileImage }}
                          style={styles.voiceChatMessageAvatar}
                        />
                      ) : (
                        <View style={[styles.voiceChatMessageAvatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={24} color="#657786" />
                        </View>
                      )
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
      {/* Roleplay Setup Modal */}
      <Modal
        visible={showRoleplaySetup}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRoleplaySetup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roleplaySetupModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Roleplay Session</Text>
              <TouchableOpacity onPress={() => setShowRoleplaySetup(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.roleplaySetupContent}>
              {/* Scenario Input */}
              <Text style={styles.roleplaySetupLabel}>Scenario / Story</Text>
              <TextInput
                style={styles.roleplayScenarioInput}
                placeholder="e.g., Medieval Fantasy Adventure, Detective Mystery..."
                placeholderTextColor="#666"
                value={roleplayScenario}
                onChangeText={setRoleplayScenario}
                multiline
                maxLength={200}
              />

              {/* Roles Section */}
              <View style={styles.rolesSection}>
                <View style={styles.rolesSectionHeader}>
                  <Text style={styles.roleplaySetupLabel}>Roles</Text>
                  <TouchableOpacity
                    style={styles.addRoleButton}
                    onPress={() => {
                      setRoleplayRoles([...roleplayRoles, {
                        id: nextRoleId,
                        name: '',
                        description: '',
                        taken: false,
                        takenBy: null
                      }]);
                      setNextRoleId(nextRoleId + 1);
                    }}
                  >
                    <Ionicons name="add-circle" size={24} color="#FFD700" />
                    <Text style={styles.addRoleButtonText}>Add Role</Text>
                  </TouchableOpacity>
                </View>

                {roleplayRoles.map((role, index) => (
                  <View key={role.id} style={styles.roleInputContainer}>
                    <View style={styles.roleInputHeader}>
                      <Text style={styles.roleInputNumber}>Role {index + 1}</Text>
                      {roleplayRoles.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            setRoleplayRoles(roleplayRoles.filter(r => r.id !== role.id));
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ff4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.roleNameInput}
                      placeholder="Role name (e.g., Knight, Detective, Villain)"
                      placeholderTextColor="#666"
                      value={role.name}
                      onChangeText={(text) => {
                        const updated = roleplayRoles.map(r =>
                          r.id === role.id ? { ...r, name: text } : r
                        );
                        setRoleplayRoles(updated);
                      }}
                      maxLength={50}
                    />
                    <TextInput
                      style={styles.roleDescriptionInput}
                      placeholder="Description (optional)"
                      placeholderTextColor="#666"
                      value={role.description}
                      onChangeText={(text) => {
                        const updated = roleplayRoles.map(r =>
                          r.id === role.id ? { ...r, description: text } : r
                        );
                        setRoleplayRoles(updated);
                      }}
                      multiline
                      maxLength={150}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.createRoleplayButton}
              onPress={() => createRoleplayMessage(roleplayScenario, roleplayRoles)}
            >
              <MaterialCommunityIcons name="drama-masks" size={24} color="#000" />
              <Text style={styles.createRoleplayButtonText}>Create Roleplay Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Character Selector Modal for Joining Roleplay */}
      <Modal
        visible={showCharacterSelectorForJoin}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert(
            'Character Required',
            'You need to select or create a character to join this roleplay. Do you want to cancel?',
            [
              { text: 'Continue', style: 'cancel' },
              {
                text: 'Cancel Join',
                style: 'destructive',
                onPress: () => {
                  setShowCharacterSelectorForJoin(false);
                  setPendingRoleplayJoin(null);
                  setSelectedCharacterForRoleplay(null);
                }
              }
            ]
          );
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.characterSelectorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your Character</Text>
              <TouchableOpacity onPress={() => {
                Alert.alert(
                  'Character Required',
                  'You need to select or create a character to join this roleplay. Do you want to cancel?',
                  [
                    { text: 'Continue', style: 'cancel' },
                    {
                      text: 'Cancel Join',
                      style: 'destructive',
                      onPress: () => {
                        setShowCharacterSelectorForJoin(false);
                        setPendingRoleplayJoin(null);
                        setSelectedCharacterForRoleplay(null);
                      }
                    }
                  ]
                );
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.characterSelectorContent}>
              {/* Info Banner */}
              <View style={styles.characterInfoBanner}>
                <MaterialCommunityIcons name="drama-masks" size={24} color="#FFD700" />
                <Text style={styles.characterInfoText}>
                  Choose a character to join this roleplay. You'll appear with your character's name, image, and colors - not your real profile!
                </Text>
              </View>

              {/* Existing Characters */}
              {characterCollection && characterCollection.length > 0 && (
                <>
                  <Text style={styles.characterSectionTitle}>Your Characters</Text>
                  <Text style={styles.characterSectionSubtitle}>Select an existing character</Text>

                  {characterCollection.map((character, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.characterCard}
                      onPress={() => {
                        setSelectedCharacterForRoleplay(character);
                        proceedToRoleSelection();
                      }}
                    >
                      {character.avatar ? (
                        <Image
                          source={{ uri: character.avatar }}
                          style={styles.characterCardAvatar}
                        />
                      ) : (
                        <View style={[styles.characterCardAvatar, { backgroundColor: character.themeColor || '#FFD700' }]}>
                          <MaterialCommunityIcons name="account" size={40} color="#fff" />
                        </View>
                      )}

                      <View style={styles.characterCardInfo}>
                        <Text style={styles.characterCardName}>{character.name}</Text>
                        {!!character.subtitle && (
                          <Text style={styles.characterCardSubtitle}>{character.subtitle}</Text>
                        )}
                        <View style={styles.characterCardTags}>
                          {character.tags && character.tags.slice(0, 3).map((tag, idx) => (
                            <View key={idx} style={styles.characterTag}>
                              <Text style={styles.characterTagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>
                  ))}

                  <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </>
              )}

              {/* Create New Character */}
              <Text style={styles.characterSectionTitle}>
                {characterCollection && characterCollection.length > 0 ? 'Create New Character' : 'Get Started'}
              </Text>
              <Text style={styles.characterSectionSubtitle}>
                {characterCollection && characterCollection.length > 0
                  ? 'Design a brand new character for this roleplay'
                  : 'Create your first character to join the roleplay'}
              </Text>

              <TouchableOpacity
                style={styles.createCharacterButton}
                onPress={() => {
                  // Close this modal and show roleplay character creation
                  setShowCharacterSelectorForJoin(false);
                  setShowMiniScreen('roleplay');
                  setRoleplayPage(1);
                }}
              >
                <MaterialCommunityIcons name="plus-circle" size={32} color="#A855F7" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.createCharacterButtonText}>Create New Character</Text>
                  <Text style={styles.createCharacterButtonSubtext}>
                    Customize name, image, colors, and personality
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Role Selection Modal */}
      <Modal
        visible={showRoleSelectModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowRoleSelectModal(false);
          setSelectedRoleplayToJoin(null);
          setShowCustomRoleInput(false);
          setCustomRoleName('');
          setCustomRoleDescription('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roleSelectModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Your Role</Text>
              <TouchableOpacity onPress={() => {
                setShowRoleSelectModal(false);
                setSelectedRoleplayToJoin(null);
                setShowCustomRoleInput(false);
                setCustomRoleName('');
                setCustomRoleDescription('');
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.roleSelectContent}>
              {selectedRoleplayToJoin?.availableRoles && selectedRoleplayToJoin.availableRoles.length > 0 ? (
                <>
                  {selectedRoleplayToJoin.availableRoles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={styles.roleSelectCard}
                      onPress={() => {
                        // Close role selector modal and open character creation
                        setShowRoleSelectModal(false);
                        setShowMiniScreen('roleplay');
                        setRoleplayPage(1);
                      }}
                    >
                      <View style={styles.roleSelectHeader}>
                        <MaterialCommunityIcons name="drama-masks" size={32} color="#FFD700" />
                        <Text style={styles.roleSelectName}>{role.name}</Text>
                      </View>
                      {!!role.description && (
                        <Text style={styles.roleSelectDescription}>{role.description}</Text>
                      )}
                      <View style={styles.roleSelectButton}>
                        <Ionicons name="person-add" size={18} color="#000" />
                        <Text style={styles.roleSelectButtonText}>Select This Role</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </>
              ) : (
                <View style={styles.noRolesContainer}>
                  <MaterialCommunityIcons name="drama-masks" size={48} color="#666" />
                  <Text style={styles.noRolesText}>All predefined roles are taken</Text>
                  <Text style={styles.noRolesSubtext}>Create your own custom role to join!</Text>
                </View>
              )}

              {/* Custom Role Creation Section */}
              {!showCustomRoleInput ? (
                <TouchableOpacity
                  style={styles.createCustomRoleButton}
                  onPress={() => setShowCustomRoleInput(true)}
                >
                  <Ionicons name="add-circle" size={24} color="#FFD700" />
                  <Text style={styles.createCustomRoleText}>Create Custom Role</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.customRoleInputContainer}>
                  <Text style={styles.customRoleTitle}>Create Your Custom Role</Text>

                  <TextInput
                    style={styles.customRoleInput}
                    placeholder="Role Name (e.g., Wandering Merchant)"
                    placeholderTextColor="#666"
                    value={customRoleName}
                    onChangeText={setCustomRoleName}
                    maxLength={50}
                  />

                  <TextInput
                    style={[styles.customRoleInput, styles.customRoleDescInput]}
                    placeholder="Role Description (optional)"
                    placeholderTextColor="#666"
                    value={customRoleDescription}
                    onChangeText={setCustomRoleDescription}
                    multiline
                    numberOfLines={3}
                    maxLength={200}
                  />

                  <View style={styles.customRoleButtonsRow}>
                    <TouchableOpacity
                      style={styles.cancelCustomRoleButton}
                      onPress={() => {
                        setShowCustomRoleInput(false);
                        setCustomRoleName('');
                        setCustomRoleDescription('');
                      }}
                    >
                      <Text style={styles.cancelCustomRoleText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.confirmCustomRoleButton}
                      onPress={createAndJoinCustomRole}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#000" />
                      <Text style={styles.confirmCustomRoleText}>Create & Join</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* Feature Selection Modal */}
      <Modal
        visible={showFeatureModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowFeatureModal(false)}
      >
        <View style={styles.featureModalOverlay}>
          <View style={styles.featureModalContainer}>
            <View style={styles.featureModalHeader}>
              <Text style={styles.featureModalTitle}>Choose Activity</Text>
              <TouchableOpacity onPress={() => setShowFeatureModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.featuresGrid}>
              {/* Voice Room */}
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => {
                  setShowFeatureModal(false);
                  setTimeout(() => setShowMiniScreen('voice'), 400);
                }}
              >
                <LinearGradient
                  colors={['#00FFFF', '#00CED1']}
                  style={styles.featureGradient}
                >
                  <Ionicons name="call" size={40} color="#fff" />
                  <Text style={styles.featureCardTitle}>Voice Room</Text>
                  <Text style={styles.featureCardDesc}>For calling</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Screening Room */}
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => {
                  setShowFeatureModal(false);
                  setTimeout(() => setShowMiniScreen('screening'), 400);
                }}
              >
                <LinearGradient
                  colors={['#FF00FF', '#DA70D6']}
                  style={styles.featureGradient}
                >
                  <Ionicons name="tv" size={40} color="#fff" />
                  <Text style={styles.featureCardTitle}>Screening Room</Text>
                  <Text style={styles.featureCardDesc}>Watch YouTube videos together</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Roleplay */}
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => {
                  setShowFeatureModal(false);
                  setPendingRoleplayJoin(null); // Clear pending join info for new roleplay
                  setRoleplayPage(1);
                  setTimeout(() => setShowMiniScreen('roleplay'), 400);
                }}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.featureGradient}
                >
                  <MaterialCommunityIcons name="drama-masks" size={40} color="#fff" />
                  <Text style={styles.featureCardTitle}>Roleplay</Text>
                  <Text style={styles.featureCardDesc}>Create characters & scenarios</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Voice Room Mini Screen */}
      <Modal
        visible={showMiniScreen === 'voice'}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowMiniScreen(null)}
      >
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <LinearGradient
              colors={['#1a1a1a', '#0a0a0a']}
              style={styles.miniScreenContent}
            >
              <View style={styles.miniScreenHeader}>
                <TouchableOpacity onPress={() => setShowMiniScreen(null)}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.miniScreenTitle}>Voice Room</Text>
                <View style={{ width: 28 }} />
              </View>

              <View style={styles.miniScreenBody}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="call" size={60} color="#00FFFF" />
                </View>
                <Text style={styles.miniScreenDescription}>
                  Start a voice room for calling and real-time audio conversations with community members.
                </Text>
              </View>

              <View style={styles.miniScreenActions}>
                <TouchableOpacity
                  style={[styles.miniScreenButton, styles.startButton]}
                  onPress={() => {
                    setShowMiniScreen(null);
                    createVoiceRoomMessage();
                  }}
                >
                  <Text style={styles.miniScreenButtonText}>Start Voice Room</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Screening Room Mini Screen */}
      <Modal
        visible={showMiniScreen === 'screening'}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowMiniScreen(null)}
      >
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <LinearGradient
              colors={['#1a1a1a', '#0a0a0a']}
              style={styles.miniScreenContent}
            >
              <View style={styles.miniScreenHeader}>
                <TouchableOpacity onPress={() => setShowMiniScreen(null)}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.miniScreenTitle}>Screening Room</Text>
                <View style={{ width: 28 }} />
              </View>

              <View style={styles.miniScreenBody}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="play-circle" size={60} color="#FF00FF" />
                </View>
                <Text style={styles.miniScreenDescription}>
                  Create a screening room to watch YouTube videos together. Add videos to playlist, reorder, or remove them.
                </Text>
              </View>

              <View style={styles.miniScreenActions}>
                <TouchableOpacity
                  style={[styles.miniScreenButton, styles.startButton]}
                  onPress={() => {
                    setShowMiniScreen(null);
                    createScreeningRoomMessage();
                  }}
                >
                  <Text style={styles.miniScreenButtonText}>Start Screening Room</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Roleplay Mini Screen with 3 Pages */}
      <Modal
        visible={showMiniScreen === 'roleplay'}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          setShowMiniScreen(null);
          setPendingRoleplayJoin(null); // Reset pending join info
          setRoleplayPage(1);
          setCharacterName('');
          setCharacterGender('');
          setCharacterAge('');
          setCharacterDescription('');
          setEditingCharacterId(null);
        }}
      >
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <LinearGradient
              colors={['#1a1a1a', '#0a0a0a']}
              style={styles.miniScreenContent}
            >
              <View style={styles.miniScreenHeader}>
                <TouchableOpacity onPress={() => {
                  if (roleplayPage === 1) {
                    // On page 1 (choice screen), close modal
                    setShowMiniScreen(null);
                    setPendingRoleplayJoin(null); // Reset pending join info
                    setRoleplayPage(1);
                    setCharacterAvatar('');
                    setCharacterName('');
                    setCharacterSubtitle('');
                    setCharacterThemeColor('#FFD700');
                    setCharacterGender('');
                    setCharacterLanguage('English');
                    setCharacterTags([]);
                    setCharacterAge('');
                    setCharacterHeight('');
                    setCharacterDescription('');
                    setCharacterGreeting('');
                    setEditingCharacterId(null);
                  } else if (roleplayPage === 2) {
                    // From page 2 (basic info), go back to choice
                    setRoleplayPage(1);
                  } else if (roleplayPage === 3) {
                    // From page 3 (personal details), go back to basic info
                    setRoleplayPage(2);
                  } else if (roleplayPage === 4) {
                    // From page 4 (tags/description), go back to personal details
                    setRoleplayPage(3);
                  } else if (roleplayPage === 5) {
                    // From page 5 (character collection), go back to choice
                    setRoleplayPage(1);
                    setCharacterName('');
                    setCharacterGender('');
                    setCharacterAge('');
                    setCharacterDescription('');
                    setEditingCharacterId(null);
                  } else {
                    setRoleplayPage(roleplayPage - 1);
                  }
                }}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.miniScreenTitle}>
                  {roleplayPage < 3 ? `Add Character (${roleplayPage}/2)` : 'Character Collection'}
                </Text>
                <TouchableOpacity onPress={() => {
                  if (roleplayPage === 3 && selectedCharactersForSession.length > 0) {
                    // Start roleplay with selected characters
                    setShowMiniScreen(null);
                    startRoleplayWithCharacters();
                  }
                }}>
                  {roleplayPage === 3 && selectedCharactersForSession.length > 0 && (
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.miniScreenBody} showsVerticalScrollIndicator={false}>
                {/* Page 1: Choose Action - Create New or Use Existing */}
                {roleplayPage === 1 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="people" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>
                      {pendingRoleplayJoin ? 'Join Roleplay' : 'Start Roleplay'}
                    </Text>
                    <Text style={styles.roleplayPageDesc}>
                      {pendingRoleplayJoin
                        ? 'Choose a character to join this roleplay session'
                        : 'Choose how you want to begin your roleplay session'}
                    </Text>

                    <TouchableOpacity
                      style={styles.roleplayChoiceButton}
                      onPress={() => setRoleplayPage(2)}
                    >
                      <View style={styles.roleplayChoiceIcon}>
                        <Ionicons name="person-add" size={40} color="#FFD700" />
                      </View>
                      <View style={styles.roleplayChoiceContent}>
                        <Text style={styles.roleplayChoiceTitle}>Create New Character</Text>
                        <Text style={styles.roleplayChoiceDesc}>
                          Create a brand new character with custom attributes
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#888" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.roleplayChoiceButton}
                      onPress={() => setRoleplayPage(5)}
                    >
                      <View style={styles.roleplayChoiceIcon}>
                        <Ionicons name="albums" size={40} color="#4CAF50" />
                      </View>
                      <View style={styles.roleplayChoiceContent}>
                        <Text style={styles.roleplayChoiceTitle}>Use Existing Characters</Text>
                        <Text style={styles.roleplayChoiceDesc}>
                          Select from your saved characters collection
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#888" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Page 2: Avatar, Name, Subtitle, Theme Color */}
                {roleplayPage === 2 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="person-add" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Basic Info</Text>
                    <Text style={styles.roleplayPageDesc}>Let's start with the basics</Text>

                    {/* Avatar */}
                    <Text style={styles.attributeLabel}>Avatar</Text>
                    <TouchableOpacity
                      style={styles.avatarSelector}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.8,
                        });
                        if (!result.canceled) {
                          const safeUri = await normalizeBlobUri(result.assets[0].uri);
                          setCharacterAvatar(safeUri);
                        }
                      }}
                    >
                      {characterAvatar ? (
                        <Image source={{ uri: characterAvatar }} style={styles.avatarPreview} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Ionicons name="camera" size={40} color="#666" />
                          <Text style={styles.avatarPlaceholderText}>Tap to select avatar</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Name */}
                    <Text style={styles.attributeLabel}>Name *</Text>
                    <TextInput
                      style={styles.roleplayInput}
                      placeholder="Enter character name"
                      placeholderTextColor="#666"
                      value={characterName}
                      onChangeText={setCharacterName}
                      maxLength={50}
                    />

                    {/* Subtitle */}
                    <Text style={styles.attributeLabel}>Subtitle</Text>
                    <TextInput
                      style={styles.roleplayInput}
                      placeholder="e.g., The Brave Warrior, A Mysterious Stranger"
                      placeholderTextColor="#666"
                      value={characterSubtitle}
                      onChangeText={setCharacterSubtitle}
                      maxLength={100}
                    />

                    {/* Theme Color */}
                    <Text style={styles.attributeLabel}>Theme Color</Text>
                    <View style={styles.colorSelector}>
                      {themeColors.map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorOption,
                            { backgroundColor: color },
                            characterThemeColor === color && styles.colorOptionSelected
                          ]}
                          onPress={() => setCharacterThemeColor(color)}
                        >
                          {characterThemeColor === color && (
                            <Ionicons name="checkmark" size={24} color="#fff" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Page 3: Gender, Language, Age, Height */}
                {roleplayPage === 3 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="list" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Personal Details</Text>
                    <Text style={styles.roleplayPageDesc}>Add character's personal information</Text>

                    {/* Gender */}
                    <Text style={styles.attributeLabel}>Gender</Text>
                    <View style={styles.genderSelector}>
                      {['Male', 'Female', 'Non-binary', 'Other'].map((gender) => (
                        <TouchableOpacity
                          key={gender}
                          style={[
                            styles.genderOption,
                            characterGender === gender && styles.genderOptionSelected
                          ]}
                          onPress={() => setCharacterGender(gender)}
                        >
                          <Text style={[
                            styles.genderOptionText,
                            characterGender === gender && styles.genderOptionTextSelected
                          ]}>{gender}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Language */}
                    <Text style={styles.attributeLabel}>Language</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageScroll}>
                      <View style={styles.languageSelector}>
                        {languages.map((lang) => (
                          <TouchableOpacity
                            key={lang}
                            style={[
                              styles.languageOption,
                              characterLanguage === lang && styles.languageOptionSelected
                            ]}
                            onPress={() => setCharacterLanguage(lang)}
                          >
                            <Text style={[
                              styles.languageOptionText,
                              characterLanguage === lang && styles.languageOptionTextSelected
                            ]}>{lang}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Age */}
                    <Text style={styles.attributeLabel}>Age</Text>
                    <TextInput
                      style={styles.roleplayInput}
                      placeholder="Enter age (e.g., 25)"
                      placeholderTextColor="#666"
                      value={characterAge}
                      onChangeText={setCharacterAge}
                      keyboardType="numeric"
                      maxLength={3}
                    />

                    {/* Height */}
                    <Text style={styles.attributeLabel}>Height</Text>
                    <TextInput
                      style={styles.roleplayInput}
                      placeholder="e.g., 5'10&quot;, 178 cm"
                      placeholderTextColor="#666"
                      value={characterHeight}
                      onChangeText={setCharacterHeight}
                      maxLength={20}
                    />
                  </View>
                )}

                {/* Page 4: Tags, Description, Greeting */}
                {roleplayPage === 4 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="pricetags" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Character Details</Text>
                    <Text style={styles.roleplayPageDesc}>Add personality tags and description</Text>

                    {/* Tags */}
                    <Text style={styles.attributeLabel}>Tags</Text>
                    <View style={styles.tagsContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
                        <View style={styles.tagsRow}>
                          {suggestedTags.map((tag) => (
                            <TouchableOpacity
                              key={tag}
                              style={[
                                styles.tagOption,
                                characterTags.includes(tag) && styles.tagOptionSelected
                              ]}
                              onPress={() => {
                                if (characterTags.includes(tag)) {
                                  setCharacterTags(characterTags.filter(t => t !== tag));
                                } else {
                                  setCharacterTags([...characterTags, tag]);
                                }
                              }}
                            >
                              <Text style={[
                                styles.tagOptionText,
                                characterTags.includes(tag) && styles.tagOptionTextSelected
                              ]}>{tag}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>

                      {/* Selected Tags */}
                      {characterTags.length > 0 && (
                        <View style={styles.selectedTagsContainer}>
                          {characterTags.map((tag) => (
                            <View key={tag} style={styles.selectedTag}>
                              <Text style={styles.selectedTagText}>{tag}</Text>
                              <TouchableOpacity
                                onPress={() => setCharacterTags(characterTags.filter(t => t !== tag))}
                              >
                                <Ionicons name="close-circle" size={18} color="#FFD700" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Custom Tag Input */}
                      <View style={styles.customTagInput}>
                        <TextInput
                          style={styles.customTagField}
                          placeholder="Add custom tag"
                          placeholderTextColor="#666"
                          value={customTag}
                          onChangeText={setCustomTag}
                          maxLength={20}
                        />
                        <TouchableOpacity
                          style={styles.addCustomTagButton}
                          onPress={() => {
                            if (customTag.trim() && !characterTags.includes(customTag.trim())) {
                              setCharacterTags([...characterTags, customTag.trim()]);
                              setCustomTag('');
                            }
                          }}
                        >
                          <Ionicons name="add-circle" size={24} color="#4CAF50" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Description */}
                    <Text style={styles.attributeLabel}>Description</Text>
                    <TextInput
                      style={[styles.roleplayInput, styles.roleplayTextArea]}
                      placeholder="Brief description of your character's appearance, personality, background..."
                      placeholderTextColor="#666"
                      value={characterDescription}
                      onChangeText={setCharacterDescription}
                      multiline
                      numberOfLines={6}
                      maxLength={500}
                      textAlignVertical="top"
                    />

                    {/* Greeting Message */}
                    <Text style={styles.attributeLabel}>Greeting Message</Text>
                    <TextInput
                      style={[styles.roleplayInput, styles.roleplayTextArea]}
                      placeholder="How does this character greet others? e.g., 'Hello there, traveler!'"
                      placeholderTextColor="#666"
                      value={characterGreeting}
                      onChangeText={setCharacterGreeting}
                      multiline
                      numberOfLines={4}
                      maxLength={300}
                      textAlignVertical="top"
                    />
                  </View>
                )}

                {/* Page 5: Character Collection (Use Existing) */}
                {roleplayPage === 5 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.characterCollectionHeader}>
                      <Text style={styles.collectionTitle}>Your Characters</Text>
                      <TouchableOpacity
                        style={styles.addCharacterButton}
                        onPress={() => {
                          setRoleplayPage(2);
                          setCharacterAvatar('');
                          setCharacterName('');
                          setCharacterSubtitle('');
                          setCharacterThemeColor('#FFD700');
                          setCharacterGender('');
                          setCharacterLanguage('English');
                          setCharacterTags([]);
                          setCharacterAge('');
                          setCharacterHeight('');
                          setCharacterDescription('');
                          setCharacterGreeting('');
                          setEditingCharacterId(null);
                        }}
                      >
                        <Ionicons name="add-circle" size={24} color="#FFD700" />
                        <Text style={styles.addCharacterButtonText}>Add Character</Text>
                      </TouchableOpacity>
                    </View>

                    {characterCollection.length === 0 ? (
                      <View style={styles.emptyCollection}>
                        <Ionicons name="person-outline" size={60} color="#666" />
                        <Text style={styles.emptyCollectionText}>No characters yet</Text>
                        <Text style={styles.emptyCollectionSubtext}>Create your first character</Text>
                      </View>
                    ) : (
                      <View style={styles.characterList}>
                        {characterCollection.map((character) => {
                          const isSelected = selectedCharactersForSession.some(c => c.id === character.id);
                          return (
                            <View key={character.id} style={styles.characterCard}>
                              <TouchableOpacity
                                style={[
                                  styles.characterCardMain,
                                  isSelected && styles.characterCardSelected
                                ]}
                                onPress={() => {
                                  if (isSelected) {
                                    setSelectedCharactersForSession(prev =>
                                      prev.filter(c => c.id !== character.id)
                                    );
                                  } else {
                                    setSelectedCharactersForSession(prev => [...prev, character]);
                                  }
                                }}
                              >
                                {/* Character Avatar */}
                                {!!character.avatar && (
                                  <Image
                                    source={{ uri: character.avatar }}
                                    style={styles.characterCardAvatar}
                                  />
                                )}

                                <View style={styles.characterCardContent}>
                                  {/* Character Header with Name and Selection */}
                                  <View style={styles.characterCardHeader}>
                                    <View style={styles.characterCardHeaderLeft}>
                                      <Text style={[
                                        styles.characterCardName,
                                        character.themeColor && { color: character.themeColor }
                                      ]}>{character.name}</Text>
                                      {!!character.subtitle && (
                                        <Text style={styles.characterCardSubtitle}>{character.subtitle}</Text>
                                      )}
                                    </View>
                                    {isSelected && (
                                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                                    )}
                                  </View>

                                  {/* Author Username */}
                                  <Text style={styles.characterAuthor}>by @{currentUser?.username || 'Unknown'}</Text>

                                  {/* Tags */}
                                  {character.tags && character.tags.length > 0 && (
                                    <View style={styles.characterCardTags}>
                                      {character.tags.slice(0, 3).map((tag, index) => (
                                        <View key={index} style={styles.characterCardTag}>
                                          <Text style={styles.characterCardTagText}>{tag}</Text>
                                        </View>
                                      ))}
                                      {character.tags.length > 3 && (
                                        <Text style={styles.characterCardMoreTags}>+{character.tags.length - 3}</Text>
                                      )}
                                    </View>
                                  )}

                                  {/* Attributes (Gender, Age, Height, Language) */}
                                  <View style={styles.characterCardAttributes}>
                                    {!!character.gender && (
                                      <View style={styles.attributeBadge}>
                                        <Text style={styles.attributeBadgeText}>{character.gender}</Text>
                                      </View>
                                    )}
                                    {!!character.age && (
                                      <View style={styles.attributeBadge}>
                                        <Text style={styles.attributeBadgeText}>{character.age} yrs</Text>
                                      </View>
                                    )}
                                    {!!character.height && (
                                      <View style={styles.attributeBadge}>
                                        <Text style={styles.attributeBadgeText}>{character.height}</Text>
                                      </View>
                                    )}
                                    {!!character.language && (
                                      <View style={styles.attributeBadge}>
                                        <Text style={styles.attributeBadgeText}>{character.language}</Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Description */}
                                  {!!character.description && (
                                    <Text style={styles.characterCardDescription} numberOfLines={2}>
                                      {character.description}
                                    </Text>
                                  )}
                                </View>
                              </TouchableOpacity>

                              <View style={styles.characterCardActions}>
                                <TouchableOpacity
                                  style={styles.characterActionButton}
                                  onPress={() => {
                                    setCharacterAvatar(character.avatar || '');
                                    setCharacterName(character.name);
                                    setCharacterSubtitle(character.subtitle || '');
                                    setCharacterThemeColor(character.themeColor || '#FFD700');
                                    setCharacterGender(character.gender);
                                    setCharacterLanguage(character.language || 'English');
                                    setCharacterTags(character.tags || []);
                                    setCharacterAge(character.age);
                                    setCharacterHeight(character.height || '');
                                    setCharacterDescription(character.description);
                                    setCharacterGreeting(character.greeting || '');
                                    setEditingCharacterId(character.id);
                                    setRoleplayPage(2);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={20} color="#4CAF50" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.characterActionButton}
                                  onPress={() => {
                                    Alert.alert(
                                      'Remove Character',
                                      `Remove ${character.name} from your collection?`,
                                      [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                          text: 'Remove',
                                          style: 'destructive',
                                          onPress: () => removeCharacterFromCollection(character.id)
                                        }
                                      ]
                                    );
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {selectedCharactersForSession.length > 0 && (
                      <View style={styles.selectedCharactersInfo}>
                        <Text style={styles.selectedCharactersText}>
                          {selectedCharactersForSession.length} character(s) selected for roleplay
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              <View style={styles.miniScreenActions}>
                {/* Page 2: Next button to go to page 3 */}
                {roleplayPage === 2 && (
                  <TouchableOpacity
                    style={[styles.miniScreenButton, styles.nextButton, !characterName.trim() && styles.buttonDisabled]}
                    onPress={() => {
                      if (!characterName.trim()) {
                        Alert.alert('Required', 'Please enter a character name');
                        return;
                      }
                      setRoleplayPage(3);
                    }}
                    disabled={!characterName.trim()}
                  >
                    <Text style={styles.miniScreenButtonText}>Next</Text>
                  </TouchableOpacity>
                )}

                {/* Page 3: Next button to go to page 4 */}
                {roleplayPage === 3 && (
                  <TouchableOpacity
                    style={[styles.miniScreenButton, styles.nextButton]}
                    onPress={() => setRoleplayPage(4)}
                  >
                    <Text style={styles.miniScreenButtonText}>Next</Text>
                  </TouchableOpacity>
                )}

                {/* Page 4: Save button to save character and go to collection (page 5) */}
                {roleplayPage === 4 && (
                  <TouchableOpacity
                    style={[styles.miniScreenButton, styles.nextButton]}
                    onPress={() => saveCharacterToCollection()}
                  >
                    <Text style={styles.miniScreenButtonText}>
                      {editingCharacterId ? 'Update Character' : 'Save Character'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Page 5: Start/Join roleplay button when characters selected */}
                {roleplayPage === 5 && selectedCharactersForSession.length > 0 && (
                  <TouchableOpacity
                    style={[styles.miniScreenButton, styles.startButton]}
                    onPress={() => {
                      setShowMiniScreen(null);
                      startRoleplayWithCharacters();
                    }}
                  >
                    <Text style={styles.miniScreenButtonText}>
                      {pendingRoleplayJoin ? 'Join Roleplay Session' : 'Start Roleplay Session'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Community Nickname Modal */}
      <Modal
        visible={showNicknameModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowNicknameModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.adminModalContainer}>
            <View style={[styles.adminModalContent, { maxHeight: '60%' }]}>
              {/* Header */}
              <View style={styles.adminModalHeader}>
                <Text style={[styles.adminModalTitle, { color: '#8B2EF0' }]}>Community Nickname</Text>
                <TouchableOpacity onPress={() => setShowNicknameModal(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                <Text style={{ color: '#aaa', fontSize: 14, marginBottom: 12 }}>
                  Set a different name to use in this community. Leave empty to use your global profile name.
                </Text>

                {/* Current global name */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#252525', padding: 12, borderRadius: 10 }}>
                  <Ionicons name="globe-outline" size={18} color="#8B2EF0" />
                  <Text style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>Global name: </Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                    {currentUser?.name || currentUser?.displayName || 'User'}
                  </Text>
                </View>

                {/* Nickname input */}
                <TextInput
                  style={{
                    backgroundColor: '#252525',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: '#fff',
                    borderWidth: 1,
                    borderColor: communityNickname ? '#8B2EF0' : '#333',
                    marginBottom: 8,
                  }}
                  placeholder="Enter community nickname..."
                  placeholderTextColor="#666"
                  value={nicknameInput}
                  onChangeText={setNicknameInput}
                  maxLength={30}
                  autoFocus={true}
                />
                <Text style={{ color: '#666', fontSize: 12, textAlign: 'right', marginBottom: 20 }}>
                  {nicknameInput.length}/30
                </Text>

                {/* Save / Remove buttons */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {communityNickname ? (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: '#2a1a1a',
                        padding: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#ff4b6e',
                      }}
                      onPress={() => {
                        setNicknameInput('');
                        handleSaveNickname();
                      }}
                      disabled={nicknameSaving}
                    >
                      <Text style={{ color: '#ff4b6e', fontWeight: '700', fontSize: 15 }}>
                        {nicknameSaving ? 'Removing...' : 'Remove Nickname'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#8B2EF0',
                      padding: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      opacity: nicknameSaving ? 0.6 : 1,
                    }}
                    onPress={handleSaveNickname}
                    disabled={nicknameSaving}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      {nicknameSaving ? 'Saving...' : 'Save Nickname'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Panel Modal */}
      <Modal
        visible={showAdminPanel}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowAdminPanel(false)}
      >
        <View style={styles.adminModalContainer}>
          <View style={styles.adminModalContent}>
            {/* Header */}
            <View style={styles.adminModalHeader}>
              <Text style={styles.adminModalTitle}>Admin Panel</Text>
              <TouchableOpacity onPress={() => setShowAdminPanel(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Admin Options */}
            <ScrollView style={styles.adminOptionsContainer}>
              {/* Share Community */}
              <TouchableOpacity
                style={styles.adminOption}
                onPress={() => {
                  setShowAdminPanel(false);
                  setShowShareModal(true);
                }}
              >
                <MaterialIcons name="share" size={24} color="#8B2EF0" />
                <View style={styles.adminOptionText}>
                  <Text style={styles.adminOptionTitle}>Share Community</Text>
                  <Text style={styles.adminOptionSubtitle}>Invite link & QR code</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>

              {/* Manage Announcements */}
              <TouchableOpacity
                style={styles.adminOption}
                onPress={() => {
                  setShowAdminPanel(false);
                  setShowAnnouncementsModal(true);
                }}
              >
                <MaterialCommunityIcons name="bullhorn" size={24} color="#8B2EF0" />
                <View style={styles.adminOptionText}>
                  <Text style={styles.adminOptionTitle}>Manage Announcements</Text>
                  <Text style={styles.adminOptionSubtitle}>{announcements.length}/3 pinned</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>

              {/* Manage Featured Posts */}
              <TouchableOpacity
                style={styles.adminOption}
                onPress={() => {
                  setShowAdminPanel(false);
                  setShowFeaturedModal(true);
                }}
              >
                <MaterialIcons name="star" size={24} color="#FFD700" />
                <View style={styles.adminOptionText}>
                  <Text style={styles.adminOptionTitle}>Manage Featured Posts</Text>
                  <Text style={styles.adminOptionSubtitle}>{featuredPosts.length} featured</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>

              {/* View Members */}
              <TouchableOpacity
                style={styles.adminOption}
                onPress={() => {
                  setShowAdminPanel(false);
                  setMembersModalContext('all');
                  setShowMembersModal(true);
                }}
              >
                <MaterialIcons name="people" size={24} color="#8B2EF0" />
                <View style={styles.adminOptionText}>
                  <Text style={styles.adminOptionTitle}>Manage Members</Text>
                  <Text style={styles.adminOptionSubtitle}>{allMembers.length} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>

              {/* Manage Moderators */}
              <TouchableOpacity
                style={styles.adminOption}
                onPress={() => {
                  setShowAdminPanel(false);
                  navigation.navigate('ModeratorsManagement', { communityId });
                }}
              >
                <MaterialIcons name="admin-panel-settings" size={24} color="#10B981" />
                <View style={styles.adminOptionText}>
                  <Text style={styles.adminOptionTitle}>Manage Moderators</Text>
                  <Text style={styles.adminOptionSubtitle}>{currentModeratorIds.length} moderators</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>

              {/* Delete Community */}
              <TouchableOpacity
                style={[styles.adminOption, styles.adminOptionDanger]}
                onPress={() => {
                  setShowAdminPanel(false);
                  handleDeleteCommunity();
                }}
              >
                <MaterialIcons name="delete-forever" size={24} color="#ff4b6e" />
                <View style={styles.adminOptionText}>
                  <Text style={[styles.adminOptionTitle, { color: '#ff4b6e' }]}>Delete Community</Text>
                  <Text style={styles.adminOptionSubtitle}>Permanently remove this community</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>

              {/* Community Stats */}
              <View style={styles.adminStatsContainer}>
                <Text style={styles.adminStatsTitle}>Community Statistics</Text>
                <View style={styles.adminStatRow}>
                  <Text style={styles.adminStatLabel}>Total Members:</Text>
                  <Text style={styles.adminStatValue}>{community?.memberCount || allMembers.length}</Text>
                </View>
                <View style={styles.adminStatRow}>
                  <Text style={styles.adminStatLabel}>Total Massages:</Text>
                  <Text style={styles.adminStatValue}>{chatMessages.length}</Text>
                </View>
                <View style={styles.adminStatRow}>
                  <Text style={styles.adminStatLabel}>Created:</Text>
                  <Text style={styles.adminStatValue}>
                    {community?.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.adminModalContainer}>
          <View style={styles.adminModalContent}>
            {/* Header */}
            <View style={styles.adminModalHeader}>
              <Text style={styles.adminModalTitle}>Share Community</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Share Content */}
            <ScrollView style={styles.shareContentContainer}>
              {/* Invite Link */}
              <View style={styles.shareSection}>
                <Text style={styles.shareSectionTitle}>Invite Link</Text>
                <View style={styles.inviteLinkContainer}>
                  <Text style={styles.inviteLinkText} numberOfLines={1}>
                    {inviteLink}
                  </Text>
                </View>
                <View style={styles.shareButtonsRow}>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleCopyInviteLink}
                  >
                    <MaterialIcons name="content-copy" size={20} color="#fff" />
                    <Text style={styles.shareButtonText}>Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareButton, styles.shareButtonPrimary]}
                    onPress={handleShareCommunity}
                  >
                    <MaterialIcons name="share" size={20} color="#fff" />
                    <Text style={styles.shareButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* QR Code Section */}
              <View style={styles.shareSection}>
                <Text style={styles.shareSectionTitle}>QR Code</Text>
                <View style={styles.qrCodeContainer}>
                  {qrCodeValue ? (
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCodeValue)}&color=000000&bgcolor=FFFFFF&margin=2` }}
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.qrCodePlaceholder}>
                      <MaterialCommunityIcons name="qrcode" size={80} color="#8B2EF0" />
                      <Text style={styles.qrCodeSubtext}>Generating QR Code…</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.shareButton, styles.shareButtonSecondary]}
                  onPress={handleDownloadQRCode}
                >
                  <MaterialIcons name="download" size={20} color="#8B2EF0" />
                  <Text style={[styles.shareButtonText, { color: '#8B2EF0' }]}>Download QR Code</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Members Management Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.adminModalContainer}>
          <View style={styles.adminModalContent}>
            {/* Header */}
            <View style={styles.adminModalHeader}>
              <Text style={styles.adminModalTitle}>
                {membersModalContext === 'online' ? 'Online Members' : 'Manage Members'} ({membersModalContext === 'online' ? allMembers.filter(m => m.currentStatus && m.currentStatus === 'online').length : allMembers.length})
              </Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Members List */}
            <ScrollView style={styles.membersListContainer}>
              {allMembers
                .filter(member => membersModalContext === 'all' || (member.currentStatus && member.currentStatus === 'online'))
                .map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => {
                        setShowMembersModal(false);
                        handleProfilePress(member.id);
                      }}
                    >
                      <Image
                        source={
                          member.profileImage
                            ? { uri: member.profileImage }
                            : require('./assets/posticon.jpg')
                        }
                        style={styles.memberAvatar}
                      />
                      <View style={styles.memberInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          {!!member.communityNickname && (
                            <View style={{ backgroundColor: '#8B2EF020', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: '#8B2EF0', fontSize: 10, fontWeight: '600' }}>Nickname</Text>
                            </View>
                          )}
                        </View>
                        {!!member.communityNickname && member.globalName && (
                          <Text style={{ color: '#666', fontSize: 11, marginTop: 1 }}>
                            aka {member.globalName}
                          </Text>
                        )}
                        {member.isAdmin && (
                          <Text style={styles.memberBadge}>👑 Admin</Text>
                        )}
                        {member.isModerator && !member.isAdmin && (
                          <Text style={styles.memberBadge}>⭐ Moderator</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {/* Member Action Buttons */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Report button - only for other members */}
                      {member.id !== auth.currentUser?.uid && (
                        <TouchableOpacity
                          style={styles.memberActionButton}
                          onPress={() => {
                            setReportTargetMember(member);
                            setShowReportModal(true);
                          }}
                        >
                          <Ionicons name="flag-outline" size={20} color="#F59E0B" />
                        </TouchableOpacity>
                      )}
                      {/* Kick button - only for admins kicking non-admins */}
                      {isAdmin && !member.isAdmin && member.id !== auth.currentUser?.uid && (
                        <TouchableOpacity
                          style={styles.kickButton}
                          onPress={() => handleKickMember(member.id, member.name)}
                        >
                          <MaterialIcons name="remove-circle" size={24} color="#ff4b6e" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              {allMembers.filter(member => membersModalContext === 'all' || (member.currentStatus && member.currentStatus === 'online')).length === 0 && (
                <View style={styles.emptyMembersContainer}>
                  <Text style={styles.emptyMembersText}>
                    {membersModalContext === 'online' ? 'No members are online' : 'No members found'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
           ANNOUNCEMENTS MANAGEMENT MODAL – enhanced UX
           ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={showAnnouncementsModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          setShowAnnouncementsModal(false);
          setAnnouncementsTab('pinned');
        }}
      >
        <View style={styles.adminModalContainer}>
          <View style={[styles.adminModalContent, { minHeight: '55%', maxHeight: '92%' }]}>

            {/* ── Drag handle ── */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
            </View>

            {/* ── Header ── */}
            <View style={[styles.adminModalHeader, { paddingTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: '#FF6B6B22', borderRadius: 8, padding: 7 }}>
                    <Ionicons name="megaphone" size={18} color="#FF6B6B" />
                  </View>
                  <Text style={[styles.adminModalTitle, { fontSize: 18 }]}>Announcements</Text>
                </View>
                {/* ── Capacity slots ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: i < announcements.length ? '#FF6B6B' : '#333',
                      }}
                    />
                  ))}
                  <Text style={{ color: '#888', fontSize: 11, marginLeft: 4 }}>
                    {announcements.length}/3 slots used
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                {(isAdmin || isModerator) && (
                  <TouchableOpacity
                    onPress={() => openComposeAnnouncement()}
                    style={{
                      backgroundColor: '#FF6B6B',
                      borderRadius: 20,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setShowAnnouncementsModal(false);
                    setAnnouncementsTab('pinned');
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={26} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Tab bar ── */}
            <View style={{
              flexDirection: 'row',
              marginHorizontal: 16,
              marginBottom: 4,
              backgroundColor: '#111',
              borderRadius: 12,
              padding: 4,
            }}>
              {[
                { id: 'pinned', label: 'Pinned', count: announcements.length, icon: 'megaphone' },
                { id: 'posts', label: 'All Posts', count: allPosts.filter(p => !announcements.find(a => a.id === p.id)).length, icon: 'document-text' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setAnnouncementsTab(tab.id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: announcementsTab === tab.id ? '#1e1e1e' : 'transparent',
                  }}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={announcementsTab === tab.id ? '#FF6B6B' : '#555'}
                  />
                  <Text style={{
                    color: announcementsTab === tab.id ? '#FF6B6B' : '#555',
                    fontSize: 13,
                    fontWeight: announcementsTab === tab.id ? '700' : '500',
                  }}>
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View style={{
                      backgroundColor: announcementsTab === tab.id ? '#FF6B6B' : '#333',
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{tab.count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Content area ── */}
            <ScrollView
              ref={annScrollRef}
              style={styles.announcementsListContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── PINNED TAB ── */}
              {announcementsTab === 'pinned' && (
                <>
                  {announcements.length === 0 ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <View style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: '#FF6B6B11',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                      }}>
                        <Ionicons name="megaphone-outline" size={36} color="#444" />
                      </View>
                      <Text style={{ color: '#ccc', fontSize: 15, fontWeight: '700', marginBottom: 6 }}>
                        No announcements yet
                      </Text>
                      <Text style={{ color: '#555', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                        Important updates from staff will appear here.
                      </Text>
                      {(isAdmin || isModerator) && (
                        <TouchableOpacity
                          onPress={() => openComposeAnnouncement()}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 7,
                            backgroundColor: '#FF6B6B',
                            paddingHorizontal: 20,
                            paddingVertical: 11,
                            borderRadius: 22,
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={17} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                            Create First Announcement
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <>
                      {announcements.map((announcement, idx) => (
                        <View
                          key={announcement.id}
                          style={{
                            backgroundColor: '#111',
                            borderRadius: 14,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: '#FF6B6B33',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Accent top bar */}
                          <View style={{ height: 3, backgroundColor: '#FF6B6B' }} />
                          <View style={{ padding: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                              {/* Order badge */}
                              <View style={{
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                backgroundColor: '#FF6B6B',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 1,
                              }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>#{idx + 1}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '400', lineHeight: 20, marginBottom: 3 }}>
                                  {announcement.text || announcement.content || announcement.caption || announcement.title || 'No content'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="person-circle-outline" size={13} color="#666" />
                                    <Text style={{ color: '#666', fontSize: 11 }}>
                                      {liveNames[announcement.authorId || announcement.createdById] || announcement.createdByName || announcement.authorName || 'Staff'}
                                    </Text>
                                  </View>
                                  {announcement.createdAt && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Ionicons name="time-outline" size={12} color="#555" />
                                      <Text style={{ color: '#555', fontSize: 11 }}>
                                        {announcement.createdAt?.toDate
                                          ? announcement.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                          : 'Recent'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              {/* Unpin button */}
                              <TouchableOpacity
                                onPress={() =>
                                  Alert.alert(
                                    'Unpin Announcement',
                                    'Remove this announcement from the pinned list?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Unpin', style: 'destructive', onPress: () => handleUnpinAnnouncement(announcement.id) },
                                    ]
                                  )
                                }
                                style={{
                                  backgroundColor: '#ff4b6e22',
                                  borderRadius: 8,
                                  padding: 7,
                                }}
                              >
                                <Ionicons name="pin" size={16} color="#ff4b6e" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}
                      {announcements.length < 3 && (isAdmin || isModerator) && (
                        <TouchableOpacity
                          onPress={() => openComposeAnnouncement()}
                          style={{
                            borderWidth: 1,
                            borderColor: '#FF6B6B44',
                            borderStyle: 'dashed',
                            borderRadius: 14,
                            paddingVertical: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={17} color="#FF6B6B88" />
                          <Text style={{ color: '#FF6B6B88', fontSize: 13, fontWeight: '600' }}>
                            Add announcement ({3 - announcements.length} slot{3 - announcements.length !== 1 ? 's' : ''} left)
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── ALL POSTS TAB ── */}
              {announcementsTab === 'posts' && (
                <>
                  <Text style={{ color: '#555', fontSize: 12, marginBottom: 12, fontStyle: 'italic' }}>
                    Tap a post to pin it as an announcement{announcements.length >= 3 ? ' — oldest will auto-remove.' : '.'}
                  </Text>
                  {allPosts.filter(post => !announcements.find(a => a.id === post.id)).length === 0 ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <View style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: '#1a1a1a',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                      }}>
                        <Ionicons name="document-text-outline" size={30} color="#444" />
                      </View>
                      <Text style={{ color: '#999', fontSize: 14, fontWeight: '600' }}>No posts available</Text>
                      <Text style={{ color: '#555', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                        Create a post first, then pin it as an announcement.
                      </Text>
                    </View>
                  ) : (
                    allPosts
                      .filter(post => !announcements.find(a => a.id === post.id))
                      .slice(0, 20)
                      .map((post) => (
                        <TouchableOpacity
                          key={post.id}
                          onPress={() => handlePinAnnouncement(post.id)}
                          activeOpacity={0.75}
                          style={{
                            backgroundColor: '#111',
                            borderRadius: 14,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: '#2a2a2a',
                            flexDirection: 'row',
                            alignItems: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Left accent */}
                          <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: '#333' }} />
                          <View style={{ flex: 1, padding: 13 }}>
                            {post.title ? (
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 }} numberOfLines={1}>
                                {post.title}
                              </Text>
                            ) : null}
                            <Text style={{ color: '#999', fontSize: 13 }} numberOfLines={2}>
                              {post.text || post.content || post.caption || 'No text content'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                              <Ionicons name="person-circle-outline" size={12} color="#555" />
                              <Text style={{ color: '#555', fontSize: 11 }}>
                                {liveNames[post.authorId || post.createdById] || post.createdByName || post.authorName || 'Unknown'}
                              </Text>
                              {post.createdAt && (
                                <Text style={{ color: '#444', fontSize: 11 }}>
                                  · {post.createdAt?.toDate
                                    ? post.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                    : 'Recent'}
                                </Text>
                              )}
                            </View>
                          </View>
                          {/* Pin CTA */}
                          <View style={{
                            paddingHorizontal: 14,
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            <View style={{
                              backgroundColor: '#FF6B6B22',
                              borderRadius: 20,
                              padding: 8,
                            }}>
                              <Ionicons name="pin" size={16} color="#FF6B6B" />
                            </View>
                            <Text style={{ color: '#FF6B6B', fontSize: 10, fontWeight: '600' }}>Pin</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                  )}
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
           COMPOSE ANNOUNCEMENT MODAL – full-screen, keyboard-safe
           ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={showComposeAnnouncementModal}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => closeComposeAnnouncement()}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#0a0a0a' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ── Sticky header ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'ios' ? 56 : 16,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#1e1e1e',
            backgroundColor: '#0a0a0a',
          }}>
            <TouchableOpacity
              onPress={() => closeComposeAnnouncement()}
              style={{ paddingVertical: 6, paddingRight: 16 }}
            >
              <Text style={{ color: '#888', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="megaphone" size={16} color="#FF6B6B" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>New Announcement</Text>
            </View>

            <TouchableOpacity
              onPress={handleCreateAnnouncement}
              disabled={creatingAnnouncement || (!newAnnouncementTitle.trim() && !newAnnouncementBody.trim())}
              style={{
                backgroundColor:
                  creatingAnnouncement || (!newAnnouncementTitle.trim() && !newAnnouncementBody.trim())
                    ? '#2a2a2a' : '#FF6B6B',
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 8,
                minWidth: 68,
                alignItems: 'center',
              }}
            >
              {creatingAnnouncement ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{
                  color: (!newAnnouncementTitle.trim() && !newAnnouncementBody.trim()) ? '#555' : '#fff',
                  fontWeight: '700',
                  fontSize: 15,
                }}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Capacity warning ── */}
          {announcements.length >= 3 && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#FF6B6B15',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#FF6B6B33',
            }}>
              <Ionicons name="warning-outline" size={15} color="#FF6B6B" />
              <Text style={{ color: '#FF6B6B', fontSize: 13, flex: 1 }}>
                All 3 slots are full — the oldest announcement will be auto-removed when you post.
              </Text>
            </View>
          )}

          {/* ── Compose area ── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={{ color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 }}>TITLE (OPTIONAL)</Text>
            <TextInput
              placeholder="E.g. Community Event Saturday"
              placeholderTextColor="#333"
              value={newAnnouncementTitle}
              onChangeText={setNewAnnouncementTitle}
              maxLength={80}
              returnKeyType="next"
              onSubmitEditing={() => annBodyRef.current?.focus()}
              autoFocus={true}
              style={{
                backgroundColor: '#141414',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: '#fff',
                fontSize: 17,
                fontWeight: '700',
                marginBottom: 6,
                borderWidth: 1.5,
                borderColor: newAnnouncementTitle.length > 0 ? '#FF6B6B88' : '#222',
              }}
            />
            <Text style={{ color: '#444', fontSize: 11, textAlign: 'right', marginBottom: 20 }}>
              {newAnnouncementTitle.length}/80
            </Text>

            {/* Body */}
            <Text style={{ color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 }}>MESSAGE</Text>
            <TextInput
              ref={annBodyRef}
              placeholder="Write your announcement here…"
              placeholderTextColor="#333"
              value={newAnnouncementBody}
              onChangeText={(t) => t.length <= 500 && setNewAnnouncementBody(t)}
              multiline
              blurOnSubmit={false}
              textAlignVertical="top"
              style={{
                backgroundColor: '#141414',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 40,
                color: '#fff',
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 6,
                borderWidth: 1.5,
                borderColor: newAnnouncementBody.length > 0 ? '#FF6B6B88' : '#222',
                minHeight: 160,
              }}
            />
            <Text style={{
              color: newAnnouncementBody.length > 450 ? '#ff4b6e' : '#444',
              fontSize: 12,
              textAlign: 'right',
              marginBottom: 32,
            }}>
              {newAnnouncementBody.length}/500
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Featured Posts Management Modal */}
      <Modal
        visible={showFeaturedModal}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowFeaturedModal(false)}
      >
        <View style={styles.adminModalContainer}>
          <View style={styles.adminModalContent}>
            {/* Header */}
            <View style={styles.adminModalHeader}>
              <Text style={styles.adminModalTitle}>
                Manage Featured Posts ({featuredPosts.length})
              </Text>
              <TouchableOpacity onPress={() => setShowFeaturedModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Featured Posts List */}
            <ScrollView style={styles.announcementsListContainer}>
              <Text style={styles.announcementsSectionTitle}>Featured Posts</Text>
              
              {featuredPosts.length === 0 ? (
                <View style={styles.emptyAnnouncementsContainer}>
                  <MaterialIcons name="star-border" size={64} color="#444" />
                  <Text style={styles.emptyAnnouncementsText}>
                    No featured posts yet
                  </Text>
                  <Text style={styles.emptyAnnouncementsSubtext}>
                    Long-press any post and select "Add to Featured"
                  </Text>
                </View>
              ) : (
                featuredPosts.map((postId) => {
                  const post = allPosts.find(p => p.id === postId);
                  if (!post) return null;
                  
                  return (
                    <View key={post.id} style={styles.announcementItem}>
                      <View style={[styles.announcementIconContainer, { backgroundColor: '#2a2a2a' }]}>
                        <MaterialIcons name="star" size={20} color="#FFD700" />
                      </View>
                      <View style={styles.announcementContent}>
                        <Text style={styles.announcementTitle} numberOfLines={2}>
                          {post.title || post.caption || post.text || 'Featured Post'}
                        </Text>
                        <Text style={styles.announcementDate}>
                          {post.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.unpinButton, { backgroundColor: '#2a2a2a' }]}
                        onPress={() => handleUnfeaturePost(post.id)}
                      >
                        <MaterialIcons name="star" size={20} color="#FFD700" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              <Text style={[styles.announcementsSectionTitle, { marginTop: 24 }]}>Available Posts</Text>
              <Text style={styles.announcementsHelper}>
                Tap a post to add it to featured (no limit)
              </Text>

              {allPosts.filter(post => !featuredPosts.includes(post.id)).length === 0 ? (
                <View style={styles.emptyAnnouncementsContainer}>
                  <Text style={styles.emptyAnnouncementsText}>
                    No posts available
                  </Text>
                  <Text style={styles.emptyAnnouncementsSubtext}>
                    Create a post first to feature it
                  </Text>
                </View>
              ) : (
                allPosts
                  .filter(post => !featuredPosts.includes(post.id))
                  .slice(0, 10)
                  .map((post) => (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.availablePostItem}
                      onPress={() => handleFeaturePost(post.id)}
                    >
                      <View style={styles.availablePostContent}>
                        <Text style={styles.availablePostTitle} numberOfLines={2}>
                          {post.title || post.caption || post.text || 'Post'}
                        </Text>
                        <Text style={styles.availablePostDate}>
                          {post.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent'}
                        </Text>
                      </View>
                      <View style={[styles.pinButton, { backgroundColor: '#2a2a2a' }]}>
                        <MaterialIcons name="star" size={20} color="#FFD700" />
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Post Options Modal (long-press) */}
      <PostOptionsModal
        visible={postOptionsVisible}
        post={postOptionsTarget}
        currentUserId={currentUser?.id}
        communityId={communityId}
        onClose={() => {
          setPostOptionsVisible(false);
          setPostOptionsTarget(null);
        }}
        isPinned={postOptionsTarget ? (community?.announcements || []).includes(postOptionsTarget?.id) : false}
        isFeatured={postOptionsTarget ? (community?.featuredPosts || []).includes(postOptionsTarget?.id) : false}
        isAdmin={isAdmin}
        isModerator={isModerator}
        onDelete={(p) => handleDeletePost(p.id, p.type)}
        onPin={(p) => handlePinAnnouncement(p.id)}
        onUnpin={(p) => handleUnpinAnnouncement(p.id)}
        onFeature={(p) => handleFeaturePost(p.id)}
        onUnfeature={(p) => handleUnfeaturePost(p.id)}
        onShare={(p) => {
          const title = p.title || p.caption || p.text || 'Post';
          Share.share({ message: `Check out "${title}" on Social Vibing!` });
        }}
        onCopyLink={(p) => {
          const title = p.title || p.caption || p.text || 'Post';
          Share.share({ message: `Check out "${title}" on Social Vibing!` });
        }}
        onHide={(p) => handleHidePost(p.id, p.type)}
        onReport={(p) => {
          setReportTargetMember({ id: p.authorId, name: p.authorName });
          setReportTargetPost(p);
          setShowReportModal(true);
        }}
      />

      {/* Report User Modal */}
      <ReportUserModal
        visible={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTargetMember(null);
          setReportTargetPost(null);
        }}
        reportedUser={{
          id: reportTargetMember?.id,
          username: reportTargetMember?.name || 'User',
        }}
        reportType={reportTargetPost ? 'post' : 'user'}
        contentId={reportTargetPost?.id || null}
        contentType={reportTargetPost ? (reportTargetPost.type === 'blog' ? 'blog' : 'post') : null}
        contentPreview={reportTargetPost?.title || reportTargetPost?.caption || reportTargetPost?.text || reportTargetPost?.question || null}
        communityId={communityId || null}
      />

      {/* ─── Community Chat Message Options Bottom Sheet ─── */}
      <Modal
        visible={showMsgOptions}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowMsgOptions(false); setSelectedMsg(null); }}
      >
        <TouchableOpacity
          style={styles.msgOptOverlay}
          activeOpacity={1}
          onPress={() => { setShowMsgOptions(false); setSelectedMsg(null); }}
        >
          <View style={styles.msgOptSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.msgOptHandle} />
            {selectedMsg?.text ? (
              <View style={styles.msgOptPreview}>
                <Ionicons name="chatbubble-outline" size={14} color="#9CA3AF" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.msgOptPreviewText} numberOfLines={2}>{selectedMsg.text}</Text>
              </View>
            ) : null}

            {/* Copy (text messages only) */}
            {!!selectedMsg?.text && !selectedMsg?.isDeleted && (
              <TouchableOpacity style={styles.msgOptRow} onPress={handleCopyChatMsg} activeOpacity={0.7}>
                <View style={[styles.msgOptIcon, { backgroundColor: '#08FFE222' }]}>
                  <Ionicons name="copy-outline" size={20} color="#08FFE2" />
                </View>
                <Text style={styles.msgOptLabel}>Copy</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {/* Delete own message */}
            {selectedMsg?.senderId === currentUser?.id && !selectedMsg?.isDeleted && (
              <TouchableOpacity style={styles.msgOptRow} onPress={handleDeleteOwnChatMsg} activeOpacity={0.7}>
                <View style={[styles.msgOptIcon, { backgroundColor: '#EF444422' }]}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </View>
                <Text style={[styles.msgOptLabel, { color: '#EF4444' }]}>Delete</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {/* Report (others' messages) */}
            {selectedMsg?.senderId !== currentUser?.id && !selectedMsg?.isDeleted && (
              <TouchableOpacity
                style={styles.msgOptRow}
                activeOpacity={0.7}
                onPress={() => {
                  setShowMsgOptions(false);
                  setTimeout(() => {
                    setReportTargetMember({ id: selectedMsg.senderId, name: selectedMsg.sender });
                    setReportTargetPost({
                      id: selectedMsg.id,
                      type: 'chat_message',
                      text: selectedMsg.text,
                    });
                    setShowReportModal(true);
                  }, 250);
                }}
              >
                <View style={[styles.msgOptIcon, { backgroundColor: '#F9731622' }]}>
                  <Ionicons name="flag-outline" size={20} color="#F97316" />
                </View>
                <Text style={[styles.msgOptLabel, { color: '#F97316' }]}>Report</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.msgOptRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#ffffff11' }]}
              onPress={() => { setShowMsgOptions(false); setSelectedMsg(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.msgOptLabel, { color: '#9CA3AF', textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <CommunitySidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        communityId={communityId}
        communityData={community}
        currentUser={currentUser}
        isAdmin={isAdmin}
        isModerator={isModerator}
        userPoints={checkInPoints}
        userStreak={checkInStreak}
        navigation={navigation}
        onItemPress={(item) => {
          // Handle tab switches directly when already on GroupInfo
          const tabMap = { Members: 'online', Chat: 'chat', Posts: 'community', Events: 'community' };
          if (tabMap[item.screen]) {
            setActiveTab(tabMap[item.screen]);
            return true; // handled — skip default navigation
          }
          return false;
        }}
      />

    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
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
    backgroundColor: '#1e1e1e',
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
  partyEmoji: {
    fontSize: 24,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444',
  },
  colorPickerContainer: {
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#222',
    maxHeight: 140,
    paddingVertical: 12,
  },
  colorPickerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 8,
  },
  colorPickerScroll: {
    flexGrow: 0,
  },
  colorPickerContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 12,
  },
  colorItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
  },
  colorItemSelected: {
    borderWidth: 3,
    borderColor: '#8B2EF0',
    transform: [{ scale: 1.1 }],
  },
  giftOptionsContainer: {
    position: 'absolute',
    bottom: 60, // Position above the message box (message box is ~60px height)
    left: 0,
    right: 0,
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#222',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    zIndex: 99,
    elevation: 9,
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B2EF0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 98,
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
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.4)',
  },
  voiceChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    width: '100%',
  },
  voiceIconPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceChatTitle: {
    color: '#00FFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '55%',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff0000',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff0000',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ff0000',
  },
  voiceChatText: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  voiceChatParticipants: {
    color: '#00FFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  joinVoiceChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00FFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
  },
  joinVoiceChatText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  joinedVoiceChatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  joinedVoiceChatText: {
    color: '#00FFFF',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  // Screening Room Message Styles
  screeningRoomMessageContainer: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.4)',
  },
  screeningIconPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screeningRoomTitle: {
    color: '#FF00FF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '55%',
  },
  screeningRoomText: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  screeningRoomParticipants: {
    color: '#FF00FF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  joinScreeningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF00FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
  },
  joinScreeningText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  joinedScreeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FF00FF',
  },
  joinedScreeningText: {
    color: '#FF00FF',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  // Roleplay Message Styles
  roleplayMessageContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  roleplayIconPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleplayTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '55%',
  },
  roleplayScenario: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  roleplayText: {
    color: '#ddd',
    fontSize: 13,
    marginBottom: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  roleplayCharactersContainer: {
    marginVertical: 10,
  },
  roleplayCharactersLabel: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  roleplayCharactersList: {
    gap: 12,
  },
  roleplayCharacterCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  roleplayCharacterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a2a2a',
  },
  roleplayCharacterAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleplayCharacterInfo: {
    flex: 1,
  },
  roleplayCharacterName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  roleplayCharacterSubtitle: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  roleplayCharacterAuthor: {
    color: '#666',
    fontSize: 11,
    marginBottom: 6,
  },
  roleplayCharacterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  roleplayCharacterTag: {
    backgroundColor: '#8B2EF0',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  roleplayCharacterTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  roleplayCharacterMoreTags: {
    color: '#8B2EF0',
    fontSize: 10,
    fontWeight: '600',
    alignSelf: 'center',
  },
  roleplayCharacterAttributes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  roleplayCharacterAttribute: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  characterBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  characterBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  roleplayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  roleplayParticipantsAvatars: {
    marginTop: 12,
    marginBottom: 8,
  },
  roleplayParticipantsLabel: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  participantsAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -8,
  },
  participantAvatarContainer: {
    position: 'relative',
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1a1a1a',
    backgroundColor: '#333',
  },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 10,
  },
  moreParticipants: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreParticipantsText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  roleplayParticipants: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
  },
  roleplayAvailableRoles: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },
  joinRoleplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
  },
  joinRoleplayText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  joinedRoleplayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  joinedRoleplayText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  roleplayFullBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(153, 153, 153, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#666',
  },
  roleplayFullText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },

  // Community Invite Message Styles
  communityInviteContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#8B2EF0',
    marginVertical: 8,
  },
  communityInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(139, 46, 240, 0.1)',
  },
  communityInviteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B2EF0',
  },
  communityInviteImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#252525',
  },
  communityInviteContent: {
    padding: 12,
  },
  communityInviteName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  communityInviteText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  communityInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B2EF0',
    paddingVertical: 12,
    gap: 8,
    margin: 12,
    marginTop: 0,
    borderRadius: 10,
  },
  communityInviteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Roleplay Setup Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleplaySetupModal: {
    width: '90%',
    maxHeight: '90%',
    height: '90%',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  roleplaySetupContent: {
    padding: 16,
  },
  roleplaySetupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  roleplayScenarioInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rolesSection: {
    marginTop: 10,
  },
  rolesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addRoleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addRoleButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  roleInputContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  roleInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roleInputNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  roleNameInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  roleDescriptionInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  createRoleplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    padding: 16,
    gap: 10,
  },
  createRoleplayButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  // Role Selection Modal Styles
  roleSelectModal: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  roleSelectContent: {
    padding: 16,
  },
  roleSelectCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  roleSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  roleSelectName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
    flex: 1,
  },
  roleSelectDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 12,
    lineHeight: 20,
  },
  roleSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  roleSelectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#444',
  },
  dividerText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  noRolesContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  noRolesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginTop: 12,
  },
  noRolesSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  createCustomRoleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
    gap: 10,
  },
  createCustomRoleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  customRoleInputContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  customRoleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 12,
  },
  customRoleInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  customRoleDescInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  customRoleButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelCustomRoleButton: {
    flex: 1,
    backgroundColor: '#444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelCustomRoleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmCustomRoleButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmCustomRoleText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  // Character Selector Modal Styles
  characterSelectorModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  characterSelectorContent: {
    padding: 16,
  },
  characterInfoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 20,
    gap: 12,
  },
  characterInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#FFD700',
    lineHeight: 20,
  },
  characterSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A855F7',
    marginBottom: 6,
  },
  characterSectionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  characterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  characterCardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterCardInfo: {
    flex: 1,
  },
  characterCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  characterCardSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
  },
  characterCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  characterTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  characterTagText: {
    fontSize: 11,
    color: '#A855F7',
  },
  createCharacterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A855F7',
    gap: 12,
  },
  createCharacterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A855F7',
  },
  createCharacterButtonSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
    paddingTop: 24,
    paddingBottom: 12,
  },
  accountHeaderArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  accountAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  accountAvatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatar: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  accountAvatarFallback: {
    backgroundColor: '#1A1F27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#0B0B10',
    borderRadius: 14,
    padding: 3,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  accountEditNameBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  accountName: {
    color: '#EAEAF0',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  accountEmailText: {
    color: '#A2A8B3',
    fontSize: 13,
    marginTop: 2,
  },
  accountStatsCard: {
    backgroundColor: '#14171C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242A33',
    paddingVertical: 16,
    marginBottom: 12,
  },
  accountStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  accountStatsDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#242A33',
  },
  accountStatValue: {
    color: '#EAEAF0',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  accountStatLabel: {
    color: '#A2A8B3',
    fontSize: 12,
    fontWeight: '500',
  },
  accountContentStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  accountContentStatChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#14171C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242A33',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  accountContentStatValue: {
    color: '#EAEAF0',
    fontSize: 17,
    fontWeight: '800',
  },
  accountContentStatLabel: {
    color: '#A2A8B3',
    fontSize: 12,
    fontWeight: '500',
  },
  accountRankingCard: {
    backgroundColor: '#14171C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242A33',
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  accountRankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  accountRankingTitle: {
    color: '#EAEAF0',
    fontSize: 16,
    fontWeight: '800',
  },
  accountRankingBadge: {
    backgroundColor: 'rgba(255, 201, 60, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 60, 0.3)',
    alignItems: 'center',
    minWidth: 140,
  },
  accountRankingNumber: {
    color: '#FFC93C',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  accountRankingSubtext: {
    color: '#A2A8B3',
    fontSize: 11,
    textAlign: 'center',
  },
  /* Check-in Card */
  checkInCard: {
    marginTop: 0,
    backgroundColor: '#14171C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242A33',
    padding: 14,
  },
  checkInCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checkInCardTitle: {
    color: '#EAEAF0',
    fontWeight: '800',
    fontSize: 15,
  },
  checkInDonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,255,115,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,115,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checkInDonePillText: {
    color: '#00FF73',
    fontSize: 11,
    fontWeight: '700',
  },
  checkInPendingPill: {
    backgroundColor: 'rgba(139,46,240,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139,46,240,0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checkInPendingPillText: {
    color: '#8B2EF0',
    fontSize: 11,
    fontWeight: '700',
  },
  checkInStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  checkInStatChip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222',
  },
  checkInCoinIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  checkInStatValue: {
    color: '#EAEAF0',
    fontWeight: '800',
    fontSize: 15,
  },
  checkInStatLabel: {
    color: '#888',
    fontSize: 10,
  },
  checkInCTA: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  checkInCTADone: {
    opacity: 0.85,
  },
  checkInCTAGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  checkInCTAText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
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

  // Play Button Icon
  playButtonIcon: {
    marginRight: 4,
  },

  // Feature Selection Modal
  featureModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  featureModalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  featureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  featureModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  featuresGrid: {
    padding: 20,
    gap: 15,
  },
  featureCard: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  featureGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  featureCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  featureCardDesc: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },

  // Mini Screen Modal
  miniScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniScreenContainer: {
    width: '85%',
    maxWidth: 400,
    height: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  miniScreenContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  miniScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  miniScreenTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  miniScreenBody: {
    paddingVertical: 20,
  },
  featureIconContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  miniScreenDescription: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  miniScreenActions: {
    marginTop: 20,
  },
  miniScreenButton: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#8B2EF0',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  miniScreenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Roleplay Pages
  roleplayPageContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  roleplayPageTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  roleplayPageDesc: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },

  // Choice Buttons (Page 1)
  roleplayChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 16,
    marginBottom: 15,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  roleplayChoiceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  roleplayChoiceContent: {
    flex: 1,
  },
  roleplayChoiceTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleplayChoiceDesc: {
    color: '#999',
    fontSize: 13,
    lineHeight: 18,
  },

  roleplayInput: {
    width: '100%',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  roleplayTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },

  // Character Attributes
  attributeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  genderSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 10,
    gap: 10,
  },
  genderOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  genderOptionSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  genderOptionText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  genderOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },

  // Avatar Selector
  avatarSelector: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#FFD700',
    overflow: 'hidden',
    marginBottom: 20,
    alignSelf: 'center',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },

  // Color Selector
  colorSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 10,
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },

  // Language Selector
  languageScroll: {
    width: '100%',
    marginBottom: 10,
  },
  languageSelector: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 20,
  },
  languageOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  languageOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  languageOptionText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  languageOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Tags Container
  tagsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  tagsScroll: {
    width: '100%',
    marginBottom: 15,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 20,
  },
  tagOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  tagOptionSelected: {
    backgroundColor: '#8B2EF0',
    borderColor: '#8B2EF0',
  },
  tagOptionText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  tagOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  selectedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B2EF0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  selectedTagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  customTagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customTagField: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  addCustomTagButton: {
    padding: 8,
  },

  // Character Collection
  characterCollectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  collectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addCharacterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  addCharacterButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCollection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCollectionText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
  },
  emptyCollectionSubtext: {
    color: '#555',
    fontSize: 14,
    marginTop: 5,
  },
  characterList: {
    width: '100%',
    gap: 12,
  },
  characterCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  characterCardMain: {
    flexDirection: 'row',
    padding: 15,
    gap: 12,
  },
  characterCardSelected: {
    backgroundColor: '#1a2a1a',
    borderColor: '#4CAF50',
  },
  characterCardAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
  },
  characterCardContent: {
    flex: 1,
  },
  characterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  characterCardHeaderLeft: {
    flex: 1,
  },
  characterCardName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  characterCardSubtitle: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  characterAuthor: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
  },
  characterCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  characterCardTag: {
    backgroundColor: '#8B2EF0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  characterCardTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  characterCardMoreTags: {
    color: '#8B2EF0',
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'center',
  },
  characterCardAttributes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  attributeBadge: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  attributeBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  characterCardDescription: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
  },
  characterCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#0f0f0f',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  characterActionButton: {
    padding: 8,
  },
  selectedCharactersInfo: {
    backgroundColor: '#1a2a1a',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedCharactersText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Admin Panel Styles
  adminModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  adminModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '40%',
    paddingBottom: 20,
  },
  adminModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  adminModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  adminOptionsContainer: {
    padding: 20,
  },
  adminOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  adminOptionDanger: {
    backgroundColor: '#2a1a1a',
    borderWidth: 1,
    borderColor: '#ff4b6e',
  },
  adminOptionText: {
    flex: 1,
    marginLeft: 15,
  },
  adminOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  adminOptionSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  adminStatsContainer: {
    backgroundColor: '#252525',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  adminStatsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
  },
  adminStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  adminStatLabel: {
    fontSize: 14,
    color: '#ccc',
  },
  adminStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Share Modal Styles
  shareContentContainer: {
    padding: 20,
  },
  shareSection: {
    marginBottom: 30,
  },
  shareSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  inviteLinkContainer: {
    backgroundColor: '#252525',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
  },
  inviteLinkText: {
    color: '#8B2EF0',
    fontSize: 14,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  shareButtonPrimary: {
    backgroundColor: '#8B2EF0',
  },
  shareButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#8B2EF0',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrCodeImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 10,
  },
  qrCodeSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },

  // Members Modal Styles
  membersListContainer: {
    padding: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  memberBadge: {
    fontSize: 12,
    color: '#FFD700',
  },
  kickButton: {
    padding: 8,
  },
  memberActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  emptyMembersContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyMembersText: {
    color: '#999',
    fontSize: 14,
  },

  // Announcements Styles
  announcementsListContainer: {
    flex: 1,
    padding: 16,
  },
  announcementsSectionTitle: {
    color: '#8B2EF0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  announcementsHelper: {
    color: '#999',
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  emptyAnnouncementsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyAnnouncementsText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyAnnouncementsSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  announcementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8B2EF0',
  },
  announcementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 46, 240, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  announcementDate: {
    color: '#999',
    fontSize: 12,
  },
  unpinButton: {
    padding: 8,
  },
  availablePostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  availablePostContent: {
    flex: 1,
  },
  availablePostTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  availablePostDate: {
    color: '#999',
    fontSize: 11,
  },
  pinButton: {
    padding: 8,
  },
  disabledPinButton: {
    padding: 8,
    opacity: 0.3,
  },

  // Member Search Styles
  memberSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  memberSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 0,
  },

  // Community chat message options bottom sheet
  msgOptOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  msgOptSheet: {
    backgroundColor: '#1A1A22',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
    paddingTop: 8,
  },
  msgOptHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff33',
    alignSelf: 'center',
    marginBottom: 16,
  },
  msgOptPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff0A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  msgOptPreviewText: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  msgOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  msgOptIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  msgOptLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});



