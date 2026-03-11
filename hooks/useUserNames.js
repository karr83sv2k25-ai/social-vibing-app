/**
 * useUserNames – real-time display-name resolver for a set of user IDs.
 *
 * Subscribes to `users/{uid}` (and, when communityId is supplied, to
 * `communities_members/{uid}_{communityId}` for community nicknames) so that
 * any name/nickname change is immediately reflected in every community screen
 * without a page reload.
 *
 * Community nickname (if set) always takes precedence over the global
 * display name, matching the save logic in groupinfo.js handleSaveNickname.
 *
 * Usage:
 *   const liveNames = useUserNames(userIds, communityId);
 *   // liveNames is a plain object { [uid]: 'Display Name' }
 *   // Render: liveNames[msg.senderId] || msg.senderName || 'User'
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getDisplayName } from '../utils/userNameHelpers';

const SYSTEM_IDS = new Set(['system', 'System', '']);

/**
 * @param {string[]} userIds     – List of user IDs to resolve (may contain dupes / 'system').
 * @param {string|null} communityId – When provided, community nickname is checked and preferred.
 * @returns {{ [uid: string]: string }} Map of uid → display name, updated in real-time.
 */
export default function useUserNames(userIds = [], communityId = null) {
  const [names, setNames] = useState({});

  // Stable, deduplicated list of real user IDs (excludes 'system' etc.)
  const uniqueIds = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const id of userIds) {
      if (id && !SYSTEM_IDS.has(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    return result;
  }, [userIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the latest name state per uid in a ref to avoid stale closure issues
  // when nickname listener fires after user listener.
  const nameMap = useRef({});

  useEffect(() => {
    if (uniqueIds.length === 0) return;

    const unsubscribers = [];

    uniqueIds.forEach((uid) => {
      // ── 1. Subscribe to global user document ────────────────────────────
      const userUnsub = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const displayName = getDisplayName(snap.data());
            // Only update if no community nickname is overriding
            nameMap.current[uid] = nameMap.current[uid] || displayName;
            // Always refresh global name; nickname subscription may override it
            setNames((prev) => {
              // If communityId is set, nickname sub may already have set a name.
              // We only replace if no nickname override is stored separately.
              const existing = prev[uid];
              if (!existing || existing === nameMap.current[`${uid}_global`]) {
                nameMap.current[`${uid}_global`] = displayName;
                return { ...prev, [uid]: displayName };
              }
              nameMap.current[`${uid}_global`] = displayName;
              return prev;
            });
          }
        },
        () => {} // silently ignore permission errors
      );
      unsubscribers.push(userUnsub);

      // ── 2. Subscribe to community nickname (if communityId given) ────────
      // Nicknames are stored in the top-level `communities_members` collection
      // as `{uid}_{communityId}` documents (matches the save logic in groupinfo.js).
      if (communityId) {
        const membershipDocId = `${uid}_${communityId}`;
        const memberUnsub = onSnapshot(
          doc(db, 'communities_members', membershipDocId),
          (snap) => {
            if (snap.exists()) {
              const nickname = snap.data()?.communityNickname;
              if (nickname && nickname.trim()) {
                setNames((prev) => ({ ...prev, [uid]: nickname.trim() }));
              } else {
                // Nickname removed – fall back to global name
                const globalName = nameMap.current[`${uid}_global`];
                if (globalName) {
                  setNames((prev) => ({ ...prev, [uid]: globalName }));
                }
              }
            } else {
              // Member doc doesn't exist – use global name
              const globalName = nameMap.current[`${uid}_global`];
              if (globalName) {
                setNames((prev) => ({ ...prev, [uid]: globalName }));
              }
            }
          },
          () => {} // silently ignore permission errors
        );
        unsubscribers.push(memberUnsub);
      }
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [uniqueIds.join(','), communityId]); // eslint-disable-line react-hooks/exhaustive-deps

  return names;
}
