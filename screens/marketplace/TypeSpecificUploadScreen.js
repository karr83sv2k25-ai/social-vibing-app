// screens/marketplace/TypeSpecificUploadScreen.js - Type-specific product upload
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getProductTypeConfig, validateProductAssets, getProductTypeCategories } from '../../config/productTypeConfig';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';

export default function TypeSpecificUploadScreen({ route, navigation }) {
  const { productType } = route.params;
  const config = getProductTypeConfig(productType);
  
  if (!config) {
    Alert.alert('Error', 'Invalid product type');
    navigation.goBack();
    return null;
  }
  
  // Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('diamonds');
  
  // Assets
  const [coverImage, setCoverImage] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [files, setFiles] = useState([]);
  
  // Type-specific metadata
  const [metadata, setMetadata] = useState({});
  
  const [uploading, setUploading] = useState(false);
  const categories = getProductTypeCategories(productType);
  
  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: config.assets.coverImage.aspectRatio || [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setCoverImage(result.assets[0].uri);
    }
  };
  
  const pickPreviewImages = async () => {
    if (previewImages.length >= config.assets.previewImages.max) {
      Alert.alert('Limit Reached', `Maximum ${config.assets.previewImages.max} preview images allowed`);
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    
    if (!result.canceled) {
      const newImages = result.assets.map(a => a.uri);
      const combined = [...previewImages, ...newImages];
      setPreviewImages(combined.slice(0, config.assets.previewImages.max));
    }
  };
  
  const pickFiles = async () => {
    const maxFiles = config.assets.files?.maxFiles;
    if (maxFiles && files.length >= maxFiles) {
      Alert.alert('Limit Reached', `Maximum ${maxFiles} files allowed`);
      return;
    }
    
    const result = await DocumentPicker.getDocumentAsync({
      type: config.assets.files?.types || '*/*',
      copyToCacheDirectory: true,
      multiple: true,
    });
    
    if (!result.canceled) {
      const newFiles = result.assets.map(file => ({
        uri: file.uri,
        name: file.name,
        size: file.size,
        type: file.mimeType,
      }));
      setFiles([...files, ...newFiles]);
    }
  };
  
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };
  
  const removePreviewImage = (index) => {
    setPreviewImages(previewImages.filter((_, i) => i !== index));
  };
  
  const updateMetadata = (key, value) => {
    setMetadata({ ...metadata, [key]: value });
  };
  
  const validateAndSubmit = async () => {
    // Basic validation
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a product title');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a product description');
      return;
    }
    
    if (!price || parseFloat(price) <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }
    
    // Asset validation
    const assetValidation = validateProductAssets(productType, {
      coverImage,
      previewImages,
      files,
    });
    
    if (!assetValidation.valid) {
      Alert.alert('Asset Requirements', assetValidation.errors.join('\n'));
      return;
    }
    
    // Metadata validation
    for (const [key, fieldConfig] of Object.entries(config.metadata || {})) {
      if (fieldConfig.required && !metadata[key]) {
        Alert.alert('Missing Information', `Please provide: ${key}`);
        return;
      }
    }
    
    // Navigate to preview/publish screen
    navigation.navigate('ProductPublish', {
      productType,
      data: {
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'General',
        price: parseFloat(price),
        currency,
        coverImage,
        previewImages,
        files,
        metadata,
      },
    });
  };
  
  const renderMetadataField = (key, fieldConfig) => {
    const value = metadata[key];
    
    switch (fieldConfig.type) {
      case 'select':
        return (
          <View key={key} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {key.replace(/([A-Z])/g, ' $1').trim()} {fieldConfig.required && '*'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {fieldConfig.options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionChip,
                    value === option && { backgroundColor: ACCENT, borderColor: ACCENT },
                  ]}
                  onPress={() => updateMetadata(key, option)}
                >
                  <Text style={[styles.optionText, value === option && { color: '#FFF' }]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      
      case 'boolean':
        return (
          <TouchableOpacity
            key={key}
            style={styles.booleanField}
            onPress={() => updateMetadata(key, !value)}
          >
            <View style={styles.booleanLeft}>
              <Text style={styles.label}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
            </View>
            <View style={[styles.checkbox, value && styles.checkboxActive]}>
              {value && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </View>
          </TouchableOpacity>
        );
      
      case 'number':
        return (
          <View key={key} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {key.replace(/([A-Z])/g, ' $1').trim()} {fieldConfig.required && '*'}
              {fieldConfig.unit && ` (${fieldConfig.unit})`}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`${fieldConfig.min || 0} - ${fieldConfig.max || '∞'}`}
              placeholderTextColor="#666"
              value={value?.toString() || ''}
              onChangeText={(text) => updateMetadata(key, parseInt(text) || 0)}
              keyboardType="number-pad"
            />
          </View>
        );
      
      case 'text':
        return (
          <View key={key} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {key.replace(/([A-Z])/g, ' $1').trim()} {fieldConfig.required && '*'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={fieldConfig.placeholder || ''}
              placeholderTextColor="#666"
              value={value || ''}
              onChangeText={(text) => updateMetadata(key, text)}
            />
          </View>
        );
      
      case 'color':
        return (
          <View key={key} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {key.replace(/([A-Z])/g, ' $1').trim()} {fieldConfig.required && '*'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="#RRGGBB"
              placeholderTextColor="#666"
              value={value || ''}
              onChangeText={(text) => updateMetadata(key, text)}
              autoCapitalize="none"
            />
          </View>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={config.icon} size={24} color={config.color} />
          <Text style={styles.headerTitle}>{config.name}</Text>
        </View>
        <TouchableOpacity onPress={validateAndSubmit}>
          <Text style={styles.nextText}>Next</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Product Type Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 What you're creating</Text>
          <Text style={styles.infoDesc}>{config.description}</Text>
        </View>
        
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Text style={styles.label}>Product Title *</Text>
          <TextInput
            style={styles.input}
            placeholder={`e.g., Premium ${config.name}`}
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
          
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  category === cat && { backgroundColor: ACCENT, borderColor: ACCENT },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && { color: '#FFF' }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your product in detail..."
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            maxLength={1000}
          />
        </View>
        
        {/* Asset Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assets</Text>
          
          {/* Cover Image */}
          <Text style={styles.label}>Cover Image *</Text>
          <Text style={styles.hint}>{config.assets.coverImage.aspectRatio ? `Aspect ratio: ${config.assets.coverImage.aspectRatio.join(':')}` : 'Any aspect ratio'}</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={pickCoverImage}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverPreview} />
            ) : (
              <>
                <Ionicons name="image-outline" size={40} color="#666" />
                <Text style={styles.uploadText}>Tap to upload cover</Text>
              </>
            )}
          </TouchableOpacity>
          
          {/* Preview Images */}
          <Text style={styles.label}>
            Preview Images ({previewImages.length}/{config.assets.previewImages.max})
          </Text>
          <Text style={styles.hint}>
            Show your product from different angles or in use
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
            {previewImages.map((img, idx) => (
              <View key={idx} style={styles.previewImageContainer}>
                <Image source={{ uri: img }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removePreviewImage(idx)}
                >
                  <Ionicons name="close-circle" size={24} color="#F87171" />
                </TouchableOpacity>
              </View>
            ))}
            {previewImages.length < config.assets.previewImages.max && (
              <TouchableOpacity style={styles.addPreviewBtn} onPress={pickPreviewImages}>
                <Ionicons name="add" size={32} color="#666" />
              </TouchableOpacity>
            )}
          </ScrollView>
          
          {/* Product Files */}
          {config.assets.files && (
            <>
              <Text style={styles.label}>
                Product Files {config.assets.files.required && '*'}
              </Text>
              <Text style={styles.hint}>{config.assets.files.description}</Text>
              
              {files.map((file, idx) => (
                <View key={idx} style={styles.fileItem}>
                  <Ionicons name="document" size={20} color={config.color} />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFile(idx)}>
                    <Ionicons name="trash-outline" size={20} color="#F87171" />
                  </TouchableOpacity>
                </View>
              ))}
              
              <TouchableOpacity style={styles.uploadBtn} onPress={pickFiles}>
                <Ionicons name="cloud-upload-outline" size={20} color={config.color} />
                <Text style={[styles.uploadBtnText, { color: config.color }]}>
                  Upload Files
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        
        {/* Type-Specific Metadata */}
        {config.metadata && Object.keys(config.metadata).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            {Object.entries(config.metadata).map(([key, fieldConfig]) =>
              renderMetadataField(key, fieldConfig)
            )}
          </View>
        )}
        
        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          
          <Text style={styles.label}>Currency</Text>
          <View style={styles.currencyRow}>
            <TouchableOpacity
              style={[styles.currencyBtn, currency === 'coins' && styles.currencyBtnActive]}
              onPress={() => setCurrency('coins')}
            >
              <Ionicons name="logo-usd" size={20} color={currency === 'coins' ? '#FFF' : '#666'} />
              <Text style={[styles.currencyText, currency === 'coins' && { color: '#FFF' }]}>
                Coins
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.currencyBtn, currency === 'diamonds' && styles.currencyBtnActive]}
              onPress={() => setCurrency('diamonds')}
            >
              <Ionicons name="diamond" size={20} color={currency === 'diamonds' ? '#FFF' : '#666'} />
              <Text style={[styles.currencyText, currency === 'diamonds' && { color: '#FFF' }]}>
                Diamonds
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Price *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter price"
            placeholderTextColor="#666"
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>You'll earn 70% after platform fees</Text>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },
  nextText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
  
  scrollView: { flex: 1 },
  
  infoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  infoTitle: { color: TEXT, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  infoDesc: { color: TEXT_DIM, fontSize: 14, lineHeight: 20 },
  
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  
  label: { color: TEXT, fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  hint: { color: TEXT_DIM, fontSize: 12, marginBottom: 8 },
  
  input: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 12,
    color: TEXT,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  
  categoryScroll: { marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#23232A',
    marginRight: 8,
  },
  categoryText: { color: TEXT_DIM, fontSize: 13, fontWeight: '600' },
  
  uploadBox: {
    height: 180,
    backgroundColor: CARD,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#23232A',
    borderStyle: 'dashed',
  },
  coverPreview: { width: '100%', height: '100%', borderRadius: 12 },
  uploadText: { color: TEXT_DIM, fontSize: 14, marginTop: 8 },
  
  previewScroll: { marginBottom: 16 },
  previewImageContainer: { marginRight: 12, position: 'relative' },
  previewImage: { width: 120, height: 120, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -8, right: -8 },
  addPreviewBtn: {
    width: 120,
    height: 120,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#23232A',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: CARD,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#23232A',
  },
  fileInfo: { flex: 1, marginLeft: 12 },
  fileName: { color: TEXT, fontSize: 14, fontWeight: '600' },
  fileSize: { color: TEXT_DIM, fontSize: 12, marginTop: 2 },
  
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#23232A',
    borderStyle: 'dashed',
  },
  uploadBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '600' },
  
  fieldContainer: { marginBottom: 16 },
  optionsScroll: { marginBottom: 8 },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#23232A',
    marginRight: 8,
  },
  optionText: { color: TEXT_DIM, fontSize: 13, fontWeight: '600' },
  
  booleanField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#23232A',
    marginBottom: 12,
  },
  booleanLeft: { flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  
  currencyRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  currencyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#23232A',
    gap: 8,
  },
  currencyBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  currencyText: { color: TEXT_DIM, fontSize: 14, fontWeight: '600' },
});
