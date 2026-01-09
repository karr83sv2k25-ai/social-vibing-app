# Digital Marketplace Implementation - Complete Guide

## Overview
This document provides the complete implementation guide for the Social Vibing Digital Marketplace with 8 monetization features, dual currency system, and external service integrations.

---

## ✅ COMPLETED COMPONENTS

### 1. **Database Schema** (`MARKETPLACE_DATABASE_SCHEMA.md`)
- 11 collections/tables designed
- Business rules implemented
- Commission split logic (75/25)
- Review-based moderation
- Indexes for performance

### 2. **REST API Design** (`MARKETPLACE_API_DESIGN.md`)
- 60+ endpoints defined
- Products, Orders, Wallet, Withdrawals
- AI Generation, Reviews, Categories
- Error handling and status codes

### 3. **Navigation Structure** (`navigation/MarketplaceNavigator.js`)
- Tab Navigator: Marketplace, Categories, AI Lab, Freelance, Wallet
- Stack Navigator with all screens
- Deep linking support

### 4. **Virtual Currency System** (`context/WalletContext.js`)
- Global wallet state management
- Coins & Diamonds operations
- Daily rewards & ad rewards
- Purchase & withdrawal logic
- Commission calculations

### 5. **Core Screens Created**

#### a) `CategoriesScreen.js`
- Shows 8 monetization features
- Client's icons integrated
- Navigation to category pages & AI Lab

#### b) `WalletScreen.js`
- Coins & Diamonds display
- Transaction history
- Earnings for creators
- Withdrawal button
- Quick actions (daily reward, ads)

#### c) `ProductDetailScreen.js`
- Product images gallery
- Purchase flow with balance check
- Reviews display
- Seller contact
- Type-specific info

#### d) `ProductCreationWizardScreen.js`
- 3-step wizard (Category → Assets → Preview/Price)
- File upload support
- Type-specific fields
- Commission preview
- Edit mode support

---

## 🔨 REMAINING SCREENS TO CREATE

Create these files in `screens/marketplace/`:

### 1. **SellerDashboardScreen.js**
- Sales statistics
- Earnings overview
- Product list with edit/delete
- Recent orders
- Reviews summary

### 2. **AILabScreen.js**
- Text-to-image & Image-to-image tabs
- Prompt input
- Model selection
- Coin cost display
- Generation history

### 3. **FreelanceMarketplaceScreen.js**
- Gigs listing (integrated from Viserlance/Hirezy)
- Filter by category
- Seller profiles

### 4. **GigDetailScreen.js**
- Freelance gig details
- Deliverables information
- Order placement

### 5. **MyOrdersScreen.js**
- Purchase history
- Download buttons
- Order status
- Review option

### 6. **OrderSuccessScreen.js**
- Success animation
- Order details
- Download link
- Rate product button

### 7. **WithdrawalScreen.js**
- Amount input
- Payout method selection (PayPal, CashApp, Bank)
- Withdrawal history

### 8. **CheckoutScreen.js** (optional, can be modal)
- Payment confirmation
- Balance display
- Order summary

---

## 📦 API LAYER IMPLEMENTATION

Create `api/` directory with these modules:

### 1. **api/client.js** - Base API client
```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.socialvibing.com/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Handle logout
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default apiClient;
```

### 2. **api/productAPI.js**
```javascript
import apiClient from './client';

export const productAPI = {
  // Get products
  getProducts: (params) => apiClient.get('/products', { params }),
  
  // Get single product
  getProduct: (productId) => apiClient.get(`/products/${productId}`),
  
  // Create product
  createProduct: (data) => apiClient.post('/products', data),
  
  // Update product
  updateProduct: (productId, data) => apiClient.put(`/products/${productId}`, data),
  
  // Delete product
  deleteProduct: (productId) => apiClient.delete(`/products/${productId}`),
  
  // Get reviews
  getProductReviews: (productId, params) => apiClient.get(`/products/${productId}/reviews`, { params }),
  
  // Create order
  createOrder: (data) => apiClient.post('/orders', data),
  
  // Get orders
  getOrders: (params) => apiClient.get('/orders', { params }),
  
  // Upload asset
  uploadAsset: async (uri, type) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: type === 'image' ? 'image/jpeg' : 'application/octet-stream',
      name: `upload_${Date.now()}.${type === 'image' ? 'jpg' : 'dat'}`,
    });
    formData.append('type', type);
    
    return apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
```

### 3. **api/walletAPI.js**
```javascript
import apiClient from './client';

export const walletAPI = {
  getWallet: () => apiClient.get('/wallet'),
  
  getTransactions: (params) => apiClient.get('/wallet/transactions', { params }),
  
  purchaseCoins: (data) => apiClient.post('/wallet/coins/purchase', data),
  
  claimDailyReward: () => apiClient.post('/wallet/daily-reward'),
  
  claimAdReward: (data) => apiClient.post('/wallet/ad-reward', data),
  
  requestWithdrawal: (data) => apiClient.post('/withdrawals', data),
  
  getWithdrawals: (params) => apiClient.get('/withdrawals', { params }),
};
```

### 4. **api/aiAPI.js**
```javascript
import apiClient from './client';

export const aiAPI = {
  generateImage: (data) => apiClient.post('/ai/generate', data),
  
  getGeneration: (generationId) => apiClient.get(`/ai/generate/${generationId}`),
  
  getHistory: (params) => apiClient.get('/ai/history', { params }),
  
  getPricing: () => apiClient.get('/ai/pricing'),
};
```

### 5. **api/categoriesAPI.js**
```javascript
import apiClient from './client';

export const categoriesAPI = {
  getCategories: () => apiClient.get('/categories'),
};
```

### 6. **api/creatorAPI.js**
```javascript
import apiClient from './client';

export const creatorAPI = {
  getStats: () => apiClient.get('/creator/stats'),
  
  getProducts: (params) => apiClient.get('/creator/products', { params }),
};
```

---

## 🔌 EXTERNAL SERVICE INTEGRATIONS

### 1. **Leonardo AI Integration**
Create `services/leonardoService.js`:
```javascript
// Wrapper for Leonardo AI script
export const leonardoService = {
  async generateImage(params) {
    // This calls your backend endpoint which internally calls Leonardo script
    const response = await aiAPI.generateImage(params);
    return response;
  },
  
  async pollGeneration(generationId) {
    // Poll for completion
    let attempts = 0;
    while (attempts < 60) {
      const result = await aiAPI.getGeneration(generationId);
      if (result.data.status === 'completed' || result.data.status === 'failed') {
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      attempts++;
    }
    throw new Error('Generation timeout');
  },
};
```

### 2. **PlayTube Integration**
Create `services/playtubeService.js`:
```javascript
// Wrapper for PlayTube channels/subscriptions
export const playtubeService = {
  async getChannel(channelId) {
    return apiClient.get(`/integrations/playtube/channels/${channelId}`);
  },
  
  async subscribe(channelId, diamondsAmount) {
    return apiClient.post('/integrations/playtube/subscribe', {
      channelId,
      diamondsAmount,
    });
  },
  
  async tipChannel(channelId, diamonds) {
    // Tip creator with diamonds (like Twitch bits)
    return apiClient.post('/integrations/playtube/tip', {
      channelId,
      diamonds,
    });
  },
};
```

### 3. **Freelance Service (Viserlance/Hirezy)**
Create `services/freelanceService.js`:
```javascript
export const freelanceService = {
  async getGigs(params) {
    return apiClient.get('/integrations/freelance/gigs', { params });
  },
  
  async getGigDetail(gigId) {
    return apiClient.get(`/integrations/freelance/gigs/${gigId}`);
  },
  
  async createOrder(gigId, requirements) {
    return apiClient.post('/integrations/freelance/orders', {
      gigId,
      requirements,
    });
  },
  
  async deliverWork(orderId, deliverables) {
    return apiClient.post(`/freelance/orders/${orderId}/deliver`, {
      deliverables,
    });
  },
};
```

### 4. **Komiko (Comics) Integration**
Create `services/komikoService.js`:
```javascript
export const komikoService = {
  async createComic(title, description) {
    return apiClient.post('/integrations/komiko/comic/create', {
      title,
      description,
    });
  },
  
  async uploadComicPages(comicId, pages) {
    // Upload comic pages
    return apiClient.post(`/integrations/komiko/comic/${comicId}/pages`, {
      pages,
    });
  },
};
```

---

## 🔄 UPDATING EXISTING MARKETPLACE SCREEN

Update [marketplace.js](c:\\Users\\Zain Ul Abideen\\Documents\\GitHub\\social-vibing-app\\marketplace.js) to use real API data:

### Changes needed:

1. **Replace dummy data with API calls:**
```javascript
import { useState, useEffect } from 'react';
import { productAPI } from './api/productAPI';
import { categoriesAPI } from './api/categoriesAPI';
import { useWallet } from './context/WalletContext';

export default function MarketPlaceScreen({ navigation }) {
  const { wallet } = useWallet();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchProducts();
  }, []);
  
  const fetchProducts = async () => {
    try {
      const response = await productAPI.getProducts({
        sort: 'popular',
        limit: 20,
      });
      setProducts(response.data.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Update balance displays to use real wallet data
  // wallet.coins and wallet.diamonds
}
```

2. **Update product cards to navigate to ProductDetail:**
```javascript
<TouchableOpacity
  onPress={() => navigation.navigate('ProductDetail', { productId: product.productId })}
>
  {/* Product card content */}
</TouchableOpacity>
```

3. **Add pull-to-refresh:**
```javascript
<ScrollView
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={fetchProducts} />
  }
>
```

---

## 🎨 COIN & DIAMOND PURCHASE SCREENS

You already have `coinpurchase.js` and `diamondpurchase.js`. Update them to:

1. **Use IAP (In-App Purchases):**
   - Install: `expo install expo-in-app-purchases`
   - Configure packages in Firebase/App Store Connect

2. **Call wallet API after purchase:**
```javascript
import { useWallet } from './context/WalletContext';

const { purchaseCurrency } = useWallet();

const handlePurchase = async (packageId) => {
  try {
    // 1. Initiate IAP
    const purchase = await InAppPurchases.purchaseItemAsync(packageId);
    
    // 2. Verify & credit via API
    await purchaseCurrency(packageId, 'stripe', purchase.transactionReceipt);
    
    Alert.alert('Success', 'Coins added to your wallet!');
  } catch (error) {
    Alert.alert('Error', 'Purchase failed');
  }
};
```

---

## 📱 DAILY REWARD & AD REWARD IMPLEMENTATION

### Daily Reward
Update [dailyreward.js](c:\\Users\\Zain Ul Abideen\\Documents\\GitHub\\social-vibing-app\\dailyreward.js):

```javascript
import { useWallet } from './context/WalletContext';

const { claimDailyReward } = useWallet();

const handleClaimReward = async () => {
  try {
    const result = await claimDailyReward();
    Alert.alert(
      'Daily Reward!',
      `You earned ${result.totalCoins} coins! 🎉\nStreak: Day ${result.streakDay}`
    );
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

### Rewarded Ads
Install: `expo install expo-ads-admob`

```javascript
import { AdMobRewarded } from 'expo-ads-admob';
import { useWallet } from './context/WalletContext';

const { claimAdReward } = useWallet();

const watchRewardedAd = async () => {
  try {
    await AdMobRewarded.setAdUnitID('ca-app-pub-xxxxx/xxxxx');
    await AdMobRewarded.requestAdAsync();
    await AdMobRewarded.showAdAsync();
    
    // On reward
    AdMobRewarded.addEventListener('rewardedVideoUserDidEarnReward', async () => {
      const result = await claimAdReward({
        adType: 'rewarded_video',
        adProvider: 'admob',
        adId: 'unique_ad_id',
      });
      
      Alert.alert('Reward Earned!', `+${result.coinsEarned} coins`);
    });
  } catch (error) {
    console.error('Ad failed:', error);
  }
};
```

---

## 🔐 AUTHENTICATION & APP.JS INTEGRATION

Wrap your app with providers in `App.js`:

```javascript
import { WalletProvider } from './context/WalletContext';
import { MarketplaceStackNavigator } from './navigation/MarketplaceNavigator';

export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer>
        {/* Your existing navigation */}
        
        {/* Add Marketplace stack */}
        <Stack.Screen 
          name="Marketplace" 
          component={MarketplaceStackNavigator} 
          options={{ headerShown: false }}
        />
      </NavigationContainer>
    </WalletProvider>
  );
}
```

---

## 🧪 BACKEND IMPLEMENTATION EXAMPLES

### Node.js/Express Example for Key Endpoints

#### 1. **Create Order with Commission Split**
```javascript
// POST /orders
router.post('/orders', authenticate, async (req, res) => {
  const { productId, paymentMethod } = req.body;
  const buyerId = req.user.userId;
  
  // 1. Get product
  const product = await Product.findById(productId);
  if (!product || product.status !== 'published') {
    return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND' } });
  }
  
  // 2. Check if already purchased
  const existingOrder = await Order.findOne({ buyerId, productId, status: 'completed' });
  if (existingOrder) {
    return res.status(400).json({ success: false, error: { code: 'ALREADY_PURCHASED' } });
  }
  
  // 3. Get buyer wallet
  const wallet = await Wallet.findOne({ userId: buyerId });
  const currency = product.currency;
  const price = product.price;
  
  // Check balance
  if (currency === 'diamonds' && wallet.diamonds < price) {
    return res.status(400).json({
      success: false,
      error: { code: 'INSUFFICIENT_FUNDS', required: price, available: wallet.diamonds },
    });
  }
  
  if (currency === 'coins' && wallet.coins < price) {
    return res.status(400).json({
      success: false,
      error: { code: 'INSUFFICIENT_COINS', required: price, available: wallet.coins },
    });
  }
  
  // 4. Calculate commission (only for diamonds)
  const platformCommission = currency === 'diamonds' ? price * 0.25 : 0;
  const sellerEarnings = currency === 'diamonds' ? price * 0.75 : 0;
  
  // 5. Create order
  const order = await Order.create({
    buyerId,
    sellerId: product.sellerId,
    productId,
    price,
    currency,
    platformCommission,
    sellerEarnings,
    status: 'completed', // Digital products complete instantly
  });
  
  // 6. Deduct from buyer
  if (currency === 'diamonds') {
    wallet.diamonds -= price;
  } else {
    wallet.coins -= price;
  }
  await wallet.save();
  
  // 7. Credit seller (only diamonds generate earnings)
  if (currency === 'diamonds') {
    const sellerWallet = await Wallet.findOne({ userId: product.sellerId });
    sellerWallet.earningsBalance += sellerEarnings;
    sellerWallet.withdrawableBalance += sellerEarnings;
    sellerWallet.lifetimeEarnings += sellerEarnings;
    await sellerWallet.save();
    
    // Create transaction for seller
    await Transaction.create({
      userId: product.sellerId,
      walletId: sellerWallet.walletId,
      type: 'diamond_earned',
      amount: sellerEarnings,
      currency: 'diamonds',
      description: `Sale: ${product.title}`,
      orderId: order.orderId,
    });
  }
  
  // 8. Create transaction for buyer
  await Transaction.create({
    userId: buyerId,
    walletId: wallet.walletId,
    type: currency === 'diamonds' ? 'diamond_spent' : 'coin_spent',
    amount: -price,
    currency,
    description: `Purchase: ${product.title}`,
    orderId: order.orderId,
    productId,
  });
  
  // 9. Update product stats
  await Product.updateOne(
    { _id: productId },
    { $inc: { 'stats.purchases': 1 } }
  );
  
  res.json({
    success: true,
    data: {
      orderId: order.orderId,
      productId,
      price,
      currency,
      status: 'completed',
      downloadUrl: generateSecureDownloadUrl(order),
      wallet: { coins: wallet.coins, diamonds: wallet.diamonds },
    },
  });
});
```

#### 2. **AI Image Generation with Coin Deduction**
```javascript
// POST /ai/generate
router.post('/ai/generate', authenticate, async (req, res) => {
  const { type, prompt, model, width, height } = req.body;
  const userId = req.user.userId;
  
  // 1. Calculate coin cost based on resolution
  const coinsCost = calculateCoinsCost(width, height, type);
  
  // 2. Check balance
  const wallet = await Wallet.findOne({ userId });
  if (wallet.coins < coinsCost) {
    return res.status(400).json({
      success: false,
      error: { code: 'INSUFFICIENT_COINS', required: coinsCost, available: wallet.coins },
    });
  }
  
  // 3. Deduct coins
  wallet.coins -= coinsCost;
  await wallet.save();
  
  // 4. Create generation record
  const generation = await AIGeneration.create({
    userId,
    type,
    prompt,
    model,
    width,
    height,
    coinsCost,
    status: 'processing',
  });
  
  // 5. Call Leonardo AI script (async)
  callLeonardoAPI(generation.generationId, { prompt, model, width, height })
    .then(async (result) => {
      generation.outputImages = result.images;
      generation.status = 'completed';
      generation.completedAt = new Date();
      await generation.save();
    })
    .catch(async (error) => {
      generation.status = 'failed';
      generation.errorMessage = error.message;
      await generation.save();
      
      // Refund coins on failure
      wallet.coins += coinsCost;
      await wallet.save();
    });
  
  // 6. Create transaction
  await Transaction.create({
    userId,
    walletId: wallet.walletId,
    type: 'coin_spent',
    amount: -coinsCost,
    currency: 'coins',
    description: 'AI Image Generation',
  });
  
  res.json({
    success: true,
    data: {
      generationId: generation.generationId,
      status: 'processing',
      coinsCost,
      newCoinBalance: wallet.coins,
      estimatedTime: 30,
      pollUrl: `/ai/generate/${generation.generationId}`,
    },
  });
});

function calculateCoinsCost(width, height, type) {
  const pixels = width * height;
  if (pixels <= 512 * 512) return type === 'text_to_image' ? 5 : 7;
  if (pixels <= 1024 * 1024) return type === 'text_to_image' ? 10 : 12;
  return type === 'text_to_image' ? 15 : 18;
}
```

---

## 🎯 NEXT STEPS FOR YOU

1. **Create remaining screen components** (listed above)
2. **Implement API layer** (create `api/` directory with modules)
3. **Set up backend server** with Node.js/Express or NestJS
4. **Configure Firebase/database** (Firestore or MongoDB)
5. **Integrate external scripts:**
   - Leonardo AI for image generation
   - Viserlance/Hirezy for freelancing
   - PlayTube for video channels
   - Komiko for comics
6. **Test currency flows:**
   - Coin purchases → AI generation
   - Diamond purchases → Product purchases → Seller earnings → Withdrawals
7. **Set up IAP** (In-App Purchases) for coins/diamonds
8. **Configure rewarded ads** (AdMob)
9. **Implement moderation system** for reviews
10. **Add admin dashboard** for withdrawals approval

---

## 📋 CHECKLIST

### Frontend (React Native)
- [x] Navigation structure
- [x] Wallet Context & currency system
- [x] Categories screen
- [x] Product detail screen
- [x] Product creation wizard (3 steps)
- [x] Wallet screen
- [ ] Seller dashboard
- [ ] AI Lab screen
- [ ] Freelance marketplace
- [ ] My orders screen
- [ ] Withdrawal screen
- [ ] Update existing marketplace.js with API integration

### Backend
- [x] Database schema designed
- [x] API endpoints designed
- [ ] Implement endpoints (Node/Express)
- [ ] Set up database (Firestore/MongoDB)
- [ ] Integrate Leonardo AI
- [ ] Integrate PlayTube
- [ ] Integrate Viserlance/Hirezy
- [ ] File upload handling (AWS S3/Cloudinary)
- [ ] Implement IAP verification
- [ ] Admin panel for withdrawals

### Monetization
- [ ] Configure IAP packages
- [ ] Integrate AdMob rewarded ads
- [ ] Set up payment processors (PayPal, CashApp, Stripe)
- [ ] Test commission splits
- [ ] Test withdrawal flows

---

## 🆘 SUPPORT & QUESTIONS

If you need help implementing:
1. Specific screens → Ask for code examples
2. Backend endpoints → Ask for implementation details
3. External integrations → Ask for integration patterns
4. Testing strategies → Ask for test cases

I'm here to help you complete this marketplace! 🚀
