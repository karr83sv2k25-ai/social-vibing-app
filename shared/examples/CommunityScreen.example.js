// Example: Using Community Announcements & Featured Posts
// This shows how to use the community service in your React Native app

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { auth, db } from '../firebaseConfig';
import * as CommunityService from '../shared/services/communityService';
import * as PostService from '../shared/services/postService';

// ==================== COMMUNITY SCREEN EXAMPLE ====================
function CommunityScreen({ route, navigation }) {
  const { communityId } = route.params;
  const currentUserId = auth.currentUser?.uid;

  const [community, setCommunity] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [regularPosts, setRegularPosts] = useState([]);
  const [isModerator, setIsModerator] = useState(false);
  const [selectedTab, setSelectedTab] = useState('Featured'); // Featured, Following, Community's

  useEffect(() => {
    loadCommunityData();
  }, [communityId]);

  const loadCommunityData = async () => {
    // Load community details
    const communityResult = await CommunityService.getCommunity(db, communityId);
    if (communityResult.success) {
      setCommunity(communityResult.data);
    }

    // Check if current user is moderator
    const isMod = await CommunityService.isModerator(db, communityId, currentUserId);
    setIsModerator(isMod);

    // Load announcements (pinned posts)
    const announcementsResult = await CommunityService.getAnnouncements(db, communityId);
    if (announcementsResult.success) {
      setAnnouncements(announcementsResult.data);
    }

    // Load featured posts
    if (selectedTab === 'Featured') {
      const featuredResult = await CommunityService.getFeaturedPosts(db, communityId, 10);
      if (featuredResult.success) {
        setFeaturedPosts(featuredResult.data);
      }
    }

    // Load regular posts
    const postsResult = await CommunityService.getCommunityPosts(db, communityId, 20);
    if (postsResult.success) {
      setRegularPosts(postsResult.data);
    }
  };

  const handlePinPost = async (postId) => {
    if (!isModerator) {
      Alert.alert('Error', 'Only moderators can pin posts');
      return;
    }

    const result = await CommunityService.pinPostAsAnnouncement(
      db,
      communityId,
      postId,
      currentUserId
    );

    if (result.success) {
      Alert.alert('Success', 'Post pinned as announcement!');
      loadCommunityData(); // Reload data
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleUnpinPost = async (postId) => {
    if (!isModerator) {
      Alert.alert('Error', 'Only moderators can unpin posts');
      return;
    }

    const result = await CommunityService.unpinAnnouncement(
      db,
      communityId,
      postId,
      currentUserId
    );

    if (result.success) {
      Alert.alert('Success', 'Announcement unpinned!');
      loadCommunityData();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleFeaturePost = async (postId) => {
    if (!isModerator) {
      Alert.alert('Error', 'Only moderators can feature posts');
      return;
    }

    const result = await CommunityService.featurePost(
      db,
      communityId,
      postId,
      currentUserId
    );

    if (result.success) {
      Alert.alert('Success', 'Post featured!');
      loadCommunityData();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleUnfeaturePost = async (postId) => {
    if (!isModerator) {
      Alert.alert('Error', 'Only moderators can unfeature posts');
      return;
    }

    const result = await CommunityService.unfeaturePost(
      db,
      communityId,
      postId,
      currentUserId
    );

    if (result.success) {
      Alert.alert('Success', 'Post unfeatured!');
      loadCommunityData();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const renderAnnouncement = ({ item }) => (
    <TouchableOpacity
      style={styles.announcementItem}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      onLongPress={() => {
        if (isModerator) {
          Alert.alert(
            'Unpin Announcement',
            'Do you want to unpin this announcement?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unpin', onPress: () => handleUnpinPost(item.id) }
            ]
          );
        }
      }}
    >
      <Text style={styles.announcementTitle}>
        {item.title || 'Announcement 1'}
      </Text>
    </TouchableOpacity>
  );

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      >
        {item.isFeatured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
        
        {item.mediaUrls && item.mediaUrls.length > 0 && (
          <Image source={{ uri: item.mediaUrls[0] }} style={styles.postImage} />
        )}
        
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent} numberOfLines={2}>
          {item.content}
        </Text>

        <View style={styles.postStats}>
          <Text>❤️ {item.likeCount}</Text>
          <Text>💬 {item.commentCount}</Text>
          <Text>👁️ {item.views}</Text>
        </View>
      </TouchableOpacity>

      {/* Moderator actions */}
      {isModerator && (
        <View style={styles.modActions}>
          {!item.isPinned && announcements.length < 3 && (
            <TouchableOpacity onPress={() => handlePinPost(item.id)}>
              <Text style={styles.modActionText}>📌 Pin</Text>
            </TouchableOpacity>
          )}
          
          {item.isPinned && (
            <TouchableOpacity onPress={() => handleUnpinPost(item.id)}>
              <Text style={styles.modActionText}>📌 Unpin</Text>
            </TouchableOpacity>
          )}
          
          {!item.isFeatured && (
            <TouchableOpacity onPress={() => handleFeaturePost(item.id)}>
              <Text style={styles.modActionText}>⭐ Feature</Text>
            </TouchableOpacity>
          )}
          
          {item.isFeatured && (
            <TouchableOpacity onPress={() => handleUnfeaturePost(item.id)}>
              <Text style={styles.modActionText}>⭐ Unfeature</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  if (!community) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      {/* Community Header */}
      <View style={styles.header}>
        <Image source={{ uri: community.imageUrl }} style={styles.communityImage} />
        <Text style={styles.communityName}>{community.name}</Text>
        <Text style={styles.memberCount}>{community.memberCount} Members</Text>
        
        {/* Tags */}
        <View style={styles.tagsContainer}>
          {community.tags?.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'Featured' && styles.activeTab]}
          onPress={() => setSelectedTab('Featured')}
        >
          <Text style={styles.tabText}>Featured</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'Following' && styles.activeTab]}
          onPress={() => setSelectedTab('Following')}
        >
          <Text style={styles.tabText}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'Community' && styles.activeTab]}
          onPress={() => setSelectedTab('Community')}
        >
          <Text style={styles.tabText}>Community's</Text>
        </TouchableOpacity>
      </View>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <View style={styles.announcementsSection}>
          <FlatList
            data={announcements}
            renderItem={renderAnnouncement}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Posts List */}
      <FlatList
        data={selectedTab === 'Featured' ? featuredPosts : regularPosts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        refreshing={false}
        onRefresh={loadCommunityData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  communityImage: {
    width: 120,
    height: 120,
    borderRadius: 20,
  },
  communityName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
  },
  memberCount: {
    fontSize: 16,
    color: '#888',
    marginTop: 5,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  tag: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    color: '#fff',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  activeTab: {
    backgroundColor: '#6C5CE7',
  },
  tabText: {
    color: '#fff',
    fontSize: 16,
  },
  announcementsSection: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  announcementItem: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6C5CE7',
  },
  announcementTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postCard: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  featuredBadge: {
    backgroundColor: '#FFD700',
    padding: 5,
    alignItems: 'center',
  },
  featuredText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  postImage: {
    width: '100%',
    height: 200,
  },
  postTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    paddingBottom: 5,
  },
  postContent: {
    color: '#ccc',
    fontSize: 14,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  postStats: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
    gap: 15,
  },
  modActions: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 15,
  },
  modActionText: {
    color: '#6C5CE7',
    fontSize: 14,
  },
});

export default CommunityScreen;
