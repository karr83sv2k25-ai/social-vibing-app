// initializeMarketplace.js - One-time script to seed marketplace data
import { db } from './firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Sample products to seed
const SAMPLE_PRODUCTS = [
    {
        title: "Chat Bubble Pack - Anime",
        type: "chat_bubble",
        category: "chat_bubbles",
        description: "Premium anime-themed chat bubbles for your conversations",
        price: 50,
        currency: "coins",
        coverImage: "https://via.placeholder.com/300x200?text=Chat+Bubbles",
        previewImages: [],
        status: "active",
        isOfficial: true,
        stats: {
            rating: 4.8,
            reviewCount: 120,
            purchaseCount: 450,
            viewCount: 1200,
        },
        purchaseCount: 450, // For ordering by Popular
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    },
    {
        title: "Profile Frame - Gold Edition",
        type: "profile_frame",
        category: "profile_frames",
        description: "Exclusive gold profile frame to stand out",
        price: 100,
        currency: "diamonds",
        coverImage: "https://via.placeholder.com/300x200?text=Gold+Frame",
        previewImages: [],
        status: "active",
        isOfficial: true,
        stats: {
            rating: 5.0,
            reviewCount: 89,
            purchaseCount: 320,
            viewCount: 980,
        },
        purchaseCount: 320,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    },
    {
        title: "Digital Art - Cyberpunk City",
        type: "art",
        category: "digital_art",
        description: "High-quality cyberpunk cityscape wallpaper",
        price: 30,
        currency: "coins",
        coverImage: "https://via.placeholder.com/300x200?text=Cyberpunk+Art",
        previewImages: [],
        status: "active",
        isOfficial: false,
        stats: {
            rating: 4.5,
            reviewCount: 45,
            purchaseCount: 180,
            viewCount: 520,
        },
        purchaseCount: 180,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    },
    {
        title: "Sticker Pack - Emoji Vibes",
        type: "sticker_pack",
        category: "stickers",
        description: "50+ expressive emoji stickers",
        price: 0,
        currency: "coins",
        coverImage: "https://via.placeholder.com/300x200?text=Emoji+Stickers",
        previewImages: [],
        status: "active",
        isOfficial: true,
        stats: {
            rating: 4.7,
            reviewCount: 250,
            purchaseCount: 850,
            viewCount: 2100,
        },
        purchaseCount: 850,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    },
    {
        title: "Comic Book - Hero's Journey",
        type: "comic",
        category: "comics",
        description: "Original superhero comic, 24 pages",
        price: 150,
        currency: "diamonds",
        coverImage: "https://via.placeholder.com/300x200?text=Comic+Book",
        previewImages: [],
        status: "active",
        isOfficial: false,
        stats: {
            rating: 4.9,
            reviewCount: 75,
            purchaseCount: 210,
            viewCount: 680,
        },
        purchaseCount: 210,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    },
    {
        title: "E-Book - Code Like a Pro",
        type: "book",
        category: "ebooks",
        description: "Programming guide for beginners, 120 pages",
        price: 200,
        currency: "diamonds",
        coverImage: "https://via.placeholder.com/300x200?text=Programming+Book",
        previewImages: [],
        status: "active",
        isOfficial: false,
        stats: {
            rating: 4.6,
            reviewCount: 95,
            purchaseCount: 280,
            viewCount: 750,
        },
        purchaseCount: 280,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    },
];

export const initializeMarketplaceData = async () => {
    try {
        console.log('🔄 Initializing marketplace data...');

        const productsRef = collection(db, 'products');

        for (const product of SAMPLE_PRODUCTS) {
            const docRef = await addDoc(productsRef, product);
            console.log(`✅ Created product: ${product.title} (${docRef.id})`);
        }

        console.log('✅ Marketplace data initialized successfully!');
        return { success: true, count: SAMPLE_PRODUCTS.length };
    } catch (error) {
        console.error('❌ Failed to initialize marketplace:', error);
        return { success: false, error };
    }
};

// To run this once, call from your app:
// import { initializeMarketplaceData } from './initializeMarketplace';
// initializeMarketplaceData();
