// Shared Form Validation Functions
// Platform-agnostic validation logic

/**
 * Validate email
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate password
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 6,
    requireUppercase = false,
    requireLowercase = false,
    requireNumber = false,
    requireSpecialChar = false
  } = options;

  if (!password || password.trim() === '') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters` };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (requireNumber && !/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true, error: null };
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result
 */
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Remove spaces and special characters for validation
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }

  return { valid: true, error: null };
};

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {Object} Validation result
 */
export const validateUsername = (username) => {
  if (!username || username.trim() === '') {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 20) {
    return { valid: false, error: 'Username must be less than 20 characters' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  return { valid: true, error: null };
};

/**
 * Validate display name
 * @param {string} name - Display name to validate
 * @returns {Object} Validation result
 */
export const validateDisplayName = (name) => {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Display name is required' };
  }

  if (name.length < 2) {
    return { valid: false, error: 'Display name must be at least 2 characters' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Display name must be less than 50 characters' };
  }

  return { valid: true, error: null };
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {Object} Validation result
 */
export const validateUrl = (url) => {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    new URL(url);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate age (must be 13+)
 * @param {Date|string} birthDate - Birth date
 * @returns {Object} Validation result
 */
export const validateAge = (birthDate) => {
  if (!birthDate) {
    return { valid: false, error: 'Birth date is required' };
  }

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 13) {
    return { valid: false, error: 'You must be at least 13 years old' };
  }

  return { valid: true, error: null, age };
};

/**
 * Validate post content
 * @param {string} content - Post content to validate
 * @returns {Object} Validation result
 */
export const validatePostContent = (content) => {
  if (!content || content.trim() === '') {
    return { valid: false, error: 'Post content cannot be empty' };
  }

  if (content.length > 5000) {
    return { valid: false, error: 'Post content must be less than 5000 characters' };
  }

  return { valid: true, error: null };
};

/**
 * Validate bio
 * @param {string} bio - Bio to validate
 * @returns {Object} Validation result
 */
export const validateBio = (bio) => {
  if (!bio) {
    return { valid: true, error: null }; // Bio is optional
  }

  if (bio.length > 500) {
    return { valid: false, error: 'Bio must be less than 500 characters' };
  }

  return { valid: true, error: null };
};

/**
 * Validate form fields
 * @param {Object} fields - Object with field names and values
 * @param {Object} rules - Validation rules for each field
 * @returns {Object} Validation results
 */
export const validateForm = (fields, rules) => {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach(fieldName => {
    const value = fields[fieldName];
    const rule = rules[fieldName];
    
    const result = rule(value);
    if (!result.valid) {
      errors[fieldName] = result.error;
      isValid = false;
    }
  });

  return { isValid, errors };
};

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @returns {Object} Validation result
 */
export const validateRequired = (value, fieldName = 'Field') => {
  if (value === null || value === undefined || value === '' || 
      (Array.isArray(value) && value.length === 0)) {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true, error: null };
};
