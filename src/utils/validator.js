/**
 * MAB AI Strategies Twitter SEO Agent
 * Data Validation Utilities
 *
 * Validates data structures for articles, tweets, and API responses.
 */

/**
 * @typedef {Object} Article
 * @property {string} headline - Article headline
 * @property {string} url - Article URL
 * @property {string} source - Source name
 * @property {string} [publishDate] - Publish date
 * @property {string} summary - Article summary
 * @property {string} category - Category ID
 */

/**
 * @typedef {Object} ScoredArticle
 * @property {string} headline
 * @property {string} url
 * @property {string} source
 * @property {string} publishDate
 * @property {string} summary
 * @property {string} category
 * @property {number} score - Total score (0-100)
 * @property {number} recencyScore
 * @property {number} authorityScore
 * @property {number} engagementScore
 * @property {number} viralityScore
 * @property {number} seoScore
 */

/**
 * @typedef {Object} Tweet
 * @property {string} text - Tweet text
 * @property {string} articleUrl - Article URL
 * @property {string} category - Category ID
 * @property {number} postNumber - Post number (1-9)
 * @property {boolean} includeQuote - Whether MAB quote is included
 * @property {string[]} hashtags - Hashtags used
 */

/**
 * Validate a URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate an article object
 * @param {Object} article - Article to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateArticle(article) {
  const errors = [];

  if (!article || typeof article !== 'object') {
    return { valid: false, errors: ['Article must be an object'] };
  }

  // Required fields
  if (!article.headline || typeof article.headline !== 'string') {
    errors.push('Missing or invalid headline');
  } else if (article.headline.length < 10) {
    errors.push('Headline too short (min 10 characters)');
  }

  if (!article.url || !isValidUrl(article.url)) {
    errors.push('Missing or invalid URL');
  }

  if (!article.source || typeof article.source !== 'string') {
    errors.push('Missing or invalid source');
  }

  if (!article.summary || typeof article.summary !== 'string') {
    errors.push('Missing or invalid summary');
  } else if (article.summary.length < 20) {
    errors.push('Summary too short (min 20 characters)');
  }

  if (!article.category || typeof article.category !== 'string') {
    errors.push('Missing or invalid category');
  }

  // Optional but validate if present
  if (article.publishDate) {
    const date = new Date(article.publishDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid publishDate format');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a scored article
 * @param {Object} article - Scored article to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateScoredArticle(article) {
  const baseValidation = validateArticle(article);
  const errors = [...baseValidation.errors];

  // Check score fields
  if (typeof article.score !== 'number' || article.score < 0 || article.score > 100) {
    errors.push('Invalid score (must be 0-100)');
  }

  const scoreFields = ['recencyScore', 'authorityScore', 'engagementScore', 'viralityScore', 'seoScore'];
  for (const field of scoreFields) {
    if (article[field] !== undefined) {
      if (typeof article[field] !== 'number' || article[field] < 0) {
        errors.push(`Invalid ${field}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a tweet object
 * @param {Object} tweet - Tweet to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTweet(tweet) {
  const errors = [];

  if (!tweet || typeof tweet !== 'object') {
    return { valid: false, errors: ['Tweet must be an object'] };
  }

  if (!tweet.text || typeof tweet.text !== 'string') {
    errors.push('Missing or invalid text');
  } else {
    // Check character limit (accounting for URL shortening)
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = tweet.text.match(urlPattern) || [];
    let effectiveLength = tweet.text.length;
    for (const url of urls) {
      effectiveLength = effectiveLength - url.length + 23;
    }
    if (effectiveLength > 280) {
      errors.push(`Tweet too long (${effectiveLength} characters, max 280)`);
    }
  }

  if (!tweet.articleUrl || !isValidUrl(tweet.articleUrl)) {
    errors.push('Missing or invalid articleUrl');
  }

  if (!tweet.category || typeof tweet.category !== 'string') {
    errors.push('Missing or invalid category');
  }

  if (typeof tweet.postNumber !== 'number' || tweet.postNumber < 1 || tweet.postNumber > 9) {
    errors.push('Invalid postNumber (must be 1-9)');
  }

  if (typeof tweet.includeQuote !== 'boolean') {
    errors.push('Missing includeQuote boolean');
  }

  if (!Array.isArray(tweet.hashtags)) {
    errors.push('hashtags must be an array');
  } else if (tweet.hashtags.length > 3) {
    errors.push('Too many hashtags (max 3)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Perplexity API response
 * @param {Object} response - API response
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePerplexityResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Invalid response object'] };
  }

  if (!response.choices || !Array.isArray(response.choices)) {
    errors.push('Missing choices array');
  } else if (response.choices.length === 0) {
    errors.push('Empty choices array');
  } else if (!response.choices[0].message?.content) {
    errors.push('Missing message content');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate NewsAPI response
 * @param {Object} response - API response
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateNewsApiResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Invalid response object'] };
  }

  if (response.status !== 'ok') {
    errors.push(`API returned status: ${response.status}`);
  }

  if (!response.articles || !Array.isArray(response.articles)) {
    errors.push('Missing articles array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Twitter API response
 * @param {Object} response - API response
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTwitterResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Invalid response object'] };
  }

  if (response.errors) {
    errors.push(`Twitter API errors: ${JSON.stringify(response.errors)}`);
  }

  if (!response.data?.id) {
    errors.push('Missing tweet ID in response');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize article data (clean up and ensure valid structure)
 * @param {Object} article - Raw article data
 * @returns {Article|null}
 */
export function sanitizeArticle(article) {
  if (!article || typeof article !== 'object') return null;

  try {
    return {
      headline: String(article.headline || article.title || '').trim().substring(0, 500),
      url: String(article.url || article.link || '').trim(),
      source: String(article.source?.name || article.source || 'Unknown').trim(),
      publishDate: article.publishDate || article.publishedAt || article.published_date || new Date().toISOString(),
      summary: String(article.summary || article.description || article.content || '').trim().substring(0, 1000),
      category: String(article.category || '').trim()
    };
  } catch (error) {
    return null;
  }
}

/**
 * Deduplicate articles by URL
 * @param {Article[]} articles - Array of articles
 * @returns {Article[]}
 */
export function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(article => {
    if (!article.url) return false;

    // Normalize URL (remove trailing slashes, query params, etc.)
    const normalizedUrl = article.url
      .replace(/\/$/, '')
      .replace(/\?.*$/, '')
      .toLowerCase();

    if (seen.has(normalizedUrl)) return false;
    seen.add(normalizedUrl);
    return true;
  });
}

/**
 * Check if article is too old (beyond 24 hours)
 * @param {Article} article - Article to check
 * @returns {boolean}
 */
export function isArticleTooOld(article) {
  if (!article.publishDate) return false;

  const publishDate = new Date(article.publishDate);
  const now = new Date();
  const hoursDiff = (now - publishDate) / (1000 * 60 * 60);

  return hoursDiff > 24;
}

export default {
  isValidUrl,
  validateArticle,
  validateScoredArticle,
  validateTweet,
  validatePerplexityResponse,
  validateNewsApiResponse,
  validateTwitterResponse,
  sanitizeArticle,
  deduplicateArticles,
  isArticleTooOld
};
