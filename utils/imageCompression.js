import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Convert a blob: URI (returned by expo-image-picker/manipulator in some builds)
 * into a local file URI that native modules can handle.
 * On non-blob URIs this is a no-op.
 * @param {string} uri
 * @returns {Promise<string>} - A safe file:// URI
 */
const normalizeBlobUri = async (uri) => {
  if (!uri || !uri.startsWith('blob:')) return uri;

  try {
    console.log('⚠️  Detected blob URI, converting to file URI…');
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob → base64 via FileReader (available in React Native's JS engine)
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // result is "data:<type>;base64,<data>"
        const b64 = reader.result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const fileUri = `${FileSystem.cacheDirectory}blob_img_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✅ Blob URI converted to file URI:', fileUri);
    return fileUri;
  } catch (err) {
    console.error('❌ Failed to convert blob URI, using original:', err);
    return uri;
  }
};

/**
 * Compress and resize image for faster upload and loading
 * @param {string} uri - Original image URI
 * @param {Object} options - Compression options
 * @returns {Promise<string>} - Compressed image URI
 */
export const compressImage = async (uri, options = {}) => {
  const {
    maxWidth = 1080,        // Max width in pixels
    maxHeight = 1920,       // Max height in pixels
    quality = 0.7,          // Compression quality (0-1)
    format = SaveFormat.JPEG, // Image format
  } = options;

  try {
    // Normalize blob: URIs before passing to the native manipulator
    const safeUri = await normalizeBlobUri(uri);

    const manipulatedImage = await manipulateAsync(
      safeUri,
      [
        {
          resize: {
            width: maxWidth,
            // height will be calculated automatically to maintain aspect ratio
          },
        },
      ],
      {
        compress: quality,
        format: format,
      }
    );

    console.log(`📦 Image compressed: Original - ${safeUri.length} chars, Compressed - ${manipulatedImage.uri.length} chars`);
    
    return manipulatedImage.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original URI if compression fails
    return uri;
  }
};

/**
 * Compress multiple images
 * @param {Array<string>} uris - Array of image URIs
 * @param {Object} options - Compression options
 * @returns {Promise<Array<string>>} - Array of compressed image URIs
 */
export const compressMultipleImages = async (uris, options = {}) => {
  try {
    const compressedPromises = uris.map(uri => compressImage(uri, options));
    const compressed = await Promise.all(compressedPromises);
    return compressed;
  } catch (error) {
    console.error('Error compressing multiple images:', error);
    return uris;
  }
};

/**
 * Get image dimensions and size
 * @param {string} uri - Image URI
 * @returns {Promise<Object>} - Image info
 */
export const getImageInfo = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return {
      size: blob.size,
      sizeInMB: (blob.size / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    return null;
  }
};

/**
 * Compress image for profile/avatar (smaller size, square)
 */
export const compressProfileImage = async (uri) => {
  return compressImage(uri, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.8,
  });
};

/**
 * Compress image for story (vertical format)
 */
export const compressStoryImage = async (uri) => {
  return compressImage(uri, {
    maxWidth: 1080,
    maxHeight: 1920,
    quality: 0.75,
  });
};

/**
 * Compress image for posts (balanced quality)
 */
export const compressPostImage = async (uri) => {
  return compressImage(uri, {
    maxWidth: 1080,
    maxHeight: 1920,
    quality: 0.7,
  });
};

/**
 * Compress image for chat (faster loading)
 */
export const compressChatImage = async (uri) => {
  return compressImage(uri, {
    maxWidth: 800,
    maxHeight: 1200,
    quality: 0.65,
  });
};
