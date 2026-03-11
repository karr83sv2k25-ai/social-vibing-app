// EditProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { app, db } from "./firebaseConfig";
import CacheManager from "./cacheManager";
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToHostinger } from './hostingerConfig';
import { compressProfileImage } from './utils/imageCompression';
import { sanitizeUsername, USERNAME_REGEX, changeUsername, getDisplayName, getUserHandle, getUserAvatar } from './utils/userNameHelpers';
import VerifiedBadge from './components/VerifiedBadge';

const { width } = Dimensions.get("window");
const PADDING_H = 18;

/* THEME */
const C = {
  bg: "#0B0B10",
  card2: "#1A1F27",
  border: "#242A33",
  text: "#EAEAF0",
  dim: "#A2A8B3",
  cyan: "#08FFE2",
  brand: "#BF2EF0",
  green: "#36E3C0",
};

/* REUSABLES */
const Pill = ({ label }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>#{label}</Text>
  </View>
);

const Stat = ({ value, label }) => (
  <View style={{ alignItems: "center", width: 70 }}>
    <Text style={{ color: C.text, fontWeight: "800", fontSize: 16 }}>{value}</Text>
    <Text style={{ color: C.dim, fontSize: 12 }}>{label}</Text>
  </View>
);

export default function EditProfileScreen({ navigation, route }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editBio, setEditBio] = useState(false);
  const [bio, setBio] = useState('');
  const [name, setName] = useState({ firstName: '', lastName: '' });
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [visitsCount, setVisitsCount] = useState(0);
  const [stories, setStories] = useState([]);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        console.log('📝 Edit Profile: Starting to fetch user data...');
        const auth = getAuth(app);
        const user = auth.currentUser;

        console.log('📝 Edit Profile: Current user:', user ? user.uid : 'null');

        if (!user) {
          console.error('❌ Edit Profile: No authenticated user found!');
          Alert.alert('Error', 'You must be logged in to edit your profile');
          setLoading(false);
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
          return;
        }

        // Try to get data from navigation params first
        const passedData = route?.params?.userData;
        if (passedData) {
          console.log('✅ Edit Profile: Using data passed from navigation');
          setUserData(passedData);
          setBio(passedData.bio || passedData.user_biography || '');
          setName({
            firstName: passedData.firstName || passedData.user_firstname || '',
            lastName: passedData.lastName || passedData.user_lastname || ''
          });
          setUsername(passedData.username || '');
          setGender(passedData.gender || '');
          setCoverImage(passedData.coverImage || passedData.cover_image || null);
          setTags(passedData.tags || []);
          setLoading(false);
          fetchJoinedCommunities(user.uid);
          fetchUserCounts(user.uid);
          fetchUserStories(user.uid);
          return;
        }

        // Try cache next
        console.log('📝 Edit Profile: Checking cache...');
        const cacheKey = `cache_user_profile_${user.uid}`;
        const cachedData = await CacheManager.get(cacheKey);

        if (cachedData) {
          console.log('✅ Edit Profile: Using cached user data');
          setUserData(cachedData);
          setBio(cachedData.bio || cachedData.user_biography || '');
          setName({
            firstName: cachedData.firstName || cachedData.user_firstname || '',
            lastName: cachedData.lastName || cachedData.user_lastname || ''
          });
          setUsername(cachedData.username || '');
          setGender(cachedData.gender || '');
          setCoverImage(cachedData.coverImage || cachedData.cover_image || null);
          setTags(cachedData.tags || []);
          setLoading(false);
          fetchJoinedCommunities(user.uid);
          fetchUserCounts(user.uid);
          fetchUserStories(user.uid);
          return;
        }

        // Last resort: try Firestore with timeout
        console.log('📝 Edit Profile: Fetching from Firestore for UID:', user.uid);
        const userDocPromise = getDoc(doc(db, 'users', user.uid));
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore request timeout')), 8000)
        );

        const userDoc = await Promise.race([userDocPromise, timeoutPromise]);

        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log('✅ Edit Profile: User data loaded from Firestore');
          setUserData(data);
          setBio(data.bio || data.user_biography || '');
          setName({
            firstName: data.firstName || data.user_firstname || '',
            lastName: data.lastName || data.user_lastname || ''
          });
          setUsername(data.username || '');
          setGender(data.gender || '');
          setCoverImage(data.coverImage || data.cover_image || null);
          setTags(data.tags || []);
          fetchJoinedCommunities(user.uid);
          fetchUserCounts(user.uid);
          fetchUserStories(user.uid);
        } else {
          console.error('❌ Edit Profile: User document does not exist');
          Alert.alert('Error', 'User profile not found');
        }
      } catch (error) {
        console.error('❌ Edit Profile: Error:', error.message);
        Alert.alert('Error', 'Failed to load profile. Please try again.');
      } finally {
        console.log('✅ Edit Profile: Setting loading to false');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation, route]);

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      console.log('📝 Updating profile with:', updates);
      const auth = getAuth(app);
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Error', 'No user logged in');
        return;
      }

      // Update local state immediately for instant UI feedback
      const updatedData = { ...userData, ...updates };
      setUserData(updatedData);
      // Keep name/username state in sync so the modal always reflects saved values
      if (updates.firstName !== undefined || updates.lastName !== undefined) {
        setName({
          firstName: updates.firstName ?? updatedData.firstName ?? '',
          lastName: updates.lastName ?? updatedData.lastName ?? '',
        });
      }
      if (updates.username !== undefined) {
        setUsername(updates.username);
      }
      console.log('✅ Local state updated');

      // Save to AsyncStorage as backup (always succeeds)
      try {
        console.log('💾 Saving to AsyncStorage with key:', `profile_update_${user.uid}`);
        console.log('💾 Data being saved:', JSON.stringify(updatedData).substring(0, 200));

        await AsyncStorage.setItem(
          `profile_update_${user.uid}`,
          JSON.stringify(updatedData)
        );
        console.log('✅ Profile saved to AsyncStorage as backup');

        // Also save to cache for instant display
        console.log('📦 Saving to cache with userId:', user.uid);
        const cacheResult = await CacheManager.saveUserProfile(user.uid, updatedData);
        console.log('📦 Cache save result:', cacheResult);

        // Verify cache was saved
        const verifyCached = await CacheManager.getUserProfile(user.uid);
        console.log('✅ Cache verification:', verifyCached ? 'Found' : 'NOT FOUND');
      } catch (storageError) {
        console.error('❌ Storage save failed:', storageError);
      }

      // Try to update Firestore with longer timeout
      try {
        const userRef = doc(db, 'users', user.uid);
        const updatePromise = updateDoc(userRef, updates);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore update timeout')), 15000)
        );

        await Promise.race([updatePromise, timeoutPromise]);
        console.log('✅ Firestore updated successfully');

        // Clear AsyncStorage backup after successful Firestore update
        await AsyncStorage.removeItem(`profile_update_${user.uid}`);
      } catch (firestoreError) {
        console.warn('⚠️ Firestore update failed:', firestoreError.message);
        console.log('💾 Using AsyncStorage backup - profile will still update');
        // Don't show error - we have AsyncStorage backup
      }

      // Save updated data to cache immediately for instant display
      try {
        await CacheManager.saveUserProfile(user.uid, updatedData);
        console.log('✅ Profile cache updated with new data');
      } catch (cacheError) {
        console.warn('⚠️ Cache save failed:', cacheError);
      }

      // Show success message and stay on edit profile screen
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  // Handle image upload
  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0,
      });

      if (!result.canceled) {
        setLoading(true);
        const auth = getAuth(app);
        const user = auth.currentUser;

        if (user) {
          // Compress image before upload
          const compressedUri = await compressProfileImage(result.assets[0].uri);

          // Upload to Hostinger
          const imageUrl = await uploadImageToHostinger(
            compressedUri,
            'user_profiles'
          );

          if (imageUrl) {
            // Update profile with uploaded URL
            await updateProfile({ profileImage: imageUrl });
          } else {
            throw new Error('Upload failed');
          }
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  // Handle cover image upload
  const handleCoverImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setUploading(true);
        const auth = getAuth(app);
        const user = auth.currentUser;

        if (user) {
          // Upload to Hostinger
          const imageUrl = await uploadImageToHostinger(
            result.assets[0].uri,
            'cover_images'
          );

          if (imageUrl) {
            setCoverImage(imageUrl);
            await updateProfile({ coverImage: imageUrl });
          }
        }
        setUploading(false);
      }
    } catch (error) {
      console.error('Error uploading cover image:', error);
      Alert.alert('Error', 'Failed to upload cover image');
      setUploading(false);
    }
  };

  // Fetch joined communities from Firebase
  const fetchJoinedCommunities = async (userId) => {
    try {
      // Get memberships
      const membershipsQuery = query(
        collection(db, 'communities_members'),
        where('user_id', '==', userId)
      );
      
      const membershipsSnapshot = await getDocs(membershipsQuery);
      const communityIds = membershipsSnapshot.docs.map(doc => doc.data().community_id);
      
      if (communityIds.length === 0) {
        setJoinedCommunities([]);
        console.log('📭 No joined communities found');
        return;
      }

      // Get community details with all image field variations
      const communitiesData = [];
      for (const communityId of communityIds) {
        const communityDoc = await getDoc(doc(db, 'communities', communityId));
        if (communityDoc.exists()) {
          const data = communityDoc.data();
          communitiesData.push({
            id: communityId,
            name: data.name || data.community_title || data.title || 'Community',
            description: data.description || data.community_description || '',
            category: data.category || data.community_category || '',
            img: data.profileImage || data.img || data.image || data.community_image || data.cover_image || data.coverImage || null,
            members_count: data.members_count || data.memberCount || (Array.isArray(data.members) ? data.members.length : 0),
            ...data
          });
        }
      }
      
      setJoinedCommunities(communitiesData);
      console.log('✅ Loaded', communitiesData.length, 'joined communities with images');
    } catch (error) {
      console.warn('⚠️ Failed to fetch communities:', error.message);
      setJoinedCommunities([]);
    }
  };

  // Fetch followers, following, friends counts from Firebase
  const fetchUserCounts = async (userId) => {
    try {
      // Fetch counts directly from user document
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        
        // Set followers count
        setFollowersCount(
          data.followersCount || 
          data.followers_count || 
          (Array.isArray(data.followers) ? data.followers.length : 0) ||
          0
        );

        // Set following count
        setFollowingCount(
          data.followingCount || 
          data.following_count || 
          (Array.isArray(data.following) ? data.following.length : 0) ||
          0
        );

        // Set friends count
        setFriendsCount(
          data.friendsCount || 
          data.friends_count || 
          (Array.isArray(data.friends) ? data.friends.length : 0) ||
          0
        );

        // Set visits count
        setVisitsCount(
          data.profileViews || 
          data.visits || 
          data.visit_count || 
          data.visits_count || 
          data.visitsCount || 
          0
        );

        console.log('✅ User counts loaded from Firebase:', {
          followers: data.followersCount || 0,
          following: data.followingCount || 0,
          friends: data.friendsCount || 0,
          visits: data.profileViews || 0
        });
      } else {
        console.warn('⚠️ User document not found');
        // Keep default 0 values
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch user counts:', error.message);
      // Keep default 0 values
    }
  };

  // Fetch user stories from Firebase
  const fetchUserStories = async (userId) => {
    try {
      const storiesQuery = query(
        collection(db, 'stories'),
        where('userId', '==', userId),
        where('expiresAt', '>', new Date())
      );
      
      const storiesSnapshot = await getDocs(storiesQuery);
      const storiesData = storiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Format date for display
        displayDate: doc.data().createdAt ? 
          new Date(doc.data().createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
          'Recently'
      }));
      
      setStories(storiesData);
      console.log('✅ Loaded', storiesData.length, 'user stories');
    } catch (error) {
      console.warn('⚠️ Failed to fetch stories:', error.message);
      setStories([]);
    }
  };

  // Add new tag
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      updateProfile({ tags: updatedTags });
      setNewTag('');
      setShowTagModal(false);
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    updateProfile({ tags: updatedTags });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.text, fontSize: 16 }}>Loading Profile...</Text>
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>Please wait</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.text, fontSize: 16 }}>No Profile Data</Text>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
          style={{ marginTop: 20, padding: 12, backgroundColor: C.brand, borderRadius: 8 }}
        >
          <Text style={{ color: C.text }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* ===== Header / Cover ===== */}
      <View style={styles.coverWrap}>
        <Image 
          source={coverImage ? { uri: coverImage } : require("./assets/post2.png")} 
          style={styles.cover} 
        />

        {/* Cover Edit Button */}
        <TouchableOpacity
          style={styles.coverEditBtn}
          onPress={handleCoverImagePick}
          disabled={uploading}
        >
          <Feather name="camera" size={16} color={C.text} />
        </TouchableOpacity>

        {/* Left: back */}
        <TouchableOpacity
          style={[styles.headBtn, { left: 10 }]}
          onPress={() => navigation?.goBack?.()}
        >
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>

        {/* Right: edit + 3 dots */}
        <View style={{ position: "absolute", right: 10, top: 12, flexDirection: "row", gap: 8 }}>
          <View style={styles.headBtn}>
            <Feather name="edit-2" size={16} color={C.text} />
          </View>
          <View style={styles.headBtn}>
            <Feather name="more-horizontal" size={18} color={C.text} />
          </View>
        </View>

        {/* View Store */}
        <TouchableOpacity 
          style={styles.viewStoreBtn}
          onPress={() => navigation.navigate('MyStore')}
        >
          <Text style={styles.viewStoreText}>View Store ›</Text>
        </TouchableOpacity>
      </View>

      {/* ===== Profile Info ===== */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={handleImagePick}>
            <Image
              source={
                userData?.profileImage
                  ? { uri: userData.profileImage }
                  : require("./assets/profile.png")
              }
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.avatarRing} />
          <TouchableOpacity
            style={styles.editAvatarBtn}
            onPress={handleImagePick}
          >
            <Feather name="camera" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 34 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center" }}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.name}>{userData?.firstName} {userData?.lastName}</Text>
            <VerifiedBadge isVerified={userData?.isVerified} size={18} style={{ marginLeft: 6 }} />
            <Feather name="edit-2" size={14} color={C.cyan} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          
          {/* Verification Status Banner */}
          {userData?.verificationStatus === 'pending' && (
            <View style={styles.verificationBanner}>
              <Ionicons name="time-outline" size={14} color="#FFD700" />
              <Text style={styles.verificationText}>Verification Pending</Text>
            </View>
          )}
          {userData?.verificationStatus === 'rejected' && (
            <View style={[styles.verificationBanner, { backgroundColor: 'rgba(255, 50, 50, 0.15)' }]}>
              <Ionicons name="close-circle-outline" size={14} color="#FF3232" />
              <Text style={[styles.verificationText, { color: '#FF3232' }]}>Verification Rejected</Text>
            </View>
          )}
          {userData?.verificationStatus === 'revoked' && (
            <View style={[styles.verificationBanner, { backgroundColor: 'rgba(255, 165, 0, 0.15)' }]}>
              <Ionicons name="warning-outline" size={14} color="#FFA500" />
              <Text style={[styles.verificationText, { color: '#FFA500' }]}>Verification Revoked</Text>
            </View>
          )}
          {userData?.isVerified && (
            <View style={[styles.verificationBanner, { backgroundColor: 'rgba(8, 255, 226, 0.15)' }]}>
              <Ionicons name="shield-checkmark" size={14} color="#08FFE2" />
              <Text style={[styles.verificationText, { color: '#08FFE2' }]}>Verified 17+</Text>
            </View>
          )}
          {(!userData?.verificationStatus || userData?.verificationStatus === 'rejected' || userData?.verificationStatus === 'revoked') && !userData?.isVerified && (
            <TouchableOpacity 
              style={styles.verifyButton}
              onPress={() => navigation.navigate('AgeVerification')}
            >
              <Ionicons name="shield-outline" size={14} color="#fff" />
              <Text style={styles.verifyButtonText}>{userData?.verificationStatus === 'rejected' || userData?.verificationStatus === 'revoked' ? 'Re-verify Account' : 'Verify Account'}</Text>
            </TouchableOpacity>
          )}
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.handle}>@{userData?.username || 'username'}</Text>
            <VerifiedBadge isVerified={userData?.isVerified} size={14} />
          </View>
          <Text style={styles.joined}>
            Joined {new Date(userData?.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Name Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isModalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalView}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Profile</Text>

              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={C.dim}
                value={name.firstName}
                onChangeText={(text) => setName(prev => ({ ...prev, firstName: text }))}
              />

              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={C.dim}
                value={name.lastName}
                onChangeText={(text) => setName(prev => ({ ...prev, lastName: text }))}
              />

              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={C.dim}
                value={username}
                onChangeText={setUsername}
              />

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: C.text, fontSize: 14, marginBottom: 12, fontWeight: '600' }}>Gender</Text>
                <View style={{ flexDirection: 'row', gap: 15, justifyContent: 'center' }}>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      gender === 'Male' && styles.genderButtonActive
                    ]}
                    onPress={() => setGender('Male')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      gender === 'Male' && styles.genderButtonTextActive
                    ]}>M</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      gender === 'Female' && styles.genderButtonActive
                    ]}
                    onPress={() => setGender('Female')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      gender === 'Female' && styles.genderButtonTextActive
                    ]}>F</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      gender === 'Other' && styles.genderButtonActive
                    ]}
                    onPress={() => setGender('Other')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      gender === 'Other' && styles.genderButtonTextActive
                    ]}>O</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: C.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: C.brand }]}
                  onPress={async () => {
                    // Validate username before saving
                    const sanitized = sanitizeUsername(username);
                    if (sanitized && !USERNAME_REGEX.test(sanitized)) {
                      Alert.alert('Invalid Username', 'Username must be 3-20 characters (lowercase letters, numbers, ., -, _)');
                      return;
                    }

                    const oldUsername = userData?.username || '';
                    const usernameChanged = sanitized !== sanitizeUsername(oldUsername);

                    if (usernameChanged && sanitized) {
                      // Atomically reserve new username and release old one
                      const auth = getAuth(app);
                      const user = auth.currentUser;
                      if (!user) { Alert.alert('Error', 'Not logged in'); return; }
                      const result = await changeUsername(user.uid, sanitized, oldUsername);
                      if (!result.success) {
                        Alert.alert('Username Error', result.error);
                        return;
                      }
                      // Username already updated in Firestore by changeUsername,
                      // so only pass the other fields to updateProfile
                      updateProfile({
                        firstName: name.firstName,
                        lastName: name.lastName,
                        gender: gender,
                      });
                      // Sync local username state
                      setUsername(sanitized);
                      setUserData(prev => ({ ...prev, username: sanitized }));
                    } else {
                      updateProfile({
                        firstName: name.firstName,
                        lastName: name.lastName,
                        username: sanitized || oldUsername,
                        gender: gender,
                      });
                    }
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {userData?.isVerified && (
          <View style={styles.statsRow}>
            <Stat value={String(followersCount).padStart(2, '0')} label="Followers" />
            <Stat value={String(followingCount).padStart(2, '0')} label="Following" />
            <Stat value={String(friendsCount).padStart(2, '0')} label="Friends" />
            <Stat value={String(visitsCount).padStart(1, '0')} label="Visits" />
          </View>
        )}
      </View>

      {/* ===== All About Me ===== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All About Me</Text>
        </View>

        {/* Bio row WITH edit on right */}
        <View style={styles.subHeaderRow}>
          <Text style={styles.subHeader}>Bio</Text>
          <TouchableOpacity
            style={styles.smallEdit}
            onPress={() => {
              setEditBio(true);
              setBio(userData?.bio || '');
            }}
          >
            <Feather name="edit-2" size={12} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.bioContainer}>
          {editBio ? (
            <View style={styles.bioEditContainer}>
              <TextInput
                style={styles.bioInput}
                multiline
                placeholder="Write something about yourself..."
                placeholderTextColor={C.dim}
                value={bio}
                onChangeText={setBio}
              />
              <View style={styles.bioButtons}>
                <TouchableOpacity
                  style={[styles.bioButton, { backgroundColor: C.border }]}
                  onPress={() => {
                    setBio(userData?.bio || '');
                    setEditBio(false);
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bioButton, { backgroundColor: C.brand }]}
                  onPress={async () => {
                    await updateProfile({ bio });
                    setEditBio(false);
                  }}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bioTextContainer}
              onPress={() => {
                setEditBio(true);
                setBio(userData?.bio || '');
              }}
            >
              <Text style={styles.bioText}>
                {userData?.bio || 'Tap to add bio...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Gender Display */}
        <View style={styles.subHeaderRow}>
          <Text style={styles.subHeader}>Gender</Text>
          <TouchableOpacity
            style={styles.smallEdit}
            onPress={() => setModalVisible(true)}
          >
            <Feather name="edit-2" size={12} color={C.text} />
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 8, paddingHorizontal: 8 }}>
          <Text style={styles.bioText}>
            {userData?.gender || gender || 'Not specified'}
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, alignItems: 'center' }}>
          {tags.length > 0 ? (
            tags.map((t, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.pill}
                onPress={() => handleRemoveTag(t)}
              >
                <Text style={styles.pillText}>#{t}</Text>
                <Ionicons name="close-circle" size={14} color={C.dim} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: C.dim, fontSize: 12 }}>No tags added</Text>
          )}
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: C.brand }]}
            onPress={() => setShowTagModal(true)}
          >
            <Ionicons name="add" size={14} color={C.text} />
            <Text style={[styles.pillText, { marginLeft: 4 }]}>Add Tag</Text>
          </TouchableOpacity>
        </View>

        {/* Tag Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showTagModal}
          onRequestClose={() => setShowTagModal(false)}
        >
          <View style={styles.modalView}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Tag</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter tag name"
                placeholderTextColor={C.dim}
                value={newTag}
                onChangeText={setNewTag}
                maxLength={20}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: C.border }]}
                  onPress={() => {
                    setNewTag('');
                    setShowTagModal(false);
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: C.brand }]}
                  onPress={handleAddTag}
                >
                  <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {/* ===== Community Joined (WITH edit on right) ===== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="account-group" size={18} color={C.cyan} />
            <Text style={styles.sectionTitle}>Community Joined ({joinedCommunities.length})</Text>
          </View>
          <TouchableOpacity 
            style={styles.editIcon} 
            onPress={() => navigation.navigate('Explore')}
          >
            <Feather name="plus" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        {joinedCommunities.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {joinedCommunities.map((community) => (
              <TouchableOpacity 
                key={community.id}
                style={styles.communityCard}
                onPress={() => navigation.navigate('CommunityDetail', { 
                  communityId: community.id,
                  communityData: community 
                })}
              >
                <Image 
                  source={community.img || community.image ? { uri: community.img || community.image } : require("./assets/join2.jpg")} 
                  style={styles.communityImg} 
                />
                <View style={{ padding: 8 }}>
                  <Text style={styles.commTitle} numberOfLines={1}>
                    {community.name || community.title || 'Community'}
                  </Text>
                  <Text style={styles.commMeta}>
                    {community.members_count || community.memberCount || 0} Members
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity 
            style={[styles.communityCard, { justifyContent: 'center', alignItems: 'center' }]}
            onPress={() => navigation.navigate('Explore')}
          >
            <Feather name="plus-circle" size={32} color={C.dim} />
            <Text style={{ color: C.dim, marginTop: 8, fontSize: 12 }}>Join Communities</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== Stories (WITH edit on right) ===== */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stories ({stories.length})</Text>
          <TouchableOpacity 
            style={styles.editIcon} 
            onPress={() => navigation.navigate('CreateStory')}
          >
            <Feather name="plus" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
        >
          {/* Add Story */}
          <TouchableOpacity
            style={[
              styles.story,
              { justifyContent: "center", alignItems: "center", backgroundColor: C.card2 },
            ]}
            onPress={() => navigation.navigate('CreateStory')}
          >
            <Feather name="plus" size={22} color={C.dim} />
            <Text style={{ color: C.dim, marginTop: 6, fontSize: 12 }}>Add Story</Text>
          </TouchableOpacity>

          {/* User Stories from Firebase */}
          {stories.length > 0 ? (
            stories.map((story) => (
              <TouchableOpacity
                key={story.id}
                style={styles.story}
                onPress={() => navigation.navigate('StoryView', { storyId: story.id })}
              >
                <Image 
                  source={{ uri: story.mediaUrl || story.image || story.imageUrl }} 
                  style={styles.storyImg} 
                />
                <Text style={styles.storyCaption}>{story.displayDate}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.story, { justifyContent: 'center', alignItems: 'center', backgroundColor: C.card2 }]}>
              <Feather name="image" size={22} color={C.dim} />
              <Text style={{ color: C.dim, marginTop: 6, fontSize: 11 }}>No Stories</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

/* ================== STYLES ================== */
const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: -10,
    backgroundColor: C.card2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: C.card2,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: C.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: C.text,
    fontWeight: '600',
  },
  genderButton: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card2,
    borderWidth: 2,
    borderColor: C.border,
  },
  genderButtonActive: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  genderButtonText: {
    color: C.text,
    fontWeight: '600',
    fontSize: 16,
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bioContainer: {
    width: '100%',
    marginTop: 8,
  },
  bioTextContainer: {
    minHeight: 60,
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 8,
  },
  bioEditContainer: {
    width: '100%',
  },
  bioInput: {
    backgroundColor: C.card2,
    borderRadius: 8,
    padding: 12,
    color: C.text,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 13,
    lineHeight: 18,
  },
  bioButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  bioButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bioText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 18,
  },

  /* Cover */
  coverWrap: {
    width: "100%",
    height: 160,
  },
  cover: { width: "100%", height: "100%" },
  coverEditBtn: {
    position: "absolute",
    left: 12,
    bottom: 10,
    backgroundColor: "#111A",
    borderWidth: 1,
    borderColor: C.border,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  headBtn: {
    position: "absolute",
    top: 12,
    backgroundColor: "#111A",
    borderWidth: 1,
    borderColor: C.border,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  viewStoreBtn: {
    position: "absolute",
    right: 12,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#111A",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
  },
  viewStoreText: { color: C.text, fontWeight: "700", fontSize: 12 },

  /* Profile */
  profileCard: {
    marginHorizontal: PADDING_H,
    marginTop: -AVATAR_SIZE / 2,
    paddingTop: AVATAR_SIZE / 2 + 8,
    paddingBottom: 12,
  },
  avatarWrap: {
    position: "absolute",
    top: -AVATAR_SIZE / 2,
    width: "100%",
    alignItems: "center",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: C.cyan,
  },
  avatarRing: {
    position: "absolute",
    width: AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    borderRadius: (AVATAR_SIZE + 10) / 2,
    borderWidth: 1,
    borderColor: C.cyan,
    opacity: 0.25,
  },

  name: { color: C.text, fontSize: 18, fontWeight: "800" },
  handle: { color: C.dim, fontSize: 13, marginTop: 2 },
  joined: { color: C.dim, fontSize: 12, marginTop: 2 },
  active: { color: C.green, fontSize: 12, marginTop: 2, fontWeight: "700" },

  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginTop: 8,
    gap: 6,
  },
  verificationText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 12,
  },

  /* Sections (transparent) */
  section: {
    marginTop: 14,
    marginHorizontal: PADDING_H,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: { color: C.text, fontWeight: "800", fontSize: 15 },

  subHeaderRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subHeader: { color: C.cyan, fontWeight: "700", fontSize: 13 },
  bioText: { color: C.text, fontSize: 13, marginTop: 6, lineHeight: 18 },

  pill: {
    backgroundColor: C.card2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
  },
  pillText: { color: C.text, fontSize: 12, fontWeight: "600" },

  /* Community cards */
  communityCard: {
    width: width * 0.42,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 12,
    overflow: "hidden",
    marginTop: 10,
  },
  communityImg: { width: "100%", height: 90, borderRadius: 14 },
  commTitle: { color: C.text, fontWeight: "700", fontSize: 13 },
  commMeta: { color: C.dim, fontSize: 11, marginTop: 2 },

  /* Edit buttons reused */
  editIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallEdit: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Stories */
  story: {
    width: width * 0.34,
    height: width * 0.42,
    borderRadius: 16,
    backgroundColor: "transparent",
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  storyImg: { width: "100%", height: "100%" },
  storyCaption: {
    position: "absolute",
    bottom: 8,
    left: 10,
    color: C.text,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
});

