// screens/ChatSettingsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import {
  muteConversation,
  unmuteConversation,
  archiveConversation,
  blockUser,
  clearChatHistory,
  setNotificationPreference
} from '../utils/userControls';
import {
  leaveGroup,
  removeGroupMember,
  promoteToAdmin,
  demoteAdmin
} from '../utils/groupChatHelpers';

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';
const DANGER = '#EF4444';

export default function ChatSettingsScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const currentUserId = auth.currentUser?.uid;
  
  const [conversation, setConversation] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [notificationPref, setNotificationPref] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [participants, setParticipants] = useState([]);
  
  useEffect(() => {
    if (!conversationId) return;
    
    const conversationRef = doc(db, 'conversations', conversationId);
    const unsubscribe = onSnapshot(conversationRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setConversation(data);
        
        // Check mute status
        const muteUntil = data.settings?.[currentUserId]?.muteUntil;
        if (muteUntil) {
          setIsMuted(muteUntil > Date.now());
        }
        
        // Get notification preference
        const pref = data.settings?.[currentUserId]?.notifications || 'all';
        setNotificationPref(pref);
        
        // Check if current user is admin
        if (data.type === 'group') {
          setIsAdmin(data.admins?.includes(currentUserId));
          
          // Load participant details
          const participantIds = data.participants || [];
          const participantPromises = participantIds.map(async (userId) => {
            const userDoc = await getDoc(doc(db, 'users', userId));
            return userDoc.exists() ? { id: userId, ...userDoc.data() } : null;
          });
          
          const participantData = await Promise.all(participantPromises);
          setParticipants(participantData.filter(Boolean));
        }
      }
    });
    
    return () => unsubscribe();
  }, [conversationId, currentUserId]);
  
  const handleMuteToggle = async () => {
    try {
      if (isMuted) {
        await unmuteConversation(conversationId, currentUserId);
        setIsMuted(false);
      } else {
        Alert.alert(
          'Mute conversation',
          'Mute notifications for:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: '1 hour',
              onPress: async () => {
                await muteConversation(conversationId, currentUserId, 60);
                setIsMuted(true);
              }
            },
            {
              text: '8 hours',
              onPress: async () => {
                await muteConversation(conversationId, currentUserId, 480);
                setIsMuted(true);
              }
            },
            {
              text: 'Always',
              onPress: async () => {
                await muteConversation(conversationId, currentUserId);
                setIsMuted(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
      Alert.alert('Error', 'Failed to update mute setting');
    }
  };
  
  const handleNotificationChange = async (value) => {
    try {
      await setNotificationPreference(conversationId, currentUserId, value);
      setNotificationPref(value);
    } catch (error) {
      console.error('Error changing notification:', error);
    }
  };
  
  const handleArchive = async () => {
    try {
      await archiveConversation(conversationId, currentUserId);
      Alert.alert('Archived', 'Conversation has been archived');
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    } catch (error) {
      console.error('Error archiving:', error);
      Alert.alert('Error', 'Failed to archive conversation');
    }
  };
  
  const handleClearChat = async () => {
    Alert.alert(
      'Clear chat history?',
      'This will clear all messages for you only',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearChatHistory(conversationId, currentUserId);
              Alert.alert('Cleared', 'Chat history has been cleared');
            } catch (error) {
              console.error('Error clearing chat:', error);
              Alert.alert('Error', 'Failed to clear chat');
            }
          }
        }
      ]
    );
  };
  
  const handleLeaveGroup = async () => {
    Alert.alert(
      'Leave group?',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(conversationId, currentUserId);
              Alert.alert('Left', 'You have left the group');
              navigation.navigate('Messages');
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group');
            }
          }
        }
      ]
    );
  };
  
  const handleRemoveMember = async (userId) => {
    Alert.alert(
      'Remove member?',
      'This will remove the member from the group',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGroupMember(conversationId, userId, currentUserId);
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          }
        }
      ]
    );
  };
  
  const handlePromoteToAdmin = async (userId) => {
    try {
      await promoteToAdmin(conversationId, userId, currentUserId);
    } catch (error) {
      console.error('Error promoting member:', error);
      Alert.alert('Error', 'Failed to promote member');
    }
  };
  
  const handleDemoteAdmin = async (userId) => {
    try {
      await demoteAdmin(conversationId, userId, currentUserId);
    } catch (error) {
      console.error('Error demoting admin:', error);
      Alert.alert('Error', 'Failed to demote admin');
    }
  };
  
  const handleBlock = async (userId) => {
    Alert.alert(
      'Block user?',
      'Blocked users cannot send you messages',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(currentUserId, userId);
              Alert.alert('Blocked', 'User has been blocked');
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  };
  
  if (!conversation) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  const isGroup = conversation.type === 'group';
  
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      
      {/* Group info */}
      {isGroup && (
        <View style={styles.section}>
          <View style={styles.groupHeader}>
            {conversation.groupIcon ? (
              <Image source={{ uri: conversation.groupIcon }} style={styles.groupIcon} />
            ) : (
              <View style={styles.groupIconPlaceholder}>
                <Ionicons name="people" size={32} color="#666" />
              </View>
            )}
            <Text style={styles.groupName}>{conversation.groupName}</Text>
            <Text style={styles.memberCount}>
              {participants.length} {participants.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      )}
      
      {/* Notification settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-off" size={20} color="#fff" />
            <Text style={styles.settingLabel}>Mute notifications</Text>
          </View>
          <Switch
            value={isMuted}
            onValueChange={handleMuteToggle}
            trackColor={{ true: ACCENT, false: '#333' }}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="radio-button-on" size={20} color="#fff" />
            <Text style={styles.settingLabel}>Notification type</Text>
          </View>
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={() => {
              Alert.alert(
                'Notification preference',
                'Choose notification type:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'All messages',
                    onPress: () => handleNotificationChange('all')
                  },
                  {
                    text: 'Mentions only',
                    onPress: () => handleNotificationChange('mentions')
                  },
                  {
                    text: 'Off',
                    onPress: () => handleNotificationChange('off')
                  }
                ]
              );
            }}
          >
            <Text style={styles.selectButtonText}>
              {notificationPref === 'all' ? 'All messages' : 
               notificationPref === 'mentions' ? 'Mentions only' : 'Off'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Group members (admins only) */}
      {isGroup && isAdmin && participants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {participants.map((participant) => (
            <View key={participant.id} style={styles.participantRow}>
              <Image 
                source={{ uri: participant.profileImage || 'https://via.placeholder.com/40' }}
                style={styles.participantAvatar}
              />
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{participant.name}</Text>
                {conversation.admins?.includes(participant.id) && (
                  <Text style={styles.adminBadge}>Admin</Text>
                )}
              </View>
              
              {participant.id !== currentUserId && (
                <View style={styles.memberActions}>
                  {conversation.admins?.includes(participant.id) ? (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDemoteAdmin(participant.id)}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color={ACCENT} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handlePromoteToAdmin(participant.id)}
                    >
                      <Ionicons name="star-outline" size={20} color={ACCENT} />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleRemoveMember(participant.id)}
                  >
                    <Ionicons name="person-remove-outline" size={20} color={DANGER} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      
      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.actionRow} onPress={handleArchive}>
          <Ionicons name="archive-outline" size={20} color="#fff" />
          <Text style={styles.actionText}>Archive conversation</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionRow} onPress={handleClearChat}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.actionText}>Clear chat history</Text>
        </TouchableOpacity>
        
        {isGroup && (
          <TouchableOpacity style={styles.actionRow} onPress={handleLeaveGroup}>
            <Ionicons name="exit-outline" size={20} color={DANGER} />
            <Text style={[styles.actionText, { color: DANGER }]}>Leave group</Text>
          </TouchableOpacity>
        )}
        
        {!isGroup && conversation.participants && (
          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => {
              const otherUserId = conversation.participants.find(id => id !== currentUserId);
              handleBlock(otherUserId);
            }}
          >
            <Ionicons name="ban-outline" size={20} color={DANGER} />
            <Text style={[styles.actionText, { color: DANGER }]}>Block user</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 50
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 12
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600'
  },
  section: {
    backgroundColor: CARD,
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333'
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16
  },
  groupHeader: {
    alignItems: 'center',
    paddingVertical: 12
  },
  groupIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12
  },
  groupIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  groupName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4
  },
  memberCount: {
    color: '#999',
    fontSize: 14
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  selectButtonText: {
    color: ACCENT,
    fontSize: 14
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  participantInfo: {
    flex: 1
  },
  participantName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
  },
  adminBadge: {
    color: ACCENT,
    fontSize: 12,
    marginTop: 2
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8
  },
  iconButton: {
    padding: 8
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12
  },
  actionText: {
    color: '#fff',
    fontSize: 16
  }
});
