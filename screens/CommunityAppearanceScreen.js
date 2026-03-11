// screens/CommunityAppearanceScreen.js
// Appearance settings – Background Image, Home Tab Background, Menu Background, Theme Color
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { uploadImageToHostinger } from '../hostingerConfig';
import { normalizeBlobUri } from '../utils/normalizeUri';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const THEME_COLORS = [
  '#4b6cff', '#FF6B6B', '#4ECB71', '#9B6DFF',
  '#FF9F43', '#FF70A6', '#01C8EE', '#FFCE45',
  '#2ECC71', '#9B59B6', '#E74C3C', '#1ABC9C',
];

const MENU_BG_PRESETS = [
  { colors: ['#67E8F9', '#A78BFA'], id: 'cyan-purple' },
  { colors: ['#A78BFA', '#6366F1'], id: 'purple-indigo' },
  { colors: ['#818CF8', '#3B82F6'], id: 'indigo-blue' },
  { colors: ['#FB7185', '#9333EA'], id: 'pink-purple' },
];

export default function CommunityAppearanceScreen({ route, navigation }) {
  const { communityId, section } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [communityData, setCommunityData] = useState(null);

  // Image states
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(null);
  const [homeTabBackground, setHomeTabBackground] = useState(null);
  const [homeTabBackgroundUrl, setHomeTabBackgroundUrl] = useState(null);
  const [menuBackground, setMenuBackground] = useState(null);
  const [themeColor, setThemeColor] = useState('#9B6DFF');

  // Modals
  const [showColorModal, setShowColorModal] = useState(false);

  useEffect(() => {
    if (communityId) fetchData();
  }, [communityId]);

  const fetchData = async () => {
    try {
      const ref = doc(db, 'communities', communityId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }
      const data = snap.data();
      setCommunityData(data);
      setBackgroundImageUrl(data.backgroundImage || null);
      setHomeTabBackgroundUrl(data.homeTabBackground || null);
      setMenuBackground(data.menuBackground || null);
      setThemeColor(data.themeColor || '#9B6DFF');
      setLoading(false);
    } catch (err) {
      console.warn('Error loading appearance:', err);
      setLoading(false);
    }
  };

  const pickImage = useCallback(async (setter) => {
    try {
      const { status } = await requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is required.');
        return;
      }
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const safeUri = await normalizeBlobUri(result.assets[0].uri);
        setter(safeUri);
        // Auto-save
        saveImageField(safeUri, setter);
      }
    } catch (e) {
      console.warn('ImagePicker error', e);
    }
  }, [communityId]);

  const saveImageField = async (localUri, setter) => {
    setSaving(true);
    try {
      let fieldName = '';
      let folder = '';
      if (setter === setBackgroundImage) {
        fieldName = 'backgroundImage';
        folder = 'community_backgrounds';
      } else if (setter === setHomeTabBackground) {
        fieldName = 'homeTabBackground';
        folder = 'community_backgrounds';
      }

      if (fieldName && localUri) {
        const uploadResult = await uploadImageToHostinger(localUri, folder);
        const url = typeof uploadResult === 'string' ? uploadResult : (uploadResult?.secure_url || uploadResult?.url);
        if (url) {
          const ref = doc(db, 'communities', communityId);
          await updateDoc(ref, { [fieldName]: url, updatedAt: serverTimestamp() });
          if (setter === setBackgroundImage) setBackgroundImageUrl(url);
          if (setter === setHomeTabBackground) setHomeTabBackgroundUrl(url);
        }
      }
    } catch (err) {
      console.warn('Save error:', err);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const saveThemeColor = async (color) => {
    setThemeColor(color);
    setShowColorModal(false);
    try {
      const ref = doc(db, 'communities', communityId);
      await updateDoc(ref, { themeColor: color, updatedAt: serverTimestamp() });
    } catch (err) {
      console.warn('Save theme color error:', err);
    }
  };

  const saveMenuBackground = async (preset) => {
    setMenuBackground(preset.id);
    try {
      const ref = doc(db, 'communities', communityId);
      await updateDoc(ref, { menuBackground: preset.id, menuBackgroundColors: preset.colors, updatedAt: serverTimestamp() });
    } catch (err) {
      console.warn('Save menu bg error:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#06B6D4" />
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
        <Text style={styles.headerTitle}>Appearance</Text>
        <View style={{ width: 40 }} />
      </View>

      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color="#06B6D4" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Background Image */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => pickImage(setBackgroundImage)}
          activeOpacity={0.7}
        >
          <Text style={styles.settingLabel}>Background Image</Text>
          {backgroundImage || backgroundImageUrl ? (
            <Image
              source={{ uri: backgroundImage || backgroundImageUrl }}
              style={styles.thumbnailPreview}
            />
          ) : (
            <View style={styles.placeholderIcon}>
              <Ionicons name="image-outline" size={28} color="#555" />
            </View>
          )}
        </TouchableOpacity>

        {/* Home Tab Background */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => pickImage(setHomeTabBackground)}
          activeOpacity={0.7}
        >
          <Text style={styles.settingLabel}>Home Tab Background</Text>
          {homeTabBackground || homeTabBackgroundUrl ? (
            <Image
              source={{ uri: homeTabBackground || homeTabBackgroundUrl }}
              style={styles.thumbnailPreview}
            />
          ) : (
            <View style={styles.placeholderIcon}>
              <Ionicons name="image-outline" size={28} color="#555" />
            </View>
          )}
        </TouchableOpacity>

        {/* Menu Background */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Menu Background</Text>
          <View style={styles.colorPresetsRow}>
            {MENU_BG_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                onPress={() => saveMenuBackground(preset)}
                style={[
                  styles.menuBgCircle,
                  menuBackground === preset.id && styles.menuBgCircleActive,
                ]}
              >
                <View style={[styles.menuBgHalf, { backgroundColor: preset.colors[0], borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }]} />
                <View style={[styles.menuBgHalf, { backgroundColor: preset.colors[1], borderTopRightRadius: 14, borderBottomRightRadius: 14 }]} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addColorBtn}>
              <Ionicons name="add" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme Color */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowColorModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.settingLabel}>Theme Color</Text>
          <View style={[styles.themeColorPreview, { backgroundColor: themeColor }]} />
        </TouchableOpacity>
      </ScrollView>

      {/* Theme Color Modal */}
      <Modal
        visible={showColorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowColorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
                  onPress={() => saveThemeColor(color)}
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
  savingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#06B6D410',
    gap: 8,
  },
  savingText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  settingLabel: {
    color: '#06B6D4',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  thumbnailPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1a1c22',
  },
  placeholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  colorPresetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBgCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menuBgCircleActive: {
    borderColor: '#fff',
  },
  menuBgHalf: {
    flex: 1,
  },
  addColorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  themeColorPreview: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    padding: 0,
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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    justifyContent: 'space-between',
  },
  colorOption: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 14,
    margin: '1%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#fff',
  },
});
