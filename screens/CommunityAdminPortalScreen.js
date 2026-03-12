// screens/CommunityAdminPortalScreen.js
// Community Admin Portal – matches Figma design with categorized sections
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, deleteDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getCommunityPendingReportsCount } from '../shared/services/reportService';

// Section colors from Figma
const SECTION_COLORS = {
  general: '#D946EF',    // Magenta/Purple
  content: '#22C55E',    // Green
  members: '#EF4444',    // Red
  communityTitle: '#06B6D4', // Cyan
  management: '#F59E0B', // Orange/Yellow
};

export default function CommunityAdminPortalScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [communityData, setCommunityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  useEffect(() => {
    fetchCommunityData();
  }, [communityId]);

  const fetchCommunityData = async () => {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId || !communityId) {
        Alert.alert('Error', 'Not authenticated or missing community');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);

      if (!communitySnap.exists()) {
        Alert.alert('Error', 'Community not found');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      const data = communitySnap.data();

      // Check admin access
      const userDocRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const isPlatformAdmin = userData.role === 'admin' || userData.isAdmin === true;

      const userIsOwner =
        data.creatorId === currentUserId ||
        data.createdBy === currentUserId ||
        data.uid === currentUserId ||
        data.ownerId === currentUserId ||
        data.community_admin === currentUserId;

      const userIsAdmin =
        isPlatformAdmin ||
        userIsOwner ||
        (Array.isArray(data.adminIds) && data.adminIds.includes(currentUserId)) ||
        (Array.isArray(data.leaders) && data.leaders.includes(currentUserId));

      if (!userIsAdmin) {
        Alert.alert('Error', 'You do not have admin access');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      setIsOwner(userIsOwner || isPlatformAdmin);
      setIsAdmin(true);
      setCommunityData({ id: communitySnap.id, ...data });
      setLoading(false);

      // Fetch pending reports count in background
      getCommunityPendingReportsCount(communityId)
        .then(res => { if (res.success) setPendingReportsCount(res.count); })
        .catch(() => {});
    } catch (error) {
      console.warn('Error loading community:', error);
      Alert.alert('Error', 'Failed to load community data');
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    }
  };

  const handleDeleteCommunity = useCallback(() => {
    Alert.alert(
      'Delete Community',
      'Are you sure you want to permanently delete this community? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'communities', communityId));
              Alert.alert('Deleted', 'Community has been deleted.', [
                { text: 'OK', onPress: () => navigation.navigate('Community') },
              ]);
            } catch (err) {
              console.warn('Delete error:', err);
              Alert.alert('Error', 'Failed to delete community');
            }
          },
        },
      ]
    );
  }, [communityId, navigation]);

  const handleRenameCommunity = useCallback(async () => {
    const trimmed = newCommunityName.trim();
    if (!trimmed || trimmed.length < 2) {
      Alert.alert('Invalid Name', 'Community name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 60) {
      Alert.alert('Name Too Long', 'Community name cannot exceed 60 characters.');
      return;
    }
    setRenaming(true);
    try {
      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, {
        name: trimmed,
        community_title: trimmed,
        updatedAt: serverTimestamp(),
      });
      setCommunityData(prev => ({ ...prev, name: trimmed, community_title: trimmed }));
      setShowRenameModal(false);
      Alert.alert('Success', 'Community name has been updated.');
    } catch (err) {
      console.warn('Rename error:', err);
      Alert.alert('Error', 'Failed to rename community. Please try again.');
    } finally {
      setRenaming(false);
    }
  }, [communityId, newCommunityName]);

  const renderSectionHeader = (title, color) => (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <LinearGradient
        colors={[color + '25', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionHeaderGradient}
      >
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </LinearGradient>
    </View>
  );

  const renderMenuItem = (label, onPress, options = {}) => {
    const { color = '#D946EF', thumbnail = null } = options;
    return (
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.menuLabel, { color }]}>{label}</Text>
        <View style={styles.menuRight}>
          {thumbnail && (
            <Image source={{ uri: thumbnail }} style={styles.menuThumbnail} />
          )}
          <Ionicons name="caret-forward" size={16} color={color} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#D946EF" />
        <Text style={styles.loadingText}>Loading admin portal...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0b0e" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── GENERAL ── */}
        {renderSectionHeader('General', SECTION_COLORS.general)}

        {isOwner && renderMenuItem('Change Community Name', () => {
          setNewCommunityName(communityData?.name || communityData?.community_title || '');
          setShowRenameModal(true);
        }, { color: SECTION_COLORS.general })}

        {renderMenuItem('Community Info', () => {
          navigation.navigate('EditCommunity', { communityId, section: 'info' });
        }, { color: SECTION_COLORS.general })}

        {renderMenuItem('My Chat', () => {
          navigation.navigate('GroupInfo', { communityId, initialTab: 'chat' });
        }, { color: SECTION_COLORS.general })}

        {renderMenuItem('Public Chat rooms', () => {
          navigation.navigate('CommunityGroupChat', { communityId });
        }, { color: SECTION_COLORS.general })}

        {renderMenuItem('Push Notifications', () => {
          navigation.navigate('CommunityNotificationSettings', { communityId });
        }, { color: SECTION_COLORS.general })}

        {renderMenuItem('Data Center', () => {
          navigation.navigate('CommunityDataCenter', { communityId });
        }, { color: SECTION_COLORS.general })}

        {/* ── CONTENT ── */}
        {renderSectionHeader('Content', SECTION_COLORS.content)}

        {renderMenuItem('Cover Image', () => {
          navigation.navigate('CommunityAppearance', { communityId, section: 'cover' });
        }, {
          color: SECTION_COLORS.content,
          thumbnail: communityData?.coverImage || null,
        })}

        {renderMenuItem('Announcements', () => {
          navigation.navigate('GroupInfo', { communityId, openModal: 'announcements' });
        }, { color: SECTION_COLORS.content })}

        {renderMenuItem('Featured Posts', () => {
          navigation.navigate('GroupInfo', { communityId, openModal: 'featured' });
        }, { color: SECTION_COLORS.content })}

        {renderMenuItem('Community Rooms', () => {
          navigation.navigate('CommunityCreateGroup', { communityId });
        }, { color: SECTION_COLORS.content })}

        {renderMenuItem('Blocked Content', () => {
          navigation.navigate('CommunityBlockedContent', { communityId });
        }, { color: SECTION_COLORS.content })}

        {/* ── MEMBERS ── */}
        {renderSectionHeader('Members', SECTION_COLORS.members)}

        {renderMenuItem('Community Members', () => {
          navigation.navigate('GroupInfo', { communityId, initialTab: 'online' });
        }, { color: SECTION_COLORS.members })}

        {renderMenuItem('Community Titles', () => {
          navigation.navigate('CommunityTitles', { communityId });
        }, { color: SECTION_COLORS.members })}

        {/* ── COMMUNITY TITLE ── */}
        {renderSectionHeader('Community Title', SECTION_COLORS.communityTitle)}

        {renderMenuItem('Request To Join', () => {
          navigation.navigate('CommunityJoinRequests', { communityId });
        }, { color: SECTION_COLORS.communityTitle })}

        {renderMenuItem('Blocked Members', () => {
          navigation.navigate('CommunityBlockedMembers', { communityId });
        }, { color: SECTION_COLORS.communityTitle })}

        {/* ── MANAGEMENT TEAM ── */}
        {renderSectionHeader('Management Team', SECTION_COLORS.management)}

        {renderMenuItem('Manage Co Admin', () => {
          navigation.navigate('CommunityStaff', { communityId });
        }, { color: SECTION_COLORS.management })}

        {renderMenuItem('Transfer Admin', () => {
          Alert.alert(
            'Transfer Admin',
            'Are you sure you want to transfer admin ownership? This will give another user full control.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: () => {
                navigation.navigate('GroupInfo', { communityId, initialTab: 'online', transferAdmin: true });
              }},
            ]
          );
        }, { color: SECTION_COLORS.management })}

        {renderMenuItem('Management Operation', () => {
          navigation.navigate('CommunityModeration', { communityId });
        }, { color: SECTION_COLORS.management })}

        {renderMenuItem(
          pendingReportsCount > 0
            ? `Community Reports  (${pendingReportsCount} pending)`
            : 'Community Reports',
          () => navigation.navigate('CommunityModeration', { communityId, initialTab: 4 }),
          { color: pendingReportsCount > 0 ? '#EF4444' : SECTION_COLORS.management },
        )}

        {/* Delete Community Button */}
        <View style={styles.deleteContainer}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteCommunity}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteBtnText}>Delete this Community</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rename Community Modal */}
      <Modal visible={showRenameModal} transparent animationType="fade">
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Change Community Name</Text>
            <Text style={styles.renameSubtitle}>Enter a new name for your community</Text>
            <TextInput
              style={styles.renameInput}
              value={newCommunityName}
              onChangeText={setNewCommunityName}
              placeholder="Community name"
              placeholderTextColor="#666"
              maxLength={60}
              autoFocus
            />
            <Text style={styles.renameCharCount}>{newCommunityName.length}/60</Text>
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setShowRenameModal(false)}
                disabled={renaming}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameSaveBtn, renaming && { opacity: 0.6 }]}
                onPress={handleRenameCommunity}
                disabled={renaming}
              >
                {renaming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.renameSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 12,
    paddingHorizontal: 0,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 8,
    borderLeftWidth: 4,
    marginHorizontal: 0,
  },
  sectionHeaderGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  deleteContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#EF444415',
    width: '100%',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  // Rename Modal
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  renameCard: {
    backgroundColor: '#1a1c22',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  renameTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  renameSubtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: '#0a0b0e',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  renameCharCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  renameActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  renameCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2a2c32',
    alignItems: 'center',
  },
  renameCancelText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  renameSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D946EF',
    alignItems: 'center',
  },
  renameSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
