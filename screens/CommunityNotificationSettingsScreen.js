// screens/CommunityNotificationSettingsScreen.js
// Push notification settings for a community
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebaseConfig';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const NOTIFICATION_OPTIONS = [
  {
    key: 'newPosts',
    label: 'New Posts',
    description: 'Notify members when a new post is created',
    icon: 'newspaper-outline',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Notify members about important announcements',
    icon: 'megaphone-outline',
  },
  {
    key: 'newMembers',
    label: 'New Members',
    description: 'Notify admins when someone joins the community',
    icon: 'person-add-outline',
  },
  {
    key: 'chatMessages',
    label: 'Chat Messages',
    description: 'Notify members about new messages in community chat',
    icon: 'chatbubble-outline',
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Notify members about upcoming events',
    icon: 'calendar-outline',
  },
  {
    key: 'joinRequests',
    label: 'Join Requests',
    description: 'Notify admins when someone requests to join',
    icon: 'hand-left-outline',
  },
];

const DEFAULT_SETTINGS = {
  newPosts: true,
  announcements: true,
  newMembers: false,
  chatMessages: true,
  events: true,
  joinRequests: true,
};

export default function CommunityNotificationSettingsScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (communityId) {
      fetchSettings();
    }
  }, [communityId]);

  const fetchSettings = async () => {
    try {
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);

      if (communitySnap.exists()) {
        const data = communitySnap.data();
        const notifSettings = data.notificationSettings || {};
        const merged = { ...DEFAULT_SETTINGS, ...notifSettings };
        setSettings(merged);
        setOriginalSettings(merged);
      }
    } catch (error) {
      console.warn('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = useCallback((key) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      // Check if any setting differs from original
      const changed = Object.keys(updated).some(k => updated[k] !== originalSettings[k]);
      setHasChanges(changed);
      return updated;
    });
  }, [originalSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, {
        notificationSettings: settings,
        updatedAt: serverTimestamp(),
      });

      setOriginalSettings(settings);
      setHasChanges(false);
      Alert.alert('Saved', 'Notification settings have been updated.');
    } catch (err) {
      console.warn('Save notification settings error:', err);
      Alert.alert('Error', 'Failed to save notification settings.');
    } finally {
      setSaving(false);
    }
  }, [communityId, settings]);

  const handleToggleAll = useCallback((enabled) => {
    const updated = {};
    Object.keys(settings).forEach(key => { updated[key] = enabled; });
    setSettings(updated);
    const changed = Object.keys(updated).some(k => updated[k] !== originalSettings[k]);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const allEnabled = Object.values(settings).every(v => v);
  const allDisabled = Object.values(settings).every(v => !v);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#D946EF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0b0e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="notifications-outline" size={18} color="#F59E0B" />
          <Text style={styles.infoBannerText}>
            Configure which notifications are sent to community members.
          </Text>
        </View>

        {/* Quick Toggle All */}
        <View style={styles.quickToggleRow}>
          <TouchableOpacity
            style={[styles.quickToggleBtn, allEnabled && styles.quickToggleBtnActive]}
            onPress={() => handleToggleAll(true)}
          >
            <Ionicons name="notifications" size={16} color={allEnabled ? '#fff' : '#888'} />
            <Text style={[styles.quickToggleText, allEnabled && { color: '#fff' }]}>Enable All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickToggleBtn, allDisabled && styles.quickToggleBtnMute]}
            onPress={() => handleToggleAll(false)}
          >
            <Ionicons name="notifications-off" size={16} color={allDisabled ? '#fff' : '#888'} />
            <Text style={[styles.quickToggleText, allDisabled && { color: '#fff' }]}>Mute All</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Options */}
        {NOTIFICATION_OPTIONS.map((option) => (
          <View key={option.key} style={styles.optionCard}>
            <View style={styles.optionLeft}>
              <View style={styles.optionIconBox}>
                <Ionicons name={option.icon} size={20} color="#D946EF" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDesc}>{option.description}</Text>
              </View>
            </View>
            <Switch
              value={settings[option.key]}
              onValueChange={() => handleToggle(option.key)}
              trackColor={{ false: '#2a2c32', true: '#D946EF80' }}
              thumbColor={settings[option.key] ? '#D946EF' : '#666'}
              ios_backgroundColor="#2a2c32"
            />
          </View>
        ))}

        <View style={{ height: 20 }} />

        {/* Save Button */}
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0e',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B10',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  infoBannerText: {
    color: '#F59E0B',
    fontSize: 12,
    flex: 1,
  },
  quickToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  quickToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1c22',
    gap: 6,
  },
  quickToggleBtnActive: {
    backgroundColor: '#D946EF',
  },
  quickToggleBtnMute: {
    backgroundColor: '#EF4444',
  },
  quickToggleText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#D946EF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  optionDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  saveBtn: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#D946EF',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
