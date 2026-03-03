import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#8B2EF0';

/**
 * AnnouncementBanner — displays pinned community announcements.
 *
 * Props:
 *   announcements   – Array of announcement objects (each should have { id, title?, caption?, text?, createdAt? })
 *   onPress          – (announcement) => void  — called when an announcement is tapped
 *   onDismiss        – () => void              — called when the banner is dismissed (optional)
 *   collapsible      – boolean (default true)  — whether the banner can be collapsed
 *   style            – additional container style
 *   variant          – 'banner' | 'compact' (default 'banner')
 */
const AnnouncementBanner = React.memo(({
  announcements = [],
  onPress,
  onDismiss,
  collapsible = true,
  style,
  variant = 'banner',
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const heightAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);
  const autoScrollTimer = useRef(null);

  // Auto-rotate announcements every 5 seconds when there are multiple
  useEffect(() => {
    if (announcements.length <= 1 || collapsed) {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
      return;
    }

    autoScrollTimer.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % announcements.length;
        scrollRef.current?.scrollTo({ x: next * (SCREEN_WIDTH - 32), animated: true });
        return next;
      });
    }, 5000);

    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [announcements.length, collapsed]);

  const toggleCollapse = useCallback(() => {
    const toValue = collapsed ? 1 : 0;
    Animated.timing(heightAnim, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setCollapsed(!collapsed);
  }, [collapsed, heightAnim]);

  const handleScroll = useCallback((e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
    setActiveIndex(index);
  }, []);

  if (!announcements || announcements.length === 0) return null;

  const getAnnouncementText = (a) =>
    a.title || a.caption || a.text || 'Announcement';

  const formatDate = (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // ─── Compact variant (single-line bar) ───
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, style]}
        onPress={() => onPress?.(announcements[activeIndex])}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="bullhorn" size={14} color="#fff" />
        <Text style={styles.compactText} numberOfLines={1}>
          {getAnnouncementText(announcements[activeIndex])}
        </Text>
        {announcements.length > 1 && (
          <Text style={styles.compactCount}>{activeIndex + 1}/{announcements.length}</Text>
        )}
      </TouchableOpacity>
    );
  }

  // ─── Full banner variant ───
  const contentHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, announcements.length === 1 ? 70 : 90],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="bullhorn" size={16} color={ACCENT} />
          <Text style={styles.headerTitle}>
            Announcements{announcements.length > 1 ? ` (${announcements.length})` : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {collapsible && (
            <TouchableOpacity onPress={toggleCollapse} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={collapsed ? 'chevron-down' : 'chevron-up'}
                size={18}
                color="#888"
              />
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={{ marginLeft: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <Animated.View style={{ height: contentHeight, overflow: 'hidden' }}>
        {announcements.length === 1 ? (
          <TouchableOpacity
            style={styles.singleItem}
            onPress={() => onPress?.(announcements[0])}
            activeOpacity={0.7}
          >
            <View style={styles.itemIcon}>
              <MaterialCommunityIcons name="pin" size={16} color={ACCENT} />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {getAnnouncementText(announcements[0])}
              </Text>
              {announcements[0].createdAt && (
                <Text style={styles.itemDate}>{formatDate(announcements[0].createdAt)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
            >
              {announcements.map((a, i) => (
                <TouchableOpacity
                  key={a.id || i}
                  style={[styles.carouselItem, { width: SCREEN_WIDTH - 32 }]}
                  onPress={() => onPress?.(a)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIcon}>
                    <MaterialCommunityIcons name="pin" size={16} color={ACCENT} />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {getAnnouncementText(a)}
                    </Text>
                    {a.createdAt && (
                      <Text style={styles.itemDate}>{formatDate(a.createdAt)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Dots indicator */}
            <View style={styles.dotsRow}>
              {announcements.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, activeIndex === i && styles.dotActive]}
                />
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  // ─── Full banner ───
  container: {
    backgroundColor: '#17171C',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#8B2EF030',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  singleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  carouselItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B2EF015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#eee',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  itemDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#444',
  },
  dotActive: {
    backgroundColor: ACCENT,
    width: 14,
    borderRadius: 3,
  },

  // ─── Compact variant ───
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  compactText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  compactCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default AnnouncementBanner;
