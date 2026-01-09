# Digital Marketplace - REST API Endpoints

Base URL: `https://api.socialvibing.com/v1`

---

## **Authentication**
All endpoints (except public listings) require Bearer token:
```
Authorization: Bearer <user_token>
```

---

## **1. Products API**

### **GET** `/products`
Get paginated product listings

**Query Parameters:**
- `type` (optional): `chat_bubble`, `profile_frame`, `art`, `sticker_pack`, `comic`, `book`, `freelance_gig`
- `category` (optional): string
- `sort` (optional): `popular`, `recent`, `rating`, `price_low`, `price_high`
- `search` (optional): string (search in title/description)
- `page` (default: 1)
- `limit` (default: 20)
- `sellerId` (optional): filter by seller

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "productId": "prod_123",
        "title": "Cyberpunk Chat Bubble",
        "type": "chat_bubble",
        "price": 50,
        "currency": "diamonds",
        "coverImage": "https://...",
        "seller": {
          "userId": "user_456",
          "username": "ArtistPro",
          "avatar": "https://..."
        },
        "stats": {
          "rating": 4.8,
          "purchases": 234,
          "reviewCount": 45
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

---

### **GET** `/products/:productId`
Get single product details

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "prod_123",
    "title": "Cyberpunk Chat Bubble",
    "description": "Animated cyberpunk-themed chat bubble...",
    "type": "chat_bubble",
    "category": "Animated",
    "price": 50,
    "currency": "diamonds",
    "coverImage": "https://...",
    "previewImages": ["https://...", "https://..."],
    "assets": [
      {
        "type": "zip",
        "url": "https://...",
        "size": 1024000,
        "fileName": "bubble.zip"
      }
    ],
    "seller": {
      "userId": "user_456",
      "username": "ArtistPro",
      "displayName": "Professional Artist",
      "avatar": "https://...",
      "stats": {
        "averageRating": 4.7,
        "totalSales": 1234
      }
    },
    "stats": {
      "views": 5678,
      "purchases": 234,
      "rating": 4.8,
      "reviewCount": 45
    },
    "publishedAt": "2024-01-15T10:30:00Z",
    "hasPurchased": false
  }
}
```

---

### **POST** `/products`
Create new product (Step 3 of creation wizard)

**Request Body:**
```json
{
  "type": "chat_bubble",
  "title": "Neon Dreams Bubble",
  "description": "A vibrant neon-themed chat bubble",
  "category": "Animated",
  "price": 30,
  "currency": "diamonds",
  "coverImage": "https://...",
  "previewImages": ["https://...", "https://..."],
  "assets": [
    {
      "type": "zip",
      "url": "https://...",
      "size": 512000,
      "fileName": "neon_bubble.zip"
    }
  ],
  "status": "published"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "prod_789",
    "message": "Product published successfully"
  }
}
```

---

### **PUT** `/products/:productId`
Update existing product

**Request Body:** (same as POST, partial updates allowed)

---

### **DELETE** `/products/:productId`
Delete/unpublish product (soft delete)

---

### **GET** `/products/:productId/reviews`
Get product reviews

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `sort` (optional): `recent`, `rating_high`, `rating_low`

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "reviewId": "rev_123",
        "buyer": {
          "userId": "user_789",
          "username": "HappyBuyer",
          "avatar": "https://..."
        },
        "rating": 5,
        "comment": "Amazing quality!",
        "sellerResponse": "Thank you!",
        "createdAt": "2024-02-01T14:20:00Z"
      }
    ],
    "averageRating": 4.8,
    "ratingBreakdown": {
      "5": 30,
      "4": 10,
      "3": 3,
      "2": 1,
      "1": 1
    },
    "pagination": {
      "page": 1,
      "total": 45
    }
  }
}
```

---

## **2. Orders API**

### **POST** `/orders`
Create new order (purchase product)

**Request Body:**
```json
{
  "productId": "prod_123",
  "paymentMethod": "wallet"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_456",
    "productId": "prod_123",
    "price": 50,
    "currency": "diamonds",
    "status": "completed",
    "downloadUrl": "https://secure-download.com/...",
    "wallet": {
      "diamonds": 450
    }
  }
}
```

**Error Response (insufficient funds):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "You need 50 diamonds but only have 30",
    "required": 50,
    "available": 30
  }
}
```

---

### **GET** `/orders`
Get user's order history

**Query Parameters:**
- `type` (optional): `purchases`, `sales`
- `status` (optional): `pending`, `completed`, `cancelled`
- `page` (default: 1)
- `limit` (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "order_456",
        "product": {
          "productId": "prod_123",
          "title": "Cyberpunk Bubble",
          "coverImage": "https://..."
        },
        "price": 50,
        "currency": "diamonds",
        "status": "completed",
        "createdAt": "2024-02-10T09:15:00Z",
        "downloadUrl": "https://..."
      }
    ],
    "pagination": {
      "page": 1,
      "total": 23
    }
  }
}
```

---

### **GET** `/orders/:orderId`
Get single order details

---

### **POST** `/orders/:orderId/review`
Submit review for purchased product

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Excellent product!"
}
```

---

### **GET** `/orders/:orderId/download`
Get secure download link for purchased digital product

---

## **3. Wallet API**

### **GET** `/wallet`
Get user's wallet balances

**Response:**
```json
{
  "success": true,
  "data": {
    "walletId": "wallet_123",
    "coins": 150,
    "diamonds": 450,
    "earningsBalance": 1200,
    "withdrawableBalance": 900,
    "pendingEarnings": 300,
    "minimumWithdrawal": 50,
    "lifetimeEarnings": 5670
  }
}
```

---

### **GET** `/wallet/transactions`
Get transaction history

**Query Parameters:**
- `type` (optional): filter by transaction type
- `currency` (optional): `coins`, `diamonds`
- `page`, `limit`

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "txn_789",
        "type": "diamond_earned",
        "amount": 37.5,
        "currency": "diamonds",
        "description": "Sale: Cyberpunk Bubble",
        "balanceBefore": 412.5,
        "balanceAfter": 450,
        "createdAt": "2024-02-10T09:15:00Z"
      },
      {
        "transactionId": "txn_788",
        "type": "coin_spent",
        "amount": -10,
        "currency": "coins",
        "description": "AI Image Generation",
        "balanceBefore": 160,
        "balanceAfter": 150,
        "createdAt": "2024-02-09T16:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "total": 145
    }
  }
}
```

---

### **POST** `/wallet/coins/purchase`
Purchase coins via IAP

**Request Body:**
```json
{
  "packageId": "coins_100",
  "paymentMethod": "stripe",
  "paymentToken": "tok_xxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_999",
    "coinsAdded": 100,
    "newBalance": 250
  }
}
```

---

### **POST** `/wallet/daily-reward`
Claim daily login reward

**Response:**
```json
{
  "success": true,
  "data": {
    "coinsEarned": 10,
    "streakDay": 5,
    "bonusMultiplier": 1.5,
    "totalCoins": 15,
    "newBalance": 165,
    "nextRewardAt": "2024-02-11T00:00:00Z"
  }
}
```

---

### **POST** `/wallet/ad-reward`
Claim rewarded ad coins

**Request Body:**
```json
{
  "adType": "rewarded_video",
  "adProvider": "admob",
  "adId": "ad_12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coinsEarned": 5,
    "newBalance": 170
  }
}
```

---

## **4. Withdrawals API**

### **POST** `/withdrawals`
Request withdrawal

**Request Body:**
```json
{
  "amount": 500,
  "method": "paypal",
  "paypalEmail": "seller@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "withdrawalId": "withdraw_123",
    "amount": 500,
    "amountUSD": 50.00,
    "status": "pending",
    "estimatedProcessingTime": "3-5 business days"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "BELOW_MINIMUM",
    "message": "Minimum withdrawal is 50 diamonds",
    "required": 50,
    "available": 30
  }
}
```

---

### **GET** `/withdrawals`
Get withdrawal history

---

### **GET** `/withdrawals/:withdrawalId`
Get single withdrawal status

---

## **5. Creator Dashboard API**

### **GET** `/creator/stats`
Get seller statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalProducts": 12,
      "activeProducts": 10,
      "totalSales": 234,
      "totalRevenue": 8775,
      "averageRating": 4.7
    },
    "earnings": {
      "thisMonth": 450,
      "lastMonth": 380,
      "lifetime": 8775,
      "pending": 120
    },
    "recentSales": [
      {
        "orderId": "order_789",
        "product": "Cyberpunk Bubble",
        "buyer": "User123",
        "amount": 37.5,
        "date": "2024-02-10T09:15:00Z"
      }
    ],
    "topProducts": [
      {
        "productId": "prod_123",
        "title": "Cyberpunk Bubble",
        "sales": 67,
        "revenue": 2512.5,
        "rating": 4.8
      }
    ]
  }
}
```

---

### **GET** `/creator/products`
Get seller's products (with draft support)

---

## **6. Categories API**

### **GET** `/categories`
Get all marketplace categories (8 monetization features)

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "categoryId": "cat_1",
        "type": "chat_bubble",
        "name": "Chat Bubbles",
        "description": "Customize your chat experience",
        "icon": "https://.../chatbubbles.png",
        "productCount": 234
      },
      {
        "categoryId": "cat_2",
        "type": "profile_frame",
        "name": "Profile Frames",
        "description": "Stand out with unique frames",
        "icon": "https://.../profileframe.png",
        "productCount": 189
      },
      {
        "categoryId": "cat_3",
        "type": "art",
        "name": "Art Gallery",
        "description": "Original artworks (No AI)",
        "icon": "https://.../photos.png",
        "productCount": 456
      },
      {
        "categoryId": "cat_4",
        "type": "sticker_pack",
        "name": "Sticker Packs",
        "description": "Express yourself with stickers",
        "icon": "https://.../stickers.png",
        "productCount": 312
      },
      {
        "categoryId": "cat_5",
        "type": "comic",
        "name": "Comics & Manga",
        "description": "Digital comics and manga",
        "icon": "https://.../comics.png",
        "productCount": 145
      },
      {
        "categoryId": "cat_6",
        "type": "book",
        "name": "E-Books",
        "description": "Digital books and novels",
        "icon": "https://.../books.png",
        "productCount": 89
      },
      {
        "categoryId": "cat_7",
        "type": "freelance_gig",
        "name": "Freelancing",
        "description": "Hire talented creators",
        "icon": "https://.../freelance.png",
        "productCount": 267
      }
    ]
  }
}
```

---

## **7. AI Image Generator API**

### **POST** `/ai/generate`
Generate AI image (text-to-image or image-to-image)

**Request Body:**
```json
{
  "type": "text_to_image",
  "prompt": "A cyberpunk city at night with neon lights",
  "negativePrompt": "blurry, low quality",
  "model": "leonardo-diffusion-xl",
  "width": 1024,
  "height": 1024,
  "steps": 30,
  "guidanceScale": 7.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "generationId": "gen_123",
    "status": "processing",
    "coinsCost": 10,
    "newCoinBalance": 140,
    "estimatedTime": 30,
    "pollUrl": "/ai/generate/gen_123"
  }
}
```

**Error Response (insufficient coins):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_COINS",
    "message": "You need 10 coins but only have 5",
    "required": 10,
    "available": 5
  }
}
```

---

### **GET** `/ai/generate/:generationId`
Check AI generation status

**Response (completed):**
```json
{
  "success": true,
  "data": {
    "generationId": "gen_123",
    "status": "completed",
    "outputImages": [
      "https://storage.com/gen_123_1.png",
      "https://storage.com/gen_123_2.png"
    ],
    "prompt": "A cyberpunk city...",
    "processingTime": 28,
    "createdAt": "2024-02-10T10:00:00Z",
    "completedAt": "2024-02-10T10:00:28Z"
  }
}
```

---

### **GET** `/ai/history`
Get user's AI generation history

---

### **GET** `/ai/pricing`
Get AI generation pricing tiers

**Response:**
```json
{
  "success": true,
  "data": {
    "pricing": {
      "text_to_image": {
        "512x512": 5,
        "1024x1024": 10,
        "1536x1536": 15
      },
      "image_to_image": {
        "512x512": 7,
        "1024x1024": 12,
        "1536x1536": 18
      }
    },
    "models": [
      {
        "id": "leonardo-diffusion-xl",
        "name": "Leonardo Diffusion XL",
        "description": "High quality general purpose model"
      }
    ]
  }
}
```

---

## **8. Reviews & Reports API**

### **POST** `/products/:productId/report`
Report a product for moderation

**Request Body:**
```json
{
  "reason": "inappropriate_content",
  "details": "Contains offensive imagery"
}
```

---

### **POST** `/reviews/:reviewId/report`
Report a review

---

### **POST** `/users/:userId/report`
Report a seller

---

## **9. Freelance Gigs API** (using Viserlance/Hirezy backend)

### **GET** `/freelance/gigs`
List freelance gigs (similar to `/products` but with gig-specific fields)

---

### **POST** `/freelance/orders/:orderId/deliver`
Seller delivers work for freelance gig

**Request Body:**
```json
{
  "message": "Here's your completed work!",
  "deliverables": [
    {
      "fileName": "final_design.psd",
      "url": "https://..."
    }
  ]
}
```

---

### **POST** `/freelance/orders/:orderId/complete`
Buyer marks order as complete

---

### **POST** `/freelance/orders/:orderId/dispute`
Open dispute for freelance order

---

## **10. Asset Upload API**

### **POST** `/upload`
Upload asset for product creation

**Request:** `multipart/form-data`
- `file`: File binary
- `type`: `image`, `video`, `pdf`, `zip`

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://cdn.socialvibing.com/uploads/abc123.zip",
    "thumbnail": "https://cdn.socialvibing.com/uploads/abc123_thumb.jpg",
    "size": 1024000,
    "fileName": "bubble_pack.zip"
  }
}
```

---

## **Integration Endpoints for External Scripts**

### **Proxy to Leonardo AI**
`POST /integrations/leonardo/generate` → Internal call to Leonardo script

### **Proxy to PlayTube**
`GET /integrations/playtube/channels/:channelId` → Fetch channel data  
`POST /integrations/playtube/subscribe` → Subscribe to channel

### **Proxy to Freelance Backend (Viserlance/Hirezy)**
`GET /integrations/freelance/gigs` → Fetch from Viserlance DB  
`POST /integrations/freelance/orders` → Create order in Viserlance

### **Proxy to Komiko (Comics)**
`POST /integrations/komiko/comic/create` → Create comic project  
`GET /integrations/komiko/comic/:comicId` → Get comic data

---

## **Error Codes**

| Code | Description |
|------|-------------|
| `INSUFFICIENT_FUNDS` | Not enough coins/diamonds |
| `INSUFFICIENT_COINS` | Not enough coins for AI generation |
| `BELOW_MINIMUM` | Withdrawal below minimum threshold |
| `PRODUCT_NOT_FOUND` | Product doesn't exist |
| `ALREADY_PURCHASED` | User already owns this product |
| `SELLER_SUSPENDED` | Seller's monetization is suspended |
| `PRODUCT_SUSPENDED` | Product is suspended/hidden |
| `UNAUTHORIZED` | Invalid or missing auth token |
| `VALIDATION_ERROR` | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
