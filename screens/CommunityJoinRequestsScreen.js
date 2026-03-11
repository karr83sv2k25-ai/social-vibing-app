// screens/CommunityJoinRequestsScreen.js
// Manage join requests for private communities
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
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { getDocWithRetry } from '../utils/firestoreHelpers';

const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#22C55E',
  rejected: '#EF4444',
};

export default function CommunityJoinRequestsScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending | approved | rejected | all

  useEffect(() => {
    if (communityId) {
      fetchRequests();
    }
  }, [communityId, filter]);

  const fetchRequests = useCallback(async () => {
    try {
      const constraints = [
        where('communityId', '==', communityId),
      ];

      if (filter !== 'all') {
        constraints.push(where('status', '==', filter));
      }

      const q = query(collection(db, 'join_requests'), ...constraints);
      const snapshot = await getDocs(q);

      const requestsData = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        // Fetch user info
        let userData = {};
        try {
          const userDoc = await getDocWithRetry(doc(db, 'users', data.userId));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
        } catch (e) {
          console.warn('Failed to fetch user for request:', e);
        }

        requestsData.push({
          id: docSnap.id,
          ...data,
          userName: userData.displayName || userData.username || 'Unknown User',
          userAvatar: userData.profileImageUrl || userData.avatarUrl || null,
          userBio: userData.bio || '',
          createdAt: data.createdAt?.toDate?.() || data.requestedAt?.toDate?.() || new Date(),
        });
      }

      // Sort by most recent first
      requestsData.sort((a, b) => b.createdAt - a.createdAt);
      setRequests(requestsData);
    } catch (error) {
      console.warn('Error fetching join requests:', error);
      Alert.alert('Error', 'Failed to load join requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId, filter]);

  const handleApprove = useCallback(async (request) => {
    Alert.alert(
      'Approve Request',
      `Allow ${request.userName} to join the community?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingId(request.id);
            try {
              // Update request status
              await updateDoc(doc(db, 'join_requests', request.id), {
                status: 'approved',
                reviewedBy: auth.currentUser?.uid,
                reviewedAt: serverTimestamp(),
              });

              // Add user to community members
              const membershipId = `${request.userId}_${communityId}`;
              const membershipRef = doc(db, 'communities_members', membershipId);
              const existingMembership = await getDoc(membershipRef);

              if (!existingMembership.exists()) {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(membershipRef, {
                  usersId: request.userId,
                  communityId: communityId,
                  joinedAt: serverTimestamp(),
                  role: 'member',
                });

                // Increment member count
                const communityRef = doc(db, 'communities', communityId);
                const { increment } = await import('firebase/firestore');
                await updateDoc(communityRef, {
                  memberCount: increment(1),
                });
              }

              // Update local state
              setRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'approved' } : r
              ));

              Alert.alert('Approved', `${request.userName} has been added to the community.`);
            } catch (err) {
              console.warn('Approve error:', err);
              Alert.alert('Error', 'Failed to approve request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, [communityId]);

  const handleReject = useCallback(async (request) => {
    Alert.alert(
      'Reject Request',
      `Deny ${request.userName}'s request to join?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(request.id);
            try {
              await updateDoc(doc(db, 'join_requests', request.id), {
                status: 'rejected',
                reviewedBy: auth.currentUser?.uid,
                reviewedAt: serverTimestamp(),
              });

              setRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'rejected' } : r
              ));

              Alert.alert('Rejected', 'Join request has been rejected.');
            } catch (err) {
              console.warn('Reject error:', err);
              Alert.alert('Error', 'Failed to reject request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const handleDelete = useCallback(async (request) => {
    Alert.alert(
      'Delete Request',
      'Permanently remove this request record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(request.id);
            try {
              await deleteDoc(doc(db, 'join_requests', request.id));
              setRequests(prev => prev.filter(r => r.id !== request.id));
            } catch (err) {
              console.warn('Delete error:', err);
              Alert.alert('Error', 'Failed to delete request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderFilterTab = (label, value) => (
    <TouchableOpacity
      style={[styles.filterTab, filter === value && styles.filterTabActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterTabText, filter === value && styles.filterTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderRequest = useCallback(({ item }) => {
    const isPending = item.status === 'pending';
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          {item.userAvatar ? (
            <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color="#666" />
            </View>
          )}
          <View style={styles.requestInfo}>
            <Text style={styles.userName} numberOfLines={1}>{item.userName}</Text>
            {item.userBio ? (
              <Text style={styles.userBio} numberOfLines={1}>{item.userBio}</Text>
            ) : null}
            <Text style={styles.requestTime}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '25' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </Text>
          </View>
        </View>

        {item.message ? (
          <Text style={styles.requestMessage}>"{item.message}"</Text>
        ) : null}

        {isProcessing ? (
          <View style={styles.actionRow}>
            <ActivityIndicator size="small" color="#D946EF" />
          </View>
        ) : isPending ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApprove(item)}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item)}
            >
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [processingId, handleApprove, handleReject, handleDelete]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#D946EF" />
        <Text style={styles.loadingText}>Loading requests...</Text>
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
        <Text style={styles.headerTitle}>Join Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {renderFilterTab('Pending', 'pending')}
        {renderFilterTab('Approved', 'approved')}
        {renderFilterTab('Rejected', 'rejected')}
        {renderFilterTab('All', 'all')}
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRequests(); }}
            tintColor="#D946EF"
            colors={['#D946EF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#333" />
            <Text style={styles.emptyTitle}>No {filter !== 'all' ? filter : ''} requests</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'pending'
                ? 'New join requests will appear here'
                : 'No requests match this filter'}
            </Text>
          </View>
        }
        initialNumToRender={10}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1c22',
  },
  filterTabActive: {
    backgroundColor: '#D946EF',
  },
  filterTabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  requestCard: {
    backgroundColor: '#1a1c22',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  requestHeader: {
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
  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  userBio: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  requestTime: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  requestMessage: {
    color: '#aaa',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 10,
    paddingLeft: 56,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingLeft: 56,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#22C55E',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  deleteBtn: {
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  actionBtnText: {
    color: '#fff',
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
