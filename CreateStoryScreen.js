import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { compressStoryImage } from './utils/imageCompression';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function CreateStoryScreen({ navigation }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 1,
      aspect: [9, 16],
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await compressStoryImage(result.assets[0].uri);
      setSelectedImage(compressed);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
      aspect: [9, 16],
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await compressStoryImage(result.assets[0].uri);
      setSelectedImage(compressed);
    }
  };

  const publishStory = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image for your story');
      return;
    }

    setIsPosting(true);
    try {
      const storyData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        image: selectedImage,
        caption: caption,
        views: 0,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        type: 'story',
      };

      await addDoc(collection(db, 'stories'), storyData);
      
      Alert.alert('Success', 'Story posted successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error posting story:', error);
      Alert.alert('Error', 'Failed to post story. Please try again.');
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
        <Text style={styles.headerTitle}>Create Story</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {selectedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            
            {/* Caption Input Overlay */}
            <View style={styles.captionOverlay}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="#ccc"
                value={caption}
                onChangeText={setCaption}
                maxLength={200}
              />
            </View>

            {/* Change Image Button */}
            <TouchableOpacity
              style={styles.changeImageButton}
              onPress={pickImage}
            >
              <Ionicons name="images" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="camera-outline" size={80} color="#666" />
            <Text style={styles.emptyText}>Add a photo or video to your story</Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
                <Ionicons name="camera" size={32} color="#08FFE2" />
                <Text style={styles.actionButtonText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                <Ionicons name="images" size={32} color="#08FFE2" />
                <Text style={styles.actionButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Footer - Publish Button */}
      {selectedImage && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.publishButton, isPosting && styles.publishButtonDisabled]}
            onPress={publishStory}
            disabled={isPosting}
          >
            {isPosting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.publishButtonText}>Share Story</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 32,
  },
  actionButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 16,
    minWidth: 120,
  },
  actionButtonText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  captionInput: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  changeImageButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
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
