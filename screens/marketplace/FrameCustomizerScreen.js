// screens/marketplace/FrameCustomizerScreen.js - Profile frame customizer
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

export default function FrameCustomizerScreen({ route, navigation }) {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  
  useEffect(() => {
    fetchProduct();
    fetchUserAvatar();
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
  
  const fetchUserAvatar = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserAvatar(userData.profileImage || userData.avatar || null);
      }
    } catch (error) {
      console.error('Failed to fetch user avatar:', error);
    }
  };
  
  const applyFrame = async () => {
    try {
      setApplying(true);
      
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please sign in to apply this frame');
        return;
      }
      
      // Update user's active customizations
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'activeCustomizations.profileFrameId': productId,
        'activeCustomizations.profileFrame': {
          productId,
          title: product.title,
          frameImage: product.assets[0]?.url || product.coverImage,
          metadata: product.metadata,
          appliedAt: new Date().toISOString(),
        },
      });
      
      Alert.alert(
        'Success! 🎉',
        'Profile frame applied successfully',
        [
          { text: 'View Profile', onPress: () => navigation.navigate('Profile') },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      console.error('Failed to apply frame:', error);
      Alert.alert('Error', 'Failed to apply frame');
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
  
  const frameImage = product.assets && product.assets[0] ? product.assets[0].url : product.coverImage;
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Frame Preview</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Live Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Your Preview</Text>
          <View style={styles.profilePreview}>
            {/* Avatar with frame overlay */}
            <View style={styles.avatarContainer}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={80} color={TEXT_DIM} />
                </View>
              )}
              <Image source={{ uri: frameImage }} style={styles.frameOverlay} />
            </View>
          </View>
        </View>
        
        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.productDesc}>
            {product.metadata?.frameStyle} • {product.metadata?.isAnimated ? 'Animated' : 'Static'}
            {product.metadata?.season && product.metadata.season !== 'none' && ` • ${product.metadata.season}`}
          </Text>
        </View>
        
        {/* Preview Images */}
        {product.previewImages && product.previewImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More Examples</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {product.previewImages.map((img, idx) => (
                <Image key={idx} source={{ uri: img }} style={styles.exampleImage} />
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          {product.metadata?.isAnimated && (
            <View style={styles.featureItem}>
              <Ionicons name="play-circle" size={20} color={ACCENT} />
              <Text style={styles.featureText}>Animated frame</Text>
            </View>
          )}
          <View style={styles.featureItem}>
            <Ionicons name="image" size={20} color={ACCENT} />
            <Text style={styles.featureText}>High quality PNG</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
            <Text style={styles.featureText}>Visible on all posts & comments</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="swap-horizontal" size={20} color={ACCENT} />
            <Text style={styles.featureText}>Switch anytime</Text>
          </View>
        </View>
        
        {/* Description */}
        {product.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Apply Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={applyFrame}
          disabled={applying}
        >
          {applying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.applyBtnText}>Apply Frame</Text>
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
  
  previewSection: {
    padding: 16,
    alignItems: 'center',
  },
  profilePreview: {
    marginTop: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    position: 'absolute',
  },
  avatarPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  frameOverlay: {
    width: 200,
    height: 200,
    position: 'absolute',
  },
  
  productInfo: {
    paddingHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  productTitle: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  productDesc: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
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
  
  exampleImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
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
  
  description: {
    color: TEXT_DIM,
    fontSize: 14,
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
