// config/iapConfig.js - In-App Purchase Product Configuration
/**
 * IAP Product IDs Configuration
 * 
 * IMPORTANT: These product IDs must match EXACTLY with:
 * - Google Play Console (for Android)
 * - App Store Connect (for iOS)
 * 
 * Setup Instructions:
 * 1. Google Play Console:
 *    - Go to Monetize > Products > In-app products
 *    - Create products with these exact IDs
 * 
 * 2. App Store Connect:
 *    - Go to Features > In-App Purchases
 *    - Create products with these exact IDs
 */

export const IAP_PRODUCTS = {
  // Coin Packages (consumable)
  COINS: {
    SMALL: {
      id: 'social_vibing_coins_100',
      amount: 100,
      price: 0.99,
      label: '100 Coins',
      description: 'Small coin package',
      bonus: 0,
    },
    MEDIUM: {
      id: 'social_vibing_coins_500',
      amount: 500,
      price: 4.99,
      label: '500 Coins',
      description: 'Medium coin package',
      bonus: 50, // +10% bonus
    },
    LARGE: {
      id: 'social_vibing_coins_1000',
      amount: 1000,
      price: 9.99,
      label: '1,000 Coins',
      description: 'Large coin package',
      bonus: 200, // +20% bonus
    },
    MEGA: {
      id: 'social_vibing_coins_5000',
      amount: 5000,
      price: 49.99,
      label: '5,000 Coins',
      description: 'Mega coin package',
      bonus: 1500, // +30% bonus
    },
  },

  // Diamond Packages (premium consumable)
  DIAMONDS: {
    SMALL: {
      id: 'social_vibing_diamonds_10',
      amount: 10,
      price: 1.99,
      label: '10 Diamonds',
      description: 'Small diamond package',
      bonus: 0,
    },
    MEDIUM: {
      id: 'social_vibing_diamonds_50',
      amount: 50,
      price: 9.99,
      label: '50 Diamonds',
      description: 'Medium diamond package',
      bonus: 5, // +10% bonus
    },
    LARGE: {
      id: 'social_vibing_diamonds_100',
      amount: 100,
      price: 19.99,
      label: '100 Diamonds',
      description: 'Large diamond package',
      bonus: 20, // +20% bonus
    },
    MEGA: {
      id: 'social_vibing_diamonds_500',
      amount: 500,
      price: 99.99,
      label: '500 Diamonds',
      description: 'Mega diamond package',
      bonus: 150, // +30% bonus
    },
  },
};

// Get all product IDs as array (for IAP initialization)
export const getAllProductIds = () => {
  const coinIds = Object.values(IAP_PRODUCTS.COINS).map((p) => p.id);
  const diamondIds = Object.values(IAP_PRODUCTS.DIAMONDS).map((p) => p.id);
  return [...coinIds, ...diamondIds];
};

// Get product info by ID
export const getProductById = (productId) => {
  const allProducts = [
    ...Object.values(IAP_PRODUCTS.COINS),
    ...Object.values(IAP_PRODUCTS.DIAMONDS),
  ];
  return allProducts.find((p) => p.id === productId);
};

// Calculate total amount with bonus
export const getTotalAmount = (product) => {
  return product.amount + (product.bonus || 0);
};

// Format price for display
export const formatPrice = (price) => {
  return `$${price.toFixed(2)}`;
};

// Check if product is coins or diamonds
export const isCoinProduct = (productId) => {
  return productId.includes('coins');
};

export const isDiamondProduct = (productId) => {
  return productId.includes('diamonds');
};
