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

const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

const THEME_COLORS = [
  { color: '#7C3AED', name: 'Purple' },
  { color: '#3B82F6', name: 'Blue' },
  { color: '#10B981', name: 'Green' },
  { color: '#F59E0B', name: 'Amber' },
  { color: '#EF4444', name: 'Red' },
  { color: '#EC4899', name: 'Pink' },
  { color: '#8B5CF6', name: 'Violet' },
  { color: '#14B8A6', name: 'Teal' },
];

const GROUP_EMOJIS = ['🎮', '💬', '🎵', '🎨', '⚽', '📚', '🍕', '✨', '🚀', '🎯', '💎', '🔥'];

export default function CreateGroupScreen({ navigation, route }) {
  const currentUser = auth.currentUser;
  const selectedMembers = route?.params?.selectedMembers || [];

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [groupImage, setGroupImage] = useState(null);
  const [selectedColor, setSelectedColor] = useState(THEME_COLORS[0].color);
  const [selectedEmoji, setSelectedEmoji] = useState(GROUP_EMOJIS[0]);
  const [privacy, setPrivacy] = useState('private'); // public, private, secret
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
        groupImageUrl = await uploadImageToHostinger(groupImage.uri, 'group_images');
        setUploadingImage(false);
      }

      // Get current user info
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data() || {};
      const currentUserName = userData.displayName || userData.name || userData.fullName || 'User';

      // Create members object with creator as admin
      const members = {
        [currentUser.uid]: {
          role: 'admin',
          joinedAt: serverTimestamp(),
          addedBy: currentUser.uid,
          nickname: null,
          isMuted: false,
          mutedUntil: null,
        }
      };

      // Add selected members
      selectedMembers.forEach(member => {
        members[member.userId] = {
          role: 'member',
          joinedAt: serverTimestamp(),
          addedBy: currentUser.uid,
          nickname: null,
          isMuted: false,
          mutedUntil: null,
        };
      });

      // Create group document
      const groupRef = doc(collection(db, 'groups'));
      const groupId = groupRef.id;

      await setDoc(groupRef, {
        name: groupName.trim(),
        description: description.trim() || '',
        groupImage: groupImageUrl,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        members: members,
        
        settings: {
          privacy: privacy,
          whoCanSendMessages: 'all',
          whoCanAddMembers: 'all',
          whoCanEditGroup: 'adminsOnly',
          approvalRequired: false,
          maxMembers: 256,
          linkJoinEnabled: privacy !== 'secret',
          inviteLink: privacy !== 'secret' ? `socialvibing://group/${groupId}` : null,
        },
        
        memberCount: Object.keys(members).length,
        messageCount: 0,
        lastMessage: null,
        
        theme: {
          color: selectedColor,
          wallpaper: null,
          emoji: selectedEmoji,
        },
        
        pinnedMessages: [],
        isActive: true,
        isArchived: false,
        tags: [],
        category: 'general',
      });

      // Add group to each member's personal groups collection
      for (const memberId of Object.keys(members)) {
        const userGroupRef = doc(db, 'users', memberId, 'groups', groupId);
        await setDoc(userGroupRef, {
          groupId: groupId,
          groupName: groupName.trim(),
          groupImage: groupImageUrl,
          role: members[memberId].role,
          joinedAt: serverTimestamp(),
          unreadCount: 0,
          lastReadMessageId: null,
          lastReadTimestamp: null,
          isMuted: false,
          mutedUntil: null,
          isPinned: false,
          isArchived: false,
          lastMessage: null,
          updatedAt: serverTimestamp(),
        });
      }

      // Create welcome message
      const messagesRef = collection(db, 'groups', groupId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'System',
        senderImage: null,
        text: `${currentUserName} created the group`,
        type: 'system',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
        isPinned: false,
      });

      // Log activity
      const activityRef = collection(db, 'groups', groupId, 'activity');
      await addDoc(activityRef, {
        type: 'group_created',
        performedBy: currentUser.uid,
        performedByName: currentUserName,
        details: {
          groupName: groupName.trim(),
          memberCount: Object.keys(members).length,
        },
        timestamp: serverTimestamp(),
        isVisible: true,
      });

      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('GroupChat', {
              groupId: groupId,
              groupName: groupName.trim(),
              groupImage: groupImageUrl,
            });
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
          <Text style={styles.headerTitle}>Create Group</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
        >
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Group Photo */}
            <View style={styles.photoSection}>
              <TouchableOpacity 
                style={[styles.photoContainer, { borderColor: selectedColor }]}
                onPress={selectPhotoOption}
              >
                {groupImage ? (
                  <Image source={{ uri: groupImage.uri }} style={styles.groupPhoto} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.emojiLarge}>{selectedEmoji}</Text>
                    <Ionicons name="camera" size={24} color={TEXT_DIM} style={styles.cameraIcon} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.photoLabel}>Tap to add group photo</Text>
            </View>

            {/* Emoji Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Group Emoji</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.emojiScroll}
              >
                {GROUP_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiButton,
                      selectedEmoji === emoji && { backgroundColor: selectedColor + '33', borderColor: selectedColor }
                    ]}
                    onPress={() => setSelectedEmoji(emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Group Name */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Group Name *</Text>
              <View style={[styles.inputContainer, { borderColor: selectedColor + '40' }]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter group name..."
                  placeholderTextColor={TEXT_DIM}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={100}
                />
                <Text style={styles.charCount}>{groupName.length}/100</Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description (Optional)</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer, { borderColor: selectedColor + '40' }]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What's this group about?"
                  placeholderTextColor={TEXT_DIM}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{description.length}/500</Text>
              </View>
            </View>

            {/* Theme Color */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Theme Color</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.colorScroll}
              >
                {THEME_COLORS.map((item) => (
                  <TouchableOpacity
                    key={item.color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: item.color },
                      selectedColor === item.color && styles.colorButtonSelected
                    ]}
                    onPress={() => setSelectedColor(item.color)}
                  >
                    {selectedColor === item.color && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Privacy */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Privacy</Text>
              <View style={styles.privacyOptions}>
                <TouchableOpacity
                  style={[
                    styles.privacyButton,
                    privacy === 'public' && { backgroundColor: selectedColor + '33', borderColor: selectedColor }
                  ]}
                  onPress={() => setPrivacy('public')}
                >
                  <Ionicons name="globe-outline" size={20} color="#fff" />
                  <Text style={styles.privacyText}>Public</Text>
                  {privacy === 'public' && <Ionicons name="checkmark-circle" size={18} color={selectedColor} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.privacyButton,
                    privacy === 'private' && { backgroundColor: selectedColor + '33', borderColor: selectedColor }
                  ]}
                  onPress={() => setPrivacy('private')}
                >
                  <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                  <Text style={styles.privacyText}>Private</Text>
                  {privacy === 'private' && <Ionicons name="checkmark-circle" size={18} color={selectedColor} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.privacyButton,
                    privacy === 'secret' && { backgroundColor: selectedColor + '33', borderColor: selectedColor }
                  ]}
                  onPress={() => setPrivacy('secret')}
                >
                  <Ionicons name="eye-off-outline" size={20} color="#fff" />
                  <Text style={styles.privacyText}>Secret</Text>
                  {privacy === 'secret' && <Ionicons name="checkmark-circle" size={18} color={selectedColor} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.privacyHint}>
                {privacy === 'public' && '• Anyone can find and join this group'}
                {privacy === 'private' && '• Only members can see content, invite link available'}
                {privacy === 'secret' && '• Only invited members can join, no invite link'}
              </Text>
            </View>

            {/* Members Preview */}
            {selectedMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Members ({selectedMembers.length + 1})</Text>
                <View style={styles.membersPreview}>
                  <View style={styles.memberItem}>
                    <View style={styles.memberAvatar}>
                      <Ionicons name="person" size={16} color="#fff" />
                    </View>
                    <Text style={styles.memberName}>You (Admin)</Text>
                  </View>
                  {selectedMembers.slice(0, 3).map((member) => (
                    <View key={member.userId} style={styles.memberItem}>
                      {member.profileImage ? (
                        <Image source={{ uri: member.profileImage }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatar}>
                          <Ionicons name="person" size={16} color="#fff" />
                        </View>
                      )}
                      <Text style={styles.memberName}>{member.displayName}</Text>
                    </View>
                  ))}
                  {selectedMembers.length > 3 && (
                    <Text style={styles.moreMembers}>+{selectedMembers.length - 3} more</Text>
                  )}
                </View>
              </View>
            )}

            {/* Add Members Button */}
            <TouchableOpacity
              style={[styles.addMembersButton, { borderColor: selectedColor }]}
              onPress={() => navigation.navigate('AddGroupMembers', { 
                currentMembers: selectedMembers,
                returnScreen: 'CreateGroup'
              })}
            >
              <Ionicons name="person-add" size={20} color={selectedColor} />
              <Text style={[styles.addMembersText, { color: selectedColor }]}>
                {selectedMembers.length > 0 ? 'Add More Members' : 'Add Members'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Create Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: selectedColor },
              (creating || !groupName.trim()) && styles.createButtonDisabled
            ]}
            onPress={createGroup}
            disabled={creating || !groupName.trim()}
          >
            {creating ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.createButtonText}>
                  {uploadingImage ? 'Uploading Image...' : 'Creating Group...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.createButtonText}>Create Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    borderBottomColor: '#1F1F25',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  groupPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiLarge: {
    fontSize: 48,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  photoLabel: {
    color: TEXT_DIM,
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  charCount: {
    color: TEXT_DIM,
    fontSize: 11,
    marginLeft: 8,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 0,
  },
  emojiScroll: {
    flexGrow: 0,
  },
  emojiButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emoji: {
    fontSize: 24,
  },
  colorScroll: {
    flexGrow: 0,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#fff',
  },
  privacyOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  privacyButton: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  privacyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  privacyHint: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  membersPreview: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT + '33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberName: {
    color: '#fff',
    fontSize: 14,
  },
  moreMembers: {
    color: TEXT_DIM,
    fontSize: 13,
    marginLeft: 42,
  },
  addMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  addMembersText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F1F25',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
