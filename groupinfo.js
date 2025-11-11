import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';

import { Ionicons, Entypo, AntDesign, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { app as firebaseApp } from './firebaseConfig';


export default function GroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, groupTitle } = route.params || {};
  const [selectedButton, setSelectedButton] = useState('Explore');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch community details from Firestore
  useEffect(() => {
    const fetchCommunity = async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getFirestore(firebaseApp);
        const communityRef = doc(db, 'communities', communityId);
        const communitySnap = await getDoc(communityRef);
        if (communitySnap.exists()) {
          const data = communitySnap.data();
          
          // Get member count: prefer members_count, then community_members, then calculate from members array
          let memberCount = 0;
          if (typeof data.members_count === 'number') {
            memberCount = data.members_count;
          } else if (typeof data.community_members === 'number') {
            memberCount = data.community_members;
          } else if (Array.isArray(data.members)) {
            memberCount = data.members.length;
          } else if (Array.isArray(data.community_members)) {
            memberCount = data.community_members.length;
          }
          
          setCommunity({ 
            id: communitySnap.id, 
            ...data,
            memberCount: memberCount // Add calculated member count to community object
          });
          
          // Fetch members if memberIds array exists
          if (data.memberIds && Array.isArray(data.memberIds)) {
            const usersCol = collection(db, 'users');
            const memberDocs = await Promise.all(
              data.memberIds.slice(0, 5).map(async (uid) => {
                const userDoc = await getDoc(doc(usersCol, uid));
                return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
              })
            );
            setMembers(memberDocs.filter(Boolean));
          } else {
            setMembers([]);
          }
        } else {
          setError('Community not found');
        }
      } catch (e) {
        setError('Failed to load community');
      }
      setLoading(false);
    };
    if (communityId) fetchCommunity();
  }, [communityId]);

  // Use category from Firestore as tag
  const tags = community?.category ? [`#${community.category}`] : ['#Uncategorized'];
  const bottomButtons = ['Explore', 'Post', 'Chat', 'Info', 'Members'];
  const categories = community?.categories || [
    'Anime & Manga',
    'Role play',
    'Art & Aesthetic',
    'Fandom',
    'Animals & Pets',
  ];

  const TagButton = ({ title, colorActive }) => (
    <TouchableOpacity style={[styles.tagButton, { borderColor: colorActive }]}> 
      <Text style={[styles.tagButtonText, { color: colorActive }]}> 
        {title}
      </Text>
    </TouchableOpacity>
  );

  const handleSendMessage = () => {
    if (chatInput.trim() === '') return;
    const newMessage = { id: Date.now(), text: chatInput, type: 'right' };
    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');
  };

  // Handlers (stub)
  const onEditMembers = () => {
    console.log('Edit Members tapped');
  };
  const onEditDescription = () => {
    console.log('Edit Description tapped');
  };
  const onInviteMember = () => {
    console.log('Invite Member tapped');
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topRightIcons}>
          <TouchableOpacity style={{ marginRight: 16 }}>
            <Entypo name="dots-three-vertical" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <AntDesign name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff' }}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {/* Group Card */}
          <View style={styles.cardContainer}>
            <Image
              source={community?.profileImage ? { uri: community.profileImage } : require('./assets/posticon.jpg')}
              style={styles.groupImage}
              resizeMode="cover"
            />
            <View style={styles.infoWrapperHorizontal}>
              <Text style={styles.groupName}>{community?.name || groupTitle || 'Community'}</Text>
              <Text style={styles.groupSubtitle}>{community?.id || communityId} | {community?.language || 'English'}</Text>

              {/* Members (mini preview) */}
              <View style={styles.membersWrapper}>
                <View style={styles.membersImages}>
                  {members.length > 0 ? (
                    members.map((user, index) => (
                      <Image
                        key={user.id}
                        source={user.profileImage ? { uri: user.profileImage } : require('./assets/a1.png')}
                        style={[
                          styles.memberImage,
                          index !== 0 && { marginLeft: -10 },
                        ]}
                      />
                    ))
                  ) : (
                    <Image source={require('./assets/a1.png')} style={styles.memberImage} />
                  )}
                </View>
                <Text style={styles.membersText}>{community?.memberCount || members.length || 0} members</Text>
              </View>

              {/* Tags */}
              <View style={styles.tagsWrapper}>
                {tags.map((tag, i) => (
                  <TagButton key={i} title={tag} colorActive="#4da6ff" />
                ))}
              </View>
            </View>
          </View>

          {/* Search / Announcement */}
          <View style={styles.searchWrapper}>
            <MaterialIcons name="notifications-none" size={24} color="#888" />
            <TextInput
              placeholder={community?.announcement || 'No Announcement'}
              placeholderTextColor="#888"
              style={styles.searchInput}
              editable={false}
            />
          </View>

          {/* Bottom Buttons */}
          <View style={styles.bottomButtonsWrapper}>
            {bottomButtons.map((btn) => (
              <TouchableOpacity
                key={btn}
                style={[
                  styles.bottomButton,
                  selectedButton === btn && {
                    borderColor: 'purple',
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSelectedButton(btn)}>
                <Text style={styles.bottomButtonText}>{btn}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Explore Content */}
          {selectedButton === 'Explore' && (
            <View style={styles.exploreContent}>
              <Text style={styles.achievementTitle}>Achievement</Text>
              {/* Achievements: show member avatars as dummy achievements */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.achievementsHorizontalRow}
                style={{ marginTop: 12 }}>
                {members.map((user, index) => (
                  <View key={user.id} style={styles.achievementChip}>
                    <Image source={user.profileImage ? { uri: user.profileImage } : require('./assets/a1.png')} style={styles.achievementImage} />
                    <Text style={styles.achievementName} numberOfLines={1}>
                      {user.name || user.displayName || 'User'}
                    </Text>
                    <Text style={styles.achievementTime}>1 hour ago</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={{ marginTop: 30 }}>
                <View style={styles.livePartiesHeader}>
                  <Text style={styles.sectionTitle}>Live Parties</Text>
                  <Text style={styles.viewAllText}>All </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 12, marginBottom: 10 }}>
                  {categories.map((cat, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.categoryButton,
                        selectedCategory === cat && {
                          borderColor: 'purple',
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat)}>
                      <Text style={styles.categoryButtonText}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Placeholder for live parties */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10 }}>
                  {members.map((user, index) => (
                    <View key={user.id} style={styles.livePartyCard}>
                      <Image source={user.profileImage ? { uri: user.profileImage } : require('./assets/a1.png')} style={styles.livePartyImage} />
                      <Text style={styles.livePartyName}>{user.name || user.displayName || 'User'}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Post Content (placeholder, no Firestore posts) */}
          {selectedButton === 'Post' && (
            <View style={styles.postContent}>
              <Text style={{ color: '#fff' }}>No posts yet.</Text>
            </View>
          )}

          {/* Chat (dummy, not Firestore) */}
          {selectedButton === 'Chat' && (
            <ScrollView
              style={styles.chatContent}
              contentContainerStyle={{ paddingBottom: 20 }}>
              {chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatMessageContainer,
                    {
                      flexDirection: msg.type === 'left' ? 'row' : 'row-reverse',
                      alignItems: 'flex-start',
                    },
                  ]}>
                  <Image
                    source={msg.profilePic || require('./assets/a1.png')}
                    style={styles.profilePic}
                  />
                  <View
                    style={[
                      styles.chatMessageBox,
                      msg.type === 'right'
                        ? { borderColor: '#08FFE2' }
                        : { borderColor: '#ff8c00' },
                    ]}>
                    <Text style={styles.chatMessageTitle}>
                      {msg.title || 'User'}
                    </Text>
                    <Text style={styles.chatMessageText}>{msg.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Info Content */}
          {selectedButton === 'Info' && (
            <ScrollView
              style={styles.infoContent}
              contentContainerStyle={{ paddingBottom: 28 }}>
              {/* Members preview + edit (horizontal chips) */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeaderRow}>
                  <Text style={styles.infoSectionTitle}>Members</Text>
                  <TouchableOpacity
                    onPress={onEditMembers}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="create-outline" size={20} color="#bbb" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.membersHorizontalRow}>
                  {members.map((user, index) => (
                    <View key={user.id} style={styles.memberChip}>
                      <Image source={user.profileImage ? { uri: user.profileImage } : require('./assets/a1.png')} style={styles.memberChipImage} />
                      <Text style={styles.memberChipName} numberOfLines={1}>
                        {user.name || user.displayName || 'User'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Category Tag */}
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Category Tag</Text>
                <View style={styles.tagRow}>
                  {tags.map((tag, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.pillButton, i === 0 && styles.pillActive]}>
                      <Text style={i === 0 ? styles.pillTextActive : styles.pillText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description + edit */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeaderRow}>
                  <Text style={styles.infoSectionTitle}>Description</Text>
                  <TouchableOpacity
                    onPress={onEditDescription}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="create-outline" size={20} color="#bbb" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.infoText}>
                  {community?.description || 'No description provided.'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onInviteMember}
                activeOpacity={0.85}
                style={[styles.inviteWrapper, { marginTop: 16 }]}>
                <LinearGradient
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                  style={styles.inviteGradient}>
                  <Text style={styles.inviteText}>Invite New Member</Text>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Members TAB (full list) */}
          {selectedButton === 'Members' && (
            <ScrollView
              style={styles.membersPage}
              contentContainerStyle={{ paddingBottom: 28 }}>
              <Text style={styles.membersPageTitle}>Members</Text>

              <View style={styles.memberListWrapper}>
                {members.map((user, index) => (
                  <View key={user.id} style={styles.memberRow}>
                    <View style={styles.memberRowLeft}>
                      <Image source={user.profileImage ? { uri: user.profileImage } : require('./assets/a1.png')} style={styles.memberRowAvatar} />
                      <View>
                        <Text style={styles.memberRowName}>{user.name || user.displayName || 'User'}</Text>
                        <Text style={styles.memberRowSeen}>
                          last seen a day ago
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.roleBadge,
                          index === 0 ? styles.roleOwner : styles.roleMember,
                        ]}>
                        {index === 0 ? 'Owner' : 'Member'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Invite New Member button at end */}
              <TouchableOpacity
                onPress={onInviteMember}
                activeOpacity={0.85}
                style={[styles.inviteWrapper, { marginTop: 16 }]}>
                <LinearGradient
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
                  style={styles.inviteGradient}>
                  <Text style={styles.inviteText}>Invite New Member</Text>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: { flex: 1, backgroundColor: '#121212' },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  topRightIcons: { flexDirection: 'row', alignItems: 'center' },

  // Card Container
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    margin: 16,
    alignItems: 'center',
  },
  groupImage: { width: 100, height: 100, borderRadius: 12 },
  infoWrapperHorizontal: { flex: 1, marginLeft: 12 },
  groupName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  groupSubtitle: { color: '#888', fontSize: 14, marginTop: 2 },

  // Members (card header)
  membersWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  membersImages: { flexDirection: 'row' },
  memberImage: { width: 30, height: 30, borderRadius: 15 },
  membersText: { color: '#fff', marginLeft: 8 },

  // Tags
  tagsWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  tagButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  tagButtonText: { fontSize: 12, color: '#fff' },

  // Search
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  searchInput: { flex: 1, marginLeft: 8, color: '#fff' },

  // Bottom Buttons
  bottomButtonsWrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  bottomButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderColor: '#444',
    borderWidth: 1,
  },
  bottomButtonText: { color: '#fff', fontWeight: 'bold' },

  // Explore & Users
  exploreContent: { paddingHorizontal: 16, paddingTop: 16 },
  achievementTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Explore: Achievement horizontal row
  achievementsHorizontalRow: { paddingRight: 8 },
  achievementChip: { width: 76, alignItems: 'center', marginRight: 12 },
  achievementImage: { width: 56, height: 56, borderRadius: 28 },
  achievementName: {
    color: '#fff',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  achievementTime: { color: '#888', fontSize: 10, marginTop: 2 },

  // Live Parties
  livePartiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  viewAllText: { color: '#888', fontSize: 12 },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    marginRight: 10,
  },
  categoryButtonText: { color: '#fff', fontSize: 12 },
  livePartyCard: { marginRight: 12, alignItems: 'center' },
  livePartyImage: { width: 100, height: 100, borderRadius: 12 },
  livePartyName: { color: '#fff', fontSize: 12, marginTop: 4 },

  // Posts
  postContent: { paddingHorizontal: 16, paddingTop: 16 },
  postCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postUserName: { color: '#fff', fontWeight: 'bold' },
  postUserEmail: { color: '#888', fontSize: 12 },
  postImage: { width: 200, height: 120, borderRadius: 12, marginRight: 8 },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center' },
  actionText: { color: '#fff', marginLeft: 4 },

  // Chat
  chatContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#121212',
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    marginTop: 100,
  },
  chatMessageContainer: {
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  chatMessageBox: {
    maxWidth: 260,
    minHeight: 150,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#08FFE2',
  },
  chatMessageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  chatMessageText: { fontSize: 14, color: '#fff', lineHeight: 18 },

  // Info tab (preview chips + edit)
  infoContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#121212',
  },
  infoSection: { marginBottom: 24 },
  infoSectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoText: { color: '#ccc', fontSize: 14, lineHeight: 20 },

  membersHorizontalRow: { paddingRight: 8 },
  memberChip: { width: 70, alignItems: 'center', marginRight: 12 },
  memberChipImage: { width: 56, height: 56, borderRadius: 28 },
  memberChipName: {
    color: '#fff',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },

  // Members tab (full list)
  membersPage: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#121212',
  },
  membersPageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  memberListWrapper: {
    backgroundColor: '#151515',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  memberRowLeft: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  memberRowAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  memberRowName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberRowSeen: { color: '#999', fontSize: 12, marginTop: 2 },
  roleBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    overflow: 'hidden',
    fontSize: 12,
  },
  roleOwner: { color: '#FF8BD9', borderColor: '#FF069B' },
  roleMember: { color: '#bbb', borderColor: '#444' },

  // Category Tag pills (Info tab)
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  pillButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
  },
  pillActive: { borderColor: '#7C3AED' },
  pillText: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Invite Member button (shared)
  inviteWrapper: { alignItems: 'center' },
  inviteGradient: {
    width: 328,
    height: 41,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF069B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    opacity: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
  },
  inviteText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginRight: 12,
  },
});
