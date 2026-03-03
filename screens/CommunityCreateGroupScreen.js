import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { uploadImageToHostinger } from '../hostingerConfig';
import { normalizeBlobUri } from '../utils/normalizeUri';

const ACCENT = '#8B2EF0';
const CYAN = '#08FFE2';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

const THEME_COLORS = [
  { color: '#8B2EF0', name: 'Purple' },
  { color: '#3B82F6', name: 'Blue' },
  { color: '#10B981', name: 'Green' },
  { color: '#F59E0B', name: 'Amber' },
  { color: '#EF4444', name: 'Red' },
  { color: '#EC4899', name: 'Pink' },
  { color: '#8B5CF6', name: 'Violet' },
  { color: '#14B8A6', name: 'Teal' },
];

const GROUP_EMOJIS = ['🎮', '💬', '🎵', '🎨', '⚽', '📚', '🍕', '✨', '🚀', '🎯', '💎', '🔥'];

export default function CommunityCreateGroupScreen({ navigation, route }) {
  const currentUser = auth.currentUser;
  const { communityId, communityName } = route?.params || {};

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [groupImage, setGroupImage] = useState(null);
  const [selectedColor, setSelectedColor] = useState(THEME_COLORS[0].color);
  const [selectedEmoji, setSelectedEmoji] = useState(GROUP_EMOJIS[0]);
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a group photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const safeUri = await normalizeBlobUri(asset.uri);
        setGroupImage({ ...asset, uri: safeUri });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const safeUri = await normalizeBlobUri(asset.uri);
        setGroupImage({ ...asset, uri: safeUri });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const selectPhotoOption = () => {
    Alert.alert(
      'Group Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const createGroup = async () => {
    if (!communityId) {
      Alert.alert('Error', 'Community information is missing.');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for your group.');
      return;
    }

    if (groupName.length > 100) {
      Alert.alert('Name Too Long', 'Group name must be 100 characters or less.');
      return;
    }

    if (description.length > 500) {
      Alert.alert('Description Too Long', 'Description must be 500 characters or less.');
      return;
    }

    setCreating(true);

    try {
      let groupImageUrl = null;

      // Upload group image if selected
      if (groupImage) {
        setUploadingImage(true);
        groupImageUrl = await uploadImageToHostinger(groupImage.uri, 'community_group_images');
        setUploadingImage(false);
      }

      // Get current user info
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data() || {};
      const currentUserName = userData.displayName || userData.name || userData.fullName || 'User';

      // Create group document in community's groups subcollection
      const groupRef = doc(collection(db, 'communities', communityId, 'groups'));
      const groupId = groupRef.id;

      await setDoc(groupRef, {
        name: groupName.trim(),
        description: description.trim() || '',
        groupImage: groupImageUrl,
        createdBy: currentUser.uid,
        createdByName: currentUserName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        settings: {
          privacy: 'public',
          whoCanSendMessages: 'all', // all, adminsOnly
          whoCanJoin: 'anyone',
        },
        
        memberCount: 0,
        messageCount: 0,
        lastMessage: null,
        
        theme: {
          color: selectedColor,
          emoji: selectedEmoji,
        },
        
        isActive: true,
        communityId: communityId,
        communityName: communityName || 'Community',
      });

      // Create welcome message in group chat
      const messagesRef = collection(db, 'communities', communityId, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'System',
        senderImage: null,
        text: `${currentUserName} created this group. Welcome! 🎉`,
        type: 'system',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });

      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
      setUploadingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[BG, '#0F0F14', BG]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Group in {communityName || 'Community'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Group Image */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group Photo</Text>
              <TouchableOpacity style={styles.imageContainer} onPress={selectPhotoOption}>
                {groupImage ? (
                  <Image source={{ uri: groupImage.uri }} style={styles.groupImagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={40} color={TEXT_DIM} />
                    <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Group Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter group name"
                placeholderTextColor={TEXT_DIM}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={100}
              />
              <Text style={styles.characterCount}>{groupName.length}/100</Text>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What's this group about?"
                placeholderTextColor={TEXT_DIM}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{description.length}/500</Text>
            </View>

            {/* Theme Color */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Theme Color</Text>
              <View style={styles.colorGrid}>
                {THEME_COLORS.map((item) => (
                  <TouchableOpacity
                    key={item.color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: item.color },
                      selectedColor === item.color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(item.color)}
                  >
                    {selectedColor === item.color && (
                      <Ionicons name="checkmark" size={24} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Emoji */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group Emoji</Text>
              <View style={styles.emojiGrid}>
                {GROUP_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      selectedEmoji === emoji && styles.emojiOptionSelected,
                    ]}
                    onPress={() => setSelectedEmoji(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                (creating || uploadingImage) && styles.createButtonDisabled,
              ]}
              onPress={createGroup}
              disabled={creating || uploadingImage}
            >
              {creating || uploadingImage ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.createButtonText}>Create Group</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  gradient: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  imageContainer: {
    alignSelf: 'center',
  },
  groupImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: ACCENT,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 8,
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  characterCount: {
    color: TEXT_DIM,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    borderWidth: 3,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emojiOption: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  emojiOptionSelected: {
    borderColor: ACCENT,
    backgroundColor: '#1a1a24',
  },
  emojiText: {
    fontSize: 28,
  },
  privacyContainer: {
    gap: 12,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#333',
  },
  privacyOptionSelected: {
    borderColor: ACCENT,
    backgroundColor: '#1a1a24',
  },
  privacyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  privacyTitleSelected: {
    color: ACCENT,
  },
  privacyDescription: {
    fontSize: 13,
    color: TEXT_DIM,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 32,
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
