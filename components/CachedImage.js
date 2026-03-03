/**
 * CachedImage — Drop-in replacement for <Image> with expo-image.
 * Provides automatic disk/memory caching, smooth fade-in transitions,
 * and a shimmer placeholder while loading.
 *
 * Usage:
 *   import CachedImage from './components/CachedImage';
 *   <CachedImage source={{ uri: 'https://...' }} style={styles.avatar} />
 */

import React from 'react';
import { Image } from 'expo-image';

// Shared blurhash for a subtle grey shimmer placeholder
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const CachedImage = React.memo(({
  source,
  style,
  contentFit = 'cover',
  placeholder = DEFAULT_BLURHASH,
  transition = 200,
  cachePolicy = 'memory-disk',
  recyclingKey,
  ...rest
}) => {
  // Support both { uri: '...' } and require() formats
  const imageSource = source?.uri ? { uri: source.uri } : source;

  return (
    <Image
      source={imageSource}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      placeholderContentFit="cover"
      transition={transition}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey}
      {...rest}
    />
  );
});

CachedImage.displayName = 'CachedImage';

export default CachedImage;
