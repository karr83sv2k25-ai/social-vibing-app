// AdminModerationScreen.js - Admin Panel for User Moderation & Verification
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const { width } = Dimensions.get('window');

const C = {
  bg: '#0B0B10',
  card: '#1A1F27',
  border: '#242A33',
  text: '#EAEAF0',
  dim: '#A2A8B3',
  cyan: '#08FFE2',
  brand: '#BF2EF0',
  green: '#36E3C0',
  red: '#FF3232',
  yellow: '#FFD700',
};

export default function AdminModerationScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('verification'); // verification, users, reports
  const [users, setUsers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'verification') {
        fetchPendingVerifications();
      } else if (activeTab === 'users') {
        fetchAllUsers();
      }
    }
  }, [activeTab, isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Access Denied', 'Please login first');
        navigation.goBack();
        return;
      }

      // Check if user is admin
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        if (userData.role === 'admin' || userData.isAdmin) {
          setIsAdmin(true);
          setLoading(false);
        } else {
          Alert.alert('Access Denied', 'You do not have admin privileges');
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      Alert.alert('Error', 'Failed to verify admin status');
      navigation.goBack();
    }
  };

  const fetchPendingVerifications = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'users'),
        where('verificationStatus', '==', 'pending'),
        orderBy('verificationSubmittedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const verifications = [];
      
      snapshot.forEach(doc => {
        verifications.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setPendingVerifications(verifications);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      Alert.alert('Error', 'Failed to load pending verifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      const usersList = [];
      snapshot.forEach(doc => {
        usersList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId, approve) => {
    try {
      setActionLoading(true);
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        isVerified: approve,
        verificationStatus: approve ? 'approved' : 'rejected',
        verifiedAt: approve ? serverTimestamp() : null,
        verifiedBy: getAuth().currentUser.uid,
      });

      Alert.alert(
        'Success',
        approve ? 'User verification approved!' : 'User verification rejected',
        [{ text: 'OK', onPress: () => fetchPendingVerifications() }]
      );
      
      setShowUserModal(false);
    } catch (error) {
      console.error('Error verifying user:', error);
      Alert.alert('Error', 'Failed to update verification status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeVerification = async (userId) => {
    Alert.alert(
      'Revoke Verification',
      'Are you sure you want to revoke this user\'s verification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const userRef = doc(db, 'users', userId);
              
              await updateDoc(userRef, {
                isVerified: false,
                verificationStatus: 'revoked',
                revokedAt: serverTimestamp(),
                revokedBy: getAuth().currentUser.uid,
              });

              Alert.alert('Success', 'User verification revoked');
              fetchAllUsers();
              setShowUserModal(false);
            } catch (error) {
              console.error('Error revoking verification:', error);
              Alert.alert('Error', 'Failed to revoke verification');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleBanUser = async (userId, reason) => {
    Alert.alert(
      'Ban User',
      'Are you sure you want to ban this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const userRef = doc(db, 'users', userId);
              
              await updateDoc(userRef, {
                isBanned: true,
                banReason: reason || 'Violation of community guidelines',
                bannedAt: serverTimestamp(),
                bannedBy: getAuth().currentUser.uid,
              });

              Alert.alert('Success', 'User has been banned');
              fetchAllUsers();
              setShowUserModal(false);
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUnbanUser = async (userId) => {
    try {
      setActionLoading(true);
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        isBanned: false,
        banReason: null,
        unbannedAt: serverTimestamp(),
        unbannedBy: getAuth().currentUser.uid,
      });

      Alert.alert('Success', 'User has been unbanned');
      fetchAllUsers();
      setShowUserModal(false);
    } catch (error) {
      console.error('Error unbanning user:', error);
      Alert.alert('Error', 'Failed to unban user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWarnUser = async (userId, warning) => {
    try {
      setActionLoading(true);
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        warnings: serverTimestamp(), // You can make this an array to track multiple warnings
        lastWarning: warning || 'Community guidelines violation',
        warnedAt: serverTimestamp(),
        warnedBy: getAuth().currentUser.uid,
      });

      Alert.alert('Success', 'Warning sent to user');
      setShowUserModal(false);
    } catch (error) {
      console.error('Error warning user:', error);
      Alert.alert('Error', 'Failed to send warning');
    } finally {
      setActionLoading(false);
    }
  };

  const renderVerificationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => {
        setSelectedUser(item);
        setShowUserModal(true);
      }}>
      <Image
        source={item.profileImage ? { uri: item.profileImage } : require('./assets/profile.png')}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.userHandle}>@{item.username}</Text>
        <Text style={styles.userMeta}>
          Age: {item.age || 'N/A'} • DOB: {item.dateOfBirth || 'N/A'}
        </Text>
        <Text style={styles.userMeta}>
          Document: {item.documentType || 'N/A'}
        </Text>
      </View>
      <View style={styles.statusBadge}>
        <Ionicons name="time-outline" size={16} color={C.yellow} />
        <Text style={[styles.statusText, { color: C.yellow }]}>Pending</Text>
      </View>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => {
        setSelectedUser(item);
        setShowUserModal(true);
      }}>
      <Image
        source={item.profileImage ? { uri: item.profileImage } : require('./assets/profile.png')}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.userName}>
            {item.firstName} {item.lastName}
          </Text>
          {item.isVerified && (
            <Ionicons name="shield-checkmark" size={14} color={C.cyan} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={styles.userHandle}>@{item.username}</Text>
        <Text style={styles.userMeta}>
          Joined: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      {item.isBanned && (
        <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 50, 50, 0.15)' }]}>
          <Ionicons name="ban" size={16} color={C.red} />
          <Text style={[styles.statusText, { color: C.red }]}>Banned</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const UserDetailModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowUserModal(false)}>
                  <Ionicons name="close" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>User Details</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* User Profile */}
              <View style={styles.modalUserProfile}>
                <Image
                  source={
                    selectedUser.profileImage
                      ? { uri: selectedUser.profileImage }
                      : require('./assets/profile.png')
                  }
                  style={styles.modalAvatar}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <Text style={styles.modalUserName}>
                    {selectedUser.firstName} {selectedUser.lastName}
                  </Text>
                  {selectedUser.isVerified && (
                    <Ionicons name="shield-checkmark" size={20} color={C.cyan} style={{ marginLeft: 6 }} />
                  )}
                </View>
                <Text style={styles.modalUserHandle}>@{selectedUser.username}</Text>

                {/* Status Badges */}
                <View style={styles.statusContainer}>
                  {selectedUser.isVerified && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(8, 255, 226, 0.15)' }]}>
                      <Text style={[styles.badgeText, { color: C.cyan }]}>Verified</Text>
                    </View>
                  )}
                  {selectedUser.isBanned && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(255, 50, 50, 0.15)' }]}>
                      <Text style={[styles.badgeText, { color: C.red }]}>Banned</Text>
                    </View>
                  )}
                  {selectedUser.verificationStatus === 'pending' && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                      <Text style={[styles.badgeText, { color: C.yellow }]}>Pending Verification</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Verification Document */}
              {selectedUser.verificationDocument && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Verification Document</Text>
                  <Image
                    source={{ uri: selectedUser.verificationDocument }}
                    style={styles.documentImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.documentInfo}>
                    Type: {selectedUser.documentType || 'N/A'}
                  </Text>
                  <Text style={styles.documentInfo}>
                    DOB: {selectedUser.dateOfBirth || 'N/A'}
                  </Text>
                  <Text style={styles.documentInfo}>
                    Age: {selectedUser.age || 'N/A'}
                  </Text>
                </View>
              )}

              {/* User Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Information</Text>
                <Text style={styles.infoText}>Email: {selectedUser.email || 'N/A'}</Text>
                <Text style={styles.infoText}>
                  Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}
                </Text>
                {selectedUser.banReason && (
                  <Text style={[styles.infoText, { color: C.red }]}>
                    Ban Reason: {selectedUser.banReason}
                  </Text>
                )}
              </View>

              {/* Admin Actions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Admin Actions</Text>

                {/* Verification Actions */}
                {selectedUser.verificationStatus === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: C.green }]}
                      onPress={() => handleVerifyUser(selectedUser.id, true)}
                      disabled={actionLoading}>
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: C.red }]}
                      onPress={() => handleVerifyUser(selectedUser.id, false)}
                      disabled={actionLoading}>
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="close-circle" size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>Reject</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Revoke Verification */}
                {selectedUser.isVerified && (
                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.yellow }]}
                    onPress={() => handleRevokeVerification(selectedUser.id)}
                    disabled={actionLoading}>
                    <Ionicons name="remove-circle" size={20} color="#000" />
                    <Text style={[styles.actionButtonText, { color: '#000' }]}>Revoke Verification</Text>
                  </TouchableOpacity>
                )}

                {/* Ban/Unban */}
                {!selectedUser.isBanned ? (
                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.red }]}
                    onPress={() => handleBanUser(selectedUser.id, 'Community guidelines violation')}
                    disabled={actionLoading}>
                    <Ionicons name="ban" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Ban User</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.green }]}
                    onPress={() => handleUnbanUser(selectedUser.id)}
                    disabled={actionLoading}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Unban User</Text>
                  </TouchableOpacity>
                )}

                {/* Warn User */}
                <TouchableOpacity
                  style={[styles.fullActionButton, { backgroundColor: C.yellow }]}
                  onPress={() => handleWarnUser(selectedUser.id, 'Please follow community guidelines')}
                  disabled={actionLoading}>
                  <Ionicons name="warning" size={20} color="#000" />
                  <Text style={[styles.actionButtonText, { color: '#000' }]}>Send Warning</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Moderation</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'verification' && styles.activeTab]}
          onPress={() => setActiveTab('verification')}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={activeTab === 'verification' ? C.cyan : C.dim}
          />
          <Text style={[styles.tabText, activeTab === 'verification' && styles.activeTabText]}>
            Verifications
          </Text>
          {pendingVerifications.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingVerifications.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}>
          <Ionicons
            name="people-outline"
            size={20}
            color={activeTab === 'users' ? C.cyan : C.dim}
          />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            All Users
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={C.dim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={C.dim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Content */}
      <FlatList
        data={activeTab === 'verification' ? pendingVerifications : users}
        renderItem={activeTab === 'verification' ? renderVerificationItem : renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color={C.dim} />
            <Text style={styles.emptyText}>
              {activeTab === 'verification' ? 'No pending verifications' : 'No users found'}
            </Text>
          </View>
        }
      />

      {/* User Detail Modal */}
      <UserDetailModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: C.card,
  },
  activeTab: {
    backgroundColor: 'rgba(8, 255, 226, 0.15)',
  },
  tabText: {
    color: C.dim,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeTabText: {
    color: C.cyan,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    marginLeft: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  userHandle: {
    color: C.dim,
    fontSize: 13,
    marginTop: 2,
  },
  userMeta: {
    color: C.dim,
    fontSize: 11,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: C.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: C.dim,
    fontSize: 16,
    marginTop: 12,
  },
  loadingText: {
    color: C.dim,
    fontSize: 14,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalUserProfile: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: C.cyan,
  },
  modalUserName: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
  },
  modalUserHandle: {
    color: C.dim,
    fontSize: 14,
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: C.card,
    marginBottom: 12,
  },
  documentInfo: {
    color: C.dim,
    fontSize: 13,
    marginBottom: 4,
  },
  infoText: {
    color: C.text,
    fontSize: 14,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  fullActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
