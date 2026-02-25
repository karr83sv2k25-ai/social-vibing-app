/**
 * moderationService.js
 *
 * Amino-style role & moderation system with Discord-inspired Strike (timeout) mechanic.
 *
 * ROLE HIERARCHY
 * ──────────────
 * Owner/Admin  → app-wide super admin
 * Leader       → community-level: full moderation suite
 * Curator      → community-level: limited moderation (hide/unhide, feature, disable/enable posts)
 * Member       → regular user
 *
 * LEADER PERMISSIONS
 * ──────────────────
 *   disable_post, enable_post, hide_post, unhide_post, feature_post, unfeature_post
 *   ban_user, unban_user
 *   strike_user, unstrike_user
 *   feature_room, unfeature_room, disable_room, enable_room
 *   disable_messages (user)
 *   grant_title, revoke_title, change_title_color
 *   handle_wiki, handle_sticker_pack
 *   resolve_flag
 *   promote_curator, demote_curator
 *   get_promoted, accept_promotion, get_demoted
 *
 * CURATOR PERMISSIONS
 * ───────────────────
 *   disable_post, enable_post, hide_post, unhide_post, feature_post
 *   feature_room, disable_room
 *   get_promoted, accept_promotion, get_demoted
 *
 * STRIKE SYSTEM (= Discord Timeout)
 * ───────────────────────────────────
 * When a user is struck they enter VIEW-ONLY mode:
 *   ✗ post / reply / comment
 *   ✗ send / respond to messages
 *   ✗ follow / unfollow
 *   ✗ create content, groups, private messages
 *   ✗ receive interactive notifications
 *   ✓ read/browse all public content
 */

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────

export const ROLES = {
  OWNER:   'owner',    // app-level super admin
  ADMIN:   'admin',    // app-level admin
  LEADER:  'leader',   // community level – top staff
  CURATOR: 'curator',  // community level – junior staff
  MEMBER:  'member',   // regular user
};

export const MOD_ACTIONS = {
  // Post actions
  DISABLE_POST:       'disable_post',
  ENABLE_POST:        'enable_post',
  HIDE_POST:          'hide_post',
  UNHIDE_POST:        'unhide_post',
  FEATURE_POST:       'feature_post',
  UNFEATURE_POST:     'unfeature_post',
  // Room actions
  FEATURE_ROOM:       'feature_room',
  UNFEATURE_ROOM:     'unfeature_room',
  DISABLE_ROOM:       'disable_room',
  ENABLE_ROOM:        'enable_room',
  // User actions
  BAN_USER:           'ban_user',
  UNBAN_USER:         'unban_user',
  STRIKE_USER:        'strike_user',
  UNSTRIKE_USER:      'unstrike_user',
  DISABLE_MESSAGES:   'disable_messages',
  ENABLE_MESSAGES:    'enable_messages',
  // Title actions
  GRANT_TITLE:        'grant_title',
  REVOKE_TITLE:       'revoke_title',
  CHANGE_TITLE_COLOR: 'change_title_color',
  // Content management
  HANDLE_WIKI:        'handle_wiki',
  HANDLE_STICKER_PACK:'handle_sticker_pack',
  RESOLVE_FLAG:       'resolve_flag',
  // Staff management
  PROMOTE_TO_LEADER:  'promote_to_leader',
  PROMOTE_TO_CURATOR: 'promote_to_curator',
  DEMOTE_LEADER:      'demote_leader',
  DEMOTE_CURATOR:     'demote_curator',
  ACCEPT_PROMOTION:   'accept_promotion',
};

export const STRIKE_DURATIONS = {
  ONE_HOUR:    60 * 60 * 1000,
  SIX_HOURS:   6 * 60 * 60 * 1000,
  TWELVE_HOURS:12 * 60 * 60 * 1000,
  ONE_DAY:     24 * 60 * 60 * 1000,
  THREE_DAYS:  3 * 24 * 60 * 60 * 1000,
  ONE_WEEK:    7 * 24 * 60 * 60 * 1000,
  PERMANENT:   null,
};

export const STRIKE_DURATION_LABELS = {
  [STRIKE_DURATIONS.ONE_HOUR]:    '1 Hour',
  [STRIKE_DURATIONS.SIX_HOURS]:   '6 Hours',
  [STRIKE_DURATIONS.TWELVE_HOURS]:'12 Hours',
  [STRIKE_DURATIONS.ONE_DAY]:     '1 Day',
  [STRIKE_DURATIONS.THREE_DAYS]:  '3 Days',
  [STRIKE_DURATIONS.ONE_WEEK]:    '1 Week',
  [STRIKE_DURATIONS.PERMANENT]:   'Permanent',
};

// ─────────────────────────────────────────
// PERMISSION MATRIX
// ─────────────────────────────────────────

const LEADER_PERMISSIONS = new Set([
  MOD_ACTIONS.DISABLE_POST,
  MOD_ACTIONS.ENABLE_POST,
  MOD_ACTIONS.HIDE_POST,
  MOD_ACTIONS.UNHIDE_POST,
  MOD_ACTIONS.FEATURE_POST,
  MOD_ACTIONS.UNFEATURE_POST,
  MOD_ACTIONS.FEATURE_ROOM,
  MOD_ACTIONS.UNFEATURE_ROOM,
  MOD_ACTIONS.DISABLE_ROOM,
  MOD_ACTIONS.ENABLE_ROOM,
  MOD_ACTIONS.BAN_USER,
  MOD_ACTIONS.UNBAN_USER,
  MOD_ACTIONS.STRIKE_USER,
  MOD_ACTIONS.UNSTRIKE_USER,
  MOD_ACTIONS.DISABLE_MESSAGES,
  MOD_ACTIONS.ENABLE_MESSAGES,
  MOD_ACTIONS.GRANT_TITLE,
  MOD_ACTIONS.REVOKE_TITLE,
  MOD_ACTIONS.CHANGE_TITLE_COLOR,
  MOD_ACTIONS.HANDLE_WIKI,
  MOD_ACTIONS.HANDLE_STICKER_PACK,
  MOD_ACTIONS.RESOLVE_FLAG,
  MOD_ACTIONS.PROMOTE_TO_CURATOR,
  MOD_ACTIONS.DEMOTE_CURATOR,
]);

const CURATOR_PERMISSIONS = new Set([
  MOD_ACTIONS.DISABLE_POST,
  MOD_ACTIONS.ENABLE_POST,
  MOD_ACTIONS.HIDE_POST,
  MOD_ACTIONS.UNHIDE_POST,
  MOD_ACTIONS.FEATURE_POST,
  MOD_ACTIONS.FEATURE_ROOM,
  MOD_ACTIONS.DISABLE_ROOM,
]);

export const hasPermission = (role, action) => {
  if (role === ROLES.OWNER || role === ROLES.ADMIN) return true;
  if (role === ROLES.LEADER) return LEADER_PERMISSIONS.has(action);
  if (role === ROLES.CURATOR) return CURATOR_PERMISSIONS.has(action);
  return false;
};

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

/**
 * Get the current user's role in a specific community.
 * Checks community doc arrays: leaders[], curators[], creatorId
 */
export const getCommunityRole = async (db, communityId, userId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    if (!communityDoc.exists()) return null;
    const d = communityDoc.data();
    if (d.creatorId === userId) return ROLES.OWNER;
    if ((d.leaders || []).includes(userId)) return ROLES.LEADER;
    if ((d.curators || []).includes(userId)) return ROLES.CURATOR;
    if ((d.members || []).includes(userId)) return ROLES.MEMBER;
    return null;
  } catch (e) {
    console.error('getCommunityRole error:', e);
    return null;
  }
};

/**
 * Get the app-wide role of a user (stored on users/{uid}.role).
 */
export const getGlobalRole = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return ROLES.MEMBER;
    return userDoc.data().role || ROLES.MEMBER;
  } catch (e) {
    return ROLES.MEMBER;
  }
};

/**
 * Check if a user is currently struck (in view-only mode).
 * Checks the global user doc for app-wide strikes.
 */
export const isUserStruck = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;
    const data = userDoc.data();
    if (!data.isStruck) return false;
    // Auto-expire: if strikeExpiresAt is in the past, strike has lifted
    if (data.strikeExpiresAt) {
      const expiresAt = data.strikeExpiresAt.toDate
        ? data.strikeExpiresAt.toDate()
        : new Date(data.strikeExpiresAt);
      if (expiresAt <= new Date()) {
        // Expired – auto-lift
        await updateDoc(doc(db, 'users', userId), {
          isStruck: false,
          strikeExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Check if a user is banned.
 */
export const isUserBanned = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;
    const data = userDoc.data();
    if (!data.isBanned) return false;
    if (data.banExpiresAt) {
      const expiresAt = data.banExpiresAt.toDate
        ? data.banExpiresAt.toDate()
        : new Date(data.banExpiresAt);
      if (expiresAt <= new Date()) {
        await updateDoc(doc(db, 'users', userId), {
          isBanned: false,
          banExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
};

/** Write a moderation log entry. */
const logAction = async (db, {
  action, communityId = null, targetUserId = null,
  targetPostId = null, targetRoomId = null,
  performedBy, performedByRole, reason = '', metadata = {},
}) => {
  try {
    await addDoc(collection(db, 'moderationLogs'), {
      action,
      communityId,
      targetUserId,
      targetPostId,
      targetRoomId,
      performedBy,
      performedByRole,
      reason,
      metadata,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('logAction failed (non-critical):', e.message);
  }
};

/** Assert that actorId has the given action permission in community (or globally). */
const assertPermission = async (db, actorId, communityId, action) => {
  let role = communityId
    ? await getCommunityRole(db, communityId, actorId)
    : await getGlobalRole(db, actorId);
  if (!role || !hasPermission(role, action)) {
    throw new Error(`User does not have permission to perform: ${action}`);
  }
  return role;
};

// ─────────────────────────────────────────
// STRIKE SYSTEM
// ─────────────────────────────────────────

/**
 * Strike a user (view-only mode / Discord timeout).
 * @param {object} db  Firestore instance
 * @param {string} actorId  The staff member performing the action
 * @param {string} communityId  Community context (can be null for global)
 * @param {string} targetUserId  The user to strike
 * @param {number|null} durationMs  Duration in ms (null = permanent)
 * @param {string} reason  Reason for the strike
 */
export const strikeUser = async (db, actorId, communityId, targetUserId, durationMs, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.STRIKE_USER);

  const strikeExpiresAt = durationMs
    ? Timestamp.fromDate(new Date(Date.now() + durationMs))
    : null;

  if (communityId) {
    // Community-scoped strike — write ONLY to the sub-collection + bump global counter.
    // Writing isStruck to the global user doc would incorrectly block the user in
    // every other community and on the platform level.
    await updateDoc(doc(db, 'users', targetUserId), {
      strikeCount: increment(1),
      lastStrikeAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(
      doc(db, 'communities', communityId, 'strikes', targetUserId),
      {
        userId: targetUserId,
        isActive: true,
        strikeExpiresAt,
        reason,
        struckBy: actorId,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    // Platform-wide (admin-level) strike — write to global user doc.
    await updateDoc(doc(db, 'users', targetUserId), {
      isStruck: true,
      strikeCount: increment(1),
      lastStrikeAt: serverTimestamp(),
      strikeExpiresAt,
      strikeReason: reason,
      struckBy: actorId,
      updatedAt: serverTimestamp(),
    });
  }

  await logAction(db, {
    action: MOD_ACTIONS.STRIKE_USER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
    metadata: { durationMs, strikeExpiresAt },
  });

  return { success: true };
};

/**
 * Lift a strike from a user.
 */
export const unstrikeUser = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNSTRIKE_USER);

  if (communityId) {
    // Community-scoped unstrike — only update the sub-collection record.
    // Do NOT touch the global user doc; the user was never globally struck.
    const strikeRef = doc(db, 'communities', communityId, 'strikes', targetUserId);
    await updateDoc(strikeRef, { isActive: false, liftedAt: serverTimestamp(), liftedBy: actorId });
  } else {
    // Platform-wide (admin-level) unstrike — clear global user doc flags.
    // Do NOT touch canMessage; it may be controlled by disableUserMessages separately.
    await updateDoc(doc(db, 'users', targetUserId), {
      isStruck: false,
      strikeExpiresAt: null,
      strikeReason: null,
      struckBy: null,
      updatedAt: serverTimestamp(),
    });
  }

  await logAction(db, {
    action: MOD_ACTIONS.UNSTRIKE_USER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
  });

  return { success: true };
};

// ─────────────────────────────────────────
// BAN SYSTEM
// ─────────────────────────────────────────

export const banUser = async (db, actorId, communityId, targetUserId, reason = '', banExpiresAt = null) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.BAN_USER);

  const updates = {
    isBanned: true,
    banReason: reason,
    bannedAt: serverTimestamp(),
    bannedBy: actorId,
    banExpiresAt: banExpiresAt ? Timestamp.fromDate(new Date(banExpiresAt)) : null,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'users', targetUserId), updates);

  // Remove from community members if community-scoped
  if (communityId) {
    await updateDoc(doc(db, 'communities', communityId), {
      members: arrayRemove(targetUserId),
      leaders: arrayRemove(targetUserId),
      curators: arrayRemove(targetUserId),
      bannedUsers: arrayUnion(targetUserId),
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }

  await logAction(db, {
    action: MOD_ACTIONS.BAN_USER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
    metadata: { banExpiresAt },
  });

  return { success: true };
};

export const unbanUser = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNBAN_USER);

  await updateDoc(doc(db, 'users', targetUserId), {
    isBanned: false,
    banReason: null,
    banExpiresAt: null,
    updatedAt: serverTimestamp(),
  });

  if (communityId) {
    await updateDoc(doc(db, 'communities', communityId), {
      bannedUsers: arrayRemove(targetUserId),
      updatedAt: serverTimestamp(),
    });
  }

  await logAction(db, {
    action: MOD_ACTIONS.UNBAN_USER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
  });

  return { success: true };
};

// ─────────────────────────────────────────
// POST MODERATION
// ─────────────────────────────────────────

export const disablePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DISABLE_POST);
  await updateDoc(doc(db, 'posts', postId), {
    isDisabled: true,
    disabledAt: serverTimestamp(),
    disabledBy: actorId,
    disabledReason: reason,
  });
  await logAction(db, { action: MOD_ACTIONS.DISABLE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const enablePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.ENABLE_POST);
  await updateDoc(doc(db, 'posts', postId), {
    isDisabled: false,
    disabledAt: null,
    disabledBy: null,
    disabledReason: null,
  });
  await logAction(db, { action: MOD_ACTIONS.ENABLE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const hidePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.HIDE_POST);
  await updateDoc(doc(db, 'posts', postId), {
    isHidden: true,
    hiddenAt: serverTimestamp(),
    hiddenBy: actorId,
    hiddenReason: reason,
  });
  await logAction(db, { action: MOD_ACTIONS.HIDE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const unhidePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNHIDE_POST);
  await updateDoc(doc(db, 'posts', postId), {
    isHidden: false,
    hiddenAt: null,
    hiddenBy: null,
    hiddenReason: null,
  });
  await logAction(db, { action: MOD_ACTIONS.UNHIDE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const featurePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.FEATURE_POST);
  await updateDoc(doc(db, 'posts', postId), {
    isFeatured: true,
    featuredAt: serverTimestamp(),
    featuredBy: actorId,
  });
  if (communityId) {
    await updateDoc(doc(db, 'communities', communityId), {
      featuredPosts: arrayUnion(postId),
      updatedAt: serverTimestamp(),
    });
  }
  await logAction(db, { action: MOD_ACTIONS.FEATURE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const unfeaturePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNFEATURE_POST);
  await updateDoc(doc(db, 'posts', postId), { isFeatured: false, featuredAt: null, featuredBy: null });
  if (communityId) {
    await updateDoc(doc(db, 'communities', communityId), {
      featuredPosts: arrayRemove(postId),
      updatedAt: serverTimestamp(),
    });
  }
  await logAction(db, { action: MOD_ACTIONS.UNFEATURE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

// ─────────────────────────────────────────
// CHAT ROOM MODERATION
// ─────────────────────────────────────────

export const featureChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.FEATURE_ROOM);
  await updateDoc(doc(db, 'chatRooms', roomId), {
    isFeatured: true,
    featuredAt: serverTimestamp(),
    featuredBy: actorId,
  });
  await logAction(db, { action: MOD_ACTIONS.FEATURE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const unfeatureChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNFEATURE_ROOM);
  await updateDoc(doc(db, 'chatRooms', roomId), { isFeatured: false, featuredAt: null, featuredBy: null });
  await logAction(db, { action: MOD_ACTIONS.UNFEATURE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const disableChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DISABLE_ROOM);
  await updateDoc(doc(db, 'chatRooms', roomId), {
    isDisabled: true,
    disabledAt: serverTimestamp(),
    disabledBy: actorId,
    disabledReason: reason,
  });
  await logAction(db, { action: MOD_ACTIONS.DISABLE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const enableChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.ENABLE_ROOM);
  await updateDoc(doc(db, 'chatRooms', roomId), { isDisabled: false, disabledAt: null, disabledBy: null });
  await logAction(db, { action: MOD_ACTIONS.ENABLE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

// ─────────────────────────────────────────
// MESSAGE MODERATION
// ─────────────────────────────────────────

export const disableUserMessages = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DISABLE_MESSAGES);
  await updateDoc(doc(db, 'users', targetUserId), {
    canMessage: false,
    messagesDisabledAt: serverTimestamp(),
    messagesDisabledBy: actorId,
    messagesDisabledReason: reason,
    updatedAt: serverTimestamp(),
  });
  await logAction(db, { action: MOD_ACTIONS.DISABLE_MESSAGES, communityId, targetUserId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const enableUserMessages = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.ENABLE_MESSAGES);
  await updateDoc(doc(db, 'users', targetUserId), {
    canMessage: true,
    messagesDisabledAt: null,
    messagesDisabledBy: null,
    messagesDisabledReason: null,
    updatedAt: serverTimestamp(),
  });
  await logAction(db, { action: MOD_ACTIONS.ENABLE_MESSAGES, communityId, targetUserId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

// ─────────────────────────────────────────
// TITLE MANAGEMENT
// ─────────────────────────────────────────

/**
 * Grant a custom title & optional color to a user within a community.
 */
export const grantTitle = async (db, actorId, communityId, targetUserId, title, titleColor = '#FFFFFF') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.GRANT_TITLE);

  // Store title on the community membership sub-collection
  await setDoc(
    doc(db, 'communities', communityId, 'memberTitles', targetUserId),
    {
      userId: targetUserId,
      title,
      titleColor,
      grantedBy: actorId,
      grantedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await logAction(db, {
    action: MOD_ACTIONS.GRANT_TITLE,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    metadata: { title, titleColor },
  });
  return { success: true };
};

export const revokeTitle = async (db, actorId, communityId, targetUserId) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.REVOKE_TITLE);
  await deleteDoc(doc(db, 'communities', communityId, 'memberTitles', targetUserId));
  await logAction(db, { action: MOD_ACTIONS.REVOKE_TITLE, communityId, targetUserId, performedBy: actorId, performedByRole: role });
  return { success: true };
};

export const changeTitleColor = async (db, actorId, communityId, targetUserId, newColor) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.CHANGE_TITLE_COLOR);
  const ref = doc(db, 'communities', communityId, 'memberTitles', targetUserId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, error: 'User has no title to recolor' };
  await updateDoc(ref, { titleColor: newColor, colorChangedAt: serverTimestamp(), colorChangedBy: actorId });
  await logAction(db, { action: MOD_ACTIONS.CHANGE_TITLE_COLOR, communityId, targetUserId, performedBy: actorId, performedByRole: role, metadata: { newColor } });
  return { success: true };
};

// ─────────────────────────────────────────
// FLAG / REPORT RESOLUTION
// ─────────────────────────────────────────

export const resolveFlag = async (db, actorId, communityId, reportId, resolution = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.RESOLVE_FLAG);
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'resolved',
    resolvedBy: actorId,
    resolvedAt: serverTimestamp(),
    resolution,
  });
  await logAction(db, { action: MOD_ACTIONS.RESOLVE_FLAG, communityId, performedBy: actorId, performedByRole: role, metadata: { reportId, resolution } });
  return { success: true };
};

// ─────────────────────────────────────────
// USER MESSAGE REPORTING (private & group chats)
// ─────────────────────────────────────────

/**
 * Predefined reasons a user can select when flagging a chat message.
 */
export const MESSAGE_REPORT_REASONS = [
  { key: 'spam',        label: 'Spam or scam' },
  { key: 'harassment',  label: 'Harassment or bullying' },
  { key: 'hate_speech', label: 'Hate speech' },
  { key: 'threats',     label: 'Threats or violence' },
  { key: 'explicit',    label: 'Explicit / adult content' },
  { key: 'other',       label: 'Other' },
];

/**
 * Flag / report a message from a private or group chat.
 * Any authenticated user can call this — no staff permission required.
 *
 * @param {object} db               Firestore instance
 * @param {string} reporterId       UID of the user submitting the report
 * @param {object} params
 * @param {string} params.messageId       ID of the reported message
 * @param {string} params.messageText     Text content (for admin context)
 * @param {string} params.reportedUserId  UID of the message author
 * @param {string} params.conversationId  Chat / group conversation ID
 * @param {string} params.chatType        'private' | 'group'
 * @param {string} params.reason          Key from MESSAGE_REPORT_REASONS
 * @param {string} [params.details]       Optional extra details from the reporter
 */
export const flagMessage = async (db, reporterId, {
  messageId,
  messageText = '',
  reportedUserId,
  conversationId,
  chatType = 'private',
  reason,
  details = '',
}) => {
  if (!reporterId) throw new Error('Must be logged in to report a message');
  if (!messageId || !reportedUserId || !conversationId || !reason) {
    throw new Error('Missing required report fields');
  }
  if (reporterId === reportedUserId) {
    return { success: false, error: 'You cannot report your own message' };
  }

  // Deduplicate: prevent the same user from reporting the same message twice
  const existing = await getDocs(
    query(
      collection(db, 'reports'),
      where('messageId', '==', messageId),
      where('reportedBy', '==', reporterId),
      limit(1)
    )
  );
  if (!existing.empty) {
    return { success: false, error: 'You have already reported this message' };
  }

  await addDoc(collection(db, 'reports'), {
    type: 'message',
    chatType,
    conversationId,
    messageId,
    messageText,
    reportedUserId,
    reportedBy: reporterId,
    reason,
    details,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return { success: true };
};

// ─────────────────────────────────────────
// STAFF PROMOTION / DEMOTION
// ─────────────────────────────────────────

/**
 * Promote a community member to Curator (only Owner/Leader can do this).
 */
export const promoteToCurator = async (db, actorId, communityId, targetUserId) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.PROMOTE_TO_CURATOR);

  await updateDoc(doc(db, 'communities', communityId), {
    curators: arrayUnion(targetUserId),
    updatedAt: serverTimestamp(),
  });

  // Store a pending promotion that the target user must accept
  await setDoc(
    doc(db, 'communities', communityId, 'pendingPromotions', targetUserId),
    {
      userId: targetUserId,
      toRole: ROLES.CURATOR,
      promotedBy: actorId,
      status: 'pending',
      createdAt: serverTimestamp(),
    }
  );

  await logAction(db, {
    action: MOD_ACTIONS.PROMOTE_TO_CURATOR,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
  });
  return { success: true };
};

/**
 * Promote a Curator to Leader (only Owner can do this).
 */
export const promoteToLeader = async (db, actorId, communityId, targetUserId) => {
  // Only Owner/Admin can promote to Leader
  const actorRole = await getCommunityRole(db, communityId, actorId);
  if (actorRole !== ROLES.OWNER) {
    const globalRole = await getGlobalRole(db, actorId);
    if (globalRole !== ROLES.ADMIN && globalRole !== ROLES.OWNER) {
      throw new Error('Only the community owner can promote to Leader');
    }
  }

  await updateDoc(doc(db, 'communities', communityId), {
    leaders: arrayUnion(targetUserId),
    curators: arrayRemove(targetUserId), // Remove from curators if they were one
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, 'communities', communityId, 'pendingPromotions', targetUserId),
    {
      userId: targetUserId,
      toRole: ROLES.LEADER,
      promotedBy: actorId,
      status: 'pending',
      createdAt: serverTimestamp(),
    }
  );

  await logAction(db, {
    action: MOD_ACTIONS.PROMOTE_TO_LEADER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: actorRole || ROLES.OWNER,
  });
  return { success: true };
};

/**
 * Accept a pending promotion (called by the targetUser themselves).
 */
export const acceptPromotion = async (db, communityId, userId) => {
  const promoRef = doc(db, 'communities', communityId, 'pendingPromotions', userId);
  const promoSnap = await getDoc(promoRef);
  if (!promoSnap.exists()) return { success: false, error: 'No pending promotion found' };

  const promo = promoSnap.data();
  if (promo.userId !== userId) return { success: false, error: 'Promotion is not for you' };

  await updateDoc(promoRef, { status: 'accepted', acceptedAt: serverTimestamp() });

  await logAction(db, {
    action: MOD_ACTIONS.ACCEPT_PROMOTION,
    communityId,
    targetUserId: userId,
    performedBy: userId,
    performedByRole: promo.toRole,
    metadata: { fromPromotion: promo.toRole },
  });
  return { success: true, role: promo.toRole };
};

/**
 * Demote a Leader (only Owner can).
 */
export const demoteLeader = async (db, actorId, communityId, targetUserId, reason = '') => {
  const actorRole = await getCommunityRole(db, communityId, actorId);
  if (actorRole !== ROLES.OWNER) {
    const globalRole = await getGlobalRole(db, actorId);
    if (globalRole !== ROLES.ADMIN && globalRole !== ROLES.OWNER) {
      throw new Error('Only the community owner can demote a Leader');
    }
  }

  await updateDoc(doc(db, 'communities', communityId), {
    leaders: arrayRemove(targetUserId),
    updatedAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.DEMOTE_LEADER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: actorRole || ROLES.OWNER,
    reason,
  });
  return { success: true };
};

/**
 * Demote a Curator (Owner or Leader can do this).
 */
export const demoteCurator = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DEMOTE_CURATOR);

  await updateDoc(doc(db, 'communities', communityId), {
    curators: arrayRemove(targetUserId),
    updatedAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.DEMOTE_CURATOR,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
  });
  return { success: true };
};

// ─────────────────────────────────────────
// MODERATION LOG QUERIES
// ─────────────────────────────────────────

/**
 * Fetch recent moderation actions for a community.
 */
export const getModerationHistory = async (db, communityId, limitCount = 50) => {
  try {
    const q = query(
      collection(db, 'moderationLogs'),
      where('communityId', '==', communityId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return {
      success: true,
      data: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

/**
 * Fetch moderation history for a specific user (target).
 */
export const getUserModerationHistory = async (db, targetUserId, limitCount = 20) => {
  try {
    const q = query(
      collection(db, 'moderationLogs'),
      where('targetUserId', '==', targetUserId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return {
      success: true,
      data: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

/**
 * Get all currently struck users in a community.
 */
export const getStruckUsers = async (db, communityId) => {
  try {
    const q = query(
      collection(db, 'communities', communityId, 'strikes'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return {
      success: true,
      data: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

/**
 * Get community staff list (leaders + curators).
 */
export const getCommunityStaff = async (db, communityId) => {
  try {
    const communityDoc = await getDoc(doc(db, 'communities', communityId));
    if (!communityDoc.exists()) return { success: false, error: 'Community not found' };

    const { leaders = [], curators = [], creatorId } = communityDoc.data();

    const fetchUsers = async (ids, role) => {
      return Promise.all(ids.map(async (id) => {
        const u = await getDoc(doc(db, 'users', id));
        return u.exists() ? { id, role, ...u.data() } : null;
      }));
    };

    const leaderData  = (await fetchUsers(leaders,  ROLES.LEADER)).filter(Boolean);
    const curatorData = (await fetchUsers(curators, ROLES.CURATOR)).filter(Boolean);

    // Creator (owner)
    let ownerData = null;
    if (creatorId) {
      const ownerDoc = await getDoc(doc(db, 'users', creatorId));
      if (ownerDoc.exists()) ownerData = { id: creatorId, role: ROLES.OWNER, ...ownerDoc.data() };
    }

    return {
      success: true,
      data: {
        owner: ownerData,
        leaders: leaderData,
        curators: curatorData,
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

/**
 * Check if a user's action should be blocked (struck or banned).
 * Call this at the start of any write operation for regular users.
 */
export const checkUserActionAllowed = async (db, userId, action = 'post', communityId = null) => {
  const VIEW_ONLY_BLOCKED = ['post', 'message', 'reply', 'follow', 'unfollow', 'create', 'react'];

  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return { allowed: true };

  const data = userDoc.data();

  // ── 1. Global ban check ──────────────────────────────────────────────────
  if (data.isBanned) {
    if (!data.banExpiresAt) {
      return { allowed: false, reason: 'banned', message: 'You are banned from this platform.' };
    }
    const expires = data.banExpiresAt.toDate ? data.banExpiresAt.toDate() : new Date(data.banExpiresAt);
    if (expires > new Date()) {
      return { allowed: false, reason: 'banned', message: 'Your account is currently banned.' };
    }
    // Ban has expired — auto-clear so future checks are fast
    await updateDoc(doc(db, 'users', userId), {
      isBanned: false,
      banExpiresAt: null,
      updatedAt: serverTimestamp(),
    });
  }

  // ── 2. Community-specific strike check ──────────────────────────────────
  if (communityId) {
    const strikeSnap = await getDoc(doc(db, 'communities', communityId, 'strikes', userId));
    if (strikeSnap.exists()) {
      const s = strikeSnap.data();
      if (s.isActive) {
        if (s.strikeExpiresAt) {
          const expires = s.strikeExpiresAt.toDate
            ? s.strikeExpiresAt.toDate()
            : new Date(s.strikeExpiresAt);
          if (expires > new Date()) {
            if (VIEW_ONLY_BLOCKED.includes(action)) {
              return {
                allowed: false,
                reason: 'struck',
                message: `You are in view-only mode in this community until ${expires.toLocaleString()}. Reason: ${s.reason || 'Rule violation'}`,
                expiresAt: expires,
              };
            }
          } else {
            // Expired — auto-clear the sub-collection record
            await updateDoc(doc(db, 'communities', communityId, 'strikes', userId), {
              isActive: false,
              expiredAt: serverTimestamp(),
            });
          }
        } else {
          // Permanent community strike
          if (VIEW_ONLY_BLOCKED.includes(action)) {
            return {
              allowed: false,
              reason: 'struck',
              message: `You are permanently in view-only mode in this community. Reason: ${s.reason || 'Rule violation'}`,
            };
          }
        }
      }
    }
  }

  // ── 3. Global (admin-level) strike check ────────────────────────────────
  if (data.isStruck) {
    if (data.strikeExpiresAt) {
      const expires = data.strikeExpiresAt.toDate
        ? data.strikeExpiresAt.toDate()
        : new Date(data.strikeExpiresAt);
      if (expires > new Date()) {
        if (VIEW_ONLY_BLOCKED.includes(action)) {
          return {
            allowed: false,
            reason: 'struck',
            message: `You are in view-only mode until ${expires.toLocaleString()}. Reason: ${data.strikeReason || 'Rule violation'}`,
            expiresAt: expires,
          };
        }
      } else {
        // Global strike expired — auto-clear
        await updateDoc(doc(db, 'users', userId), {
          isStruck: false,
          strikeExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Permanent global strike
      if (VIEW_ONLY_BLOCKED.includes(action)) {
        return {
          allowed: false,
          reason: 'struck',
          message: `You are in permanent view-only mode. Reason: ${data.strikeReason || 'Rule violation'}`,
        };
      }
    }
  }

  return { allowed: true };
};
