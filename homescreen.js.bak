import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from './firebaseConfig';

const { width } = Dimensions.get('window');
const IMAGE_WIDTH = 267;
const SPACING = 10;

const images = [
  require('./assets/homebackground.jpg'),
  require('./assets/homebackground.jpg'),
  require('./assets/homebackground.jpg'),
];

const boxes = [
  {
    title: 'Text it',
    image: require('./assets/textit.png'),
    style: { borderColor: '#BF2EF0', borderWidth: 1 },
  },
  {
    title: 'Voice it',
    image: require('./assets/voiceit.png'),
    style: { borderColor: '#05FF00', borderWidth: 0.89 },
  },
  {
    title: 'Stream it',
    image: require('./assets/streamit.png'),
    style: {
      borderColor: '#FFD913',
      borderWidth: 0.89,
      shadowColor: '#FFDB203D',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 0.89,
      elevation: 3,
    },
  },
];

const buttons = ['ForYou', 'Following', 'Community', "Community's"];

const posts = [
  {
    id: 1,
    name: 'Hitachi BlackSoul',
    username: '@hitachi',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque euismod.',
    likes: 123,
    images: [
      require('./assets/post1.1.jpg'),
      require('./assets/post1.2.jpg'),
      require('./assets/post1.3.jpg'),
    ],
  },
  {
    id: 2,
    name: 'Hitachi BlackSoul',
    username: '@hitachi',
    text: 'Just tried this amazing app feature, and it’s really cool! #ReactNative #UI',
    likes: 98,
    images: [require('./assets/post2.png')],
  },
];

const Post = ({ post }) => (
  <View style={styles.postContainer}>
    <View style={styles.postHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={require('./assets/posticon.jpg')}
          style={styles.postProfileImage}
        />
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
        <Image
          key={index}
          source={img}
          style={[styles.postImage, { width: (width - 60) / post.images.length }]}
        />
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

export default function HomeScreen({ navigation }) {
  const [activeButton, setActiveButton] = useState(null);
  const [userName, setUserName] = useState('');
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchUserName = async () => {
      try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) return;

        const db = getFirestore(app);
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && mounted) {
          const data = userSnap.data();
          const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
          setUserName(fullName || data.username || data.email || '');
          // Fetch profile image field (try common field names)
          const img = data.profileImage || data.profile_image || data.profile_picture || data.photoURL || null;
          if (mounted) setProfileImage(img);
        }
      } catch (err) {
        console.error('Error fetching user for HomeScreen:', err);
      }
    };

    fetchUserName();

    return () => { mounted = false; };
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.profileContainer}>
          {/* UPDATED: Wrap profile area with TouchableOpacity to open Profile */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            
              <Image
                source={profileImage ? { uri: profileImage } : require('./assets/profile.png')}
                style={styles.profileImage}
              />
            <View style={styles.profileTextContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.profileName}>{userName || 'User'}</Text>
                <Image
                  source={require('./assets/starimage.png')}
                  style={{ width: 18, height: 18, marginLeft: 5 }}
                />
              </View>
              <Text style={styles.profileStatus}>● Online</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.iconsContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('SearchBar')}
          >
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notification')}
          >
            <Ionicons name="notifications" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Carousel */}
      <FlatList
        data={images}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={IMAGE_WIDTH + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: (width - IMAGE_WIDTH) / 2 }}
        renderItem={({ item }) => (
          <View style={{ marginRight: SPACING }}>
            <Image source={item} style={styles.image} />
          </View>
        )}
      />

      {/* Boxes Section */}
      <View style={styles.boxesContainer}>
        {boxes.map((box, index) => (
          <View key={index} style={[styles.box, box.style]}>
            <Text style={styles.boxText}>{box.title}</Text>
            <Image source={box.image} style={styles.boxImage} />
          </View>
        ))}
      </View>

      {/* Toggle Buttons */}
      <View style={styles.buttonsContainer}>
        {buttons.map((btn, index) => {
          const isActive = activeButton === index;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.textButton, isActive && styles.activeButtonBorder]}
              onPress={() => setActiveButton(index)}
            >
              <Text style={styles.buttonText}>{btn}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Posts */}
      {posts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  profileContainer: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#08FFE2' },
  profileTextContainer: { marginLeft: 15 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileStatus: { color: '#08FFE2', fontSize: 14, marginTop: 3 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 15 },

  image: { width: IMAGE_WIDTH, height: 111, borderRadius: 17, borderWidth: 1.5, borderColor: '#08FFE2', shadowColor: '#08FFE280', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10.4, elevation: 5 },

  boxesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 20 },
  box: { width: 89, height: 89, borderRadius: 10.71, justifyContent: 'center', alignItems: 'center', padding: 5 },
  boxText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 5 },
  boxImage: { width: 40, height: 40, resizeMode: 'contain' },

  buttonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  textButton: { paddingVertical: 5, paddingHorizontal: 10 },
  activeButtonBorder: { borderBottomWidth: 2, borderColor: '#08FFE2' },
  buttonText: { color: '#fff', fontSize: 16 },

  postContainer: { marginBottom: 20, paddingHorizontal: 20 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  postProfileImage: { width: 50, height: 50, borderRadius: 25 },
  postName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  postUsername: { color: '#aaa', fontSize: 14 },
  followButton: { backgroundColor: '#08FFE2', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5 },
  followText: { color: '#000', fontWeight: '700' },
  postText: { color: '#fff', fontSize: 14, marginBottom: 10 },
  postImage: { height: 100, borderRadius: 10, resizeMode: 'cover' },
  postFooter: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
});


