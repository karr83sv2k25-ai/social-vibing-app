// screens/CommunityBlockedMembersScreen.js
// Manage blocked members for a community
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getDocWithRetry } from '../utils/firestoreHelpers';

export default function CommunityBlockedMembersScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [blockedMembers, setBlockedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (communityId) {
      fetchBlockedMembers();
    }
  }, [communityId]);

  const fetchBlockedMembers = useCallback(async () => {
    try {
      // Check blocked_members collection for this community
      const q = query(
        collection(db, 'blocked_members'),
        where('communityId', '==', communityId)
      );
      const snapshot = await getDocs(q);

      const membersData = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let userData = {};
        try {
          const userDoc = await getDocWithRetry(doc(db, 'users', data.userId));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
        } catch (e) {
          console.warn('Failed to fetch blocked user info:', e);
        }

        membersData.push({
          id: docSnap.id,
          ...data,
          userName: userData.displayName || userData.username || 'Unknown User',
          userAvatar: userData.profileImageUrl || userData.avatarUrl || null,
          blockedAt: data.blockedAt?.toDate?.() || new Date(),
          reason: data.reason || 'No reason provided',
          blockedByName: data.blockedByName || 'Admin',
        });
      }

      // Also check community doc for blocked arrays (legacy format)
      try {
        const communityDoc = await getDoc(doc(db, 'communities', communityId));
        if (communityDoc.exists()) {
          const communityData = communityDoc.data();
          const blockedArray = communityData.blockedUsers || communityData.blockedMembers || [];
          
          for (const userId of blockedArray) {
            // Skip if already in blocked_members collection
            if (membersData.some(m => m.userId === userId)) continue;
            
            let userData = {};
            try {
              const userDoc = await getDocWithRetry(doc(db, 'users', userId));
              if (userDoc.exists()) {
                userData = userDoc.data();
              }
            } catch (e) {
              console.warn('Failed to fetch legacy blocked user:', e);
            }

            membersData.push({
              id: `legacy_${userId}`,
              userId,
              communityId,
              userName: userData.displayName || userData.username || 'Unknown User',
              userAvatar: userData.profileImageUrl || userData.avatarUrl || null,
              blockedAt: new Date(),
              reason: 'Blocked (legacy)',
              blockedByName: 'Admin',
              isLegacy: true,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to check legacy blocked users:', e);
      }

      membersData.sort((a, b) => b.blockedAt - a.blockedAt);
      setBlockedMembers(membersData);
    } catch (error) {
      console.warn('Error fetching blocked members:', error);
      Alert.alert('Error', 'Failed to load blocked members.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId]);

  const handleUnblock = useCallback(async (member) => {
    Alert.alert(
      'Unblock Member',
      `Are you sure you want to unblock ${member.userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setProcessingId(member.id);
            try {
              if (member.isLegacy) {
                // Remove from community doc's blocked array
                const communityRef = doc(db, 'communities', communityId);
                const communityDoc = await getDoc(communityRef);
                if (communityDoc.exists()) {
                  const data = communityDoc.data();
                  const blockedArray = data.blockedUsers || data.blockedMembers || [];
                  const updated = blockedArray.filter(uid => uid !== member.userId);
                  const { updateDoc } = await import('firebase/firestore');
                  await updateDoc(communityRef, {
                    blockedUsers: updated,
                    blockedMembers: updated,
                  });
                }
              } else {
                // Remove from blocked_members collection
                await deleteDoc(doc(db, 'blocked_members', member.id));
              }

              setBlockedMembers(prev => prev.filter(m => m.id !== member.id));
              Alert.alert('Unblocked', `${member.userName} has been unblocked.`);
            } catch (err) {
              console.warn('Unblock error:', err);
              Alert.alert('Error', 'Failed to unblock member.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, [communityId]);

  const formatDate = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const renderMember = useCallback(({ item }) => {
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberRow}>
          {item.userAvatar ? (
            <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color="#666" />
            </View>
          )}
          <View style={styles.memberInfo}>
            <Text style={styles.memberName} numberOfLines={1}>{item.userName}</Text>
            <Text style={styles.memberReason} numberOfLines={1}>{item.reason}</Text>
            <Text style={styles.memberDate}>Blocked {formatDate(item.blockedAt)}</Text>
          </View>

          {isProcessing ? (
            <ActivityIndicator size="small" color="#D946EF" />
          ) : (
            <TouchableOpacity
              style={styles.unblockBtn}
              onPress={() => handleUnblock(item)}
            >
              <Text style={styles.unblockBtnText}>Unblock</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [processingId, handleUnblock]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#D946EF" />
        <Text style={styles.loadingText}>Loading blocked members...</Text>
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
        <Text style={styles.headerTitle}>Blocked Members</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#06B6D4" />
        <Text style={styles.infoBannerText}>
          Blocked members cannot view or interact with this community.
        </Text>
      </View>

      <FlatList
        data={blockedMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchBlockedMembers(); }}
            tintColor="#D946EF"
            colors={['#D946EF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#333" />
            <Text style={styles.emptyTitle}>No blocked members</Text>
            <Text style={styles.emptySubtitle}>Members you block will appear here</Text>
          </View>
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06B6D410',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  infoBannerText: {
    color: '#06B6D4',
    fontSize: 12,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  memberCard: {
    backgroundColor: '#1a1c22',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: '#2a2c32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  memberReason: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  memberDate: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#D946EF20',
    borderWidth: 1,
    borderColor: '#D946EF50',
  },
  unblockBtnText: {
    color: '#D946EF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#444',
    fontSize: 13,
    marginTop: 4,
  },
});
