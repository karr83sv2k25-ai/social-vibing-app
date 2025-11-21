// screens/EditCommunityScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { launchImageLibraryAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { uploadImageAsync } from './cloudinaryConfig';
import { firebaseApp } from './firebaseConfig';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Ionicons } from "@expo/vector-icons";

export default function EditCommunityScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [communityName, setCommunityName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [category, setCategory] = useState("");
  const [privacy, setPrivacy] = useState("open");
  const [discover, setDiscover] = useState("public");
  const [showReminder, setShowReminder] = useState(false);
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null); // Existing profile image URL
  const [uploading, setUploading] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCoverImageModal, setShowCoverImageModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [coverImageUrl, setCoverImageUrl] = useState(null); // Existing cover image URL
  const [background, setBackground] = useState(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(null); // Existing background image URL
  const [themeColor, setThemeColor] = useState("#4b6cff");
  const [isAdmin, setIsAdmin] = useState(false);

  const languages = [
    "English",
    "Urdu",
    "Hindi",
    "Punjabi",
    "Arabic",
    "Spanish",
    "French",
    "German",
    "Chinese",
    "Japanese",
    "Korean",
    "Bengali",
    "Russian",
    "Portuguese",
    "Italian",
    "Turkish",
    "Persian",
    "Sindhi",
    "Pashto",
    "Tamil",
    "Telugu",
    "Marathi",
    "Vietnamese",
    "Thai",
    "Malay"
  ];

  const themeColors = [
    "#4b6cff", // Blue
    "#FF6B6B", // Red
    "#4ECB71", // Green
    "#9B6DFF", // Purple
    "#FF9F43", // Orange
    "#FF70A6", // Pink
    "#01C8EE", // Cyan
    "#FFCE45", // Yellow
    "#2ECC71", // Emerald
    "#9B59B6", // Violet
    "#E74C3C", // Crimson
    "#1ABC9C", // Turquoise
  ];

  const categories = [
    { name: "Gaming & Esports", icon: "game-controller" },
    { name: "Education & Learning", icon: "school" },
    { name: "Technology & Programming", icon: "code-slash" },
    { name: "Sports & Athletics", icon: "basketball" },
    { name: "Entertainment", icon: "film" },
    { name: "Music & Audio", icon: "musical-notes" },
    { name: "Art & Design", icon: "color-palette" },
    { name: "Food & Cooking", icon: "restaurant" },
    { name: "Travel & Adventure", icon: "airplane" },
    { name: "Fashion & Style", icon: "shirt" },
    { name: "Health & Fitness", icon: "fitness" },
    { name: "Business & Entrepreneurship", icon: "briefcase" },
    { name: "Science & Innovation", icon: "flask" },
    { name: "Politics & Current Events", icon: "newspaper" },
    { name: "Photography & Video", icon: "camera" },
    { name: "Movies & TV Shows", icon: "tv" },
    { name: "Books & Literature", icon: "book" },
    { name: "Pets & Animals", icon: "paw" },
    { name: "Spirituality & Religion", icon: "moon" },
    { name: "DIY & Crafts", icon: "construct" },
    { name: "Automotive", icon: "car-sport" },
    { name: "Family & Parenting", icon: "people" },
    { name: "Mental Health & Wellness", icon: "heart" },
    { name: "Finance & Investing", icon: "cash" },
    { name: "Nature & Environment", icon: "leaf" },
    { name: "Other", icon: "apps" }
  ];

  // Fetch community data on mount
  useEffect(() => {
    if (communityId) {
      fetchCommunityData();
    } else {
      Alert.alert('Error', 'Community ID not provided');
      navigation.goBack();
    }
  }, [communityId]);

  const fetchCommunityData = async () => {
    try {
      const db = getFirestore(firebaseApp);
      const auth = getAuth(firebaseApp);
      const currentUserId = auth.currentUser?.uid;

      if (!currentUserId) {
        Alert.alert('Error', 'User not authenticated');
        navigation.goBack();
        return;
      }

      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);

      if (!communitySnap.exists()) {
        Alert.alert('Error', 'Community not found');
        navigation.goBack();
        return;
      }

      const data = communitySnap.data();

      // Check if user is admin
      const userIsAdmin = 
        data.creatorId === currentUserId ||
        data.createdBy === currentUserId ||
        data.uid === currentUserId ||
        data.ownerId === currentUserId ||
        data.community_admin === currentUserId ||
        (Array.isArray(data.adminIds) && data.adminIds.includes(currentUserId));

      if (!userIsAdmin) {
        Alert.alert('Error', 'You do not have permission to edit this community');
        navigation.goBack();
        return;
      }

      setIsAdmin(true);

      // Populate form fields with existing data
      setCommunityName(data.name || '');
      setDescription(data.description || '');
      setLanguage(data.language || 'English');
      setCategory(data.category || '');
      setPrivacy(data.privacy || 'open');
      setDiscover(data.discover === 'private' ? 'private' : 'public');
      setThemeColor(data.themeColor || '#4b6cff');
      
      // Set existing image URLs
      if (data.profileImage) {
        setImageUrl(data.profileImage);
      }
      if (data.coverImage) {
        setCoverImageUrl(data.coverImage);
      }
      if (data.backgroundImage) {
        setBackgroundImageUrl(data.backgroundImage);
      }

      setLoading(false);
    } catch (error) {
      console.warn('Error fetching community:', error);
      Alert.alert('Error', 'Failed to load community data');
      navigation.goBack();
    }
  };

  const isStep1Valid = () => {
    return (
      communityName.trim() !== '' && 
      description.trim() !== '' && 
      category.trim() !== '' &&
      language.trim() !== ''
    );
  };

  const isStep2Valid = () => {
    // For edit, images are optional (can keep existing ones)
    return true;
  };

  const next = () => setStep((p) => p + 1);
  const back = () => setStep((p) => p - 1);

  const handleUpdate = () => setShowReminder(true);

  const pickImage = async (setter) => {
    try {
      const { status } = await requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required!');
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0].uri || result.uri;
        setter(picked);
      }
    } catch (e) {
      console.warn('ImagePicker error', e);
    }
  };

  const confirmUpdate = async () => {
    setShowReminder(false);
    setUploading(true);
    try {
      const db = getFirestore(firebaseApp);
      const auth = getAuth(firebaseApp);
      const currentUserId = auth.currentUser?.uid;

      if (!currentUserId) {
        Alert.alert('Error', 'User not authenticated. Please login again.');
        setUploading(false);
        return;
      }

      // Upload new images if selected, otherwise keep existing URLs
      let finalProfileImageUrl = imageUrl; // Keep existing if no new image
      let finalCoverImageUrl = coverImageUrl; // Keep existing if no new image
      let finalBackgroundImageUrl = backgroundImageUrl; // Keep existing if no new image

      if (image) {
        const profileRes = await uploadImageAsync(image, { 
          folder: 'community_images/profile' 
        });
        finalProfileImageUrl = typeof profileRes === 'string' ? profileRes : (profileRes?.secure_url || profileRes?.url || null);
      }

      if (coverImage) {
        const coverRes = await uploadImageAsync(coverImage, { 
          folder: 'community_images/covers' 
        });
        finalCoverImageUrl = typeof coverRes === 'string' ? coverRes : (coverRes?.secure_url || coverRes?.url || null);
      }

      if (background) {
        const bgRes = await uploadImageAsync(background, { 
          folder: 'community_images/backgrounds' 
        });
        finalBackgroundImageUrl = typeof bgRes === 'string' ? bgRes : (bgRes?.secure_url || bgRes?.url || null);
      }

      // Build update data object
      const updateData = {
        name: communityName,
        description: description || '',
        language: language || 'English',
        category: category || '',
        privacy: privacy || 'open',
        discover: discover !== undefined ? (discover === 'public' ? true : false) : true,
        themeColor: themeColor || '#8B2EF0',
        updatedAt: serverTimestamp(),
      };

      // Only update image fields if they have values
      if (finalProfileImageUrl) {
        updateData.profileImage = finalProfileImageUrl;
      }
      if (finalCoverImageUrl) {
        updateData.coverImage = finalCoverImageUrl;
      }
      if (finalBackgroundImageUrl) {
        updateData.backgroundImage = finalBackgroundImageUrl;
      }

      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, updateData);

      Alert.alert(
        "Success",
        "Community updated successfully!",
        [
          { text: "OK", onPress: () => navigation.navigate('Community') }
        ]
      );

    } catch (err) {
      console.warn('Update community error', err);
      Alert.alert('Error', err.message || 'Could not update community');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4b6cff" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading community...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff' }}>You do not have permission to edit this community</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={back}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Edit Community</Text>
        <Text style={styles.help}>Help</Text>
      </View>

      {/* Step 1 */}
      {step === 1 && (
        <View style={{ marginTop: 40 }}>
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setImage)}>
            {image ? (
              <Image source={{ uri: image }} style={{ width: '100%', height: 120, borderRadius: 12 }} />
            ) : imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 120, borderRadius: 12 }} />
            ) : (
              <Ionicons name="add" size={40} color="#888" />
            )}
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { marginTop: 16 }]}
            placeholder="Community Name"
            placeholderTextColor="#666"
            maxLength={50}
            value={communityName}
            onChangeText={setCommunityName}
          />
          <TextInput
            style={[styles.input, { marginTop: 12, height: 80 }]}
            placeholder="Describe your Community in one line"
            placeholderTextColor="#666"
            maxLength={200}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity 
            style={[styles.selectBox, styles.selectBoxRow]} 
            onPress={() => setShowLanguageModal(true)}
          >
            <Text style={styles.selectText}>
              Community Language: {language}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.selectBox, styles.selectBoxRow]} 
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={styles.selectText}>
              Primary Category: {category || "Select"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.nextButton, 
              !isStep1Valid() && styles.nextButtonDisabled
            ]} 
            onPress={next}
            disabled={!isStep1Valid()}
          >
            <Text style={[
              styles.nextText,
              !isStep1Valid() && styles.nextTextDisabled
            ]}>
              Next (1/3)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <View style={{ marginTop: 40 }}>
          <Text style={styles.sectionTitle}>Customize Look</Text>

          <TouchableOpacity style={styles.menuRow} onPress={() => setShowCoverImageModal(true)}>
            <Text style={styles.menuText}>Cover Image</Text>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.previewImage} />
            ) : coverImageUrl ? (
              <Image source={{ uri: coverImageUrl }} style={styles.previewImage} />
            ) : (
              <Ionicons name="image-outline" size={22} color="#999" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => setShowBackgroundModal(true)}>
            <Text style={styles.menuText}>Community Background</Text>
            {background ? (
              <Image source={{ uri: background }} style={styles.previewImage} />
            ) : backgroundImageUrl ? (
              <Image source={{ uri: backgroundImageUrl }} style={styles.previewImage} />
            ) : (
              <Ionicons name="image-outline" size={22} color="#999" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => setShowColorModal(true)}>
            <Text style={styles.menuText}>Theme Color</Text>
            <View style={[styles.colorCircle, { backgroundColor: themeColor }]} />
          </TouchableOpacity>

          <View style={styles.bottomNav}>
            <TouchableOpacity onPress={back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.nextButtonSmall,
                !isStep2Valid() && styles.nextButtonDisabled
              ]} 
              onPress={next}
              disabled={!isStep2Valid()}
            >
              <Text style={[
                styles.nextText,
                !isStep2Valid() && styles.nextTextDisabled
              ]}>
                Next (2/3)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <View style={{ marginTop: 40 }}>
          <Text style={styles.sectionTitle}>Permissions & Privacy</Text>

          <Text style={styles.subLabel}>Join Permissions</Text>
          <TouchableOpacity
            style={[
              styles.choice,
              privacy === "open" && styles.choiceActive,
            ]}
            onPress={() => setPrivacy("open")}
          >
            <Text style={styles.choiceText}>Open — anyone may join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.choice,
              privacy === "locked" && styles.choiceActive,
            ]}
            onPress={() => setPrivacy("locked")}
          >
            <Text style={styles.choiceText}>
              Locked — only selected users may join
            </Text>
          </TouchableOpacity>

          <Text style={[styles.subLabel, { marginTop: 16 }]}>
            Discoverability
          </Text>
          <TouchableOpacity
            style={[
              styles.choice,
              discover === "public" && styles.choiceActive,
            ]}
            onPress={() => setDiscover("public")}
          >
            <Text style={styles.choiceText}>
              Public — visible and recommended
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.choice,
              discover === "private" && styles.choiceActive,
            ]}
            onPress={() => setDiscover("private")}
          >
            <Text style={styles.choiceText}>
              Private — only found by link or ID
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.createBtn} onPress={handleUpdate} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createText}>Update</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Reminder Popup */}
      <Modal visible={showReminder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Update</Text>
            <Text style={styles.modalText}>
              Are you sure you want to update this community? All changes will be saved.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowReminder(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.agreeBtn}
                onPress={confirmUpdate}
              >
                <Text style={styles.agreeText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.pickerModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.optionItem,
                    lang === language && styles.selectedOption,
                  ]}
                  onPress={() => {
                    setLanguage(lang);
                    setShowLanguageModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    lang === language && styles.selectedOptionText,
                  ]}>
                    {lang}
                  </Text>
                  {lang === language && (
                    <Ionicons name="checkmark" size={20} color="#4b6cff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.pickerModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[
                    styles.optionItem,
                    cat.name === category && styles.selectedOption,
                  ]}
                  onPress={() => {
                    setCategory(cat.name);
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={styles.optionContent}>
                    <Ionicons name={cat.icon} size={24} color={cat.name === category ? "#4b6cff" : "#666"} style={styles.optionIcon} />
                    <Text style={[
                      styles.optionText,
                      cat.name === category && styles.selectedOptionText,
                    ]}>
                      {cat.name}
                    </Text>
                  </View>
                  {cat.name === category && (
                    <Ionicons name="checkmark" size={20} color="#4b6cff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cover Image Selection Modal */}
      <Modal
        visible={showCoverImageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoverImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.pickerModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cover Image</Text>
              <TouchableOpacity onPress={() => setShowCoverImageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.imagePickerContent}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={() => {
                  pickImage(setCoverImage);
                  setShowCoverImageModal(false);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#4b6cff" />
                <Text style={styles.uploadText}>Choose from Gallery</Text>
              </TouchableOpacity>
              {(coverImage || coverImageUrl) && (
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => {
                    setCoverImage(null);
                    setCoverImageUrl(null);
                    setShowCoverImageModal(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  <Text style={styles.removeText}>Remove Image</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Background Selection Modal */}
      <Modal
        visible={showBackgroundModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBackgroundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.pickerModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Background Image</Text>
              <TouchableOpacity onPress={() => setShowBackgroundModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.imagePickerContent}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={() => {
                  pickImage(setBackground);
                  setShowBackgroundModal(false);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#4b6cff" />
                <Text style={styles.uploadText}>Choose from Gallery</Text>
              </TouchableOpacity>
              {(background || backgroundImageUrl) && (
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => {
                    setBackground(null);
                    setBackgroundImageUrl(null);
                    setShowBackgroundModal(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  <Text style={styles.removeText}>Remove Image</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Theme Color Selection Modal */}
      <Modal
        visible={showColorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowColorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.pickerModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Theme Color</Text>
              <TouchableOpacity onPress={() => setShowColorModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.colorGrid}>
              {themeColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    color === themeColor && styles.selectedColorOption,
                  ]}
                  onPress={() => {
                    setThemeColor(color);
                    setShowColorModal(false);
                  }}
                >
                  {color === themeColor && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c0d0f",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  help: {
    color: "#888",
    fontSize: 14,
  },
  uploadBox: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1c20",
  },
  input: {
    backgroundColor: "#1a1c20",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    padding: 12,
    fontSize: 14,
  },
  selectBox: {
    backgroundColor: "#1a1c20",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  selectText: { color: "#fff" },
  nextButton: {
    marginTop: 24,
    backgroundColor: "#20232a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
    paddingVertical: 14,
    alignItems: "center",
  },
  nextButtonDisabled: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
  },
  nextText: { 
    color: "#fff", 
    fontWeight: "600" 
  },
  nextTextDisabled: {
    color: "#666",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1a1c20",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  menuText: { color: "#fff", fontSize: 14 },
  colorCircle: {
    width: 20,
    height: 20,
    backgroundColor: "#4b6cff",
    borderRadius: 10,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  backText: { color: "#4b6cff" },
  nextButtonSmall: {
    backgroundColor: "#20232a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  subLabel: {
    color: "#888",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#1a1c20",
    marginBottom: 10,
  },
  choiceActive: {
    borderColor: "#4b6cff",
    backgroundColor: "#14161c",
  },
  choiceText: { color: "#fff" },
  createBtn: {
    marginTop: 30,
    backgroundColor: "#4b6cff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  createText: { color: "#fff", fontWeight: "600" },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: "#1b1d23",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: "#333",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalText: { color: "#aaa", fontSize: 14, marginBottom: 10 },
  modalBullet: { color: "#ddd", fontSize: 13, marginBottom: 10 },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelBtn: { color: "#888", fontSize: 15 },
  agreeBtn: {
    backgroundColor: "#4b6cff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  agreeText: { color: "#fff", fontWeight: "600" },
  selectBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerModal: {
    maxHeight: "80%",
    width: "100%",
    padding: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  optionsList: {
    maxHeight: 360,
    width: '100%'
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  selectedOption: {
    backgroundColor: "#1E2127",
  },
  optionText: {
    color: "#fff",
    fontSize: 16,
  },
  selectedOptionText: {
    color: "#4b6cff",
    fontWeight: "600",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIcon: {
    marginRight: 12,
    width: 24,
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  imagePickerContent: {
    padding: 20,
    alignItems: 'center',
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#4b6cff',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 16,
  },
  uploadText: {
    color: '#4b6cff',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  removeText: {
    color: '#ff4444',
    marginLeft: 8,
    fontSize: 14,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    justifyContent: 'space-between',
  },
  colorOption: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 12,
    margin: '1%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#fff',
  },
});

