import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

const C = {
  bg: '#0B0B10',
  card: '#14171C',
  card2: '#1A1F27',
  border: '#242A33',
  text: '#EAEAF0',
  dim: '#A2A8B3',
  cyan: '#08FFE2',
  brand: '#BF2EF0',
  danger: '#FF1010',
};

const AccountSettingsScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    // Privacy Settings
    profileVisibility: 'public', // public, friends, private
    showEmail: false,
    showPhone: false,
    allowMessages: 'everyone', // everyone, friends, nobody
    allowTagging: true,
    
    // Notification Settings
    pushNotifications: true,
    emailNotifications: true,
    postLikes: true,
    postComments: true,
    newFollowers: true,
    messages: true,
    communityUpdates: true,
    marketplaceOrders: true,
    
    // Content Settings
    showMatureContent: false,
    autoplayVideos: true,
    dataUsage: 'standard', // low, standard, high
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (!currentUser) return;
      
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().accountSettings) {
        setSettings({ ...settings, ...userSnap.data().accountSettings });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Silently fail - use default settings
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updatedSettings) => {
    try {
      setSaving(true);
      if (!currentUser) return;
      
      const userRef = doc(db, 'users', currentUser.uid);
      // Store settings in the user's document under accountSettings field
      await setDoc(userRef, { accountSettings: updatedSettings }, { merge: true });
      
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const SettingRow = ({ title, subtitle, rightComponent }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightComponent}
    </View>
  );

  const SettingSwitch = ({ settingKey, title, subtitle }) => (
    <SettingRow
      title={title}
      subtitle={subtitle}
      rightComponent={
        <Switch
          value={settings[settingKey]}
          onValueChange={() => toggleSetting(settingKey)}
          trackColor={{ false: C.border, true: C.brand }}
          thumbColor={settings[settingKey] ? C.cyan : C.dim}
        />
      }
    />
  );

  const SettingButton = ({ title, subtitle, onPress, icon, danger }) => (
    <TouchableOpacity
      style={styles.settingButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, danger && { color: C.danger }]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons
        name={icon || 'chevron-forward'}
        size={24}
        color={danger ? C.danger : C.dim}
      />
    </TouchableOpacity>
  );

  const showPrivacyOptions = () => {
    Alert.alert(
      'Profile Visibility',
      'Choose who can see your profile',
      [
        { text: 'Public', onPress: () => updateSetting('profileVisibility', 'public') },
        { text: 'Friends Only', onPress: () => updateSetting('profileVisibility', 'friends') },
        { text: 'Private', onPress: () => updateSetting('profileVisibility', 'private') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const showMessageOptions = () => {
    Alert.alert(
      'Who can message you?',
      'Choose who can send you messages',
      [
        { text: 'Everyone', onPress: () => updateSetting('allowMessages', 'everyone') },
        { text: 'Friends Only', onPress: () => updateSetting('allowMessages', 'friends') },
        { text: 'Nobody', onPress: () => updateSetting('allowMessages', 'nobody') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const showDataUsageOptions = () => {
    Alert.alert(
      'Data Usage',
      'Choose data usage preference',
      [
        { text: 'Low (Save Data)', onPress: () => updateSetting('dataUsage', 'low') },
        { text: 'Standard', onPress: () => updateSetting('dataUsage', 'standard') },
        { text: 'High (Best Quality)', onPress: () => updateSetting('dataUsage', 'high') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleDeactivateAccount = () => {
    Alert.alert(
      'Deactivate Account',
      'Are you sure you want to deactivate your account? You can reactivate it by logging in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Account deactivation will be available soon.');
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Confirmation Required', 'Please contact support to delete your account for security reasons.');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            <SettingButton
              title="Edit Profile"
              subtitle="Update your profile information"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <View style={styles.divider} />
            <SettingButton
              title="Change Password"
              subtitle="Update your password"
              onPress={handleChangePassword}
            />
            <View style={styles.divider} />
            <SettingButton
              title="Blocked Users"
              subtitle="Manage blocked accounts"
              onPress={() => navigation.navigate('BlockedUsers')}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.sectionCard}>
            <SettingButton
              title="Profile Visibility"
              subtitle={settings.profileVisibility.charAt(0).toUpperCase() + settings.profileVisibility.slice(1)}
              onPress={showPrivacyOptions}
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="showEmail"
              title="Show Email"
              subtitle="Display email on your profile"
            />
            <View style={styles.divider} />
            <SettingButton
              title="Who can message you"
              subtitle={settings.allowMessages === 'everyone' ? 'Everyone' : settings.allowMessages === 'friends' ? 'Friends Only' : 'Nobody'}
              onPress={showMessageOptions}
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="allowTagging"
              title="Allow Tagging"
              subtitle="Let others tag you in posts"
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionCard}>
            <SettingSwitch
              settingKey="pushNotifications"
              title="Push Notifications"
              subtitle="Receive push notifications"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="emailNotifications"
              title="Email Notifications"
              subtitle="Receive email updates"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="postLikes"
              title="Post Likes"
              subtitle="When someone likes your post"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="postComments"
              title="Post Comments"
              subtitle="When someone comments on your post"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="newFollowers"
              title="New Followers"
              subtitle="When someone follows you"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="messages"
              title="Messages"
              subtitle="When you receive a message"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="communityUpdates"
              title="Community Updates"
              subtitle="Updates from communities you joined"
            />
            <View style={styles.divider} />
            <SettingSwitch
              settingKey="marketplaceOrders"
              title="Marketplace Orders"
              subtitle="Order updates and notifications"
            />
          </View>
        </View>

        {/* Content Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content</Text>
          <View style={styles.sectionCard}>
            <SettingSwitch
              settingKey="autoplayVideos"
              title="Autoplay Videos"
              subtitle="Automatically play videos"
            />
            <View style={styles.divider} />
            <SettingButton
              title="Data Usage"
              subtitle={settings.dataUsage.charAt(0).toUpperCase() + settings.dataUsage.slice(1)}
              onPress={showDataUsageOptions}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.danger }]}>Danger Zone</Text>
          <View style={styles.sectionCard}>
            <SettingButton
              title="Deactivate Account"
              subtitle="Temporarily deactivate your account"
              onPress={handleDeactivateAccount}
              danger
            />
            <View style={styles.divider} />
            <SettingButton
              title="Delete Account"
              subtitle="Permanently delete your account"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="small" color={C.brand} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  settingSubtitle: {
    fontSize: 14,
    color: C.dim,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 16,
  },
  savingOverlay: {
    position: 'absolute',
    top: 90,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  savingText: {
    color: C.text,
    marginLeft: 8,
    fontSize: 14,
  },
});

export default AccountSettingsScreen;
