# Digital Marketplace - Database Schema

## Collections/Tables Overview

### 1. **Users** (extends existing user model)
```json
{
  "userId": "string (primary key)",
  "username": "string",
  "email": "string",
  "avatar": "string (url)",
  
  // Marketplace-specific fields
  "isCreator": "boolean (default: false)",
  "creatorProfile": {
    "displayName": "string",
    "bio": "string",
    "bannerImage": "string",
    "socialLinks": {
      "twitter": "string",
      "instagram": "string",
      "website": "string"
    }
  },
  
  // Monetization status
  "monetizationStatus": "enum: active, suspended, banned",
  "suspensionReason": "string",
  "suspendedUntil": "timestamp",
  
  // Payout information
  "payoutInfo": {
    "method": "enum: paypal, cashapp, bank",
    "paypalEmail": "string",
    "cashappTag": "string",
    "bankDetails": "object"
  },
  
  // Statistics
  "stats": {
    "totalSales": "number",
    "averageRating": "number",
    "totalProducts": "number",
    "totalReviews": "number"
  },
  
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 2. **Wallets**
```json
{
  "walletId": "string (primary key)",
  "userId": "string (foreign key → Users)",
  
  // Balances
  "coins": "number (default: 0)",
  "diamonds": "number (default: 0)",
  
  // Earnings (for creators)
  "earningsBalance": "number (diamonds earned from sales)",
  "withdrawableBalance": "number (after commission)",
  "lifetimeEarnings": "number",
  "pendingEarnings": "number (from orders in progress)",
  
  // Thresholds
  "minimumWithdrawal": "number (default: 50)",
  
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3. **Products**
```json
{
  "productId": "string (primary key)",
  "sellerId": "string (foreign key → Users)",
  
  // Product type (8 monetization features)
  "type": "enum: chat_bubble, profile_frame, art, sticker_pack, comic, book, freelance_gig, ai_generated",
  
  // Basic info
  "title": "string",
  "description": "string",
  "category": "string (sub-category within type)",
  
  // Pricing
  "price": "number",
  "currency": "enum: coins, diamonds",
  
  // Assets
  "assets": [
    {
      "type": "enum: image, video, pdf, zip, json",
      "url": "string",
      "thumbnail": "string",
      "size": "number (bytes)",
      "fileName": "string"
    }
  ],
  
  "previewImages": ["string (urls)"],
  "coverImage": "string",
  
  // For sticker packs
  "stickerCount": "number",
  
  // For freelance gigs
  "deliveryTime": "number (days)",
  "revisions": "number",
  
  // For comics/books
  "pageCount": "number",
  "format": "string (pdf, epub, etc.)",
  
  // Status & visibility
  "status": "enum: draft, published, suspended, deleted",
  "visibility": "enum: public, unlisted, private",
  
  // Statistics
  "stats": {
    "views": "number",
    "purchases": "number",
    "rating": "number (average)",
    "reviewCount": "number",
    "favorites": "number"
  },
  
  // Moderation
  "moderationFlags": "number",
  "lastModeratedAt": "timestamp",
  
  "publishedAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 4. **Orders**
```json
{
  "orderId": "string (primary key)",
  "buyerId": "string (foreign key → Users)",
  "sellerId": "string (foreign key → Users)",
  "productId": "string (foreign key → Products)",
  
  // Transaction details
  "price": "number",
  "currency": "enum: coins, diamonds",
  
  // Commission split (for diamonds only)
  "platformCommission": "number (25% default)",
  "sellerEarnings": "number (75% default)",
  
  // Status
  "status": "enum: pending, completed, cancelled, refunded, disputed",
  
  // For freelance gigs
  "deliverables": [
    {
      "fileName": "string",
      "url": "string",
      "uploadedAt": "timestamp"
    }
  ],
  "dueDate": "timestamp",
  "completedAt": "timestamp",
  
  // Download tracking (for digital products)
  "downloadCount": "number",
  "lastDownloadAt": "timestamp",
  
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 5. **Reviews**
```json
{
  "reviewId": "string (primary key)",
  "productId": "string (foreign key → Products)",
  "orderId": "string (foreign key → Orders)",
  "buyerId": "string (foreign key → Users)",
  "sellerId": "string (foreign key → Users)",
  
  "rating": "number (1-5)",
  "comment": "string",
  
  // Moderation
  "isHidden": "boolean",
  "reportCount": "number",
  
  // Seller response
  "sellerResponse": "string",
  "sellerRespondedAt": "timestamp",
  
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 6. **Transactions**
```json
{
  "transactionId": "string (primary key)",
  "userId": "string (foreign key → Users)",
  "walletId": "string (foreign key → Wallets)",
  
  "type": "enum: coin_purchase, diamond_purchase, coin_earned, diamond_earned, coin_spent, diamond_spent, withdrawal, refund, daily_reward, ad_reward",
  
  "amount": "number",
  "currency": "enum: coins, diamonds, usd",
  
  "balanceBefore": "number",
  "balanceAfter": "number",
  
  // Related entities
  "orderId": "string (optional)",
  "productId": "string (optional)",
  "withdrawalId": "string (optional)",
  
  "description": "string",
  "metadata": "object (flexible JSON)",
  
  "createdAt": "timestamp"
}
```

### 7. **Withdrawals**
```json
{
  "withdrawalId": "string (primary key)",
  "userId": "string (foreign key → Users)",
  "walletId": "string (foreign key → Wallets)",
  
  "amount": "number (diamonds)",
  "amountUSD": "number (converted value)",
  "conversionRate": "number (diamonds to USD)",
  
  "method": "enum: paypal, cashapp, bank",
  "payoutDetails": "object (email, tag, account info)",
  
  "status": "enum: pending, approved, processing, completed, rejected, cancelled",
  
  "requestedAt": "timestamp",
  "processedAt": "timestamp",
  "completedAt": "timestamp",
  
  "adminNotes": "string",
  "rejectionReason": "string",
  
  "transactionId": "string (payment processor reference)",
  
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 8. **DailyRewards** (check-in system)
```json
{
  "rewardId": "string (primary key)",
  "userId": "string (foreign key → Users)",
  
  "date": "date (YYYY-MM-DD)",
  "day": "number (streak day)",
  
  "coinsEarned": "number",
  "bonusMultiplier": "number (for streaks)",
  
  "createdAt": "timestamp"
}
```

### 9. **AdRewards**
```json
{
  "adRewardId": "string (primary key)",
  "userId": "string (foreign key → Users)",
  
  "adType": "enum: rewarded_video, interstitial",
  "adProvider": "string (AdMob, Unity Ads, etc.)",
  
  "coinsEarned": "number",
  
  "adId": "string (tracking)",
  "ipAddress": "string (fraud prevention)",
  
  "createdAt": "timestamp"
}
```

### 10. **Categories**
```json
{
  "categoryId": "string (primary key)",
  "type": "enum: chat_bubble, profile_frame, art, sticker_pack, comic, book, freelance_gig",
  
  "name": "string",
  "description": "string",
  "icon": "string (url)",
  "coverImage": "string",
  
  "sortOrder": "number",
  "isActive": "boolean",
  
  "productCount": "number",
  
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 11. **AIGenerations** (tracking AI image generations)
```json
{
  "generationId": "string (primary key)",
  "userId": "string (foreign key → Users)",
  
  "type": "enum: text_to_image, image_to_image",
  
  // Input
  "prompt": "string",
  "negativePrompt": "string",
  "inputImage": "string (url, for image-to-image)",
  
  // Settings
  "model": "string (Leonardo model name)",
  "width": "number",
  "height": "number",
  "steps": "number",
  "guidanceScale": "number",
  
  // Output
  "outputImages": ["string (urls)"],
  
  // Costs
  "coinsCost": "number",
  
  // Status
  "status": "enum: pending, processing, completed, failed",
  "errorMessage": "string",
  
  "processingTime": "number (seconds)",
  
  "createdAt": "timestamp",
  "completedAt": "timestamp"
}
```

---

## Indexes (for query optimization)

### Products
- `sellerId` + `status` (get seller's products)
- `type` + `status` + `publishedAt` (category listings)
- `status` + `stats.rating` (popular products)
- `title` (text search)

### Orders
- `buyerId` + `createdAt` (buyer order history)
- `sellerId` + `status` (seller sales dashboard)
- `productId` + `status` (product sales tracking)

### Reviews
- `productId` + `createdAt` (product reviews)
- `buyerId` (user's reviews)
- `sellerId` + `rating` (seller reputation)

### Transactions
- `userId` + `createdAt` (transaction history)
- `walletId` + `type` + `createdAt`

### Withdrawals
- `userId` + `status` + `requestedAt`
- `status` (admin dashboard)

---

## Business Rules Implementation

### Commission Split (75/25)
```javascript
function calculateEarnings(price, currency) {
  if (currency === 'coins') {
    // Coins don't generate earnings
    return {
      platformFee: 0,
      sellerEarnings: 0
    };
  }
  
  // Diamonds: 75% to seller, 25% to platform
  const platformFee = price * 0.25;
  const sellerEarnings = price * 0.75;
  
  return { platformFee, sellerEarnings };
}
```

### Review-based Moderation
```javascript
// Auto-suspend product if average rating < 2.0 and reviews > 5
function checkProductModeration(product) {
  if (product.stats.reviewCount >= 5 && product.stats.rating < 2.0) {
    return 'SUSPEND_PRODUCT';
  }
  return 'OK';
}

// Suspend seller monetization if multiple products have bad ratings
function checkSellerModeration(sellerId) {
  const badProducts = Products.find({
    sellerId,
    'stats.reviewCount': { $gte: 5 },
    'stats.rating': { $lt: 2.5 }
  }).count();
  
  if (badProducts >= 3) {
    return 'SUSPEND_MONETIZATION';
  }
  return 'OK';
}
```

### Minimum Withdrawal Threshold
```javascript
function canWithdraw(wallet) {
  return wallet.withdrawableBalance >= wallet.minimumWithdrawal;
}
```
