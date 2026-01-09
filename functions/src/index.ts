/**
 * Firebase Cloud Functions for Marketplace
 * Secure server-side purchase logic
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ==================== BUY PRODUCT ====================

interface BuyProductData {
  productId: string;
}

export const buyProduct = functions.https.onCall(async (data: BuyProductData, context) => {
  // 1. Verify Authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { productId } = data;

  if (!productId) {
    throw new functions.https.HttpsError('invalid-argument', 'productId is required');
  }

  try {
    // Use Firestore transaction for atomic operations
    const result = await db.runTransaction(async (transaction) => {
      // 2. Read User Document
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data()!;
      const wallet = userData.wallet || { coins: 0, diamonds: 0 };
      const ownedProducts = userData.ownedProducts || [];

      // 3. Check if already owned
      if (ownedProducts.includes(productId)) {
        throw new functions.https.HttpsError('already-exists', 'Product already owned');
      }

      // 4. Read Product Document
      const productRef = db.collection('products').doc(productId);
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Product not found');
      }

      const product = productDoc.data()!;

      if (product.status !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'Product is not available');
      }

      const price = product.price || 0;
      const currency = product.currency || 'coins';

      // 5. Check if user has enough balance
      if (currency === 'coins' && wallet.coins < price) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Insufficient coins. Required: ${price}, Available: ${wallet.coins}`
        );
      }

      if (currency === 'diamonds' && wallet.diamonds < price) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Insufficient diamonds. Required: ${price}, Available: ${wallet.diamonds}`
        );
      }

      // 6. Create Order Document
      const orderRef = db.collection('orders').doc();
      const orderData = {
        orderId: orderRef.id,
        userId,
        productId,
        productType: product.type,
        price,
        currency,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(orderRef, orderData);

      // 7. Deduct coins/diamonds from user
      const newWallet = { ...wallet };
      if (currency === 'coins') {
        newWallet.coins -= price;
      } else {
        newWallet.diamonds -= price;
      }

      // 8. Add product to user's owned items
      transaction.update(userRef, {
        wallet: newWallet,
        ownedProducts: FieldValue.arrayUnion(productId),
      });

      // 9. Update product stats (purchase count)
      transaction.update(productRef, {
        'stats.purchaseCount': FieldValue.increment(1),
        'stats.downloads': FieldValue.increment(1),
      });

      // 10. Update user's library (organized by type)
      const libraryRef = db.collection('libraries').doc(userId);
      const libraryUpdate: any = {
        userId,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Add to appropriate category
      const productType = product.type;
      if (productType === 'comic') {
        libraryUpdate.comics = FieldValue.arrayUnion(productId);
      } else if (productType === 'book') {
        libraryUpdate.books = FieldValue.arrayUnion(productId);
      } else if (productType === 'art') {
        libraryUpdate.art = FieldValue.arrayUnion(productId);
      } else if (productType === 'sticker_pack') {
        libraryUpdate.stickerPacks = FieldValue.arrayUnion(productId);
      } else if (productType === 'profile_frame') {
        libraryUpdate.profileFrames = FieldValue.arrayUnion(productId);
      } else if (productType === 'chat_bubble') {
        libraryUpdate.chatBubbles = FieldValue.arrayUnion(productId);
      }

      transaction.set(libraryRef, libraryUpdate, { merge: true });

      return {
        success: true,
        orderId: orderRef.id,
        newCoinBalance: newWallet.coins,
        newDiamondBalance: newWallet.diamonds,
        message: 'Purchase successful!',
      };
    });

    return result;
  } catch (error: any) {
    console.error('Purchase error:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Purchase failed');
  }
});

// ==================== CREDIT COINS (After IAP) ====================

interface CreditCoinsData {
  amount: number;
  purchaseToken: string;
  platform: 'android' | 'ios';
}

export const creditCoinsAfterIAP = functions.https.onCall(
  async (data: CreditCoinsData, context) => {
    // 1. Verify Authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { amount, purchaseToken, platform } = data;

    if (!amount || amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid amount');
    }

    if (!purchaseToken) {
      throw new functions.https.HttpsError('invalid-argument', 'Purchase token required');
    }

    try {
      // TODO: In production, verify the purchase token with Google/Apple servers
      // For now, we'll trust the client (NOT recommended for production)
      
      // Check if this purchase token was already used
      const iapRef = db.collection('iap_transactions').doc(purchaseToken);
      const iapDoc = await iapRef.get();

      if (iapDoc.exists) {
        throw new functions.https.HttpsError('already-exists', 'Purchase token already used');
      }

      // Use transaction to credit coins atomically
      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const userData = userDoc.data()!;
        const wallet = userData.wallet || { coins: 0, diamonds: 0 };

        // Credit coins
        const newWallet = {
          ...wallet,
          coins: wallet.coins + amount,
        };

        transaction.update(userRef, { wallet: newWallet });

        // Record IAP transaction
        transaction.set(iapRef, {
          userId,
          amount,
          platform,
          purchaseToken,
          status: 'completed',
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          newBalance: newWallet.coins,
          message: `${amount} coins credited successfully!`,
        };
      });

      return result;
    } catch (error: any) {
      console.error('Credit coins error:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', error.message || 'Failed to credit coins');
    }
  }
);

// ==================== GET USER LIBRARY ====================

export const getUserLibrary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    const libraryDoc = await db.collection('libraries').doc(userId).get();

    if (!libraryDoc.exists) {
      return {
        comics: [],
        books: [],
        art: [],
        stickerPacks: [],
        profileFrames: [],
        chatBubbles: [],
      };
    }

    return libraryDoc.data();
  } catch (error: any) {
    console.error('Get library error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get library');
  }
});

// ==================== SET ACTIVE CUSTOMIZATION ====================

interface SetCustomizationData {
  type: 'profileFrame' | 'chatBubble';
  productId: string | null; // null to remove
}

export const setActiveCustomization = functions.https.onCall(
  async (data: SetCustomizationData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { type, productId } = data;

    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data()!;
      const ownedProducts = userData.ownedProducts || [];

      // If setting a productId, verify user owns it
      if (productId && !ownedProducts.includes(productId)) {
        throw new functions.https.HttpsError('permission-denied', 'Product not owned');
      }

      const updateData: any = {};

      if (type === 'profileFrame') {
        updateData['activeCustomizations.profileFrameId'] = productId;
      } else if (type === 'chatBubble') {
        updateData['activeCustomizations.chatBubbleThemeId'] = productId;
      }

      await userRef.update(updateData);

      return {
        success: true,
        message: 'Customization updated',
      };
    } catch (error: any) {
      console.error('Set customization error:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to set customization');
    }
  }
);
