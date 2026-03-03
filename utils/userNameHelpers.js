/**
 * Centralized User Name Helpers
 * 
 * Provides consistent name resolution, username validation, and username
 * management across the entire app. All screens should use these helpers
 * instead of implementing their own fallback chains.
 */

import { doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Username validation ────────────────────────────────────────────────────

/** Only lowercase letters, numbers, dots, hyphens, underscores. 3-20 chars. */
export const USERNAME_REGEX = /^[a-z0-9._-]{3,20}$/;

/**
 * Sanitize raw text into a valid username candidate.
 * Lowercases, strips whitespace and invalid characters.
 */
export const sanitizeUsername = (text) => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
};

/**
 * Check whether a username is available in the `usernames` collection.
 * @returns {{ available: boolean, error?: string }}
 */
export const checkUsernameAvailability = async (username) => {
  const normalized = sanitizeUsername(username);
  if (!normalized) {
    return { available: false, error: 'Username is required' };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { available: false, error: 'Username must be 3-20 characters (lowercase letters, numbers, ., -, _)' };
  }
  try {
    const usernameDocRef = doc(db, 'usernames', normalized);
    const usernameSnap = await getDoc(usernameDocRef);
    if (usernameSnap.exists()) {
      return { available: false, error: 'Username already taken' };
    }
    return { available: true };
  } catch (error) {
    console.error('Username availability check error:', error);
    return { available: false, error: 'Unable to verify username. Please check your connection.' };
  }
};

/**
 * Atomically change a user's username:
 *  1. Delete old reservation from `usernames/{old}` (if any)
 *  2. Reserve `usernames/{new}` with the user's ownerId
 *  3. Update `users/{uid}.username` to the new value
 *
 * All three writes happen inside a Firestore transaction so they
 * either all succeed or all roll back.
 *
 * @param {string} userId   - The authenticated user's UID
 * @param {string} newUsername - Already-sanitized new username
 * @param {string|null} oldUsername - Current username (may be null/empty)
 * @returns {{ success: boolean, error?: string }}
 */
export const changeUsername = async (userId, newUsername, oldUsername) => {
  const normalized = sanitizeUsername(newUsername);
  if (!normalized) {
    return { success: false, error: 'Username is required' };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { success: false, error: 'Username must be 3-20 characters (lowercase letters, numbers, ., -, _)' };
  }

  // No change → nothing to do
  const normalizedOld = oldUsername ? sanitizeUsername(oldUsername) : null;
  if (normalizedOld === normalized) {
    return { success: true };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const newUsernameRef = doc(db, 'usernames', normalized);
      const newUsernameSnap = await transaction.get(newUsernameRef);

      if (newUsernameSnap.exists()) {
        throw new Error('USERNAME_TAKEN');
      }

      // Reserve new username
      transaction.set(newUsernameRef, {
        ownerId: userId,
        createdAt: new Date().toISOString(),
      });

      // Release old username reservation
      if (normalizedOld) {
        const oldUsernameRef = doc(db, 'usernames', normalizedOld);
        transaction.delete(oldUsernameRef);
      }

      // Update user document
      const userRef = doc(db, 'users', userId);
      transaction.update(userRef, { username: normalized });
    });

    return { success: true };
  } catch (error) {
    if (error.message === 'USERNAME_TAKEN') {
      return { success: false, error: 'Username already taken — please choose another' };
    }
    console.error('changeUsername transaction error:', error);
    return { success: false, error: 'Failed to update username. Please try again.' };
  }
};

/**
 * Generate a unique username from an email address.
 * If `email.split('@')[0]` is taken, appends random digits until a free
 * variant is found (up to 5 attempts, then falls back to uid prefix).
 *
 * @param {string} email
 * @param {string} userId - fallback for generating a unique name
 * @returns {Promise<string>}
 */
export const generateUniqueUsername = async (email, userId) => {
  const base = sanitizeUsername((email || '').split('@')[0]) || userId?.substring(0, 8) || 'user';

  // Try the plain base first
  const baseRef = doc(db, 'usernames', base);
  const baseSnap = await getDoc(baseRef);
  if (!baseSnap.exists() && USERNAME_REGEX.test(base)) {
    return base;
  }

  // Append random digits
  for (let i = 0; i < 5; i++) {
    const suffix = Math.floor(Math.random() * 9000 + 1000); // 4-digit random
    const candidate = `${base.substring(0, 15)}${suffix}`;
    if (USERNAME_REGEX.test(candidate)) {
      const ref = doc(db, 'usernames', candidate);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return candidate;
      }
    }
  }

  // Last resort — use part of the uid
  const fallback = `user_${userId?.substring(0, 12) || Date.now()}`;
  return USERNAME_REGEX.test(fallback) ? fallback : 'user_' + Date.now();
};

// ─── Display-name resolution ────────────────────────────────────────────────

/**
 * Resolve a human-readable **display name** from a Firestore user object.
 *
 * Fallback order (consistent everywhere):
 *  1. firstName + lastName
 *  2. user_firstname + user_lastname   (legacy website fields)
 *  3. displayName
 *  4. name
 *  5. fullName
 *  6. username / user_name
 *  7. email local-part
 *  8. 'User'
 *
 * @param {object} userData - Firestore user document data
 * @param {string} [fallback='User'] - ultimate fallback string
 * @returns {string}
 */
export const getDisplayName = (userData, fallback = 'User') => {
  if (!userData) return fallback;

  // 1. firstName + lastName (mobile app primary)
  const first = userData.firstName || userData.user_firstname || '';
  const last = userData.lastName || userData.user_lastname || '';
  const full = `${first} ${last}`.trim();
  if (full) return full;

  // 2. displayName (Firebase Auth / legacy)
  if (userData.displayName && userData.displayName.trim()) return userData.displayName.trim();

  // 3. name (legacy website)
  if (userData.name && userData.name.trim()) return userData.name.trim();

  // 4. fullName (legacy website)
  if (userData.fullName && userData.fullName.trim()) return userData.fullName.trim();

  // 5. username / user_name
  const uname = userData.username || userData.user_name || '';
  if (uname.trim()) return uname.trim();

  // 6. email
  if (userData.email) return userData.email.split('@')[0];

  return fallback;
};

/**
 * Resolve the `@handle` string from a Firestore user object.
 *
 * @param {object} userData
 * @returns {string} e.g. `@johndoe`
 */
export const getUserHandle = (userData) => {
  if (!userData) return '@user';
  const uname = userData.username || userData.user_name || '';
  if (uname.trim()) return `@${uname.trim()}`;
  if (userData.handle) return userData.handle;
  if (userData.email) return `@${userData.email.split('@')[0]}`;
  return '@user';
};

/**
 * Resolve the best available avatar/profile image URI from a user object.
 *
 * @param {object} userData
 * @returns {string|null} URI string or null
 */
export const getUserAvatar = (userData) => {
  if (!userData) return null;
  return (
    userData.profileImage ||
    userData.profilePicture ||
    userData.avatar ||
    userData.user_picture ||
    userData.profile_image ||
    userData.photoURL ||
    null
  );
};
