// screens/TransferAdminScreen.js
// Transfer community admin ownership to another member.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const C = {
  bg:     '#0B0B10',
  card:   '#1A1F27',
  border: '#242A33',
  text:   '#EAEAF0',
  dim:    '#A2A8B3',
  brand:  '#BF2EF0',
  gold:   '#FFB800',
  red:    '#FF3232',
  green:  '#36E3C0',
  warning:'#F59E0B',
};

function Avatar({ uri, displayName, size = 44 }) {
  const initials = (displayName || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

export default function TransferAdminScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [members, setMembers] = useState([]);
  const [communityName, setCommunityName] = useState('');
  const [search, setSearch] = useState('');

  const loadMembers = useCallback(async () => {
    if (!communityId || !currentUserId) return;
    setLoading(true);
    try {
      // 1. Fetch community doc for name + member arrays
      const commSnap = await getDoc(doc(db, 'communities', communityId));
      if (!commSnap.exists()) {
        Alert.alert('Error', 'Community not found.');
        navigation.goBack();
        return;
      }
      const commData = commSnap.data();
      setCommunityName(commData.name || commData.title || 'Community');

      // 2. Collect all member IDs from all sources, excluding current admin
      const arrayMembers = new Set([
        ...(commData.members || []),
        ...(commData.memberIds || []),
        ...(commData.leaders || []),
        ...(commData.curators || []),
        ...(commData.moderators || []),
      ]);
      // Remove current admin so they cannot transfer to themselves
      arrayMembers.delete(currentUserId);

      // 3. Also query communities_members collection as primary source
      const memberQuery = query(
        collection(db, 'communities_members'),
        where('community_id', '==', communityId)
      );
      const memberSnap = await getDocs(memberQuery);
      memberSnap.docs.forEach(d => {
        const uid = d.data().user_id || d.data().userId;
        if (uid && uid !== currentUserId) arrayMembers.add(uid);
      });

      if (arrayMembers.size === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // 4. Fetch user docs in batches of 10 (Firestore 'in' limit)
      const allIds = Array.from(arrayMembers);
      const batches = [];
      for (let i = 0; i < allIds.length; i += 10) {
        batches.push(allIds.slice(i, i + 10));
      }

      const resolvedMembers = [];
      await Promise.all(
        batches.map(async (batch) => {
          const [userDocs, nickDocs] = await Promise.all([
            Promise.all(batch.map(id => getDoc(doc(db, 'users', id)))),
            Promise.all(batch.map(id =>
              getDoc(doc(db, 'communities_members', `${id}_${communityId}`))
            )),
          ]);
          userDocs.forEach((userDoc, idx) => {
            if (!userDoc.exists()) return;
            const data = userDoc.data();
            const nickname = nickDocs[idx]?.exists()
              ? nickDocs[idx].data()?.communityNickname
              : null;
            const displayName =
              (nickname && nickname.trim()) ||
              data.displayName ||
              (data.firstName || data.lastName
                ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
                : null) ||
              data.username ||
              'User';
            resolvedMembers.push({
              id: userDoc.id,
              displayName,
              photoURL: data.photoURL || data.profilePicture || null,
              username: data.username || '',
            });
          });
        })
      );

      // Sort alphabetically
      resolvedMembers.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setMembers(resolvedMembers);
    } catch (err) {
      console.error('TransferAdminScreen loadMembers error:', err);
      Alert.alert('Error', 'Could not load members. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [communityId, currentUserId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter(
      m =>
        m.displayName.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q)
    );
  }, [members, search]);

  const confirmTransfer = (targetMember) => {
    Alert.alert(
      'Transfer Admin Ownership',
      `Are you sure you want to transfer admin ownership to ${targetMember.displayName}?\n\nThis action cannot be undone. You will lose admin privileges.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: () => executeTransfer(targetMember),
        },
      ]
    );
  };

  const executeTransfer = async (targetMember) => {
    setTransferring(true);
    try {
      const communityRef = doc(db, 'communities', communityId);
      const commSnap = await getDoc(communityRef);
      if (!commSnap.exists()) throw new Error('Community not found.');

      const commData = commSnap.data();

      // ── 1. Rebuild adminIds: remove old admin, add new admin ──────────────
      // groupinfo.js uses adminIds as the sole source of truth for admin access.
      const existingAdminIds = Array.isArray(commData.adminIds)
        ? commData.adminIds
        : Array.isArray(commData.admins)
          ? commData.admins
          : commData.creatorId
            ? [commData.creatorId]
            : [];

      const newAdminIds = [
        ...existingAdminIds.filter(id => id !== currentUserId),
        targetMember.id,
      ].filter((id, idx, arr) => arr.indexOf(id) === idx); // deduplicate

      // ── 2. Build Firestore update payload ─────────────────────────────────
      const updatePayload = {
        creatorId:  targetMember.id,   // moderationService uses this for OWNER role
        adminIds:   newAdminIds,       // groupinfo.js uses this for admin UI check
        updatedAt:  serverTimestamp(),
      };
      // Also sync any legacy/alternate owner fields that exist on the doc
      if ('createdBy'       in commData) updatePayload.createdBy       = targetMember.id;
      if ('ownerId'         in commData) updatePayload.ownerId         = targetMember.id;
      if ('community_admin' in commData) updatePayload.community_admin = targetMember.id;
      if ('admins'          in commData) updatePayload.admins          = newAdminIds;
      // Remove old admin from leader/curator arrays if they appear there
      if (Array.isArray(commData.leaders)  && commData.leaders.includes(currentUserId))
        updatePayload.leaders  = commData.leaders.filter(id => id !== currentUserId);
      if (Array.isArray(commData.curators) && commData.curators.includes(currentUserId))
        updatePayload.curators = commData.curators.filter(id => id !== currentUserId);

      await updateDoc(communityRef, updatePayload);

      // ── 3. Update communities_members role records (both users) ───────────
      // These records drive role badges and member-list role display.
      try {
        await Promise.all([
          setDoc(
            doc(db, 'communities_members', `${currentUserId}_${communityId}`),
            { role: 'member', updatedAt: serverTimestamp() },
            { merge: true }
          ),
          setDoc(
            doc(db, 'communities_members', `${targetMember.id}_${communityId}`),
            {
              user_id:       targetMember.id,
              community_id:  communityId,
              role:          'owner',
              updatedAt:     serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      } catch (memberErr) {
        // Non-fatal — role display may lag until next sync
        console.warn('TransferAdmin: communities_members update failed:', memberErr);
      }

      // ── 4. Audit log ──────────────────────────────────────────────────────
      try {
        await addDoc(collection(db, 'admin_actions'), {
          action:              'transfer_admin',
          communityId,
          actorId:             currentUserId,
          targetUserId:        targetMember.id,
          targetDisplayName: targetMember.displayName,
          createdAt: serverTimestamp(),
        });
      } catch (_) {
        // audit log failure is non-fatal
      }

      Alert.alert(
        'Admin Transferred',
        `${targetMember.displayName} is now the admin of ${communityName}.`,
        [{ text: 'OK', onPress: () => navigation.navigate('TabBar') }]
      );
    } catch (err) {
      console.error('TransferAdmin executeTransfer error:', err);
      Alert.alert('Transfer Failed', err.message || 'An error occurred. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const renderMember = ({ item }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => confirmTransfer(item)}
      activeOpacity={0.7}
      disabled={transferring}
    >
      <Avatar uri={item.photoURL} displayName={item.displayName} size={46} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>{item.displayName}</Text>
        {item.username ? (
          <Text style={styles.memberUsername} numberOfLines={1}>@{item.username}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.dim} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Transfer Admin</Text>
          {communityName ? (
            <Text style={styles.headerSub} numberOfLines={1}>{communityName}</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Warning Banner */}
      <View style={styles.warningBanner}>
        <Ionicons name="warning-outline" size={18} color={C.warning} />
        <Text style={styles.warningText}>
          Selecting a member will transfer full admin ownership. This cannot be undone.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={C.dim} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          placeholderTextColor={C.dim}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.dim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Member count */}
      {!loading && (
        <Text style={styles.countText}>
          {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
        </Text>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      ) : filteredMembers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={52} color={C.dim} />
          <Text style={styles.emptyText}>
            {search.trim() ? 'No members match your search.' : 'No other members found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={item => item.id}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews
        />
      )}

      {/* Full-screen transferring overlay */}
      {transferring && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.overlayText}>Transferring ownership...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    color: C.dim,
    fontSize: 12,
    marginTop: 2,
  },
  /* ── Warning Banner ── */
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1F1A0D',
    borderLeftWidth: 3,
    borderLeftColor: C.warning,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: C.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  /* ── Search ── */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
  },
  /* ── Count ── */
  countText: {
    color: C.dim,
    fontSize: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 2,
  },
  /* ── List ── */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  memberUsername: {
    color: C.dim,
    fontSize: 12,
    marginTop: 2,
  },
  /* ── Avatar fallback ── */
  avatarFallback: {
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  /* ── States ── */
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  loadingText: {
    color: C.dim,
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    color: C.dim,
    marginTop: 14,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  /* ── Overlay ── */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  overlayText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
