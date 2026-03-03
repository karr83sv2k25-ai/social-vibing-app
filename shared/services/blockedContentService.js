/**
 * Blocked Content Service
 * Checks user-generated text against admin-blocked keywords/content.
 * Collection: blocked_content (managed by admin panel)
 */

import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// In-memory cache to avoid repeated Firestore reads
let _blockedCache = {
  global: null,
  communities: {},
  lastFetch: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch blocked content rules from Firestore
 * @param {string|null} communityId - Community-specific rules (null for global)
 * @returns {Promise<Array>} Blocked keywords/rules
 */
const fetchBlockedContent = async (communityId = null) => {
  const now = Date.now();

  // Return from cache if fresh
  if (communityId) {
    if (_blockedCache.communities[communityId] && (now - _blockedCache.lastFetch) < CACHE_TTL) {
      return _blockedCache.communities[communityId];
    }
  } else {
    if (_blockedCache.global && (now - _blockedCache.lastFetch) < CACHE_TTL) {
      return _blockedCache.global;
    }
  }

  try {
    const constraints = [
      where('active', '==', true),
    ];

    if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }

    const q = query(collection(db, 'blocked_content'), ...constraints);
    const snapshot = await getDocs(q);
    const rules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Update cache
    if (communityId) {
      _blockedCache.communities[communityId] = rules;
    } else {
      _blockedCache.global = rules;
    }
    _blockedCache.lastFetch = now;

    return rules;
  } catch (error) {
    console.warn('⚠️ Error fetching blocked content rules:', error.message);
    return [];
  }
};

/**
 * Check if text contains any blocked keywords
 * @param {string} text - The text to check
 * @param {string|null} communityId - Optional community context
 * @returns {Promise<{blocked: boolean, matchedKeyword: string|null, rule: Object|null}>}
 */
export const checkBlockedContent = async (text, communityId = null) => {
  if (!text || typeof text !== 'string') {
    return { blocked: false, matchedKeyword: null, rule: null };
  }

  try {
    // Fetch both global and community rules
    const globalRules = await fetchBlockedContent(null);
    const communityRules = communityId ? await fetchBlockedContent(communityId) : [];
    const allRules = [...globalRules, ...communityRules];

    const lowerText = text.toLowerCase();

    for (const rule of allRules) {
      if (!rule.keyword) continue;

      const keyword = rule.keyword.toLowerCase();
      const type = rule.type || 'word'; // 'word', 'phrase', 'regex'

      let isMatch = false;

      if (type === 'regex') {
        try {
          const regex = new RegExp(keyword, 'i');
          isMatch = regex.test(text);
        } catch {
          // Invalid regex, fall back to simple check
          isMatch = lowerText.includes(keyword);
        }
      } else if (type === 'word') {
        // Word boundary match
        const wordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        isMatch = wordRegex.test(text);
      } else {
        // Phrase / default: simple includes
        isMatch = lowerText.includes(keyword);
      }

      if (isMatch) {
        return { blocked: true, matchedKeyword: rule.keyword, rule };
      }
    }

    return { blocked: false, matchedKeyword: null, rule: null };
  } catch (error) {
    console.warn('⚠️ Error checking blocked content:', error.message);
    // Fail open: don't block if check fails
    return { blocked: false, matchedKeyword: null, rule: null };
  }
};

/**
 * Clear the blocked content cache (call when admin updates rules)
 */
export const clearBlockedContentCache = () => {
  _blockedCache = {
    global: null,
    communities: {},
    lastFetch: 0,
  };
};
