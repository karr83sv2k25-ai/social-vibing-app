// components/CommunitySidebar.js
// Amino-style sidebar for community navigation
// Provides organized access to all community features

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getUserLevel, LEVEL_IMAGES } from '../shared/services/communityCheckInService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8;

const COLORS = {
  bg: '#0B0B10',
  card: '#14171C',
  card2: '#1A1F27',
  border: '#232833',
  text: '#EAEAF0',
  dim: '#A2A8B3',
  purple: '#7C3AED',
  blue: '#00BFFF',
  green: '#00FF73',
  gold: '#FFD700',
  red: '#FF4757',
};

// Sidebar menu sections
const SIDEBAR_SECTIONS = [
  {
    title: 'My Activity',
    items: [
      { id: 'checkin', icon: 'calendar', label: 'Daily Check-in', screen: 'CommunityCheckIn', color: '#00FF73', badge: null },
      { id: 'leaderboard', icon: 'trophy', label: 'Leaderboard', screen: 'CommunityLeaderboard', color: '#FFD700' },
      { id: 'stats', icon: 'stats-chart', label: 'My Stats', screen: 'MyStats', color: '#00BFFF' },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'members', icon: 'people', label: 'Members', screen: 'Members', color: '#7C3AED' },
      { id: 'chat', icon: 'chatbubbles', label: 'Group Chat', screen: 'Chat', color: '#3B82F6' },
      { id: 'posts', icon: 'document-text', label: 'Posts & Blogs', screen: 'Posts', color: '#EC4899' },
      { id: 'events', icon: 'calendar-outline', label: 'Events', screen: 'Events', color: '#F59E0B' },
    ],
  },
  {
    title: 'Features',
    items: [
      { id: 'voice', icon: 'mic', label: 'Voice Rooms', screen: 'VoiceRooms', color: '#10B981', iconPack: 'Ionicons' },
      { id: 'screening', icon: 'play-circle', label: 'Screening Room', screen: 'Screening', color: '#EF4444' },
      { id: 'roleplay', icon: 'game-controller', label: 'Roleplay', screen: 'Roleplay', color: '#8B5CF6' },
      { id: 'ailab', icon: 'flask', label: 'AI Lab', screen: 'AILab', color: '#06B6D4' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'adminPortal', icon: 'shield-checkmark', label: 'Admin Portal', screen: 'AdminPortal', color: '#D946EF', adminOnly: true },
      { id: 'settings', icon: 'settings', label: 'Community Settings', screen: 'Settings', color: '#6B7280', adminOnly: true },
      { id: 'moderation', icon: 'shield', label: 'Moderation', screen: 'Moderation', color: '#EF4444', modOnly: true },
      { id: 'invite', icon: 'share-social', label: 'Invite Friends', screen: 'Invite', color: '#3B82F6' },
    ],
  },
];

const CommunitySidebar = ({
  visible,
  onClose,
  communityId,
  communityData,
  currentUser,
  isAdmin = false,
  isModerator = false,
  userPoints = 0,
  userStreak = 0,
  navigation,
  onItemPress,
}) => {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [communityNickname, setCommunityNickname] = useState(null);

  // Fetch the current user's community nickname when the sidebar becomes visible.
  // Nicknames are stored in communities_members/{uid}_{communityId}.
  useEffect(() => {
    if (!visible || !currentUser?.uid || !communityId) return;
    let cancelled = false;
    (async () => {
      try {
        const membershipId = `${currentUser.uid}_${communityId}`;
        const memberSnap = await getDoc(doc(db, 'communities_members', membershipId));
        if (!cancelled) {
          const nickname = memberSnap.exists() ? memberSnap.data()?.communityNickname : null;
          setCommunityNickname((nickname && nickname.trim()) ? nickname.trim() : null);
        }
      } catch (_) {
        // silently ignore
      }
    })();
    return () => { cancelled = true; };
  }, [visible, currentUser?.uid, communityId]);
  
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleItemPress = (item) => {
    // If onItemPress handles the item (returns true), skip default navigation
    if (onItemPress && onItemPress(item)) {
      onClose();
      return;
    }
    
    // Handle navigation based on screen
    if (navigation && item.screen) {
      onClose();
      
      // Map screen names to actual navigation routes
      switch (item.screen) {
        case 'CommunityCheckIn':
          navigation.navigate('CommunityCheckIn', { communityId, communityData });
          break;
        case 'CommunityLeaderboard':
          navigation.navigate('CommunityLeaderboard', { communityId, communityData });
          break;
        case 'MyStats':
          // My Stats lives inside the leaderboard screen
          navigation.navigate('CommunityLeaderboard', { communityId, communityData });
          break;
        case 'Members':
          navigation.navigate('GroupInfo', { communityId, initialTab: 'online' });
          break;
        case 'Chat':
          navigation.navigate('GroupInfo', { communityId, initialTab: 'chat' });
          break;
        case 'Posts':
          navigation.navigate('GroupInfo', { communityId, initialTab: 'community' });
          break;
        case 'Events':
          navigation.navigate('GroupInfo', { communityId, initialTab: 'community' });
          break;
        case 'VoiceRooms':
          navigation.navigate('GroupAudioCall', { communityId, community: communityData });
          break;
        case 'Screening':
          navigation.navigate('ScreenSharingRoom', {
            communityId,
            groupTitle: communityData?.name || communityData?.title || 'Screening Room',
            community: communityData,
          });
          break;
        case 'Roleplay':
          navigation.navigate('RoleplayScreen', { communityId, community: communityData });
          break;
        case 'AILab':
          navigation.navigate('KingMediaHome', { communityId });
          break;
        case 'AdminPortal':
          navigation.navigate('CommunityAdminPortal', { communityId, communityData });
          break;
        case 'Settings':
          navigation.navigate('EditCommunity', { communityId });
          break;
        case 'Moderation':
          navigation.navigate('ModeratorsManagement', { communityId });
          break;
        case 'Invite':
          // Share needs a small delay after modal closes to work reliably
          setTimeout(() => {
            Share.share({
              message: `Join ${communityData?.name || communityData?.title || 'my community'} on Social Vibing!\nhttps://socialvibingapp.karr83anime.com/community/${communityId}`,
              title: `Join ${communityData?.name || communityData?.title || 'Community'}`,
            }).catch((err) => {
              if (err?.message !== 'The user did not share') {
                console.log('Share error:', err?.message);
              }
            });
          }, 350);
          break;
        default:
          break;
      }
    }
  };

  const userBadge = getUserLevel(userPoints);

  const renderMenuItem = (item, index) => {
    // Hide admin/mod only items if user doesn't have permission
    if (item.adminOnly && !isAdmin) return null;
    if (item.modOnly && !isModerator && !isAdmin) return null;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.menuItem}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.menuIconBg, { backgroundColor: item.color + '20' }]}>
          <Ionicons name={item.icon} size={20} color={item.color} />
        </View>
        <Text style={styles.menuLabel}>{item.label}</Text>
        {item.badge && (
          <View style={[styles.badgeContainer, { backgroundColor: item.color }]}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={COLORS.dim} style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backdropTouchable} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        {/* Sidebar */}
        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          {/* Header */}
          <LinearGradient
            colors={['#7C3AED', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Community Info */}
            <View style={styles.communityInfo}>
              <Image
                source={{ uri: communityData?.banner || communityData?.coverImage || 'https://via.placeholder.com/150' }}
                style={styles.communityImage}
              />
              <View style={styles.communityTextContainer}>
                <Text style={styles.communityName} numberOfLines={1}>
                  {communityData?.title || communityData?.name || 'Community'}
                </Text>
                <Text style={styles.communityMembers}>
                  {communityData?.memberCount || 0} members
                </Text>
              </View>
            </View>

            {/* User Stats Card */}
            <View style={styles.userStatsCard}>
              <View style={styles.userInfo}>
                <Image
                  source={{ uri: currentUser?.photoURL || currentUser?.profileImage || 'https://via.placeholder.com/50' }}
                  style={styles.userAvatar}
                />
                <View style={styles.userTextContainer}>
                  <Text style={styles.userName}>{communityNickname || currentUser?.displayName || 'User'}</Text>
                  <View style={styles.badgeRow}>
                    <Image source={userBadge.image || LEVEL_IMAGES[1]} style={styles.badgeLevelImage} />
                    <Text style={[styles.badgeName, { color: userBadge.color }]}>Lvl {userBadge.level} - {userBadge.name}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="flame" size={16} color="#FF6B6B" />
                  <Text style={styles.statValue}>{userStreak}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.statValue}>{userPoints}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Menu Items */}
          <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
            {SIDEBAR_SECTIONS.map((section, sectionIndex) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionItems}>
                  {section.items.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
                </View>
              </View>
            ))}

            {/* Bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdropTouchable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.bg,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 30,
  },
  communityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  communityImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  communityTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  communityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  communityMembers: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  userStatsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 14,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userTextContainer: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  badgeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  badgeLevelImage: {
    width: 20,
    height: 20,
    marginRight: 4,
    resizeMode: 'contain',
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 6,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.dim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionItems: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CommunitySidebar;
