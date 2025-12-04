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
import { getAuth } from 'firebase/auth';
import { compressPostImage } from './utils/imageCompression';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CreatePostScreen({ navigation }) {
  const [postText, setPostText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

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

  const saveDraft = async () => {
    try {
      const draft = {
        text: postText,
        images: selectedImages,
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
    if (!trimmedText && selectedImages.length === 0) {
      Alert.alert('Error', 'Please add some content to your post');
      return;
    }

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
          const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
          authorName = fullName || userData.displayName || userData.username || authorName;
          authorImage = userData.profileImage || userData.avatar || userData.photoURL || authorImage;
        }
      } catch (profileError) {
        console.log('⚠️  Could not load extended profile for post author:', profileError.message);
      }

      const postData = {
        authorId: currentUser.uid,
        authorEmail: currentUser.email,
        authorName,
        authorImage,
        text: trimmedText,
        images: selectedImages,
        likes: 0,
        likedBy: [],
        comments: 0,
        shares: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: 'post',
        scope: 'global',
      };

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

        {/* Add Media Button */}
        <TouchableOpacity style={styles.addMediaButton} onPress={pickImages}>
          <Ionicons name="image" size={24} color="#08FFE2" />
          <Text style={styles.addMediaText}>Add Photos</Text>
        </TouchableOpacity>
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
  addMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    marginTop: 16,
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
