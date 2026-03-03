import * as FileSystem from 'expo-file-system';
import { hostingerConfig } from '../hostingerConfig';

/**
 * Validate and normalise an image URI so it is always a loadable URL.
 *
 * Handles the following cases:
 *  - null / undefined / empty  → returns null (caller should show placeholder)
 *  - Already a full http(s) URL → returned as-is
 *  - file:// URI                → returned as-is (local picker result)
 *  - Bare filename or relative path (e.g. "abc.jpeg", "posts/abc.jpeg")
 *      → prepended with the Hostinger base URL
 *
 * @param {string|null|undefined} uri
 * @param {string} [folder]  Optional sub-folder hint (e.g. 'posts') used when
 *                            the value is a bare filename with no path separator.
 * @returns {string|null}
 */
export const normalizeImageUri = (uri, folder) => {
  if (!uri || typeof uri !== 'string') return null;

  const trimmed = uri.trim();
  if (!trimmed) return null;

  // blob: URIs are only valid in the local JS runtime — they cannot be
  // loaded by native <Image> or cached.  Return null so the caller shows
  // a placeholder instead of building a broken Hostinger URL.
  if (trimmed.startsWith('blob:')) return null;

  // Already a valid absolute URL — but reject URLs that contain an
  // embedded blob: segment (e.g. from a past bug that concatenated a
  // Hostinger base URL with a blob URI).
  if (/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes('blob:')) return null;
    return trimmed;
  }

  // Local file URI (e.g. from image picker before upload)
  if (trimmed.startsWith('file://')) return trimmed;

  // data: URI (base64 inline image)
  if (trimmed.startsWith('data:')) return trimmed;

  // Content URI (Android)
  if (trimmed.startsWith('content://')) return trimmed;

  // Bare filename or relative path – prepend Hostinger base URL
  const base = hostingerConfig.baseUrl; // ends with '/'

  // If it already contains a slash (e.g. "posts/abc.jpeg"), use as-is
  if (trimmed.includes('/')) {
    return `${base}${trimmed}`;
  }

  // Bare filename – use the folder hint if provided
  if (folder) {
    return `${base}${folder}/${trimmed}`;
  }

  // Last resort: attach directly to base
  return `${base}${trimmed}`;
};

/**
 * Normalise an array of image URIs.
 * @param {string[]} uris
 * @param {string} [folder]
 * @returns {string[]}  – nulls are filtered out
 */
export const normalizeImageUris = (uris, folder) => {
  if (!Array.isArray(uris)) return [];
  return uris.map((u) => normalizeImageUri(u, folder)).filter(Boolean);
};

/**
 * Convert a blob: URI into a local file:// URI that native modules
 * (e.g. <Image>, expo-image-manipulator, hostinger upload) can handle.
 *
 * On non-blob URIs this is a no-op and returns the original URI immediately.
 *
 * The conversion uses XMLHttpRequest (which has built-in blob support in
 * React Native's JS runtime) instead of fetch() — fetch() delegates to
 * RCTNetworking on iOS which does NOT register a handler for blob: URLs,
 * producing the dreaded "No suitable URL request handler found for blob:…"
 * error.
 *
 * @param {string} uri
 * @returns {Promise<string>} A safe file:// URI
 */
export const normalizeBlobUri = async (uri) => {
  if (!uri || !uri.startsWith('blob:')) return uri;

  try {
    console.log('⚠️  Detected blob: URI, converting to file:// …');

    // 1. Fetch the blob data via XHR (XHR has native blob support in RN)
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('XHR blob fetch failed'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });

    // 2. Convert blob → base64 via FileReader
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // result format: "data:<mime>;base64,<data>"
        const b64 = reader.result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 3. Determine file extension from MIME type
    let ext = 'jpg';
    if (blob.type) {
      if (blob.type.includes('png')) ext = 'png';
      else if (blob.type.includes('gif')) ext = 'gif';
      else if (blob.type.includes('webp')) ext = 'webp';
    }

    // 4. Write to the cache directory
    const fileUri = `${FileSystem.cacheDirectory}blob_${Date.now()}.${ext}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✅ Blob URI converted to', fileUri);
    return fileUri;
  } catch (err) {
    console.error('❌ normalizeBlobUri failed, returning original URI:', err);
    return uri;
  }
};

/**
 * Convenience: normalise an array of URIs in parallel.
 * @param {string[]} uris
 * @returns {Promise<string[]>}
 */
export const normalizeBlobUris = (uris) =>
  Promise.all(uris.map(normalizeBlobUri));
