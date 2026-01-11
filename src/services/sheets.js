/**
 * MAB AI Strategies Twitter SEO Agent
 * Google Sheets Service
 *
 * Handles reading and writing data to Google Sheets.
 * Uses service account authentication for Cloudflare Workers compatibility.
 */

import { createLogger } from '../utils/logger.js';
import { getTodayString } from '../utils/date-utils.js';

const logger = createLogger('info').child('sheets');

/**
 * @typedef {Object} SheetsConfig
 * @property {string} credentials - Base64 encoded service account JSON
 * @property {string} sheetId - Google Sheet ID
 */

/**
 * Sheet names used by the application
 */
export const SHEET_NAMES = {
  SCRAPE: 'Scrape', // Daily scrape results
  HEADLINES: 'Headlines', // Filtered and scored articles
  POSTING_QUEUE: 'Posting_Queue', // Queue of posts to send
  POSTED_TWEETS: 'Posted_Tweets', // Successfully posted tweets
  POST_PERFORMANCE: 'Post_Performance', // Tweet metrics
  ERROR_LOG: 'Error_Log', // Error tracking
  AI_INSIGHTS: 'AI_Insights', // Weekly AI-generated insights
  ANALYTICS_IMPORT: 'Analytics_Import_Log' // CSV import history
};

/**
 * Google Sheets API service
 */
export class SheetsService {
  /**
   * @param {SheetsConfig} config
   */
  constructor(config) {
    this.sheetId = config.sheetId;
    this.credentials = this.parseCredentials(config.credentials);
    this.accessToken = null;
    this.tokenExpiry = null;
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  }

  /**
   * Parse base64-encoded credentials
   * @param {string} credentialsBase64
   * @returns {Object}
   */
  parseCredentials(credentialsBase64) {
    try {
      const decoded = atob(credentialsBase64);
      return JSON.parse(decoded);
    } catch (error) {
      logger.error('Failed to parse Google credentials', error);
      return null;
    }
  }

  /**
   * Generate JWT for service account authentication
   * @returns {Promise<string>}
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.credentials) {
      throw new Error('Invalid Google credentials');
    }

    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    // Create JWT payload
    const payload = {
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry
    };

    // Encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    // Sign the JWT
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await this.signJwt(signatureInput, this.credentials.private_key);

    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Subtract 1 minute for safety

    return this.accessToken;
  }

  /**
   * Base64URL encode a string
   * @param {string} str
   * @returns {string}
   */
  base64UrlEncode(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Sign a JWT with RS256
   * @param {string} input
   * @param {string} privateKey
   * @returns {Promise<string>}
   */
  async signJwt(input, privateKey) {
    // Convert PEM to ArrayBuffer
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = privateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    const binaryDer = atob(pemContents);
    const binaryArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryArray[i] = binaryDer.charCodeAt(i);
    }

    // Import the key
    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryArray.buffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    // Sign the input
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(input)
    );

    // Convert to base64url
    return this.base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );
  }

  /**
   * Make an authenticated request to Google Sheets API
   * @param {string} method
   * @param {string} endpoint
   * @param {Object} [body]
   * @returns {Promise<Object>}
   */
  async request(method, endpoint, body = null) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/${this.sheetId}${endpoint}`;

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Sheets API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get or create a sheet tab
   * @param {string} sheetName
   * @returns {Promise<number>} Sheet ID
   */
  async getOrCreateSheet(sheetName) {
    // Get spreadsheet metadata
    const spreadsheet = await this.request('GET', '');

    // Check if sheet exists
    const existingSheet = spreadsheet.sheets?.find(
      s => s.properties.title === sheetName
    );

    if (existingSheet) {
      return existingSheet.properties.sheetId;
    }

    // Create new sheet
    const response = await this.request('POST', ':batchUpdate', {
      requests: [{
        addSheet: {
          properties: { title: sheetName }
        }
      }]
    });

    return response.replies[0].addSheet.properties.sheetId;
  }

  /**
   * Append rows to a sheet
   * @param {string} sheetName
   * @param {Array<Array>} rows - 2D array of values
   * @returns {Promise<Object>}
   */
  async appendRows(sheetName, rows) {
    if (!rows || rows.length === 0) return null;

    const range = `${sheetName}!A:Z`;

    return this.request(
      'POST',
      `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      { values: rows }
    );
  }

  /**
   * Read values from a sheet
   * @param {string} sheetName
   * @param {string} [range='A:Z']
   * @returns {Promise<Array<Array>>}
   */
  async readSheet(sheetName, range = 'A:Z') {
    const fullRange = `${sheetName}!${range}`;

    try {
      const response = await this.request('GET', `/values/${encodeURIComponent(fullRange)}`);
      return response.values || [];
    } catch (error) {
      if (error.message.includes('404')) {
        return []; // Sheet doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Update a specific cell or range
   * @param {string} sheetName
   * @param {string} range
   * @param {Array<Array>} values
   * @returns {Promise<Object>}
   */
  async updateRange(sheetName, range, values) {
    const fullRange = `${sheetName}!${range}`;

    return this.request(
      'PUT',
      `/values/${encodeURIComponent(fullRange)}?valueInputOption=USER_ENTERED`,
      { values }
    );
  }

  /**
   * Find a row by a column value
   * @param {string} sheetName
   * @param {number} columnIndex - 0-based column index
   * @param {string} value - Value to find
   * @returns {Promise<{ rowIndex: number, row: Array } | null>}
   */
  async findRow(sheetName, columnIndex, value) {
    const rows = await this.readSheet(sheetName);

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][columnIndex] === value) {
        return { rowIndex: i + 1, row: rows[i] }; // 1-based for Sheets API
      }
    }

    return null;
  }

  // ========== High-level methods for the Twitter agent ==========

  /**
   * Log scraped articles
   * @param {string} category
   * @param {Array} articles
   * @param {string} apiUsed
   * @returns {Promise<void>}
   */
  async logScrapedArticles(category, articles, apiUsed) {
    const sheetName = `Scrape_${getTodayString()}`;
    await this.getOrCreateSheet(sheetName);

    // Add header if sheet is empty
    const existing = await this.readSheet(sheetName);
    if (existing.length === 0) {
      await this.appendRows(sheetName, [[
        'Timestamp', 'Category', 'Headline', 'URL', 'Source',
        'Publish_Date', 'Summary', 'API_Used', 'Scrape_Status'
      ]]);
    }

    const rows = articles.map(article => [
      new Date().toISOString(),
      category,
      article.headline,
      article.url,
      article.source,
      article.publishDate,
      article.summary,
      apiUsed,
      'success'
    ]);

    await this.appendRows(sheetName, rows);
    logger.info(`Logged ${rows.length} articles to ${sheetName}`);
  }

  /**
   * Save filtered and ranked headlines
   * @param {Array} scoredArticles
   * @returns {Promise<void>}
   */
  async saveHeadlines(scoredArticles) {
    const sheetName = `Headlines_${getTodayString()}`;
    await this.getOrCreateSheet(sheetName);

    const headers = [
      'Rank', 'Category', 'Headline', 'URL', 'Source', 'Score',
      'Recency_Score', 'Authority_Score', 'Engagement_Score',
      'Virality_Score', 'SEO_Score', 'Posting_Time_Slot', 'MAB_Quote_Number'
    ];

    await this.updateRange(sheetName, 'A1', [headers]);

    const rows = scoredArticles.map((article, index) => [
      index + 1,
      article.category,
      article.headline,
      article.url,
      article.source,
      article.score,
      article.recencyScore,
      article.authorityScore,
      article.engagementScore,
      article.viralityScore,
      article.seoScore,
      article.postingSlot || '',
      article.mabQuoteNumber || ''
    ]);

    await this.appendRows(sheetName, rows);
    logger.info(`Saved ${rows.length} headlines to ${sheetName}`);
  }

  /**
   * Add post to queue
   * @param {Object} post
   * @returns {Promise<void>}
   */
  async addToPostingQueue(post) {
    await this.getOrCreateSheet(SHEET_NAMES.POSTING_QUEUE);

    const row = [
      post.scheduledTime,
      post.postNumber,
      post.category,
      post.headline,
      post.url,
      post.tweetText,
      post.hashtags?.join(', ') || '',
      post.includeQuote ? 'Yes' : 'No',
      post.mabQuoteId || '',
      'pending'
    ];

    await this.appendRows(SHEET_NAMES.POSTING_QUEUE, [row]);
  }

  /**
   * Log a posted tweet
   * @param {Object} tweet
   * @returns {Promise<void>}
   */
  async logPostedTweet(tweet) {
    await this.getOrCreateSheet(SHEET_NAMES.POSTED_TWEETS);

    const row = [
      tweet.postedAt || new Date().toISOString(),
      tweet.tweetId,
      tweet.text,
      tweet.articleUrl,
      tweet.category,
      tweet.postNumber,
      tweet.includeQuote ? 'Yes' : 'No',
      tweet.hashtags?.join(', ') || ''
    ];

    await this.appendRows(SHEET_NAMES.POSTED_TWEETS, [row]);
    logger.info(`Logged tweet ${tweet.tweetId}`);
  }

  /**
   * Log tweet performance metrics
   * @param {Object} performance
   * @returns {Promise<void>}
   */
  async logPerformance(performance) {
    await this.getOrCreateSheet(SHEET_NAMES.POST_PERFORMANCE);

    const row = [
      performance.postDate,
      performance.postTime,
      performance.category,
      performance.rank,
      performance.articleUrl,
      performance.postText,
      performance.tweetId,
      performance.tweetUrl,
      performance.likes || 0,
      performance.retweets || 0,
      performance.replies || 0,
      performance.quotes || 0,
      performance.impressions || '',
      performance.linkClicks || '',
      performance.profileVisits || '',
      performance.ctr || '',
      performance.engagementRate || '',
      performance.collectionType || 'initial' // initial, day1, day3, day10
    ];

    await this.appendRows(SHEET_NAMES.POST_PERFORMANCE, [row]);
  }

  /**
   * Log an error
   * @param {string} phase
   * @param {Error} error
   * @param {Object} [context]
   * @returns {Promise<void>}
   */
  async logError(phase, error, context = {}) {
    try {
      await this.getOrCreateSheet(SHEET_NAMES.ERROR_LOG);

      const row = [
        new Date().toISOString(),
        phase,
        error.message,
        error.stack || '',
        JSON.stringify(context)
      ];

      await this.appendRows(SHEET_NAMES.ERROR_LOG, [row]);
    } catch (logError) {
      logger.error('Failed to log error to Sheets', logError);
    }
  }

  /**
   * Test the connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.request('GET', '');
      logger.info('Google Sheets connection successful');
      return true;
    } catch (error) {
      logger.error('Google Sheets connection failed', error);
      return false;
    }
  }
}

/**
 * Create a Sheets service instance
 * @param {Object} config
 * @returns {SheetsService}
 */
export function createSheetsService(config) {
  return new SheetsService(config.sheets);
}

export default SheetsService;
