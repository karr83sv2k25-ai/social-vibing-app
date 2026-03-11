/**
 * CachedImage — Drop-in replacement for <Image> with expo-image.
 * Provides automatic disk/memory caching, smooth fade-in transitions,
 * a shimmer placeholder while loading, and auto-retry on timeout errors.
 *
 * Usage:
 *   import CachedImage from './components/CachedImage';
 *   <CachedImage source={{ uri: 'https://...' }} style={styles.avatar} />
 *
 *   // With retry (default: up to 2 retries on timeout):
 *   <CachedImage source={{ uri: 'https://...' }} style={styles.avatar} maxRetries={3} />
 */

import React, { useState, useCallback, useRef } from 'react';
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
  maxRetries = 2,
  onError: onErrorProp,
  ...rest
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const retryCountRef = useRef(0);

  // Support both { uri: '...' } and require() formats
  const rawSource = source?.uri ? { uri: source.uri } : source;

  // Append a cache-bust query param on retry so expo-image re-fetches
  const imageSource =
    rawSource?.uri && retryCount > 0
      ? { uri: `${rawSource.uri}${rawSource.uri.includes('?') ? '&' : '?'}_retry=${retryCount}` }
      : rawSource;

  const handleError = useCallback((event) => {
    const errorMsg = event?.error || '';
    const isTimeout =
      typeof errorMsg === 'string' &&
      (errorMsg.toLowerCase().includes('timed out') ||
       errorMsg.toLowerCase().includes('timeout'));

    if (isTimeout && retryCountRef.current < maxRetries) {
      retryCountRef.current += 1;
      // Exponential back-off: 1s, 2s, 4s …
      const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
      setTimeout(() => {
        setRetryCount(retryCountRef.current);
      }, delay);
      console.log(
        `CachedImage retry ${retryCountRef.current}/${maxRetries} after ${delay}ms:`,
        rawSource?.uri?.substring(0, 80)
      );
    } else {
      // Exhausted retries or non-timeout error — forward to caller
      onErrorProp?.(event);
    }
  }, [maxRetries, rawSource?.uri, onErrorProp]);

  return (
    <Image
      source={imageSource}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      placeholderContentFit="cover"
      transition={transition}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey ? `${recyclingKey}-${retryCount}` : undefined}
      onError={handleError}
      {...rest}
    />
  );
});

CachedImage.displayName = 'CachedImage';

export default CachedImage;
