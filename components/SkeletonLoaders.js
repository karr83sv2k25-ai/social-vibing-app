/**
 * SkeletonLoaders — Reusable animated skeleton/shimmer components
 * for loading states across the app.
 *
 * Usage:
 *   import { ConversationSkeleton, ProfileSkeleton, ProductCardSkeleton } from './components/SkeletonLoaders';
 *   {loading ? <ConversationSkeleton count={6} /> : <ActualContent />}
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Shared pulse animation hook
const usePulse = () => {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return pulse;
};

// ─── Conversation List Skeleton ───────────────────────────────
const ConversationItem = ({ pulse }) => (
  <Animated.View style={[sk.convRow, { opacity: pulse }]}>
    <View style={sk.convAvatar} />
    <View style={sk.convLines}>
      <View style={sk.convName} />
      <View style={sk.convMsg} />
    </View>
    <View style={sk.convTime} />
  </Animated.View>
);

export const ConversationSkeleton = ({ count = 6 }) => {
  const pulse = usePulse();
  return (
    <View style={sk.container}>
      {[...Array(count)].map((_, i) => <ConversationItem key={i} pulse={pulse} />)}
    </View>
  );
};

// ─── Profile Skeleton ─────────────────────────────────────────
export const ProfileSkeleton = () => {
  const pulse = usePulse();
  return (
    <Animated.View style={[sk.container, { opacity: pulse }]}>
      <View style={sk.profileCover} />
      <View style={sk.profileAvatarWrap}>
        <View style={sk.profileAvatar} />
      </View>
      <View style={sk.profileName} />
      <View style={sk.profileBio} />
      <View style={sk.profileStats}>
        <View style={sk.profileStat} />
        <View style={sk.profileStat} />
        <View style={sk.profileStat} />
      </View>
    </Animated.View>
  );
};

// ─── Product Card Grid Skeleton ───────────────────────────────
const ProductCard = ({ pulse }) => (
  <Animated.View style={[sk.productCard, { opacity: pulse }]}>
    <View style={sk.productImage} />
    <View style={sk.productTitle} />
    <View style={sk.productPrice} />
  </Animated.View>
);

export const ProductGridSkeleton = ({ count = 4 }) => {
  const pulse = usePulse();
  return (
    <View style={sk.productGrid}>
      {[...Array(count)].map((_, i) => <ProductCard key={i} pulse={pulse} />)}
    </View>
  );
};

// ─── Community Card Skeleton ──────────────────────────────────
const CommunityItem = ({ pulse }) => (
  <Animated.View style={[sk.communityCard, { opacity: pulse }]}>
    <View style={sk.communityImage} />
    <View style={sk.communityInfo}>
      <View style={sk.communityName} />
      <View style={sk.communityMembers} />
    </View>
  </Animated.View>
);

export const CommunitySkeleton = ({ count = 4 }) => {
  const pulse = usePulse();
  return (
    <View style={sk.container}>
      {[...Array(count)].map((_, i) => <CommunityItem key={i} pulse={pulse} />)}
    </View>
  );
};

// ─── Chat Message Skeleton ────────────────────────────────────
const ChatBubble = ({ pulse, isRight }) => (
  <Animated.View style={[sk.chatBubbleRow, isRight && sk.chatBubbleRight, { opacity: pulse }]}>
    {!isRight && <View style={sk.chatBubbleAvatar} />}
    <View style={[sk.chatBubble, isRight ? sk.chatBubbleMe : sk.chatBubbleThem]} />
  </Animated.View>
);

export const ChatSkeleton = ({ count = 8 }) => {
  const pulse = usePulse();
  return (
    <View style={sk.container}>
      {[...Array(count)].map((_, i) => (
        <ChatBubble key={i} pulse={pulse} isRight={i % 3 === 0} />
      ))}
    </View>
  );
};

// ─── Generic Line Skeleton ────────────────────────────────────
export const LineSkeleton = ({ width: w = '100%', height = 14, style }) => {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[
        { width: w, height, borderRadius: 6, backgroundColor: '#222' },
        { opacity: pulse },
        style,
      ]}
    />
  );
};

// ─── Styles ───────────────────────────────────────────────────
const sk = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 12 },

  // Conversation
  convRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  convAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222' },
  convLines: { flex: 1, marginLeft: 12 },
  convName: { width: '50%', height: 14, borderRadius: 6, backgroundColor: '#222', marginBottom: 8 },
  convMsg: { width: '80%', height: 12, borderRadius: 6, backgroundColor: '#1a1a1a' },
  convTime: { width: 36, height: 10, borderRadius: 4, backgroundColor: '#1a1a1a' },

  // Profile
  profileCover: { width: '100%', height: 140, backgroundColor: '#1a1a1a', borderRadius: 12 },
  profileAvatarWrap: { alignItems: 'center', marginTop: -40 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#222', borderWidth: 3, borderColor: '#0B0B0E' },
  profileName: { width: 120, height: 18, borderRadius: 8, backgroundColor: '#222', alignSelf: 'center', marginTop: 12 },
  profileBio: { width: 200, height: 12, borderRadius: 6, backgroundColor: '#1a1a1a', alignSelf: 'center', marginTop: 8 },
  profileStats: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 24 },
  profileStat: { width: 50, height: 40, borderRadius: 8, backgroundColor: '#1a1a1a' },

  // Product Grid
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12, paddingTop: 12 },
  productCard: { width: (width - 36) / 2, borderRadius: 12, overflow: 'hidden' },
  productImage: { width: '100%', height: 140, backgroundColor: '#1a1a1a', borderRadius: 12 },
  productTitle: { width: '70%', height: 14, borderRadius: 6, backgroundColor: '#222', marginTop: 8 },
  productPrice: { width: '40%', height: 12, borderRadius: 6, backgroundColor: '#222', marginTop: 6 },

  // Community
  communityCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, backgroundColor: '#17171C', borderRadius: 12, padding: 12 },
  communityImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#222' },
  communityInfo: { flex: 1, marginLeft: 12 },
  communityName: { width: '60%', height: 14, borderRadius: 6, backgroundColor: '#222', marginBottom: 8 },
  communityMembers: { width: '35%', height: 10, borderRadius: 5, backgroundColor: '#1a1a1a' },

  // Chat
  chatBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 4 },
  chatBubbleRight: { justifyContent: 'flex-end' },
  chatBubbleAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#222', marginRight: 8 },
  chatBubble: { height: 36, borderRadius: 16 },
  chatBubbleMe: { width: '55%', backgroundColor: '#2A1B50' },
  chatBubbleThem: { width: '65%', backgroundColor: '#1E1E24' },
});
