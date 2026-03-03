/**
 * StoriesRow.js
 * Horizontal scrollable row of story bubbles shown in the home feed.
 *
 * Props:
 *   currentUserId   – uid of the signed-in user
 *   currentUserName – display name of the signed-in user
 *   currentUserAvatar – profile image URL of the signed-in user (may be null)
 *   followingUserIds – array of uid strings the user follows
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useNavigation } from '@react-navigation/native';

const BUBBLE = 62; // avatar ring diameter

export default function StoriesRow({
  currentUserId,
  currentUserName = 'My Story',
  currentUserAvatar = null,
  followingUserIds = [],
}) {
  const navigation = useNavigation();
  const auth = getAuth();

  const [storyGroups, setStoryGroups] = useState([]); // ordered list of groups
  const [loading, setLoading] = useState(true);

  // Keep a mutable map of uid → group so batched snapshots can merge cleanly
  const groupMap = useRef({});

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const targetIds = Array.from(new Set([currentUserId, ...followingUserIds]));
    const now = new Date();

    // Firestore 'in' supports up to 30 values; chunk just in case
    const CHUNK = 30;
    const chunks = [];
    for (let i = 0; i < targetIds.length; i += CHUNK) {
      chunks.push(targetIds.slice(i, i + CHUNK));
    }

    const unsubscribers = [];

    const rebuildGroups = () => {
      const ordered = targetIds
        .map((uid) => groupMap.current[uid])
        .filter(Boolean);
      setStoryGroups(ordered);
      setLoading(false);
    };

    chunks.forEach((chunk) => {
      const q = query(collection(db, 'stories'), where('userId', 'in', chunk));

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          // Rebuild groups from the snapshot (full re-read per update)
          const byUser = {};
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const uid = data.userId;
            if (!byUser[uid]) byUser[uid] = [];

            // Parse Firestore timestamps
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
            const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt ? new Date(data.expiresAt) : null;

            // Filter expired or admin-removed stories client-side
            if (expiresAt && expiresAt < now) return;
            if (data.isRemoved || data.isDeleted) return;

            byUser[uid].push({
              id: docSnap.id,
              ...data,
              createdAt,
              expiresAt,
            });
          });

          // Update groupMap for each uid in this chunk
          chunk.forEach((uid) => {
            const stories = (byUser[uid] ?? []).sort(
              (a, b) => (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0),
            );

            if (stories.length > 0) {
              const sample = stories[0];
              groupMap.current[uid] = {
                userId: uid,
                displayName:
                  uid === currentUserId
                    ? currentUserName
                    : sample.displayName || 'User',
                userAvatar:
                  uid === currentUserId
                    ? currentUserAvatar
                    : sample.userAvatar ?? null,
                stories,
              };
            } else {
              delete groupMap.current[uid];
            }
          });

          rebuildGroups();
        },
        (err) => {
          console.warn('[StoriesRow] Firestore error:', err.message);
          setLoading(false);
        },
      );

      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, followingUserIds.join(',')]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const hasUnseen = (group) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return true;
    return group.stories.some((s) => !Array.isArray(s.viewedBy) || !s.viewedBy.includes(uid));
  };

  const openViewer = (groupIdx) => {
    navigation.navigate('StoryViewer', {
      storyGroups,
      initialGroupIndex: groupIdx,
    });
  };

  const myGroup = storyGroups.find((g) => g.userId === currentUserId) ?? null;
  const myGroupIdx = myGroup ? storyGroups.indexOf(myGroup) : -1;
  const otherGroups = storyGroups.filter((g) => g.userId !== currentUserId);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── My Story bubble ─────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.bubbleWrap}
          onPress={() =>
            myGroup
              ? openViewer(myGroupIdx)
              : navigation.navigate('CreateStory')
          }
          activeOpacity={0.8}
        >
          {/* Ring – gradient if has stories, dashed-style if not */}
          {myGroup ? (
            <LinearGradient
              colors={
                hasUnseen(myGroup)
                  ? ['#08FFE2', '#8B2EF0']
                  : ['#555', '#555']
              }
              style={styles.ring}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
            >
              <AvatarInner uri={currentUserAvatar} />
            </LinearGradient>
          ) : (
            <View style={[styles.ring, styles.ringEmpty]}>
              <AvatarInner uri={currentUserAvatar} />
            </View>
          )}

          {/* "+" badge when no story yet */}
          {!myGroup && (
            <View style={styles.addBadge}>
              <Ionicons name="add" size={12} color="#000" />
            </View>
          )}

          <Text style={styles.label} numberOfLines={1}>
            My Story
          </Text>
        </TouchableOpacity>

        {/* ── Divider ────────────────────────────────────────────── */}
        {otherGroups.length > 0 && <View style={styles.divider} />}

        {/* ── Followed users' story bubbles ────────────────────── */}
        {otherGroups.map((group) => {
          const unseen = hasUnseen(group);
          const idx = storyGroups.indexOf(group);
          return (
            <TouchableOpacity
              key={group.userId}
              style={styles.bubbleWrap}
              onPress={() => openViewer(idx)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  unseen
                    ? ['#F58529', '#DD2A7B', '#8134AF', '#515BD4']
                    : ['#444', '#444']
                }
                style={styles.ring}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
              >
                <AvatarInner uri={group.userAvatar} />
              </LinearGradient>
              <Text style={styles.label} numberOfLines={1}>
                {(group.displayName ?? 'User').split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Loading spinner at end while fetching */}
        {loading && (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator color="#08FFE2" size="small" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Inner avatar circle (sits inside the ring) ─────────────────────────────
function AvatarInner({ uri }) {
  return uri ? (
    <Image source={{ uri }} style={styles.avatarImg} />
  ) : (
    <View style={[styles.avatarImg, styles.avatarFallback]}>
      <Ionicons name="person" size={22} color="#888" />
    </View>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const RING = BUBBLE;
const IMG = RING - 8; // inner image diameter (leaves 4 px on each side for ring)

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#050510',
  },
  scrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 14,
  },
  bubbleWrap: {
    alignItems: 'center',
    width: RING,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },
  avatarImg: {
    width: IMG,
    height: IMG,
    borderRadius: IMG / 2,
    borderWidth: 2.5,
    borderColor: '#050510',
  },
  avatarFallback: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: 18,
    right: 0,
    backgroundColor: '#08FFE2',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#050510',
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
    maxWidth: RING + 4,
  },
  divider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'center',
    marginHorizontal: -4,
  },
  spinnerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: RING,
  },
});
