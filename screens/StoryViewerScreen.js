/**
 * StoryViewerScreen.js
 * Instagram-style full-screen story viewer.
 *
 * Route params:
 *   storyGroups     – Array<{ userId, displayName, userAvatar, stories: Story[] }>
 *   initialGroupIndex – Which user's stories to start on (default 0)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportUserModal from '../components/ReportUserModal';
import { REPORT_TYPES } from '../shared/services/reportService';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 5000; // ms per story

// ──────────────────────────────────────────────────────────────────────────────
export default function StoryViewerScreen({ navigation, route }) {
  const { storyGroups = [], initialGroupIndex = 0 } = route.params || {};
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  // ── state ──────────────────────────────────────────────────────────────────
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // ── refs ───────────────────────────────────────────────────────────────────
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const progressValueRef = useRef(0); // tracks current progress value for pause/resume
  const viewedRef = useRef(new Set()); // tracks story IDs already marked viewed

  // Keep a live ref to current progress value
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // ── derived ────────────────────────────────────────────────────────────────
  const currentGroup = storyGroups[groupIndex] ?? null;
  const currentStory = currentGroup?.stories?.[storyIndex] ?? null;

  // ── helpers ────────────────────────────────────────────────────────────────
  const stopAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
  }, []);

  const startAnim = useCallback(
    (fromValue = 0) => {
      stopAnim();
      progress.setValue(fromValue);
      const remaining = STORY_DURATION * (1 - fromValue);
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: remaining,
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) advanceStory();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress],
  );

  const advanceStory = useCallback(() => {
    const stories = currentGroup?.stories ?? [];
    if (storyIndex + 1 < stories.length) {
      setStoryIndex((i) => i + 1);
      setImageLoaded(false);
    } else if (groupIndex + 1 < storyGroups.length) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
      setImageLoaded(false);
    } else {
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    }
  }, [storyIndex, groupIndex, currentGroup, storyGroups, navigation]);

  const goBack = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      setImageLoaded(false);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex((prevGroup?.stories?.length ?? 1) - 1);
      setImageLoaded(false);
    }
    // if first story of first group, do nothing (already at start)
  }, [storyIndex, groupIndex, storyGroups]);

  // ── mark viewed ─────────────────────────────────────────────────────────────
  const markViewed = useCallback(
    async (story) => {
      if (!story?.id) return;
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      if (viewedRef.current.has(story.id)) return;
      if (Array.isArray(story.viewedBy) && story.viewedBy.includes(uid)) return;

      viewedRef.current.add(story.id);
      try {
        await updateDoc(doc(db, 'stories', story.id), {
          viewedBy: arrayUnion(uid),
          views: increment(1),
        });
      } catch (_) {
        // non-critical – fail silently
      }
    },
    [auth],
  );

  // ── start/stop animation when story changes or image loads ─────────────────
  useEffect(() => {
    if (!imageLoaded || !currentStory) return;
    setIsPaused(false);
    startAnim(0);
    markViewed(currentStory);
    return stopAnim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIndex, groupIndex, imageLoaded]);

  // ── handle text / no-image stories (start immediately) ──────────────────
  useEffect(() => {
    if (!currentStory) return;
    if (!currentStory.image) {
      setImageLoaded(true);
    }
  }, [storyIndex, groupIndex, currentStory]);

  // ── long-press pause ───────────────────────────────────────────────────────
  const handleLongPressIn = useCallback(() => {
    stopAnim();
    setIsPaused(true);
  }, [stopAnim]);

  const handleLongPressOut = useCallback(() => {
    setIsPaused(false);
    startAnim(progressValueRef.current);
  }, [startAnim]);

  // ── early-exit guard ───────────────────────────────────────────────────────
  if (!currentGroup || !currentStory) {
    // Nothing to show
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    return null;
  }

  const stories = currentGroup.stories ?? [];

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ── Background / Story image ──────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        {currentStory.image ? (
          <Image
            source={{ uri: currentStory.image }}
            style={styles.storyImage}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)} // still advance on error
          />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <Ionicons name="image-outline" size={64} color="#444" />
          </View>
        )}
      </View>

      {/* Loading indicator while image fetches */}
      {!imageLoaded && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* ── Tap zones (over everything except top UI) ────────────────────── */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.tapLeft}
          onPress={goBack}
          onLongPress={handleLongPressIn}
          delayLongPress={150}
          onPressOut={handleLongPressOut}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.tapRight}
          onPress={advanceStory}
          onLongPress={handleLongPressIn}
          delayLongPress={150}
          onPressOut={handleLongPressOut}
          activeOpacity={1}
        />
      </View>

      {/* ── Top container: progress bars + header ────────────────────────── */}
      <View
        style={[styles.topContainer, { paddingTop: insets.top + 6 }]}
        pointerEvents="box-none"
      >
        {/* Progress bars */}
        <View style={styles.progressRow}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < storyIndex
                        ? '100%'
                        : i === storyIndex
                        ? progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header row */}
        <View style={styles.header} pointerEvents="box-none">
          {/* User info */}
          <View style={styles.userRow}>
            {currentGroup.userAvatar ? (
              <Image source={{ uri: currentGroup.userAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={16} color="#aaa" />
              </View>
            )}
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.userName}>{currentGroup.displayName}</Text>
              <Text style={styles.storyTime}>{getTimeAgo(currentStory.createdAt)}</Text>
            </View>
            {isPaused && (
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedText}>PAUSED</Text>
              </View>
            )}
          </View>

          {/* Report & Close */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {currentGroup?.userId !== auth.currentUser?.uid && (
              <TouchableOpacity
                onPress={() => {
                  setIsPaused(true);
                  stopAnim();
                  setShowReportModal(true);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="flag-outline" size={22} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Views count ──────────────────────────────────────────────────── */}
      <View
        style={[
          styles.viewsRow,
          { bottom: insets.bottom + (currentStory.caption ? 74 : 20) },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.65)" />
        <Text style={styles.viewsText}>{currentStory.views ?? 0}</Text>
      </View>

      {/* ── Caption overlay ───────────────────────────────────────────────── */}
      {!!currentStory.caption && (
        <View
          style={[styles.captionContainer, { paddingBottom: insets.bottom + 20 }]}
          pointerEvents="none"
        >
          <Text style={styles.captionText}>{currentStory.caption}</Text>
        </View>
      )}

      {/* ── Report Story Modal ─────────────────────────────────────────── */}
      <ReportUserModal
        visible={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setIsPaused(false);
        }}
        reportedUser={{
          id: currentGroup?.userId || '',
          username: currentGroup?.displayName || 'User',
          name: currentGroup?.displayName || 'User',
        }}
        reportType={REPORT_TYPES.STORY}
        contentId={currentStory?.id || currentStory?.storyId || ''}
        contentType="story"
        contentPreview={currentStory?.caption || ''}
      />
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function getTimeAgo(createdAt) {
  if (!createdAt) return '';
  let date;
  if (createdAt?.toDate) {
    date = createdAt.toDate();
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else {
    date = new Date(createdAt);
  }
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyImage: {
    width,
    height,
  },
  noImagePlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Tap zones
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },

  // Top UI
  topContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarFallback: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyTime: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 1,
  },
  pausedBadge: {
    marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pausedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },

  // Caption
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  captionText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },

  // Views
  viewsRow: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginLeft: 3,
  },
});
