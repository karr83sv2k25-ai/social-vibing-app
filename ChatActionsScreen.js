import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ReportUserModal from './components/ReportUserModal';
import { REPORT_TYPES } from './shared/services/reportService';

// Theme Colors
const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export default function ChatActionsScreen({ navigation, route }) {
  const [showReportModal, setShowReportModal] = useState(false);
  
  const { 
    chat,
    isPinned = false,
    isMuted = false,
    isArchived = false,
    onPin,
    onMute,
    onArchive,
    onDelete,
    onMarkUnread,
    onBlock,
  } = route.params || {};

  if (!chat) {
    navigation.goBack();
    return null;
  }

  const handleAction = (action, callback) => {
    navigation.goBack();
    setTimeout(() => {
      if (callback) callback();
    }, 100);
  };

  const handlePin = () => {
    handleAction('pin', () => {
      if (onPin) onPin(chat);
      Alert.alert(
        isPinned ? 'Unpinned' : 'Pinned',
        `${chat.name} has been ${isPinned ? 'unpinned' : 'pinned to top'}`
      );
    });
  };

  const handleMute = () => {
    if (isMuted) {
      handleAction('unmute', () => {
        if (onMute) onMute(chat);
        Alert.alert('Unmuted', `${chat.name} has been unmuted`);
      });
    } else {
      navigation.goBack();
      setTimeout(() => {
        Alert.alert(
          'Mute Notifications',
          'For how long?',
          [
            {
              text: '1 Hour',
              onPress: () => {
                if (onMute) onMute(chat, 1);
                Alert.alert('Muted', `${chat.name} muted for 1 hour`);
              }
            },
            {
              text: '8 Hours',
              onPress: () => {
                if (onMute) onMute(chat, 8);
                Alert.alert('Muted', `${chat.name} muted for 8 hours`);
              }
            },
            {
              text: '1 Week',
              onPress: () => {
                if (onMute) onMute(chat, 168);
                Alert.alert('Muted', `${chat.name} muted for 1 week`);
              }
            },
            {
              text: 'Always',
              onPress: () => {
                if (onMute) onMute(chat, -1);
                Alert.alert('Muted', `${chat.name} muted forever`);
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      }, 100);
    }
  };

  const handleArchive = () => {
    handleAction('archive', () => {
      if (onArchive) onArchive(chat);
      Alert.alert(
        isArchived ? 'Unarchived' : 'Archived',
        `${chat.name} has been ${isArchived ? 'unarchived' : 'archived'}`
      );
    });
  };

  const handleMarkUnread = () => {
    handleAction('unread', () => {
      if (onMarkUnread) onMarkUnread(chat);
      Alert.alert('Marked as Unread', `${chat.name} marked as unread`);
    });
  };

  const handleDelete = () => {
    navigation.goBack();
    setTimeout(() => {
      Alert.alert(
        'Delete Conversation',
        `Are you sure you want to delete your conversation with ${chat.name}? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (onDelete) onDelete(chat);
            }
          }
        ]
      );
    }, 100);
  };

  const handleBlock = () => {
    navigation.goBack();
    setTimeout(() => {
      Alert.alert(
        'Block User',
        `Are you sure you want to block ${chat.name}? They won't be able to message you.`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () => {
              if (onBlock) onBlock(chat);
              Alert.alert('Blocked', `${chat.name} has been blocked`);
            }
          }
        ]
      );
    }, 100);
  };

  const handleReport = () => {
    setShowReportModal(true);
  };

  const handleReportClose = () => {
    setShowReportModal(false);
  };

  const handleViewProfile = () => {
    navigation.goBack();
    setTimeout(() => {
      navigation.navigate('Profile', { userId: chat.userId });
    }, 100);
  };

  const handleExportChat = () => {
    navigation.goBack();
    setTimeout(() => {
      Alert.alert('Export Chat', `Export conversation with ${chat.name}?\n\nThis will create a text file of your chat history.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => Alert.alert('Success', 'Chat exported successfully') }
      ]);
    }, 100);
  };

  const handleSearchInChat = () => {
    navigation.goBack();
    setTimeout(() => {
      Alert.alert('Search in Chat', 'Search feature coming soon');
    }, 100);
  };

  const renderActionItem = (icon, title, subtitle, onPress, color = '#fff', iconBg = ACCENT + '22') => (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={24} color={color === 'destructive' ? '#EF4444' : CYAN} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, color === 'destructive' && styles.destructiveText]}>{title}</Text>
        {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={TEXT_DIM} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with Chat Info */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.chatInfo}>
          <Image
            source={chat.avatar || require('./assets/profile.png')}
            style={styles.avatar}
          />
          <View style={styles.chatDetails}>
            <Text style={styles.chatName}>{chat.name}</Text>
            <Text style={styles.chatHandle}>{chat.handle || '@user'}</Text>
          </View>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          
          {renderActionItem(
            isPinned ? 'pin' : 'pin-outline',
            isPinned ? 'Unpin Conversation' : 'Pin Conversation',
            isPinned ? 'Remove from top' : 'Keep at the top of your list',
            handlePin
          )}
          
          {renderActionItem(
            isMuted ? 'notifications' : 'notifications-off-outline',
            isMuted ? 'Unmute Notifications' : 'Mute Notifications',
            isMuted ? 'Turn notifications back on' : 'Stop receiving notifications',
            handleMute
          )}
          
          {renderActionItem(
            'mail-unread-outline',
            'Mark as Unread',
            'Mark this conversation as unread',
            handleMarkUnread
          )}
          
          {renderActionItem(
            isArchived ? 'archive' : 'archive-outline',
            isArchived ? 'Unarchive' : 'Archive Conversation',
            isArchived ? 'Move back to main list' : 'Hide from main list',
            handleArchive
          )}
        </View>

        {/* Chat Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHAT MANAGEMENT</Text>
          
          {renderActionItem(
            'search-outline',
            'Search in Chat',
            'Find messages in this conversation',
            handleSearchInChat
          )}
          
          {renderActionItem(
            'download-outline',
            'Export Chat',
            'Save chat history as text file',
            handleExportChat
          )}
          
          {!chat.isGroup && renderActionItem(
            'person-outline',
            'View Profile',
            'See user profile and details',
            handleViewProfile
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          
          {!chat.isGroup && renderActionItem(
            'flag-outline',
            'Report User',
            'Report this user for violations',
            handleReport,
            'destructive',
            '#F59E0B22'
          )}
          
          {!chat.isGroup && renderActionItem(
            'ban-outline',
            'Block User',
            'Block this user from messaging you',
            handleBlock,
            'destructive',
            '#EF444422'
          )}
          
          {renderActionItem(
            'trash-outline',
            'Delete Conversation',
            'Permanently delete all messages',
            handleDelete,
            'destructive',
            '#EF444422'
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Report Modal */}
      {!chat.isGroup && (
        <ReportUserModal
          visible={showReportModal}
          onClose={handleReportClose}
          reportedUser={{
            id: chat.userId,
            username: chat.username || chat.name,
            name: chat.name,
          }}
          reportType={REPORT_TYPES.USER}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: CYAN,
  },
  chatDetails: {
    marginLeft: 12,
  },
  chatName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  chatHandle: {
    fontSize: 14,
    color: TEXT_DIM,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DIM,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionSubtitle: {
    fontSize: 13,
    color: TEXT_DIM,
    marginTop: 2,
  },
  destructiveText: {
    color: '#EF4444',
  },
});
