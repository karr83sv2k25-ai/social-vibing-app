// screens/CommunityTitlesScreen.js
// Community Titles – manage roles/titles for community members (Figma design)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';

// Default titles with colors matching Figma
const DEFAULT_TITLES = [
  { name: 'Admin', color: '#EF4444', editable: false },
  { name: 'Co-Admin', color: '#06B6D4', editable: false },
  { name: 'Curator', color: '#22C55E', editable: false },
  { name: 'VIP', color: '#EAB308', editable: true },
  { name: 'Welcome Team', color: '#D946EF', editable: true },
];

const TITLE_COLORS = [
  '#EF4444', '#06B6D4', '#22C55E', '#EAB308', '#D946EF',
  '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981',
  '#FF6B6B', '#FF9F43', '#01C8EE',
];

export default function CommunityTitlesScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [titles, setTitles] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitleName, setNewTitleName] = useState('');
  const [newTitleColor, setNewTitleColor] = useState('#3B82F6');
  const [showOptionsFor, setShowOptionsFor] = useState(null);

  useEffect(() => {
    if (communityId) fetchTitles();
  }, [communityId]);

  const fetchTitles = async () => {
    try {
      const ref = doc(db, 'communities', communityId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.customTitles && data.customTitles.length > 0) {
          setTitles(data.customTitles);
        } else {
          // Initialize with defaults
          setTitles(DEFAULT_TITLES);
        }
      }
      setLoading(false);
    } catch (err) {
      console.warn('Error fetching titles:', err);
      setLoading(false);
    }
  };

  const saveTitles = async (updatedTitles) => {
    try {
      const ref = doc(db, 'communities', communityId);
      await updateDoc(ref, {
        customTitles: updatedTitles,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error saving titles:', err);
      Alert.alert('Error', 'Failed to save titles');
    }
  };

  const handleAddTitle = useCallback(() => {
    if (!newTitleName.trim()) {
      Alert.alert('Error', 'Please enter a title name');
      return;
    }

    const newTitle = {
      name: newTitleName.trim(),
      color: newTitleColor,
      editable: true,
    };

    const updated = [...titles, newTitle];
    setTitles(updated);
    saveTitles(updated);
    setShowAddModal(false);
    setNewTitleName('');
    setNewTitleColor('#3B82F6');
  }, [newTitleName, newTitleColor, titles]);

  const handleDeleteTitle = useCallback((index) => {
    const title = titles[index];
    if (!title.editable) {
      Alert.alert('Cannot Delete', 'This is a system title and cannot be removed.');
      return;
    }

    Alert.alert('Delete Title', `Are you sure you want to delete "${title.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updated = titles.filter((_, i) => i !== index);
          setTitles(updated);
          saveTitles(updated);
          setShowOptionsFor(null);
        },
      },
    ]);
  }, [titles]);

  const handleRenameTitle = useCallback((index) => {
    const title = titles[index];
    if (!title.editable) {
      Alert.alert('Cannot Edit', 'This is a system title and cannot be renamed.');
      setShowOptionsFor(null);
      return;
    }

    Alert.prompt?.(
      'Rename Title',
      'Enter new name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (text) => {
            if (text?.trim()) {
              const updated = [...titles];
              updated[index] = { ...updated[index], name: text.trim() };
              setTitles(updated);
              saveTitles(updated);
            }
          },
        },
      ],
      'plain-text',
      title.name
    ) || setShowOptionsFor(null);
  }, [titles]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#D946EF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0b0e" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Titles</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subtitle */}
        <Text style={styles.subtitle}>Bestow Titles upon your Community members</Text>

        {/* Title List */}
        {titles.map((title, index) => (
          <View key={`${title.name}-${index}`} style={styles.titleRow}>
            <Text style={[styles.titleName, { color: title.color }]}>
              {title.name}
            </Text>
            <TouchableOpacity
              onPress={() => setShowOptionsFor(showOptionsFor === index ? null : index)}
              style={styles.moreBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#888" />
            </TouchableOpacity>

            {/* Options dropdown */}
            {showOptionsFor === index && (
              <View style={styles.optionsDropdown}>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setShowOptionsFor(null);
                    // Navigate to assign title to members
                    navigation.navigate('GroupInfo', {
                      communityId,
                      initialTab: 'online',
                      assignTitle: title.name,
                    });
                  }}
                >
                  <Ionicons name="person-add-outline" size={18} color="#06B6D4" />
                  <Text style={styles.optionText}>Assign to Member</Text>
                </TouchableOpacity>
                {title.editable && (
                  <>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => handleRenameTitle(index)}
                    >
                      <Ionicons name="pencil-outline" size={18} color="#F59E0B" />
                      <Text style={styles.optionText}>Rename</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => handleDeleteTitle(index)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      <Text style={[styles.optionText, { color: '#EF4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Add New Title Button */}
        <TouchableOpacity
          style={styles.addTitleBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color="#ccc" />
          <Text style={styles.addTitleText}>Add New Title</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Title Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Title</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Title name"
                placeholderTextColor="#555"
                value={newTitleName}
                onChangeText={setNewTitleName}
                maxLength={30}
                autoFocus
              />

              <Text style={styles.colorLabel}>Title Color</Text>
              <View style={styles.colorGrid}>
                {TITLE_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      color === newTitleColor && styles.selectedColorOption,
                    ]}
                    onPress={() => setNewTitleColor(color)}
                  >
                    {color === newTitleColor && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              {newTitleName.trim() ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Preview:</Text>
                  <Text style={[styles.previewTitle, { color: newTitleColor }]}>
                    {newTitleName}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.createBtn,
                  !newTitleName.trim() && styles.createBtnDisabled,
                ]}
                onPress={handleAddTitle}
                disabled={!newTitleName.trim()}
              >
                <Text style={styles.createBtnText}>Create Title</Text>
              </TouchableOpacity>
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
    backgroundColor: '#0a0b0e',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
    position: 'relative',
  },
  titleName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  moreBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsDropdown: {
    position: 'absolute',
    right: 0,
    top: 50,
    backgroundColor: '#1b1d23',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 4,
    minWidth: 180,
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  addTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#9B6DFF50',
    backgroundColor: '#9B6DFF10',
    gap: 8,
  },
  addTitleText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1b1d23',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  input: {
    backgroundColor: '#14161c',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 12,
    color: '#fff',
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  colorLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  previewLabel: {
    color: '#888',
    fontSize: 13,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  createBtn: {
    backgroundColor: '#9B6DFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
