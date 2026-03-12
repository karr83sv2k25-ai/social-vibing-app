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
  getDoc,
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  limit,
  increment,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  getReportsForAdmin,
  getPendingReportsCount,
  updateReportStatus,
  takeActionOnReport,
  REPORT_STATUS,
  ADMIN_ACTIONS,
  REPORT_REASONS,
  REPORT_TYPES,
} from './shared/services/reportService';

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
  const [reports, setReports] = useState([]);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportFilter, setReportFilter] = useState('all'); // all, pending, resolved

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'verification') {
        fetchPendingVerifications();
      } else if (activeTab === 'users') {
        fetchAllUsers();
      } else if (activeTab === 'reports') {
        fetchReports();
      }
      // Always fetch pending reports count
      fetchPendingReportsCount();
    }
  }, [activeTab, isAdmin, reportFilter]);

  const fetchPendingReportsCount = async () => {
    const result = await getPendingReportsCount();
    if (result.success) {
      setPendingReportsCount(result.count);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const status = reportFilter === 'all' ? null : 
                     reportFilter === 'pending' ? REPORT_STATUS.PENDING : 
                     REPORT_STATUS.RESOLVED;
      
      const result = await getReportsForAdmin({ status, limitCount: 50 });
      
      if (result.success) {
        setReports(result.reports);
      } else {
        Alert.alert('Error', 'Failed to load reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Access Denied', 'Please login first');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      // Direct document read — fast, no query needed
      const userDocSnap = await getDoc(doc(db, 'users', user.uid));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role === 'admin' || userData.isAdmin) {
          setIsAdmin(true);
          setLoading(false);
        } else {
          setLoading(false);
          Alert.alert('Access Denied', 'You do not have admin privileges');
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        }
      } else {
        // User document doesn't exist
        setLoading(false);
        Alert.alert('Access Denied', 'User account not found');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to verify admin status');
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    }
  };

  const fetchPendingVerifications = async () => {
    try {
      setLoading(true);
      // Try with orderBy first (requires composite index); fall back to unordered if index missing.
      let snapshot;
      try {
        const q = query(
          collection(db, 'users'),
          where('verificationStatus', '==', 'pending'),
          orderBy('verificationSubmittedAt', 'desc')
        );
        snapshot = await getDocs(q);
      } catch {
        const q = query(
          collection(db, 'users'),
          where('verificationStatus', '==', 'pending')
        );
        snapshot = await getDocs(q);
      }
      const verifications = [];
      snapshot.forEach(d => {
        verifications.push({ id: d.id, ...d.data() });
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
      'Are you sure you want to permanently ban this user?',
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
                banType: 'permanent',
                banReason: reason || 'Violation of community guidelines',
                banExpiresAt: null,
                bannedAt: serverTimestamp(),
                bannedBy: getAuth().currentUser.uid,
                accountStatus: 'banned',
                updatedAt: serverTimestamp(),
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
        banType: null,
        banReason: null,
        banExpiresAt: null,
        accountStatus: 'active',
        unbannedAt: serverTimestamp(),
        unbannedBy: getAuth().currentUser.uid,
        updatedAt: serverTimestamp(),
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

  // ==================== REPORT HANDLING FUNCTIONS ====================
  
  const handleReportAction = async (action) => {
    if (!selectedReport) return;
    
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${getActionLabel(action)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: action === ADMIN_ACTIONS.NO_VIOLATION ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const adminId = getAuth().currentUser.uid;
              
              const result = await takeActionOnReport(selectedReport.id, {
                adminId,
                action,
                actionDetails: {
                  reason: selectedReport.reasonLabel,
                  message: `Action taken for: ${selectedReport.reasonLabel}`,
                },
                notifyUser: true,
              });

              if (result.success) {
                Alert.alert('Success', 'Action taken successfully');
                setShowReportModal(false);
                fetchReports();
                fetchPendingReportsCount();
              } else {
                Alert.alert('Error', result.error || 'Failed to take action');
              }
            } catch (error) {
              console.error('Error taking action:', error);
              Alert.alert('Error', 'Failed to take action');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDismissReport = async () => {
    if (!selectedReport) return;
    
    try {
      setActionLoading(true);
      const adminId = getAuth().currentUser.uid;
      
      const result = await updateReportStatus(selectedReport.id, {
        status: REPORT_STATUS.DISMISSED,
        adminId,
        adminNotes: 'Report dismissed by admin - no violation found',
        actionTaken: ADMIN_ACTIONS.DISMISSED,
      });

      if (result.success) {
        Alert.alert('Success', 'Report dismissed');
        setShowReportModal(false);
        fetchReports();
        fetchPendingReportsCount();
      } else {
        Alert.alert('Error', result.error || 'Failed to dismiss report');
      }
    } catch (error) {
      console.error('Error dismissing report:', error);
      Alert.alert('Error', 'Failed to dismiss report');
    } finally {
      setActionLoading(false);
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case ADMIN_ACTIONS.WARNING: return 'send a warning';
      case ADMIN_ACTIONS.TEMPORARY_BAN: return 'temporarily ban user';
      case ADMIN_ACTIONS.PERMANENT_BAN: return 'permanently ban user';
      case ADMIN_ACTIONS.CONTENT_REMOVED: return 'remove content';
      case ADMIN_ACTIONS.NO_VIOLATION: return 'mark as no violation';
      default: return 'take this action';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return C.red;
      case 'medium': return C.yellow;
      default: return C.dim;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case REPORT_STATUS.PENDING: return C.yellow;
      case REPORT_STATUS.UNDER_REVIEW: return C.brand;
      case REPORT_STATUS.RESOLVED:
      case REPORT_STATUS.ACTION_TAKEN: return C.green;
      case REPORT_STATUS.DISMISSED: return C.dim;
      default: return C.dim;
    }
  };

  const formatReportDate = (date) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleWarnUser = async (userId, warning) => {
    try {
      setActionLoading(true);
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        warningsCount: increment(1),
        lastWarning: warning || 'Community guidelines violation',
        lastWarningDate: serverTimestamp(),
        warnedAt: serverTimestamp(),
        warnedBy: getAuth().currentUser.uid,
        updatedAt: serverTimestamp(),
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

  const formatDate = (value) => {
    if (!value) return 'N/A';
    try {
      const d = value?.toDate ? value.toDate() : new Date(value);
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

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
            {item.firstName || item.displayName || item.username || 'User'}{item.lastName ? ` ${item.lastName}` : ''}
          </Text>
          {item.isVerified && (
            <Ionicons name="shield-checkmark" size={14} color={C.cyan} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={styles.userHandle}>@{item.username || 'unknown'}</Text>
        <Text style={styles.userMeta}>
          Joined: {formatDate(item.createdAt)}
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

  // ==================== REPORT ITEM RENDERER ====================
  const renderReportItem = ({ item }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => {
        setSelectedReport(item);
        setShowReportModal(true);
      }}>
      <View style={styles.reportHeader}>
        <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
        <View style={styles.reportInfo}>
          <Text style={styles.reportReason}>{item.reasonLabel || item.reason}</Text>
          <Text style={styles.reportMeta}>
            Reported: @{item.reportedUsername} • by @{item.reporterUsername}
          </Text>
          <Text style={styles.reportDate}>
            {formatReportDate(item.createdAt)}
          </Text>
        </View>
        <View style={[styles.reportStatusBadge, { backgroundColor: `${getStatusColor(item.status)}22` }]}>
          <Text style={[styles.reportStatusText, { color: getStatusColor(item.status) }]}>
            {item.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
          </Text>
        </View>
      </View>
      {item.description && (
        <Text style={styles.reportDescription} numberOfLines={2}>
          "{item.description}"
        </Text>
      )}
    </TouchableOpacity>
  );

  // ==================== REPORT DETAIL MODAL ====================
  const ReportDetailModal = () => {
    const [reportedContent, setReportedContent] = useState(null);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentNotFound, setContentNotFound] = useState(false);

    // Fetch actual reported content from Firestore whenever the selected report changes
    useEffect(() => {
      if (!selectedReport?.contentId || !showReportModal) {
        setReportedContent(null);
        setContentNotFound(false);
        return;
      }

      const collectionMap = {
        [REPORT_TYPES.POST]: 'posts',
        [REPORT_TYPES.COMMENT]: 'comments',
        [REPORT_TYPES.MESSAGE]: null, // stored in subcollections — use preview only
        [REPORT_TYPES.PRODUCT]: 'marketplace',
        [REPORT_TYPES.STORY]: 'stories',
        [REPORT_TYPES.COMMUNITY]: 'communities',
      };

      const contentType = selectedReport.reportType || selectedReport.contentType;
      const collName = collectionMap[contentType];

      if (!collName) return; // e.g. messages — no simple global doc

      let cancelled = false;
      setContentLoading(true);
      setContentNotFound(false);

      const fetchContent = async () => {
        try {
          let snap = null;

          // Try community-scoped subcollection first for posts/comments
          if (selectedReport.communityId && (contentType === REPORT_TYPES.POST || contentType === REPORT_TYPES.COMMENT)) {
            try {
              snap = await getDoc(doc(db, 'communities', selectedReport.communityId, collName, selectedReport.contentId));
            } catch (_) {}
          }

          // Fall back to global collection
          if (!snap?.exists()) {
            snap = await getDoc(doc(db, collName, selectedReport.contentId));
          }

          if (cancelled) return;

          if (snap?.exists()) {
            setReportedContent({ id: snap.id, ...snap.data() });
          } else {
            setContentNotFound(true);
          }
        } catch (e) {
          console.error('Error fetching reported content:', e);
          if (!cancelled) setContentNotFound(true);
        } finally {
          if (!cancelled) setContentLoading(false);
        }
      };

      fetchContent();
      return () => { cancelled = true; };
    }, [selectedReport?.id, showReportModal]);

    if (!selectedReport) return null;

    const isPending = selectedReport.status === REPORT_STATUS.PENDING;
    const contentType = selectedReport.reportType || selectedReport.contentType;

    // ---- helper: render the fetched content card ----
    const renderContentCard = () => {
      if (!selectedReport.contentId) return null;

      const typeLabel = {
        [REPORT_TYPES.POST]: 'Post',
        [REPORT_TYPES.COMMENT]: 'Comment',
        [REPORT_TYPES.PRODUCT]: 'Product',
        [REPORT_TYPES.STORY]: 'Story',
        [REPORT_TYPES.COMMUNITY]: 'Community',
        [REPORT_TYPES.MESSAGE]: 'Message',
      }[contentType] || 'Content';

      return (
        <View style={styles.section}>
          <View style={styles.contentHeaderRow}>
            <Text style={styles.sectionTitle}>Reported {typeLabel}</Text>
            <View style={styles.contentTypeBadge}>
              <Ionicons
                name={contentType === REPORT_TYPES.POST ? 'document-text-outline' :
                      contentType === REPORT_TYPES.COMMENT ? 'chatbubble-outline' :
                      contentType === REPORT_TYPES.PRODUCT ? 'pricetag-outline' :
                      contentType === REPORT_TYPES.STORY ? 'play-circle-outline' :
                      contentType === REPORT_TYPES.COMMUNITY ? 'people-outline' :
                      'mail-outline'}
                size={13}
                color={C.brand}
              />
              <Text style={styles.contentTypeText}>{typeLabel}</Text>
            </View>
          </View>

          {contentLoading ? (
            <View style={styles.contentLoadingBox}>
              <ActivityIndicator size="small" color={C.brand} />
              <Text style={styles.contentLoadingText}>Loading {typeLabel.toLowerCase()}…</Text>
            </View>
          ) : contentNotFound ? (
            <View style={styles.contentNotFoundBox}>
              <Ionicons name="alert-circle-outline" size={28} color={C.dim} />
              <Text style={styles.contentNotFoundText}>
                This {typeLabel.toLowerCase()} no longer exists or was already removed.
              </Text>
            </View>
          ) : reportedContent ? (
            <View style={[styles.contentCard, reportedContent.isDeleted && styles.contentCardDeleted]}>
              {/* Deleted banner */}
              {reportedContent.isDeleted && (
                <View style={styles.deletedBanner}>
                  <Ionicons name="trash-outline" size={14} color={C.red} />
                  <Text style={styles.deletedBannerText}>Already removed</Text>
                </View>
              )}

              {/* Author row */}
              <View style={styles.contentAuthorRow}>
                <Image
                  source={reportedContent.authorImage || reportedContent.userAvatar || reportedContent.coverImage
                    ? { uri: reportedContent.authorImage || reportedContent.userAvatar || reportedContent.coverImage }
                    : require('./assets/profile.png')}
                  style={styles.contentAuthorAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contentAuthorName}>
                    {reportedContent.authorName ||
                     reportedContent.username ||
                     reportedContent.name ||
                     `User ${(reportedContent.authorId || reportedContent.userId || '').slice(0, 6)}`}
                  </Text>
                  {reportedContent.createdAt && (
                    <Text style={styles.contentDate}>
                      {formatReportDate(
                        reportedContent.createdAt?.toDate
                          ? reportedContent.createdAt.toDate()
                          : reportedContent.createdAt
                      )}
                    </Text>
                  )}
                </View>
              </View>

              {/* Content body — post/comment/product/story/community */}
              {(contentType === REPORT_TYPES.POST || contentType === REPORT_TYPES.COMMENT) && (
                <>
                  {(reportedContent.text || reportedContent.content) ? (
                    <Text style={styles.contentBodyText}>
                      {reportedContent.text || reportedContent.content}
                    </Text>
                  ) : null}

                  {/* Images */}
                  {((reportedContent.images && reportedContent.images.length > 0) ||
                    (reportedContent.mediaUrls && reportedContent.mediaUrls.length > 0)) && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                      {(reportedContent.images || reportedContent.mediaUrls || []).map((uri, idx) => (
                        <Image
                          key={idx}
                          source={{ uri }}
                          style={styles.contentMediaThumb}
                          resizeMode="cover"
                        />
                      ))}
                    </ScrollView>
                  )}

                  {contentType === REPORT_TYPES.COMMENT && reportedContent.postId && (
                    <Text style={styles.contentMetaNote}>
                      Comment on post: {reportedContent.postId}
                    </Text>
                  )}
                </>
              )}

              {contentType === REPORT_TYPES.PRODUCT && (
                <>
                  <Text style={styles.productTitle}>{reportedContent.title || reportedContent.name || 'Untitled Product'}</Text>
                  {reportedContent.price != null && (
                    <Text style={styles.productPrice}>${Number(reportedContent.price).toFixed(2)}</Text>
                  )}
                  {reportedContent.description ? (
                    <Text style={styles.contentBodyText} numberOfLines={4}>{reportedContent.description}</Text>
                  ) : null}
                  {((reportedContent.images && reportedContent.images.length > 0) ||
                    (reportedContent.imageUrls && reportedContent.imageUrls.length > 0)) && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                      {(reportedContent.images || reportedContent.imageUrls || []).map((uri, idx) => (
                        <Image key={idx} source={{ uri }} style={styles.contentMediaThumb} resizeMode="cover" />
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              {contentType === REPORT_TYPES.STORY && (
                <>
                  {reportedContent.mediaUrl ? (
                    <Image
                      source={{ uri: reportedContent.mediaUrl }}
                      style={styles.storyPreviewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.contentBodyText}>Story (media not previewable)</Text>
                  )}
                </>
              )}

              {contentType === REPORT_TYPES.COMMUNITY && (
                <>
                  <Text style={styles.productTitle}>{reportedContent.name || 'Unnamed Community'}</Text>
                  {reportedContent.description ? (
                    <Text style={styles.contentBodyText} numberOfLines={3}>{reportedContent.description}</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : selectedReport.contentPreview ? (
            // Fallback: show stored text preview if fetch returned nothing
            <View style={styles.contentPreviewBox}>
              <Text style={styles.contentPreviewText}>{selectedReport.contentPreview}</Text>
            </View>
          ) : null}
        </View>
      );
    };

    return (
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowReportModal(false)}>
                  <Ionicons name="close" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Report Review</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Report Info */}
              <View style={styles.section}>
                <View style={styles.reportDetailRow}>
                  <Text style={styles.reportDetailLabel}>Status</Text>
                  <View style={[styles.reportStatusBadge, { backgroundColor: `${getStatusColor(selectedReport.status)}22` }]}>
                    <Text style={[styles.reportStatusText, { color: getStatusColor(selectedReport.status) }]}>
                      {selectedReport.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.reportDetailRow}>
                  <Text style={styles.reportDetailLabel}>Priority</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(selectedReport.priority)}22` }]}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(selectedReport.priority) }]} />
                    <Text style={[styles.priorityText, { color: getPriorityColor(selectedReport.priority) }]}>
                      {selectedReport.priority?.toUpperCase() || 'LOW'}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportDetailRow}>
                  <Text style={styles.reportDetailLabel}>Type</Text>
                  <Text style={styles.reportDetailValue}>
                    {(selectedReport.reportType || selectedReport.contentType || 'user').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.reportDetailRow}>
                  <Text style={styles.reportDetailLabel}>Reason</Text>
                  <Text style={styles.reportDetailValue}>{selectedReport.reasonLabel || selectedReport.reason}</Text>
                </View>

                <View style={styles.reportDetailRow}>
                  <Text style={styles.reportDetailLabel}>Submitted</Text>
                  <Text style={styles.reportDetailValue}>{formatReportDate(selectedReport.createdAt)}</Text>
                </View>
              </View>

              {/* ---- Reported Content Preview (live fetch) ---- */}
              {renderContentCard()}

              {/* Reporter's description */}
              {selectedReport.description && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Reporter's Note</Text>
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>"{selectedReport.description}"</Text>
                  </View>
                </View>
              )}

              {/* Users Involved */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Users Involved</Text>
                
                <View style={styles.userInvolvedCard}>
                  <Ionicons name="flag" size={20} color={C.red} />
                  <View style={styles.userInvolvedInfo}>
                    <Text style={styles.userInvolvedLabel}>Reported User</Text>
                    <Text style={styles.userInvolvedName}>@{selectedReport.reportedUsername}</Text>
                    <Text style={styles.userInvolvedId}>ID: {selectedReport.reportedId}</Text>
                  </View>
                </View>

                <View style={styles.userInvolvedCard}>
                  <Ionicons name="person" size={20} color={C.cyan} />
                  <View style={styles.userInvolvedInfo}>
                    <Text style={styles.userInvolvedLabel}>Reporter</Text>
                    <Text style={styles.userInvolvedName}>@{selectedReport.reporterUsername}</Text>
                    <Text style={styles.userInvolvedId}>ID: {selectedReport.reporterId}</Text>
                  </View>
                </View>
              </View>

              {/* Admin Actions - Only show for pending reports */}
              {isPending && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Take Action</Text>
                  
                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.yellow }]}
                    onPress={() => handleReportAction(ADMIN_ACTIONS.WARNING)}
                    disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator size="small" color="#000" /> : (
                      <>
                        <Ionicons name="warning" size={20} color="#000" />
                        <Text style={[styles.actionButtonText, { color: '#000' }]}>Warn User</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: '#FF6B00' }]}
                    onPress={() => handleReportAction(ADMIN_ACTIONS.TEMPORARY_BAN)}
                    disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Ionicons name="time" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Temporary Ban (7 days)</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.red }]}
                    onPress={() => handleReportAction(ADMIN_ACTIONS.PERMANENT_BAN)}
                    disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Ionicons name="ban" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Permanent Ban</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {selectedReport.contentId && (
                    <TouchableOpacity
                      style={[
                        styles.fullActionButton,
                        { backgroundColor: '#9333EA' },
                        reportedContent?.isDeleted && { opacity: 0.4 },
                      ]}
                      onPress={() => handleReportAction(ADMIN_ACTIONS.CONTENT_REMOVED)}
                      disabled={actionLoading || !!reportedContent?.isDeleted}>
                      {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                        <>
                          <Ionicons name="trash" size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>
                            {reportedContent?.isDeleted ? 'Content Already Removed' : 'Remove Content'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <View style={styles.actionDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}
                    onPress={() => handleReportAction(ADMIN_ACTIONS.NO_VIOLATION)}
                    disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator size="small" color={C.green} /> : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color={C.green} />
                        <Text style={[styles.actionButtonText, { color: C.green }]}>No Violation Found</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fullActionButton, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}
                    onPress={handleDismissReport}
                    disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator size="small" color={C.dim} /> : (
                      <>
                        <Ionicons name="close-circle" size={20} color={C.dim} />
                        <Text style={[styles.actionButtonText, { color: C.dim }]}>Dismiss Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Action Already Taken */}
              {!isPending && selectedReport.actionTaken && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Action Taken</Text>
                  <View style={styles.actionTakenBox}>
                    <Ionicons name="checkmark-done" size={24} color={C.green} />
                    <View style={styles.actionTakenInfo}>
                      <Text style={styles.actionTakenText}>
                        {selectedReport.actionTaken?.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      {selectedReport.reviewedAt && (
                        <Text style={styles.actionTakenDate}>
                          {formatReportDate(selectedReport.reviewedAt)}
                        </Text>
                      )}
                      {selectedReport.adminNotes && (
                        <Text style={styles.adminNotesText}>{selectedReport.adminNotes}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

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
                    {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') ||
                      selectedUser.displayName || selectedUser.username || 'User'}
                  </Text>
                  {selectedUser.isVerified && (
                    <Ionicons name="shield-checkmark" size={20} color={C.cyan} style={{ marginLeft: 6 }} />
                  )}
                </View>
                <Text style={styles.modalUserHandle}>@{selectedUser.username || 'unknown'}</Text>

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
                  Joined: {formatDate(selectedUser.createdAt)}
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
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Moderation</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
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

          <TouchableOpacity
            style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
            onPress={() => setActiveTab('reports')}>
            <Ionicons
              name="flag-outline"
              size={20}
              color={activeTab === 'reports' ? C.cyan : C.dim}
            />
            <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
              Reports
            </Text>
            {pendingReportsCount > 0 && (
              <View style={[styles.badge, { backgroundColor: C.red }]}>
                <Text style={styles.badgeText}>{pendingReportsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Report Filters - Only show when on reports tab */}
      {activeTab === 'reports' && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, reportFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setReportFilter('all')}>
            <Text style={[styles.filterButtonText, reportFilter === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, reportFilter === 'pending' && styles.filterButtonActive]}
            onPress={() => setReportFilter('pending')}>
            <Text style={[styles.filterButtonText, reportFilter === 'pending' && styles.filterButtonTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, reportFilter === 'resolved' && styles.filterButtonActive]}
            onPress={() => setReportFilter('resolved')}>
            <Text style={[styles.filterButtonText, reportFilter === 'resolved' && styles.filterButtonTextActive]}>
              Resolved
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      {activeTab !== 'reports' && (
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
      )}

      {/* Content */}
      <FlatList
        data={
          activeTab === 'verification'
            ? pendingVerifications.filter(u => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q) ||
                  (u.username || '').toLowerCase().includes(q)
                );
              })
            : activeTab === 'users'
              ? users.filter(u => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    `${u.firstName || ''} ${u.lastName || ''} ${u.displayName || ''}`.toLowerCase().includes(q) ||
                    (u.username || '').toLowerCase().includes(q)
                  );
                })
              : reports
        }
        renderItem={
          activeTab === 'verification' 
            ? renderVerificationItem 
            : activeTab === 'users' 
              ? renderUserItem 
              : renderReportItem
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={activeTab === 'reports' ? "flag-outline" : "folder-open-outline"} 
              size={64} 
              color={C.dim} 
            />
            <Text style={styles.emptyText}>
              {activeTab === 'verification' 
                ? 'No pending verifications' 
                : activeTab === 'users' 
                  ? 'No users found'
                  : 'No reports found'}
            </Text>
          </View>
        }
      />

      {/* User Detail Modal */}
      <UserDetailModal />
      
      {/* Report Detail Modal */}
      <ReportDetailModal />
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
    paddingTop: 56,
    paddingBottom: 16,
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
  // ==================== TABS SCROLL ====================
  tabsScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  // ==================== FILTER STYLES ====================
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(8, 255, 226, 0.15)',
    borderColor: C.cyan,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.dim,
  },
  filterButtonTextActive: {
    color: C.cyan,
  },
  // ==================== REPORT CARD STYLES ====================
  reportCard: {
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    minHeight: 50,
    borderRadius: 2,
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportReason: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  reportMeta: {
    color: C.dim,
    fontSize: 12,
    marginBottom: 2,
  },
  reportDate: {
    color: C.dim,
    fontSize: 11,
    marginTop: 2,
  },
  reportStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reportDescription: {
    color: C.dim,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 10,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: C.border,
  },
  // ==================== REPORT DETAIL MODAL STYLES ====================
  reportDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportDetailLabel: {
    color: C.dim,
    fontSize: 13,
  },
  reportDetailValue: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userInvolvedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  userInvolvedInfo: {
    flex: 1,
  },
  userInvolvedLabel: {
    color: C.dim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userInvolvedName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  userInvolvedId: {
    color: C.dim,
    fontSize: 11,
    marginTop: 2,
  },
  descriptionBox: {
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
  },
  descriptionText: {
    color: C.text,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  contentPreviewBox: {
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  contentPreviewText: {
    color: C.dim,
    fontSize: 13,
  },
  actionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.dim,
    fontSize: 12,
    marginHorizontal: 12,
  },
  actionTakenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(54, 227, 192, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  actionTakenInfo: {
    flex: 1,
  },
  actionTakenText: {
    color: C.green,
    fontSize: 15,
    fontWeight: '700',
  },
  actionTakenDate: {
    color: C.dim,
    fontSize: 12,
    marginTop: 4,
  },
  adminNotesText: {
    color: C.dim,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  // ==================== CONTENT PREVIEW STYLES ====================
  contentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contentTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(191, 46, 240, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  contentTypeText: {
    color: C.brand,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  contentLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  contentLoadingText: {
    color: C.dim,
    fontSize: 13,
  },
  contentNotFoundBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  contentNotFoundText: {
    color: C.dim,
    fontSize: 13,
    textAlign: 'center',
  },
  contentCard: {
    backgroundColor: '#10141C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  contentCardDeleted: {
    opacity: 0.6,
    borderColor: C.red,
    borderStyle: 'dashed',
  },
  deletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 50, 50, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  deletedBannerText: {
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
  },
  contentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  contentAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
  },
  contentAuthorName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  contentDate: {
    color: C.dim,
    fontSize: 11,
    marginTop: 2,
  },
  contentBodyText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  contentMediaThumb: {
    width: 120,
    height: 120,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: C.card,
  },
  storyPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: C.card,
    marginTop: 8,
  },
  productTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  productPrice: {
    color: C.cyan,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  contentMetaNote: {
    color: C.dim,
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
