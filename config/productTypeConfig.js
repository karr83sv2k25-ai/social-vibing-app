// config/productTypeConfig.js - Configuration for different product types

export const PRODUCT_TYPE_CONFIGS = {
  chat_bubble: {
    id: 'chat_bubble',
    name: 'Chat Bubble',
    icon: 'chatbubbles',
    color: '#FF6B6B',
    libraryField: 'chatBubbles',
    
    // Asset requirements
    assets: {
      coverImage: { required: true, aspectRatio: [1, 1], maxSize: 5 * 1024 * 1024 }, // 5MB
      previewImages: { min: 2, max: 5, required: true },
      files: {
        required: true,
        types: ['image/png', 'application/json'], // PNG bubble images + JSON config
        description: 'Upload bubble images (sent/received) and optional JSON config',
        minFiles: 1,
        maxFiles: 10,
      },
    },
    
    // Required metadata
    metadata: {
      bubbleStyle: { type: 'select', options: ['modern', 'minimal', 'playful', 'elegant', 'animated'], required: true },
      hasAnimation: { type: 'boolean', default: false },
      colorScheme: { type: 'color', required: true },
    },
    
    // Usage configuration
    usage: {
      type: 'customizer',
      screen: 'BubbleCustomizer',
      preview: 'ChatPreview',
      applyMethod: 'setActiveChatTheme',
    },
    
    description: 'Custom chat bubble themes with unique styles and colors',
  },
  
  profile_frame: {
    id: 'profile_frame',
    name: 'Profile Frame',
    icon: 'image-frame',
    color: '#4ECDC4',
    libraryField: 'profileFrames',
    
    assets: {
      coverImage: { required: true, aspectRatio: [1, 1], maxSize: 5 * 1024 * 1024 },
      previewImages: { min: 1, max: 4, required: true },
      files: {
        required: true,
        types: ['image/png'], // Transparent PNG frames
        description: 'Upload transparent PNG frame (1:1 ratio, 1000x1000px recommended)',
        minFiles: 1,
        maxFiles: 1,
      },
    },
    
    metadata: {
      frameStyle: { type: 'select', options: ['classic', 'modern', 'artistic', 'seasonal', 'animated'], required: true },
      isAnimated: { type: 'boolean', default: false },
      season: { type: 'select', options: ['none', 'spring', 'summer', 'fall', 'winter'], default: 'none' },
    },
    
    usage: {
      type: 'customizer',
      screen: 'FrameCustomizer',
      preview: 'ProfilePreview',
      applyMethod: 'setActiveProfileFrame',
    },
    
    description: 'Decorative frames for profile pictures',
  },
  
  sticker_pack: {
    id: 'sticker_pack',
    name: 'Sticker Pack',
    icon: 'happy',
    color: '#A8E6CF',
    libraryField: 'stickerPacks',
    
    assets: {
      coverImage: { required: true, aspectRatio: [1, 1], maxSize: 3 * 1024 * 1024 },
      previewImages: { min: 3, max: 8, required: true },
      files: {
        required: true,
        types: ['image/png', 'image/webp', 'application/json'],
        description: 'Upload sticker images (PNG/WebP) and optional pack.json',
        minFiles: 5,
        maxFiles: 50,
      },
    },
    
    metadata: {
      stickerCount: { type: 'number', min: 5, max: 50, required: true },
      packTheme: { type: 'text', required: true, placeholder: 'e.g., Cute Animals, Anime Reactions' },
      isAnimated: { type: 'boolean', default: false },
    },
    
    usage: {
      type: 'picker',
      screen: 'StickerPicker',
      preview: 'StickerGrid',
      applyMethod: 'sendSticker',
    },
    
    description: 'Collection of stickers for messaging',
  },
  
  art: {
    id: 'art',
    name: 'Artwork',
    icon: 'color-palette',
    color: '#FFE66D',
    libraryField: 'art',
    
    assets: {
      coverImage: { required: true, aspectRatio: null, maxSize: 10 * 1024 * 1024 },
      previewImages: { min: 1, max: 5, required: true },
      files: {
        required: true,
        types: ['image/jpeg', 'image/png', 'image/webp'],
        description: 'Upload high-resolution artwork (JPEG, PNG, or WebP)',
        minFiles: 1,
        maxFiles: 1,
      },
    },
    
    metadata: {
      artStyle: { type: 'select', options: ['digital', 'traditional', 'pixel', '3d', 'abstract', 'anime'], required: true },
      resolution: { type: 'text', required: true, placeholder: 'e.g., 3000x4000' },
      isNSFW: { type: 'boolean', default: false },
    },
    
    usage: {
      type: 'viewer',
      screen: 'ArtViewer',
      preview: 'ImagePreview',
      applyMethod: 'viewFullResolution',
    },
    
    description: 'Digital artwork and illustrations',
  },
  
  comic: {
    id: 'comic',
    name: 'Comic',
    icon: 'book',
    color: '#FF8B94',
    libraryField: 'comics',
    
    assets: {
      coverImage: { required: true, aspectRatio: [2, 3], maxSize: 5 * 1024 * 1024 },
      previewImages: { min: 2, max: 5, required: true },
      files: {
        required: true,
        types: ['application/pdf', 'application/zip', 'application/cbz'],
        description: 'Upload comic as PDF, CBZ, or ZIP of images',
        minFiles: 1,
        maxFiles: 1,
      },
    },
    
    metadata: {
      pageCount: { type: 'number', min: 1, max: 500, required: true },
      genre: { type: 'select', options: ['action', 'comedy', 'drama', 'fantasy', 'horror', 'romance', 'sci-fi'], required: true },
      isComplete: { type: 'boolean', default: true },
      seriesName: { type: 'text', required: false, placeholder: 'Part of a series? Enter series name' },
    },
    
    usage: {
      type: 'reader',
      screen: 'ComicReader',
      preview: 'PagePreview',
      applyMethod: 'openReader',
    },
    
    description: 'Digital comics and manga',
  },
  
  book: {
    id: 'book',
    name: 'E-Book',
    icon: 'library',
    color: '#C7CEEA',
    libraryField: 'books',
    
    assets: {
      coverImage: { required: true, aspectRatio: [2, 3], maxSize: 3 * 1024 * 1024 },
      previewImages: { min: 1, max: 3, required: false },
      files: {
        required: true,
        types: ['application/pdf', 'application/epub+zip'],
        description: 'Upload book as PDF or EPUB',
        minFiles: 1,
        maxFiles: 1,
      },
    },
    
    metadata: {
      pageCount: { type: 'number', min: 1, required: true },
      genre: { type: 'select', options: ['fiction', 'non-fiction', 'fantasy', 'mystery', 'romance', 'sci-fi', 'self-help'], required: true },
      author: { type: 'text', required: true },
      language: { type: 'select', options: ['english', 'spanish', 'french', 'german', 'japanese', 'korean'], default: 'english' },
    },
    
    usage: {
      type: 'reader',
      screen: 'BookReader',
      preview: 'ChapterPreview',
      applyMethod: 'openReader',
    },
    
    description: 'E-books and digital literature',
  },
  
  freelance_gig: {
    id: 'freelance_gig',
    name: 'Freelance Gig',
    icon: 'briefcase',
    color: '#FFDAB9',
    libraryField: 'services',
    
    assets: {
      coverImage: { required: true, aspectRatio: [16, 9], maxSize: 5 * 1024 * 1024 },
      previewImages: { min: 2, max: 6, required: true },
      files: {
        required: false, // No asset files for services
        description: 'Optional: Upload portfolio samples',
      },
    },
    
    metadata: {
      deliveryTime: { type: 'number', min: 1, max: 90, required: true, unit: 'days' },
      revisions: { type: 'number', min: 0, max: 10, required: true },
      serviceType: { type: 'select', options: ['art', 'animation', 'voice', 'writing', 'design', 'coding'], required: true },
      skillLevel: { type: 'select', options: ['beginner', 'intermediate', 'expert'], required: true },
    },
    
    usage: {
      type: 'order',
      screen: 'ServiceOrder',
      preview: 'ServiceDetails',
      applyMethod: 'createOrder',
    },
    
    description: 'Custom freelance services',
  },
};

// Helper functions
export const getProductTypeConfig = (type) => {
  return PRODUCT_TYPE_CONFIGS[type] || null;
};

export const getProductTypesList = () => {
  return Object.values(PRODUCT_TYPE_CONFIGS);
};

export const validateProductAssets = (type, assets) => {
  const config = getProductTypeConfig(type);
  if (!config) return { valid: false, errors: ['Invalid product type'] };
  
  const errors = [];
  
  // Validate cover image
  if (config.assets.coverImage.required && !assets.coverImage) {
    errors.push('Cover image is required');
  }
  
  // Validate preview images
  if (config.assets.previewImages.required) {
    const count = assets.previewImages?.length || 0;
    if (count < config.assets.previewImages.min) {
      errors.push(`At least ${config.assets.previewImages.min} preview images required`);
    }
    if (count > config.assets.previewImages.max) {
      errors.push(`Maximum ${config.assets.previewImages.max} preview images allowed`);
    }
  }
  
  // Validate files
  if (config.assets.files?.required) {
    const count = assets.files?.length || 0;
    if (count < (config.assets.files.minFiles || 1)) {
      errors.push(`At least ${config.assets.files.minFiles || 1} file(s) required`);
    }
    if (config.assets.files.maxFiles && count > config.assets.files.maxFiles) {
      errors.push(`Maximum ${config.assets.files.maxFiles} files allowed`);
    }
  }
  
  return { valid: errors.length === 0, errors };
};

export const getProductTypeCategories = (type) => {
  const categories = {
    chat_bubble: ['Modern', 'Minimal', 'Playful', 'Elegant', 'Animated', 'Gradient', 'Neon'],
    profile_frame: ['Classic', 'Modern', 'Artistic', 'Seasonal', 'Animated', 'Holiday', 'Themed'],
    sticker_pack: ['Reactions', 'Emoji', 'Animals', 'Anime', 'Memes', 'Seasonal', 'Custom'],
    art: ['Digital', 'Traditional', 'Pixel Art', '3D', 'Abstract', 'Anime', 'Landscape', 'Portrait'],
    comic: ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life'],
    book: ['Fiction', 'Non-Fiction', 'Fantasy', 'Mystery', 'Romance', 'Sci-Fi', 'Self-Help', 'Biography'],
    freelance_gig: ['Art Commission', 'Animation', 'Voice Acting', 'Writing', 'Design', 'Development'],
  };
  
  return categories[type] || [];
};
