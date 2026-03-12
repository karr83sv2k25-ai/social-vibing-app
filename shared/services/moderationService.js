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
 *   disable_post, enable_post, hide_post, unhide_post, feature_post, unfeature_post
 *   feature_room, unfeature_room, disable_room, enable_room
 *   accept_promotion (get_promoted, get_demoted are passive)
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
  KICK_USER:          'kick_user',
  WARN_USER:          'warn_user',
  STRIKE_USER:        'strike_user',
  UNSTRIKE_USER:      'unstrike_user',
  DISABLE_MESSAGES:   'disable_messages',
  ENABLE_MESSAGES:    'enable_messages',
  MUTE_USER_IN_CHAT:  'mute_user_in_chat',
  UNMUTE_USER_IN_CHAT:'unmute_user_in_chat',
  // Message actions (Discord-like)
  DELETE_MESSAGE:     'delete_message',
  PIN_MESSAGE:        'pin_message',
  UNPIN_MESSAGE:      'unpin_message',
  // Channel/Group actions
  SET_SLOWMODE:       'set_slowmode',
  LOCK_CHAT:          'lock_chat',
  UNLOCK_CHAT:        'unlock_chat',
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
  MOD_ACTIONS.KICK_USER,
  MOD_ACTIONS.WARN_USER,
  MOD_ACTIONS.STRIKE_USER,
  MOD_ACTIONS.UNSTRIKE_USER,
  MOD_ACTIONS.DISABLE_MESSAGES,
  MOD_ACTIONS.ENABLE_MESSAGES,
  MOD_ACTIONS.MUTE_USER_IN_CHAT,
  MOD_ACTIONS.UNMUTE_USER_IN_CHAT,
  MOD_ACTIONS.DELETE_MESSAGE,
  MOD_ACTIONS.PIN_MESSAGE,
  MOD_ACTIONS.UNPIN_MESSAGE,
  MOD_ACTIONS.SET_SLOWMODE,
  MOD_ACTIONS.LOCK_CHAT,
  MOD_ACTIONS.UNLOCK_CHAT,
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
  // Post moderation
  MOD_ACTIONS.DISABLE_POST,
  MOD_ACTIONS.ENABLE_POST,
  MOD_ACTIONS.HIDE_POST,
  MOD_ACTIONS.UNHIDE_POST,
  MOD_ACTIONS.FEATURE_POST,
  MOD_ACTIONS.UNFEATURE_POST,
  // Chat room moderation
  MOD_ACTIONS.FEATURE_ROOM,
  MOD_ACTIONS.UNFEATURE_ROOM,
  MOD_ACTIONS.DISABLE_ROOM,
  MOD_ACTIONS.ENABLE_ROOM,
  // Reports & flags
  MOD_ACTIONS.RESOLVE_FLAG,
  // Staff lifecycle
  MOD_ACTIONS.ACCEPT_PROMOTION,
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

// Hierarchy levels shared across all enforcement points
const ROLE_HIERARCHY_LEVELS = {
  [ROLES.OWNER]: 5, [ROLES.ADMIN]: 4,
  [ROLES.LEADER]: 3, [ROLES.CURATOR]: 2, [ROLES.MEMBER]: 1,
};

/**
 * Assert that actorRole outranks the target user's community role.
 * Throws if the target is equal or higher rank.
 */
const assertRoleHierarchy = async (db, communityId, actorRole, targetUserId) => {
  if (!communityId) return; // global admin actions skip this check
  const targetRole = await getCommunityRole(db, communityId, targetUserId);
  const actorLevel = ROLE_HIERARCHY_LEVELS[actorRole] || 0;
  const targetLevel = ROLE_HIERARCHY_LEVELS[targetRole] || 0;
  if (targetLevel >= actorLevel) {
    throw new Error('Cannot perform this action on a user of equal or higher role');
  }
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
  await assertRoleHierarchy(db, communityId, role, targetUserId);

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
  await assertRoleHierarchy(db, communityId, role, targetUserId);

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
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
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
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
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
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
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
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
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
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
    isFeatured: true,
    featuredAt: serverTimestamp(),
    featuredBy: actorId,
  });
  await updateDoc(doc(db, 'communities', communityId), {
    featuredPosts: arrayUnion(postId),
    updatedAt: serverTimestamp(),
  });
  await logAction(db, { action: MOD_ACTIONS.FEATURE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const unfeaturePost = async (db, actorId, communityId, postId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNFEATURE_POST);
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), { isFeatured: false, featuredAt: null, featuredBy: null });
  await updateDoc(doc(db, 'communities', communityId), {
    featuredPosts: arrayRemove(postId),
    updatedAt: serverTimestamp(),
  });
  await logAction(db, { action: MOD_ACTIONS.UNFEATURE_POST, communityId, targetPostId: postId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

// ─────────────────────────────────────────
// CHAT ROOM MODERATION
// ─────────────────────────────────────────

export const featureChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.FEATURE_ROOM);
  await updateDoc(doc(db, 'communities', communityId, 'groups', roomId), {
    isFeatured: true,
    featuredAt: serverTimestamp(),
    featuredBy: actorId,
  });
  await logAction(db, { action: MOD_ACTIONS.FEATURE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const unfeatureChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNFEATURE_ROOM);
  await updateDoc(doc(db, 'communities', communityId, 'groups', roomId), { isFeatured: false, featuredAt: null, featuredBy: null });
  await logAction(db, { action: MOD_ACTIONS.UNFEATURE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

export const disableChatRoom = async (db, actorId, communityId, roomId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DISABLE_ROOM);
  await updateDoc(doc(db, 'communities', communityId, 'groups', roomId), {
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
  await updateDoc(doc(db, 'communities', communityId, 'groups', roomId), {
    isDisabled: false,
    disabledAt: null,
    disabledBy: null,
    disabledReason: null,
  });
  await logAction(db, { action: MOD_ACTIONS.ENABLE_ROOM, communityId, targetRoomId: roomId, performedBy: actorId, performedByRole: role, reason });
  return { success: true };
};

// ─────────────────────────────────────────
// MESSAGE MODERATION
// ─────────────────────────────────────────

export const disableUserMessages = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DISABLE_MESSAGES);
  await assertRoleHierarchy(db, communityId, role, targetUserId);
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
  await assertRoleHierarchy(db, communityId, role, targetUserId);

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
// KICK USER (Discord-like — remove without ban)
// ─────────────────────────────────────────

/**
 * Kick a user from a community (remove them without adding to bannedUsers).
 * They can rejoin unless the community is set to invite-only.
 */
export const kickUser = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.KICK_USER);

  // Prevent kicking someone of equal or higher role
  const targetRole = await getCommunityRole(db, communityId, targetUserId);
  const hierarchy = { [ROLES.OWNER]: 5, [ROLES.ADMIN]: 4, [ROLES.LEADER]: 3, [ROLES.CURATOR]: 2, [ROLES.MEMBER]: 1 };
  if ((hierarchy[targetRole] || 0) >= (hierarchy[role] || 0)) {
    throw new Error('Cannot kick a user of equal or higher role');
  }

  await updateDoc(doc(db, 'communities', communityId), {
    members: arrayRemove(targetUserId),
    leaders: arrayRemove(targetUserId),
    curators: arrayRemove(targetUserId),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.KICK_USER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
  });

  return { success: true };
};

// ─────────────────────────────────────────
// WARN USER (Discord-like verbal/formal warning)
// ─────────────────────────────────────────

/**
 * Issue a formal warning to a user. Warnings accumulate.
 * Compatible with admin app's warningsCount schema.
 */
export const warnUser = async (db, actorId, communityId, targetUserId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.WARN_USER);

  // Prevent warning someone of equal or higher role
  const targetRole = await getCommunityRole(db, communityId, targetUserId);
  const hierarchy = { [ROLES.OWNER]: 5, [ROLES.ADMIN]: 4, [ROLES.LEADER]: 3, [ROLES.CURATOR]: 2, [ROLES.MEMBER]: 1 };
  if ((hierarchy[targetRole] || 0) >= (hierarchy[role] || 0)) {
    throw new Error('Cannot warn a user of equal or higher role');
  }

  // Update user doc with warning (compatible with admin app schema)
  await updateDoc(doc(db, 'users', targetUserId), {
    warningsCount: increment(1),
    lastWarning: reason,
    lastWarningDate: serverTimestamp(),
    warnedAt: serverTimestamp(),
    warnedBy: actorId,
    updatedAt: serverTimestamp(),
  });

  // Store community-specific warning
  await addDoc(collection(db, 'communities', communityId, 'warnings'), {
    userId: targetUserId,
    reason,
    warnedBy: actorId,
    createdAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.WARN_USER,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
  });

  return { success: true };
};

// ─────────────────────────────────────────
// DELETE MESSAGE (Staff can remove any message)
// ─────────────────────────────────────────

/**
 * Soft-delete a message in a community group chat.
 */
export const deleteMessage = async (db, actorId, communityId, groupId, messageId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.DELETE_MESSAGE);

  const msgRef = doc(db, 'communities', communityId, 'groups', groupId, 'messages', messageId);
  await updateDoc(msgRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actorId,
    deletionReason: reason,
    originalText: null, // clear content but leave a tombstone
  });

  await logAction(db, {
    action: MOD_ACTIONS.DELETE_MESSAGE,
    communityId,
    performedBy: actorId,
    performedByRole: role,
    reason,
    metadata: { groupId, messageId },
  });

  return { success: true };
};

// ─────────────────────────────────────────
// MUTE USER IN CHAT (temporary chat-level mute)
// ─────────────────────────────────────────

/**
 * Mute a user in a specific group chat. They can still read but not send.
 * @param {number|null} durationMs - Duration in ms (null = until manually unmuted)
 */
export const muteUserInChat = async (db, actorId, communityId, groupId, targetUserId, durationMs = null, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.MUTE_USER_IN_CHAT);

  const muteExpiresAt = durationMs
    ? Timestamp.fromDate(new Date(Date.now() + durationMs))
    : null;

  const memberRef = doc(db, 'communities', communityId, 'groups', groupId, 'members', targetUserId);
  await updateDoc(memberRef, {
    isMuted: true,
    mutedAt: serverTimestamp(),
    mutedBy: actorId,
    muteReason: reason,
    muteExpiresAt,
  });

  await logAction(db, {
    action: MOD_ACTIONS.MUTE_USER_IN_CHAT,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    reason,
    metadata: { groupId, durationMs, muteExpiresAt },
  });

  return { success: true };
};

/**
 * Unmute a user in a specific group chat.
 */
export const unmuteUserInChat = async (db, actorId, communityId, groupId, targetUserId) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNMUTE_USER_IN_CHAT);

  const memberRef = doc(db, 'communities', communityId, 'groups', groupId, 'members', targetUserId);
  await updateDoc(memberRef, {
    isMuted: false,
    mutedAt: null,
    mutedBy: null,
    muteReason: null,
    muteExpiresAt: null,
    unmutedAt: serverTimestamp(),
    unmutedBy: actorId,
  });

  await logAction(db, {
    action: MOD_ACTIONS.UNMUTE_USER_IN_CHAT,
    communityId,
    targetUserId,
    performedBy: actorId,
    performedByRole: role,
    metadata: { groupId },
  });

  return { success: true };
};

// ─────────────────────────────────────────
// SLOWMODE (Discord-like per-channel slowmode)
// ─────────────────────────────────────────

/**
 * Set slowmode on a group chat (seconds between messages per user).
 * @param {number} intervalSeconds - 0 = disabled, otherwise 5/10/15/30/60/120/300/600
 */
export const setSlowmode = async (db, actorId, communityId, groupId, intervalSeconds = 0) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.SET_SLOWMODE);

  const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
  await updateDoc(groupRef, {
    slowmodeInterval: intervalSeconds,
    slowmodeSetBy: actorId,
    slowmodeSetAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.SET_SLOWMODE,
    communityId,
    performedBy: actorId,
    performedByRole: role,
    metadata: { groupId, intervalSeconds },
  });

  return { success: true };
};

// ─────────────────────────────────────────
// LOCK / UNLOCK CHAT
// ─────────────────────────────────────────

/**
 * Lock a group chat — only staff can send messages.
 */
export const lockChat = async (db, actorId, communityId, groupId, reason = '') => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.LOCK_CHAT);

  const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
  await updateDoc(groupRef, {
    isLocked: true,
    lockedAt: serverTimestamp(),
    lockedBy: actorId,
    lockReason: reason,
    updatedAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.LOCK_CHAT,
    communityId,
    performedBy: actorId,
    performedByRole: role,
    reason,
    metadata: { groupId },
  });

  return { success: true };
};

/**
 * Unlock a group chat — everyone can send again.
 */
export const unlockChat = async (db, actorId, communityId, groupId) => {
  const role = await assertPermission(db, actorId, communityId, MOD_ACTIONS.UNLOCK_CHAT);

  const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
  await updateDoc(groupRef, {
    isLocked: false,
    lockedAt: null,
    lockedBy: null,
    lockReason: null,
    updatedAt: serverTimestamp(),
  });

  await logAction(db, {
    action: MOD_ACTIONS.UNLOCK_CHAT,
    communityId,
    performedBy: actorId,
    performedByRole: role,
    metadata: { groupId },
  });

  return { success: true };
};

/**
 * Get the role hierarchy level (higher = more powerful). Useful for UI comparisons.
 */
export const getRoleLevel = (role) => {
  return ROLE_HIERARCHY_LEVELS[role] || 0;
};

/**
 * Get role display info (label, color, icon) for UI badges.
 */
export const getRoleDisplayInfo = (role) => {
  const info = {
    [ROLES.OWNER]:   { label: 'Owner',   color: '#FFD700', icon: 'crown',       iconLib: 'MaterialCommunityIcons' },
    [ROLES.ADMIN]:   { label: 'Admin',   color: '#FF5555', icon: 'shield-star', iconLib: 'MaterialCommunityIcons' },
    [ROLES.LEADER]:  { label: 'Leader',  color: '#3B82F6', icon: 'shield-half-full', iconLib: 'MaterialCommunityIcons' },
    [ROLES.CURATOR]: { label: 'Curator', color: '#10B981', icon: 'palette',     iconLib: 'MaterialCommunityIcons' },
    [ROLES.MEMBER]:  { label: 'Member',  color: '#888888', icon: 'account',     iconLib: 'MaterialCommunityIcons' },
  };
  return info[role] || info[ROLES.MEMBER];
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
  reporterUsername = '',
  reportedUsername = '',
  conversationId,
  chatType = 'private',
  reason,
  details = '',
  communityId = null,
  groupId = null,
}) => {
  if (!reporterId) throw new Error('Must be logged in to report a message');
  if (!messageId || !reportedUserId || !conversationId || !reason) {
    throw new Error('Missing required report fields');
  }
  if (reporterId === reportedUserId) {
    return { success: false, error: 'You cannot report your own message' };
  }

  // Deduplicate: prevent the same user from reporting the same message twice
  // Wrapped in try-catch: if the composite index is missing, we skip the check
  // rather than blocking the entire report submission.
  try {
    const existing = await getDocs(
      query(
        collection(db, 'reports'),
        where('messageId', '==', messageId),
        where('reporterId', '==', reporterId),
        limit(1)
      )
    );
    if (!existing.empty) {
      return { success: false, error: 'You have already reported this message' };
    }
  } catch (dedupError) {
    // Index may not be deployed yet — continue with submission
    console.warn('[flagMessage] Dedup check skipped:', dedupError.message);
  }

  // Build reason label from MESSAGE_REPORT_REASONS
  const reasonObj = MESSAGE_REPORT_REASONS.find(r => r.key === reason);
  const reasonLabel = reasonObj ? reasonObj.label : reason;

  // Calculate priority based on reason
  const highPriority = ['threats', 'explicit'];
  const mediumPriority = ['harassment', 'hate_speech'];
  const priority = highPriority.includes(reason) ? 'high'
    : mediumPriority.includes(reason) ? 'medium' : 'low';

  await addDoc(collection(db, 'reports'), {
    reportType: 'message',
    reporterId,
    reporterUsername: String(reporterUsername || 'Unknown User').substring(0, 100),
    reportedId: reportedUserId,
    reportedUsername: String(reportedUsername || 'Unknown User').substring(0, 100),
    reason,
    reasonLabel,
    reasonCategory: 'chat',
    priority,
    chatType,
    conversationId,
    communityId: communityId || null,
    groupId: groupId || null,
    messageId,
    messageText: (messageText || '').substring(0, 500),
    contentId: messageId,
    contentType: 'message',
    contentPreview: (messageText || '').substring(0, 200),
    description: details ? String(details).substring(0, 500) : '',
    evidence: [],
    status: 'pending',
    isResolved: false,
    reviewedBy: null,
    reviewedAt: null,
    actionTaken: null,
    actionDetails: null,
    adminNotes: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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

  // Send in-app notification to the promoted user
  try {
    const [actorSnap, communitySnap] = await Promise.all([
      getDoc(doc(db, 'users', actorId)),
      getDoc(doc(db, 'communities', communityId)),
    ]);
    const actorData = actorSnap.exists() ? actorSnap.data() : {};
    const communityData = communitySnap.exists() ? communitySnap.data() : {};
    const actorName =
      actorData.displayName ||
      (actorData.firstName || actorData.lastName
        ? `${actorData.firstName || ''} ${actorData.lastName || ''}`.trim()
        : null) ||
      actorData.username ||
      'An admin';
    const communityName =
      communityData.name ||
      communityData.community_title ||
      communityData.title ||
      'a community';
    const notifRef = doc(
      collection(db, 'users', targetUserId, 'notifications'),
      `${actorId}_curator_promotion_${communityId}`
    );
    await setDoc(notifRef, {
      type: 'curator_promotion',
      fromUserId: actorId,
      fromUserName: actorName,
      fromUserImage: actorData.profileImage || actorData.avatar || null,
      communityId,
      communityName,
      communityImage: communityData.profileImage || communityData.img || communityData.image || null,
      message: `${actorName} has promoted you to Curator in ${communityName}`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  } catch (notifErr) {
    // Non-critical — don't block the promotion if notification fails
    console.warn('curator_promotion notification failed:', notifErr);
  }

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

  // Send in-app notification to the promoted user
  try {
    const [actorSnap, communitySnap] = await Promise.all([
      getDoc(doc(db, 'users', actorId)),
      getDoc(doc(db, 'communities', communityId)),
    ]);
    const actorData = actorSnap.exists() ? actorSnap.data() : {};
    const communityData = communitySnap.exists() ? communitySnap.data() : {};
    const actorName =
      actorData.displayName ||
      (actorData.firstName || actorData.lastName
        ? `${actorData.firstName || ''} ${actorData.lastName || ''}`.trim()
        : null) ||
      actorData.username ||
      'An admin';
    const communityName =
      communityData.name ||
      communityData.community_title ||
      communityData.title ||
      'a community';
    const notifRef = doc(
      collection(db, 'users', targetUserId, 'notifications'),
      `${actorId}_leader_promotion_${communityId}`
    );
    await setDoc(notifRef, {
      type: 'leader_promotion',
      fromUserId: actorId,
      fromUserName: actorName,
      fromUserImage: actorData.profileImage || actorData.avatar || null,
      communityId,
      communityName,
      communityImage: communityData.profileImage || communityData.img || communityData.image || null,
      message: `${actorName} has promoted you to Leader in ${communityName}`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  } catch (notifErr) {
    // Non-critical — don't block the promotion if notification fails
    console.warn('leader_promotion notification failed:', notifErr);
  }

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
 * Fetch moderation history for a specific staff member in a community.
 * Returns actions they performed plus role-change events (promotions / demotions) targeting them.
 * Requires composite Firestore indexes:
 *   moderationLogs: communityId ASC + performedBy ASC + createdAt DESC
 *   moderationLogs: communityId ASC + targetUserId ASC + createdAt DESC
 */
export const getStaffModerationHistory = async (db, communityId, staffUserId, limitCount = 50) => {
  const ROLE_CHANGE_ACTIONS = new Set([
    MOD_ACTIONS.PROMOTE_TO_LEADER,
    MOD_ACTIONS.PROMOTE_TO_CURATOR,
    MOD_ACTIONS.DEMOTE_LEADER,
    MOD_ACTIONS.DEMOTE_CURATOR,
    MOD_ACTIONS.ACCEPT_PROMOTION,
  ]);

  try {
    const [performedSnap, roleChangeSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'moderationLogs'),
        where('communityId', '==', communityId),
        where('performedBy', '==', staffUserId),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      )),
      getDocs(query(
        collection(db, 'moderationLogs'),
        where('communityId', '==', communityId),
        where('targetUserId', '==', staffUserId),
        orderBy('createdAt', 'desc'),
        limit(20),
      )),
    ]);

    const performedLogs = performedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const performedIds = new Set(performedLogs.map(l => l.id));

    // Include role-change events where this user was the target (they got promoted / demoted)
    const roleChangeLogs = roleChangeSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(l => !performedIds.has(l.id) && ROLE_CHANGE_ACTIONS.has(l.action));

    const all = [...performedLogs, ...roleChangeLogs]
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() ?? new Date(0);
        const bTime = b.createdAt?.toDate?.() ?? new Date(0);
        return bTime - aTime;
      })
      .slice(0, limitCount);

    return { success: true, data: all, actionCount: performedLogs.length };
  } catch (e) {
    return { success: false, error: e.message, data: [], actionCount: 0 };
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
