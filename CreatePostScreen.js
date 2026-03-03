import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { getAuth } from 'firebase/auth';
import { compressPostImage } from './utils/imageCompression';
import { normalizeBlobUri } from './utils/normalizeUri';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { checkBlockedContent } from './shared/services/blockedContentService';
import { db } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadImageToHostinger, uploadVideoToHostinger } from './hostingerConfig';

export default function CreatePostScreen({ navigation }) {
  const [postText, setPostText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const auth = getAuth();

  const pickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1.0,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets) {
      // Compress images before adding them
      const compressedUris = await Promise.all(
        result.assets.map(asset => compressPostImage(asset.uri))
      );
      setSelectedImages([...selectedImages, ...compressedUris]);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const pickVideos = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: true,
      quality: 1.0,
    });

    if (!result.canceled && result.assets) {
      // Normalize blob: URIs to file:// URIs for native compatibility
      const videoUris = await Promise.all(
        result.assets.map(asset => normalizeBlobUri(asset.uri))
      );
      setSelectedVideos([...selectedVideos, ...videoUris.filter(Boolean)]);
    }
  };

  const removeVideo = (index) => {
    setSelectedVideos(selectedVideos.filter((_, i) => i !== index));
  };

  const saveDraft = async () => {
    try {
      const draft = {
        text: postText,
        images: selectedImages,
        videos: selectedVideos,
        timestamp: new Date().toISOString(),
        type: 'post',
      };
      
      const existingDrafts = await AsyncStorage.getItem('post_drafts');
      const drafts = existingDrafts ? JSON.parse(existingDrafts) : [];
      drafts.push(draft);
      
      await AsyncStorage.setItem('post_drafts', JSON.stringify(drafts));
      Alert.alert('Success', 'Post saved to drafts');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save draft');
    }
  };

  const publishPost = async () => {
    const trimmedText = postText.trim();
    if (!trimmedText && selectedImages.length === 0 && selectedVideos.length === 0) {
      Alert.alert('Error', 'Please add some content to your post');
      return;
    }

    // Always get a fresh reference inside the async function
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please log in again to create a post.');
      return;
    }

    setIsPosting(true);
    try {
      let authorName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
      let authorImage = currentUser.photoURL || null;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userDocRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          const fullName = [userData.firstName || userData.user_firstname, userData.lastName || userData.user_lastname].filter(Boolean).join(' ').trim();
          authorName = fullName || userData.displayName || userData.username || userData.user_name || authorName;
          authorImage = userData.profileImage || userData.user_picture || userData.avatar || userData.photoURL || authorImage;
        }
      } catch (profileError) {
        console.log('⚠️  Could not load extended profile for post author:', profileError.message);
      }

      // Upload images to Hostinger
      console.log('📤 Uploading media to Hostinger...');
      const uploadedImageUrls = [];
      const uploadedVideoUrls = [];
      
      for (const imageUri of selectedImages) {
        try {
          const uploadedUrl = await uploadImageToHostinger(imageUri, 'posts');
          // Only accept valid https URLs — reject blob:/file:/ or undefined
          if (uploadedUrl && /^https?:\/\//i.test(uploadedUrl) && !uploadedUrl.includes('blob:')) {
            uploadedImageUrls.push(uploadedUrl);
            console.log('✅ Image uploaded:', uploadedUrl);
          } else {
            console.error('❌ Upload returned invalid URL:', uploadedUrl);
          }
        } catch (uploadError) {
          console.error('❌ Error uploading image:', uploadError);
          // Continue with other images even if one fails
        }
      }

      for (const videoUri of selectedVideos) {
        try {
          const uploadedUrl = await uploadVideoToHostinger(videoUri, 'posts');
          if (uploadedUrl && /^https?:\/\//i.test(uploadedUrl) && !uploadedUrl.includes('blob:')) {
            uploadedVideoUrls.push(uploadedUrl);
            console.log('✅ Video uploaded:', uploadedUrl);
          } else {
            console.error('❌ Upload returned invalid URL:', uploadedUrl);
          }
        } catch (uploadError) {
          console.error('❌ Error uploading video:', uploadError);
          // Continue with other videos even if one fails
        }
      }

      if ((selectedImages.length > 0 && uploadedImageUrls.length === 0) || 
          (selectedVideos.length > 0 && uploadedVideoUrls.length === 0)) {
        Alert.alert('Upload Error', 'Failed to upload media. Please try again.');
        setIsPosting(false);
        return;
      }

      const postData = {
        authorId: currentUser.uid,
        authorEmail: currentUser.email,
        authorName,
        authorImage,
        text: trimmedText,
        images: uploadedImageUrls, // Use Hostinger URLs instead of local URIs
        videos: uploadedVideoUrls, // Video URLs from Hostinger
        likes: 0,
        likedBy: [],
        comments: 0,
        shares: 0,
        isDeleted: false,
        isRemoved: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: 'post',
        scope: 'global',
      };

      // Check for admin-blocked content before publishing
      const blockCheck = await checkBlockedContent(trimmedText, postData.communityId || null);
      if (blockCheck.blocked) {
        Alert.alert('Content Blocked', `Your post contains content that is not allowed: "${blockCheck.matchedKeyword}". Please edit and try again.`);
        setIsPosting(false);
        return;
      }

      await addDoc(collection(db, 'posts'), postData);

      Alert.alert('Success', 'Post published successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error publishing post:', error);
      Alert.alert('Error', 'Failed to publish post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity onPress={saveDraft}>
          <Text style={styles.draftButton}>Draft</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Text Input */}
        <TextInput
          style={styles.textInput}
          placeholder="What's on your mind?"
          placeholderTextColor="#666"
          multiline
          value={postText}
          onChangeText={setPostText}
          maxLength={5000}
        />

        {/* Image Preview */}
        {selectedImages.length > 0 && (
          <View style={styles.imagesContainer}>
            {selectedImages.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Video Preview */}
        {selectedVideos.length > 0 && (
          <View style={styles.imagesContainer}>
            {selectedVideos.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Video
                  source={{ uri }}
                  style={styles.imagePreview}
                  useNativeControls
                  resizeMode="contain"
                  isLooping
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeVideo(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.videoIndicator}>
                  <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.8)" />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add Media Buttons */}
        <View style={styles.mediaButtonsContainer}>
          <TouchableOpacity style={styles.addMediaButton} onPress={pickImages}>
            <Ionicons name="image" size={24} color="#08FFE2" />
            <Text style={styles.addMediaText}>Add Photos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addMediaButton} onPress={pickVideos}>
            <Ionicons name="videocam" size={24} color="#ff4b6e" />
            <Text style={styles.addMediaText}>Add Videos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer - Publish Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.publishButton, isPosting && styles.publishButtonDisabled]}
          onPress={publishPost}
          disabled={isPosting}
        >
          {isPosting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.publishButtonText}>Publish Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  draftButton: {
    color: '#08FFE2',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    fontSize: 16,
    color: '#fff',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  imageWrapper: {
    width: '48%',
    aspectRatio: 1,
    marginRight: '4%',
    marginBottom: 8,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    pointerEvents: 'none',
  },
  mediaButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  addMediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 12,
  },
  addMediaText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#08FFE2',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  publishButton: {
    backgroundColor: '#08FFE2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
