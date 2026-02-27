// screens/CreateCommunityScreen.js
import React, { useState, useCallback, useEffect } from "react";
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
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Linking,
  BackHandler,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { uploadImageToHostinger } from './hostingerConfig';
import { db, auth } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from "@expo/vector-icons";

// --- Static data (defined outside component to avoid re-creation on every render) ---
const LANGUAGES = [
  "English", "Urdu", "Hindi", "Punjabi", "Arabic", "Spanish", "French",
  "German", "Chinese", "Japanese", "Korean", "Bengali", "Russian",
  "Portuguese", "Italian", "Turkish", "Persian", "Sindhi", "Pashto",
  "Tamil", "Telugu", "Marathi", "Vietnamese", "Thai", "Malay",
];

const THEME_COLORS = [
  "#4b6cff", "#FF6B6B", "#4ECB71", "#9B6DFF",
  "#FF9F43", "#FF70A6", "#01C8EE", "#FFCE45",
  "#2ECC71", "#9B59B6", "#E74C3C", "#1ABC9C",
];

const CATEGORIES = [
  { name: "Gaming & Esports",          icon: "game-controller" },
  { name: "Education & Learning",       icon: "school" },
  { name: "Technology & Programming",   icon: "code-slash" },
  { name: "Sports & Athletics",         icon: "basketball" },
  { name: "Entertainment",              icon: "film" },
  { name: "Music & Audio",              icon: "musical-notes" },
  { name: "Art & Design",               icon: "color-palette" },
  { name: "Food & Cooking",             icon: "restaurant" },
  { name: "Travel & Adventure",         icon: "airplane" },
  { name: "Fashion & Style",            icon: "shirt" },
  { name: "Health & Fitness",           icon: "fitness" },
  { name: "Business & Entrepreneurship",icon: "briefcase" },
  { name: "Science & Innovation",       icon: "flask" },
  { name: "Politics & Current Events",  icon: "newspaper" },
  { name: "Photography & Video",        icon: "camera" },
  { name: "Movies & TV Shows",          icon: "tv" },
  { name: "Books & Literature",         icon: "book" },
  { name: "Pets & Animals",             icon: "paw" },
  { name: "Spirituality & Religion",    icon: "moon" },
  { name: "DIY & Crafts",               icon: "construct" },
  { name: "Automotive",                 icon: "car-sport" },
  { name: "Family & Parenting",         icon: "people" },
  { name: "Mental Health & Wellness",   icon: "heart" },
  { name: "Finance & Investing",        icon: "cash" },
  { name: "Nature & Environment",       icon: "leaf" },
  { name: "Other",                      icon: "apps" },
];

const TOTAL_STEPS = 3;

export default function CreateCommunityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [communityName, setCommunityName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [category, setCategory] = useState("");
  const [privacy, setPrivacy] = useState("open");
  const [discover, setDiscover] = useState("public");
  const [showReminder, setShowReminder] = useState(false);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCoverImageModal, setShowCoverImageModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [background, setBackground] = useState(null);
  const [themeColor, setThemeColor] = useState("#4b6cff");
  const [uploadProgress, setUploadProgress] = useState('');

  const isStep1Valid = useCallback(() => (
    communityName.trim().length >= 3 &&
    description.trim() !== '' &&
    category.trim() !== '' &&
    language.trim() !== ''
  ), [communityName, description, category, language]);

  // Cover image required; background optional
  const isStep2Valid = useCallback(() => coverImage !== null, [coverImage]);

  const next = useCallback(() => setStep((p) => p + 1), []);
  const back = useCallback(() => setStep((p) => p - 1), []);
  const handleCreate = useCallback(() => setShowReminder(true), []);

  // Block Android hardware back during upload (iOS: no-op, skip)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      if (uploading) {
        Alert.alert('Upload in progress', 'Please wait while your images are being uploaded.');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [uploading]);

  const pickImage = useCallback(async (setter) => {
    try {
      const { status, canAskAgain } = await requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Permission Required',
            'Photo library access is permanently denied. Please enable it in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert('Permission Required', 'Permission to access your photo library is required.');
        }
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setter(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('ImagePicker error', e);
      Alert.alert('Error', 'Could not open photo library. Please try again.');
    }
  }, []);

  const confirmCreate = useCallback(async () => {
    setShowReminder(false);
    setUploading(true);
    setUploadProgress('');
    try {
      let profileImageUrl = null;
      let coverImageUrl = null;
      let backgroundImageUrl = null;

      const pause = (ms) => new Promise(res => setTimeout(res, ms));

      // Count how many images need uploading for progress label
      const total = [image, coverImage, background].filter(Boolean).length;
      let done = 0;

      if (image) {
        setUploadProgress(`Uploading profile image (${++done}/${total})…`);
        const profileRes = await uploadImageToHostinger(image, 'community_profiles');
        profileImageUrl = typeof profileRes === 'string' ? profileRes : (profileRes?.secure_url || profileRes?.url || null);
      }

      if (coverImage) {
        if (image) await pause(800);
        setUploadProgress(`Uploading cover image (${++done}/${total})…`);
        const coverRes = await uploadImageToHostinger(coverImage, 'community_covers');
        coverImageUrl = typeof coverRes === 'string' ? coverRes : (coverRes?.secure_url || coverRes?.url || null);
      }

      if (background) {
        if (coverImage || image) await pause(800);
        setUploadProgress(`Uploading background (${++done}/${total})…`);
        const bgRes = await uploadImageToHostinger(background, 'community_backgrounds');
        backgroundImageUrl = typeof bgRes === 'string' ? bgRes : (bgRes?.secure_url || bgRes?.url || null);
      }

      setUploadProgress('Creating community…');

      // Save community doc to Firestore
      // db is now imported globally
      
      // Get current user ID
      const currentUserId = auth.currentUser?.uid;
      
      if (!currentUserId) {
        Alert.alert('Error', 'User not authenticated. Please login again.');
        setUploading(false);
        return;
      }
      
      // Build community data object, only including fields that are not undefined
      const communityData = {
        name: communityName.trim(),
        description: description.trim(),
        language: language || 'English',
        category: category || '',
        privacy: privacy || 'open',
        discover: discover || 'public',
        themeColor: themeColor || '#4b6cff',
        memberCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        creatorId: currentUserId,
        createdBy: currentUserId,
        uid: currentUserId,
        ownerId: currentUserId,
        community_admin: currentUserId,
        adminIds: [currentUserId],
        memberIds: [currentUserId],
      };
      
      // Only add image fields if they have values (not null or undefined)
      if (profileImageUrl) {
        communityData.profileImage = profileImageUrl;
      }
      if (coverImageUrl) {
        communityData.coverImage = coverImageUrl;
      }
      if (backgroundImageUrl) {
        communityData.backgroundImage = backgroundImageUrl;
      }
      
      await addDoc(collection(db, 'communities'), communityData);

      Alert.alert(
        "Success",
        "Community created successfully!",
        [
          { text: "OK", onPress: () => navigation.navigate('Community') }
        ]
      );

    } catch (err) {
      console.warn('Create community error', err);
      Alert.alert('Error', err.message || 'Could not create community. Please check your connection and try again.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, [image, coverImage, background, communityName, description, language, category, privacy, discover, themeColor, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0c0d0f" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 32) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <Text style={styles.headerTitle}>New Community</Text>
        <Text style={styles.help}>Help</Text>
      </View>

      {/* Step progress bar */}
      <View style={styles.stepBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              i < step ? styles.stepDotActive : null,
              i === step - 1 ? styles.stepDotCurrent : null,
            ]}
          />
        ))}
      </View>

      {/* Step 1 */}
      {step === 1 && (
        <View style={{ marginTop: 40 }}>
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setImage)}>
            {image ? (
              <Image source={{ uri: image }} style={{ width: '100%', height: 120, borderRadius: 12 }} />
            ) : (
              <View style={styles.uploadBoxHint}>
                <Ionicons name="camera-outline" size={32} color="#555" />
                <Text style={styles.uploadBoxLabel}>Profile Image (optional)</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { marginTop: 16 }]}
              placeholder="Community Name (min 3 characters)"
              placeholderTextColor="#555"
              maxLength={50}
              value={communityName}
              onChangeText={setCommunityName}
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{communityName.length}/50</Text>
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { marginTop: 12, height: 90, textAlignVertical: 'top' }]}
              placeholder="Describe your Community in one line"
              placeholderTextColor="#555"
              maxLength={200}
              multiline
              value={description}
              onChangeText={setDescription}
            />
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

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

          {communityName.trim().length > 0 && communityName.trim().length < 3 && (
            <Text style={styles.validationError}>Name must be at least 3 characters</Text>
          )}

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

          <TouchableOpacity style={[styles.menuRow, !coverImage && styles.menuRowRequired]} onPress={() => setShowCoverImageModal(true)}>
            <View>
              <Text style={styles.menuText}>Cover Image <Text style={styles.required}>*</Text></Text>
              {!coverImage && <Text style={styles.menuSubText}>Required</Text>}
            </View>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.previewImage} />
            ) : (
              <Ionicons name="image-outline" size={22} color="#999" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => setShowBackgroundModal(true)}>
            <View>
              <Text style={styles.menuText}>Community Background</Text>
              <Text style={styles.menuSubText}>Optional</Text>
            </View>
            {background ? (
              <Image source={{ uri: background }} style={styles.previewImage} />
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

          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={uploading}>
            <Text style={styles.createText}>Create Community</Text>
          </TouchableOpacity>
        </View>
      )}

      </ScrollView>
      </KeyboardAvoidingView>

      {/* Upload overlay */}
      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadOverlayCard}>
            <ActivityIndicator size="large" color="#4b6cff" />
            <Text style={styles.uploadOverlayText}>{uploadProgress || 'Processing…'}</Text>
            <Text style={styles.uploadOverlaySubText}>Please do not close the app</Text>
          </View>
        </View>
      </Modal>

      {/* Reminder Popup — centered overlay */}
      <Modal visible={showReminder} transparent animationType="fade">
        <View style={styles.reminderOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reminder</Text>
            <Text style={styles.modalText}>
              All actions you take related to our Platform and all information you
              post on our Platform remain your responsibility.{"\n\n"}
              Please agree to the following rules before creating a Community:
            </Text>

            <Text style={styles.modalBullet}>
              • Monitor your community regularly.{"\n"}
              • Manage according to platform guidelines.{"\n"}
              • Do not promote or conduct illegal activities.{"\n"}
              • Violations can lead to suspension or removal.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtnBox}
                onPress={() => setShowReminder(false)}
              >
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.agreeBtn}
                onPress={confirmCreate}
              >
                <Text style={styles.agreeText}>Agree & Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              {LANGUAGES.map((lang) => (
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
              {CATEGORIES.map((cat) => (
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
                  setShowCoverImageModal(false);
                  setTimeout(() => pickImage(setCoverImage), 600);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#4b6cff" />
                <Text style={styles.uploadText}>Choose from Gallery</Text>
              </TouchableOpacity>
              {coverImage && (
                <>
                  <Image source={{ uri: coverImage }} style={styles.previewLarge} />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => {
                      setCoverImage(null);
                      setShowCoverImageModal(false);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    <Text style={styles.removeText}>Remove Image</Text>
                  </TouchableOpacity>
                </>
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
                  setShowBackgroundModal(false);
                  setTimeout(() => pickImage(setBackground), 600);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#4b6cff" />
                <Text style={styles.uploadText}>Choose from Gallery</Text>
              </TouchableOpacity>
              {background && (
                <>
                  <Image source={{ uri: background }} style={styles.previewLarge} />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => {
                      setBackground(null);
                      setShowBackgroundModal(false);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    <Text style={styles.removeText}>Remove Image</Text>
                  </TouchableOpacity>
                </>
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
              {THEME_COLORS.map((color) => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c0d0f",
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
    minWidth: 30,
    textAlign: 'right',
  },
  uploadBoxHint: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBoxLabel: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
  },
  inputWrapper: {
    position: 'relative',
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    color: '#444',
    fontSize: 11,
  },
  validationError: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  required: {
    color: '#ff6b6b',
    fontSize: 13,
  },
  menuSubText: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  menuRowRequired: {
    borderColor: '#ff6b6b44',
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
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
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
  cancelBtnBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelBtn: { color: "#aaa", fontSize: 15 },
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
  previewLarge: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 12,
    resizeMode: 'cover',
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
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
    gap: 8,
  },
  stepDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2d35',
  },
  stepDotActive: {
    backgroundColor: '#4b6cff88',
  },
  stepDotCurrent: {
    backgroundColor: '#4b6cff',
    width: 40,
  },
  reminderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  uploadOverlayCard: {
    backgroundColor: '#1b1d23',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: '#333',
    gap: 16,
  },
  uploadOverlayText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadOverlaySubText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});

