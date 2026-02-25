// services/productUsageService.js - Service for applying and using purchased products
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

class ProductUsageService {
  /**
   * Apply a chat bubble theme to user's active customizations
   */
  async applyChatBubbleTheme(productId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Fetch product data
      const productRef = doc(db, 'products', productId);
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }
      
      const product = productDoc.data();
      
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
      
      return { success: true, message: 'Chat bubble theme applied successfully' };
    } catch (error) {
      console.error('Failed to apply chat bubble theme:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Apply a profile frame to user's active customizations
   */
  async applyProfileFrame(productId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Fetch product data
      const productRef = doc(db, 'products', productId);
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }
      
      const product = productDoc.data();
      const frameImage = product.assets && product.assets[0] 
        ? product.assets[0].url 
        : product.coverImage;
      
      // Update user's active customizations
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'activeCustomizations.profileFrameId': productId,
        'activeCustomizations.profileFrame': {
          productId,
          title: product.title,
          frameImage,
          metadata: product.metadata,
          appliedAt: new Date().toISOString(),
        },
      });
      
      return { success: true, message: 'Profile frame applied successfully' };
    } catch (error) {
      console.error('Failed to apply profile frame:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get user's active chat bubble theme
   */
  async getActiveChatBubbleTheme(userId = null) {
    try {
      const uid = userId || auth.currentUser?.uid;
      if (!uid) return null;

      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return null;
      
      const userData = userDoc.data();
      return userData.activeCustomizations?.chatBubbleTheme || null;
    } catch (error) {
      console.error('Failed to get active chat bubble theme:', error);
      return null;
    }
  }

  /**
   * Get user's active profile frame
   */
  async getActiveProfileFrame(userId = null) {
    try {
      const uid = userId || auth.currentUser?.uid;
      if (!uid) return null;

      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return null;
      
      const userData = userDoc.data();
      return userData.activeCustomizations?.profileFrame || null;
    } catch (error) {
      console.error('Failed to get active profile frame:', error);
      return null;
    }
  }

  /**
   * Remove active chat bubble theme
   */
  async removeChatBubbleTheme() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'activeCustomizations.chatBubbleThemeId': null,
        'activeCustomizations.chatBubbleTheme': null,
      });
      
      return { success: true, message: 'Chat bubble theme removed' };
    } catch (error) {
      console.error('Failed to remove chat bubble theme:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Remove active profile frame
   */
  async removeProfileFrame() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'activeCustomizations.profileFrameId': null,
        'activeCustomizations.profileFrame': null,
      });
      
      return { success: true, message: 'Profile frame removed' };
    } catch (error) {
      console.error('Failed to remove profile frame:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Check if user owns a specific product
   */
  async userOwnsProduct(productId, productType) {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      const libraryRef = doc(db, 'libraries', user.uid);
      const libraryDoc = await getDoc(libraryRef);
      
      if (!libraryDoc.exists()) return false;
      
      const libraryData = libraryDoc.data();
      
      // Map product type to library field
      const typeToFieldMap = {
        comic: 'comics',
        book: 'books',
        art: 'art',
        sticker_pack: 'stickerPacks',
        profile_frame: 'profileFrames',
        chat_bubble: 'chatBubbles',
      };
      
      const fieldName = typeToFieldMap[productType];
      if (!fieldName) return false;
      
      const items = libraryData[fieldName] || [];
      return items.includes(productId);
    } catch (error) {
      console.error('Failed to check product ownership:', error);
      return false;
    }
  }

  /**
   * Get all products in user's library by type
   */
  async getLibraryProducts(productType) {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      const libraryRef = doc(db, 'libraries', user.uid);
      const libraryDoc = await getDoc(libraryRef);
      
      if (!libraryDoc.exists()) return [];
      
      const libraryData = libraryDoc.data();
      
      // Map product type to library field
      const typeToFieldMap = {
        comic: 'comics',
        book: 'books',
        art: 'art',
        sticker_pack: 'stickerPacks',
        profile_frame: 'profileFrames',
        chat_bubble: 'chatBubbles',
      };
      
      const fieldName = typeToFieldMap[productType];
      if (!fieldName) return [];
      
      const productIds = libraryData[fieldName] || [];
      
      // Fetch product details
      const products = await Promise.all(
        productIds.map(async (id) => {
          const productRef = doc(db, 'products', id);
          const productDoc = await getDoc(productRef);
          if (productDoc.exists()) {
            return { id: productDoc.id, ...productDoc.data() };
          }
          return null;
        })
      );
      
      return products.filter(p => p !== null);
    } catch (error) {
      console.error('Failed to get library products:', error);
      return [];
    }
  }
}

export default new ProductUsageService();
