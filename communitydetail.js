import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  ActionSheetIOS,
  StatusBar,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app, db } from './firebaseConfig';
import ReportUserModal from './components/ReportUserModal';
import ModeratorBadge from './components/ModeratorBadge';
import AnnouncementBanner from './components/AnnouncementBanner';
import FeaturedFeed from './components/FeaturedFeed';
import CommunitySidebar from './components/CommunitySidebar';
import { getUserCheckInData, getLiveStreak } from './shared/services/communityCheckInService';
import * as CommunityService from './shared/services/communityService';
import * as ModerationService from './shared/services/moderationService';
import useUserNames from './hooks/useUserNames';
import { collection, getDocs, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const { ROLES } = ModerationService;

export default function CommunityDetail({ route, navigation }) {
  const { communityId } = route.params || {};
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [pinnedPosts, setPinnedPosts] = useState([]);

  // Live author-name resolution for pinned posts (updates when user edits name)
  const pinnedAuthorIds = useMemo(
    () => pinnedPosts.map((p) => p.authorId || p.createdById).filter(Boolean),
    [pinnedPosts]
  );
  const pinnedLiveNames = useUserNames(pinnedAuthorIds, communityId);
  const [userPoints, setUserPoints] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const auth = getAuth(app);

  // Derived booleans for backward compat
  const isCreator = myRole === ROLES.OWNER;
  const isStaff = myRole && myRole !== ROLES.MEMBER;
  const isLeaderOrAbove = [ROLES.OWNER, ROLES.ADMIN, ROLES.LEADER].includes(myRole);

  // Track previous announcement IDs to avoid redundant re-fetches
  const prevAnnouncementIdsRef = React.useRef(null);

  useEffect(() => {
    if (!communityId) {
      Alert.alert('Error', 'No community id provided');
      setLoading(false);
      return;
    }

    let mounted = true;

    // ── Helper: fetch announcement post objects when the pinned IDs change ──
    const fetchAnnouncementPosts = async (announcementIds) => {
      if (!mounted) return;
      if (!announcementIds || announcementIds.length === 0) {
        setAnnouncements([]);
        return;
      }
      try {
        const result = await CommunityService.getAnnouncements(db, communityId);
        if (result.success && mounted) {
          setAnnouncements(result.data);
        }
      } catch (e) {
        console.log('Announcements fetch error:', e?.message);
      }
    };

    // ── Helper: one-time side-data fetch (featured, pinned posts, role) ──
    const fetchSideData = async () => {
      if (!mounted) return;
      try {
        const featuredResult = await CommunityService.getFeaturedPosts(db, communityId, 10);
        if (featuredResult.success && featuredResult.data.length > 0 && mounted) {
          setFeaturedPosts(featuredResult.data);
        }
      } catch (e) {
        console.log('Featured posts not available:', e?.message);
      }

      try {
        const postsRef = collection(db, 'communities', communityId, 'posts');
        const pinnedQuery = query(postsRef, where('isPinned', '==', true), firestoreLimit(3));
        const pinnedSnap = await getDocs(pinnedQuery);
        if (!pinnedSnap.empty && mounted) {
          setPinnedPosts(pinnedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.log('Pinned posts not available:', e?.message);
      }

      const currentUserId = auth.currentUser?.uid;
      if (currentUserId && mounted) {
        try {
          const role = await ModerationService.getCommunityRole(db, communityId, currentUserId);
          const globalRole = await ModerationService.getGlobalRole(db, currentUserId);
          if (globalRole === 'admin' && (!role || role === ROLES.MEMBER)) {
            setMyRole(ROLES.ADMIN);
          } else {
            setMyRole(role || ROLES.MEMBER);
          }
        } catch (e) {
          console.log('Role fetch error:', e?.message);
        }

        try {
          const checkInData = await getUserCheckInData(db, communityId, currentUserId);
          if (checkInData && mounted) {
            setUserPoints(checkInData.totalPoints || 0);
            setUserStreak(getLiveStreak(checkInData));
          }
        } catch (e) {
          console.log('Check-in data not available:', e?.message);
        }
      }
    };

    // ── Real-time listener on the community doc ──
    const ref = doc(db, 'communities', communityId);
    let sideDataFetched = false;

    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (!mounted) return;

      if (!snap.exists()) {
        Alert.alert('Not found', 'Community not found');
        setLoading(false);
        return;
      }

      const communityData = { id: snap.id, ...snap.data() };
      setCommunity(communityData);
      setLoading(false);

      // Re-fetch announcement posts only when the pinned IDs array has actually changed
      const newIds = JSON.stringify(communityData.announcements || []);
      if (prevAnnouncementIdsRef.current !== newIds) {
        prevAnnouncementIdsRef.current = newIds;
        fetchAnnouncementPosts(communityData.announcements);
      }

      // Fetch side data (featured, pinned posts, role) only once on first load
      if (!sideDataFetched) {
        sideDataFetched = true;
        fetchSideData();
      }
    }, (err) => {
      console.error('Community snapshot error:', err);
      if (mounted) {
        Alert.alert('Error', 'Failed to load community');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [communityId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#08FFE2" />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>Community not found</Text>
      </View>
    );
  }

  const {
    profileImage,
    coverImage,
    backgroundImage,
    name,
    category,
    description,
    themeColor,
    discover,
    privacy,
    createdAt,
    updatedAt,
    community_members,
    members,
    memberIds: memberIdsField,
    memberCount: memberCountField,
    members_count: membersCountField,
  } = community;

  // Combine members + memberIds (deduped) — the creator lives in memberIds, joiners in members.
  // This is the only way to get the true count across all creation/join paths.
  const _membersArr = Array.isArray(members) ? members : [];
  const _memberIdsArr = Array.isArray(memberIdsField) ? memberIdsField : [];
  const _combined = [...new Set([..._membersArr, ..._memberIdsArr])];
  const memberCount = _combined.length > 0
    ? _combined.length
    : typeof memberCountField === 'number' && memberCountField > 0
      ? memberCountField
      : typeof membersCountField === 'number' && membersCountField > 0
        ? membersCountField
        : Array.isArray(community_members)
          ? community_members.length
          : (typeof community_members === 'number' ? community_members : 0);

  const handleReportOptions = () => {
    const options = ['Cancel', 'Report Community'];
    let destructiveIndex = 1;
    
    if (isStaff) {
      options.splice(1, 0, 'Admin Portal');
      destructiveIndex = 2;
    }
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: destructiveIndex,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          const label = options[buttonIndex];
          if (label === 'Admin Portal') {
            navigation.navigate('CommunityAdminPortal', { communityId, communityData: { id: communityId, name: name || community?.title, profileImage } });
          } else if (label === 'Report Community') {
            setShowReportModal(true);
          }
        }
      );
    } else {
      const alertOptions = [
        { text: 'Cancel', style: 'cancel' },
      ];
      
      if (isStaff) {
        alertOptions.push({
          text: 'Admin Portal',
          onPress: () => navigation.navigate('CommunityAdminPortal', { communityId, communityData: { id: communityId, name: name || community?.title, profileImage } }),
        });
      }
      alertOptions.push({
        text: 'Report Community',
        style: 'destructive',
        onPress: () => setShowReportModal(true),
      });
      
      Alert.alert('Community Options', 'What would you like to do?', alertOptions);
    }
  };

  const accentColor = themeColor || '#7C3AED';
  const coverSrc = coverImage ? { uri: coverImage } : backgroundImage ? { uri: backgroundImage } : null;

  return (
    <View style={styles.container}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="light-content" />

      {/* ── Cover / Hero ── */}
      <View style={styles.heroContainer}>
        {coverSrc ? (
          <ImageBackground source={coverSrc} style={styles.hero}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.72)', '#000']}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={[accentColor, '#0d0d0d']}
            style={styles.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        {/* Menu button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setSidebarVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Options button */}
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={handleReportOptions}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Avatar — overlaps cover */}
        <View style={[styles.avatarRing, { borderColor: accentColor }]}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={[accentColor, '#1a1a2e']}
              style={styles.avatarFallback}
            >
              <Ionicons name="people" size={36} color="#fff" />
            </LinearGradient>
          )}
        </View>
      </View>

      {/* ── Announcements ticker (full-width, below hero) ── */}
      {announcements.length > 0 && (
        <AnnouncementBanner
          announcements={announcements}
          variant="compact"
          onPress={() => setShowAnnouncementsModal(true)}
        />
      )}

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* Name + badges */}
        <View style={styles.nameRow}>
          <Text style={styles.title} numberOfLines={2}>
            {name || community.title || 'Community'}
          </Text>
          {isCreator && <ModeratorBadge type="owner" size="small" />}
          {myRole === ROLES.ADMIN && <ModeratorBadge type="admin" size="small" />}
          {myRole === ROLES.LEADER && <ModeratorBadge type="leader" size="small" />}
          {myRole === ROLES.CURATOR && <ModeratorBadge type="curator" size="small" />}
        </View>

        {/* Category chip + member count */}
        <View style={styles.metaChipRow}>
          {!!category && (
            <View style={[styles.chip, { backgroundColor: accentColor + '33', borderColor: accentColor }]}>
              <Ionicons name="grid-outline" size={12} color={accentColor} />
              <Text style={[styles.chipText, { color: accentColor }]}>{category}</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Ionicons name="people-outline" size={12} color="#aaa" />
            <Text style={styles.chipText}>{memberCount} members</Text>
          </View>
          {!!privacy && (
            <View style={styles.chip}>
              <Ionicons
                name={privacy === 'open' ? 'globe-outline' : 'lock-closed-outline'}
                size={12}
                color="#aaa"
              />
              <Text style={[styles.chipText, { textTransform: 'capitalize' }]}>{privacy}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {!!description && (
          <View style={styles.descCard}>
            <Text style={styles.descText}>{description}</Text>
          </View>
        )}

        {/* ── Pinned Posts ── */}
        {pinnedPosts.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.featuredHeader}>
              <Ionicons name="pin" size={16} color="#FF6B6B" />
              <Text style={styles.featuredTitle}>Pinned Posts</Text>
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>{pinnedPosts.length}</Text>
              </View>
            </View>
            {pinnedPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.featuredCard}
                onPress={() => navigation.navigate('GroupInfo', { communityId, highlightPostId: post.id })}
                activeOpacity={0.75}
              >
                <View style={styles.featuredCardLeft}>
                  <View style={[styles.featuredIndicator, { backgroundColor: '#FF6B6B' }]} />
                  <View style={styles.featuredCardContent}>
                    <Text style={styles.featuredCardTitle} numberOfLines={2}>
                      {post.title || post.content || post.text || 'Pinned Post'}
                    </Text>
                    <Text style={styles.featuredCardMeta}>
                      {pinnedLiveNames[post.authorId || post.createdById] || post.createdByName || post.authorName || 'Staff'} · Pinned
                    </Text>
                  </View>
                </View>
                {post.imageUrl || post.images?.[0] ? (
                  <Image
                    source={{ uri: post.imageUrl || post.images[0] }}
                    style={styles.featuredCardImage}
                  />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Featured Posts Feed ── */}
        {featuredPosts.length > 0 && (
          <FeaturedFeed
            featuredPosts={featuredPosts}
            communityId={communityId}
            onPress={(post) => navigation.navigate('GroupInfo', { communityId, highlightPostId: post.id })}
            isStaff={isStaff}
            onManage={() => navigation.navigate('GroupInfo', { communityId, openModal: 'featured' })}
            style={{ marginTop: 16, paddingHorizontal: 0 }}
          />
        )}

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name={(discover === 'public' || discover === true) ? 'eye-outline' : 'eye-off-outline'} size={16} color="#aaa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Discoverability</Text>
              <Text style={styles.infoValue}>{typeof discover === 'string' ? discover.charAt(0).toUpperCase() + discover.slice(1) : (discover === true ? 'Public' : discover === false ? 'Private' : '—')}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <View style={[styles.themeCircle, { backgroundColor: themeColor || '#444' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Theme Color</Text>
              <Text style={styles.infoValue}>{themeColor || 'Default'}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={16} color="#aaa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {createdAt
                  ? new Date(createdAt.seconds ? createdAt.seconds * 1000 : createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: accentColor }]}
            onPress={() => navigation.navigate('CommunityCheckIn', { communityId, communityData: community })}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.primaryActionText}>Check In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => Alert.alert('Members', `${memberCount} members`)}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={18} color="#fff" />
            <Text style={styles.secondaryActionText}>Members</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Nav ── */}
        <View style={styles.quickNav}>
          {[
            { icon: 'chatbubble-ellipses-outline', label: 'Posts', screen: 'GroupInfo' },
            { icon: 'images-outline', label: 'Media', screen: 'GroupInfo' },
            { icon: 'shield-checkmark-outline', label: 'Staff', screen: 'CommunityStaff' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickNavItem}
              onPress={() => navigation.navigate(item.screen, { communityId })}
              activeOpacity={0.75}
            >
              <View style={[styles.quickNavIcon, { backgroundColor: accentColor + '22' }]}>
                <Ionicons name={item.icon} size={20} color={accentColor} />
              </View>
              <Text style={styles.quickNavLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ReportUserModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUser={{
          id: communityId,
          username: name || community?.title || 'Community',
          name: name || community?.title || 'Community',
        }}
        reportType="community"
        contentId={communityId}
        contentType="community"
        contentPreview={description || name || 'Community content'}
        communityId={communityId}
      />

      <CommunitySidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        communityId={communityId}
        communityData={community}
        currentUser={auth.currentUser}
        isAdmin={isCreator || myRole === ROLES.ADMIN}
        isModerator={isStaff}
        userPoints={userPoints}
        userStreak={userStreak}
        navigation={navigation}
      />
    </ScrollView>

      {/* ── Announcements Full-Detail Modal ── */}
      <Modal
        visible={showAnnouncementsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAnnouncementsModal(false)}
      >
        <View style={styles.announcementModalOverlay}>
          <View style={styles.announcementModalContent}>
            {/* Header */}
            <View style={styles.announcementModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="bullhorn" size={20} color="#8B2EF0" />
                <Text style={styles.announcementModalTitle}>
                  Announcements{announcements.length > 1 ? ` (${announcements.length})` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAnnouncementsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {announcements.map((a, i) => {
                const fullText = a.text || a.caption || a.title || 'Announcement';
                const date = a.createdAt
                  ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds ? a.createdAt.seconds * 1000 : a.createdAt)).toLocaleDateString()
                  : null;
                return (
                  <View key={a.id || i} style={styles.announcementDetailCard}>
                    <View style={styles.announcementDetailIconRow}>
                      <View style={styles.announcementDetailIcon}>
                        <MaterialCommunityIcons name="pin" size={14} color="#8B2EF0" />
                      </View>
                      {date && (
                        <Text style={styles.announcementDetailDate}>{date}</Text>
                      )}
                    </View>
                    <Text style={styles.announcementDetailText}>{fullText}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },

  /* Hero / cover */
  heroContainer: { position: 'relative' },
  hero: { width: '100%', height: 200 },
  menuButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    left: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    left: 58,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    position: 'absolute',
    bottom: -44,
    left: 20,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    overflow: 'visible',
    zIndex: 10,
  },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarFallback: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Body */
  body: { paddingTop: 56, paddingHorizontal: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.2, flexShrink: 1 },

  /* Chips */
  metaChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  chipText: { color: '#aaa', fontSize: 12, fontWeight: '500' },

  /* Description */
  descCard: {
    marginTop: 14,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#212121',
  },
  descText: { color: '#ccc', fontSize: 14, lineHeight: 21 },

  /* Info card */
  infoCard: {
    marginTop: 16,
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#212121',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 1 },
  infoDivider: { height: 1, backgroundColor: '#1e1e1e', marginHorizontal: 16 },
  themeCircle: { width: 18, height: 18, borderRadius: 9 },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  secondaryActionText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* Quick nav */
  quickNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  quickNavItem: { flex: 1, alignItems: 'center', gap: 6 },
  quickNavIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickNavLabel: { color: '#aaa', fontSize: 12, fontWeight: '500' },

  /* Featured / Pinned Posts Section */
  featuredSection: {
    marginTop: 16,
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#222',
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
    flex: 1,
  },
  featuredBadge: {
    backgroundColor: '#FF6B6B30',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  featuredBadgeText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '700',
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  featuredCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  featuredIndicator: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 10,
  },
  featuredCardContent: {
    flex: 1,
  },
  featuredCardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  featuredCardMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 3,
  },
  featuredCardImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },

  /* Announcements Modal */
  announcementModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  announcementModalContent: {
    backgroundColor: '#111116',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 200,
    flex: 0,
    borderWidth: 1,
    borderColor: '#8B2EF030',
  },
  announcementModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  announcementModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  announcementDetailCard: {
    backgroundColor: '#17171C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8B2EF025',
  },
  announcementDetailIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  announcementDetailIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8B2EF015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  announcementDetailDate: {
    color: '#666',
    fontSize: 12,
  },
  announcementDetailText: {
    color: '#e0e0e0',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
});
