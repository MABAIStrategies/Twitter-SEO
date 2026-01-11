/**
 * MAB AI Strategies Twitter SEO Agent
 * Phase 1: Scraper Agent
 *
 * Responsible for scraping news articles from Perplexity (primary)
 * and NewsAPI (backup). Runs at 7:30 AM EST on weekdays.
 */

import { createLogger } from '../utils/logger.js';
import { createPerplexityService } from '../services/perplexity.js';
import { createNewsApiService } from '../services/newsapi.js';
import { createSheetsService } from '../services/sheets.js';
import { createEmailService } from '../services/email.js';
import { CATEGORIES } from '../constants/categories.js';
import { validateArticle, sanitizeArticle, deduplicateArticles } from '../utils/validator.js';
import { getTodayString, getYesterdayString } from '../utils/date-utils.js';
import { getConfig, isDryRun } from '../utils/config.js';

const logger = createLogger('info').child('scraper');

/**
 * Minimum articles required per category
 */
const MIN_ARTICLES_PER_CATEGORY = 5;

/**
 * Target articles per category
 */
const TARGET_ARTICLES_PER_CATEGORY = 15;

/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 2;

/**
 * Retry delay in milliseconds
 */
const RETRY_DELAY_MS = 300000; // 5 minutes

/**
 * Scraper Agent class
 */
export class ScraperAgent {
  /**
   * @param {Object} config - Full configuration object
   */
  constructor(config) {
    this.config = config;
    this.perplexity = createPerplexityService(config);
    this.newsApi = createNewsApiService(config);
    this.sheets = createSheetsService(config);
    this.email = createEmailService(config);
    this.dryRun = isDryRun(config);
  }

  /**
   * Run the scraping agent
   * @returns {Promise<Object>} Scraping results
   */
  async run() {
    logger.info('Starting scraper agent');

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      categories: {},
      totalArticles: 0,
      errors: []
    };

    try {
      // Process each category
      for (const category of CATEGORIES) {
        const categoryResult = await this.scrapeCategory(category);
        results.categories[category.id] = categoryResult;
        results.totalArticles += categoryResult.articles.length;

        if (!categoryResult.success) {
          results.errors.push({
            category: category.id,
            error: categoryResult.error
          });
        }
      }

      // Log results to Google Sheets
      if (!this.dryRun) {
        await this.logResults(results);
      }

      // Check for critical failures
      const failedCategories = Object.values(results.categories)
        .filter(r => !r.success);

      if (failedCategories.length > 0) {
        results.success = false;
        logger.error(`Scraping completed with ${failedCategories.length} category failures`);
      } else {
        logger.info(`Scraping completed: ${results.totalArticles} articles from ${CATEGORIES.length} categories`);
      }

    } catch (error) {
      logger.error('Scraper agent failed', error);
      results.success = false;
      results.errors.push({ phase: 'scraper', error: error.message });

      // Send email alert
      await this.email.sendErrorAlert('scraper', error, results);
    }

    return results;
  }

  /**
   * Scrape articles for a single category
   * @param {Object} category - Category object
   * @returns {Promise<Object>}
   */
  async scrapeCategory(category) {
    logger.info(`Scraping category: ${category.name}`);

    const result = {
      categoryId: category.id,
      success: false,
      articles: [],
      apiUsed: null,
      error: null
    };

    // Try Perplexity first
    try {
      const articles = await this.scrapeWithPerplexity(category);

      if (articles.length >= MIN_ARTICLES_PER_CATEGORY) {
        result.articles = articles;
        result.apiUsed = 'perplexity';
        result.success = true;
        logger.info(`Perplexity returned ${articles.length} articles for ${category.id}`);
        return result;
      }

      logger.warn(`Perplexity returned only ${articles.length} articles (min: ${MIN_ARTICLES_PER_CATEGORY})`);
      result.perplexityCount = articles.length;
      result.perplexityArticles = articles;

    } catch (perplexityError) {
      logger.error(`Perplexity failed for ${category.id}`, perplexityError);
      result.perplexityError = perplexityError.message;
    }

    // Fall back to NewsAPI
    try {
      const newsApiArticles = await this.scrapeWithNewsApi(category);

      // Combine with any Perplexity results
      const combined = deduplicateArticles([
        ...(result.perplexityArticles || []),
        ...newsApiArticles
      ]);

      if (combined.length >= MIN_ARTICLES_PER_CATEGORY) {
        result.articles = combined.slice(0, TARGET_ARTICLES_PER_CATEGORY);
        result.apiUsed = result.perplexityArticles?.length > 0 ? 'combined' : 'newsapi';
        result.success = true;
        logger.info(`NewsAPI fallback: ${combined.length} total articles for ${category.id}`);
        return result;
      }

      logger.warn(`Combined sources only have ${combined.length} articles`);

    } catch (newsApiError) {
      logger.error(`NewsAPI failed for ${category.id}`, newsApiError);
      result.newsApiError = newsApiError.message;
    }

    // Both APIs failed - try to use previous day's articles
    try {
      const previousDayArticles = await this.getPreviousDayArticles(category.id);

      if (previousDayArticles.length > 0) {
        result.articles = previousDayArticles;
        result.apiUsed = 'previous-day';
        result.success = true;
        logger.info(`Using ${previousDayArticles.length} articles from previous day for ${category.id}`);
        return result;
      }

    } catch (fallbackError) {
      logger.error('Failed to get previous day articles', fallbackError);
    }

    // Complete failure
    result.error = 'All scraping methods failed';
    logger.error(`Critical: All sources failed for category ${category.id}`);

    // Send critical alert
    await this.email.sendCriticalFailure(category.name, {
      perplexity: result.perplexityError ? { message: result.perplexityError } : null,
      newsapi: result.newsApiError ? { message: result.newsApiError } : null
    });

    return result;
  }

  /**
   * Scrape with Perplexity API
   * @param {Object} category
   * @returns {Promise<Object[]>}
   */
  async scrapeWithPerplexity(category) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Perplexity retry ${attempt}/${MAX_RETRIES} for ${category.id}`);
          await this.delay(RETRY_DELAY_MS);
        }

        const articles = await this.perplexity.searchNews(category.description);

        // Validate and enrich articles
        return articles
          .map(article => this.enrichArticle(article, category.id, 'perplexity'))
          .filter(article => {
            const validation = validateArticle(article);
            if (!validation.valid) {
              logger.debug('Invalid article', { errors: validation.errors, headline: article.headline });
            }
            return validation.valid;
          });

      } catch (error) {
        lastError = error;
        logger.warn(`Perplexity attempt ${attempt + 1} failed`, { error: error.message });
      }
    }

    throw lastError;
  }

  /**
   * Scrape with NewsAPI
   * @param {Object} category
   * @returns {Promise<Object[]>}
   */
  async scrapeWithNewsApi(category) {
    const articles = await this.newsApi.searchNews(category.id);

    return articles
      .map(article => this.enrichArticle(article, category.id, 'newsapi'))
      .filter(article => {
        const validation = validateArticle(article);
        return validation.valid;
      });
  }

  /**
   * Get articles from previous day's scrape
   * @param {string} categoryId
   * @returns {Promise<Object[]>}
   */
  async getPreviousDayArticles(categoryId) {
    const yesterday = getYesterdayString();
    const sheetName = `Scrape_${yesterday}`;

    try {
      const rows = await this.sheets.readSheet(sheetName);

      if (rows.length <= 1) return []; // Only header or empty

      // Filter by category and convert to article objects
      return rows
        .slice(1) // Skip header
        .filter(row => row[1] === categoryId) // Category column
        .map(row => ({
          headline: row[2],
          url: row[3],
          source: row[4],
          publishDate: row[5],
          summary: row[6],
          category: categoryId,
          apiUsed: 'previous-day'
        }))
        .slice(0, TARGET_ARTICLES_PER_CATEGORY);

    } catch (error) {
      logger.warn(`Could not read previous day's scrape: ${error.message}`);
      return [];
    }
  }

  /**
   * Enrich article with additional metadata
   * @param {Object} article
   * @param {string} categoryId
   * @param {string} apiUsed
   * @returns {Object}
   */
  enrichArticle(article, categoryId, apiUsed) {
    const sanitized = sanitizeArticle(article);
    if (!sanitized) return null;

    return {
      ...sanitized,
      category: categoryId,
      apiUsed,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Log results to Google Sheets
   * @param {Object} results
   */
  async logResults(results) {
    for (const [categoryId, categoryResult] of Object.entries(results.categories)) {
      if (categoryResult.articles.length > 0) {
        await this.sheets.logScrapedArticles(
          categoryId,
          categoryResult.articles,
          categoryResult.apiUsed
        );
      }
    }
  }

  /**
   * Delay helper
   * @param {number} ms
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all scraped articles (for passing to filter agent)
   * @param {Object} results - Results from run()
   * @returns {Object[]}
   */
  getAllArticles(results) {
    const articles = [];
    for (const categoryResult of Object.values(results.categories)) {
      articles.push(...categoryResult.articles);
    }
    return articles;
  }
}

/**
 * Create and run the scraper agent
 * @param {Object} env - Cloudflare Workers env object
 * @returns {Promise<Object>}
 */
export async function run(env) {
  const config = getConfig(env);
  const agent = new ScraperAgent(config);
  return agent.run();
}

/**
 * Create a scraper agent instance
 * @param {Object} config
 * @returns {ScraperAgent}
 */
export function createScraperAgent(config) {
  return new ScraperAgent(config);
}

export default ScraperAgent;
