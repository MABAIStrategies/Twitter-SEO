/**
 * MAB AI Strategies Twitter SEO Agent
 * Twitter API v2 Service
 *
 * Handles tweet posting, metrics retrieval, and trending hashtags.
 * Uses OAuth 1.0a for user context authentication.
 */

import { createLogger } from '../utils/logger.js';
import { calculateTweetLength, MAX_TWEET_LENGTH } from '../utils/text-utils.js';

const logger = createLogger('info').child('twitter');

/**
 * @typedef {Object} TwitterConfig
 * @property {string} apiKey - Twitter API Key
 * @property {string} apiSecret - Twitter API Secret
 * @property {string} accessToken - User Access Token
 * @property {string} accessSecret - User Access Token Secret
 * @property {string} apiBaseUrl - Twitter API base URL
 */

/**
 * @typedef {Object} Tweet
 * @property {string} id - Tweet ID
 * @property {string} text - Tweet text
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} TweetMetrics
 * @property {number} like_count
 * @property {number} retweet_count
 * @property {number} reply_count
 * @property {number} quote_count
 * @property {number} [bookmark_count]
 */

/**
 * Generate OAuth 1.0a signature
 * This is a simplified implementation for Cloudflare Workers
 */
async function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Use Web Crypto API (available in Cloudflare Workers)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBase);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Generate a random nonce
 * @returns {string}
 */
function generateNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/**
 * Twitter API v2 client
 */
export class TwitterService {
  /**
   * @param {TwitterConfig} config
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken;
    this.accessSecret = config.accessSecret;
    this.baseUrl = config.apiBaseUrl || 'https://api.twitter.com/2';
    this.userId = config.userId;
  }

  /**
   * Generate OAuth 1.0a authorization header
   * @param {string} method - HTTP method
   * @param {string} url - Full URL
   * @param {Object} [bodyParams={}] - Body parameters (for POST)
   * @returns {Promise<string>}
   */
  async getAuthHeader(method, url, bodyParams = {}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    const oauthParams = {
      oauth_consumer_key: this.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: this.accessToken,
      oauth_version: '1.0'
    };

    // For signature, we need to include body params for POST requests
    const allParams = { ...oauthParams, ...bodyParams };

    const signature = await generateOAuthSignature(
      method,
      url,
      allParams,
      this.apiSecret,
      this.accessSecret
    );

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    return authHeader;
  }

  /**
   * Make an authenticated request to Twitter API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} [body] - Request body
   * @returns {Promise<Object>}
   */
  async request(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;

    const authHeader = await this.getAuthHeader(method, url, {});

    const options = {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.title || `HTTP ${response.status}`;
      throw new Error(`Twitter API error: ${errorMessage}`);
    }

    return response.json();
  }

  /**
   * Post a tweet
   * @param {string} text - Tweet text
   * @returns {Promise<Tweet>}
   */
  async postTweet(text) {
    // Validate tweet length
    const length = calculateTweetLength(text);
    if (length > MAX_TWEET_LENGTH) {
      throw new Error(`Tweet too long: ${length} characters (max ${MAX_TWEET_LENGTH})`);
    }

    logger.info(`Posting tweet (${length} chars)`);

    const response = await this.request('POST', '/tweets', { text });

    if (!response.data?.id) {
      throw new Error('Failed to create tweet: No ID returned');
    }

    logger.info(`Tweet posted successfully: ${response.data.id}`);

    return {
      id: response.data.id,
      text: response.data.text || text,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Get tweet metrics
   * @param {string} tweetId - Tweet ID
   * @returns {Promise<TweetMetrics>}
   */
  async getTweetMetrics(tweetId) {
    const response = await this.request(
      'GET',
      `/tweets/${tweetId}?tweet.fields=public_metrics`
    );

    if (!response.data?.public_metrics) {
      throw new Error('Failed to get tweet metrics');
    }

    return response.data.public_metrics;
  }

  /**
   * Get metrics for multiple tweets
   * @param {string[]} tweetIds - Array of tweet IDs (max 100)
   * @returns {Promise<Object<string, TweetMetrics>>}
   */
  async getBatchMetrics(tweetIds) {
    if (tweetIds.length === 0) return {};
    if (tweetIds.length > 100) {
      throw new Error('Maximum 100 tweets per batch');
    }

    const ids = tweetIds.join(',');
    const response = await this.request(
      'GET',
      `/tweets?ids=${ids}&tweet.fields=public_metrics`
    );

    const metrics = {};
    if (response.data) {
      for (const tweet of response.data) {
        metrics[tweet.id] = tweet.public_metrics;
      }
    }

    return metrics;
  }

  /**
   * Get recent tweets from user
   * @param {number} [maxResults=10] - Number of tweets to fetch
   * @returns {Promise<Tweet[]>}
   */
  async getRecentTweets(maxResults = 10) {
    if (!this.userId) {
      throw new Error('User ID required for fetching tweets');
    }

    const response = await this.request(
      'GET',
      `/users/${this.userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,text`
    );

    return response.data || [];
  }

  /**
   * Check for duplicate content in recent tweets
   * @param {string} text - Proposed tweet text
   * @param {number} [checkCount=100] - Number of recent tweets to check
   * @returns {Promise<boolean>} True if duplicate found
   */
  async isDuplicate(text, checkCount = 100) {
    try {
      const recentTweets = await this.getRecentTweets(Math.min(checkCount, 100));

      // Normalize text for comparison
      const normalizedNew = text.toLowerCase().replace(/https?:\/\/[^\s]+/g, '').trim();

      for (const tweet of recentTweets) {
        const normalizedExisting = tweet.text.toLowerCase().replace(/https?:\/\/[^\s]+/g, '').trim();

        // Check for high similarity
        if (this.calculateSimilarity(normalizedNew, normalizedExisting) > 0.8) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.warn('Failed to check for duplicates', { error: error.message });
      return false; // Proceed if we can't check
    }
  }

  /**
   * Calculate text similarity (Jaccard index)
   * @param {string} text1
   * @param {string} text2
   * @returns {number}
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Get trending topics (requires elevated access)
   * Note: Free tier may not have access to this endpoint
   * @param {string} [woeid='23424977'] - WOEID (default: United States)
   * @returns {Promise<string[]>}
   */
  async getTrendingTopics(woeid = '23424977') {
    try {
      // Twitter API v2 trends endpoint
      const response = await this.request('GET', `/trends/by/woeid/${woeid}`);
      return response.data?.map(trend => trend.name) || [];
    } catch (error) {
      logger.warn('Failed to fetch trending topics (may require elevated access)', {
        error: error.message
      });

      // Return default AI-related hashtags as fallback
      return [
        '#AI', '#ArtificialIntelligence', '#MachineLearning',
        '#TechNews', '#Innovation', '#FutureOfWork'
      ];
    }
  }

  /**
   * Get user information
   * @returns {Promise<Object>}
   */
  async getUserInfo() {
    const response = await this.request(
      'GET',
      '/users/me?user.fields=public_metrics,created_at'
    );
    return response.data;
  }

  /**
   * Test the API connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const user = await this.getUserInfo();
      logger.info(`Connected to Twitter as: @${user.username}`);
      return true;
    } catch (error) {
      logger.error('Twitter connection test failed', error);
      return false;
    }
  }

  /**
   * Get the Twitter URL for a tweet
   * @param {string} tweetId - Tweet ID
   * @param {string} [username] - Username (optional, will be looked up if not provided)
   * @returns {string}
   */
  getTweetUrl(tweetId, username = null) {
    const user = username || 'i';
    return `https://twitter.com/${user}/status/${tweetId}`;
  }
}

/**
 * Create a Twitter service instance
 * @param {Object} config - Full configuration object
 * @returns {TwitterService}
 */
export function createTwitterService(config) {
  return new TwitterService(config.twitter);
}

export default TwitterService;
