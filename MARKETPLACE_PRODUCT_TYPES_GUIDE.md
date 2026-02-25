# Marketplace Product Types Implementation Guide

## Overview
This implementation provides a comprehensive system for handling different product types in the marketplace, each with its own specialized upload process and usage methods.

## Product Types Supported

### 1. **Chat Bubbles** (`chat_bubble`)
- **Purpose**: Custom chat bubble themes with unique styles and colors
- **Upload Requirements**:
  - Cover image (1:1 ratio)
  - 2-5 preview images showing sent/received styles
  - Bubble images (PNG) and optional JSON config
  - Metadata: bubble style, animation flag, color scheme
- **Usage**:
  - Navigate to `BubbleCustomizer` screen
  - Preview chat messages with the theme
  - Apply to user's active customizations
  - Works in all chat screens

### 2. **Profile Frames** (`profile_frame`)
- **Purpose**: Decorative frames for profile pictures
- **Upload Requirements**:
  - Cover image (1:1 ratio)
  - 1-4 preview images
  - Transparent PNG frame (1000x1000px recommended)
  - Metadata: frame style, animated flag, seasonal theme
- **Usage**:
  - Navigate to `FrameCustomizer` screen
  - Preview with user's avatar
  - Apply as overlay on profile picture
  - Visible on posts, comments, and profile

### 3. **Sticker Packs** (`sticker_pack`)
- **Purpose**: Collection of stickers for messaging
- **Upload Requirements**:
  - Cover image (1:1 ratio)
  - 3-8 preview images
  - 5-50 sticker images (PNG/WebP)
  - Metadata: sticker count, pack theme, animated flag
- **Usage**:
  - Access via sticker picker in chat
  - Browse and send individual stickers
  - Stored in user's sticker library

### 4. **Artwork** (`art`)
- **Purpose**: Digital artwork and illustrations
- **Upload Requirements**:
  - Cover image (any ratio)
  - 1-5 preview images
  - High-resolution image file (JPEG/PNG/WebP)
  - Metadata: art style, resolution, NSFW flag
- **Usage**:
  - View in full resolution
  - Download/save option
  - Share to social feed

### 5. **Comics** (`comic`)
- **Purpose**: Digital comics and manga
- **Upload Requirements**:
  - Cover image (2:3 ratio)
  - 2-5 preview pages
  - PDF, CBZ, or ZIP of images
  - Metadata: page count, genre, series info
- **Usage**:
  - Open in comic reader
  - Swipe through pages
  - Bookmark progress
  - Stored in comics library

### 6. **E-Books** (`book`)
- **Purpose**: E-books and digital literature
- **Upload Requirements**:
  - Cover image (2:3 ratio)
  - 1-3 preview images
  - PDF or EPUB file
  - Metadata: page count, genre, author, language
- **Usage**:
  - Open in book reader
  - Adjustable text size
  - Bookmark pages
  - Stored in books library

### 7. **Freelance Gigs** (`freelance_gig`)
- **Purpose**: Custom freelance services
- **Upload Requirements**:
  - Cover image (16:9 ratio)
  - 2-6 preview images (portfolio samples)
  - Optional sample files
  - Metadata: delivery time, revisions, service type, skill level
- **Usage**:
  - Create custom order
  - Direct communication with seller
  - Milestone-based delivery
  - Review and revision system

## Key Files

### Configuration
- **`config/productTypeConfig.js`**: Central configuration for all product types
  - Asset requirements
  - Metadata fields
  - Validation rules
  - Usage configuration

### Upload Screens
- **`screens/marketplace/ProductTypeSelectionScreen.js`**: Choose product type
- **`screens/marketplace/TypeSpecificUploadScreen.js`**: Type-specific upload form
- **`screens/marketplace/ProductCreationWizardScreen.js`**: Legacy wizard (redirects to TypeSpecific)

### Customizer/Usage Screens
- **`screens/marketplace/BubbleCustomizerScreen.js`**: Chat bubble preview and apply
- **`screens/marketplace/FrameCustomizerScreen.js`**: Profile frame preview and apply
- Additional customizers can be created following the same pattern

### Marketplace Screens
- **`marketplace.js`**: Main marketplace with featured stores section
- **`screens/marketplace/SellerStoreScreen.js`**: Individual seller storefront
- **`screens/marketplace/ProductDetailScreen.js`**: Product details and purchase

### Navigation
- **`navigation/MarketplaceNavigator.js`**: All marketplace routes

## User Flows

### Seller Flow
1. Navigate to Seller Dashboard
2. Click "Create Product"
3. Select product type
4. Fill type-specific upload form
5. Upload assets (images, files)
6. Add metadata
7. Set price
8. Publish
9. Product appears in marketplace and seller's store

### Buyer Flow - Chat Bubbles Example
1. Browse marketplace or search for chat bubbles
2. Click on bubble product
3. View product details
4. Purchase with coins/diamonds
5. Added to library
6. Navigate to "My Library" → "Chat Themes"
7. Click on purchased bubble
8. Opens BubbleCustomizer
9. Preview messages with theme
10. Click "Apply Theme"
11. Theme active in all chats

### Buyer Flow - Profile Frames Example
1. Find frame product
2. Purchase
3. Navigate to library
4. Click on purchased frame
5. Opens FrameCustomizer
6. Preview with own avatar
7. Click "Apply Frame"
8. Frame visible on profile, posts, comments

## Store Display

### Featured Stores Section
- Shows sellers with published products
- Displays seller avatar, name, rating
- Shows product count
- Click to view full store

### Seller Store Page
- Seller banner with stats
- Category filter
- Product grid
- Individual product navigation

## Database Structure

### Products Collection
```javascript
{
  productId: 'string',
  sellerId: 'string',
  type: 'chat_bubble|profile_frame|...', 
  title: 'string',
  description: 'string',
  price: number,
  currency: 'coins|diamonds',
  coverImage: 'url',
  previewImages: ['url'],
  assets: [{
    type: 'image|pdf|zip|json',
    url: 'string',
    fileName: 'string',
    size: number
  }],
  metadata: {
    // Type-specific fields
  },
  status: 'published',
  stats: {
    purchaseCount: number,
    rating: number
  }
}
```

### Libraries Collection
```javascript
{
  userId: 'string',
  comics: ['productId'],
  books: ['productId'],
  art: ['productId'],
  stickerPacks: ['productId'],
  profileFrames: ['productId'],
  chatBubbles: ['productId']
}
```

### Users Collection (Active Customizations)
```javascript
{
  userId: 'string',
  activeCustomizations: {
    chatBubbleThemeId: 'productId',
    chatBubbleTheme: {
      productId: 'string',
      title: 'string',
      assets: [],
      appliedAt: 'timestamp'
    },
    profileFrameId: 'productId',
    profileFrame: {
      productId: 'string',
      frameImage: 'url',
      appliedAt: 'timestamp'
    }
  }
}
```

## Integration Points

### Chat Integration
- Check user's `activeCustomizations.chatBubbleTheme`
- Apply bubble styles to message components
- Use custom colors, borders, backgrounds from theme assets

### Profile Integration
- Check user's `activeCustomizations.profileFrame`
- Overlay frame image on profile picture
- Display in profile header, post avatars, comment avatars

### Library Integration
- GenericLibraryScreen displays purchased items by type
- Navigates to appropriate customizer/viewer screen
- Filter and search within library

## Future Enhancements

1. **Animated Products**: Support for GIF/Lottie animations
2. **Product Bundles**: Group multiple products together
3. **Limited Editions**: Time-limited or quantity-limited products
4. **Collaborations**: Multiple creators on one product
5. **Product Reviews**: Rating and review system
6. **Product Updates**: Sellers can update existing products
7. **Subscription Products**: Recurring content/services
8. **Product Analytics**: Detailed stats for sellers

## Testing Checklist

- [ ] Create product for each type
- [ ] Upload various asset formats
- [ ] Purchase products
- [ ] Apply chat bubble theme
- [ ] Apply profile frame
- [ ] View artwork in full resolution
- [ ] Read comic in reader
- [ ] Read book in reader
- [ ] Browse sticker pack
- [ ] Order freelance gig
- [ ] View seller store
- [ ] Filter products by category
- [ ] Search products
- [ ] Library displays correct items
- [ ] Active customizations persist

## Troubleshooting

### Products not showing in marketplace
- Check product status is 'published'
- Verify sellerId matches user.uid
- Check Firestore indexes are built

### Assets not loading
- Verify URLs are publicly accessible
- Check image formats are supported
- Ensure file sizes are within limits

### Customizations not applying
- Check user document has activeCustomizations field
- Verify productId references exist
- Check asset URLs are valid

### Store not appearing
- Verify user has isSeller: true
- Check user has published products
- Verify query indexes exist

## Support

For issues or questions:
1. Check console logs for specific errors
2. Verify Firestore rules allow read/write
3. Check navigation setup includes all new screens
4. Ensure all dependencies are installed
