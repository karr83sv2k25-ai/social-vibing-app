// screens/marketplace/ProductPublishScreen.js - Final review and publish
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProductTypeConfig } from '../../config/productTypeConfig';
import { db, auth, storage } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { normalizeBlobUri } from '../../utils/normalizeUri';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';
const GREEN = '#10B981';

export default function ProductPublishScreen({ route, navigation }) {
  const { productType, data } = route.params;
  const config = getProductTypeConfig(productType);
  
  const [publishing, setPublishing] = useState(false);
  
  if (!config || !data) {
    Alert.alert('Error', 'Invalid product data');
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    return null;
  }
  
  const uploadFile = async (uri, folder) => {
    try {
      // Normalize blob: URIs before passing to native fetch
      const safeUri = await normalizeBlobUri(uri);
      const response = await fetch(safeUri);
      const blob = await response.blob();
      const filename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      
      return url;
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error('Failed to upload file');
    }
  };
  
  const handlePublish = async () => {
    try {
      setPublishing(true);
      
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please sign in to publish products');
        return;
      }
      
      // Upload cover image
      console.log('Uploading cover image...');
      const coverImageUrl = await uploadFile(data.coverImage, 'products/covers');
      
      // Upload preview images
      console.log('Uploading preview images...');
      const previewImageUrls = await Promise.all(
        data.previewImages.map(img => uploadFile(img, 'products/previews'))
      );
      
      // Upload asset files
      console.log('Uploading asset files...');
      const assetUploads = await Promise.all(
        (data.files || []).map(async (file) => {
          const url = await uploadFile(file.uri, 'products/assets');
          return {
            type: file.type?.includes('image') ? 'image' :
                  file.type?.includes('pdf') ? 'pdf' :
                  file.type?.includes('zip') ? 'zip' : 'file',
            url,
            fileName: file.name,
            size: file.size,
          };
        })
      );
      
      // Create product document
      console.log('Creating product document...');
      const productData = {
        type: productType,
        title: data.title,
        description: data.description,
        category: data.category,
        price: data.price,
        currency: data.currency,
        coverImage: coverImageUrl,
        previewImages: previewImageUrls,
        assets: assetUploads,
        metadata: data.metadata || {},
        
        // Seller info
        sellerId: user.uid,
        creatorId: user.uid,
        creatorName: user.displayName || 'Creator',
        
        // Status
        status: 'published',
        visibility: 'public',
        
        // Stats
        stats: {
          views: 0,
          purchases: 0,
          purchaseCount: 0,
          rating: 5.0,
          reviewCount: 0,
          favorites: 0,
        },
        
        // Timestamps
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const productsRef = collection(db, 'products');
      const docRef = await addDoc(productsRef, productData);
      
      console.log('Product published:', docRef.id);
      
      Alert.alert(
        'Success! 🎉',
        'Your product has been published successfully',
        [
          {
            text: 'View Product',
            onPress: () => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'MarketplaceTabs' },
                  { name: 'ProductDetail', params: { productId: docRef.id } },
                ],
              });
            },
          },
          {
            text: 'Create Another',
            onPress: () => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'MarketplaceTabs' },
                  { name: 'ProductTypeSelection' },
                ],
              });
            },
          },
          {
            text: 'Go to Dashboard',
            onPress: () => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'MarketplaceTabs' },
                  { name: 'SellerDashboard' },
                ],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to publish product:', error);
      Alert.alert('Error', `Failed to publish product: ${error.message}`);
    } finally {
      setPublishing(false);
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} disabled={publishing}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Publish</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Product Preview */}
        <View style={styles.previewCard}>
          <Image source={{ uri: data.coverImage }} style={styles.coverImage} />
          
          <View style={styles.productInfo}>
            <View style={styles.typeTag}>
              <Ionicons name={config.icon} size={16} color={config.color} />
              <Text style={[styles.typeText, { color: config.color }]}>{config.name}</Text>
            </View>
            
            <Text style={styles.productTitle}>{data.title}</Text>
            <Text style={styles.productCategory}>{data.category}</Text>
            <Text style={styles.productDesc} numberOfLines={3}>{data.description}</Text>
            
            <View style={styles.priceTag}>
              <Ionicons
                name={data.currency === 'diamonds' ? 'diamond' : 'logo-usd'}
                size={20}
                color={data.currency === 'diamonds' ? '#ff00ff' : '#08FFE2'}
              />
              <Text style={styles.priceText}>{data.price} {data.currency === 'coins' ? 'Coins' : 'Diamonds'}</Text>
            </View>
          </View>
        </View>
        
        {/* Preview Images */}
        {data.previewImages && data.previewImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview Images ({data.previewImages.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {data.previewImages.map((img, idx) => (
                <Image key={idx} source={{ uri: img }} style={styles.previewImage} />
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Assets */}
        {data.files && data.files.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Asset Files ({data.files.length})</Text>
            {data.files.map((file, idx) => (
              <View key={idx} style={styles.fileItem}>
                <Ionicons name="document" size={20} color={config.color} />
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* Metadata */}
        {data.metadata && Object.keys(data.metadata).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            {Object.entries(data.metadata).map(([key, value]) => (
              <View key={key} style={styles.metadataRow}>
                <Text style={styles.metadataKey}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </Text>
                <Text style={styles.metadataValue}>
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={ACCENT} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Publishing Info</Text>
            <Text style={styles.infoDesc}>
              • You'll earn 70% of the sale price{'\n'}
              • Product will appear in marketplace immediately{'\n'}
              • You can edit or remove it anytime from your dashboard
            </Text>
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Publish Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.publishBtn}
          onPress={handlePublish}
          disabled={publishing}
        >
          {publishing ? (
            <>
              <ActivityIndicator color="#FFF" />
              <Text style={styles.publishBtnText}>Publishing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#FFF" />
              <Text style={styles.publishBtnText}>Publish Product</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },
  
  scrollView: { flex: 1 },
  
  previewCard: {
    margin: 16,
    backgroundColor: CARD,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  coverImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  productInfo: {
    padding: 16,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    marginBottom: 12,
    gap: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  productCategory: {
    color: TEXT_DIM,
    fontSize: 13,
    marginBottom: 12,
  },
  productDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceText: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
  },
  
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
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
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },
  
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  metadataKey: {
    color: TEXT_DIM,
    fontSize: 14,
  },
  metadataValue: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23232A',
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoDesc: {
    color: TEXT_DIM,
    fontSize: 13,
    lineHeight: 20,
  },
  
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#23232A',
  },
  publishBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  publishBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
