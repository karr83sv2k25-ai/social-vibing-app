/**
 * AttachmentPicker Component
 * 
 * Modal component for selecting attachment type (Camera, Gallery, Files)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Optional import for document picker
let DocumentPicker = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.log('DocumentPicker not available yet - app needs rebuild');
}

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export const AttachmentPicker = ({ visible, onClose, onImageSelected, onFileSelected }) => {
  
  const requestPermission = async (type) => {
    let permissionResult;
    
    if (type === 'camera') {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        `Please allow access to your ${type === 'camera' ? 'camera' : 'photo library'} to continue.`,
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Don't force cropping - send as-is
        quality: 0.5, // Reduced quality for faster upload and smaller size
        exif: false, // Don't include EXIF data to reduce size
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        onImageSelected(result.assets[0]);
        onClose();
      }
    } catch (error) {
      console.error('Error picking image from camera:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermission('library');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Don't force cropping - send as-is
        quality: 0.5, // Reduced quality for faster upload and smaller size
        exif: false, // Don't include EXIF data to reduce size
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        onImageSelected(result.assets[0]);
        onClose();
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickFromGalleryWithCrop = async () => {
    const hasPermission = await requestPermission('library');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Enable cropping
        aspect: [4, 3],
        quality: 0.6, // Slightly higher quality for cropped images
        exif: false, // Don't include EXIF data to reduce size
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        onImageSelected(result.assets[0]);
        onClose();
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleFileSelection = async () => {
    try {
      // Check if DocumentPicker is available
      if (!DocumentPicker || !DocumentPicker.getDocumentAsync) {
        Alert.alert(
          'Feature Not Available',
          'File picker requires app rebuild. Please run: npx expo run:android\n\nFor now, you can only send images.',
          [{ text: 'OK' }]
        );
        onClose();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        
        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Please select a file smaller than 50MB.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        onFileSelected(file);
        onClose();
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View 
          style={styles.container}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Send Attachment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.options}>
            <TouchableOpacity
              style={styles.option}
              onPress={pickFromCamera}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#3B82F6' + '33' }]}>
                <Ionicons name="camera" size={28} color="#3B82F6" />
              </View>
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={pickFromGallery}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#10B981' + '33' }]}>
                <Ionicons name="images" size={28} color="#10B981" />
              </View>
              <Text style={styles.optionText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={pickFromGalleryWithCrop}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#F59E0B' + '33' }]}>
                <Ionicons name="crop" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.optionText}>Crop Image</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: CARD,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  option: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AttachmentPicker;
