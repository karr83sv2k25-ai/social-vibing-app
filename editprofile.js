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
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { app } from "./firebaseConfig";
import * as ImagePicker from 'expo-image-picker';
import { cloudinaryConfig } from './cloudinaryConfig';

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

export default function EditProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editBio, setEditBio] = useState(false);
  const [bio, setBio] = useState('');
  const [name, setName] = useState({ firstName: '', lastName: '' });
  const [username, setUsername] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        
        if (user) {
          const db = getFirestore(app);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setBio(data.bio || '');
            setName({
              firstName: data.firstName || '',
              lastName: data.lastName || ''
            });
            setUsername(data.username || '');
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      const auth = getAuth(app);
      const user = auth.currentUser;
      
      if (user) {
        const db = getFirestore(app);
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, updates);
        
        // Update local state
        setUserData(prev => ({ ...prev, ...updates }));
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  // Handle image upload
  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setLoading(true);
        const auth = getAuth(app);
        const user = auth.currentUser;

        if (user) {
          // Create form data for upload
          const formData = new FormData();
          formData.append('file', {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            name: 'profile_image.jpg',
          });
          formData.append('upload_preset', cloudinaryConfig.uploadPreset);
          formData.append('cloud_name', cloudinaryConfig.cloudName);

          // Upload to Cloudinary
          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
            {
              method: 'POST',
              body: formData,
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
              },
            }
          );

          const data = await response.json();

          if (data.secure_url) {
            // Update profile with secure URL
            await updateProfile({ profileImage: data.secure_url });
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

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.text }}>Loading...</Text>
      </View>
    );
  }

  // Helper to resolve a count from userData supporting arrays or numeric fields
  const resolveCount = (obj, possibleKeys = []) => {
    if (!obj) return 0;
    for (const k of possibleKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const v = obj[k];
        if (Array.isArray(v)) return v.length;
        if (typeof v === 'number') return v;
        // sometimes nested objects like { count: 5 }
        if (v && typeof v === 'object' && typeof v.count === 'number') return v.count;
      }
    }
    return 0;
  };

  const followersCount = resolveCount(userData, ['followers', 'followers_list', 'followersCount', 'followers_count']);
  const followingCount = resolveCount(userData, ['following', 'following_list', 'followingCount', 'following_count']);
  const friendsCount = resolveCount(userData, ['friends', 'friends_list', 'friendsCount', 'friends_count']);
  const visitsCount = resolveCount(userData, ['visits', 'visit_count', 'visits_count', 'visitsCount', 'profileViews']);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* ===== Header / Cover ===== */}
      <View style={styles.coverWrap}>
        <Image source={require("./assets/post2.png")} style={styles.cover} />

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
        <TouchableOpacity style={styles.viewStoreBtn}>
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
            <Feather name="edit-2" size={14} color={C.cyan} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <Text style={styles.handle}>@{userData?.username || 'username'}</Text>
          <Text style={styles.joined}>
            Joined {new Date(userData?.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.active}>
            {userData?.lastActive ? 'Last seen ' + new Date(userData.lastActive).toLocaleDateString() : 'Active Now'}
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
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: C.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: C.brand }]}
                  onPress={() => {
                    updateProfile({
                      firstName: name.firstName,
                      lastName: name.lastName,
                      username: username
                    });
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.statsRow}>
          <Stat value={String(followersCount).padStart(2, '0')} label="Followers" />
          <Stat value={String(followingCount).padStart(2, '0')} label="Following" />
          <Stat value={String(friendsCount).padStart(2, '0')} label="Friends" />
          <Stat value={String(visitsCount).padStart(1, '0')} label="Visits" />
        </View>
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

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {(userData?.tags || ['Add some tags']).map((t) => (
            <Pill key={t} label={t} />
          ))}
        </View>
      </View>

      {/* ===== Community Joined (WITH edit on right) ===== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="account-group" size={18} color={C.cyan} />
            <Text style={styles.sectionTitle}>Community Joined</Text>
          </View>
          <TouchableOpacity style={styles.editIcon} onPress={() => { /* handle edit communities */ }}>
            <Feather name="edit-2" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.communityCard}>
              <Image source={require("./assets/join2.jpg")} style={styles.communityImg} />
              <View style={{ padding: 8 }}>
                <Text style={styles.commTitle}>Anime Group</Text>
                <Text style={styles.commMeta}>2 Members</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ===== Stories (WITH edit on right) ===== */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stories</Text>
          <TouchableOpacity style={styles.editIcon} onPress={() => { /* handle edit stories */ }}>
            <Feather name="edit-2" size={14} color={C.text} />
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
          >
            <Feather name="plus" size={22} color={C.dim} />
            <Text style={{ color: C.dim, marginTop: 6, fontSize: 12 }}>Add Story</Text>
          </TouchableOpacity>

          {/* Story items */}
          {[require("./assets/join1.png"), require("./assets/join2.jpg")].map((src, idx) => (
            <View key={idx} style={styles.story}>
              <Image source={src} style={styles.storyImg} />
              <Text style={styles.storyCaption}>{idx === 0 ? "Yesterday" : "Sep 08"}</Text>
            </View>
          ))}
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
