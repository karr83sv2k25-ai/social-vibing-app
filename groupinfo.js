import React, { useState } from 'react';
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

export default function GroupInfoScreen() {
  const [selectedButton, setSelectedButton] = useState('Explore');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: 'Lorem ipsum dolor sit amet consectetur. Feugiat lacus aliquam sapien eget placerat risus tincidunt varius.',
      type: 'left',
    },
    {
      id: 2,
      text: 'Lorem ipsum dolor sit amet consectetur. Feugiat lacus aliquam sapien eget placerat risus tincidunt varius.',
      type: 'left',
    },
    {
      id: 3,
      text: 'Lorem ipsum dolor sit amet consectetur. Feugiat lacus aliquam sapien eget placerat risus tincidunt varius.',
      type: 'left',
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const members = [
    require('./assets/a1.png'),
    require('./assets/a2.png'),
    require('./assets/a3.png'),
    require('./assets/a4.png'),
  ];

  const achievementUsers = [
    { name: 'Regina', img: require('./assets/a1.png') },
    { name: 'Judith', img: require('./assets/a2.png') },
    { name: 'Julie', img: require('./assets/a3.png') },
    { name: 'Colleen', img: require('./assets/a4.png') },
    { name: 'Courtney', img: require('./assets/a5.png') },
  ];

  const livePartyUsers = [
    { name: 'Tiesha Kyle', img: require('./assets/post1.1.jpg') },
    { name: 'Olivia Essex', img: require('./assets/post1.2.jpg') },
    { name: 'Tiesha Kyle', img: require('./assets/post1.3.jpg') },
    { name: 'Tiesha Kyle', img: require('./assets/post1.1.jpg') },
  ];

  const posts = [
    {
      id: 1,
      user: {
        name: 'Alice Smith',
        email: 'alice@example.com',
        avatar: require('./assets/a1.png'),
      },
      images: [
        require('./assets/post1.1.jpg'),
        require('./assets/post1.2.jpg'),
      ],
    },
    {
      id: 2,
      user: {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        avatar: require('./assets/a2.png'),
      },
      images: [
        require('./assets/post1.1.jpg'),
        require('./assets/post1.2.jpg'),
        require('./assets/post1.1.jpg'),
      ],
    },
  ];

  const tags = ['#Anime', '#Univversocraft'];
  const bottomButtons = ['Explore', 'Post', 'Chat', 'Info', 'Members'];
  const categories = [
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
          <TouchableOpacity>
            <AntDesign name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Group Card */}
        <View style={styles.cardContainer}>
          <Image
            source={require('./assets/posticon.jpg')}
            style={styles.groupImage}
            resizeMode="cover"
          />
          <View style={styles.infoWrapperHorizontal}>
            <Text style={styles.groupName}>Monkey D. Luffy</Text>
            <Text style={styles.groupSubtitle}>Community ID | English</Text>

            {/* Members (mini preview) */}
            <View style={styles.membersWrapper}>
              <View style={styles.membersImages}>
                {members.map((img, index) => (
                  <Image
                    key={index}
                    source={img}
                    style={[
                      styles.memberImage,
                      index !== 0 && { marginLeft: -10 },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.membersText}>140 members</Text>
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
            placeholder="No Announcement"
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

            {/* One-line horizontal scroll for achievements */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementsHorizontalRow}
              style={{ marginTop: 12 }}>
              {achievementUsers.map((user, index) => (
                <View key={index} style={styles.achievementChip}>
                  <Image source={user.img} style={styles.achievementImage} />
                  <Text style={styles.achievementName} numberOfLines={1}>
                    {user.name}
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

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10 }}>
                {livePartyUsers.map((user, index) => (
                  <View key={index} style={styles.livePartyCard}>
                    <Image source={user.img} style={styles.livePartyImage} />
                    <Text style={styles.livePartyName}>{user.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Post Content */}
        {selectedButton === 'Post' && (
          <View style={styles.postContent}>
            {posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Image source={post.user.avatar} style={styles.postAvatar} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.postUserName}>{post.user.name}</Text>
                    <Text style={styles.postUserEmail}>{post.user.email}</Text>
                  </View>
                  <TouchableOpacity>
                    <Entypo name="dots-three-vertical" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10 }}>
                  {post.images.map((img, index) => (
                    <Image key={index} source={img} style={styles.postImage} />
                  ))}
                </ScrollView>

                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <AntDesign name="like2" size={20} color="#fff" />
                    <Text style={styles.actionText}>Like</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.actionText}>Comment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Entypo name="share" size={20} color="#fff" />
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Chat */}
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

        {/* Info Content (kept simple; no big member list here) */}
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
                {achievementUsers.map((user, index) => (
                  <View key={index} style={styles.memberChip}>
                    <Image source={user.img} style={styles.memberChipImage} />
                    <Text style={styles.memberChipName} numberOfLines={1}>
                      {user.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Category Tag */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Category Tag</Text>
              <View style={styles.tagRow}>
                <TouchableOpacity
                  style={[styles.pillButton, styles.pillActive]}>
                  <Text style={styles.pillTextActive}>#Anime</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pillButton}>
                  <Text style={styles.pillText}>#Role play</Text>
                </TouchableOpacity>
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
                This is a community of Monkey D. Luffy fans. Discuss anime,
                share fan arts, memes, roleplays, and everything related to One
                Piece! Be respectful, keep conversations on-topic, and have fun
                sailing with the crew.
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

        {/* Members TAB (this is where the full list lives now) */}
        {selectedButton === 'Members' && (
          <ScrollView
            style={styles.membersPage}
            contentContainerStyle={{ paddingBottom: 28 }}>
            <Text style={styles.membersPageTitle}>Members</Text>

            <View style={styles.memberListWrapper}>
              {achievementUsers.map((user, index) => (
                <View key={index} style={styles.memberRow}>
                  <View style={styles.memberRowLeft}>
                    <Image source={user.img} style={styles.memberRowAvatar} />
                    <View>
                      <Text style={styles.memberRowName}>{user.name}</Text>
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
