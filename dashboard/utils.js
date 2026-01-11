/**
 * MAB AI Strategies Twitter Dashboard
 * Utility Functions
 */

/**
 * Format a number with abbreviations
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format a date for display
 * @param {Date|string} date
 * @param {Object} options
 * @returns {string}
 */
function formatDate(date, options = {}) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const {
    includeTime = false,
    short = false
  } = options;

  const dateOptions = short
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' };

  let formatted = d.toLocaleDateString('en-US', dateOptions);

  if (includeTime) {
    formatted += ' ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: CONFIG.dashboard.timeFormat === '12h'
    });
  }

  return formatted;
}

/**
 * Format time (hour only)
 * @param {number} hour - Hour in 24h format
 * @returns {string}
 */
function formatTime(hour) {
  if (CONFIG.dashboard.timeFormat === '24h') {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Calculate percentage change
 * @param {number} current
 * @param {number} previous
 * @returns {string}
 */
function calculateChange(current, previous) {
  if (previous === 0) return '+100%';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Get trend indicator class
 * @param {string} trend - 'up', 'down', or 'neutral'
 * @returns {string}
 */
function getTrendClass(trend) {
  switch (trend) {
    case 'up': return 'trend-up';
    case 'down': return 'trend-down';
    default: return 'trend-neutral';
  }
}

/**
 * Get trend arrow
 * @param {string} trend
 * @returns {string}
 */
function getTrendArrow(trend) {
  switch (trend) {
    case 'up': return '↑';
    case 'down': return '↓';
    default: return '→';
  }
}

/**
 * Get heatmap cell class based on value
 * @param {number} value
 * @param {number} max
 * @returns {string}
 */
function getHeatmapClass(value, max) {
  const ratio = value / max;
  if (ratio >= 0.8) return 'heatmap-very-high';
  if (ratio >= 0.6) return 'heatmap-high';
  if (ratio >= 0.4) return 'heatmap-medium';
  return 'heatmap-low';
}

/**
 * Truncate text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Debounce function
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Parse CSV string to array of objects
 * @param {string} csv
 * @returns {Object[]}
 */
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }

  return data;
}

/**
 * Parse a single CSV line
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('loading-overlay').classList.remove('hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

/**
 * Show error notification
 * @param {string} message
 */
function showError(message) {
  console.error(message);
  // Could implement a toast notification here
}

/**
 * Fetch data with retry logic
 * @param {string} url
 * @param {Object} options
 * @param {number} retries
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

/**
 * Local storage helpers
 */
const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage not available');
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
};

/**
 * Get category display name
 * @param {string} categoryId
 * @returns {string}
 */
function getCategoryName(categoryId) {
  const names = {
    'ai-providers': 'AI Providers',
    'business-ai': 'Business AI',
    'ai-safety': 'AI Safety'
  };
  return names[categoryId] || categoryId;
}

/**
 * Get category color
 * @param {string} categoryId
 * @returns {string}
 */
function getCategoryColor(categoryId) {
  const colors = {
    'ai-providers': CONFIG.dashboard.colors.primary,
    'business-ai': CONFIG.dashboard.colors.secondary,
    'ai-safety': CONFIG.dashboard.colors.success
  };
  return colors[categoryId] || CONFIG.dashboard.colors.primary;
}

// Export to window
window.utils = {
  formatNumber,
  formatDate,
  formatTime,
  calculateChange,
  getTrendClass,
  getTrendArrow,
  getHeatmapClass,
  truncateText,
  debounce,
  parseCSV,
  parseCsvLine,
  showLoading,
  hideLoading,
  showError,
  fetchWithRetry,
  storage,
  getCategoryName,
  getCategoryColor
};
