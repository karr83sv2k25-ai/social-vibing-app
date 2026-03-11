// screens/CommunityDataCenterScreen.js
// Data Center – community stats dashboard matching Figma design
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2;

// Stat card colors from Figma
const STAT_COLORS = {
  dailyNewMembers:   { bg: '#3B1F5E', border: '#9B6DFF' },
  dailyActive:       { bg: '#1A3D1F', border: '#22C55E' },
  dailyVisitors:     { bg: '#4A1A1A', border: '#EF4444' },
  totalMembers:      { bg: '#3D3A15', border: '#EAB308' },
  dailyNewPosts:     { bg: '#1A3D1F', border: '#22C55E' },
  totalPosts:        { bg: '#4A1A1A', border: '#EF4444' },
  dailyNewChats:     { bg: '#3B1F5E', border: '#9B6DFF' },
  totalChats:        { bg: '#3D3A15', border: '#EAB308' },
};

export default function CommunityDataCenterScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [communityData, setCommunityData] = useState(null);
  const [stats, setStats] = useState({
    dailyNewMembers: 0,
    dailyActiveMembers: 0,
    dailyVisitors: 0,
    totalMembers: 0,
    dailyNewPosts: 0,
    totalPosts: 0,
    dailyNewChats: 0,
    totalChats: 0,
  });
  const [memberAvatars, setMemberAvatars] = useState([]);

  useEffect(() => {
    if (communityId) {
      fetchData();
    }
  }, [communityId]);

  const fetchData = async () => {
    try {
      // Get community doc
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);

      if (!communitySnap.exists()) {
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      const data = communitySnap.data();
      setCommunityData({ id: communitySnap.id, ...data });

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      const totalMembers = data.memberCount || (data.memberIds?.length || 0);

      // Try to fetch posts count
      let totalPosts = 0;
      let dailyNewPosts = 0;
      try {
        const postsRef = collection(db, 'communities', communityId, 'posts');
        const postsSnap = await getDocs(postsRef);
        totalPosts = postsSnap.size;
        dailyNewPosts = postsSnap.docs.filter(d => {
          const created = d.data().createdAt;
          return created && created.toDate && created.toDate() >= today;
        }).length;
      } catch (e) {
        console.log('Could not fetch posts:', e.message);
      }

      // Try to fetch chats count
      let totalChats = 0;
      let dailyNewChats = 0;
      try {
        const chatsRef = collection(db, 'communities', communityId, 'messages');
        const chatsSnap = await getDocs(chatsRef);
        totalChats = chatsSnap.size;
        dailyNewChats = chatsSnap.docs.filter(d => {
          const created = d.data().createdAt;
          return created && created.toDate && created.toDate() >= today;
        }).length;
      } catch (e) {
        console.log('Could not fetch chats:', e.message);
      }

      setStats({
        dailyNewMembers: 0, // Would need tracking infrastructure
        dailyActiveMembers: 0,
        dailyVisitors: 0,
        totalMembers,
        dailyNewPosts,
        totalPosts,
        dailyNewChats,
        totalChats,
      });

      // Fetch a few member avatars
      if (data.memberIds?.length > 0) {
        const avatarIds = data.memberIds.slice(0, 3);
        const avatars = [];
        for (const uid of avatarIds) {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const u = userSnap.data();
              if (u.profileImage || u.photoURL) {
                avatars.push(u.profileImage || u.photoURL);
              }
            }
          } catch (e) { /* skip */ }
        }
        setMemberAvatars(avatars);
      }

      setLoading(false);
    } catch (error) {
      console.warn('Error loading data center:', error);
      setLoading(false);
    }
  };

  const renderStatCard = (value, label, colorKey) => {
    const color = STAT_COLORS[colorKey] || STAT_COLORS.dailyNewMembers;
    return (
      <View style={[styles.statCard, { backgroundColor: color.bg, borderColor: color.border }]}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#06B6D4" />
        <Text style={styles.loadingText}>Loading data center...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0b0e" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Community Info Card */}
        <View style={styles.communityInfoCard}>
          <Image
            source={{
              uri: communityData?.profileImage ||
                communityData?.coverImage ||
                'https://via.placeholder.com/80',
            }}
            style={styles.communityAvatar}
          />
          <View style={styles.communityTextContainer}>
            <Text style={styles.communityName} numberOfLines={1}>
              {communityData?.name || 'Community'}
            </Text>
            <View style={styles.memberRow}>
              {/* Stacked member avatars */}
              <View style={styles.avatarStack}>
                {memberAvatars.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={[styles.miniAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }]}
                  />
                ))}
              </View>
              <Text style={styles.memberCount}>
                {stats.totalMembers} Members
              </Text>
            </View>
          </View>
        </View>

        {/* Member Stats Section */}
        <View style={[styles.sectionHeader, { borderLeftColor: '#06B6D4' }]}>
          <Text style={[styles.sectionTitle, { color: '#06B6D4' }]}>Member Stats</Text>
        </View>

        <View style={styles.statsGrid}>
          {renderStatCard(stats.dailyNewMembers, 'Daily New Members', 'dailyNewMembers')}
          {renderStatCard(stats.dailyActiveMembers, 'Daily Active Members', 'dailyActive')}
          {renderStatCard(stats.dailyVisitors, 'Daily visitor', 'dailyVisitors')}
          {renderStatCard(stats.totalMembers, 'Total Members', 'totalMembers')}
        </View>

        {/* Content Stats Section */}
        <View style={[styles.sectionHeader, { borderLeftColor: '#06B6D4' }]}>
          <Text style={[styles.sectionTitle, { color: '#06B6D4' }]}>Content Stats</Text>
        </View>

        <View style={styles.statsGrid}>
          {renderStatCard(stats.dailyNewPosts, 'Daily New Posts', 'dailyNewPosts')}
          {renderStatCard(stats.totalPosts, 'Total Posts', 'totalPosts')}
          {renderStatCard(stats.dailyNewChats, 'Daily New chats', 'dailyNewChats')}
          {renderStatCard(stats.totalChats, 'Total Chats', 'totalChats')}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0e',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  communityInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  communityAvatar: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#1a1c22',
  },
  communityTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  communityName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 8,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0a0b0e',
  },
  memberCount: {
    color: '#888',
    fontSize: 13,
  },
  sectionHeader: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    width: CARD_WIDTH,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  statLabel: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
