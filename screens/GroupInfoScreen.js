// screens/GroupInfoScreen.js
// WhatsApp-style organized group settings
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { 
  addGroupMembers, 
  removeGroupMember, 
  leaveGroup,
  promoteToAdmin,
  demoteAdmin,
  updateGroupInfo 
} from '../utils/groupChatHelpers';
import { uploadImageToHostinger } from '../hostingerConfig';
import { normalizeBlobUri } from '../utils/normalizeUri';
import ReportUserModal from '../components/ReportUserModal';
import { REPORT_TYPES } from '../shared/services/reportService';

const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';
const BG = '#0B0B0E';
const CARD = '#17171C';
const BORDER = '#242A33';
const TEXT_DIM = '#9CA3AF';
const DANGER = '#EF4444';

export default function GroupInfoScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const currentUserId = auth.currentUser?.uid;
  
  const [groupData, setGroupData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // User settings
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [customNotifications, setCustomNotifications] = useState('all');
  const [isArchived, setIsArchived] = useState(false);
  
  useEffect(() => {
    if (!conversationId) return;
    
    // Subscribe to group data
    const unsubscribe = onSnapshot(
      doc(db, 'conversations', conversationId),
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGroupData(data);
          setIsAdmin(data.admins?.includes(currentUserId));
          setTempName(data.groupName || '');
          setTempDescription(data.groupDescription || '');
          
          // Load user settings
          const userSettings = data.userSettings?.[currentUserId] || {};
          setMuteNotifications(userSettings.muted || false);
          setCustomNotifications(userSettings.customNotifications || 'all');
          setIsArchived(userSettings.archived || false);
          
          // Load participant details
          if (data.participants) {
            const participantDetails = await Promise.all(
              data.participants.map(async (userId) => {
                const userDoc = await getDoc(doc(db, 'users', userId));
                return {
                  id: userId,
                  ...userDoc.data(),
                  isAdmin: data.admins?.includes(userId)
                };
              })
            );
            setParticipants(participantDetails);
          }
          
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error loading group:', error);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [conversationId, currentUserId]);
  
  const handleChangeGroupIcon = async () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only admins can change the group icon');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      try {
        const safeUri = await normalizeBlobUri(result.assets[0].uri);
        const iconUrl = await uploadImageToHostinger(safeUri, 'group_icons');
        await updateGroupInfo(conversationId, { groupIcon: iconUrl });
        Alert.alert('Success', 'Group icon updated');
      } catch (error) {
        Alert.alert('Error', 'Failed to update group icon');
      }
    }
  };
  
  const handleSaveName = async () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }
    
    try {
      await updateGroupInfo(conversationId, { groupName: tempName });
      setEditingName(false);
      Alert.alert('Success', 'Group name updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update group name');
    }
  };
  
  const handleSaveDescription = async () => {
    try {
      await updateGroupInfo(conversationId, { groupDescription: tempDescription });
      setEditingDescription(false);
      Alert.alert('Success', 'Description updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update description');
    }
  };
  
  const handleToggleMute = async (value) => {
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`userSettings.${currentUserId}.muted`]: value,
        [`userSettings.${currentUserId}.mutedUntil`]: value ? null : null
      });
      setMuteNotifications(value);
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };
  
  const handleToggleArchive = async (value) => {
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`userSettings.${currentUserId}.archived`]: value
      });
      setIsArchived(value);
      if (value) {
        Alert.alert('Archived', 'Group chat has been archived');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to archive chat');
    }
  };
  
  const handlePromoteMember = (userId, userName) => {
    Alert.alert(
      'Promote to Admin',
      `Make ${userName} a group admin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await promoteToAdmin(conversationId, currentUserId, userId);
              Alert.alert('Success', `${userName} is now an admin`);
            } catch (error) {
              Alert.alert('Error', 'Failed to promote member');
            }
          }
        }
      ]
    );
  };
  
  const handleDemoteMember = (userId, userName) => {
    Alert.alert(
      'Remove Admin',
      `Remove ${userName} from admin role?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await demoteAdmin(conversationId, currentUserId, userId);
              Alert.alert('Success', `${userName} is no longer an admin`);
            } catch (error) {
              Alert.alert('Error', 'Failed to demote admin');
            }
          }
        }
      ]
    );
  };
  
  const handleRemoveMember = (userId, userName) => {
    Alert.alert(
      'Remove Member',
      `Remove ${userName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGroupMember(conversationId, currentUserId, userId);
              Alert.alert('Success', 'Member removed from group');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          }
        }
      ]
    );
  };
  
  const handleExitGroup = () => {
    setShowExitModal(true);
  };
  
  const confirmExitGroup = async () => {
    try {
      await leaveGroup(conversationId, currentUserId);
      setShowExitModal(false);
      navigation.goBack();
      Alert.alert('Left Group', 'You have left the group');
    } catch (error) {
      Alert.alert('Error', 'Failed to leave group');
    }
  };
  
  const handleAddMembers = () => {
    navigation.navigate('AddGroupMembers', { conversationId });
  };

  const handleCustomNotificationsPress = () => {
    navigation.navigate('SearchInChat', { conversationId }); // Placeholder for now
  };

  const handleMediaPress = () => {
    navigation.navigate('MediaGallery', { conversationId });
  };

  const handleStarredPress = () => {
    navigation.navigate('StarredMessages', { conversationId });
  };

  const handleSearchPress = () => {
    navigation.navigate('SearchInChat', { conversationId });
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { clearChatHistory } = await import('../utils/userControls');
              await clearChatHistory(conversationId, currentUserId);
              Alert.alert('Success', 'Chat history cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear chat');
            }
          }
        }
      ]
    );
  };

  const handleExportChat = async () => {
    try {
      Alert.alert('Exporting...', 'Please wait while we prepare your chat export');
      const { exportChatHistory } = await import('../utils/userControls');
      const { Share } = await import('react-native');
      
      const chatText = await exportChatHistory(conversationId, groupData?.groupName || 'Group Chat');
      
      await Share.share({
        message: chatText,
        title: `${groupData?.groupName || 'Group'} Chat Export`
      });
    } catch (error) {
      console.error('Error exporting chat:', error);
      Alert.alert('Error', 'Failed to export chat');
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        
        {/* ========== GROUP 1: BASIC INFO ========== */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.groupIconContainer}
            onPress={handleChangeGroupIcon}
            disabled={!isAdmin}
          >
            {groupData?.groupIcon ? (
              <Image source={{ uri: groupData.groupIcon }} style={styles.groupIcon} />
            ) : (
              <View style={styles.groupIconPlaceholder}>
                <Ionicons name="people" size={48} color={TEXT_DIM} />
              </View>
            )}
            {isAdmin && (
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          {/* Group Name */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="text" size={20} color={TEXT_DIM} />
              <Text style={styles.labelText}>Group Name</Text>
            </View>
            {editingName && isAdmin ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={tempName}
                  onChangeText={setTempName}
                  maxLength={50}
                  autoFocus
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Ionicons name="close" size={24} color={DANGER} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveName}>
                    <Ionicons name="checkmark" size={24} color={CYAN} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.infoValue}
                onPress={() => isAdmin && setEditingName(true)}
                disabled={!isAdmin}
              >
                <Text style={styles.valueText}>{groupData?.groupName || 'Unnamed Group'}</Text>
                {isAdmin && <Ionicons name="pencil" size={16} color={TEXT_DIM} />}
              </TouchableOpacity>
            )}
          </View>
          
          {/* Group Description */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="information-circle" size={20} color={TEXT_DIM} />
              <Text style={styles.labelText}>Description</Text>
            </View>
            {editingDescription && isAdmin ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[styles.editInput, styles.multilineInput]}
                  value={tempDescription}
                  onChangeText={setTempDescription}
                  maxLength={200}
                  multiline
                  autoFocus
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity onPress={() => setEditingDescription(false)}>
                    <Ionicons name="close" size={24} color={DANGER} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveDescription}>
                    <Ionicons name="checkmark" size={24} color={CYAN} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.infoValue}
                onPress={() => isAdmin && setEditingDescription(true)}
                disabled={!isAdmin}
              >
                <Text style={[styles.valueText, !groupData?.groupDescription && styles.placeholderText]}>
                  {groupData?.groupDescription || 'Add description'}
                </Text>
                {isAdmin && <Ionicons name="pencil" size={16} color={TEXT_DIM} />}
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.sectionSubtext}>
            Created on {groupData?.createdAt?.toDate().toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        {/* ========== GROUP 2: MEMBERS ========== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {participants.length} Participants
            </Text>
            {isAdmin && (
              <TouchableOpacity onPress={handleAddMembers}>
                <Ionicons name="person-add" size={22} color={CYAN} />
              </TouchableOpacity>
            )}
          </View>
          
          {participants.map((participant) => (
            <TouchableOpacity
              key={participant.id}
              style={styles.memberItem}
              onLongPress={() => {
                if (!isAdmin || participant.id === currentUserId) return;
                
                Alert.alert(
                  participant.displayName || participant.username || 'User',
                  'Choose an action',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    participant.isAdmin
                      ? {
                          text: 'Remove Admin',
                          onPress: () => handleDemoteMember(
                            participant.id,
                            participant.displayName || participant.username
                          )
                        }
                      : {
                          text: 'Make Admin',
                          onPress: () => handlePromoteMember(
                            participant.id,
                            participant.displayName || participant.username
                          )
                        },
                    {
                      text: 'Remove from Group',
                      style: 'destructive',
                      onPress: () => handleRemoveMember(
                        participant.id,
                        participant.displayName || participant.username
                      )
                    }
                  ]
                );
              }}
            >
              <Image
                source={{ uri: participant.profileImage || participant.avatar }}
                style={styles.memberAvatar}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {participant.displayName || participant.username || 'User'}
                  {participant.id === currentUserId && ' (You)'}
                </Text>
                <Text style={styles.memberStatus}>
                  {participant.isAdmin ? '🛡️ Admin' : 'Member'}
                </Text>
              </View>
              {participant.isAdmin && (
                <Ionicons name="shield-checkmark" size={18} color={CYAN} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.divider} />
        
        {/* ========== GROUP 3: NOTIFICATION SETTINGS ========== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons 
                name={muteNotifications ? "notifications-off" : "notifications"} 
                size={22} 
                color={muteNotifications ? DANGER : TEXT_DIM} 
              />
              <Text style={styles.settingText}>Mute Notifications</Text>
            </View>
            <Switch
              value={muteNotifications}
              onValueChange={handleToggleMute}
              trackColor={{ false: '#3e3e3e', true: ACCENT }}
              thumbColor={muteNotifications ? CYAN : '#f4f3f4'}
            />
          </View>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleCustomNotificationsPress}>
            <View style={styles.settingLabel}>
              <MaterialCommunityIcons name="bell-badge" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Custom Notifications</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>
                {customNotifications === 'all' ? 'All Messages' : 
                 customNotifications === 'mentions' ? 'Mentions Only' : 'Off'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_DIM} />
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.divider} />
        
        {/* ========== GROUP 4: MEDIA & CHAT MANAGEMENT ========== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media & Storage</Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleMediaPress}>
            <View style={styles.settingLabel}>
              <Ionicons name="images" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Media, Links & Docs</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>156</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_DIM} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleStarredPress}>
            <View style={styles.settingLabel}>
              <Ionicons name="star" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Starred Messages</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_DIM} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleSearchPress}>
            <View style={styles.settingLabel}>
              <Ionicons name="search" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Search in Chat</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_DIM} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.divider} />
        
        {/* ========== GROUP 5: PRIVACY & ACTIONS ========== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons name="archive" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Archive Chat</Text>
            </View>
            <Switch
              value={isArchived}
              onValueChange={handleToggleArchive}
              trackColor={{ false: '#3e3e3e', true: ACCENT }}
              thumbColor={isArchived ? CYAN : '#f4f3f4'}
            />
          </View>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleClearChat}>
            <View style={styles.settingLabel}>
              <MaterialCommunityIcons name="broom" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Clear Chat</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_DIM} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleExportChat}>
            <View style={styles.settingLabel}>
              <Ionicons name="download-outline" size={22} color={TEXT_DIM} />
              <Text style={styles.settingText}>Export Chat</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_DIM} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.divider} />
        
        {/* ========== GROUP 6: DANGER ZONE ========== */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={handleExitGroup}
          >
            <Ionicons name="exit-outline" size={22} color={DANGER} />
            <Text style={styles.dangerText}>Exit Group</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dangerButton} onPress={() => setShowReportModal(true)}>
            <Ionicons name="flag" size={22} color={DANGER} />
            <Text style={styles.dangerText}>Report Group</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {/* Exit Group Confirmation Modal */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="exit-outline" size={48} color={DANGER} />
            <Text style={styles.modalTitle}>Exit Group?</Text>
            <Text style={styles.modalText}>
              You will no longer receive messages from this group
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowExitModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmExitGroup}
              >
                <Text style={styles.confirmButtonText}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Group Modal */}
      <ReportUserModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUser={{
          id: conversationId,
          username: groupData?.groupName || 'Group',
          name: groupData?.groupName || 'Group',
        }}
        reportType={REPORT_TYPES.COMMUNITY}
        contentId={conversationId}
        contentType="group"
        contentPreview={groupData?.groupName || groupData?.description || 'Group'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: BORDER
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  scrollView: {
    flex: 1
  },
  section: {
    padding: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  sectionSubtext: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 8
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 20
  },
  groupIconContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative'
  },
  groupIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: BORDER
  },
  groupIconPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: CARD,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG
  },
  infoRow: {
    marginBottom: 16
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  labelText: {
    color: TEXT_DIM,
    fontSize: 14,
    fontWeight: '500'
  },
  infoValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER
  },
  valueText: {
    color: '#fff',
    fontSize: 16,
    flex: 1
  },
  placeholderText: {
    color: TEXT_DIM,
    fontStyle: 'italic'
  },
  editContainer: {
    gap: 8
  },
  editInput: {
    backgroundColor: CARD,
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    fontSize: 16
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CARD
  },
  memberInfo: {
    flex: 1
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2
  },
  memberStatus: {
    color: TEXT_DIM,
    fontSize: 13
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  settingText: {
    color: '#fff',
    fontSize: 16
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  settingValueText: {
    color: TEXT_DIM,
    fontSize: 14
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14
  },
  dangerText: {
    color: DANGER,
    fontSize: 16,
    fontWeight: '500'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: BORDER
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8
  },
  modalText: {
    color: TEXT_DIM,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER
  },
  confirmButton: {
    backgroundColor: DANGER
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  }
});
