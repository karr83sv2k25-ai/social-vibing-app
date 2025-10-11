import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, TextInput, Text, ScrollView, Image, Dimensions } from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';

import user1 from './assets/post1.1.jpg';
import user2 from './assets/post1.2.jpg';
import user3 from './assets/post1.3.jpg';
import shop1 from './assets/post2.png';
import shop2 from './assets/post2.png';
import shop3 from './assets/post2.png';
import owner1 from './assets/post1.1.jpg';
import owner2 from './assets/post1.1.jpg';
import owner3 from './assets/post1.1.jpg';
import starImage from './assets/starimage.png';
import postIcon from './assets/posticon.jpg';

const { width } = Dimensions.get('window');

export default function HeaderWithSearch({ navigation }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const tabs = ['All', 'Users', 'Shops', 'Community', 'Post Live'];

  const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', pic: user1 },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', pic: user2 },
    { id: '3', name: 'Alex Johnson', email: 'alex@example.com', pic: user3 },
  ];

  const shops = [
    { id: '1', name: 'Marvelous', owner: 'Deamon', ownerPic: owner1, pic: shop1 },
    { id: '2', name: 'Marvelous', owner: 'Deamon', ownerPic: owner2, pic: shop2 },
    { id: '3', name: 'Marvelous', owner: 'Deamon', ownerPic: owner3, pic: shop3 },
  ];

  const communityPosts = [
    { id: '1', title: 'Anime Group', subtitle: 'English', members: 12, image: user1 },
    { id: '2', title: 'Anime Group', subtitle: 'English', members: 12, image: user2 },
    { id: '3', title: 'Anime Group', subtitle: 'English', members: 12, image: user3 },
  ];

  const posts = [
    {
      id: 1,
      name: 'Hitachi BlackSoul',
      username: '@hitachi',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque euismod.',
      likes: 123,
      images: [user1, user2, user3],
    },
    {
      id: 2,
      name: 'Hitachi BlackSoul',
      username: '@hitachi',
      text: 'Just tried this amazing app feature, and it’s really cool! #ReactNative #UI',
      likes: 98,
      images: [shop1],
    },
  ];

  // User row
  const renderUserRow = (item) => (
    <View key={item.id} style={styles.userRow}>
      <Image source={item.pic} style={styles.userPic} />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.subText}>{item.email}</Text>
      </View>
      <TouchableOpacity style={styles.visitButton}>
        <Text style={styles.visitText}>Visit</Text>
      </TouchableOpacity>
    </View>
  );

  // Shop row
  const renderShopRow = (shop) => (
    <View key={shop.id} style={styles.userRow}>
      <Image source={shop.pic} style={styles.shopPic} />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.nameText}>{shop.name}</Text>
        <View style={styles.ownerRow}>
          <View style={styles.ownerLabel}>
            <Text style={styles.ownerText}>Owner: {shop.owner}</Text>
          </View>
          <View style={styles.profileContainer}>
            <Image source={shop.ownerPic} style={styles.profilePic} />
            <Text style={styles.profileName}>{shop.owner}</Text>
            <Image source={starImage} style={styles.profileIcon} />
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.visitButton}>
        <Text style={styles.visitText}>Visit</Text>
      </TouchableOpacity>
    </View>
  );

  // Community row
  const renderCommunityRow = (item) => (
    <View key={item.id} style={styles.communityRow}>
      <Image source={item.image} style={styles.communityImage} />
      <View style={{ marginLeft: 15, justifyContent: 'center' }}>
        <Text style={styles.communityTitle}>{item.title}</Text>
        <Text style={styles.communitySubtitle}>{item.subtitle}</Text>

        <View style={styles.communityLogosContainer}>
          <View style={styles.logoRow}>
            <Image source={owner1} style={styles.smallLogo} />
            <Image source={owner2} style={[styles.smallLogo, { marginLeft: -8 }]} />
            <Image source={owner3} style={[styles.smallLogo, { marginLeft: -8 }]} />
          </View>
          <Text style={styles.membersText}>{item.members} Members</Text>
        </View>

        <View style={styles.tagContainer}>
          <TouchableOpacity style={[styles.tagButton, { borderColor: '#00F0FFBF' }]}>
            <Text style={styles.tagText}>#univversocraft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tagButton, { borderColor: '#F40000' }]}>
            <Text style={styles.tagText}>#Love</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tagButton, { borderColor: '#585D0C' }]}>
            <Text style={styles.tagText}>#Animie</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Post row
  const renderPost = (post) => (
    <View key={post.id} style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={postIcon} style={styles.postProfileImage} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.postName}>{post.name}</Text>
            <Text style={styles.postUsername}>{post.username}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followText}>Follow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginLeft: 10 }}>
            <Entypo name="dots-three-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.postText}>{post.text}</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        {post.images.map((img, index) => (
          <Image key={index} source={img} style={[styles.postImage, { width: (width - 60) / post.images.length }]} />
        ))}
      </View>

      <View style={styles.postFooter}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="heart-outline" size={24} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 5 }}>{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}>
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 5 }}>12</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}>
          <Ionicons name="share-social-outline" size={24} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 5 }}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={20} color="#aaa" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search with a keyword"
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {activeTab === tab && <View style={styles.underline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ALL TAB CONTENT */}
        {activeTab === 'All' && (
          <>
            <Text style={styles.heading}>Users ></Text>
            <View style={styles.userCard}>{users.map(renderUserRow)}</View>

            <Text style={styles.heading}>Shops ></Text>
            <View style={styles.userCard}>{shops.map(renderShopRow)}</View>

            <Text style={styles.heading}>Community ></Text>
            <View style={styles.userCard}>{communityPosts.map(renderCommunityRow)}</View>

            <Text style={styles.heading}>Post Live ></Text>
            <View>{posts.map(renderPost)}</View>
          </>
        )}

        {activeTab === 'Users' && <View style={styles.userCard}>{users.map(renderUserRow)}</View>}
        {activeTab === 'Shops' && <View style={styles.userCard}>{shops.map(renderShopRow)}</View>}
        {activeTab === 'Community' && <View style={styles.userCard}>{communityPosts.map(renderCommunityRow)}</View>}
        {activeTab === 'Post Live' && <View>{posts.map(renderPost)}</View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#1A1D1F', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2D31', borderRadius: 8, paddingHorizontal: 10, height: 40 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  tabContainer: { marginBottom: 20 },
  tabButton: { alignItems: 'center', marginRight: 20 },
  tabText: { color: '#aaa', fontSize: 16, fontWeight: '500' },
  activeTabText: { color: '#fff', fontWeight: '700' },
  underline: { marginTop: 5, width: 8, height: 20, borderRadius: 10, backgroundColor: '#fff', transform: [{ rotate: '-90deg' }] },
  heading: { color: '#fff', fontSize: 18, fontWeight: '700', marginHorizontal: 20, marginBottom: 10 },
  userCard: { backgroundColor: '#1A1D1F', borderRadius: 10, padding: 15, marginHorizontal: 20, marginBottom: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  userPic: { width: 50, height: 50, borderRadius: 25 },
  shopPic: { width: 50, height: 50, borderRadius: 5 },
  communityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  communityImage: { width: 68, height: 103, borderRadius: 8 },
  communityTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  communitySubtitle: { color: '#aaa', fontSize: 14, marginTop: 3 },
  communityLogosContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  smallLogo: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#fff' },
  membersText: { color: '#aaa', fontSize: 13, marginLeft: 10 },
  tagContainer: { flexDirection: 'row', marginTop: 8 },
  tagButton: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  nameText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  subText: { color: '#aaa', fontSize: 14 },
  visitButton: { backgroundColor: '#FF06C8', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 8 },
  visitText: { color: '#fff', fontWeight: '600' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  ownerLabel: { width: 60, borderWidth: 1, borderColor: '#08FFE2', paddingVertical: 2, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  ownerText: { color: '#08FFE2', fontSize: 12, fontWeight: '600' },
  profileContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  profilePic: { width: 20, height: 20, borderRadius: 10, marginRight: 5 },
  profileIcon: { width: 20, height: 20, marginLeft: 5 },
  profileName: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Post
  postContainer: { marginBottom: 20, paddingHorizontal: 20 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  postProfileImage: { width: 50, height: 50, borderRadius: 25 },
  postName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  postUsername: { color: '#aaa', fontSize: 14 },
  followButton: { backgroundColor: '#08FFE2', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5 },
  followText: { color: '#000', fontWeight: '700' },
  postText: { color: '#fff', fontSize: 14, marginBottom: 10 },
  postImage: { height: 100, borderRadius: 10, resizeMode: 'cover' },
  postFooter: { flexDirection: 'row', alignItems: 'center' },
});
