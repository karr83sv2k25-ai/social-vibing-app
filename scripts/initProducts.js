// Node.js script to initialize marketplace products
// Run with: node scripts/initProducts.js

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc, Timestamp } = require('firebase/firestore');

// Firebase web configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8GUTKesMY2Hpv-D3JS0vUG3CnD6yhRgc",
  authDomain: "social-vibing-karr.firebaseapp.com",
  projectId: "social-vibing-karr",
  storageBucket: "social-vibing-karr.firebasestorage.app",
  messagingSenderId: "907907966035",
  appId: "1:907907966035:web:eca4797d3d76e6f00552a6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample products for all 6 types
const sampleProducts = [
  // ===== COMICS =====
  {
    productId: 'comic_001',
    type: 'comic',
    title: 'Attack on Titan: Origins',
    description: 'Experience the epic origin story of the Survey Corps.',
    price: 100,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder1.jpg',
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
    tags: ['action', 'adventure', 'manga'],
    comicConfig: {
      pages: [],
      totalPages: 45,
      genre: ['Action', 'Adventure'],
      ageRating: 'Teen',
      language: 'English',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    productId: 'comic_002',
    type: 'comic',
    title: 'My Hero Academia Special',
    description: 'The untold story of All Might.',
    price: 80,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder2.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 980, downloads: 6200, purchaseCount: 6200 },
    status: 'active',
    tags: ['superhero', 'action'],
    comicConfig: {
      pages: [],
      totalPages: 38,
      genre: ['Action', 'Superhero'],
      ageRating: 'Everyone',
      language: 'English',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },

  // ===== BOOKS =====
  {
    productId: 'book_001',
    type: 'book',
    title: 'The Art of Character Design',
    description: 'Master character design fundamentals.',
    price: 150,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder3.jpg',
    creatorId: 'official',
    creatorName: 'Design Academy',
    isOfficial: true,
    stats: { rating: 5, reviews: 450, downloads: 2800, purchaseCount: 2800 },
    status: 'active',
    tags: ['art', 'tutorial', 'educational'],
    bookConfig: {
      format: 'pdf',
      fileUrl: 'https://example.com/character_design.pdf',
      fileSize: 15728640,
      pageCount: 180,
      author: 'Hiroshi Tanaka',
      genre: ['Educational', 'Art'],
      language: 'English',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },

  // ===== ART =====
  {
    productId: 'art_001',
    type: 'art',
    title: 'Sunset Over Tokyo',
    description: 'Breathtaking digital artwork.',
    price: 50,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder4.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 180, downloads: 1200, purchaseCount: 1200 },
    status: 'active',
    tags: ['landscape', 'digital-art', 'wallpaper'],
    artConfig: {
      fullResUrl: 'https://example.com/tokyo_sunset_4k.jpg',
      thumbnailUrl: 'https://example.com/tokyo_sunset_thumb.jpg',
      dimensions: { width: 3840, height: 2160 },
      fileSize: 8388608,
      format: 'jpg',
      artist: 'Sakura Artist',
      style: 'Digital Illustration',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    productId: 'art_002',
    type: 'art',
    title: 'Neon Portrait',
    description: 'Vibrant neon-themed anime portrait.',
    price: 75,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder5.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 250, downloads: 1800, purchaseCount: 1800 },
    status: 'active',
    tags: ['portrait', 'neon', 'cyberpunk'],
    artConfig: {
      fullResUrl: 'https://example.com/neon_portrait_full.png',
      thumbnailUrl: 'https://example.com/neon_portrait_thumb.jpg',
      dimensions: { width: 2480, height: 3508 },
      fileSize: 10485760,
      format: 'png',
      artist: 'Neon Dreams',
      style: 'Cyberpunk',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },

  // ===== STICKER PACKS =====
  {
    productId: 'sticker_001',
    type: 'sticker_pack',
    title: 'Kawaii Emotions Pack',
    description: '24 adorable kawaii emotion stickers.',
    price: 30,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder6.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 890, downloads: 5600, purchaseCount: 5600 },
    status: 'active',
    tags: ['kawaii', 'emotions', 'cute'],
    stickerPackConfig: {
      stickers: [
        { stickerId: 's001', imageUrl: 'https://example.com/sticker1.png', emoji: '😊' },
        { stickerId: 's002', imageUrl: 'https://example.com/sticker2.png', emoji: '😭' },
      ],
      totalStickers: 24,
      packTheme: 'Kawaii Emotions',
      animated: false,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    productId: 'sticker_002',
    type: 'sticker_pack',
    title: 'Anime Reaction Pack',
    description: '30 hilarious anime reaction stickers.',
    price: 40,
    currency: 'coins',
    coverImage: 'https://i.imgur.com/placeholder7.jpg',
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
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },

  // ===== PROFILE FRAMES =====
  {
    productId: 'frame_001',
    type: 'profile_frame',
    title: 'Golden Luxury Frame',
    description: 'Elegant golden frame for VIP users.',
    price: 200,
    currency: 'diamonds',
    coverImage: 'https://i.imgur.com/placeholder8.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 450, downloads: 3200, purchaseCount: 3200 },
    status: 'active',
    tags: ['luxury', 'vip', 'gold'],
    frameConfig: {
      frameUrl: 'https://example.com/golden_frame_full.png',
      previewUrl: 'https://example.com/golden_frame_preview.png',
      dimensions: { width: 500, height: 500 },
      animated: false,
      theme: 'Gold Luxury',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    productId: 'frame_002',
    type: 'profile_frame',
    title: 'Neon Cyberpunk Frame',
    description: 'Futuristic neon frame with animated effects.',
    price: 150,
    currency: 'diamonds',
    coverImage: 'https://i.imgur.com/placeholder9.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 380, downloads: 2800, purchaseCount: 2800 },
    status: 'active',
    tags: ['neon', 'cyberpunk', 'animated'],
    frameConfig: {
      frameUrl: 'https://example.com/neon_frame_full.png',
      previewUrl: 'https://example.com/neon_frame_preview.png',
      dimensions: { width: 500, height: 500 },
      animated: true,
      theme: 'Neon Cyberpunk',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },

  // ===== CHAT BUBBLE THEMES =====
  {
    productId: 'bubble_001',
    type: 'chat_bubble',
    title: 'Dark Galaxy Theme',
    description: 'Stunning dark galaxy chat theme.',
    price: 100,
    currency: 'diamonds',
    coverImage: 'https://i.imgur.com/placeholder10.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 620, downloads: 4200, purchaseCount: 4200 },
    status: 'active',
    tags: ['dark', 'galaxy', 'premium'],
    bubbleConfig: {
      theme: {
        name: 'Dark Galaxy',
        sentBubble: {
          backgroundColor: '#7C3AED',
          textColor: '#FFFFFF',
          borderRadius: 18,
        },
        receivedBubble: {
          backgroundColor: '#374151',
          textColor: '#FFFFFF',
          borderRadius: 18,
        },
        chatBackground: {
          backgroundColor: '#0B0B0E',
        },
      },
      previewImages: ['https://example.com/galaxy_preview.jpg'],
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    productId: 'bubble_002',
    type: 'chat_bubble',
    title: 'Pastel Dream Theme',
    description: 'Soft and cute pastel-colored chat theme.',
    price: 80,
    currency: 'diamonds',
    coverImage: 'https://i.imgur.com/placeholder11.jpg',
    creatorId: 'official',
    creatorName: 'Official Store',
    isOfficial: true,
    stats: { rating: 5, reviews: 480, downloads: 3400, purchaseCount: 3400 },
    status: 'active',
    tags: ['pastel', 'kawaii', 'cute'],
    bubbleConfig: {
      theme: {
        name: 'Pastel Dream',
        sentBubble: {
          backgroundColor: '#FFB7D5',
          textColor: '#4A5568',
          borderRadius: 20,
        },
        receivedBubble: {
          backgroundColor: '#D4E4FF',
          textColor: '#4A5568',
          borderRadius: 20,
        },
        chatBackground: {
          backgroundColor: '#FFF5F7',
        },
      },
      previewImages: ['https://example.com/pastel_preview.jpg'],
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
];

// Main initialization function
async function initializeProducts() {
  console.log('🚀 Starting marketplace initialization...\n');

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const product of sampleProducts) {
    try {
      const productRef = doc(db, 'products', product.productId);
      
      // Check if product already exists
      const docSnap = await getDoc(productRef);
      
      if (docSnap.exists()) {
        console.log(`⏭️  Skipped ${product.type}: ${product.title} (already exists)`);
        skippedCount++;
        continue;
      }
      
      // Create new product
      await setDoc(productRef, product);
      console.log(`✅ Added ${product.type}: ${product.title}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to add ${product.title}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Initialization Complete:`);
  console.log(`   ✅ Created: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`\n🎉 Marketplace is ready with ${successCount + skippedCount} products!`);
}

// Run the initialization
initializeProducts()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });

