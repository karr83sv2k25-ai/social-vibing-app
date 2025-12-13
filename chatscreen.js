// ChatScreen.js — header visible (back + avatar + name + email + info icon)
import React, { useState, useLayoutEffect, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, serverTimestamp, getDoc, limit, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { uploadImageToHostinger } from './hostingerConfig';
import { StickerPicker } from './components/StickerPicker';
import { AttachmentPicker } from './components/AttachmentPicker';
import { cacheMessages, getCachedMessages } from './utils/messageCache';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';

const ACCENT = "#7C3AED";
const CYAN = "#08FFE2";
const BG = "#0B0B0E";
const CARD = "#17171C";
const TEXT_DIM = "#9CA3AF";
const GREEN = "#22C55E";

const FALLBACK_AVATAR = require("./assets/profile.png");

const Avatar = ({ name, size = 34, color = ACCENT, source }) => {
  const initials = useMemo(() => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }, [name]);

  return source ? (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: `${color}88`,
        backgroundColor: CARD,
      }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}33`,
        borderWidth: 1,
        borderColor: `${color}88`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{initials}</Text>
    </View>
  );
};

export default function ChatScreen({ route, navigation }) {
  const scrollViewRef = useRef(null);
  const currentUser = auth.currentUser;
  
  const user = route?.params?.user || {
    name: "Ken Kaneki",
    handle: "ghoul123@gmail.com",
    avatar: FALLBACK_AVATAR,
  };
  
  const conversationId = route?.params?.conversationId;
  const otherUserId = route?.params?.otherUserId || route?.params?.user?.userId;
  const isGroupChat = route?.params?.isGroup || route?.params?.user?.isGroup || false;

  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Party/Feature functionality states
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showMiniScreen, setShowMiniScreen] = useState(null); // 'voice', 'screening', 'roleplay'
  
  // Roleplay character creation states (multi-page system)
  const [roleplayPage, setRoleplayPage] = useState(1); // 1-5 pages
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
  const [characterCollection, setCharacterCollection] = useState([]);
  const [selectedCharactersForSession, setSelectedCharactersForSession] = useState([]);
  const [editingCharacterId, setEditingCharacterId] = useState(null);
  const [pendingRoleplayJoin, setPendingRoleplayJoin] = useState(null);
  
  // Advanced character customization states
  const [uploadingCharacterImage, setUploadingCharacterImage] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [characterFrameColor, setCharacterFrameColor] = useState('#FFD700');
  const [characterTextColor, setCharacterTextColor] = useState('#1F2937');
  
  // Predefined options
  const suggestedTags = ['Friendly', 'Romantic', 'Mysterious', 'Adventurous', 'Wise', 'Playful', 'Serious', 'Funny', 'Creative', 'Athletic', 'Intellectual', 'Caring'];
  const themeColors = ['#FFD700', '#FF6B6B', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4', '#8BC34A', '#FF5722'];
  const languages = ['English', 'Urdu', 'Hindi', 'Arabic', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Chinese'];
  
  // Color presets for character customization
  const colorPresets = [
    { name: 'Gold', frame: '#FFD700', text: '#1F2937' },
    { name: 'Purple', frame: '#7C3AED', text: '#FFFFFF' },
    { name: 'Blue', frame: '#3B82F6', text: '#FFFFFF' },
    { name: 'Green', frame: '#10B981', text: '#FFFFFF' },
    { name: 'Red', frame: '#EF4444', text: '#FFFFFF' },
    { name: 'Pink', frame: '#EC4899', text: '#FFFFFF' },
    { name: 'Cyan', frame: '#06B6D4', text: '#1F2937' },
    { name: 'Orange', frame: '#F97316', text: '#FFFFFF' },
  ];

  // Helper functions for color contrast
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;
    
    const rLin = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLin = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLin = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  };

  const getContrastRatio = (color1, color2) => {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const hasGoodContrast = (bgColor, textColor) => {
    const contrast = getContrastRatio(bgColor, textColor);
    return contrast >= 4.5; // WCAG AA standard
  };

  // Apply color preset
  const applyColorPreset = (preset) => {
    setCharacterFrameColor(preset.frame);
    setCharacterTextColor(preset.text);
  };

  // Handle character image upload
  const handleCharacterImageUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need gallery access to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setShowImageOptions(false);
        setUploadingCharacterImage(true);

        try {
          const imageUrl = await uploadImageToHostinger(result.assets[0].uri, 'roleplay_characters');
          setCharacterAvatar(imageUrl);
          setUploadingCharacterImage(false);
          Alert.alert('Success', 'Character image uploaded!');
        } catch (error) {
          console.error('Error uploading image:', error);
          setUploadingCharacterImage(false);
          Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setUploadingCharacterImage(false);
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  // Handle AI image generation
  const handleAIImageGeneration = () => {
    setShowImageOptions(false);
    Alert.alert(
      'AI Image Generation',
      'Generate custom character art with AI. This feature will create unique character images based on your description.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Coming Soon',
          onPress: () => {
            Alert.alert('Coming Soon', 'AI image generation will be available in the next update!');
          }
        }
      ]
    );
  };

  // Check if user is blocked
  useEffect(() => {
    if (!currentUser || !otherUserId) return;

    const checkBlockStatus = async () => {
      try {
        const blockRef = doc(db, 'users', currentUser.uid, 'blocked', otherUserId);
        const blockDoc = await getDoc(blockRef);
        
        // If document exists, user is blocked (regardless of fields)
        setIsBlocked(blockDoc.exists());
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };

    checkBlockStatus();
  }, [currentUser, otherUserId]);

  // Fetch messages from Firestore (OPTIMIZED with caching and limit)
  useEffect(() => {
    if (!conversationId || !currentUser) {
      setLoading(false);
      return;
    }

    // Load cached messages first for instant display
    getCachedMessages(conversationId).then(cached => {
      if (cached && cached.length > 0) {
        setMsgs(cached);
        setLoading(false);
      }
    });

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef, 
      orderBy('createdAt', 'desc'),
      limit(50) // Load last 50 messages initially
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            from: data.senderId === currentUser.uid ? 'me' : 'them',
            isMine: data.senderId === currentUser.uid,
            text: data.text || data.message || '',
            imageUrl: data.imageUrl || null,
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
            fileSize: data.fileSize || null,
            fileType: data.fileType || null,
            type: data.type || 'text',
            time: formatTime(data.createdAt?.toDate()),
            createdAt: data.createdAt,
            // Voice Room / Screening Room / Roleplay specific fields
            roomId: data.roomId || null,
            sessionId: data.sessionId || null,
            participants: data.participants || [],
            isActive: data.isActive !== undefined ? data.isActive : true,
            scenario: data.scenario || null,
            roles: data.roles || [],
            availableRoles: data.availableRoles || 0,
            sender: data.sender || 'User',
          };
        })
        .reverse(); // Reverse to show oldest first
      
      setMsgs(messages);
      setLoading(false);
      
      // Cache messages
      cacheMessages(conversationId, messages);
      
      // Scroll to bottom when new messages arrive
      requestAnimationFrame(() =>
        scrollViewRef.current?.scrollToEnd({ animated: true })
      );
    });

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // Listen for room/session status changes and update messages accordingly
  useEffect(() => {
    if (!conversationId || !msgs.length) return;

    const unsubscribers = [];

    // Listen to all active voice rooms, screening rooms, and roleplay sessions
    msgs.forEach((msg) => {
      if (msg.type === 'voiceChat' && msg.roomId) {
        // Listen to audio_calls room status
        const roomRef = doc(db, 'audio_calls', conversationId, 'rooms', msg.roomId);
        const unsubscribe = onSnapshot(roomRef, async (snap) => {
          if (snap.exists()) {
            const roomData = snap.data();
            if (!roomData.isActive && msg.isActive) {
              // Room ended, update message
              const messageRef = doc(db, 'conversations', conversationId, 'messages', msg.id);
              try {
                await updateDoc(messageRef, { isActive: false });
              } catch (e) {
                console.log('Error updating voice message status:', e);
              }
            }
          } else if (msg.isActive) {
            // Room deleted, mark message as inactive
            const messageRef = doc(db, 'conversations', conversationId, 'messages', msg.id);
            try {
              await updateDoc(messageRef, { isActive: false });
            } catch (e) {
              console.log('Error updating voice message status:', e);
            }
          }
        }, (error) => {
          console.log('Error listening to voice room:', error);
        });
        unsubscribers.push(unsubscribe);
      } else if (msg.type === 'screeningRoom' && msg.roomId) {
        // Listen to screening_rooms status
        const roomRef = doc(db, 'screening_rooms', msg.roomId);
        const unsubscribe = onSnapshot(roomRef, async (snap) => {
          if (snap.exists()) {
            const roomData = snap.data();
            if (!roomData.isActive && msg.isActive) {
              // Room ended, update message
              const messageRef = doc(db, 'conversations', conversationId, 'messages', msg.id);
              try {
                await updateDoc(messageRef, { isActive: false });
              } catch (e) {
                console.log('Error updating screening message status:', e);
              }
            }
          } else if (msg.isActive) {
            // Room deleted, mark message as inactive
            const messageRef = doc(db, 'conversations', conversationId, 'messages', msg.id);
            try {
              await updateDoc(messageRef, { isActive: false });
            } catch (e) {
              console.log('Error updating screening message status:', e);
            }
          }
        }, (error) => {
          console.log('Error listening to screening room:', error);
        });
        unsubscribers.push(unsubscribe);
      } else if (msg.type === 'roleplay' && msg.sessionId) {
        // Listen to roleplay_sessions status
        const sessionRef = doc(db, 'roleplay_sessions', conversationId, 'sessions', msg.sessionId);
        const unsubscribe = onSnapshot(sessionRef, async (snap) => {
          if (snap.exists()) {
            const sessionData = snap.data();
            if (!sessionData.isActive && msg.isActive) {
              // Session ended, update message
              const messageRef = doc(db, 'conversations', conversationId, 'messages', msg.id);
              try {
                await updateDoc(messageRef, { isActive: false });
              } catch (e) {
                console.log('Error updating roleplay message status:', e);
              }
            }
          } else if (msg.isActive) {
            // Session deleted, mark message as inactive
            const messageRef = doc(db, 'conversations', conversationId, 'messages', msg.id);
            try {
              await updateDoc(messageRef, { isActive: false });
            } catch (e) {
              console.log('Error updating roleplay message status:', e);
            }
          }
        }, (error) => {
          console.log('Error listening to roleplay session:', error);
        });
        unsubscribers.push(unsubscribe);
      }
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [conversationId, msgs]);

  // Load user's character collection
  useEffect(() => {
    const loadCharacterCollection = async () => {
      if (!currentUser?.uid) return;
      
      try {
        const userRef = doc(db, 'users', currentUser.uid);
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

  // Save character to collection
  const saveCharacterToCollection = async () => {
    if (!characterName.trim()) {
      Alert.alert('Required', 'Please enter a character name');
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
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
                frameColor: characterFrameColor,
                textColor: characterTextColor,
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
          frameColor: characterFrameColor,
          textColor: characterTextColor,
          createdAt: new Date().toISOString(),
        };
        updatedCollection = [...characterCollection, newCharacter];
      }

      await updateDoc(userRef, {
        characterCollection: updatedCollection,
      });

      setCharacterCollection(updatedCollection);

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
      setCharacterFrameColor('#FFD700');
      setCharacterTextColor('#1F2937');
      setEditingCharacterId(null);
      setRoleplayPage(5);

      Alert.alert('Success', editingCharacterId ? 'Character updated!' : 'Character saved!');
    } catch (error) {
      console.log('Error saving character:', error);
      Alert.alert('Error', 'Failed to save character: ' + error.message);
    }
  };

  // Remove character from collection
  const removeCharacterFromCollection = async (characterId) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedCollection = characterCollection.filter(char => char.id !== characterId);

      await updateDoc(userRef, {
        characterCollection: updatedCollection,
      });

      setCharacterCollection(updatedCollection);
      setSelectedCharactersForSession(prev => prev.filter(char => char.id !== characterId));

      Alert.alert('Success', 'Character removed from collection');
    } catch (error) {
      console.log('Error removing character:', error);
      Alert.alert('Error', 'Failed to remove character: ' + error.message);
    }
  };

  // Start roleplay with selected characters
  const startRoleplayWithCharacters = async () => {
    if (selectedCharactersForSession.length === 0) {
      Alert.alert('No Characters', 'Please select at least one character for the roleplay session');
      return;
    }

    try {
      const sessionId = `roleplay_${Date.now()}_${currentUser.uid}`;
      const sessionRef = doc(db, 'roleplay_sessions', conversationId, 'sessions', sessionId);
      const now = new Date().toISOString();

      await setDoc(sessionRef, {
        conversationId: conversationId,
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email || 'User',
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || 'User',
          profileImage: currentUser.photoURL || null,
          joinedAt: now,
          characters: selectedCharactersForSession.map(c => c.id),
        }],
        isActive: true,
        characters: selectedCharactersForSession.map(char => ({
          ...char,
          ownerId: currentUser.uid,
          ownerName: currentUser.displayName || currentUser.email || 'User',
          available: true,
        })),
        messages: [],
      });

      // Create roleplay message in chat
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messageData = {
        text: `Roleplay session with ${selectedCharactersForSession.map(c => c.name).join(', ')}`,
        type: 'roleplay',
        senderId: currentUser.uid,
        sessionId: sessionId,
        participants: [currentUser.uid],
        isActive: true,
        scenario: selectedCharactersForSession[0]?.description || '',
        roles: selectedCharactersForSession.map(char => ({
          id: char.id,
          name: char.name,
          description: char.description,
          taken: true,
          takenBy: currentUser.uid,
          takenByName: currentUser.displayName || currentUser.email || 'User',
        })),
        availableRoles: 0,
        createdAt: serverTimestamp(),
      };

      await addDoc(messagesRef, messageData);

      // Reset state
      setSelectedCharactersForSession([]);
      setPendingRoleplayJoin(null);
      
      Alert.alert('Success', 'Roleplay session created!');
      
      // Navigate to roleplay screen
      navigation.navigate('RoleplayScreen', {
        sessionId: sessionId,
        communityId: conversationId,
        communityName: user.name || 'Roleplay Session',
      });
    } catch (error) {
      console.error('Error creating roleplay session:', error);
      Alert.alert('Error', 'Failed to create roleplay session: ' + error.message);
    }
  };

  const formatTime = (date) => {
    if (!date) return 'now';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const send = async () => {
    const message = text.trim();
    if (!message || !currentUser || sending) return;

    // Prevent sending if user is blocked
    if (isBlocked) {
      Alert.alert(
        'User Blocked',
        'You have blocked this user. Please unblock them to send messages.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Clear text immediately for better UX
    setText("");
    setSending(true);

    try {
      // Create conversation if it doesn't exist
      let convoId = conversationId;
      
      if (!convoId && otherUserId) {
        // Create new conversation
        const conversationRef = doc(collection(db, 'conversations'));
        convoId = conversationRef.id;
        
        await setDoc(conversationRef, {
          participants: [currentUser.uid, otherUserId],
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [otherUserId]: 1,
          },
        });
      }

      if (convoId) {
        // Add message to conversation
        const messagesRef = collection(db, 'conversations', convoId, 'messages');
        await addDoc(messagesRef, {
          text: message,
          senderId: currentUser.uid,
          createdAt: serverTimestamp(),
        });

        // Update conversation last message
        const conversationRef = doc(db, 'conversations', convoId);
        await setDoc(conversationRef, {
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${otherUserId}`]: (await getDoc(conversationRef)).data()?.unreadCount?.[otherUserId] + 1 || 1,
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      // Restore text if send failed
      setText(message);
    } finally {
      setSending(false);
    }
  };

  const handleBlockToggle = async () => {
    try {
      const blockRef = doc(db, 'users', currentUser.uid, 'blocked', otherUserId);
      
      if (isBlocked) {
        // Unblock user - delete the document
        await deleteDoc(blockRef);
        setIsBlocked(false);
        Alert.alert('User Unblocked', 'You can now send messages to this user.');
      } else {
        // Block user - create document with blockedAt timestamp
        await setDoc(blockRef, { blockedAt: serverTimestamp() });
        setIsBlocked(true);
        Alert.alert(
          'User Blocked', 
          'This user has been blocked. They will remain in your messages list but you cannot send messages until you unblock them.',
          [{ text: 'OK' }]
        );
      }
      setShowInfoModal(false);
    } catch (error) {
      console.error('Error toggling block:', error);
      Alert.alert('Error', 'Failed to update block status. Please try again.');
    }
  };

  // Handle sticker selection
  const handleStickerSelect = async (sticker) => {
    if (!currentUser || sending || isBlocked) return;

    setSending(true);

    try {
      let convoId = conversationId;
      
      if (!convoId && otherUserId) {
        const conversationRef = doc(collection(db, 'conversations'));
        convoId = conversationRef.id;
        
        await setDoc(conversationRef, {
          participants: [currentUser.uid, otherUserId],
          lastMessage: '🎨 Sticker',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [otherUserId]: 1,
          },
        });
      }

      if (convoId) {
        const messagesRef = collection(db, 'conversations', convoId, 'messages');
        await addDoc(messagesRef, {
          text: sticker,
          type: 'sticker',
          senderId: currentUser.uid,
          createdAt: serverTimestamp(),
        });

        const conversationRef = doc(db, 'conversations', convoId);
        await setDoc(conversationRef, {
          lastMessage: '🎨 Sticker',
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${otherUserId}`]: (await getDoc(conversationRef)).data()?.unreadCount?.[otherUserId] + 1 || 1,
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error sending sticker:', error);
      Alert.alert('Error', 'Failed to send sticker. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Handle image upload (Using Hostinger Storage)
  const handleImageSelected = async (imageAsset) => {
    if (!currentUser || isBlocked) return;

    setUploadingImage(true);

    try {
      // Validate image
      if (!imageAsset.uri) {
        throw new Error('Invalid image selected');
      }

      console.log('Starting image upload to Hostinger...', imageAsset.uri);

      // Upload to Hostinger
      const imageUrl = await uploadImageToHostinger(imageAsset.uri, 'chat_images');
      console.log('✅ Image uploaded to Hostinger:', imageUrl);

      // Send image message
      let convoId = conversationId;
      
      if (!convoId && otherUserId) {
        const conversationRef = doc(collection(db, 'conversations'));
        convoId = conversationRef.id;
        
        await setDoc(conversationRef, {
          participants: [currentUser.uid, otherUserId],
          lastMessage: '📷 Photo',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [otherUserId]: 1,
          },
        });
      }

      if (convoId) {
        const messagesRef = collection(db, 'conversations', convoId, 'messages');
        await addDoc(messagesRef, {
          text: '',
          imageUrl: imageUrl,
          type: 'image',
          senderId: currentUser.uid,
          createdAt: serverTimestamp(),
        });

        const conversationRef = doc(db, 'conversations', convoId);
        const convoDoc = await getDoc(conversationRef);
        const currentUnread = convoDoc.data()?.unreadCount?.[otherUserId] || 0;
        
        await setDoc(conversationRef, {
          lastMessage: '📷 Photo',
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${otherUserId}`]: currentUnread + 1,
        }, { merge: true });
      }

      console.log('✅ Photo sent successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      
      // Detailed error reporting
      let errorMessage = 'Failed to send photo. ';
      
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle party feature selection
  const handleFeatureSelect = (feature) => {
    console.log('Feature selected:', feature);
    setShowFeatureModal(false);
    setTimeout(() => {
      console.log('Setting showMiniScreen to:', feature);
      setShowMiniScreen(feature);
    }, 300);
  };

  // Create Voice Room
  const sendVoiceChatInvite = async () => {
    if (!currentUser || !conversationId) {
      Alert.alert('Error', 'Unable to create voice room');
      return;
    }

    try {
      // Create a new voice room
      const roomId = `voice_${Date.now()}_${currentUser.uid}`;
      const roomRef = doc(db, 'audio_calls', conversationId, 'rooms', roomId);
      
      const now = new Date().toISOString();
      
      console.log('Creating voice room:', roomId);
      await setDoc(roomRef, {
        conversationId: conversationId,
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email || 'User',
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || 'User',
          profileImage: currentUser.photoURL || null,
          joinedAt: now,
          isMuted: false,
          isSpeaking: false,
        }],
        isActive: true,
      });

      // Create voice room message in chat
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      const messageData = {
        text: 'Started a voice room',
        type: 'voiceChat',
        senderId: currentUser.uid,
        roomId: roomId,
        participants: [currentUser.uid],
        isActive: true,
        createdAt: serverTimestamp(),
      };

      console.log('Creating voice room message:', messageData);
      await addDoc(messagesRef, messageData);
      
      setShowMiniScreen(null);
      Alert.alert('Success', 'Voice room created! The other user can now join from chat.');
      
      // Navigate to voice room
      navigation.navigate('GroupAudioCall', {
        communityId: conversationId,
        roomId: roomId,
        groupTitle: user.name || 'Voice Chat',
      });
    } catch (error) {
      console.error('Error creating voice room:', error);
      Alert.alert('Error', 'Failed to create voice room: ' + error.message);
    }
  };

  // Create Screening Room
  const sendScreeningInvite = async () => {
    if (!currentUser || !conversationId) {
      Alert.alert('Error', 'Unable to create screening room');
      return;
    }

    try {
      // Create a new screening room
      const roomId = `screening_${Date.now()}_${currentUser.uid}`;
      const roomRef = doc(db, 'screening_rooms', roomId);
      
      const now = new Date().toISOString();
      
      console.log('Creating screening room:', roomId);
      await setDoc(roomRef, {
        conversationId: conversationId,
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email || 'User',
        createdAt: now,
        updatedAt: now,
        participants: [{
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || 'User',
          profileImage: currentUser.photoURL || null,
          joinedAt: now,
        }],
        isActive: true,
        playlist: [],
        currentVideo: null,
      });

      // Create screening room message in chat
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      const messageData = {
        text: 'Started a screening room',
        type: 'screeningRoom',
        senderId: currentUser.uid,
        roomId: roomId,
        participants: [currentUser.uid],
        isActive: true,
        createdAt: serverTimestamp(),
      };

      console.log('Creating screening room message:', messageData);
      await addDoc(messagesRef, messageData);
      
      setShowMiniScreen(null);
      Alert.alert('Success', 'Screening room created! The other user can now join from chat.');
      
      // Navigate to screening room
      navigation.navigate('ScreenSharingRoom', {
        communityId: conversationId,
        roomId: roomId,
        groupTitle: user.name || 'Screening Room',
      });
    } catch (error) {
      console.error('Error creating screening room:', error);
      Alert.alert('Error', 'Failed to create screening room: ' + error.message);
    }
  };



  // Handle message delete
  const handleDeleteMessage = async (messageId) => {
    try {
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
                await deleteDoc(messageRef);
                Alert.alert('Success', 'Message deleted successfully');
              } catch (error) {
                console.error('Error deleting message:', error);
                Alert.alert('Error', 'Failed to delete message');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleDeleteMessage:', error);
    }
  };

  // ✅ We build our own header manually
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔹 Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Avatar name={user.name} size={40} source={user.avatar} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{user.name}</Text>
            <Text style={styles.headerEmail}>{user.handle}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconButton} 
            onPress={() => setShowFeatureModal(true)}
          >
           <Text style={styles.partyEmoji}>🎉</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowInfoModal(true)}>
            <Ionicons name="information-circle-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 💬 Chat Section */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 10} // ⬆️ Keyboard slightly higher
      >
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={{ color: TEXT_DIM, marginTop: 10 }}>Loading messages...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {msgs.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                <Ionicons name="chatbubbles-outline" size={64} color={TEXT_DIM} />
                <Text style={{ color: TEXT_DIM, marginTop: 16, fontSize: 16 }}>No messages yet</Text>
                <Text style={{ color: TEXT_DIM, marginTop: 4, fontSize: 12 }}>Send a message to start the conversation</Text>
              </View>
            ) : (
              msgs.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.bubbleRow,
                    m.from === "me" && styles.bubbleRight,
                  ]}
                >
                  {m.from !== "me" && (
                    <Avatar name={user.name} size={28} source={user.avatar} />
                  )}
                  <TouchableOpacity
                    onLongPress={() => m.from === "me" && handleDeleteMessage(m.id)}
                    activeOpacity={m.from === "me" ? 0.7 : 1}
                    style={[
                      styles.bubble,
                      m.from === "me" ? styles.bubbleMe : styles.bubbleThem,
                      m.type === 'sticker' && styles.bubbleSticker,
                    ]}
                  >
                    {m.type === 'image' && m.imageUrl ? (
                      <>
                        <Image 
                          source={{ uri: m.imageUrl }} 
                          style={styles.messageImage}
                          resizeMode="cover"
                        />
                        <Text style={styles.bubbleTime}>{m.time}</Text>
                      </>
                    ) : m.type === 'sticker' ? (
                      <>
                        <Text style={styles.stickerText}>{m.text}</Text>
                        <Text style={styles.bubbleTime}>{m.time}</Text>
                      </>
                    ) : m.type === 'voiceChat' && m.roomId ? (
                      <TouchableOpacity
                        style={styles.roomCard}
                        onPress={() => {
                          if (m.isActive) {
                            navigation.navigate('GroupAudioCall', {
                              roomId: m.roomId,
                              communityId: conversationId,
                              communityName: user.name,
                            });
                          } else {
                            Alert.alert('Session Ended', 'This voice chat has ended.');
                          }
                        }}
                      >
                        <LinearGradient
                          colors={['#6366F1', '#8B5CF6']}
                          style={styles.roomCardGradient}
                          start={{x: 0, y: 0}}
                          end={{x: 1, y: 1}}
                        >
                          <View style={styles.roomCardHeader}>
                            <View style={styles.roomCardIcon}>
                              <Ionicons name="mic" size={20} color="#FFF" />
                            </View>
                            <Text style={styles.roomCardTitle}>Voice Chat</Text>
                            {m.isActive && (
                              <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                              </View>
                            )}
                            {!m.isActive && (
                              <View style={[styles.liveIndicator, {backgroundColor: '#EF4444'}]}>
                                <Text style={styles.liveText}>ENDED</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.roomCardParticipants}>
                            <Ionicons name="people" size={14} color="#FFF" />
                            <Text style={styles.roomCardParticipantsText}>
                              {m.participants?.length || 0} {m.participants?.length === 1 ? 'participant' : 'participants'}
                            </Text>
                          </View>
                          <Text style={styles.roomCardTime}>{m.time}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : m.type === 'screeningRoom' && m.roomId ? (
                      <TouchableOpacity
                        style={styles.roomCard}
                        onPress={() => {
                          if (m.isActive) {
                            navigation.navigate('ScreenSharingRoom', {
                              roomId: m.roomId,
                              communityId: conversationId,
                              communityName: user.name,
                            });
                          } else {
                            Alert.alert('Session Ended', 'This screening room has ended.');
                          }
                        }}
                      >
                        <LinearGradient
                          colors={['#EC4899', '#F43F5E']}
                          style={styles.roomCardGradient}
                          start={{x: 0, y: 0}}
                          end={{x: 1, y: 1}}
                        >
                          <View style={styles.roomCardHeader}>
                            <View style={styles.roomCardIcon}>
                              <Ionicons name="tv" size={20} color="#FFF" />
                            </View>
                            <Text style={styles.roomCardTitle}>Screening Room</Text>
                            {m.isActive && (
                              <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                              </View>
                            )}
                            {!m.isActive && (
                              <View style={[styles.liveIndicator, {backgroundColor: '#EF4444'}]}>
                                <Text style={styles.liveText}>ENDED</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.roomCardParticipants}>
                            <Ionicons name="people" size={14} color="#FFF" />
                            <Text style={styles.roomCardParticipantsText}>
                              {m.participants?.length || 0} {m.participants?.length === 1 ? 'participant' : 'participants'}
                            </Text>
                          </View>
                          <Text style={styles.roomCardTime}>{m.time}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : m.type === 'roleplay' && m.sessionId ? (
                      <TouchableOpacity
                        style={styles.roomCard}
                        onPress={() => {
                          if (m.isActive) {
                            navigation.navigate('RoleplayScreen', {
                              sessionId: m.sessionId,
                              communityId: conversationId,
                              communityName: user.name,
                            });
                          } else {
                            Alert.alert('Session Ended', 'This roleplay session has ended.');
                          }
                        }}
                      >
                        <LinearGradient
                          colors={['#F59E0B', '#EF4444']}
                          style={styles.roomCardGradient}
                          start={{x: 0, y: 0}}
                          end={{x: 1, y: 1}}
                        >
                          <View style={styles.roomCardHeader}>
                            <View style={styles.roomCardIcon}>
                              <Ionicons name="person" size={20} color="#FFF" />
                            </View>
                            <Text style={styles.roomCardTitle}>Roleplay Session</Text>
                            {m.isActive && (
                              <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                              </View>
                            )}
                            {!m.isActive && (
                              <View style={[styles.liveIndicator, {backgroundColor: '#EF4444'}]}>
                                <Text style={styles.liveText}>ENDED</Text>
                              </View>
                            )}
                          </View>
                          {m.scenario && (
                            <Text style={styles.roleplayScenarioText} numberOfLines={2}>
                              {m.scenario}
                            </Text>
                          )}
                          <View style={styles.roomCardParticipants}>
                            <Ionicons name="people" size={14} color="#FFF" />
                            <Text style={styles.roomCardParticipantsText}>
                              {m.participants?.length || 0}/{m.roles?.length || 0} roles filled
                            </Text>
                          </View>
                          <Text style={styles.roomCardTime}>{m.time}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <Text style={styles.bubbleText}>{m.text}</Text>
                        <Text style={styles.bubbleTime}>{m.time}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* ✍️ Message Composer */}
        {uploadingImage && (
          <View style={styles.uploadingBar}>
            <ActivityIndicator size="small" color={ACCENT} />
            <Text style={styles.uploadingText}>Uploading image...</Text>
          </View>
        )}
        {isBlocked ? (
          <View style={styles.blockedBar}>
            <Ionicons name="ban" size={20} color="#EF4444" />
            <Text style={styles.blockedText}>
              You have blocked this user. Unblock them to send messages.
            </Text>
            <TouchableOpacity 
              style={styles.unblockButton}
              onPress={() => setShowInfoModal(true)}
            >
              <Text style={styles.unblockButtonText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.composerBar}>
            <View style={styles.composerInner}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type a message"
                placeholderTextColor={TEXT_DIM}
                style={styles.composerInput}
                multiline
                editable={!sending && !uploadingImage}
              />
              <TouchableOpacity 
                onPress={() => setShowStickerPicker(true)}
                disabled={uploadingImage || sending}
                style={{ marginRight: 8 }}
              >
             
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.plusBtn} 
                onPress={() => setShowAttachmentPicker(true)}
                disabled={uploadingImage || sending}
              >
                <Ionicons 
                  name="add" 
                  size={18} 
                  color={uploadingImage || sending ? "#666" : "#000"} 
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              onPress={send} 
              style={styles.sendBtn} 
              disabled={sending || uploadingImage}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="send" size={18} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Information</Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.userInfoRow}>
                <Avatar name={user.name} size={60} source={user.avatar} />
                <View style={styles.userInfoText}>
                  <Text style={styles.userInfoName}>{user.name}</Text>
                  <Text style={styles.userInfoHandle}>{user.handle}</Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <TouchableOpacity
                style={[styles.modalButton, isBlocked && styles.modalButtonUnblock]}
                onPress={handleBlockToggle}
              >
                <Ionicons
                  name={isBlocked ? "checkmark-circle-outline" : "ban-outline"}
                  size={20}
                  color={isBlocked ? GREEN : "#EF4444"}
                />
                <Text style={[styles.modalButtonText, isBlocked && styles.modalButtonTextUnblock]}>
                  {isBlocked ? "Unblock User" : "Block User"}
                </Text>
              </TouchableOpacity>

              {isBlocked && (
                <Text style={styles.blockNotice}>
                  User is blocked. They will remain in your messages list but cannot send you messages.
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sticker Picker Modal */}
      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={handleStickerSelect}
      />

      {/* Attachment Picker Modal */}
      <AttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onImageSelected={handleImageSelected}

      />

      {/* Feature Selection Modal (Party Features) */}
      <Modal
        visible={showFeatureModal}
        transparent
        animationType="slide"
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

            <View style={styles.featureOptionsContainer}>
              <TouchableOpacity
                style={styles.featureOption}
                onPress={() => handleFeatureSelect('voice')}
              >
                <LinearGradient
                  colors={['#8B2EF0', '#6A1BB8']}
                  style={styles.featureGradient}
                >
                  <Ionicons name="mic" size={32} color="#fff" />
                  <Text style={styles.featureTitle}>Voice Chat</Text>
                  <Text style={styles.featureSubtitle}>Start an audio call</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureOption}
                onPress={() => handleFeatureSelect('screening')}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#C92A2A']}
                  style={styles.featureGradient}
                >
                  <Ionicons name="film" size={32} color="#fff" />
                  <Text style={styles.featureTitle}>Screening Room</Text>
                  <Text style={styles.featureSubtitle}>Watch together</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureOption}
                onPress={() => handleFeatureSelect('roleplay')}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.featureGradient}
                >
                  <MaterialCommunityIcons name="drama-masks" size={32} color="#fff" />
                  <Text style={styles.featureTitle}>Roleplay</Text>
                  <Text style={styles.featureSubtitle}>Create a roleplay session</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMiniScreen === 'voice'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMiniScreen(null)}
      >
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <View style={styles.miniScreenHeader}>
              <Text style={styles.miniScreenTitle}>🎙️ Voice Chat</Text>
              <TouchableOpacity onPress={() => setShowMiniScreen(null)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.miniScreenBody}>
              <Ionicons name="mic" size={80} color="#8B2EF0" />
              <Text style={styles.miniScreenDescription}>
                Start a voice chat with {user.name}. They'll receive an invitation to join.
              </Text>
              <TouchableOpacity
                style={styles.miniScreenButton}
                onPress={sendVoiceChatInvite}
              >
                <Text style={styles.miniScreenButtonText}>Send Invitation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMiniScreen === 'screening'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMiniScreen(null)}
      >
        <View style={styles.miniScreenOverlay}>
          <View style={styles.miniScreenContainer}>
            <View style={styles.miniScreenHeader}>
              <Text style={styles.miniScreenTitle}>🎬 Screening Room</Text>
              <TouchableOpacity onPress={() => setShowMiniScreen(null)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.miniScreenBody}>
              <Ionicons name="film" size={80} color="#FF6B6B" />
              <Text style={styles.miniScreenDescription}>
                Create a screening room to watch videos together with {user.name}.
              </Text>
              <TouchableOpacity
                style={[styles.miniScreenButton, { backgroundColor: '#FF6B6B' }]}
                onPress={sendScreeningInvite}
              >
                <Text style={styles.miniScreenButtonText}>Send Invitation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Roleplay Character Creation Screen - Multi-page System */}
      {console.log('Roleplay Modal visible:', showMiniScreen === 'roleplay', 'showMiniScreen:', showMiniScreen)}
      <Modal
        visible={showMiniScreen === 'roleplay'}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowMiniScreen(null);
          setPendingRoleplayJoin(null);
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
        }}
      >
        <View style={styles.roleplayModalOverlay}>
          <View style={styles.roleplayModalContainer}>
            <View style={styles.roleplayModalHeader}>
              <TouchableOpacity onPress={() => {
                  if (roleplayPage === 1) {
                    setShowMiniScreen(null);
                    setPendingRoleplayJoin(null);
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
                  } else if (roleplayPage === 5) {
                    setRoleplayPage(1);
                  } else {
                    setRoleplayPage(roleplayPage - 1);
                  }
                }}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.roleplayModalTitle}>
                {roleplayPage === 1 ? 'Start Roleplay' : roleplayPage === 5 ? 'Character Collection' : `Add Character (${roleplayPage - 1}/3)`}
              </Text>
              <TouchableOpacity onPress={() => {
                if (roleplayPage === 5 && selectedCharactersForSession.length > 0) {
                  setShowMiniScreen(null);
                  startRoleplayWithCharacters();
                }
              }}>
                {roleplayPage === 5 && selectedCharactersForSession.length > 0 && (
                  <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                )}
                {(roleplayPage !== 5 || selectedCharactersForSession.length === 0) && (
                  <View style={{width: 28}} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.roleplayModalBody} 
              contentContainerStyle={styles.roleplayModalBodyContent}
              showsVerticalScrollIndicator={false}
            >
                {/* Page 1: Choose Action */}
                {roleplayPage === 1 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="people" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Start Roleplay</Text>
                    <Text style={styles.roleplayPageDesc}>Choose how you want to begin your roleplay session</Text>
                    
                    <TouchableOpacity style={styles.roleplayChoiceButton} onPress={() => setRoleplayPage(2)}>
                      <View style={styles.roleplayChoiceIcon}>
                        <Ionicons name="person-add" size={40} color="#FFD700" />
                      </View>
                      <View style={styles.roleplayChoiceContent}>
                        <Text style={styles.roleplayChoiceTitle}>Create New Character</Text>
                        <Text style={styles.roleplayChoiceDesc}>Create a brand new character with custom attributes</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#888" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.roleplayChoiceButton} onPress={() => setRoleplayPage(5)}>
                      <View style={styles.roleplayChoiceIcon}>
                        <Ionicons name="albums" size={40} color="#4CAF50" />
                      </View>
                      <View style={styles.roleplayChoiceContent}>
                        <Text style={styles.roleplayChoiceTitle}>Use Existing Characters</Text>
                        <Text style={styles.roleplayChoiceDesc}>Select from your saved characters collection</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#888" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Page 2: Basic Info */}
                {roleplayPage === 2 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="person-add" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Basic Info</Text>
                    <Text style={styles.roleplayPageDesc}>Let's start with the basics</Text>
                    
                    {/* Character Image Upload */}
                    <Text style={styles.attributeLabel}>Character Image</Text>
                    <TouchableOpacity 
                      style={styles.imageUploadButton}
                      onPress={() => setShowImageOptions(true)}
                      disabled={uploadingCharacterImage}
                    >
                      {uploadingCharacterImage ? (
                        <ActivityIndicator size="large" color="#FFD700" />
                      ) : characterAvatar ? (
                        <Image source={{ uri: characterAvatar }} style={styles.characterPreviewImage} />
                      ) : (
                        <View style={styles.imageUploadPlaceholder}>
                          <Ionicons name="camera" size={40} color="#666" />
                          <Text style={styles.imageUploadText}>Upload Image</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Color Customization */}
                    <Text style={styles.attributeLabel}>Frame & Text Colors</Text>
                    <View style={styles.colorPresetsContainer}>
                      {colorPresets.map((preset) => (
                        <TouchableOpacity
                          key={preset.name}
                          style={[
                            styles.colorPresetButton,
                            { backgroundColor: preset.frame },
                            characterFrameColor === preset.frame && styles.colorPresetSelected
                          ]}
                          onPress={() => applyColorPreset(preset)}
                        >
                          <Text style={[styles.colorPresetText, { color: preset.text }]}>
                            {preset.name.charAt(0)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <Text style={styles.attributeLabel}>Name *</Text>
                    <TextInput
                      style={styles.roleplayInput}
                      placeholder="Enter character name"
                      placeholderTextColor="#666"
                      value={characterName}
                      onChangeText={setCharacterName}
                      maxLength={50}
                    />

                    <Text style={styles.attributeLabel}>Subtitle</Text>
                    <TextInput
                      style={styles.roleplayInput}
                      placeholder="e.g., The Brave Warrior"
                      placeholderTextColor="#666"
                      value={characterSubtitle}
                      onChangeText={setCharacterSubtitle}
                      maxLength={100}
                    />

                    {/* Character Preview */}
                    {(characterName || characterAvatar) && (
                      <View style={styles.characterPreviewCard}>
                        <Text style={styles.previewLabel}>Preview</Text>
                        <View style={[styles.previewFrame, { borderColor: characterFrameColor, backgroundColor: characterFrameColor + '20' }]}>
                          {characterAvatar && (
                            <Image 
                              source={{ uri: characterAvatar }} 
                              style={[styles.previewImage, { borderColor: characterFrameColor }]}
                            />
                          )}
                          <View style={styles.previewInfo}>
                            <Text style={[styles.previewName, { color: characterTextColor }]}>
                              {characterName || 'Character Name'}
                            </Text>
                            {characterSubtitle && (
                              <Text style={[styles.previewSubtitle, { color: characterTextColor + 'CC' }]}>
                                {characterSubtitle}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Page 3: Personal Details */}
                {roleplayPage === 3 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="list" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Personal Details</Text>
                    <Text style={styles.roleplayPageDesc}>Add character's personal information</Text>
                    
                    <Text style={styles.attributeLabel}>Gender</Text>
                    <View style={styles.genderSelector}>
                      {['Male', 'Female', 'Non-binary', 'Other'].map((gender) => (
                        <TouchableOpacity
                          key={gender}
                          style={[styles.genderOption, characterGender === gender && styles.genderOptionSelected]}
                          onPress={() => setCharacterGender(gender)}
                        >
                          <Text style={[styles.genderOptionText, characterGender === gender && styles.genderOptionTextSelected]}>{gender}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

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
                  </View>
                )}

                {/* Page 4: Description */}
                {roleplayPage === 4 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.featureIconContainer}>
                      <Ionicons name="document-text" size={60} color="#FFD700" />
                    </View>
                    <Text style={styles.roleplayPageTitle}>Character Details</Text>
                    <Text style={styles.roleplayPageDesc}>Add description</Text>
                    
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
                  </View>
                )}

                {/* Page 5: Character Collection */}
                {roleplayPage === 5 && (
                  <View style={styles.roleplayPageContent}>
                    <View style={styles.characterCollectionHeader}>
                      <Text style={styles.collectionTitle}>Your Characters</Text>
                      <TouchableOpacity style={styles.addCharacterButton} onPress={() => {
                        setRoleplayPage(2);
                        setCharacterAvatar('');
                        setCharacterName('');
                        setCharacterSubtitle('');
                        setCharacterGender('');
                        setCharacterAge('');
                        setCharacterDescription('');
                        setEditingCharacterId(null);
                      }}>
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
                      <>
                        <Text style={styles.collectionHelpText}>
                          Tap to select • Long press to edit or delete
                        </Text>
                        <View style={styles.characterList}>
                        {characterCollection.map((character) => {
                          const isSelected = selectedCharactersForSession.some(c => c.id === character.id);
                          const frameColor = character.frameColor || '#FFD700';
                          const textColor = character.textColor || '#1F2937';
                          return (
                            <TouchableOpacity
                              key={character.id}
                              style={[
                                styles.characterCard, 
                                { borderColor: frameColor },
                                isSelected && styles.characterCardSelected
                              ]}
                              onPress={() => {
                                if (isSelected) {
                                  setSelectedCharactersForSession(prev => prev.filter(c => c.id !== character.id));
                                } else {
                                  setSelectedCharactersForSession(prev => [...prev, character]);
                                }
                              }}
                              onLongPress={() => {
                                Alert.alert(
                                  character.name,
                                  'Choose an action',
                                  [
                                    {
                                      text: 'Edit',
                                      onPress: () => {
                                        setCharacterAvatar(character.avatar || '');
                                        setCharacterName(character.name);
                                        setCharacterSubtitle(character.subtitle || '');
                                        setCharacterGender(character.gender || '');
                                        setCharacterAge(character.age || '');
                                        setCharacterDescription(character.description || '');
                                        setCharacterFrameColor(character.frameColor || '#FFD700');
                                        setCharacterTextColor(character.textColor || '#1F2937');
                                        setEditingCharacterId(character.id);
                                        setRoleplayPage(2);
                                      }
                                    },
                                    {
                                      text: 'Delete',
                                      style: 'destructive',
                                      onPress: () => removeCharacterFromCollection(character.id)
                                    },
                                    { text: 'Cancel', style: 'cancel' }
                                  ]
                                );
                              }}
                            >
                              {character.avatar && (
                                <Image 
                                  source={{ uri: character.avatar }} 
                                  style={[styles.characterCardImage, { borderColor: frameColor }]}
                                />
                              )}
                              <View style={styles.characterCardContent}>
                                <Text style={styles.characterCardName}>{character.name}</Text>
                                {character.subtitle && <Text style={styles.characterCardSubtitle}>{character.subtitle}</Text>}
                                {character.description && <Text style={styles.characterCardDescription} numberOfLines={2}>{character.description}</Text>}
                                {character.frameColor && (
                                  <View style={styles.characterColorIndicator}>
                                    <View style={[styles.colorDot, { backgroundColor: frameColor }]} />
                                    <View style={[styles.colorDot, { backgroundColor: textColor }]} />
                                  </View>
                                )}
                              </View>
                              {isSelected && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
                            </TouchableOpacity>
                          );
                        })}
                        </View>
                      </>
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

            <View style={styles.roleplayModalActions}>
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

                {roleplayPage === 3 && (
                  <TouchableOpacity style={[styles.miniScreenButton, styles.nextButton]} onPress={() => setRoleplayPage(4)}>
                    <Text style={styles.miniScreenButtonText}>Next</Text>
                  </TouchableOpacity>
                )}

                {roleplayPage === 4 && (
                  <TouchableOpacity style={[styles.miniScreenButton, styles.nextButton]} onPress={() => saveCharacterToCollection()}>
                    <Text style={styles.miniScreenButtonText}>{editingCharacterId ? 'Update Character' : 'Save Character'}</Text>
                  </TouchableOpacity>
                )}

                {roleplayPage === 5 && selectedCharactersForSession.length > 0 && (
                  <TouchableOpacity
                    style={[styles.miniScreenButton, styles.startButton]}
                    onPress={() => {
                      setShowMiniScreen(null);
                      startRoleplayWithCharacters();
                    }}
                  >
                    <Text style={styles.miniScreenButtonText}>Start Roleplay Session</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Upload Options Modal */}
      <Modal
        visible={showImageOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <View style={styles.imageOptionsOverlay}>
          <View style={styles.imageOptionsContainer}>
            <View style={styles.imageOptionsHeader}>
              <Text style={styles.imageOptionsTitle}>Add Character Image</Text>
              <TouchableOpacity onPress={() => setShowImageOptions(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.imageOptionButton}
              onPress={handleCharacterImageUpload}
            >
              <View style={styles.imageOptionIcon}>
                <Ionicons name="image" size={32} color="#4CAF50" />
              </View>
              <View style={styles.imageOptionContent}>
                <Text style={styles.imageOptionTitle}>Upload from Gallery</Text>
                <Text style={styles.imageOptionDesc}>Choose an image from your device</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageOptionButton}
              onPress={handleAIImageGeneration}
            >
              <View style={styles.imageOptionIcon}>
                <Ionicons name="sparkles" size={32} color="#FFD700" />
              </View>
              <View style={styles.imageOptionContent}>
                <Text style={styles.imageOptionTitle}>AI Generation</Text>
                <Text style={styles.imageOptionDesc}>Create custom character art with AI</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>

            {characterAvatar && (
              <TouchableOpacity
                style={[styles.imageOptionButton, { borderColor: '#EF4444' }]}
                onPress={() => {
                  setCharacterAvatar('');
                  setShowImageOptions(false);
                  Alert.alert('Success', 'Character image removed');
                }}
              >
                <View style={[styles.imageOptionIcon, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="trash" size={32} color="#EF4444" />
                </View>
                <View style={styles.imageOptionContent}>
                  <Text style={[styles.imageOptionTitle, { color: '#EF4444' }]}>Remove Image</Text>
                  <Text style={styles.imageOptionDesc}>Delete current character image</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  customHeader: {
    backgroundColor: BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F25",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  backBtn: { marginRight: 8 },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerEmail: { color: TEXT_DIM, fontSize: 12 },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    paddingHorizontal: 6 
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${ACCENT}33`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${ACCENT}66`,
  },

  scrollContainer: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 100,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    gap: 8,
  },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  bubbleThem: { backgroundColor: CARD, borderColor: "#23232A" },
  bubbleMe: { backgroundColor: `${ACCENT}33`, borderColor: `${ACCENT}66` },
  bubbleText: { color: "#fff" },
  bubbleTime: { color: TEXT_DIM, fontSize: 10, marginTop: 4, textAlign: "right" },

  // Message type specific styles
  bubbleSticker: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 4,
  },
  stickerText: {
    fontSize: 64,
    lineHeight: 70,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },

  // File message styles
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#23232A',
    minWidth: 200,
    maxWidth: 250,
    marginBottom: 4,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileDetails: {
    color: TEXT_DIM,
    fontSize: 11,
  },

  // Uploading indicator
  uploadingBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 70,
    padding: 10,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: "#23232A",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadingText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },

  composerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: BG,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#19191F",
  },
  composerInner: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#23232A",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  composerInput: { flex: 1, color: "#fff", paddingVertical: 4, minHeight: 20 },
  plusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CYAN,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    backgroundColor: CYAN,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Blocked bar styles
  blockedBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#1F1F25',
    borderTopWidth: 1,
    borderTopColor: '#EF444444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blockedText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 13,
    lineHeight: 18,
  },
  unblockButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: CARD,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfoText: {
    marginLeft: 15,
    flex: 1,
  },
  userInfoName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userInfoHandle: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#23232A',
    marginVertical: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF444420',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 10,
  },
  modalButtonUnblock: {
    backgroundColor: `${GREEN}20`,
    borderColor: GREEN,
  },
  modalButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextUnblock: {
    color: GREEN,
  },
  blockNotice: {
    color: TEXT_DIM,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 18,
  },
  
  // Feature Modal Styles
  featureModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  featureModalContainer: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  featureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  featureModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  featureOptionsContainer: {
    padding: 20,
    gap: 16,
  },
  featureOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  featureSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  
  // Mini Screen Styles
  miniScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  miniScreenContainer: {
    backgroundColor: CARD,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  miniScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  miniScreenTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  miniScreenBody: {
    flex: 1,
  },
  miniScreenBodyContent: {
    padding: 20,
  },
  miniScreenDescription: {
    color: TEXT_DIM,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  miniScreenButton: {
    backgroundColor: '#8B2EF0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  miniScreenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Roleplay Setup Styles
  roleplaySetupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  roleplaySetupModal: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  roleplaySetupContent: {
    padding: 20,
    maxHeight: '70%',
  },
  roleplaySetupLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 16,
  },
  roleplayScenarioInput: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#23232A',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rolesSection: {
    marginTop: 8,
  },
  rolesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: BG,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  roleInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleInputNumber: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  roleNameInput: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#23232A',
    marginBottom: 10,
  },
  roleDescriptionInput: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#23232A',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  createRoleplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    padding: 16,
    margin: 20,
    borderRadius: 12,
    gap: 10,
  },
  createRoleplayButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Room Card Styles
  roomCard: {
    width: 260,
    marginVertical: 4,
  },
  roomCardGradient: {
    borderRadius: 16,
    padding: 16,
    minHeight: 140,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  roomCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCardTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  roomCardParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  roomCardParticipantsText: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
  },
  roomCardTime: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.7,
    marginTop: 8,
  },
  roleplayScenarioText: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    marginTop: 8,
    lineHeight: 18,
  },

  // New Roleplay Character Creation Styles
  miniScreenContent: {
    flex: 1,
    maxHeight: '100%',
  },
  roleplayPageContent: {
    padding: 20,
  },
  roleplayPageTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  roleplayPageDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  roleplayChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  roleplayChoiceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
    color: TEXT_DIM,
    fontSize: 13,
    lineHeight: 18,
  },
  attributeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  imageUploadButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: CARD,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 12,
    overflow: 'hidden',
  },
  imageUploadPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageUploadText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  characterPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  colorPresetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  colorPresetButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPresetSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  colorPresetText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  characterPreviewCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  previewLabel: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  previewSubtitle: {
    fontSize: 13,
  },
  roleplayInput: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  roleplayTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  genderSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  genderOptionSelected: {
    backgroundColor: '#FFD70033',
    borderColor: '#FFD700',
  },
  genderOptionText: {
    color: TEXT_DIM,
    fontSize: 14,
  },
  genderOptionTextSelected: {
    color: '#FFD700',
    fontWeight: '600',
  },
  characterCollectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  collectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  addCharacterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCharacterButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCollection: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCollectionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyCollectionSubtext: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 8,
  },
  collectionHelpText: {
    color: TEXT_DIM,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  characterList: {
    gap: 12,
  },
  characterCard: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#23232A',
    alignItems: 'center',
  },
  characterCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  characterCardImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
  },
  characterCardContent: {
    flex: 1,
  },
  characterCardName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  characterColorIndicator: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff33',
  },
  characterCardSubtitle: {
    color: '#FFD700',
    fontSize: 13,
    marginBottom: 6,
  },
  characterCardDescription: {
    color: TEXT_DIM,
    fontSize: 12,
    lineHeight: 16,
  },
  selectedCharactersInfo: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    padding: 16,
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
  miniScreenActions: {
    padding: 20,
  },
  nextButton: {
    backgroundColor: '#8B2EF0',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  
  // Image Options Modal Styles
  imageOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  imageOptionsContainer: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  imageOptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  imageOptionsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  imageOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF5020',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  imageOptionContent: {
    flex: 1,
  },
  imageOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  imageOptionDesc: {
    color: TEXT_DIM,
    fontSize: 13,
  },
  
  // Missing Roleplay Styles
  featureIconContainer: {
    alignSelf: 'center',
    marginVertical: 20,
  },
  roleplayChoiceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  addCharacterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCharacterButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Roleplay Modal Specific Styles
  roleplayModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleplayModalContainer: {
    backgroundColor: '#17171C',
    borderRadius: 24,
    width: '95%',
    maxWidth: 500,
    height: '85%',
    overflow: 'hidden',
  },
  roleplayModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1F1F25',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A30',
  },
  roleplayModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  roleplayModalBody: {
    flex: 1,
    backgroundColor: '#0B0B0E',
  },
  roleplayModalBodyContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  roleplayModalActions: {
    padding: 16,
    backgroundColor: '#1F1F25',
    borderTopWidth: 1,
    borderTopColor: '#2A2A30',
  },
});








