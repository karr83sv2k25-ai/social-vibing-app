import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function DraftScreen({ navigation }) {
  const [drafts, setDrafts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      const storedDrafts = await AsyncStorage.getItem('post_drafts');
      if (storedDrafts) {
        setDrafts(JSON.parse(storedDrafts));
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  };

  const deleteDraft = async (index) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const newDrafts = drafts.filter((_, i) => i !== index);
              setDrafts(newDrafts);
              await AsyncStorage.setItem('post_drafts', JSON.stringify(newDrafts));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete draft');
            }
          },
        },
      ]
    );
  };

  const publishDraft = async (draft, index) => {
    Alert.alert(
      'Publish Draft',
      'Do you want to publish this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            if (!currentUser) {
              Alert.alert('Authentication Required', 'Please log in again to publish drafts.');
              return;
            }

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
                console.log('⚠️  Could not load extended profile for draft author:', profileError.message);
              }

              const images = Array.isArray(draft.images) ? draft.images : [];

              const postData = {
                authorId: currentUser.uid,
                authorEmail: currentUser.email,
                authorName,
                authorImage,
                text: (draft.text || '').trim(),
                images,
                likes: 0,
                likedBy: [],
                comments: 0,
                shares: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                type: draft.type || 'post',
                scope: 'global',
              };

              await addDoc(collection(db, 'posts'), postData);

              // Remove from drafts
              const newDrafts = drafts.filter((_, i) => i !== index);
              setDrafts(newDrafts);
              await AsyncStorage.setItem('post_drafts', JSON.stringify(newDrafts));

              Alert.alert('Success', 'Draft published successfully!');
            } catch (error) {
              console.error('Error publishing draft:', error);
              Alert.alert('Error', 'Failed to publish draft');
            }
          },
        },
      ]
    );
  };

  const editDraft = (draft, index) => {
    // Navigate to appropriate screen based on draft type
    navigation.navigate('CreatePost', { draftData: draft, draftIndex: index });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  };

  const renderDraftItem = ({ item, index }) => (
    <View style={styles.draftCard}>
      <View style={styles.draftHeader}>
        <View style={styles.draftTypeContainer}>
          <Ionicons
            name={
              item.type === 'story'
                ? 'camera'
                : item.type === 'poll'
                ? 'bar-chart'
                : item.type === 'quiz'
                ? 'help-circle'
                : 'document-text'
            }
            size={20}
            color="#08FFE2"
          />
          <Text style={styles.draftType}>
            {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Post'}
          </Text>
        </View>
        <Text style={styles.draftDate}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.draftText} numberOfLines={3}>
        {item.text || 'No text'}
      </Text>

      {item.images && item.images.length > 0 && (
        <View style={styles.imagesPreview}>
          {item.images.slice(0, 3).map((uri, imgIndex) => (
            <Image key={imgIndex} source={{ uri }} style={styles.thumbnailImage} />
          ))}
          {item.images.length > 3 && (
            <View style={styles.moreImagesOverlay}>
              <Text style={styles.moreImagesText}>+{item.images.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.draftActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => editDraft(item, index)}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.publishButton]}
          onPress={() => publishDraft(item, index)}
        >
          <Ionicons name="send" size={18} color="#000" />
          <Text style={[styles.actionButtonText, { color: '#000' }]}>Publish</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteDraft(index)}
        >
          <Ionicons name="trash-outline" size={18} color="#FF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drafts</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={80} color="#666" />
          <Text style={styles.emptyText}>No drafts saved</Text>
          <Text style={styles.emptySubText}>
            Your draft posts will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          renderItem={renderDraftItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
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
  listContent: {
    padding: 16,
  },
  draftCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  draftTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftType: {
    color: '#08FFE2',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  draftDate: {
    color: '#666',
    fontSize: 12,
  },
  draftText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  imagesPreview: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  thumbnailImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  moreImagesOverlay: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  draftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  editButton: {
    backgroundColor: '#222',
  },
  publishButton: {
    backgroundColor: '#08FFE2',
  },
  deleteButton: {
    backgroundColor: '#222',
    flex: 0,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
