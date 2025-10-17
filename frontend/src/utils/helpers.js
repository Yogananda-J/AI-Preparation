/**
 * Utility helper functions
 * Common utility functions used throughout the application
 */

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return new Date(date).toLocaleDateString('en-US', defaultOptions);
};

/**
 * Format time duration in seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "2h 30m", "45m", "30s")
 */
export const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

/**
 * Format number with commas for thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  return num.toLocaleString();
};

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

/**
 * Generate random ID string
 * @param {number} length - Length of ID
 * @returns {string} Random ID
 */
export const generateId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with score and feedback
 */
export const validatePassword = (password) => {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  const feedback = [];
  
  if (!checks.length) feedback.push('At least 8 characters');
  if (!checks.lowercase) feedback.push('One lowercase letter');
  if (!checks.uppercase) feedback.push('One uppercase letter');
  if (!checks.number) feedback.push('One number');
  if (!checks.special) feedback.push('One special character');
  
  return {
    score,
    isValid: score >= 4,
    feedback,
    strength: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score] || 'Very Weak'
  };
};

/**
 * Get difficulty color class
 * @param {string} difficulty - Difficulty level
 * @returns {string} CSS class for difficulty color
 */
export const getDifficultyColor = (difficulty) => {
  const colors = {
    easy: 'text-green-600 bg-green-100',
    medium: 'text-yellow-600 bg-yellow-100',
    hard: 'text-red-600 bg-red-100'
  };
  return colors[difficulty?.toLowerCase()] || 'text-gray-600 bg-gray-100';
};

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
export const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Sort array of objects by key
 * @param {Array} array - Array to sort
 * @param {string} key - Key to sort by
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted array
 */
export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
};

/**
 * Group array of objects by key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert camelCase to Title Case
 * @param {string} str - String to convert
 * @returns {string} Title case string
 */
export const camelToTitle = (str) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

/**
 * Generate color based on string (for avatars, etc.)
 * @param {string} str - String to generate color from
 * @returns {string} Hex color code
 */
export const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const color = Math.abs(hash).toString(16).substring(0, 6);
  return '#' + '000000'.substring(0, 6 - color.length) + color;
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
};

/**
 * Download data as file
 * @param {string} data - Data to download
 * @param {string} filename - File name
 * @param {string} type - MIME type
 */
export const downloadFile = (data, filename, type = 'text/plain') => {
  const blob = new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'Just now';
};
