/**
 * CommunityModerationScreen.js
 *
 * Full moderation panel for Leaders & Curators of a community.
 * Tabs: Members | Posts | Chat Rooms | Mod Log
 *
 * Each tab surfaces the actions available to the current user's role.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
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
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { app, db } from './firebaseConfig';
import * as ModerationService from './shared/services/moderationService';
import {
  getReportsForCommunity,
  takeCommunityStaffAction,
  REPORT_STATUS,
} from './shared/services/reportService';

// Module-level constant — avoids recreation on every render
const TITLE_COLORS = ['#08FFE2', '#BF2EF0', '#FFD700', '#FF3232', '#36E3C0', '#FF8C00', '#FFFFFF'];

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

const MOD_ACTIONS = ModerationService.MOD_ACTIONS;
const ROLES = ModerationService.ROLES;

const TABS = ['Members', 'Posts', 'Rooms', 'Mod Log', 'Reports'];

const STRIKE_OPTIONS = [
  { label: '1 Hour',   ms: ModerationService.STRIKE_DURATIONS.ONE_HOUR },
  { label: '6 Hours',  ms: ModerationService.STRIKE_DURATIONS.SIX_HOURS },
  { label: '12 Hours', ms: ModerationService.STRIKE_DURATIONS.TWELVE_HOURS },
  { label: '1 Day',    ms: ModerationService.STRIKE_DURATIONS.ONE_DAY },
  { label: '3 Days',   ms: ModerationService.STRIKE_DURATIONS.THREE_DAYS },
  { label: '1 Week',   ms: ModerationService.STRIKE_DURATIONS.ONE_WEEK },
  { label: 'Permanent',ms: ModerationService.STRIKE_DURATIONS.PERMANENT },
];

export default function CommunityModerationScreen({ route, navigation }) {
  const { communityId, initialTab = 0 } = route.params || {};
  const auth = getAuth(app);
  const currentUserId = auth.currentUser?.uid;

  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(Number(initialTab) || 0);
  const [actionLoading, setActionLoading] = useState(false);

  // Data
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [modLogs, setModLogs] = useState([]);

  // Community reports
  const [communityReports, setCommunityReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('all'); // all | pending | resolved

  // Strike modal
  const [strikeModal, setStrikeModal] = useState({ visible: false, user: null });
  const [selectedDuration, setSelectedDuration] = useState(STRIKE_OPTIONS[3]); // 1 Day default
  const [strikeReason, setStrikeReason] = useState('');

  // Reason modal (for ban/disable)
  const [reasonModal, setReasonModal] = useState({ visible: false, title: '', onConfirm: null });
  const [reasonText, setReasonText] = useState('');

  // Title modal
  const [titleModal, setTitleModal] = useState({ visible: false, user: null });
  const [titleText, setTitleText] = useState('');
  const [titleColor, setTitleColor] = useState('#08FFE2');

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadMembers = async () => {
    const commDoc = await getDoc(doc(db, 'communities', communityId));
    if (!commDoc.exists()) return;
    const commData = commDoc.data();
    const memberIds = commData.members || [];
    const batch = memberIds.slice(0, 100);
    const [userDocs, memberDocs, strikeDocs, banDocs] = await Promise.all([
      Promise.all(batch.map(id => getDoc(doc(db, 'users', id)))),
      // Nicknames live in communities_members/{uid}_{communityId}
      Promise.all(batch.map(id => getDoc(doc(db, 'communities_members', `${id}_${communityId}`)))),
      // Community-scoped strikes live in communities/{communityId}/strikes/{userId}
      Promise.all(batch.map(id => getDoc(doc(db, 'communities', communityId, 'strikes', id)))),
      // Community-scoped bans live in communities/{communityId}/bans/{userId}
      Promise.all(batch.map(id => getDoc(doc(db, 'communities', communityId, 'bans', id)))),
    ]);
    const now = Date.now();
    const result = userDocs
      .map((d, i) => {
        if (!d.exists()) return null;
        const userData = d.data();
        const nickname = memberDocs[i]?.exists() ? memberDocs[i].data()?.communityNickname : null;
        const baseDisplayName =
          userData.displayName ||
          (userData.firstName || userData.lastName
            ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
            : null) ||
          userData.username ||
          'User';
        // Community-scoped strike
        const strikeData = strikeDocs[i]?.exists() ? strikeDocs[i].data() : null;
        let communityIsStruck = false;
        if (strikeData?.isActive) {
          if (!strikeData.strikeExpiresAt) {
            communityIsStruck = true; // permanent
          } else {
            const expiresAt = strikeData.strikeExpiresAt?.toDate
              ? strikeData.strikeExpiresAt.toDate().getTime()
              : new Date(strikeData.strikeExpiresAt).getTime();
            communityIsStruck = expiresAt > now;
          }
        }
        // Community-scoped ban (from sub-collection — NOT the global users/{uid}.isBanned)
        const banData = banDocs[i]?.exists() ? banDocs[i].data() : null;
        let communityIsBanned = false;
        if (banData?.isActive) {
          if (!banData.banExpiresAt) {
            communityIsBanned = true; // permanent
          } else {
            const banExpiry = banData.banExpiresAt?.toDate
              ? banData.banExpiresAt.toDate().getTime()
              : new Date(banData.banExpiresAt).getTime();
            communityIsBanned = banExpiry > now;
          }
        }
        return {
          id: d.id,
          ...userData,
          displayName: (nickname && nickname.trim()) ? nickname.trim() : baseDisplayName,
          communityIsStruck,
          communityIsBanned,
        };
      })
      .filter(Boolean);
    setMembers(result);
  };

  const loadPosts = async () => {
    // Community posts are stored in the sub-collection, NOT a flat 'posts' collection
    const q = query(
      collection(db, 'communities', communityId, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const loadRooms = async () => {
    const snap = await getDocs(
      collection(db, 'communities', communityId, 'groups')
    );
    setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.isActive !== false));
  };

  const loadModLogs = async () => {
    const result = await ModerationService.getModerationHistory(db, communityId, 80);
    if (result.success) setModLogs(result.data);
  };

  // Always fetch ALL reports for this community (no status filter in Firestore).
  // Client-side filtering avoids missing composite indexes and supports
  // multi-status groups (e.g. pending = pending + under_review).
  const loadCommunityReports = async () => {
    const result = await getReportsForCommunity(communityId, { status: null, limitCount: 100 });
    if (result.success) setCommunityReports(result.reports);
  };

  // Derive the visible list from the cached full list + active filter.
  const PENDING_STATUSES  = new Set([REPORT_STATUS.PENDING, REPORT_STATUS.UNDER_REVIEW]);
  const RESOLVED_STATUSES = new Set([
    REPORT_STATUS.RESOLVED,
    REPORT_STATUS.ACTION_TAKEN,
    REPORT_STATUS.DISMISSED,
  ]);
  const filteredCommunityReports = communityReports.filter(r => {
    if (reportFilter === 'all')      return true;
    if (reportFilter === 'pending')  return PENDING_STATUSES.has(r.status);
    if (reportFilter === 'resolved') return RESOLVED_STATUSES.has(r.status);
    return true;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const role = await ModerationService.getCommunityRole(db, communityId, currentUserId);
      setMyRole(role);
      if (!role || role === ROLES.MEMBER) {
        Alert.alert('Access Denied', 'You must be a staff member to access this panel.');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }
      await Promise.all([loadMembers(), loadPosts(), loadRooms(), loadModLogs(), loadCommunityReports()]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [communityId, currentUserId]);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const can = (action) => ModerationService.hasPermission(myRole, action);

  const withReason = (title, onConfirm) => {
    setReasonText('');
    setReasonModal({ visible: true, title, onConfirm });
  };

  const doAction = async (fn) => {
    setActionLoading(true);
    try {
      await fn();
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Members Tab ───────────────────────────────────────────────────────────

  const renderMember = ({ item }) => {
    const isSelf = item.id === currentUserId;
    // Use community-scoped statuses (from sub-collections), not global user doc flags
    const isStruck = item.communityIsStruck || false;
    const isBanned = item.communityIsBanned || false;

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
          <View style={styles.statusRow}>
            {isStruck && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,140,0,0.2)', borderColor: C.orange }]}>
                <Text style={[styles.statusBadgeText, { color: C.orange }]}>Struck</Text>
              </View>
            )}
            {isBanned && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,50,50,0.2)', borderColor: C.red }]}>
                <Text style={[styles.statusBadgeText, { color: C.red }]}>Banned</Text>
              </View>
            )}
          </View>
        </View>
        {!isSelf && (
          <View style={styles.actionGroup}>
            {/* Strike / Unstrike */}
            {can(MOD_ACTIONS.STRIKE_USER) && !isStruck && (
              <ActionBtn
                icon="timer-outline"
                color={C.orange}
                onPress={() => {
                  setStrikeModal({ visible: true, user: item });
                  setStrikeReason('');
                  setSelectedDuration(STRIKE_OPTIONS[3]);
                }}
                tooltip="Strike"
              />
            )}
            {can(MOD_ACTIONS.UNSTRIKE_USER) && isStruck && (
              <ActionBtn
                icon="timer-off-outline"
                color={C.green}
                onPress={() => withReason(`Unstrike ${item.displayName}`, (reason) =>
                  doAction(() => ModerationService.unstrikeUser(db, currentUserId, communityId, item.id, reason))
                )}
                tooltip="Unstrike"
              />
            )}
            {/* Ban / Unban */}
            {can(MOD_ACTIONS.BAN_USER) && !item.communityIsBanned && (
              <ActionBtn
                icon="ban-outline"
                color={C.red}
                onPress={() => withReason(`Ban ${item.displayName}`, (reason) =>
                  doAction(() => ModerationService.banUser(db, currentUserId, communityId, item.id, reason))
                )}
                tooltip="Ban"
              />
            )}
            {can(MOD_ACTIONS.UNBAN_USER) && item.communityIsBanned && (
              <ActionBtn
                icon="checkmark-circle-outline"
                color={C.green}
                onPress={() => doAction(() =>
                  ModerationService.unbanUser(db, currentUserId, communityId, item.id)
                )}
                tooltip="Unban"
              />
            )}
            {/* Disable messages */}
            {can(MOD_ACTIONS.DISABLE_MESSAGES) && item.canMessage !== false && (
              <ActionBtn
                icon="chatbubble-ellipses-outline"
                color={C.yellow}
                onPress={() => withReason(`Disable messages for ${item.displayName}`, (reason) =>
                  doAction(() => ModerationService.disableUserMessages(db, currentUserId, communityId, item.id, reason))
                )}
                tooltip="Mute"
              />
            )}
            {can(MOD_ACTIONS.ENABLE_MESSAGES) && item.canMessage === false && (
              <ActionBtn
                icon="chatbubble-outline"
                color={C.green}
                onPress={() => doAction(() =>
                  ModerationService.enableUserMessages(db, currentUserId, communityId, item.id)
                )}
                tooltip="Unmute"
              />
            )}
            {/* Grant title */}
            {can(MOD_ACTIONS.GRANT_TITLE) && (
              <ActionBtn
                icon="ribbon-outline"
                color={C.brand}
                onPress={() => {
                  setTitleText('');
                  setTitleColor('#08FFE2');
                  setTitleModal({ visible: true, user: item });
                }}
                tooltip="Title"
              />
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Posts Tab ─────────────────────────────────────────────────────────────

  const renderPost = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>{item.content || item.text || '(no text)'}</Text>
        <View style={styles.statusRow}>
          {item.isDeleted && <StatusTag label="Removed" color={C.red} />}
          {item.isDisabled && <StatusTag label="Disabled" color={C.red} />}
          {item.isHidden && <StatusTag label="Hidden" color={C.yellow} />}
          {item.isFeatured && <StatusTag label="Featured" color={C.cyan} />}
        </View>
      </View>
      <View style={styles.actionGroup}>
        {can(MOD_ACTIONS.FEATURE_POST) && !item.isFeatured && (
          <ActionBtn icon="star-outline" color={C.cyan} onPress={() =>
            doAction(() => ModerationService.featurePost(db, currentUserId, communityId, item.id))
          } tooltip="Feature" />
        )}
        {can(MOD_ACTIONS.UNFEATURE_POST) && item.isFeatured && (
          <ActionBtn icon="star" color={C.dim} onPress={() =>
            doAction(() => ModerationService.unfeaturePost(db, currentUserId, communityId, item.id))
          } tooltip="Unfeature" />
        )}
        {can(MOD_ACTIONS.HIDE_POST) && !item.isHidden && !item.isDisabled && (
          <ActionBtn icon="eye-off-outline" color={C.yellow} onPress={() =>
            withReason('Hide Post', (reason) =>
              doAction(() => ModerationService.hidePost(db, currentUserId, communityId, item.id, reason))
            )
          } tooltip="Hide" />
        )}
        {can(MOD_ACTIONS.UNHIDE_POST) && item.isHidden && (
          <ActionBtn icon="eye-outline" color={C.green} onPress={() =>
            doAction(() => ModerationService.unhidePost(db, currentUserId, communityId, item.id))
          } tooltip="Unhide" />
        )}
        {can(MOD_ACTIONS.DISABLE_POST) && !item.isDisabled && (
          <ActionBtn icon="close-circle-outline" color={C.red} onPress={() =>
            withReason('Disable Post', (reason) =>
              doAction(() => ModerationService.disablePost(db, currentUserId, communityId, item.id, reason))
            )
          } tooltip="Disable" />
        )}
        {can(MOD_ACTIONS.ENABLE_POST) && item.isDisabled && (
          <ActionBtn icon="checkmark-circle-outline" color={C.green} onPress={() =>
            doAction(() => ModerationService.enablePost(db, currentUserId, communityId, item.id))
          } tooltip="Enable" />
        )}
      </View>
    </View>
  );

  // ── Rooms Tab ─────────────────────────────────────────────────────────────

  const renderRoom = ({ item }) => (
    <View style={styles.card}>
      <MaterialCommunityIcons name="forum" size={36} color={C.brand} style={{ marginRight: 12 }} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name || item.title || 'Chat Room'}</Text>
        <View style={styles.statusRow}>
          {item.isDisabled && <StatusTag label="Disabled" color={C.red} />}
          {item.isFeatured && <StatusTag label="Featured" color={C.cyan} />}
        </View>
      </View>
      <View style={styles.actionGroup}>
        {can(MOD_ACTIONS.FEATURE_ROOM) && !item.isFeatured && (
          <ActionBtn icon="star-outline" color={C.cyan} onPress={() =>
            doAction(() => ModerationService.featureChatRoom(db, currentUserId, communityId, item.id))
          } tooltip="Feature" />
        )}
        {can(MOD_ACTIONS.UNFEATURE_ROOM) && item.isFeatured && (
          <ActionBtn icon="star" color={C.dim} onPress={() =>
            doAction(() => ModerationService.unfeatureChatRoom(db, currentUserId, communityId, item.id))
          } tooltip="Unfeature" />
        )}
        {can(MOD_ACTIONS.DISABLE_ROOM) && !item.isDisabled && (
          <ActionBtn icon="close-circle-outline" color={C.red} onPress={() =>
            withReason('Disable Room', (reason) =>
              doAction(() => ModerationService.disableChatRoom(db, currentUserId, communityId, item.id, reason))
            )
          } tooltip="Disable" />
        )}
        {can(MOD_ACTIONS.ENABLE_ROOM) && item.isDisabled && (
          <ActionBtn icon="checkmark-circle-outline" color={C.green} onPress={() =>
            doAction(() => ModerationService.enableChatRoom(db, currentUserId, communityId, item.id))
          } tooltip="Enable" />
        )}
      </View>
    </View>
  );

  // ── Mod Log Tab ───────────────────────────────────────────────────────────

  const ACTION_COLORS = {
    [MOD_ACTIONS.BAN_USER]:       C.red,
    [MOD_ACTIONS.STRIKE_USER]:    C.orange,
    [MOD_ACTIONS.DISABLE_POST]:   C.yellow,
    [MOD_ACTIONS.FEATURE_POST]:   C.cyan,
    [MOD_ACTIONS.PROMOTE_TO_LEADER]: C.gold,
    [MOD_ACTIONS.PROMOTE_TO_CURATOR]: C.brand,
  };

  const renderLogEntry = ({ item }) => {
    const color = ACTION_COLORS[item.action] || C.dim;
    const ts = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : '';
    return (
      <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: color }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.logAction, { color }]}>{item.action.replace(/_/g, ' ').toUpperCase()}</Text>
          {item.reason ? <Text style={styles.logReason}>"{item.reason}"</Text> : null}
          <Text style={styles.logMeta}>
            by {item.performedByRole} • {ts}
          </Text>
        </View>
      </View>
    );
  };

  // ── Reports Tab ─────────────────────────────────────────────────────────

  const STATUS_COLORS = {
    [REPORT_STATUS.PENDING]:      C.yellow,
    [REPORT_STATUS.UNDER_REVIEW]: C.orange,
    [REPORT_STATUS.RESOLVED]:     C.green,
    [REPORT_STATUS.ACTION_TAKEN]: C.cyan,
    [REPORT_STATUS.DISMISSED]:    C.dim,
  };

  const handleReportAction = async (reportId, action) => {
    await doAction(() => takeCommunityStaffAction(reportId, currentUserId, action, ''));
    // Reload both reports and posts so the UI reflects the removal immediately
    await Promise.all([loadCommunityReports(), loadPosts()]);
  };

  const renderReport = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || C.dim;
    const ts = item.createdAt instanceof Date
      ? item.createdAt.toLocaleString()
      : '';
    const isPending = item.status === REPORT_STATUS.PENDING ||
                      item.status === REPORT_STATUS.UNDER_REVIEW;
    return (
      <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-start' }]}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { fontSize: 13 }]}>
              {item.reasonLabel || item.reason || 'Report'}
            </Text>
            <Text style={[styles.logMeta, { marginTop: 2 }]}>
              by {item.reporterUsername || 'Anonymous'} · {ts}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {item.status?.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Content preview */}
        {!!item.contentPreview && (
          <View style={styles.reportPreviewBox}>
            <Text style={styles.reportPreviewText} numberOfLines={2}>{item.contentPreview}</Text>
          </View>
        )}
        {!!item.description && (
          <Text style={[styles.logReason, { marginTop: 4 }]}>"{item.description}"</Text>
        )}

        {/* Type & Content badges */}
        <View style={[styles.statusRow, { marginTop: 6 }]}>
          <StatusTag label={item.reportType || 'user'} color={C.brand} />
          {item.priority === 'high' && <StatusTag label="HIGH" color={C.red} />}
          {item.priority === 'medium' && <StatusTag label="MED" color={C.orange} />}
        </View>

        {/* Action buttons — only for unresolved reports */}
        {isPending && can(MOD_ACTIONS.RESOLVE_FLAG) && (
          <View style={[styles.actionGroup, { marginTop: 10, maxWidth: '100%', width: '100%' }]}>
            <TouchableOpacity
              style={[styles.reportActionBtn, { borderColor: C.dim }]}
              onPress={() => handleReportAction(item.id, 'reviewed')}
            >
              <Ionicons name="eye-outline" size={14} color={C.dim} />
              <Text style={[styles.reportActionBtnText, { color: C.dim }]}>Mark Reviewed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reportActionBtn, { borderColor: C.green }]}
              onPress={() => handleReportAction(item.id, 'dismissed')}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
              <Text style={[styles.reportActionBtnText, { color: C.green }]}>Dismiss</Text>
            </TouchableOpacity>
            {(item.reportType === 'post' || item.reportType === 'comment') && (
              <TouchableOpacity
                style={[styles.reportActionBtn, { borderColor: C.red }]}
                onPress={() => handleReportAction(item.id, 'content_removed')}
              >
                <Ionicons name="trash-outline" size={14} color={C.red} />
                <Text style={[styles.reportActionBtnText, { color: C.red }]}>Remove Content</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.cyan} />
      </View>
    );
  }

  const tabData = [members, posts, rooms, modLogs, filteredCommunityReports];
  const tabRenderers = [renderMember, renderPost, renderRoom, renderLogEntry, renderReport];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderation Panel</Text>
        <RoleBadge role={myRole} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(i)}
            style={[styles.tabItem, activeTab === i && styles.tabItemActive]}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Reports filter pills — visible only on Reports tab */}
      {activeTab === 4 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8, flexGrow: 0 }}>
          {['all', 'pending', 'resolved'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => {
                setReportFilter(f);
              }}
              style={[
                styles.durationChip,
                reportFilter === f && { backgroundColor: C.brand, borderColor: C.brand },
              ]}
            >
              <Text style={[
                styles.durationChipText,
                reportFilter === f && { color: '#fff' },
              ]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      {actionLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={C.cyan} />
          <Text style={styles.loadingBarText}>Processing…</Text>
        </View>
      )}

      <FlatList
        data={tabData[activeTab]}
        keyExtractor={item => item.id}
        renderItem={tabRenderers[activeTab]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
      />

      {/* Strike Modal */}
      <Modal
        visible={strikeModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setStrikeModal({ visible: false, user: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Strike {strikeModal.user?.displayName}
            </Text>
            <Text style={styles.modalSubtitle}>
              User will be in view-only mode (cannot post, message, follow, or create content).
            </Text>

            {/* Duration picker */}
            <Text style={styles.fieldLabel}>Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {STRIKE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => setSelectedDuration(opt)}
                  style={[
                    styles.durationChip,
                    selectedDuration.label === opt.label && styles.durationChipActive,
                  ]}
                >
                  <Text style={[
                    styles.durationChipText,
                    selectedDuration.label === opt.label && styles.durationChipTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Reason */}
            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="What rule was broken?"
              placeholderTextColor={C.dim}
              value={strikeReason}
              onChangeText={setStrikeReason}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setStrikeModal({ visible: false, user: null })}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setStrikeModal({ visible: false, user: null });
                  await doAction(() => ModerationService.strikeUser(
                    db, currentUserId, communityId,
                    strikeModal.user.id, selectedDuration.ms, strikeReason
                  ));
                }}
                style={[styles.confirmBtn, { backgroundColor: C.orange }]}
                disabled={actionLoading}
              >
                <Text style={styles.confirmBtnText}>Strike</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reason Modal (generic) */}
      <Modal
        visible={reasonModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonModal({ visible: false, title: '', onConfirm: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{reasonModal.title}</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason (optional)"
              placeholderTextColor={C.dim}
              value={reasonText}
              onChangeText={setReasonText}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setReasonModal({ visible: false, title: '', onConfirm: null })}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const cb = reasonModal.onConfirm;
                  setReasonModal({ visible: false, title: '', onConfirm: null });
                  cb?.(reasonText);
                }}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Title Modal */}
      <Modal
        visible={titleModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setTitleModal({ visible: false, user: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Grant Title to {titleModal.user?.displayName}</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Title text (e.g. Legendary Artist)"
              placeholderTextColor={C.dim}
              value={titleText}
              onChangeText={setTitleText}
            />
            {/* Color picker */}
            <Text style={styles.fieldLabel}>Title Color</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {TITLE_COLORS.map(col => (
                <TouchableOpacity
                  key={col}
                  onPress={() => setTitleColor(col)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: col },
                    titleColor === col && styles.colorDotSelected,
                  ]}
                />
              ))}
            </View>
            {titleText ? (
              <Text style={[styles.titlePreview, { color: titleColor }]}>{titleText}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setTitleModal({ visible: false, user: null })}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!titleText.trim()) return;
                  setTitleModal({ visible: false, user: null });
                  await doAction(() =>
                    ModerationService.grantTitle(db, currentUserId, communityId, titleModal.user.id, titleText.trim(), titleColor)
                  );
                }}
                style={[styles.confirmBtn, { backgroundColor: titleColor }]}
              >
                <Text style={[styles.confirmBtnText, { color: '#000' }]}>Grant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionBtn({ icon, color, onPress, tooltip }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.iconBtn, { borderColor: color }]}>
      <Ionicons name={icon} size={18} color={color} />
    </TouchableOpacity>
  );
}

function StatusTag({ label, color }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function RoleBadge({ role }) {
  const meta = {
    owner:   { label: 'Owner',   color: '#FFB800' },
    leader:  { label: 'Leader',  color: '#BF2EF0' },
    curator: { label: 'Curator', color: '#08FFE2' },
  };
  const m = meta[role];
  if (!m) return null;
  return (
    <View style={[styles.rolePill, { borderColor: m.color }]}>
      <Text style={[styles.rolePillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  headerTitle:      { flex: 1, fontSize: 18, fontWeight: '700', color: C.text },
  rolePill:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  rolePillText:     { fontSize: 12, fontWeight: '700' },

  // Tabs
  tabBar:           { paddingHorizontal: 16, marginBottom: 12, flexGrow: 0 },
  tabItem:          { marginRight: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:    { borderBottomColor: C.cyan },
  tabText:          { color: C.dim, fontSize: 14, fontWeight: '600' },
  tabTextActive:    { color: C.cyan },

  loadingBar:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  loadingBarText:   { color: C.dim, fontSize: 13 },

  // Cards
  card:             { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  avatar:           { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  cardInfo:         { flex: 1, marginRight: 8 },
  cardName:         { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 4 },
  statusRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBadge:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  statusBadgeText:  { fontSize: 10, fontWeight: '700' },
  actionGroup:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: 110 },
  iconBtn:          { borderWidth: 1, borderRadius: 8, padding: 5 },
  empty:            { color: C.dim, textAlign: 'center', marginTop: 32 },

  // Mod log
  logAction:        { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  logReason:        { fontSize: 12, color: C.dim, marginTop: 2, fontStyle: 'italic' },
  logMeta:          { fontSize: 11, color: C.dim, marginTop: 2 },

  // Community reports
  reportPreviewBox: { backgroundColor: '#111827', borderRadius: 8, padding: 10, width: '100%' },
  reportPreviewText:{ color: C.dim, fontSize: 12 },
  reportActionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  reportActionBtnText:{ fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:       { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6 },
  modalSubtitle:    { fontSize: 13, color: C.dim, marginBottom: 16 },
  fieldLabel:       { fontSize: 12, color: C.dim, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonInput:      { backgroundColor: '#111827', borderRadius: 10, padding: 12, color: C.text, minHeight: 70, textAlignVertical: 'top', marginBottom: 16, fontSize: 14 },
  durationChip:     { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  durationChipActive:{ backgroundColor: C.orange, borderColor: C.orange },
  durationChipText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  durationChipTextActive:{ color: '#000' },
  modalActions:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:        { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center' },
  cancelBtnText:    { color: C.dim, fontWeight: '600' },
  confirmBtn:       { flex: 1, backgroundColor: C.cyan, borderRadius: 10, padding: 14, alignItems: 'center' },
  confirmBtnText:   { color: '#000', fontWeight: '700' },

  // Title
  colorDot:         { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  titlePreview:     { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
});
