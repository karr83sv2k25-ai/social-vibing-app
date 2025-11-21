import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, TextInput, Text, ScrollView, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { getFirestore, collection, getDocs, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from './firebaseConfig';

import starImage from './assets/starimage.png';
import postIcon from './assets/posticon.jpg';

const { width } = Dimensions.get('window');

export default function HeaderWithSearch({ navigation }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabs = ['All', 'Users', 'Shops', 'Community', 'Post Live'];

  // Fetch users from Firestore (real-time)
  useEffect(() => {
    const db = getFirestore(app);
    const usersCol = collection(db, 'users');
    
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const usersData = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.displayName || data.name || data.fullName || data.username || data.email || 'User',
          email: data.email || '',
          pic: data.profileImage || data.avatar || data.profile_image || data.photoURL || null,
          username: data.username || '',
        };
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.log('Error fetching users:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch shops/marketplace from Firestore (real-time)
  useEffect(() => {
    const db = getFirestore(app);
    
    // Check if marketplace collection exists
    const marketplaceCol = collection(db, 'marketplace');
    
    const unsubscribe = onSnapshot(marketplaceCol, async (snapshot) => {
      const shopsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let ownerName = 'Owner';
          let ownerPic = null;
          
          // Fetch owner details if ownerId exists
          if (data.ownerId) {
            try {
              const ownerRef = doc(db, 'users', data.ownerId);
              const ownerSnap = await getDoc(ownerRef);
              if (ownerSnap.exists()) {
                const ownerData = ownerSnap.data();
                ownerName = ownerData.displayName || ownerData.name || ownerData.username || 'Owner';
                ownerPic = ownerData.profileImage || ownerData.avatar || null;
              }
            } catch (e) {
              console.log('Error fetching owner:', e);
            }
          }
          
          return {
            id: docSnap.id,
            name: data.name || data.title || 'Shop',
            owner: ownerName,
            ownerPic: ownerPic,
            pic: data.image || data.imageUrl || data.photo || null,
            ownerId: data.ownerId,
          };
        })
      );
      setShops(shopsData);
    }, (error) => {
      console.log('Error fetching shops:', error);
      // If marketplace collection doesn't exist, set empty array
      setShops([]);
    });

    return () => unsubscribe();
  }, []);

  // Fetch communities from Firestore (real-time)
  useEffect(() => {
    const db = getFirestore(app);
    const communitiesCol = collection(db, 'communities');
    
    const unsubscribe = onSnapshot(communitiesCol, (snapshot) => {
      const communitiesData = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const memberCount = typeof data.community_members === 'number' 
          ? data.community_members 
          : (Array.isArray(data.members) ? data.members.length : 0);
        
        return {
          id: docSnap.id,
          title: data.name || 'Community',
          subtitle: data.language || data.category || 'General',
          members: memberCount,
          image: data.profileImage || data.coverImage || data.backgroundImage || null,
          category: data.category || '',
        };
      });
      setCommunities(communitiesData);
    }, (error) => {
      console.log('Error fetching communities:', error);
    });

    return () => unsubscribe();
  }, []);

  // Fetch posts and blogs from all communities (real-time)
  useEffect(() => {
    const db = getFirestore(app);
    const unsubscribes = [];
    
    const fetchAllPosts = async () => {
      try {
        const communitiesSnapshot = await getDocs(collection(db, 'communities'));
        const communities = communitiesSnapshot.docs;
        
        for (const commDoc of communities) {
          const commId = commDoc.id;
          
          // Fetch blogs
          try {
            const blogsCol = collection(db, 'communities', commId, 'blogs');
            const blogsQuery = query(blogsCol, orderBy('createdAt', 'desc'));
            
            const blogsUnsub = onSnapshot(blogsQuery, async (snapshot) => {
              const allPostsData = [];
              
              for (const blogDoc of snapshot.docs) {
                const blogData = blogDoc.data();
                const authorId = blogData.authorId;
                
                let authorName = 'User';
                let authorImage = null;
                let username = '';
                
                if (authorId) {
                  try {
                    const userRef = doc(db, 'users', authorId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                      const userData = userSnap.data();
                      authorName = userData.displayName || userData.name || userData.username || 'User';
                      authorImage = userData.profileImage || userData.avatar || null;
                      username = userData.username || '';
                    }
                  } catch (e) {
                    console.log('Error fetching author:', e);
                  }
                }
                
                allPostsData.push({
                  id: blogDoc.id,
                  type: 'blog',
                  communityId: commId,
                  name: authorName,
                  username: username ? `@${username}` : '',
                  text: blogData.content || blogData.title || '',
                  likes: typeof blogData.likes === 'number' ? blogData.likes : 0,
                  images: [],
                  authorImage: authorImage,
                  createdAt: blogData.createdAt,
                });
              }
              
              // Update posts state
              setPosts((prev) => {
                const filtered = prev.filter(p => p.type !== 'blog' || p.communityId !== commId);
                return [...filtered, ...allPostsData].sort((a, b) => {
                  const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                  const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                  return bTime - aTime;
                });
              });
            });
            
            unsubscribes.push(blogsUnsub);
          } catch (e) {
            console.log('Error setting up blogs listener:', e);
          }
          
          // Fetch posts
          try {
            const postsCol = collection(db, 'communities', commId, 'posts');
            const postsQuery = query(postsCol, orderBy('createdAt', 'desc'));
            
            const postsUnsub = onSnapshot(postsQuery, async (snapshot) => {
              const allPostsData = [];
              
              for (const postDoc of snapshot.docs) {
                const postData = postDoc.data();
                const authorId = postData.authorId;
                
                let authorName = 'User';
                let authorImage = null;
                let username = '';
                
                if (authorId) {
                  try {
                    const userRef = doc(db, 'users', authorId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                      const userData = userSnap.data();
                      authorName = userData.displayName || userData.name || userData.username || 'User';
                      authorImage = userData.profileImage || userData.avatar || null;
                      username = userData.username || '';
                    }
                  } catch (e) {
                    console.log('Error fetching author:', e);
                  }
                }
                
                const images = postData.imageUri ? [postData.imageUri] : [];
                
                allPostsData.push({
                  id: postDoc.id,
                  type: 'image',
                  communityId: commId,
                  name: authorName,
                  username: username ? `@${username}` : '',
                  text: postData.caption || '',
                  likes: typeof postData.likes === 'number' ? postData.likes : 0,
                  images: images,
                  authorImage: authorImage,
                  createdAt: postData.createdAt,
                });
              }
              
              // Update posts state
              setPosts((prev) => {
                const filtered = prev.filter(p => p.type !== 'image' || p.communityId !== commId);
                return [...filtered, ...allPostsData].sort((a, b) => {
                  const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                  const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                  return bTime - aTime;
                });
              });
            });
            
            unsubscribes.push(postsUnsub);
          } catch (e) {
            console.log('Error setting up posts listener:', e);
          }
        }
      } catch (e) {
        console.log('Error fetching communities for posts:', e);
      }
    };
    
    fetchAllPosts();
    
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  // Filter data based on search query
  const filterData = (data, searchQuery) => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((item) => {
      if (item.name && item.name.toLowerCase().includes(query)) return true;
      if (item.email && item.email.toLowerCase().includes(query)) return true;
      if (item.username && item.username.toLowerCase().includes(query)) return true;
      if (item.title && item.title.toLowerCase().includes(query)) return true;
      if (item.text && item.text.toLowerCase().includes(query)) return true;
      if (item.subtitle && item.subtitle.toLowerCase().includes(query)) return true;
      if (item.category && item.category.toLowerCase().includes(query)) return true;
      return false;
    });
  };

  const filteredUsers = filterData(users, search);
  const filteredShops = filterData(shops, search);
  const filteredCommunities = filterData(communities, search);
  const filteredPosts = filterData(posts, search);

  // User row
  const renderUserRow = (item) => (
    <TouchableOpacity 
      key={item.id} 
      style={styles.userRow}
      onPress={() => navigation.navigate('Profile', { userId: item.id })}
    >
      <Image 
        source={item.pic ? { uri: item.pic } : require('./assets/a1.png')} 
        style={styles.userPic} 
      />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.subText}>{item.email || item.username || ''}</Text>
      </View>
      <TouchableOpacity 
        style={styles.visitButton}
        onPress={() => navigation.navigate('Profile', { userId: item.id })}
      >
        <Text style={styles.visitText}>Visit</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Shop row
  const renderShopRow = (shop) => (
    <TouchableOpacity 
      key={shop.id} 
      style={styles.userRow}
      onPress={() => navigation.navigate('MarketPlace', { shopId: shop.id })}
    >
      <Image 
        source={shop.pic ? { uri: shop.pic } : require('./assets/post2.png')} 
        style={styles.shopPic} 
      />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.nameText}>{shop.name}</Text>
        <View style={styles.ownerRow}>
          <View style={styles.ownerLabel}>
            <Text style={styles.ownerText}>Owner: {shop.owner}</Text>
          </View>
          <View style={styles.profileContainer}>
            <Image 
              source={shop.ownerPic ? { uri: shop.ownerPic } : require('./assets/a1.png')} 
              style={styles.profilePic} 
            />
            <Text style={styles.profileName}>{shop.owner}</Text>
            <Image source={starImage} style={styles.profileIcon} />
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.visitButton}
        onPress={() => navigation.navigate('MarketPlace', { shopId: shop.id })}
      >
        <Text style={styles.visitText}>Visit</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Community row
  const renderCommunityRow = (item) => (
    <TouchableOpacity 
      key={item.id} 
      style={styles.communityRow}
      onPress={() => navigation.navigate('GroupInfo', { communityId: item.id, groupTitle: item.title })}
    >
      <Image 
        source={item.image ? { uri: item.image } : require('./assets/posticon.jpg')} 
        style={styles.communityImage} 
      />
      <View style={{ marginLeft: 15, justifyContent: 'center', flex: 1 }}>
        <Text style={styles.communityTitle}>{item.title}</Text>
        <Text style={styles.communitySubtitle}>{item.subtitle}</Text>

        <View style={styles.communityLogosContainer}>
          <Text style={styles.membersText}>{item.members} Members</Text>
        </View>

        {item.category && (
        <View style={styles.tagContainer}>
          <TouchableOpacity style={[styles.tagButton, { borderColor: '#00F0FFBF' }]}>
              <Text style={styles.tagText}>#{item.category}</Text>
          </TouchableOpacity>
        </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Post row
  const renderPost = (post) => (
    <View key={`${post.communityId}-${post.type}-${post.id}`} style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image 
            source={post.authorImage ? { uri: post.authorImage } : require('./assets/a1.png')} 
            style={styles.postProfileImage} 
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.postName}>{post.name}</Text>
            <Text style={styles.postUsername}>{post.username || ''}</Text>
          </View>
        </View>
      </View>

      {post.text && <Text style={styles.postText}>{post.text}</Text>}

      {post.images && post.images.length > 0 && (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        {post.images.map((img, index) => (
            <Image 
              key={index} 
              source={{ uri: img }} 
              style={[styles.postImage, { width: (width - 60) / post.images.length }]} 
            />
        ))}
      </View>
      )}

      <View style={styles.postFooter}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="heart-outline" size={24} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 5 }}>{post.likes || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}>
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}>
          <Ionicons name="share-social-outline" size={24} color="#fff" />
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

        {/* Loading Indicator */}
        {loading && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#08FFE2" />
            <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
          </View>
        )}

        {/* ALL TAB CONTENT */}
        {!loading && activeTab === 'All' && (
          <>
            <Text style={styles.heading}>Users {filteredUsers.length > 0 && `(${filteredUsers.length})`} {'>'}</Text>
            {filteredUsers.length > 0 ? (
              <View style={styles.userCard}>{filteredUsers.map(renderUserRow)}</View>
            ) : (
              <View style={styles.userCard}>
                <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>No users found</Text>
              </View>
            )}

            <Text style={styles.heading}>Shops {filteredShops.length > 0 && `(${filteredShops.length})`} {'>'}</Text>
            {filteredShops.length > 0 ? (
              <View style={styles.userCard}>{filteredShops.map(renderShopRow)}</View>
            ) : (
              <View style={styles.userCard}>
                <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>No shops found</Text>
              </View>
            )}

            <Text style={styles.heading}>Community {filteredCommunities.length > 0 && `(${filteredCommunities.length})`} {'>'}</Text>
            {filteredCommunities.length > 0 ? (
              <View style={styles.userCard}>{filteredCommunities.map(renderCommunityRow)}</View>
            ) : (
              <View style={styles.userCard}>
                <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>No communities found</Text>
              </View>
            )}

            <Text style={styles.heading}>Post Live {filteredPosts.length > 0 && `(${filteredPosts.length})`} {'>'}</Text>
            {filteredPosts.length > 0 ? (
              <View>{filteredPosts.map(renderPost)}</View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#888' }}>No posts found</Text>
              </View>
            )}
          </>
        )}

        {!loading && activeTab === 'Users' && (
          filteredUsers.length > 0 ? (
            <View style={styles.userCard}>{filteredUsers.map(renderUserRow)}</View>
          ) : (
            <View style={styles.userCard}>
              <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>No users found</Text>
            </View>
          )
        )}
        {!loading && activeTab === 'Shops' && (
          filteredShops.length > 0 ? (
            <View style={styles.userCard}>{filteredShops.map(renderShopRow)}</View>
          ) : (
            <View style={styles.userCard}>
              <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>No shops found</Text>
            </View>
          )
        )}
        {!loading && activeTab === 'Community' && (
          filteredCommunities.length > 0 ? (
            <View style={styles.userCard}>{filteredCommunities.map(renderCommunityRow)}</View>
          ) : (
            <View style={styles.userCard}>
              <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>No communities found</Text>
            </View>
          )
        )}
        {!loading && activeTab === 'Post Live' && (
          filteredPosts.length > 0 ? (
            <View>{filteredPosts.map(renderPost)}</View>
          ) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>No posts found</Text>
            </View>
          )
        )}
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
