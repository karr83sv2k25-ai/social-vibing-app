# 🎯 Social Vibing Marketplace - End-to-End Implementation Plan

**Project**: Social Vibing App Marketplace  
**Status**: Phase 1 In Progress → Production Hardening Required  
**Priority**: Security First → Features Second  
**Timeline**: 2-3 weeks for production-ready implementation  

---

## 📊 Current Status Assessment

### ✅ COMPLETED (Phase 1)
- [x] Marketplace UI screens (main, explore, detail)
- [x] 6 product types defined (comics, books, art, stickers, frames, bubbles)
- [x] Product browsing with filters
- [x] Search functionality
- [x] Wallet UI integration
- [x] Library screens foundation
- [x] Sample data initialization script
- [x] Basic navigation structure

### ⚠️ CRITICAL SECURITY ISSUES
- [ ] **CLIENT-SIDE PURCHASE LOGIC** - Users can manipulate wallet directly
- [ ] **NO TRANSACTION ATOMICITY** - Partial failures can cause data inconsistency
- [ ] **MISSING CLOUD FUNCTIONS** - All business logic on client (hackable)
- [ ] **INCOMPLETE FIRESTORE RULES** - Wallet not fully protected

### 🚧 MISSING CORE FEATURES
- [ ] Server-side purchase validation
- [ ] IAP (In-App Purchase) integration
- [ ] Product content viewers (readers, customizers)
- [ ] Active customization system (frames/bubbles)
- [ ] Creator earnings distribution
- [ ] Transaction history
- [ ] Download management

---

## 🏗️ Implementation Architecture

### **Tech Stack (Current)**
- **Frontend**: React Native 0.81.5, Expo SDK 54
- **Backend**: Firebase Firestore, Cloud Functions
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage (planned for images/files)
- **Payments**: Not yet implemented (needs react-native-iap)

### **New Architecture Compliance** ✅
- ✅ Using React Native 0.81.5 (New Architecture enabled by default)
- ✅ React 19.1.0 (propTypes removed - use TypeScript)
- ✅ Expo SDK 54 (latest stable)
- ⚠️ Must migrate to TypeScript for type safety
- ⚠️ Remove any `forwardRef` usage (deprecated in React 19)

---

## 🎯 PHASE 2: SECURITY & CLOUD FUNCTIONS (PRIORITY 1)
**Timeline**: Week 1 (3-5 days)  
**Blocking**: All other features depend on this

### **2.1 Cloud Functions Setup**

**Location**: `/functions/index.js`

#### **Function 1: buyProduct** (CRITICAL)
**Purpose**: Secure server-side product purchase with atomic transaction

```javascript
// functions/index.js
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');

exports.buyProduct = functions.https.onCall(async (data, context) => {
  // 1. Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const { productId } = data;
  const userId = context.auth.uid;

  // 2. Firestore transaction (atomic operation)
  return admin.firestore().runTransaction(async (transaction) => {
    const userRef = admin.firestore().doc(`users/${userId}`);
    const productRef = admin.firestore().doc(`products/${productId}`);
    const libraryRef = admin.firestore().doc(`libraries/${userId}`);
    
    const [userDoc, productDoc, libraryDoc] = await transaction.getAll(
      userRef, productRef, libraryRef
    );

    // 3. Validation
    if (!productDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Product not found');
    }

    const product = productDoc.data();
    const user = userDoc.data();
    
    if (product.status !== 'active') {
      throw new functions.https.HttpsError('failed-precondition', 'Product not available');
    }

    // Check ownership
    const ownedProducts = user.ownedProducts || [];
    if (ownedProducts.includes(productId)) {
      throw new functions.https.HttpsError('already-exists', 'You already own this product');
    }

    // Check balance
    const currency = product.currency || 'coins';
    const balance = currency === 'coins' ? user.coins : user.diamonds;
    
    if (balance < product.price) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Insufficient ${currency}. Need ${product.price}, have ${balance}`
      );
    }

    // 4. Execute transaction
    const orderId = admin.firestore().collection('orders').doc().id;
    const orderRef = admin.firestore().doc(`orders/${orderId}`);
    
    const walletField = currency === 'coins' ? 'coins' : 'diamonds';
    
    // Deduct currency
    transaction.update(userRef, {
      [walletField]: admin.firestore.FieldValue.increment(-product.price),
      ownedProducts: admin.firestore.FieldValue.arrayUnion(productId)
    });

    // Add to library
    const typeToFieldMap = {
      comic: 'comics',
      book: 'books',
      art: 'art',
      sticker_pack: 'stickerPacks',
      profile_frame: 'profileFrames',
      chat_bubble: 'chatBubbles'
    };
    const fieldName = typeToFieldMap[product.type];
    
    if (libraryDoc.exists()) {
      transaction.update(libraryRef, {
        [fieldName]: admin.firestore.FieldValue.arrayUnion(productId)
      });
    } else {
      transaction.set(libraryRef, {
        userId,
        [fieldName]: [productId],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Create order record
    transaction.set(orderRef, {
      orderId,
      userId,
      productId,
      productTitle: product.title,
      amount: product.price,
      currency,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update product stats
    transaction.update(productRef, {
      'stats.purchaseCount': admin.firestore.FieldValue.increment(1)
    });

    // Credit creator (if not official product)
    if (!product.isOfficial && product.creatorId) {
      const creatorRef = admin.firestore().doc(`users/${product.creatorId}`);
      const creatorShare = Math.floor(product.price * 0.7); // 70% to creator
      
      transaction.update(creatorRef, {
        earningsBalance: admin.firestore.FieldValue.increment(creatorShare)
      });
    }

    return {
      success: true,
      orderId,
      message: 'Purchase successful!',
      newBalance: balance - product.price
    };
  });
});
```

**Implementation Steps:**
1. ✅ Add function to `/functions/index.js`
2. ✅ Deploy: `cd functions && firebase deploy --only functions:buyProduct`
3. ✅ Update client to use `httpsCallable('buyProduct')`
4. ✅ Test with Firestore emulator first
5. ✅ Test error cases (insufficient funds, duplicate purchase, etc.)

---

#### **Function 2: creditCoinsAfterIAP**
**Purpose**: Verify in-app purchases and credit coins securely

```javascript
exports.creditCoinsAfterIAP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const { amount, purchaseToken, platform, productId } = data;
  const userId = context.auth.uid;

  // TODO: Verify purchase token with Google/Apple API
  // For now, basic validation
  
  if (!purchaseToken || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid purchase data');
  }

  // Check if token already used (prevent replay attacks)
  const txnRef = admin.firestore().collection('iap_transactions');
  const existing = await txnRef.where('purchaseToken', '==', purchaseToken).get();
  
  if (!existing.empty) {
    throw new functions.https.HttpsError('already-exists', 'Purchase already processed');
  }

  // Credit coins in transaction
  return admin.firestore().runTransaction(async (transaction) => {
    const userRef = admin.firestore().doc(`users/${userId}`);
    const txnId = txnRef.doc().id;
    
    transaction.update(userRef, {
      coins: admin.firestore.FieldValue.increment(amount)
    });

    transaction.set(txnRef.doc(txnId), {
      transactionId: txnId,
      userId,
      amount,
      purchaseToken,
      platform,
      productId,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, amount };
  });
});
```

**IAP Integration Steps:**
1. ⚠️ Install `react-native-iap`: `npx expo install react-native-iap`
2. ⚠️ Configure App Store Connect / Google Play Console products
3. ⚠️ Implement purchase flow in `CoinPurchaseScreen`
4. ⚠️ Add receipt validation (Google/Apple APIs)
5. ⚠️ Test in sandbox/test mode

---

#### **Function 3: setActiveCustomization**
**Purpose**: Allow users to activate purchased frames/bubbles

```javascript
exports.setActiveCustomization = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const { type, productId } = data; // type: 'profileFrame' | 'chatBubble'
  const userId = context.auth.uid;

  const userRef = admin.firestore().doc(`users/${userId}`);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  // Verify ownership
  const ownedProducts = userDoc.data().ownedProducts || [];
  if (productId && !ownedProducts.includes(productId)) {
    throw new functions.https.HttpsError('permission-denied', 'You do not own this product');
  }

  // Set active customization
  const updateField = type === 'profileFrame' 
    ? 'activeCustomizations.profileFrameId' 
    : 'activeCustomizations.chatBubbleThemeId';

  await userRef.update({
    [updateField]: productId || null // null to remove customization
  });

  return { success: true, type, productId };
});
```

---

#### **Function 4: getUserLibrary**
**Purpose**: Fetch user's purchased products with metadata

```javascript
exports.getUserLibrary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const userId = context.auth.uid;
  const libraryRef = admin.firestore().doc(`libraries/${userId}`);
  const libraryDoc = await libraryRef.get();

  if (!libraryDoc.exists()) {
    return { library: {} };
  }

  const library = libraryDoc.data();
  
  // Fetch product details for each owned item
  const productPromises = [];
  const productTypes = ['comics', 'books', 'art', 'stickerPacks', 'profileFrames', 'chatBubbles'];
  
  for (const type of productTypes) {
    const productIds = library[type] || [];
    for (const productId of productIds) {
      productPromises.push(
        admin.firestore().doc(`products/${productId}`).get()
      );
    }
  }

  const productDocs = await Promise.all(productPromises);
  const products = productDocs
    .filter(doc => doc.exists)
    .map(doc => ({ id: doc.id, ...doc.data() }));

  return {
    library,
    products
  };
});
```

---

### **2.2 Update Firestore Rules** (CRITICAL)

**File**: `/firestore.rules`

**Add Marketplace Rules** (append to existing rules):

```javascript
// ==================== MARKETPLACE SECURITY ====================

// Prevent direct wallet modifications
match /users/{userId} {
  // Block direct wallet updates
  allow update: if isOwner(userId) 
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
      'coins',
      'diamonds',
      'ownedProducts',
      'earningsBalance'
    ]);
  
  // Allow activeCustomizations updates only
  allow update: if isOwner(userId)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'activeCustomizations'
    ]);
}

// Products - Read-only for clients
match /products/{productId} {
  allow read: if resource.data.status == 'active';
  allow create, update, delete: if false; // Admin panel only
}

// Orders - Read own, write via Cloud Functions only
match /orders/{orderId} {
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow create, update, delete: if false;
}

// Libraries - Read own, write via Cloud Functions only
match /libraries/{userId} {
  allow read: if isOwner(userId);
  allow create, update, delete: if false;
}

// IAP Transactions - Read own, write via Cloud Functions only
match /iap_transactions/{transactionId} {
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow create, update, delete: if false;
}
```

**Deployment:**
```bash
firebase deploy --only firestore:rules
```

---

### **2.3 Update Client Purchase Logic**

**File**: `ProductDetailScreen.js`

**Replace** client-side purchase with Cloud Function call:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const handlePurchase = async () => {
  if (!product) return;

  const user = auth.currentUser;
  if (!user) {
    Alert.alert('Error', 'Please log in to make a purchase');
    return;
  }

  setPurchasing(true);

  try {
    // Call Cloud Function
    const functions = getFunctions();
    const buyProduct = httpsCallable(functions, 'buyProduct');
    
    const result = await buyProduct({ productId });

    if (result.data.success) {
      Alert.alert('Success! 🎉', result.data.message);
      setIsOwned(true);
      await fetchWallet(); // Refresh wallet balance
      navigateToProduct();
    }
  } catch (error) {
    console.error('Purchase error:', error);
    
    // Handle specific errors
    if (error.code === 'functions/failed-precondition') {
      // Insufficient balance
      Alert.alert(
        'Insufficient Balance',
        error.message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy Coins',
            onPress: () => navigation.navigate('CoinPurchase')
          }
        ]
      );
    } else if (error.code === 'functions/already-exists') {
      Alert.alert('Already Owned', 'You already own this product');
      setIsOwned(true);
    } else {
      Alert.alert('Purchase Failed', error.message || 'Something went wrong');
    }
  } finally {
    setPurchasing(false);
  }
};
```

---

## 🎨 PHASE 3: PRODUCT VIEWERS (PRIORITY 2)
**Timeline**: Week 2 (5-7 days)  
**Depends on**: Phase 2 completion

### **3.1 Comic Reader**

**Create**: `screens/viewers/ComicReaderScreen.js`

```javascript
import React, { useState, useEffect } from 'react';
import { View, Image, Dimensions, ActivityIndicator } from 'react-native';
import Swiper from 'react-native-swiper';

export default function ComicReaderScreen({ route }) {
  const { productId } = route.params;
  const [comic, setComic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComic();
  }, []);

  const fetchComic = async () => {
    const productDoc = await getDoc(doc(db, 'products', productId));
    setComic(productDoc.data());
    setLoading(false);
  };

  if (loading) return <ActivityIndicator />;

  return (
    <Swiper loop={false} showsPagination>
      {comic.comicConfig.pages.map((page, index) => (
        <View key={index}>
          <Image
            source={{ uri: page.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>
      ))}
    </Swiper>
  );
}
```

**Dependencies:**
```bash
npx expo install react-native-swiper
```

---

### **3.2 Book Reader (PDF/EPUB)**

**Create**: `screens/viewers/BookReaderScreen.js`

```javascript
import React from 'react';
import { WebView } from 'react-native-webview';

export default function BookReaderScreen({ route }) {
  const { productId } = route.params;
  const [book, setBook] = useState(null);

  useEffect(() => {
    fetchBook();
  }, []);

  const fetchBook = async () => {
    const productDoc = await getDoc(doc(db, 'products', productId));
    setBook(productDoc.data());
  };

  if (!book) return <ActivityIndicator />;

  return (
    <WebView
      source={{ uri: book.bookConfig.fileUrl }}
      style={{ flex: 1 }}
    />
  );
}
```

**Alternative** (for better PDF support):
```bash
npx expo install react-native-pdf
```

---

### **3.3 Art Viewer**

**Create**: `screens/viewers/ArtViewerScreen.js`

```javascript
import React from 'react';
import { View, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

export default function ArtViewerScreen({ route }) {
  const { productId } = route.params;
  const [art, setArt] = useState(null);

  const handleDownload = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed');
      return;
    }

    const fileUri = FileSystem.documentDirectory + `art_${productId}.jpg`;
    const downloadResult = await FileSystem.downloadAsync(
      art.artConfig.fullResUrl,
      fileUri
    );

    await MediaLibrary.createAssetAsync(downloadResult.uri);
    Alert.alert('Success', 'Saved to gallery!');
  };

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={{ uri: art?.artConfig?.fullResUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
      <TouchableOpacity
        style={styles.downloadButton}
        onPress={handleDownload}
      >
        <Ionicons name="download" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
```

---

### **3.4 Sticker Pack Viewer**

**Create**: `screens/viewers/StickerPackViewerScreen.js`

```javascript
import React from 'react';
import { View, FlatList, Image, StyleSheet } from 'react-native';

export default function StickerPackViewerScreen({ route }) {
  const { productId } = route.params;
  const [pack, setPack] = useState(null);

  useEffect(() => {
    fetchStickerPack();
  }, []);

  const fetchStickerPack = async () => {
    const productDoc = await getDoc(doc(db, 'products', productId));
    setPack(productDoc.data());
  };

  const renderSticker = ({ item }) => (
    <View style={styles.stickerContainer}>
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.sticker}
      />
    </View>
  );

  return (
    <FlatList
      data={pack?.stickerPackConfig?.stickers || []}
      renderItem={renderSticker}
      numColumns={4}
      keyExtractor={(item) => item.stickerId}
    />
  );
}
```

---

### **3.5 Frame Customizer**

**Create**: `screens/viewers/FrameCustomizerScreen.js`

```javascript
import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Text, Alert } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function FrameCustomizerScreen({ route, navigation }) {
  const { productId } = route.params;
  const [frame, setFrame] = useState(null);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      const functions = getFunctions();
      const setActiveCustomization = httpsCallable(functions, 'setActiveCustomization');
      
      await setActiveCustomization({
        type: 'profileFrame',
        productId
      });

      Alert.alert('Success', 'Profile frame activated!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* Preview */}
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: auth.currentUser?.photoURL }}
          style={styles.avatar}
        />
        <Image
          source={{ uri: frame?.frameConfig?.frameUrl }}
          style={styles.frameOverlay}
        />
      </View>

      <TouchableOpacity
        style={styles.applyButton}
        onPress={handleApply}
        disabled={applying}
      >
        <Text style={styles.buttonText}>
          {applying ? 'Applying...' : 'Apply Frame'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

### **3.6 Chat Bubble Customizer**

**Create**: `screens/viewers/BubbleCustomizerScreen.js`

```javascript
export default function BubbleCustomizerScreen({ route, navigation }) {
  const { productId } = route.params;
  const [bubble, setBubble] = useState(null);

  const handleApply = async () => {
    const functions = getFunctions();
    const setActiveCustomization = httpsCallable(functions, 'setActiveCustomization');
    
    await setActiveCustomization({
      type: 'chatBubble',
      productId
    });

    Alert.alert('Success', 'Chat theme activated!');
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Preview messages with theme */}
      <View style={styles.preview}>
        <View style={[styles.bubble, bubble?.bubbleConfig?.theme?.sentBubble]}>
          <Text style={{ color: bubble?.bubbleConfig?.theme?.sentBubble?.textColor }}>
            Hey! How are you?
          </Text>
        </View>
        <View style={[styles.bubble, bubble?.bubbleConfig?.theme?.receivedBubble]}>
          <Text style={{ color: bubble?.bubbleConfig?.theme?.receivedBubble?.textColor }}>
            Great! Love this theme!
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
        <Text style={styles.buttonText}>Apply Theme</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 💳 PHASE 4: IAP INTEGRATION (PRIORITY 2)
**Timeline**: Week 2 (parallel with Phase 3)  
**Revenue Critical**: Enables monetization

### **4.1 Install Dependencies**

```bash
npx expo install react-native-iap
```

### **4.2 Configure Stores**

**Google Play Console:**
1. Create In-App Products
   - `coins_100` - 100 Coins - $0.99
   - `coins_500` - 500 Coins - $4.99
   - `coins_1000` - 1,000 Coins - $9.99
   - `coins_5000` - 5,000 Coins - $49.99

**App Store Connect:**
1. Create same products with matching IDs
2. Set up pricing tiers

### **4.3 Implement Purchase Flow**

**Update**: `CoinPurchaseScreen.js`

```javascript
import * as IAP from 'react-native-iap';
import { getFunctions, httpsCallable } from 'firebase/functions';

const PRODUCTS = [
  { productId: 'coins_100', coins: 100, price: '$0.99' },
  { productId: 'coins_500', coins: 500, price: '$4.99' },
  { productId: 'coins_1000', coins: 1000, price: '$9.99' },
  { productId: 'coins_5000', coins: 5000, price: '$49.99' }
];

export default function CoinPurchaseScreen() {
  const [products, setProducts] = useState([]);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    initIAP();
    return () => IAP.endConnection();
  }, []);

  const initIAP = async () => {
    try {
      await IAP.initConnection();
      const products = await IAP.getProducts(PRODUCTS.map(p => p.productId));
      setProducts(products);
    } catch (error) {
      console.error('IAP init failed:', error);
    }
  };

  const handlePurchase = async (productId, coinAmount) => {
    setPurchasing(true);
    try {
      const purchase = await IAP.requestPurchase({
        sku: productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false
      });

      // Verify and credit coins via Cloud Function
      const functions = getFunctions();
      const creditCoins = httpsCallable(functions, 'creditCoinsAfterIAP');

      await creditCoins({
        amount: coinAmount,
        purchaseToken: purchase.transactionReceipt,
        platform: Platform.OS,
        productId
      });

      // Finish transaction
      await IAP.finishTransaction({ purchase });

      Alert.alert('Success!', `${coinAmount} coins added to your wallet!`);
    } catch (error) {
      console.error('Purchase failed:', error);
      Alert.alert('Purchase Failed', error.message);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <View>
      {PRODUCTS.map(product => (
        <TouchableOpacity
          key={product.productId}
          onPress={() => handlePurchase(product.productId, product.coins)}
          disabled={purchasing}
        >
          <Text>{product.coins} Coins - {product.price}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

### **4.4 Receipt Validation (Production)**

**Update Cloud Function**: `creditCoinsAfterIAP`

```javascript
// Add receipt verification
const { google } = require('googleapis');

async function verifyGooglePurchase(purchaseToken, productId) {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth
  });

  const result = await androidPublisher.purchases.products.get({
    packageName: 'com.socialvibing.app',
    productId,
    token: purchaseToken
  });

  return result.data.purchaseState === 0; // 0 = purchased
}

async function verifyApplePurchase(receiptData) {
  // Use Apple's verifyReceipt endpoint
  // See: https://developer.apple.com/documentation/appstorereceipts
}
```

---

## 🔧 PHASE 5: ADVANCED FEATURES (PRIORITY 3)
**Timeline**: Week 3  
**Optional but Recommended**

### **5.1 Reviews & Ratings System**

**Schema**:
```javascript
// reviews/{reviewId}
{
  reviewId: string,
  userId: string,
  userName: string,
  productId: string,
  rating: number, // 1-5
  comment: string,
  helpful: number,
  createdAt: timestamp
}
```

**Implementation**:
- Add "Write Review" button on ProductDetailScreen
- Show reviews list with average rating
- Allow users to mark reviews helpful

---

### **5.2 Transaction History**

**Create**: `screens/marketplace/TransactionHistoryScreen.js`

```javascript
export default function TransactionHistoryScreen() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => (
        <View style={styles.orderCard}>
          <Text>{item.productTitle}</Text>
          <Text>{item.amount} {item.currency}</Text>
          <Text>{new Date(item.createdAt.toDate()).toLocaleDateString()}</Text>
        </View>
      )}
    />
  );
}
```

---

### **5.3 Creator Dashboard**

**Create**: `screens/marketplace/CreatorDashboardScreen.js`

Features:
- View total earnings
- Upload new products
- Track sales analytics
- Withdraw earnings

---

### **5.4 Wishlist System**

**Schema**:
```javascript
// users/{userId}
{
  wishlist: [productId1, productId2, ...]
}
```

**Add functions**:
- Add to Wishlist
- Remove from Wishlist
- Notify when price drops

---

### **5.5 Gift Products**

**Cloud Function**: `giftProduct`

```javascript
exports.giftProduct = functions.https.onCall(async (data, context) => {
  const { productId, recipientUserId, message } = data;
  
  // 1. Deduct from sender's wallet
  // 2. Add to recipient's library
  // 3. Send notification
  // 4. Create gift record
});
```

---

## 🧪 PHASE 6: TESTING STRATEGY

### **6.1 Unit Tests**

**Cloud Functions Testing**:
```bash
cd functions
npm install --save-dev firebase-functions-test
```

```javascript
// functions/test/buyProduct.test.js
const test = require('firebase-functions-test')();
const { buyProduct } = require('../index');

describe('buyProduct', () => {
  it('should fail if user not authenticated', async () => {
    const wrapped = test.wrap(buyProduct);
    await expect(wrapped({ productId: 'test' }))
      .rejects.toThrow('unauthenticated');
  });

  it('should fail if insufficient balance', async () => {
    // Mock Firestore data
    // Test purchase attempt
  });

  it('should complete purchase successfully', async () => {
    // Test happy path
  });
});
```

---

### **6.2 Integration Tests**

**Test Scenarios**:
1. ✅ Purchase flow end-to-end
2. ✅ IAP → Coin credit flow
3. ✅ Ownership verification
4. ✅ Concurrent purchase prevention
5. ✅ Refund handling
6. ✅ Creator earnings distribution

---

### **6.3 Security Testing**

**Checklist**:
- [ ] Try direct Firestore wallet update (should fail)
- [ ] Try purchasing without authentication (should fail)
- [ ] Try purchasing already-owned product (should fail)
- [ ] Try replaying IAP receipt (should fail)
- [ ] Try SQL injection in product search
- [ ] Try XSS in product descriptions

---

## 🚀 PHASE 7: DEPLOYMENT

### **7.1 Pre-Deployment Checklist**

**Backend**:
- [ ] Deploy Cloud Functions: `firebase deploy --only functions`
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
- [ ] Set up Firebase Storage rules for product images
- [ ] Configure environment variables (API keys, secrets)

**Frontend**:
- [ ] Remove all `console.log` statements
- [ ] Enable production mode in Expo
- [ ] Configure EAS Build
- [ ] Set up app signing (Android/iOS)
- [ ] Configure store listings

**Testing**:
- [ ] Test on physical devices (iOS + Android)
- [ ] Test IAP in sandbox mode
- [ ] Load testing (simulate 100+ concurrent purchases)
- [ ] Accessibility testing
- [ ] Localization testing

---

### **7.2 EAS Build Configuration**

**File**: `eas.json`

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "ios": {
        "buildConfiguration": "Release"
      },
      "env": {
        "EXPO_PUBLIC_FIREBASE_API_KEY": "...",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "..."
      }
    }
  }
}
```

**Build Commands**:
```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

---

### **7.3 App Store Submission**

**Google Play Console**:
1. Upload APK/AAB
2. Add screenshots (6+ per device type)
3. Write app description (include marketplace features)
4. Set age rating (based on user-generated content)
5. Configure pricing & distribution
6. Submit for review

**App Store Connect**:
1. Create app record
2. Upload IPA via Xcode or Transporter
3. Add App Preview videos
4. Configure IAP products
5. Submit for review

---

## 📊 MONITORING & ANALYTICS

### **8.1 Firebase Analytics Events**

```javascript
// Track marketplace events
import { logEvent } from 'firebase/analytics';

// Product viewed
logEvent(analytics, 'view_item', {
  item_id: productId,
  item_name: product.title,
  item_category: product.type,
  price: product.price,
  currency: product.currency
});

// Purchase initiated
logEvent(analytics, 'begin_checkout', {
  item_id: productId,
  value: product.price,
  currency: product.currency
});

// Purchase completed
logEvent(analytics, 'purchase', {
  transaction_id: orderId,
  value: product.price,
  currency: product.currency,
  items: [{ item_id: productId }]
});
```

---

### **8.2 Crashlytics Integration**

```bash
npx expo install expo-firebase-crashlytics
```

```javascript
import * as Crashlytics from 'expo-firebase-crashlytics';

// Log non-fatal errors
try {
  await buyProduct();
} catch (error) {
  Crashlytics.recordError(error);
  Alert.alert('Error', error.message);
}
```

---

## 📈 SUCCESS METRICS

### **KPIs to Track**:
1. **Conversion Rate**: Viewers → Purchasers
2. **Average Revenue Per User (ARPU)**
3. **Transaction Success Rate**
4. **IAP Completion Rate**
5. **Product Return Rate** (refunds)
6. **Creator Earnings** (70/30 split)
7. **Daily Active Buyers**
8. **Most Popular Product Types**

---

## 🎯 IMPLEMENTATION PRIORITY MATRIX

| Task | Priority | Effort | Impact | Timeline |
|------|----------|--------|--------|----------|
| Cloud Functions (buyProduct) | 🔴 CRITICAL | High | Critical | Day 1-2 |
| Firestore Rules Update | 🔴 CRITICAL | Low | Critical | Day 1 |
| Update Client Purchase Logic | 🔴 CRITICAL | Medium | Critical | Day 2 |
| IAP Integration | 🟡 HIGH | High | High | Day 3-5 |
| Comic Reader | 🟡 HIGH | Medium | High | Day 6-7 |
| Frame/Bubble Customizer | 🟡 HIGH | Medium | High | Day 8-9 |
| Book/Art Viewers | 🟢 MEDIUM | Medium | Medium | Day 10-11 |
| Sticker Pack Viewer | 🟢 MEDIUM | Low | Medium | Day 12 |
| Reviews System | 🟢 MEDIUM | Medium | Medium | Week 3 |
| Creator Dashboard | ⚪ LOW | High | Low | Week 3+ |
| Transaction History | ⚪ LOW | Low | Low | Week 3 |
| Wishlist | ⚪ LOW | Low | Low | Week 3+ |

---

## 🛠️ DAILY IMPLEMENTATION CHECKLIST

### **Day 1: Security Foundation**
- [ ] Create `functions/marketplace.js` with buyProduct
- [ ] Update `firestore.rules` with marketplace security
- [ ] Deploy functions and rules
- [ ] Test with Firestore emulator

### **Day 2: Client Integration**
- [ ] Refactor ProductDetailScreen to use Cloud Function
- [ ] Add error handling for all purchase states
- [ ] Test purchase flow end-to-end
- [ ] Fix any transaction edge cases

### **Day 3-4: IAP Setup**
- [ ] Install react-native-iap
- [ ] Configure Google Play & App Store products
- [ ] Implement CoinPurchaseScreen
- [ ] Add creditCoinsAfterIAP function
- [ ] Test sandbox purchases

### **Day 5: IAP Validation**
- [ ] Add receipt verification (Google/Apple)
- [ ] Test replay attack prevention
- [ ] Test concurrent purchases
- [ ] Fix any IAP edge cases

### **Day 6-7: Comic Reader**
- [ ] Create ComicReaderScreen
- [ ] Add page navigation (swiper)
- [ ] Add bookmark support
- [ ] Test with sample comics

### **Day 8-9: Customization System**
- [ ] Create FrameCustomizerScreen
- [ ] Create BubbleCustomizerScreen
- [ ] Add setActiveCustomization function
- [ ] Update profile/chat to use active customizations

### **Day 10-12: Remaining Viewers**
- [ ] BookReaderScreen (PDF/EPUB)
- [ ] ArtViewerScreen with download
- [ ] StickerPackViewerScreen
- [ ] Test all viewers

### **Week 3: Polish & Advanced Features**
- [ ] Reviews system
- [ ] Transaction history
- [ ] Creator dashboard (basic)
- [ ] Analytics integration
- [ ] Final testing & bug fixes

---

## 🚨 COMMON PITFALLS TO AVOID

1. **❌ Client-Side Wallet Updates**
   - Never use `increment()` on wallet fields from client
   - Always use Cloud Functions for money operations

2. **❌ Missing Transaction Atomicity**
   - Always use Firestore transactions for purchases
   - Rollback on any step failure

3. **❌ Unverified IAP Receipts**
   - In production, ALWAYS verify with Google/Apple servers
   - Check for replay attacks

4. **❌ Hardcoded API Keys**
   - Use environment variables
   - Never commit secrets to Git

5. **❌ Missing Error Handling**
   - Handle network failures gracefully
   - Show user-friendly error messages

6. **❌ No Loading States**
   - Always show loading indicators during purchases
   - Disable buttons during processing

7. **❌ Poor Offline Handling**
   - Queue purchases when offline
   - Sync when connection restored

8. **❌ Insufficient Testing**
   - Test edge cases (simultaneous purchases, refunds, etc.)
   - Load test before production

---

## 📚 RESOURCES & DOCUMENTATION

### **Official Docs**
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [React Native IAP](https://github.com/dooboolab/react-native-iap)
- [Expo SDK 54 Docs](https://docs.expo.dev/)
- [React Native 0.81 Docs](https://reactnative.dev/docs/0.81/getting-started)

### **Code Examples**
- `functions/index.js` - Cloud Functions implementation
- `ProductDetailScreen.js` - Purchase flow
- `ComicsLibraryScreen.js` - Library pattern
- `firestore.rules.marketplace` - Security rules

---

## ✅ FINAL PRE-LAUNCH CHECKLIST

**Security** ✅:
- [ ] All wallet operations server-side
- [ ] Firestore rules block client modifications
- [ ] IAP receipts verified
- [ ] Transaction atomicity ensured
- [ ] SQL injection prevented
- [ ] XSS attacks prevented

**Functionality** ✅:
- [ ] Purchase flow works end-to-end
- [ ] IAP credits coins correctly
- [ ] Products viewable after purchase
- [ ] Customizations apply correctly
- [ ] Library displays owned items
- [ ] Creator earnings distributed

**Performance** ✅:
- [ ] Response time < 2 seconds
- [ ] Images optimized (< 500KB)
- [ ] Offline mode graceful
- [ ] No memory leaks

**UX** ✅:
- [ ] Loading states on all actions
- [ ] Error messages clear
- [ ] Success confirmations shown
- [ ] Disabled states prevent double-tap

**Compliance** ✅:
- [ ] Privacy policy included
- [ ] Terms of service included
- [ ] Age rating appropriate
- [ ] GDPR compliant (if EU users)
- [ ] Accessibility guidelines met

---

## 🎉 CONCLUSION

This plan provides a complete roadmap from current state (functional UI with security issues) to production-ready marketplace with:

✅ **Secure server-side transactions**  
✅ **6 monetization product types**  
✅ **IAP integration for coin purchases**  
✅ **Complete product viewing experience**  
✅ **Creator earnings system**  
✅ **Production-grade security**  

**Estimated Total Time**: 2-3 weeks  
**Team Size**: 1-2 developers  
**Result**: Production-ready marketplace generating revenue

**Next Step**: Begin with **Phase 2 (Security & Cloud Functions)** - this is BLOCKING for all other features and addresses the critical security vulnerability.

---

**Questions?** Review specific sections or start with Day 1 tasks!
