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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app, db } from './firebaseConfig';
import ReportUserModal from './components/ReportUserModal';
import ModeratorBadge from './components/ModeratorBadge';
import * as CommunityService from './shared/services/communityService';

export default function CommunityDetail({ route, navigation }) {
  const { communityId } = route.params || {};
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const auth = getAuth(app);

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
          
          const currentUserId = auth.currentUser?.uid;
          if (currentUserId) {
            const creator = communityData.creatorId === currentUserId;
            setIsCreator(creator);
            
            const modStatus = await CommunityService.isModerator(db, communityId, currentUserId);
            setIsModerator(modStatus);
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
    
    if (isModerator || isCreator) {
      options.splice(1, 0, 'Edit Community');
      destructiveIndex = 2;
    }
    if (isCreator) {
      options.splice(1, 0, 'Manage Moderators');
      destructiveIndex = 3;
    }
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          destructiveButtonIndex: destructiveIndex,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (isCreator && buttonIndex === 1) {
            navigation.navigate('ModeratorsManagement', { communityId });
          } else if ((isModerator || isCreator) && buttonIndex === (isCreator ? 2 : 1)) {
            navigation.navigate('EditCommunity', { communityId });
          } else if (buttonIndex === destructiveIndex) {
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
          text: 'Manage Moderators',
          onPress: () => navigation.navigate('ModeratorsManagement', { communityId }),
        });
      }
      if (isModerator || isCreator) {
        alertOptions.push({
          text: 'Edit Community',
          onPress: () => navigation.navigate('EditCommunity', { communityId }),
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {coverImage ? (
        <ImageBackground source={{ uri: coverImage }} style={styles.cover}>
          <View style={styles.coverOverlay} />
        </ImageBackground>
      ) : backgroundImage ? (
        <ImageBackground source={{ uri: backgroundImage }} style={styles.cover}>
          <View style={styles.coverOverlay} />
        </ImageBackground>
      ) : (
        <View style={[styles.cover, { backgroundColor: themeColor || '#111' }]} />
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#E1E8ED', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={40} color="#657786" />
            </View>
          )}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.title}>{name || community.title || 'Community'}</Text>
              {isCreator && <ModeratorBadge type="creator" size="medium" />}
              {isModerator && !isCreator && <ModeratorBadge type="moderator" size="medium" />}
            </View>
            <Text style={styles.sub}>{category || ''} • {memberCount} members</Text>
          </View>
          <TouchableOpacity
            style={styles.moreOptionsButton}
            onPress={handleReportOptions}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {!!description && (
          <Text style={styles.description}>{description}</Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Privacy:</Text>
          <Text style={styles.metaValue}>{privacy || '—'}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Discover:</Text>
          <Text style={styles.metaValue}>{discover || '—'}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Theme:</Text>
          <View style={[styles.colorBox, { backgroundColor: themeColor || '#444' }]} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.small}>Created: {createdAt ? new Date(createdAt.seconds ? createdAt.seconds * 1000 : createdAt).toLocaleString() : '—'}</Text>
          <Text style={styles.small}>Updated: {updatedAt ? new Date(updatedAt.seconds ? updatedAt.seconds * 1000 : updatedAt).toLocaleString() : '—'}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <TouchableOpacity
            style={[styles.actionButton, { flex: 1, marginTop: 0 }]}
            onPress={() => Alert.alert('Members', `Members: ${memberCount}`)}
          >
            <Text style={styles.actionText}>View Members</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { flex: 1, marginTop: 0, backgroundColor: '#7C3AED' }]}
            onPress={() => navigation.navigate('DailyReward')}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" style={{ marginBottom: 2 }} />
            <Text style={[styles.actionText, { color: '#fff' }]}>Check In</Text>
          </TouchableOpacity>
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
        contentPreview={description || name || 'Community content'}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  cover: { width: '100%', height: 160, justifyContent: 'flex-end' },
  coverOverlay: { height: 40, backgroundColor: 'rgba(0,0,0,0.35)' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#08FFE2' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: '#aaa', marginTop: 4 },
  description: { color: '#ddd', marginTop: 12, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  metaLabel: { color: '#aaa', width: 80 },
  metaValue: { color: '#fff' },
  colorBox: { width: 20, height: 20, borderRadius: 4, marginLeft: 8 },
  small: { color: '#666', marginTop: 6 },
  actionButton: { marginTop: 18, backgroundColor: '#08FFE2', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  actionText: { color: '#000', fontWeight: '700' },
  moreOptionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
});
