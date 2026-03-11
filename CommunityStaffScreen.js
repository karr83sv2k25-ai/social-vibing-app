/**
 * CommunityStaffScreen.js
 *
 * Manage Leaders & Curators for a community.
 * - Owner can promote/demote Leaders and Curators
 * - Leaders can promote/demote Curators
 * - Pending promotions are shown (require acceptance by target user)
 * - Each staff card shows their role badge and moderation log count
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import {
  getDoc,
  doc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { app, db } from './firebaseConfig';
import * as ModerationService from './shared/services/moderationService';

const C = {
  bg:     '#0B0B10',
  card:   '#1A1F27',
  border: '#242A33',
  text:   '#EAEAF0',
  dim:    '#A2A8B3',
  cyan:   '#08FFE2',
  brand:  '#BF2EF0',
  green:  '#36E3C0',
  red:    '#FF3232',
  yellow: '#FFD700',
  gold:   '#FFB800',
  orange: '#FF8C00',
};

// Action label + color used in the staff history modal.
// Covers every action that counts in a Leader's or Curator's moderation history.
const ACTION_INFO = {
  disable_post:        { label: 'Disabled Post',        color: '#FF3232' },
  enable_post:         { label: 'Enabled Post',         color: '#36E3C0' },
  hide_post:           { label: 'Hid Post',             color: '#FFD700' },
  unhide_post:         { label: 'Unhid Post',           color: '#36E3C0' },
  feature_post:        { label: 'Featured Post',        color: '#08FFE2' },
  unfeature_post:      { label: 'Unfeatured Post',      color: '#A2A8B3' },
  ban_user:            { label: 'Banned User',          color: '#FF3232' },
  unban_user:          { label: 'Unbanned User',        color: '#36E3C0' },
  strike_user:         { label: 'Struck User',          color: '#FF8C00' },
  unstrike_user:       { label: 'Lifted Strike',        color: '#36E3C0' },
  disable_messages:    { label: 'Disabled Messages',    color: '#FFD700' },
  enable_messages:     { label: 'Enabled Messages',     color: '#36E3C0' },
  feature_room:        { label: 'Featured Chat Room',   color: '#08FFE2' },
  unfeature_room:      { label: 'Unfeatured Room',      color: '#A2A8B3' },
  disable_room:        { label: 'Disabled Chat Room',   color: '#FF3232' },
  enable_room:         { label: 'Enabled Chat Room',    color: '#36E3C0' },
  grant_title:         { label: 'Granted Title',        color: '#BF2EF0' },
  revoke_title:        { label: 'Revoked Title',        color: '#FF3232' },
  change_title_color:  { label: 'Changed Title Color',  color: '#BF2EF0' },
  resolve_flag:        { label: 'Resolved Flag',        color: '#36E3C0' },
  promote_to_leader:   { label: 'Promoted to Leader',   color: '#FFB800' },
  promote_to_curator:  { label: 'Promoted to Curator',  color: '#08FFE2' },
  demote_leader:       { label: 'Demoted from Leader',  color: '#FF3232' },
  demote_curator:      { label: 'Demoted from Curator', color: '#FF3232' },
  accept_promotion:    { label: 'Accepted Promotion',   color: '#FFB800' },
  kick_user:           { label: 'Kicked User',          color: '#FF8C00' },
  warn_user:           { label: 'Issued Warning',       color: '#FFD700' },
  delete_message:      { label: 'Deleted Message',      color: '#FF3232' },
  mute_user_in_chat:   { label: 'Muted in Chat',        color: '#FFD700' },
  unmute_user_in_chat: { label: 'Unmuted in Chat',      color: '#36E3C0' },
};

const ROLE_META = {
  owner:   { label: 'Owner',   color: C.gold,  icon: 'crown' },
  leader:  { label: 'Leader',  color: C.brand, icon: 'shield-star' },
  curator: { label: 'Curator', color: C.cyan,  icon: 'palette' },
  member:  { label: 'Member',  color: C.dim,   icon: 'account' },
};

// ── Pending Promotion Banner ─────────────────────────────────────────────
function PendingBanner({ pendingPromotion, actionLoading, onAccept }) {
  if (!pendingPromotion) return null;
  return (
    <View style={styles.pendingBanner}>
      <MaterialCommunityIcons name="star-circle" size={20} color={C.gold} />
      <Text style={styles.pendingText}>
        You've been promoted to {pendingPromotion.toRole}!{' '}
      </Text>
      <TouchableOpacity
        onPress={onAccept}
        disabled={actionLoading}
        style={styles.acceptBtn}
      >
        <Text style={styles.acceptBtnText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CommunityStaffScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const auth = getAuth(app);
  const currentUserId = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffData, setStaffData] = useState({ owner: null, leaders: [], curators: [] });
  const [myRole, setMyRole] = useState(null);
  const [members, setMembers] = useState([]);

  // Modals
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState(null); // { id, displayName }
  const [promoteToRole, setPromoteToRole] = useState('curator');
  const [memberSearch, setMemberSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pending promotion (for current user)
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // Staff moderation history modal
  const [historyModal, setHistoryModal] = useState({
    visible: false, staff: null, logs: [], loading: false, actionCount: 0,
  });

  const load = useCallback(async () => {
    try {
      const result = await ModerationService.getCommunityStaff(db, communityId);
      if (result.success) {
        // Overlay community nicknames on each staff member.
        // Nicknames live in the top-level communities_members collection as {uid}_{communityId}.
        const overlayNicknames = async (list) => {
          return Promise.all(
            list.map(async (member) => {
              if (!member) return member;
              const membershipId = `${member.id}_${communityId}`;
              const nickDoc = await getDoc(doc(db, 'communities_members', membershipId));
              const nickname = nickDoc.exists() ? nickDoc.data()?.communityNickname : null;
              if (nickname && nickname.trim()) {
                return { ...member, displayName: nickname.trim() };
              }
              return member;
            })
          );
        };
        const [owner, leaders, curators] = await Promise.all([
          result.data.owner ? overlayNicknames([result.data.owner]).then(r => r[0]) : Promise.resolve(null),
          overlayNicknames(result.data.leaders),
          overlayNicknames(result.data.curators),
        ]);
        setStaffData({ owner, leaders, curators });
      }

      const role = await ModerationService.getCommunityRole(db, communityId, currentUserId);
      setMyRole(role);

      // Community info — load members list for promotion picker
      const commDoc = await getDoc(doc(db, 'communities', communityId));
      if (commDoc.exists()) {
        const commData = commDoc.data();

        // Load all members for promotion picker
        const memberIds = commData.members || [];
        const staffIds = new Set([
          commData.creatorId,
          ...(commData.leaders || []),
          ...(commData.curators || []),
        ]);
        const regularMembers = memberIds.filter(id => !staffIds.has(id)).slice(0, 50);
        const [memberUserDocs, memberNickDocs] = await Promise.all([
          Promise.all(regularMembers.map(id => getDoc(doc(db, 'users', id)))),
          // Nicknames live in communities_members/{uid}_{communityId}
          Promise.all(regularMembers.map(id => getDoc(doc(db, 'communities_members', `${id}_${communityId}`)))),
        ]);
        const resolvedMembers = memberUserDocs
          .map((d, i) => {
            if (!d.exists()) return null;
            const userData = d.data();
            const nickname = memberNickDocs[i]?.exists() ? memberNickDocs[i].data()?.communityNickname : null;
            const baseDisplayName =
              userData.displayName ||
              (userData.firstName || userData.lastName
                ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                : null) ||
              userData.username ||
              'User';
            return {
              id: d.id,
              ...userData,
              displayName: (nickname && nickname.trim()) ? nickname.trim() : baseDisplayName,
            };
          })
          .filter(Boolean);
        setMembers(resolvedMembers);
      }

      // Check if current user has a pending promotion
      const promoDoc = await getDoc(
        doc(db, 'communities', communityId, 'pendingPromotions', currentUserId)
      );
      if (promoDoc.exists() && promoDoc.data().status === 'pending') {
        setPendingPromotion(promoDoc.data());
      }
    } catch (e) {
      console.error('CommunityStaffScreen load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId, currentUserId]);

  useEffect(() => { load(); }, [load]);

  const handleAcceptPromotion = async () => {
    setActionLoading(true);
    try {
      const res = await ModerationService.acceptPromotion(db, communityId, currentUserId);
      if (res.success) {
        Alert.alert('Promotion Accepted', `You are now a ${res.role}!`);
        setPendingPromotion(null);
        load();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openStaffHistory = async (staffMember) => {
    setHistoryModal({ visible: true, staff: staffMember, logs: [], loading: true, actionCount: 0 });
    const result = await ModerationService.getStaffModerationHistory(
      db, communityId, staffMember.id, 50
    );
    if (result.success) {
      setHistoryModal(prev => ({
        ...prev,
        logs: result.data,
        loading: false,
        actionCount: result.actionCount,
      }));
    } else {
      setHistoryModal(prev => ({ ...prev, loading: false }));
    }
  };

  const closeHistoryModal = () =>
    setHistoryModal({ visible: false, staff: null, logs: [], loading: false, actionCount: 0 });

  const handlePromote = async () => {
    if (!promoteTarget) return;
    setActionLoading(true);
    try {
      const fn = promoteToRole === 'leader'
        ? ModerationService.promoteToLeader
        : ModerationService.promoteToCurator;
      await fn(db, currentUserId, communityId, promoteTarget.id);
      Alert.alert('Promotion Sent', `${promoteTarget.displayName} has been promoted to ${promoteToRole}. They need to accept the promotion.`);
      setShowPromoteModal(false);
      setPromoteTarget(null);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemote = (staffMember) => {
    Alert.alert(
      `Demote ${staffMember.displayName}`,
      `Remove ${staffMember.displayName} from their ${staffMember.role} role?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const fn = staffMember.role === ModerationService.ROLES.LEADER
                ? ModerationService.demoteLeader
                : ModerationService.demoteCurator;
              await fn(db, currentUserId, communityId, staffMember.id);
              Alert.alert('Demoted', `${staffMember.displayName} has been demoted.`);
              load();
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const canDemote = (staffMember) => {
    if (staffMember.role === ModerationService.ROLES.OWNER) return false;
    if (myRole === ModerationService.ROLES.OWNER) return true;
    if (myRole === ModerationService.ROLES.LEADER && staffMember.role === ModerationService.ROLES.CURATOR) return true;
    return false;
  };

  const canPromote = () => {
    return myRole === ModerationService.ROLES.OWNER || myRole === ModerationService.ROLES.LEADER;
  };

  const roleMeta = (role) => ROLE_META[role] || ROLE_META.member;

  const renderStaffCard = ({ item }) => {
    const meta = roleMeta(item.role);
    const isSelf = item.id === currentUserId;
    return (
      <View style={styles.card}>
        <Image
          source={item.profileImage || item.photoURL
            ? { uri: item.profileImage || item.photoURL }
            : require('./assets/profile.png')
          }
          style={styles.avatar}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.displayName || 'User'}</Text>
          <View style={[styles.roleBadge, { borderColor: meta.color }]}>
            <MaterialCommunityIcons name={meta.icon} size={12} color={meta.color} />
            <Text style={[styles.roleBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            onPress={() => openStaffHistory(item)}
            style={styles.actionBtn}
          >
            <MaterialCommunityIcons name="history" size={20} color={C.dim} />
          </TouchableOpacity>
          {!isSelf && canDemote(item) && (
            <TouchableOpacity
              onPress={() => handleDemote(item)}
              style={styles.actionBtn}
            >
              <Ionicons name="arrow-down-circle" size={22} color={C.red} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filteredMembers = members.filter(m =>
    (m.displayName || '').toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.cyan} />
      </View>
    );
  }

  // Build unified list: owner → leaders → curators
  const allStaff = [];
  if (staffData.owner) allStaff.push(staffData.owner);
  allStaff.push(...staffData.leaders);
  allStaff.push(...staffData.curators);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Staff</Text>
        {canPromote() && (
          <TouchableOpacity
            onPress={() => setShowPromoteModal(true)}
            style={styles.addBtn}
          >
            <Ionicons name="person-add" size={22} color={C.cyan} />
          </TouchableOpacity>
        )}
      </View>

      <PendingBanner
        pendingPromotion={pendingPromotion}
        actionLoading={actionLoading}
        onAccept={handleAcceptPromotion}
      />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: C.gold }]}>{staffData.leaders.length}</Text>
          <Text style={styles.statLabel}>Leaders</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: C.cyan }]}>{staffData.curators.length}</Text>
          <Text style={styles.statLabel}>Curators</Text>
        </View>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('CommunityModeration', { communityId })}
        >
          <MaterialCommunityIcons name="history" size={24} color={C.dim} />
          <Text style={styles.statLabel}>Mod Log</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={allStaff}
        keyExtractor={item => item.id}
        renderItem={renderStaffCard}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No staff members yet.</Text>
        }
        onRefresh={() => { setRefreshing(true); load(); }}
        refreshing={refreshing}
      />

      {/* Staff History Modal */}
      <Modal
        visible={historyModal.visible}
        transparent
        animationType="slide"
        onRequestClose={closeHistoryModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              {historyModal.staff && (
                <Image
                  source={historyModal.staff.profileImage || historyModal.staff.photoURL
                    ? { uri: historyModal.staff.profileImage || historyModal.staff.photoURL }
                    : require('./assets/profile.png')
                  }
                  style={{ width: 44, height: 44, borderRadius: 22, marginRight: 10 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {historyModal.staff?.displayName || 'Staff'}
                </Text>
                {historyModal.staff && (() => {
                  const m = roleMeta(historyModal.staff.role);
                  return (
                    <View style={[styles.roleBadge, { borderColor: m.color, marginTop: 2 }]}>
                      <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
                      <Text style={[styles.roleBadgeText, { color: m.color }]}>{m.label}</Text>
                    </View>
                  );
                })()}
              </View>
              {!historyModal.loading && (
                <View style={{ alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: C.cyan }}>
                    {historyModal.actionCount}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</Text>
                </View>
              )}
              <TouchableOpacity onPress={closeHistoryModal} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={C.dim} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Moderation History</Text>

            {historyModal.loading ? (
              <ActivityIndicator size="large" color={C.cyan} style={{ marginVertical: 40 }} />
            ) : historyModal.logs.length === 0 ? (
              <Text style={[styles.empty, { marginTop: 16 }]}>No moderation activity yet.</Text>
            ) : (
              <FlatList
                data={historyModal.logs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const info = ACTION_INFO[item.action] ||
                    { label: item.action.replace(/_/g, ' ').toUpperCase(), color: C.dim };
                  const ts = item.createdAt?.toDate
                    ? item.createdAt.toDate().toLocaleString()
                    : '';
                  return (
                    <View style={[styles.historyItem, { borderLeftColor: info.color }]}>
                      <Text style={[styles.historyLabel, { color: info.color }]}>{info.label}</Text>
                      {!!item.reason && (
                        <Text style={styles.historyReason}>"{item.reason}"</Text>
                      )}
                      <Text style={styles.historyMeta}>{ts}</Text>
                    </View>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Promote Modal */}
      <Modal
        visible={showPromoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPromoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Promote a Member</Text>

            {/* Role picker */}
            <View style={styles.roleRow}>
              {['curator', 'leader'].map(r => {
                const canPickLeader = myRole === ModerationService.ROLES.OWNER && r === 'leader';
                const isCurator = r === 'curator';
                const enabled = isCurator || canPickLeader;
                return (
                  <TouchableOpacity
                    key={r}
                    disabled={!enabled}
                    onPress={() => setPromoteToRole(r)}
                    style={[
                      styles.roleOption,
                      promoteToRole === r && styles.roleOptionActive,
                      !enabled && { opacity: 0.3 },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={ROLE_META[r].icon}
                      size={18}
                      color={promoteToRole === r ? '#000' : ROLE_META[r].color}
                    />
                    <Text style={[
                      styles.roleOptionText,
                      { color: promoteToRole === r ? '#000' : C.text },
                    ]}>
                      {ROLE_META[r].label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Member search */}
            <TextInput
              style={styles.searchInput}
              placeholder="Search members…"
              placeholderTextColor={C.dim}
              value={memberSearch}
              onChangeText={setMemberSearch}
            />

            <ScrollView style={{ maxHeight: 260 }}>
              {filteredMembers.map(m => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setPromoteTarget(m)}
                  style={[
                    styles.memberRow,
                    promoteTarget?.id === m.id && styles.memberRowSelected,
                  ]}
                >
                  <Image
                    source={m.profileImage || m.photoURL
                      ? { uri: m.profileImage || m.photoURL }
                      : require('./assets/profile.png')
                    }
                    style={styles.memberAvatar}
                  />
                  <Text style={styles.memberName}>{m.displayName || 'User'}</Text>
                  {promoteTarget?.id === m.id && (
                    <Ionicons name="checkmark-circle" size={20} color={C.cyan} />
                  )}
                </TouchableOpacity>
              ))}
              {filteredMembers.length === 0 && (
                <Text style={styles.empty}>No members found.</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => { setShowPromoteModal(false); setPromoteTarget(null); }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePromote}
                disabled={!promoteTarget || actionLoading}
                style={[styles.confirmBtn, (!promoteTarget || actionLoading) && { opacity: 0.5 }]}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.confirmBtnText}>Promote</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  backBtn:        { marginRight: 12 },
  headerTitle:    { flex: 1, fontSize: 18, fontWeight: '700', color: C.text },
  addBtn:         { padding: 4 },
  statsRow:       { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 12, padding: 16 },
  statItem:       { alignItems: 'center', gap: 4 },
  statNum:        { fontSize: 22, fontWeight: '700' },
  statLabel:      { fontSize: 12, color: C.dim },
  card:           { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  avatar:         { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  cardInfo:       { flex: 1 },
  cardName:       { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 4 },
  roleBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  roleBadgeText:  { fontSize: 11, fontWeight: '600' },
  actionBtn:      { padding: 6 },
  empty:          { color: C.dim, textAlign: 'center', marginTop: 24 },

  // Pending banner
  pendingBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2210', borderWidth: 1, borderColor: C.gold, marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 12, gap: 8 },
  pendingText:    { flex: 1, color: C.gold, fontSize: 13 },
  acceptBtn:      { backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText:  { color: '#000', fontWeight: '700', fontSize: 13 },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
  roleRow:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleOption:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 10 },
  roleOptionActive:{ backgroundColor: C.cyan, borderColor: C.cyan },
  roleOptionText: { fontSize: 14, fontWeight: '600' },
  searchInput:    { backgroundColor: '#111827', borderRadius: 10, padding: 10, color: C.text, marginBottom: 10, fontSize: 14 },
  memberRow:      { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 4, gap: 10 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: '#A2A8B3', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  historyItem:    { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 8, marginBottom: 8, backgroundColor: '#111827', borderRadius: 8 },
  historyLabel:   { fontSize: 13, fontWeight: '700' },
  historyReason:  { fontSize: 12, color: '#A2A8B3', fontStyle: 'italic', marginTop: 2 },
  historyMeta:    { fontSize: 11, color: '#A2A8B3', marginTop: 2 },
  memberRowSelected:{ backgroundColor: 'rgba(8,255,226,0.1)', borderWidth: 1, borderColor: C.cyan },
  memberAvatar:   { width: 36, height: 36, borderRadius: 18 },
  memberName:     { flex: 1, color: C.text, fontSize: 14 },
  modalActions:   { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:      { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center' },
  cancelBtnText:  { color: C.dim, fontWeight: '600' },
  confirmBtn:     { flex: 1, backgroundColor: C.cyan, borderRadius: 10, padding: 14, alignItems: 'center' },
  confirmBtnText: { color: '#000', fontWeight: '700' },
});
