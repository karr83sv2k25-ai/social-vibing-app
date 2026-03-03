import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app, db } from './firebaseConfig';
import ReportUserModal from './components/ReportUserModal';
import ModeratorBadge from './components/ModeratorBadge';
import AnnouncementBanner from './components/AnnouncementBanner';
import CommunitySidebar from './components/CommunitySidebar';
import { getUserCheckInData, getLiveStreak } from './shared/services/communityCheckInService';
import * as CommunityService from './shared/services/communityService';
import * as ModerationService from './shared/services/moderationService';

const { ROLES } = ModerationService;

export default function CommunityDetail({ route, navigation }) {
  const { communityId } = route.params || {};
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const auth = getAuth(app);

  // Derived booleans for backward compat
  const isCreator = myRole === ROLES.OWNER;
  const isStaff = myRole && myRole !== ROLES.MEMBER;
  const isLeaderOrAbove = [ROLES.OWNER, ROLES.ADMIN, ROLES.LEADER].includes(myRole);

  useEffect(() => {
    let mounted = true;

    const fetchCommunity = async () => {
      if (!communityId) {
        Alert.alert('Error', 'No community id provided');
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, 'communities', communityId);
        const snap = await getDoc(ref);
        if (snap.exists() && mounted) {
          const communityData = { id: snap.id, ...snap.data() };
          setCommunity(communityData);
          
          // Fetch announcements
          const announcementResult = await CommunityService.getAnnouncements(db, communityId);
          if (announcementResult.success && announcementResult.data.length > 0) {
            setAnnouncements(announcementResult.data);
          }
          
          const currentUserId = auth.currentUser?.uid;
          if (currentUserId) {
            // Use proper role resolution instead of legacy boolean
            const role = await ModerationService.getCommunityRole(db, communityId, currentUserId);
            // Also check global admin
            const globalRole = await ModerationService.getGlobalRole(db, currentUserId);
            if (globalRole === 'admin' && (!role || role === ROLES.MEMBER)) {
              setMyRole(ROLES.ADMIN);
            } else {
              setMyRole(role || ROLES.MEMBER);
            }

            // Fetch check-in data for sidebar stats
            try {
              const checkInData = await getUserCheckInData(db, communityId, currentUserId);
              if (checkInData) {
                setUserPoints(checkInData.totalPoints || 0);
                setUserStreak(getLiveStreak(checkInData));
              }
            } catch (e) {
              console.log('Check-in data not available:', e?.message);
            }
          }
        } else if (mounted) {
          Alert.alert('Not found', 'Community not found');
        }
      } catch (err) {
        console.error('Error fetching community:', err);
        Alert.alert('Error', 'Failed to load community');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCommunity();

    return () => { mounted = false; };
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
  } = community;

  const memberCount = Array.isArray(community_members) ? community_members.length : (typeof community_members === 'number' ? community_members : '—');

  const handleReportOptions = () => {
    const options = ['Cancel', 'Report Community'];
    let destructiveIndex = 1;
    
    if (isStaff) {
      options.splice(1, 0, 'Edit Community');
      destructiveIndex = 2;
    }
    if (isCreator) {
      options.splice(1, 0, 'Manage Staff');
      destructiveIndex = isStaff ? 3 : 2;
    }
    if (isLeaderOrAbove) {
      options.splice(options.length - 1, 0, 'Moderation Panel');
      destructiveIndex = options.length - 1;
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
          if (label === 'Manage Staff') {
            navigation.navigate('CommunityStaff', { communityId });
          } else if (label === 'Edit Community') {
            navigation.navigate('EditCommunity', { communityId });
          } else if (label === 'Moderation Panel') {
            navigation.navigate('CommunityModeration', { communityId });
          } else if (label === 'Report Community') {
            setShowReportModal(true);
          }
        }
      );
    } else {
      const alertOptions = [
        { text: 'Cancel', style: 'cancel' },
      ];
      
      if (isCreator) {
        alertOptions.push({
          text: 'Manage Staff',
          onPress: () => navigation.navigate('CommunityStaff', { communityId }),
        });
      }
      if (isStaff) {
        alertOptions.push({
          text: 'Edit Community',
          onPress: () => navigation.navigate('EditCommunity', { communityId }),
        });
      }
      if (isLeaderOrAbove) {
        alertOptions.push({
          text: 'Moderation Panel',
          onPress: () => navigation.navigate('CommunityModeration', { communityId }),
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
    <ScrollView
      style={styles.container}
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
          onPress={() => navigation.goBack()}
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

        {/* Announcements */}
        {announcements.length > 0 && (
          <AnnouncementBanner
            announcements={announcements}
            variant="banner"
            collapsible={true}
            onPress={() => navigation.navigate('GroupInfo', { communityId })}
            style={{ marginTop: 12, borderRadius: 14 }}
          />
        )}

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name={discover === 'public' ? 'eye-outline' : 'eye-off-outline'} size={16} color="#aaa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Discoverability</Text>
              <Text style={styles.infoValue}>{discover ? discover.charAt(0).toUpperCase() + discover.slice(1) : '—'}</Text>
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
          id: community?.createdBy || communityId,
          username: name || community?.title || 'Community',
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
});
