import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import CachedImage from './CachedImage';
import useUserNames from '../hooks/useUserNames';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#FFD700';
const CARD_GAP = 10;
const HORIZONTAL_PADDING = 16;
const CONTENT_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
const HALF_WIDTH = (CONTENT_WIDTH - CARD_GAP) / 2;

/**
 * FeaturedFeed — Displays featured community posts in a priority layout.
 *
 * Layout rules:
 *   - 1st featured post: full-width hero card (larger, prominent)
 *   - 2nd+ posts: 2-column grid (4th below 2nd, 5th below 3rd, etc.)
 *
 * Props:
 *   featuredPosts  – Array of post objects (sorted by featuredAt desc)
 *   onPress        – (post) => void — called when a featured card is tapped
 *   onViewAll      – () => void — called when "View All" is tapped (optional)
 *   isStaff        – boolean — shows manage button if true
 *   onManage       – () => void — called when Manage is tapped
 *   style          – additional container style
 *   maxVisible     – number of posts to show before "View All" (default: all)
 */
const FeaturedFeed = React.memo(({
  featuredPosts = [],
  onPress,
  onViewAll,
  isStaff = false,
  onManage,
  style,
  maxVisible,
  communityId = null,
}) => {
  const [imageErrors, setImageErrors] = useState({});

  // Live author name resolution — updates automatically when a user edits their name.
  const authorIds = useMemo(
    () => featuredPosts.map((p) => p.authorId).filter(Boolean),
    [featuredPosts]
  );
  // Pass communityId so community nicknames are preferred over global names.
  const liveNames = useUserNames(authorIds, communityId);

  const handleImageError = useCallback((postId) => {
    setImageErrors(prev => ({ ...prev, [postId]: true }));
  }, []);

  if (!featuredPosts || featuredPosts.length === 0) return null;

  const visiblePosts = maxVisible ? featuredPosts.slice(0, maxVisible) : featuredPosts;
  const hasMore = maxVisible && featuredPosts.length > maxVisible;

  const getPostText = (post) =>
    post.title || post.caption || post.content || post.text || 'Featured Post';

  const getPostImage = (post) => {
    if (imageErrors[post.id]) return null;
    return post.imageUrl || post.imageUri || post.images?.[0] || post.coverImage || null;
  };

  const getAuthorName = (post) =>
    liveNames[post.authorId] || post.authorName || post.createdByName || 'Community';

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

  // ─── Hero Card (first featured post — largest) ───
  const renderHeroCard = (post) => {
    const image = getPostImage(post);
    return (
      <TouchableOpacity
        key={post.id}
        style={styles.heroCard}
        onPress={() => onPress?.(post)}
        activeOpacity={0.85}
      >
        {image ? (
          <View style={styles.heroImageContainer}>
            <CachedImage
              source={{ uri: image }}
              style={styles.heroImage}
              contentFit="cover"
              onError={() => handleImageError(post.id)}
            />
            {/* Gradient overlay */}
            <View style={styles.heroOverlay} />
            {/* Featured badge */}
            <View style={styles.heroBadge}>
              <MaterialIcons name="star" size={12} color="#000" />
              <Text style={styles.heroBadgeText}>FEATURED</Text>
            </View>
            {/* Content on top of image */}
            <View style={styles.heroContentOverlay}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {getPostText(post)}
              </Text>
              <View style={styles.heroMeta}>
                {post.authorImage ? (
                  <CachedImage
                    source={{ uri: post.authorImage }}
                    style={styles.heroAvatar}
                  />
                ) : (
                  <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                    <Ionicons name="person" size={10} color="#aaa" />
                  </View>
                )}
                <Text style={styles.heroAuthor}>{getAuthorName(post)}</Text>
                {post.featuredAt && (
                  <>
                    <Text style={styles.heroDot}>·</Text>
                    <Text style={styles.heroDate}>{formatDate(post.featuredAt)}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.heroNoImage}>
            {/* Featured badge */}
            <View style={styles.heroBadge}>
              <MaterialIcons name="star" size={12} color="#000" />
              <Text style={styles.heroBadgeText}>FEATURED</Text>
            </View>
            <View style={styles.heroIconPlaceholder}>
              <MaterialIcons name="star" size={48} color={ACCENT + '40'} />
            </View>
            <Text style={styles.heroTitleNoImage} numberOfLines={3}>
              {getPostText(post)}
            </Text>
            <View style={styles.heroMeta}>
              {post.authorImage ? (
                <CachedImage
                  source={{ uri: post.authorImage }}
                  style={styles.heroAvatar}
                />
              ) : (
                <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                  <Ionicons name="person" size={10} color="#aaa" />
                </View>
              )}
              <Text style={styles.heroAuthor}>{getAuthorName(post)}</Text>
              {post.featuredAt && (
                <>
                  <Text style={styles.heroDot}>·</Text>
                  <Text style={styles.heroDate}>{formatDate(post.featuredAt)}</Text>
                </>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Grid Card (2nd+ featured posts — smaller, 2-column) ───
  const renderGridCard = (post) => {
    const image = getPostImage(post);
    return (
      <TouchableOpacity
        key={post.id}
        style={styles.gridCard}
        onPress={() => onPress?.(post)}
        activeOpacity={0.85}
      >
        {image ? (
          <CachedImage
            source={{ uri: image }}
            style={styles.gridImage}
            contentFit="cover"
            onError={() => handleImageError(post.id)}
          />
        ) : (
          <View style={styles.gridImagePlaceholder}>
            <MaterialIcons name="star" size={24} color={ACCENT + '40'} />
          </View>
        )}
        <View style={styles.gridContent}>
          {/* Featured indicator */}
          <View style={styles.gridBadge}>
            <MaterialIcons name="star" size={10} color={ACCENT} />
            <Text style={styles.gridBadgeText}>FEATURED</Text>
          </View>
          <Text style={styles.gridTitle} numberOfLines={2}>
            {getPostText(post)}
          </Text>
          <Text style={styles.gridMeta} numberOfLines={1}>
            {getAuthorName(post)}{post.featuredAt ? ` · ${formatDate(post.featuredAt)}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Build the 2-column grid from remaining posts ───
  const gridPosts = visiblePosts.slice(1);
  const gridRows = [];
  for (let i = 0; i < gridPosts.length; i += 2) {
    gridRows.push(gridPosts.slice(i, i + 2));
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="star" size={20} color={ACCENT} />
          <Text style={styles.headerTitle}>Featured</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{featuredPosts.length}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {isStaff && onManage && (
            <TouchableOpacity
              onPress={onManage}
              style={styles.manageButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="settings" size={14} color={ACCENT} />
              <Text style={styles.manageText}>Manage</Text>
            </TouchableOpacity>
          )}
          {hasMore && onViewAll && (
            <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hero — first featured post */}
      {renderHeroCard(visiblePosts[0])}

      {/* Grid — remaining featured posts in 2-column layout */}
      {gridRows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.gridRow}>
          {row.map((post) => renderGridCard(post))}
          {/* If odd number, add an empty spacer */}
          {row.length === 1 && <View style={styles.gridSpacer} />}
        </View>
      ))}

      {/* View All footer for many posts */}
      {hasMore && (
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={onViewAll}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllButtonText}>
            View all {featuredPosts.length} featured posts
          </Text>
          <Ionicons name="chevron-forward" size={16} color={ACCENT} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  countBadge: {
    backgroundColor: ACCENT + '25',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  countText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT + '40',
    gap: 4,
  },
  manageText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Hero Card (1st featured — large) ───
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: ACCENT + '30',
    marginBottom: CARD_GAP,
  },
  heroImageContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    // Gradient effect via layering
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    zIndex: 2,
  },
  heroBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroContentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  heroAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  heroAvatarFallback: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAuthor: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroDot: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  heroNoImage: {
    padding: 20,
    minHeight: 180,
    justifyContent: 'center',
  },
  heroIconPlaceholder: {
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitleNoImage: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },

  // ─── Grid Cards (2nd+ featured — smaller, 2-column) ───
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  gridCard: {
    width: HALF_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ACCENT + '20',
  },
  gridImage: {
    width: '100%',
    height: 110,
  },
  gridImagePlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContent: {
    padding: 10,
  },
  gridBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  gridBadgeText: {
    color: ACCENT,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  gridTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 4,
  },
  gridMeta: {
    color: '#888',
    fontSize: 11,
  },
  gridSpacer: {
    width: HALF_WIDTH,
  },

  // ─── View All ───
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: ACCENT + '20',
  },
  viewAllButtonText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default FeaturedFeed;
