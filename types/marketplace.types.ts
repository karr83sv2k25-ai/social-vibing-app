/**
 * Marketplace Type Definitions
 * Complete TypeScript interfaces for the 6-feature marketplace system
 */

// ==================== PRODUCT TYPES ====================

export type ProductType = 
  | 'comic' 
  | 'book' 
  | 'art' 
  | 'sticker_pack' 
  | 'profile_frame' 
  | 'chat_bubble';

export type Currency = 'coins' | 'diamonds';

// Base Product Interface
export interface Product {
  productId: string;
  type: ProductType;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  
  // Assets
  coverImage: string; // Storage URL
  previewUrl?: string; // Optional preview
  
  // Metadata
  creatorId: string;
  creatorName: string;
  isOfficial: boolean;
  
  // Stats
  stats: {
    rating: number; // 0-5
    reviews: number;
    downloads: number;
    purchaseCount: number;
  };
  
  // Status
  status: 'active' | 'inactive' | 'pending';
  tags: string[];
  category?: string;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// ==================== SPECIFIC PRODUCT TYPES ====================

// 📚 COMIC
export interface ComicProduct extends Product {
  type: 'comic';
  comicConfig: {
    pages: ComicPage[];
    totalPages: number;
    genre: string[];
    ageRating: 'Everyone' | 'Teen' | 'Mature';
    language: string;
  };
}

export interface ComicPage {
  pageNumber: number;
  imageUrl: string; // Full-res image in Storage
  thumbnailUrl?: string; // Optional thumb
}

// 📖 BOOK (eBook)
export interface BookProduct extends Product {
  type: 'book';
  bookConfig: {
    format: 'pdf' | 'epub' | 'text';
    fileUrl: string; // Storage URL
    fileSize: number; // bytes
    pageCount?: number;
    author: string;
    isbn?: string;
    genre: string[];
    language: string;
  };
}

// 🎨 ART (Digital Images)
export interface ArtProduct extends Product {
  type: 'art';
  artConfig: {
    fullResUrl: string; // High-res image
    thumbnailUrl: string; // Preview
    dimensions: {
      width: number;
      height: number;
    };
    fileSize: number;
    format: 'jpg' | 'png' | 'webp';
    artist: string;
    style?: string; // e.g., "Anime", "Realistic"
  };
}

// 🎭 STICKER PACK
export interface StickerPackProduct extends Product {
  type: 'sticker_pack';
  stickerPackConfig: {
    stickers: Sticker[];
    totalStickers: number;
    packTheme: string; // e.g., "Anime Expressions"
    animated: boolean;
  };
}

export interface Sticker {
  stickerId: string;
  imageUrl: string;
  emoji?: string; // Associated emoji
  tags?: string[];
}

// 🖼️ PROFILE FRAME
export interface ProfileFrameProduct extends Product {
  type: 'profile_frame';
  frameConfig: {
    frameUrl: string; // PNG with transparency
    previewUrl: string;
    dimensions: {
      width: number;
      height: number;
    };
    animated: boolean;
    theme: string; // e.g., "Gold Luxury", "Neon"
  };
}

// 💬 CHAT BUBBLE THEME
export interface ChatBubbleProduct extends Product {
  type: 'chat_bubble';
  bubbleConfig: {
    theme: BubbleTheme;
    previewImages: string[]; // Example screenshots
  };
}

export interface BubbleTheme {
  name: string;
  
  // Sent (User) Bubble Styles
  sentBubble: {
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
    borderWidth?: number;
    borderColor?: string;
    shadowColor?: string;
    shadowOpacity?: number;
    backgroundImage?: string; // Optional background pattern
  };
  
  // Received Bubble Styles
  receivedBubble: {
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
    borderWidth?: number;
    borderColor?: string;
    shadowColor?: string;
    shadowOpacity?: number;
    backgroundImage?: string;
  };
  
  // Chat Background
  chatBackground?: {
    backgroundColor?: string;
    backgroundImage?: string; // URL to pattern/image
  };
}

// ==================== USER & WALLET ====================

export interface User {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  
  // Wallet
  wallet: {
    coins: number;
    diamonds: number;
  };
  
  // Owned Items (for quick lookup)
  ownedProducts: string[]; // Array of productIds
  
  // Active Customizations
  activeCustomizations: {
    profileFrameId?: string;
    chatBubbleThemeId?: string;
  };
  
  // Timestamps
  createdAt: number;
  lastLogin: number;
}

// ==================== PURCHASE / ORDER ====================

export interface Order {
  orderId: string;
  userId: string;
  productId: string;
  productType: ProductType;
  
  // Payment
  price: number;
  currency: Currency;
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Timestamps
  createdAt: number;
  completedAt?: number;
}

// ==================== LIBRARY / INVENTORY ====================

export interface UserLibrary {
  userId: string;
  comics: string[]; // productIds
  books: string[]; // productIds
  art: string[]; // productIds
  stickerPacks: string[]; // productIds
  profileFrames: string[]; // productIds
  chatBubbles: string[]; // productIds
  
  updatedAt: number;
}

// ==================== API REQUESTS/RESPONSES ====================

export interface BuyProductRequest {
  productId: string;
}

export interface BuyProductResponse {
  success: boolean;
  message: string;
  orderId?: string;
  newCoinBalance?: number;
  newDiamondBalance?: number;
}

export interface CreditCoinsRequest {
  userId: string;
  amount: number;
  purchaseToken: string; // From Google/Apple IAP
  platform: 'android' | 'ios';
}

export interface CreditCoinsResponse {
  success: boolean;
  newBalance: number;
}
