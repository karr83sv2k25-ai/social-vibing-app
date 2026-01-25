import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { app, db } from './firebaseConfig';
import * as CommunityService from './shared/services/communityService';

export default function ModeratorsManagementScreen({ route, navigation }) {
  const { communityId } = route.params;
  const [community, setCommunity] = useState(null);
  const [moderators, setModerators] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [communityId]);

  const loadData = async () => {
    try {
      const auth = getAuth(app);
      const currentUserId = auth.currentUser?.uid;

      if (!currentUserId) {
        Alert.alert('Error', 'Please login to continue');
        navigation.goBack();
        return;
      }

      // Get community data
      const communityDoc = await getDoc(doc(db, 'communities', communityId));
      if (!communityDoc.exists()) {
        Alert.alert('Error', 'Community not found');
        navigation.goBack();
        return;
      }

      const communityData = communityDoc.data();
      setCommunity(communityData);

      // Check if current user is creator
      const creator = communityData.creatorId === currentUserId;
      setIsCreator(creator);

      if (!creator) {
        Alert.alert('Error', 'Only community creator can manage moderators');
        navigation.goBack();
        return;
      }

      // Load moderators data
      const modIds = communityData.moderators || [];
      const modData = await Promise.all(
        modIds.map(async (userId) => {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            return { id: userId, ...userDoc.data() };
          }
          return null;
        })
      );
      setModerators(modData.filter(m => m !== null));

      // Load members for adding
      const memberIds = communityData.members || [];
      const memberData = await Promise.all(
        memberIds.map(async (userId) => {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            return { id: userId, ...userDoc.data() };
          }
          return null;
        })
      );
      setMembers(memberData.filter(m => m !== null && !modIds.includes(m.id)));

      setLoading(false);
    } catch (error) {
      console.error('Error loading moderators:', error);
      Alert.alert('Error', 'Failed to load moderators');
      setLoading(false);
    }
  };

  const handleAddModerator = async (userId) => {
    try {
      const auth = getAuth(app);
      const currentUserId = auth.currentUser?.uid;

      const result = await CommunityService.addModerator(
        db,
        communityId,
        currentUserId,
        userId
      );

      if (result.success) {
        Alert.alert('Success', 'Moderator added successfully');
        setShowAddModal(false);
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to add moderator');
      }
    } catch (error) {
      console.error('Error adding moderator:', error);
      Alert.alert('Error', 'Failed to add moderator');
    }
  };

  const handleRemoveModerator = (userId, userName) => {
    Alert.alert(
      'Remove Moderator',
      `Remove ${userName} from moderators?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const auth = getAuth(app);
              const currentUserId = auth.currentUser?.uid;

              const result = await CommunityService.removeModerator(
                db,
                communityId,
                currentUserId,
                userId
              );

              if (result.success) {
                Alert.alert('Success', 'Moderator removed successfully');
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to remove moderator');
              }
            } catch (error) {
              console.error('Error removing moderator:', error);
              Alert.alert('Error', 'Failed to remove moderator');
            }
          },
        },
      ]
    );
  };

  const renderModerator = ({ item }) => {
    const isCurrentCreator = item.id === community?.creatorId;
    const displayName = item.displayName || item.name || item.username || 'User';
    const avatar = item.profileImage || item.avatar || null;

    return (
      <View style={styles.moderatorItem}>
        <View style={styles.moderatorInfo}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#666" />
            </View>
          )}
          <View style={styles.moderatorText}>
            <Text style={styles.moderatorName}>{displayName}</Text>
            {isCurrentCreator && (
              <View style={styles.creatorBadge}>
                <MaterialIcons name="verified" size={14} color="#FFD700" />
                <Text style={styles.creatorBadgeText}>Creator</Text>
              </View>
            )}
          </View>
        </View>
        {!isCurrentCreator && isCreator && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveModerator(item.id, displayName)}
          >
            <Ionicons name="remove-circle" size={24} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMember = ({ item }) => {
    const displayName = item.displayName || item.name || item.username || 'User';
    const avatar = item.profileImage || item.avatar || null;

    return (
      <TouchableOpacity
        style={styles.memberItem}
        onPress={() => handleAddModerator(item.id)}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
        )}
        <Text style={styles.memberName}>{displayName}</Text>
        <Ionicons name="add-circle" size={24} color="#10B981" />
      </TouchableOpacity>
    );
  };

  const filteredMembers = members.filter(member => {
    const displayName = member.displayName || member.name || member.username || '';
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Moderators</Text>
        {isCreator && (
          <TouchableOpacity
            onPress={() => setShowAddModal(!showAddModal)}
            style={styles.addButton}
          >
            <Ionicons name={showAddModal ? "close" : "add"} size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Community Info */}
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{community?.name || 'Community'}</Text>
        <Text style={styles.moderatorCount}>
          {moderators.length} Moderator{moderators.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {showAddModal ? (
        // Add Moderator View
        <View style={styles.addView}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <FlatList
            data={filteredMembers}
            renderItem={renderMember}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No members available to add</Text>
            }
          />
        </View>
      ) : (
        // Current Moderators List
        <FlatList
          data={moderators}
          renderItem={renderModerator}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No moderators yet</Text>
          }
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <MaterialIcons name="admin-panel-settings" size={20} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Current Moderators</Text>
            </View>
          }
        />
      )}

      {/* Info Footer */}
      <View style={styles.infoFooter}>
        <Ionicons name="information-circle-outline" size={16} color="#666" />
        <Text style={styles.infoText}>
          Moderators can pin announcements, feature posts, and manage community content.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B10',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0B10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1A1F27',
    borderBottomWidth: 1,
    borderBottomColor: '#242A33',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    padding: 8,
  },
  communityInfo: {
    padding: 16,
    backgroundColor: '#1A1F27',
    borderBottomWidth: 1,
    borderBottomColor: '#242A33',
  },
  communityName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  moderatorCount: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  listContent: {
    paddingBottom: 80,
  },
  moderatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242A33',
  },
  moderatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#242A33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moderatorText: {
    flex: 1,
  },
  moderatorName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorBadgeText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  addView: {
    flex: 1,
  },
  searchInput: {
    backgroundColor: '#1A1F27',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    margin: 16,
    borderWidth: 1,
    borderColor: '#242A33',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242A33',
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 32,
  },
  infoFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1F27',
    borderTopWidth: 1,
    borderTopColor: '#242A33',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});
