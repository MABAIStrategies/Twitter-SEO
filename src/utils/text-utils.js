/**
 * MAB AI Strategies Twitter SEO Agent
 * Text Processing Utilities
 *
 * Handles character counting, text truncation, URL handling,
 * and tweet formatting.
 */

/**
 * Twitter's URL length (t.co shortens all URLs to this length)
 */
export const TWITTER_URL_LENGTH = 23;

/**
 * Maximum tweet length
 */
export const MAX_TWEET_LENGTH = 280;

/**
 * Target tweet length (leaving room for link expansion)
 */
export const TARGET_TWEET_LENGTH = 257; // 280 - 23 for URL

/**
 * Calculate the effective length of a tweet
 * URLs count as 23 characters regardless of actual length
 *
 * @param {string} text - Tweet text
 * @returns {number} Effective character count
 */
export function calculateTweetLength(text) {
  // URL regex pattern
  const urlPattern = /https?:\/\/[^\s]+/g;

  // Find all URLs
  const urls = text.match(urlPattern) || [];

  // Calculate length without URLs
  let length = text.length;

  // Adjust for URL shortening
  for (const url of urls) {
    // Subtract actual URL length, add Twitter's shortened length
    length = length - url.length + TWITTER_URL_LENGTH;
  }

  return length;
}

/**
 * Check if a tweet is within length limits
 * @param {string} text - Tweet text
 * @returns {boolean}
 */
export function isValidTweetLength(text) {
  return calculateTweetLength(text) <= MAX_TWEET_LENGTH;
}

/**
 * Truncate text to fit within a character limit
 * Adds ellipsis if truncated
 *
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix to add if truncated
 * @returns {string}
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (text.length <= maxLength) return text;

  const truncateAt = maxLength - suffix.length;

  // Try to truncate at a word boundary
  const lastSpace = text.lastIndexOf(' ', truncateAt);
  const cutPoint = lastSpace > truncateAt * 0.7 ? lastSpace : truncateAt;

  return text.substring(0, cutPoint).trim() + suffix;
}

/**
 * Clean and normalize text
 * Removes extra whitespace, special characters, etc.
 *
 * @param {string} text - Text to clean
 * @returns {string}
 */
export function cleanText(text) {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Trim
    .trim();
}

/**
 * Extract URLs from text
 * @param {string} text - Text to search
 * @returns {string[]} Array of URLs found
 */
export function extractUrls(text) {
  const urlPattern = /https?:\/\/[^\s]+/g;
  return text.match(urlPattern) || [];
}

/**
 * Remove URLs from text
 * @param {string} text - Text to process
 * @returns {string}
 */
export function removeUrls(text) {
  return text.replace(/https?:\/\/[^\s]+/g, '').trim();
}

/**
 * Format hashtag (ensure it starts with #)
 * @param {string} tag - Hashtag text
 * @returns {string}
 */
export function formatHashtag(tag) {
  const cleaned = tag.replace(/^#+/, '').trim();
  return cleaned ? `#${cleaned}` : '';
}

/**
 * Extract hashtags from text
 * @param {string} text - Text to search
 * @returns {string[]} Array of hashtags found
 */
export function extractHashtags(text) {
  const hashtagPattern = /#[a-zA-Z0-9_]+/g;
  return text.match(hashtagPattern) || [];
}

/**
 * Check if text contains any of the given keywords (case-insensitive)
 * @param {string} text - Text to search
 * @param {string[]} keywords - Keywords to look for
 * @returns {boolean}
 */
export function containsKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Count keyword occurrences
 * @param {string} text - Text to search
 * @param {string[]} keywords - Keywords to count
 * @returns {number}
 */
export function countKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    const regex = new RegExp(keyword.toLowerCase(), 'g');
    const matches = lowerText.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

/**
 * Check if text contains numbers/statistics
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function containsStatistics(text) {
  // Look for patterns like: 50%, $1M, 100 million, 2x, etc.
  const patterns = [
    /\d+%/,           // Percentages
    /\$[\d,.]+[BMKk]?/, // Dollar amounts
    /\d+\s*(million|billion|trillion|thousand)/i,
    /\d+[xX]/,        // Multipliers
    /\d+\s*times/i,
    /\d+\.\d+/        // Decimal numbers
  ];

  return patterns.some(pattern => pattern.test(text));
}

/**
 * Check if text contains a question
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function containsQuestion(text) {
  return text.includes('?') ||
    /^(who|what|when|where|why|how|is|are|can|will|should|could|would)/i.test(text.trim());
}

/**
 * Check if text is provocative or makes a strong claim
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function isProvocative(text) {
  const provocativePatterns = [
    /\b(never|always|every|no one|everyone)\b/i,
    /\b(wrong|right|must|need to)\b/i,
    /\b(actually|really|truth|fact)\b/i,
    /\b(hot take|controversial|unpopular opinion)\b/i,
    /\b(game.?changer|revolutionary|breakthrough)\b/i,
    /!{2,}/  // Multiple exclamation marks
  ];

  return provocativePatterns.some(pattern => pattern.test(text));
}

/**
 * Generate a slug from text
 * @param {string} text - Text to slugify
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

/**
 * Escape special characters for regex
 * @param {string} text - Text to escape
 * @returns {string}
 */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check for duplicate content
 * Returns true if texts are too similar
 *
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @param {number} [threshold=0.8] - Similarity threshold (0-1)
 * @returns {boolean}
 */
export function isSimilar(text1, text2, threshold = 0.8) {
  const clean1 = cleanText(removeUrls(text1)).toLowerCase();
  const clean2 = cleanText(removeUrls(text2)).toLowerCase();

  // Simple Jaccard similarity
  const words1 = new Set(clean1.split(/\s+/));
  const words2 = new Set(clean2.split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

/**
 * Format a number with abbreviations (1K, 1M, etc.)
 * @param {number} num - Number to format
 * @returns {string}
 */
export function formatNumber(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default {
  TWITTER_URL_LENGTH,
  MAX_TWEET_LENGTH,
  TARGET_TWEET_LENGTH,
  calculateTweetLength,
  isValidTweetLength,
  truncateText,
  cleanText,
  extractUrls,
  removeUrls,
  formatHashtag,
  extractHashtags,
  containsKeywords,
  countKeywords,
  containsStatistics,
  containsQuestion,
  isProvocative,
  slugify,
  escapeRegex,
  isSimilar,
  formatNumber
};
