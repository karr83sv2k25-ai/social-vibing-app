import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Switch,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { clearMessageCache } from './utils/messageCache';

// Theme Colors
const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export default function MessageOptionsScreen({ navigation, route }) {
  const { archivedCount = 0 } = route.params || {};
  const currentUser = auth.currentUser;
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [messagePreview, setMessagePreview] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [storageSize, setStorageSize] = useState({ messages: 0, media: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    calculateStorageSize();
  }, []);

  const loadSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('notifications_enabled');
      const preview = await AsyncStorage.getItem('message_preview');
      const autoDownloadMedia = await AsyncStorage.getItem('auto_download_media');
      
      if (notifications !== null) setNotificationsEnabled(JSON.parse(notifications));
      if (preview !== null) setMessagePreview(JSON.parse(preview));
      if (autoDownloadMedia !== null) setAutoDownload(JSON.parse(autoDownloadMedia));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const calculateStorageSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let messageSize = 0;
      
      for (const key of keys) {
        if (key.startsWith('cached_')) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            messageSize += data.length;
          }
        }
      }
      
      // Convert to MB
      const messageMB = (messageSize / (1024 * 1024)).toFixed(2);
      
      setStorageSize({
        messages: messageMB,
        media: 0, // Media is stored remotely, not locally
      });
    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  const handleViewArchived = () => {
    navigation.navigate('Message', { showArchived: true });
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Get all conversations where user is a participant
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      
      // Update unread count for all conversations
      const updatePromises = snapshot.docs.map(docSnap => {
        const conversationRef = doc(db, 'conversations', docSnap.id);
        return updateDoc(conversationRef, {
          [`unreadCount.${currentUser.uid}`]: 0
        });
      });
      
      await Promise.all(updatePromises);
      
      Alert.alert('Success', 'All conversations marked as read', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all as read');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      `This will clear ${storageSize.messages} MB of cached messages. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearMessageCache();
              await calculateStorageSize();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };



  const handleNotificationsToggle = (value) => {
    setNotificationsEnabled(value);
    saveSettings('notifications_enabled', value);
  };

  const handleMessagePreviewToggle = (value) => {
    setMessagePreview(value);
    saveSettings('message_preview', value);
  };

  const handleAutoDownloadToggle = (value) => {
    setAutoDownload(value);
    saveSettings('auto_download_media', value);
  };

  const handleStorageUsage = () => {
    Alert.alert(
      'Storage Usage',
      `Messages: ${storageSize.messages} MB\nMedia: Stored on server\n\nLocal cache only includes message text and metadata.`,
      [
        { text: 'Clear Cache', onPress: handleClearCache, style: 'destructive' },
        { text: 'OK' }
      ]
    );
  };

  const handlePrivacySettings = () => {
    Alert.alert(
      'Privacy Settings',
      'Control your messaging privacy',
      [
        { text: 'Everyone can message me', onPress: () => savePrivacySetting('everyone') },
        { text: 'Only friends can message me', onPress: () => savePrivacySetting('friends') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const savePrivacySetting = async (setting) => {
    try {
      await AsyncStorage.setItem('privacy_messages', setting);
      Alert.alert('Saved', `Privacy set to: ${setting}`);
    } catch (error) {
      console.error('Error saving privacy setting:', error);
    }
  };

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'How can we help you?',
      [
        { 
          text: 'Email Support', 
          onPress: () => Linking.openURL('mailto:support@socialvibing.com?subject=Help with Messages')
        },
        { 
          text: 'Report Bug', 
          onPress: () => Linking.openURL('mailto:support@socialvibing.com?subject=Bug Report - Messages')
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'Social Vibing',
      'Messaging System v1.0.0\n\n' +
      '© 2025 Social Vibing\n' +
      'Connect with friends and communities\n\n' +
      'Features:\n' +
      '• Real-time messaging\n' +
      '• Group chats\n' +
      '• Media sharing\n' +
      '• End-to-end encryption',
      [
        { text: 'Visit Website', onPress: () => Linking.openURL('https://socialvibing.com') },
        { text: 'OK' }
      ]
    );
  };

  const renderOption = (icon, title, subtitle, onPress, showArrow = true, rightComponent = null) => (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <View style={styles.optionLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={CYAN} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{title}</Text>
          {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (showArrow && (
        <Ionicons name="chevron-forward" size={20} color={TEXT_DIM} />
      ))}
    </TouchableOpacity>
  );

  const renderToggleOption = (icon, title, subtitle, value, onValueChange) => (
    <View style={styles.optionItem}>
      <View style={styles.optionLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={CYAN} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{title}</Text>
          {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#3A3A3A', true: ACCENT }}
        thumbColor={value ? CYAN : '#f4f3f4'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Message Options</Text>
        <View style={{ width: 40 }}>
          {loading && (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: CYAN, fontSize: 10 }}>...</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          
          {renderOption(
            'archive-outline',
            'View Archived',
            `${archivedCount} archived conversations`,
            handleViewArchived
          )}
          
          {renderOption(
            'checkmark-done-outline',
            'Mark All as Read',
            'Mark all messages as read',
            handleMarkAllRead
          )}
          
          {renderOption(
            'trash-outline',
            'Clear Cache',
            'Free up storage space',
            handleClearCache
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          
          {renderToggleOption(
            'notifications-outline',
            'Enable Notifications',
            'Receive message notifications',
            notificationsEnabled,
            handleNotificationsToggle
          )}
          
          {renderToggleOption(
            'eye-outline',
            'Message Preview',
            'Show message content in notifications',
            messagePreview,
            handleMessagePreviewToggle
          )}
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STORAGE</Text>
          
          {renderToggleOption(
            'cloud-download-outline',
            'Auto-download Media',
            'Automatically download images and videos',
            autoDownload,
            handleAutoDownloadToggle
          )}
          
          {renderOption(
            'folder-outline',
            'Storage Usage',
            `Messages: ${storageSize.messages} MB`,
            handleStorageUsage
          )}
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACY</Text>
          
          {renderOption(
            'lock-closed-outline',
            'Blocked Users',
            'Manage blocked contacts',
            () => navigation.navigate('BlockedUsers')
          )}
          
          {renderOption(
            'shield-checkmark-outline',
            'Privacy Settings',
            'Control who can message you',
            handlePrivacySettings
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          
          {renderOption(
            'help-circle-outline',
            'Help & Support',
            'Get help with messages',
            handleHelpSupport
          )}
          
          {renderOption(
            'information-circle-outline',
            'About',
            'Version 1.0.0',
            handleAbout
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
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
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: TEXT_DIM,
  },
});
