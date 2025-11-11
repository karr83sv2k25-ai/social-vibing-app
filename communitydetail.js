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
} from 'react-native';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from './firebaseConfig';

export default function CommunityDetail({ route, navigation }) {
  const { communityId } = route.params || {};
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchCommunity = async () => {
      if (!communityId) {
        Alert.alert('Error', 'No community id provided');
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore(app);
        const ref = doc(db, 'communities', communityId);
        const snap = await getDoc(ref);
        if (snap.exists() && mounted) {
          setCommunity({ id: snap.id, ...snap.data() });
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
          <Image source={profileImage ? { uri: profileImage } : require('./assets/profile.png')} style={styles.avatar} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.title}>{name || community.title || 'Community'}</Text>
            <Text style={styles.sub}>{category || ''} • {memberCount} members</Text>
          </View>
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

        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Members', `Members: ${memberCount}`)}>
          <Text style={styles.actionText}>View Members</Text>
        </TouchableOpacity>
      </View>
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
});
