import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { compressPostImage } from './utils/imageCompression';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

const CATEGORIES = [
  'General',
  'Technology',
  'Science',
  'Entertainment',
  'Sports',
  'Education',
  'Business',
  'Health',
  'Travel',
  'Food',
  'Other',
];

export default function CreateQuestionScreen({ navigation }) {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1.0,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await compressPostImage(result.assets[0].uri);
      setSelectedImage(compressed);
    }
  };

  const publishQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    setIsPosting(true);
    try {
      const questionData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        question: question,
        description: description,
        category: category,
        image: selectedImage || null,
        answers: [],
        answerCount: 0,
        likes: 0,
        likedBy: [],
        comments: 0,
        upvotes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: 'question',
        scope: 'global',
      };

      await addDoc(collection(db, 'questions'), questionData);
      
      Alert.alert('Success', 'Question posted successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error posting question:', error);
      Alert.alert('Error', 'Failed to post question. Please try again.');
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
        <Text style={styles.headerTitle}>Ask Question</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Question Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Your Question</Text>
          <TextInput
            style={styles.questionInput}
            placeholder="What do you want to know?"
            placeholderTextColor="#666"
            value={question}
            onChangeText={setQuestion}
            maxLength={300}
            multiline
          />
          <Text style={styles.charCount}>{question.length}/300</Text>
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Add more details to help others understand your question..."
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            multiline
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => setShowCategories(!showCategories)}
          >
            <Text style={styles.categoryText}>{category}</Text>
            <Ionicons
              name={showCategories ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#08FFE2"
            />
          </TouchableOpacity>

          {showCategories && (
            <View style={styles.categoryList}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    category === cat && styles.categoryItemActive,
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategories(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryItemText,
                      category === cat && styles.categoryItemTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                  {category === cat && (
                    <Ionicons name="checkmark" size={20} color="#08FFE2" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Image Attachment */}
        <View style={styles.section}>
          <Text style={styles.label}>Add Image (Optional)</Text>
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-circle" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={32} color="#08FFE2" />
              <Text style={styles.addImageText}>Add Image</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={20} color="#FFD700" />
            <Text style={styles.tipHeaderText}>Tips for asking questions</Text>
          </View>
          <Text style={styles.tipText}>• Be clear and specific</Text>
          <Text style={styles.tipText}>• Include relevant details</Text>
          <Text style={styles.tipText}>• Choose the right category</Text>
          <Text style={styles.tipText}>• Be respectful and polite</Text>
        </View>
      </ScrollView>

      {/* Footer - Publish Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.publishButton, isPosting && styles.publishButtonDisabled]}
          onPress={publishQuestion}
          disabled={isPosting}
        >
          {isPosting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.publishButtonText}>Post Question</Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  questionInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  descriptionInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 16,
  },
  categoryList: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  categoryItemActive: {
    backgroundColor: 'rgba(8, 255, 226, 0.1)',
  },
  categoryItemText: {
    color: '#fff',
    fontSize: 14,
  },
  categoryItemTextActive: {
    color: '#08FFE2',
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
  },
  addImageButton: {
    backgroundColor: '#111',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#222',
    borderStyle: 'dashed',
  },
  addImageText: {
    color: '#08FFE2',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    marginBottom: 16,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipHeaderText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tipText: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 20,
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
