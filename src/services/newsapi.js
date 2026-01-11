/**
 * MAB AI Strategies Twitter SEO Agent
 * NewsAPI Service
 *
 * Backup news source using NewsAPI.org free tier.
 * Used when Perplexity fails or returns insufficient articles.
 */

import { createLogger } from '../utils/logger.js';
import { getYesterdayString } from '../utils/date-utils.js';

const logger = createLogger('info').child('newsapi');

/**
 * @typedef {Object} NewsApiConfig
 * @property {string} apiKey - NewsAPI key
 * @property {string} endpoint - API endpoint
 * @property {number} maxRequestsPerDay - Rate limit
 */

/**
 * @typedef {Object} Article
 * @property {string} headline - Article headline
 * @property {string} url - Article URL
 * @property {string} source - Source name
 * @property {string} publishDate - Publish date
 * @property {string} summary - Article summary
 */

/**
 * NewsAPI client
 */
export class NewsApiService {
  /**
   * @param {NewsApiConfig} config
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || 'https://newsapi.org/v2/everything';
    this.maxRequestsPerDay = config.maxRequestsPerDay || 100;
    this.requestCount = 0;
  }

  /**
   * Build query parameters for a category
   * @param {string} categoryId - Category ID
   * @returns {string[]} Array of query strings
   */
  getQueriesForCategory(categoryId) {
    const queries = {
      'ai-providers': [
        '(Google OR OpenAI OR Anthropic) AND "artificial intelligence"',
        '(GPT OR Claude OR Gemini) AND (announcement OR launch)',
        '"AI model" AND (Google OR OpenAI OR Anthropic)'
      ],
      'business-ai': [
        '"mid-market" AND (AI OR automation OR "artificial intelligence")',
        '"business automation" AND (implementation OR ROI)',
        '"AI strategy" AND (business OR enterprise)'
      ],
      'ai-safety': [
        '"AI safety" OR "AI regulation" OR "AI ethics"',
        '"artificial intelligence" AND (regulation OR policy OR governance)',
        '"AI risk" OR "responsible AI"'
      ]
    };

    return queries[categoryId] || queries['ai-providers'];
  }

  /**
   * Make a request to NewsAPI
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>}
   */
  async request(params) {
    if (this.requestCount >= this.maxRequestsPerDay) {
      throw new Error('NewsAPI daily rate limit reached');
    }

    const url = new URL(this.endpoint);
    url.searchParams.set('apiKey', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    this.requestCount++;
    logger.debug(`NewsAPI request #${this.requestCount}`, { params });

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`NewsAPI error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    return response.json();
  }

  /**
   * Search for news articles in a category
   * @param {string} categoryId - Category ID
   * @returns {Promise<Article[]>}
   */
  async searchNews(categoryId) {
    logger.info(`Searching NewsAPI for category: ${categoryId}`);

    const queries = this.getQueriesForCategory(categoryId);
    const allArticles = [];
    const yesterday = getYesterdayString();

    for (const query of queries) {
      try {
        const response = await this.request({
          q: query,
          from: yesterday,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: 20
        });

        if (response.status === 'ok' && response.articles) {
          const articles = response.articles.map(article => this.transformArticle(article, categoryId));
          allArticles.push(...articles);
        }

      } catch (error) {
        logger.warn(`NewsAPI query failed: ${query}`, { error: error.message });
        // Continue with other queries
      }
    }

    // Deduplicate by URL
    const uniqueArticles = this.deduplicateArticles(allArticles);

    logger.info(`Found ${uniqueArticles.length} unique articles from NewsAPI`);
    return uniqueArticles;
  }

  /**
   * Transform NewsAPI article to our format
   * @param {Object} article - NewsAPI article
   * @param {string} categoryId - Category ID
   * @returns {Article}
   */
  transformArticle(article, categoryId) {
    return {
      headline: article.title || '',
      url: article.url || '',
      source: article.source?.name || 'Unknown',
      publishDate: article.publishedAt || new Date().toISOString(),
      summary: article.description || article.content?.substring(0, 200) || '',
      category: categoryId,
      apiUsed: 'newsapi'
    };
  }

  /**
   * Remove duplicate articles by URL
   * @param {Article[]} articles
   * @returns {Article[]}
   */
  deduplicateArticles(articles) {
    const seen = new Set();
    return articles.filter(article => {
      if (!article.url) return false;

      const normalizedUrl = article.url.toLowerCase().replace(/\/$/, '');
      if (seen.has(normalizedUrl)) return false;

      seen.add(normalizedUrl);
      return true;
    });
  }

  /**
   * Get top headlines (alternative endpoint)
   * @param {string} [category] - Category (technology, business, etc.)
   * @returns {Promise<Article[]>}
   */
  async getTopHeadlines(category = 'technology') {
    const endpoint = 'https://newsapi.org/v2/top-headlines';

    const url = new URL(endpoint);
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set('category', category);
    url.searchParams.set('country', 'us');
    url.searchParams.set('pageSize', 20);

    this.requestCount++;

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`NewsAPI top-headlines error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'ok' && data.articles) {
      return data.articles.map(article => this.transformArticle(article, 'general'));
    }

    return [];
  }

  /**
   * Test the API connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const response = await this.request({
        q: 'artificial intelligence',
        pageSize: 1
      });
      return response.status === 'ok';
    } catch (error) {
      logger.error('NewsAPI connection test failed', error);
      return false;
    }
  }

  /**
   * Reset daily request counter (call at start of each day)
   */
  resetRequestCount() {
    this.requestCount = 0;
  }

  /**
   * Get remaining requests for today
   * @returns {number}
   */
  getRemainingRequests() {
    return Math.max(0, this.maxRequestsPerDay - this.requestCount);
  }
}

/**
 * Create a NewsAPI service instance
 * @param {Object} config - Configuration with apiKey
 * @returns {NewsApiService}
 */
export function createNewsApiService(config) {
  return new NewsApiService(config.newsapi);
}

export default NewsApiService;
