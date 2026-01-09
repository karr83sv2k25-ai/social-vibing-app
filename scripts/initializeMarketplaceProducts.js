/**
 * Initialize Marketplace with Sample Products
 * Run this script to populate Firestore with sample products for all 6 types
 * 
 * Usage: node initializeMarketplaceProducts.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to add your service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Sample product data for all 6 types
const sampleProducts = [
  // ===== COMICS =====
  {
    productId: 'comic_001',
    type: 'comic',
    title: 'Attack on Titan: Origins',
    description: 'Experience the epic origin story of the Survey Corps and the first encounters with the Titans. A thrilling adventure filled with action, mystery, and unforgettable characters.',
    price: 100,
    currency: 'coins',
    coverImage: 'https://firebasestorage.googleapis.com/v0/b/your-app/o/comics%2Fcomic_001_cover.jpg?alt=media',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: {
      rating: 5,
      reviews: 1250,
      downloads: 8500,
      purchaseCount: 8500,
    },
    status: 'active',
    tags: ['action', 'adventure', 'manga', 'popular'],
    category: 'Action',
    comicConfig: {
      pages: [
        { pageNumber: 1, imageUrl: 'https://example.com/page1.jpg' },
        { pageNumber: 2, imageUrl: 'https://example.com/page2.jpg' },
        // Add more pages...
      ],
      totalPages: 45,
      genre: ['Action', 'Adventure', 'Drama'],
      ageRating: 'Teen',
      language: 'English',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'comic_002',
    type: 'comic',
    title: 'My Hero Academia: All Might Special',
    description: 'The untold story of All Might before he became the Symbol of Peace. Discover his journey, struggles, and the battles that shaped him.',
    price: 80,
    currency: 'coins',
    coverImage: 'https://example.com/mha_cover.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 980, downloads: 6200, purchaseCount: 6200 },
    status: 'active',
    tags: ['superhero', 'action', 'shonen'],
    comicConfig: {
      pages: [],
      totalPages: 38,
      genre: ['Action', 'Superhero'],
      ageRating: 'Everyone',
      language: 'English',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'comic_003',
    type: 'comic',
    title: 'Death Note: L Chronicles',
    description: 'Follow L\'s greatest cases before he encountered Light Yagami. A psychological thriller that will keep you on the edge of your seat.',
    price: 120,
    currency: 'coins',
    coverImage: 'https://example.com/deathnote_cover.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 1500, downloads: 9800, purchaseCount: 9800 },
    status: 'active',
    tags: ['mystery', 'thriller', 'psychological'],
    comicConfig: {
      pages: [],
      totalPages: 52,
      genre: ['Mystery', 'Thriller', 'Psychological'],
      ageRating: 'Mature',
      language: 'English',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== BOOKS =====
  {
    productId: 'book_001',
    type: 'book',
    title: 'The Art of Character Design',
    description: 'A comprehensive guide to creating memorable anime and manga characters. Learn from industry professionals and master the fundamentals of character design.',
    price: 150,
    currency: 'coins',
    coverImage: 'https://example.com/art_book_cover.jpg',
    creatorId: 'official',
    creatorName: 'Design Academy',
    isOfficial: true,
    stats: { rating: 5, reviews: 450, downloads: 2800, purchaseCount: 2800 },
    status: 'active',
    tags: ['art', 'tutorial', 'design', 'educational'],
    bookConfig: {
      format: 'pdf',
      fileUrl: 'https://example.com/character_design.pdf',
      fileSize: 15728640, // 15 MB
      pageCount: 180,
      author: 'Hiroshi Tanaka',
      genre: ['Educational', 'Art'],
      language: 'English',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'book_002',
    type: 'book',
    title: 'Anime Drawing Techniques Vol. 1',
    description: 'Master the fundamentals of anime drawing with step-by-step tutorials, tips from professionals, and practice exercises.',
    price: 100,
    currency: 'coins',
    coverImage: 'https://example.com/drawing_book.jpg',
    creatorId: 'official',
    creatorName: 'Art Masters',
    isOfficial: true,
    stats: { rating: 4, reviews: 320, downloads: 1900, purchaseCount: 1900 },
    status: 'active',
    tags: ['tutorial', 'drawing', 'beginner'],
    bookConfig: {
      format: 'pdf',
      fileUrl: 'https://example.com/drawing_techniques.pdf',
      fileSize: 12582912,
      pageCount: 150,
      author: 'Yuki Matsumoto',
      genre: ['Educational', 'Art'],
      language: 'English',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== ART =====
  {
    productId: 'art_001',
    type: 'art',
    title: 'Sunset Over Tokyo',
    description: 'A breathtaking digital artwork capturing the magical moment when the sun sets over Tokyo\'s skyline. Perfect for wallpapers and backgrounds.',
    price: 50,
    currency: 'coins',
    coverImage: 'https://example.com/tokyo_sunset_thumb.jpg',
    creatorId: 'artist_001',
    creatorName: 'Sakura Artist',
    isOfficial: false,
    stats: { rating: 5, reviews: 180, downloads: 1200, purchaseCount: 1200 },
    status: 'active',
    tags: ['landscape', 'digital-art', 'wallpaper', 'tokyo'],
    artConfig: {
      fullResUrl: 'https://example.com/tokyo_sunset_4k.jpg',
      thumbnailUrl: 'https://example.com/tokyo_sunset_thumb.jpg',
      dimensions: { width: 3840, height: 2160 },
      fileSize: 8388608, // 8 MB
      format: 'jpg',
      artist: 'Sakura Artist',
      style: 'Digital Illustration',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'art_002',
    type: 'art',
    title: 'Anime Girl Portrait - Neon Style',
    description: 'Vibrant neon-themed portrait of an anime character. Features stunning colors and detailed artwork.',
    price: 75,
    currency: 'coins',
    coverImage: 'https://example.com/neon_portrait.jpg',
    creatorId: 'artist_002',
    creatorName: 'Neon Dreams',
    isOfficial: false,
    stats: { rating: 5, reviews: 250, downloads: 1800, purchaseCount: 1800 },
    status: 'active',
    tags: ['portrait', 'neon', 'cyberpunk', 'anime'],
    artConfig: {
      fullResUrl: 'https://example.com/neon_portrait_full.png',
      thumbnailUrl: 'https://example.com/neon_portrait_thumb.jpg',
      dimensions: { width: 2480, height: 3508 },
      fileSize: 10485760,
      format: 'png',
      artist: 'Neon Dreams',
      style: 'Cyberpunk',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== STICKER PACKS =====
  {
    productId: 'sticker_001',
    type: 'sticker_pack',
    title: 'Kawaii Emotions Pack',
    description: 'Express yourself with 24 adorable kawaii emotion stickers! Perfect for chats, featuring cute anime-style expressions.',
    price: 30,
    currency: 'coins',
    coverImage: 'https://example.com/kawaii_pack_cover.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 890, downloads: 5600, purchaseCount: 5600 },
    status: 'active',
    tags: ['kawaii', 'emotions', 'cute', 'popular'],
    stickerPackConfig: {
      stickers: [
        { stickerId: 's001', imageUrl: 'https://example.com/sticker1.png', emoji: '😊' },
        { stickerId: 's002', imageUrl: 'https://example.com/sticker2.png', emoji: '😭' },
        { stickerId: 's003', imageUrl: 'https://example.com/sticker3.png', emoji: '😍' },
        // Add 21 more stickers...
      ],
      totalStickers: 24,
      packTheme: 'Kawaii Emotions',
      animated: false,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'sticker_002',
    type: 'sticker_pack',
    title: 'Anime Reaction Pack',
    description: '30 hilarious anime reaction stickers for every situation. From shock to joy, express it all!',
    price: 40,
    currency: 'coins',
    coverImage: 'https://example.com/reaction_pack.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 720, downloads: 4500, purchaseCount: 4500 },
    status: 'active',
    tags: ['reactions', 'anime', 'funny'],
    stickerPackConfig: {
      stickers: [],
      totalStickers: 30,
      packTheme: 'Anime Reactions',
      animated: false,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== PROFILE FRAMES =====
  {
    productId: 'frame_001',
    type: 'profile_frame',
    title: 'Golden Luxury Frame',
    description: 'Stand out with this elegant golden frame. Perfect for VIP users who want to showcase their status.',
    price: 200,
    currency: 'diamonds',
    coverImage: 'https://example.com/golden_frame.png',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 450, downloads: 3200, purchaseCount: 3200 },
    status: 'active',
    tags: ['luxury', 'vip', 'gold', 'premium'],
    frameConfig: {
      frameUrl: 'https://example.com/golden_frame_full.png',
      previewUrl: 'https://example.com/golden_frame_preview.png',
      dimensions: { width: 500, height: 500 },
      animated: false,
      theme: 'Gold Luxury',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'frame_002',
    type: 'profile_frame',
    title: 'Neon Cyberpunk Frame',
    description: 'Futuristic neon frame with animated glowing effects. Perfect for tech enthusiasts.',
    price: 150,
    currency: 'diamonds',
    coverImage: 'https://example.com/neon_frame.png',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 380, downloads: 2800, purchaseCount: 2800 },
    status: 'active',
    tags: ['neon', 'cyberpunk', 'animated', 'futuristic'],
    frameConfig: {
      frameUrl: 'https://example.com/neon_frame_full.png',
      previewUrl: 'https://example.com/neon_frame_preview.png',
      dimensions: { width: 500, height: 500 },
      animated: true,
      theme: 'Neon Cyberpunk',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== CHAT BUBBLE THEMES =====
  {
    productId: 'bubble_001',
    type: 'chat_bubble',
    title: 'Dark Galaxy Theme',
    description: 'Transform your chat with this stunning dark galaxy theme featuring gradient bubbles and starry backgrounds.',
    price: 100,
    currency: 'diamonds',
    coverImage: 'https://example.com/galaxy_theme.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 620, downloads: 4200, purchaseCount: 4200 },
    status: 'active',
    tags: ['dark', 'galaxy', 'premium', 'gradient'],
    bubbleConfig: {
      theme: {
        name: 'Dark Galaxy',
        sentBubble: {
          backgroundColor: '#7C3AED',
          textColor: '#FFFFFF',
          borderRadius: 18,
          borderWidth: 0,
        },
        receivedBubble: {
          backgroundColor: '#374151',
          textColor: '#FFFFFF',
          borderRadius: 18,
          borderWidth: 0,
        },
        chatBackground: {
          backgroundColor: '#0B0B0E',
          backgroundImage: 'https://example.com/galaxy_bg.jpg',
        },
      },
      previewImages: [
        'https://example.com/galaxy_preview1.jpg',
        'https://example.com/galaxy_preview2.jpg',
      ],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productId: 'bubble_002',
    type: 'chat_bubble',
    title: 'Pastel Dream Theme',
    description: 'Soft and cute pastel-colored chat theme. Perfect for kawaii lovers!',
    price: 80,
    currency: 'diamonds',
    coverImage: 'https://example.com/pastel_theme.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 480, downloads: 3400, purchaseCount: 3400 },
    status: 'active',
    tags: ['pastel', 'kawaii', 'cute', 'soft'],
    bubbleConfig: {
      theme: {
        name: 'Pastel Dream',
        sentBubble: {
          backgroundColor: '#FFB7D5',
          textColor: '#4A5568',
          borderRadius: 20,
          borderWidth: 0,
        },
        receivedBubble: {
          backgroundColor: '#D4E4FF',
          textColor: '#4A5568',
          borderRadius: 20,
          borderWidth: 0,
        },
        chatBackground: {
          backgroundColor: '#FFF5F7',
        },
      },
      previewImages: ['https://example.com/pastel_preview.jpg'],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Function to initialize products
async function initializeProducts() {
  console.log('🚀 Starting marketplace initialization...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const product of sampleProducts) {
    try {
      await db.collection('products').doc(product.productId).set(product);
      console.log(`✅ Added ${product.type}: ${product.title}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to add ${product.title}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Initialization Complete:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`\n🎉 Marketplace is ready!`);
}

// Run the initialization
initializeProducts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  });
