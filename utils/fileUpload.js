/**
 * File Upload Helper for Hostinger
 * 
 * Handles uploading various file types (documents, PDFs, etc.) to Hostinger
 */

import { hostingerConfig } from '../hostingerConfig';
import { normalizeBlobUri } from './normalizeUri';

/**
 * Upload file to Hostinger
 * @param {object} file - File object from DocumentPicker
 * @param {string} folder - Optional folder name (e.g., 'chat_files')
 * @returns {Promise<object>} - Object with URL, name, size, type
 */
export const uploadFileToHostinger = async (file, folder = 'chat_files') => {
  try {
    if (!file || !file.uri) {
      throw new Error('Invalid file');
    }

    console.log('📁 Uploading file to Hostinger:', file.name);

    // Normalize blob: URIs before passing to native networking
    const safeUri = await normalizeBlobUri(file.uri);

    // Create form data
    const formData = new FormData();
    
    // Add file with proper metadata
    formData.append('file', {
      uri: safeUri,
      type: file.mimeType || 'application/octet-stream',
      name: file.name || 'file',
    });
    
    formData.append('type', 'file');
    formData.append('folder', folder);
    formData.append('api_key', hostingerConfig.apiKey);

    // Upload to Hostinger
    const response = await fetch(hostingerConfig.uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-API-Key': hostingerConfig.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', errorText);
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    console.log('✅ File uploaded to Hostinger:', data.data.url);
    
    return {
      url: data.data.url,
      name: file.name,
      size: file.size,
      type: file.mimeType,
      fileName: data.data.filename || file.name,
    };
  } catch (error) {
    console.error('❌ Error uploading file to Hostinger:', error);
    throw error;
  }
};

/**
 * Get file extension from filename
 * @param {string} filename - File name
 * @returns {string} - File extension
 */
export const getFileExtension = (filename) => {
  const match = /\.(\w+)$/.exec(filename);
  return match ? match[1].toLowerCase() : '';
};

/**
 * Get file icon name based on file type
 * @param {string} mimeType - MIME type
 * @param {string} filename - File name
 * @returns {string} - Ionicon name
 */
export const getFileIcon = (mimeType, filename = '') => {
  const ext = getFileExtension(filename);
  
  // Check MIME type first
  if (mimeType) {
    if (mimeType.startsWith('application/pdf')) return 'document-text';
    if (mimeType.startsWith('application/msword') || mimeType.includes('wordprocessingml')) return 'document';
    if (mimeType.startsWith('application/vnd.ms-excel') || mimeType.includes('spreadsheetml')) return 'stats-chart';
    if (mimeType.startsWith('application/vnd.ms-powerpoint') || mimeType.includes('presentationml')) return 'easel';
    if (mimeType.startsWith('application/zip') || mimeType.startsWith('application/x-rar')) return 'archive';
    if (mimeType.startsWith('text/')) return 'document-text';
  }
  
  // Fallback to extension
  switch (ext) {
    case 'pdf': return 'document-text';
    case 'doc':
    case 'docx': return 'document';
    case 'xls':
    case 'xlsx': return 'stats-chart';
    case 'ppt':
    case 'pptx': return 'easel';
    case 'zip':
    case 'rar':
    case '7z': return 'archive';
    case 'txt': return 'document-text';
    case 'csv': return 'list';
    default: return 'document-attach';
  }
};

/**
 * Format file size to human readable
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Max size in bytes (default 50MB)
 * @returns {boolean} - True if valid
 */
export const validateFileSize = (size, maxSize = 50 * 1024 * 1024) => {
  if (size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
    const fileSizeMB = (size / 1024 / 1024).toFixed(2);
    throw new Error(`File size (${fileSizeMB}MB) exceeds ${maxSizeMB}MB limit`);
  }
  return true;
};

/**
 * Get file type label
 * @param {string} mimeType - MIME type
 * @param {string} filename - File name
 * @returns {string} - File type label
 */
export const getFileTypeLabel = (mimeType, filename = '') => {
  const ext = getFileExtension(filename).toUpperCase();
  
  if (mimeType) {
    if (mimeType.startsWith('application/pdf')) return 'PDF';
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint';
    if (mimeType.startsWith('application/zip')) return 'ZIP';
    if (mimeType.startsWith('text/')) return 'Text';
  }
  
  return ext || 'File';
};
