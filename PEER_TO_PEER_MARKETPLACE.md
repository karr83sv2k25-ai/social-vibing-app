# 🚀 Peer-to-Peer Marketplace Guide

## Overview
Your marketplace now supports **user-to-user selling**! Any registered user can become a seller and create products to earn income.

---

## 🎯 For Buyers

### How to Buy Products
1. Open **Marketplace** tab
2. Browse products or search by category
3. Tap any product to view details
4. Tap **"Buy Now"** and confirm purchase
5. Product is added to your **Library** instantly

### Product Sources
- **Official Products**: Created by admins/verified creators (marked with ⭐)
- **User Products**: Created by sellers in the community

---

## 💼 For Sellers

### How to Become a Seller

1. **Open Marketplace**
   - Tap the **"Start Selling"** button at the top

2. **Setup Your Store**
   - Enter your **Store Name** (e.g., "Anime Art Studio")
   - Add a **Store Description** (optional)
   - Agree to the **Seller Terms**

3. **Start Selling**
   - Tap **"Start Selling Now"**
   - Your store is now live! 🎉

### Creating Products

#### Step 1: Access Product Creation
- From Marketplace → Tap **"My Store"**
- Or from Seller Dashboard → Tap **"Create New Product"**

#### Step 2: Product Creation Wizard (3 Steps)

**Step 1: Choose Product Type**
- 📚 Comics & Books
- 🎨 Digital Art
- 😊 Sticker Packs
- 🖼️ Profile Frames
- 💬 Chat Bubbles
- 💼 Freelance Services

**Step 2: Add Details & Assets**
- Upload cover image
- Add preview images
- Upload asset files (PDF, ZIP, etc.)
- Write description

**Step 3: Set Pricing**
- Choose currency (Coins or Diamonds)
- Set your price
- Review and publish

### Managing Your Products

#### Seller Dashboard Features
- **📊 Stats Overview**: Products, Sales, Earnings
- **💰 Earnings Balance**: Available for withdrawal
- **📦 Product Management**: Edit, Pause, or Delete products
- **📈 Sales Analytics**: Track performance

#### Product Actions
- **Edit**: Modify product details, images, or price
- **Pause/Activate**: Temporarily disable/enable product
- **Delete**: Permanently remove product
- **View**: See product detail page as buyers see it

---

## 💵 Earnings & Commissions

### Revenue Share
- **Sellers earn**: 70% of each sale
- **Platform fee**: 30%

### Example
- Product price: 100 coins
- Seller receives: 70 coins
- Platform fee: 30 coins

### Available Balance
- View on **Seller Dashboard**
- Updates instantly after each sale
- Tracked separately from wallet balance

### Withdrawals
- **Minimum**: 100 coins
- **Where**: Credited to your main wallet balance
- **How**: Seller Dashboard → "Withdraw Earnings"

---

## 📁 Product Categories

### 1. Comics (Type: `comic`)
**What**: Digital manga, comics, graphic novels
**Files**: PDF, CBZ
**Typical Price**: 50-150 coins

### 2. Books (Type: `book`)
**What**: E-books, guides, tutorials
**Files**: PDF, EPUB
**Typical Price**: 100-300 coins

### 3. Digital Art (Type: `art`)
**What**: Wallpapers, illustrations, designs
**Files**: PNG, JPG
**Typical Price**: 30-100 coins

### 4. Sticker Packs (Type: `sticker_pack`)
**What**: Chat stickers, emoji sets
**Files**: ZIP with PNG images
**Typical Price**: 20-50 coins

### 5. Profile Frames (Type: `profile_frame`)
**What**: Animated or static profile borders
**Files**: PNG with transparency
**Typical Price**: 50-200 diamonds

### 6. Chat Bubbles (Type: `chat_bubble`)
**What**: Custom message bubble styles
**Files**: Design assets
**Typical Price**: 30-100 diamonds

### 7. Freelance Services (Type: `freelance_gig`)
**What**: Custom art commissions, designs
**Files**: Portfolio examples
**Typical Price**: 500-5000 coins

---

## 🛡️ Seller Terms & Guidelines

### Requirements
✅ You must own or have rights to all content you sell
✅ Products must be original or properly licensed
✅ No copyrighted content without permission
✅ No offensive, illegal, or harmful content

### Product Quality Standards
- High-quality images (minimum 1000x1000px for covers)
- Complete asset files
- Accurate descriptions
- Working download links

### Prohibited Content
❌ Pirated or stolen content
❌ Explicit adult content
❌ Hate speech or offensive material
❌ Scams or misleading products
❌ Malware or harmful files

### Violations
- First offense: Warning + product removal
- Second offense: Temporary suspension (7 days)
- Third offense: Permanent seller ban + earnings forfeiture

---

## 🔧 Technical Details

### Database Structure

#### User Seller Fields
```javascript
{
  isSeller: true,
  sellerSince: "2025-01-15T10:30:00Z",
  storeName: "Anime Art Studio",
  storeDescription: "High-quality anime artwork",
  earningsBalance: 1250,  // Available to withdraw
  totalEarnings: 3500,    // All-time earnings
  sellerStats: {
    totalProducts: 15,
    totalSales: 127,
    rating: 4.8,
    reviews: 23
  }
}
```

#### Product Fields
```javascript
{
  productId: "prod_abc123",
  title: "Tokyo Sunset Art",
  description: "Beautiful digital art...",
  type: "art",
  price: 50,
  currency: "coins",
  coverImage: "https://...",
  previewImages: ["https://..."],
  assetFiles: ["https://..."],
  
  // Creator Info
  creatorId: "user123",
  creatorName: "ArtistName",
  creatorAvatar: "https://...",
  isOfficial: false,
  
  // Stats
  stats: {
    purchaseCount: 45,
    viewCount: 320,
    rating: 4.5,
    reviewCount: 12
  },
  
  status: "active", // or "inactive"
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Cloud Functions

#### `createProduct`
- **Auth**: Required (must be seller)
- **Input**: Product data
- **Output**: Created product with ID
- **Commission**: Marks isOfficial based on role

#### `buyProduct`
- **Auth**: Required
- **Input**: productId
- **Output**: Order confirmation
- **Commission**: Credits seller 70% if not official

---

## 🎨 UI Components

### Marketplace Home
- **"Start Selling"** button (if not seller)
- **"My Store"** button (if seller)
- Tabs: Popular, Freebies, Officials, Community's

### Seller Dashboard
- **Stats Cards**: Products, Sales, Earnings, Active
- **Earnings Card**: Balance + Withdraw button
- **Products List**: All seller's products with actions

### Product Creation Wizard
- **Step 1**: Type selection with icons
- **Step 2**: Image picker, document picker
- **Step 3**: Pricing and currency selection

---

## 🚀 Getting Started (Quick Start)

### For New Sellers

```bash
1. Open app → Marketplace tab
2. Tap "Start Selling" button
3. Enter store name → Agree to terms
4. Tap "Start Selling Now"
5. Tap "Create New Product"
6. Follow 3-step wizard
7. Publish and start earning!
```

### For Buyers

```bash
1. Open app → Marketplace tab
2. Browse products or tap category
3. Tap product → View details
4. Tap "Buy Now" → Confirm
5. Product appears in Library → Enjoy!
```

---

## 📊 Testing the Flow

### Test Seller Registration
```javascript
// Check user document after becoming seller
const userRef = doc(db, 'users', userId);
const userDoc = await getDoc(userRef);
console.log(userDoc.data().isSeller); // Should be true
console.log(userDoc.data().storeName); // Your store name
```

### Test Product Creation
```javascript
// Product should have creator info
console.log(product.creatorId);     // Your user ID
console.log(product.creatorName);   // Your display name
console.log(product.isOfficial);    // false for regular sellers
```

### Test Purchase & Earnings
```javascript
// After someone buys your product
// Check your earnings balance
const userRef = doc(db, 'users', sellerId);
const userDoc = await getDoc(userRef);
console.log(userDoc.data().earningsBalance); // Increased by 70% of price
```

---

## 🎯 Success Metrics

### For Sellers
- Track sales in dashboard
- Monitor earnings growth
- See product performance
- Manage active/inactive products

### For Platform
- User-to-user transactions
- Active seller count
- Community product variety
- Revenue from 30% commission

---

## 🆘 Troubleshooting

### "Permission Denied" When Creating Product
**Solution**: Make sure you've completed the "Become a Seller" flow first

### Products Not Showing
**Solution**: Check product status is "active" and no Firestore index errors

### Earnings Not Credited
**Solution**: Check buyer didn't purchase their own product (commissions only for other sellers)

### Can't Withdraw Earnings
**Solution**: Minimum withdrawal is 100 coins

---

## 📱 Screenshots Guide

### Key Screens
1. **Marketplace Home**: Shows "Start Selling" button
2. **Become Seller Screen**: Store setup form with benefits
3. **Seller Dashboard**: Stats, earnings, product list
4. **Product Creation Wizard**: 3-step product creation
5. **Product Detail**: Shows creator info for user products

---

## 🎉 Congratulations!

Your marketplace is now a **full peer-to-peer platform** where:
- ✅ Any user can become a seller
- ✅ Sellers create and manage products
- ✅ Automated 70/30 commission split
- ✅ Real-time earnings tracking
- ✅ Complete seller dashboard

**Start building your creative community economy!** 🚀
