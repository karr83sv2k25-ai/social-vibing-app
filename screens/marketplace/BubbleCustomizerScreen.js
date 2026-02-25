// screens/marketplace/BubbleCustomizerScreen.js - Chat bubble customizer
import React, { useState, useEffect } from 'react';
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
import { db, auth } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';

export default function BubbleCustomizerScreen({ route, navigation }) {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('sent');
  
  useEffect(() => {
    fetchProduct();
  }, [productId]);
  
  const fetchProduct = async () => {
    try {
      const productRef = doc(db, 'products', productId);
      const productDoc = await getDoc(productRef);
      
      if (productDoc.exists()) {
        setProduct({ id: productDoc.id, ...productDoc.data() });
      } else {
        Alert.alert('Error', 'Product not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };
  
  const applyBubbleTheme = async () => {
    try {
      setApplying(true);
      
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please sign in to apply this theme');
        return;
      }
      
      // Update user's active customizations
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'activeCustomizations.chatBubbleThemeId': productId,
        'activeCustomizations.chatBubbleTheme': {
          productId,
          title: product.title,
          coverImage: product.coverImage,
          assets: product.assets,
          metadata: product.metadata,
          appliedAt: new Date().toISOString(),
        },
      });
      
      Alert.alert(
        'Success! 🎉',
        'Chat bubble theme applied successfully',
        [
          { text: 'Go to Chats', onPress: () => navigation.navigate('Messages') },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      console.error('Failed to apply theme:', error);
      Alert.alert('Error', 'Failed to apply theme');
    } finally {
      setApplying(false);
    }
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }
  
  if (!product) return null;
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Bubble Preview</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Info */}
        <View style={styles.productInfo}>
          <Image source={{ uri: product.coverImage }} style={styles.coverImage} />
          <Text style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.productDesc}>
            {product.metadata?.bubbleStyle} • {product.metadata?.hasAnimation ? 'Animated' : 'Static'}
          </Text>
        </View>
        
        {/* Preview Toggle */}
        <View style={styles.previewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, previewMessage === 'sent' && styles.toggleBtnActive]}
            onPress={() => setPreviewMessage('sent')}
          >
            <Text style={[styles.toggleText, previewMessage === 'sent' && styles.toggleTextActive]}>
              Sent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, previewMessage === 'received' && styles.toggleBtnActive]}
            onPress={() => setPreviewMessage('received')}
          >
            <Text style={[styles.toggleText, previewMessage === 'received' && styles.toggleTextActive]}>
              Received
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Chat Preview */}
        <View style={styles.chatPreview}>
          <Text style={styles.previewLabel}>Preview</Text>
          
          {/* Mock chat messages */}
          <View style={styles.chatContainer}>
            {/* Received message */}
            <View style={styles.messageRow}>
              <View style={styles.receivedBubble}>
                <Text style={styles.messageText}>Hey! How are you? 👋</Text>
              </View>
            </View>
            
            {/* Sent message */}
            <View style={[styles.messageRow, styles.messageRowRight]}>
              <View style={styles.sentBubble}>
                <Text style={styles.messageText}>Good! Just checking out this cool bubble theme</Text>
              </View>
            </View>
            
            {/* Received message */}
            <View style={styles.messageRow}>
              <View style={styles.receivedBubble}>
                <Text style={styles.messageText}>Looks awesome! 😍</Text>
              </View>
            </View>
            
            {/* Sent message */}
            <View style={[styles.messageRow, styles.messageRowRight]}>
              <View style={styles.sentBubble}>
                <Text style={styles.messageText}>Thanks! Want to try it?</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Asset Gallery */}
        {product.assets && product.assets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Included Assets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {product.assets.map((asset, idx) => (
                <View key={idx} style={styles.assetCard}>
                  {asset.type === 'image' && asset.url ? (
                    <Image source={{ uri: asset.url }} style={styles.assetImage} />
                  ) : (
                    <View style={styles.assetPlaceholder}>
                      <Ionicons name="document" size={32} color={TEXT_DIM} />
                    </View>
                  )}
                  <Text style={styles.assetName} numberOfLines={1}>{asset.fileName || `Asset ${idx + 1}`}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          {product.metadata?.hasAnimation && (
            <View style={styles.featureItem}>
              <Ionicons name="play-circle" size={20} color={ACCENT} />
              <Text style={styles.featureText}>Smooth animations</Text>
            </View>
          )}
          <View style={styles.featureItem}>
            <Ionicons name="color-palette" size={20} color={ACCENT} />
            <Text style={styles.featureText}>Custom color scheme</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
            <Text style={styles.featureText}>Works in all chats</Text>
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Apply Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={applyBubbleTheme}
          disabled={applying}
        >
          {applying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.applyBtnText}>Apply Theme</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { justifyContent: 'center', alignItems: 'center' },
  
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
  
  productInfo: {
    padding: 16,
    alignItems: 'center',
  },
  coverImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginBottom: 12,
  },
  productTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  productDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
  },
  
  previewToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: { backgroundColor: ACCENT },
  toggleText: { color: TEXT_DIM, fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#FFF' },
  
  chatPreview: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  previewLabel: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  chatContainer: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    minHeight: 300,
  },
  messageRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageRowRight: {
    alignItems: 'flex-end',
  },
  receivedBubble: {
    backgroundColor: '#2A2A32',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '75%',
  },
  sentBubble: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: '75%',
  },
  messageText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  
  assetCard: {
    width: 100,
    marginRight: 12,
  },
  assetImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
  },
  assetPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  assetName: {
    color: TEXT_DIM,
    fontSize: 12,
    textAlign: 'center',
  },
  
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureText: {
    color: TEXT,
    fontSize: 14,
    marginLeft: 12,
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
  applyBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
