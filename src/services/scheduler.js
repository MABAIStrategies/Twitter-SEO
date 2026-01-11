/**
 * MAB AI Strategies Twitter SEO Agent
 * Scheduler Service
 *
 * Manages the posting queue and schedules posts according to
 * the defined time slots.
 */

import { createLogger } from '../utils/logger.js';
import { POSTING_SCHEDULE, isEasternDST, getTimeSlotForUTCHour } from '../constants/posting-schedule.js';
import { CATEGORIES, getCategoryByIndex } from '../constants/categories.js';
import { getQuoteForDay, shouldIncludeQuote } from '../constants/mab-quotes.js';
import { getTodayString, getEasternHour } from '../utils/date-utils.js';

const logger = createLogger('info').child('scheduler');

/**
 * @typedef {Object} ScheduledPost
 * @property {string} id - Unique post ID
 * @property {number} postNumber - Post number (1-9)
 * @property {number} hour - Scheduled hour (EST)
 * @property {string} categoryId - Category ID
 * @property {number} categoryRank - Rank within category
 * @property {boolean} includeQuote - Whether to include MAB quote
 * @property {number|null} quoteId - MAB quote ID (if applicable)
 * @property {Object|null} article - Assigned article
 * @property {string|null} tweetText - Generated tweet text
 * @property {string} status - pending, ready, posted, failed
 */

/**
 * Scheduler service for managing posts
 */
export class SchedulerService {
  constructor() {
    this.queue = new Map();
    this.postedToday = new Set();
  }

  /**
   * Initialize today's posting schedule
   * @returns {ScheduledPost[]}
   */
  initializeDailySchedule() {
    const today = getTodayString();
    const quoteOfDay = getQuoteForDay();
    const schedule = [];

    for (const slot of POSTING_SCHEDULE) {
      const post = {
        id: `${today}-${slot.postNumber}`,
        postNumber: slot.postNumber,
        hour: slot.hour,
        utcHour: isEasternDST() ? slot.utcHourDST : slot.utcHour,
        categoryId: slot.categoryId,
        categoryRank: slot.categoryRank,
        includeQuote: slot.includeQuote,
        quoteId: slot.includeQuote ? quoteOfDay.id : null,
        article: null,
        tweetText: null,
        hashtags: [],
        status: 'pending'
      };

      this.queue.set(post.id, post);
      schedule.push(post);
    }

    logger.info(`Initialized schedule for ${today} with ${schedule.length} posts`);
    return schedule;
  }

  /**
   * Assign articles to scheduled posts
   * @param {Object[]} rankedArticles - Articles ranked by score, grouped by category
   */
  assignArticlesToSchedule(rankedArticles) {
    // Group articles by category
    const articlesByCategory = {};
    for (const article of rankedArticles) {
      if (!articlesByCategory[article.category]) {
        articlesByCategory[article.category] = [];
      }
      articlesByCategory[article.category].push(article);
    }

    // Assign to each slot based on category and rank
    for (const [id, post] of this.queue) {
      const categoryArticles = articlesByCategory[post.categoryId] || [];
      const article = categoryArticles[post.categoryRank - 1]; // 0-indexed

      if (article) {
        post.article = article;
        post.status = 'ready';
        logger.debug(`Assigned article to post ${post.postNumber}`, {
          category: post.categoryId,
          headline: article.headline.substring(0, 50)
        });
      } else {
        post.status = 'no-article';
        logger.warn(`No article available for post ${post.postNumber}`, {
          category: post.categoryId,
          rank: post.categoryRank
        });
      }

      this.queue.set(id, post);
    }

    const readyCount = [...this.queue.values()].filter(p => p.status === 'ready').length;
    logger.info(`Assigned articles: ${readyCount}/${this.queue.size} posts ready`);
  }

  /**
   * Get the post scheduled for the current time slot
   * @param {Date} [now]
   * @returns {ScheduledPost|null}
   */
  getCurrentPost(now = new Date()) {
    const isDST = isEasternDST(now);
    const utcHour = now.getUTCHours();

    const timeSlot = getTimeSlotForUTCHour(utcHour, isDST);
    if (!timeSlot) return null;

    const today = getTodayString(now);
    const postId = `${today}-${timeSlot.postNumber}`;

    const post = this.queue.get(postId);

    if (!post) {
      logger.warn(`No post found for ID: ${postId}`);
      return null;
    }

    if (this.postedToday.has(postId)) {
      logger.info(`Post ${postId} already posted today`);
      return null;
    }

    return post;
  }

  /**
   * Get the next scheduled post
   * @returns {ScheduledPost|null}
   */
  getNextPost() {
    const pendingPosts = [...this.queue.values()]
      .filter(p => p.status === 'ready' && !this.postedToday.has(p.id))
      .sort((a, b) => a.postNumber - b.postNumber);

    return pendingPosts[0] || null;
  }

  /**
   * Mark a post as completed
   * @param {string} postId
   * @param {string} tweetId
   */
  markPosted(postId, tweetId) {
    const post = this.queue.get(postId);
    if (post) {
      post.status = 'posted';
      post.tweetId = tweetId;
      post.postedAt = new Date().toISOString();
      this.queue.set(postId, post);
      this.postedToday.add(postId);

      logger.info(`Marked post ${postId} as posted`, { tweetId });
    }
  }

  /**
   * Mark a post as failed
   * @param {string} postId
   * @param {string} error
   */
  markFailed(postId, error) {
    const post = this.queue.get(postId);
    if (post) {
      post.status = 'failed';
      post.error = error;
      this.queue.set(postId, post);

      logger.error(`Post ${postId} failed`, { error });
    }
  }

  /**
   * Update post with generated tweet text
   * @param {string} postId
   * @param {string} tweetText
   * @param {string[]} hashtags
   */
  setTweetContent(postId, tweetText, hashtags = []) {
    const post = this.queue.get(postId);
    if (post) {
      post.tweetText = tweetText;
      post.hashtags = hashtags;
      this.queue.set(postId, post);
    }
  }

  /**
   * Get all posts for today
   * @returns {ScheduledPost[]}
   */
  getAllPosts() {
    return [...this.queue.values()];
  }

  /**
   * Get posts by status
   * @param {string} status
   * @returns {ScheduledPost[]}
   */
  getPostsByStatus(status) {
    return [...this.queue.values()].filter(p => p.status === status);
  }

  /**
   * Get today's statistics
   * @returns {Object}
   */
  getStats() {
    const all = [...this.queue.values()];
    return {
      total: all.length,
      pending: all.filter(p => p.status === 'pending').length,
      ready: all.filter(p => p.status === 'ready').length,
      posted: all.filter(p => p.status === 'posted').length,
      failed: all.filter(p => p.status === 'failed').length,
      noArticle: all.filter(p => p.status === 'no-article').length
    };
  }

  /**
   * Clear today's schedule (for testing or reset)
   */
  clearSchedule() {
    this.queue.clear();
    this.postedToday.clear();
    logger.info('Schedule cleared');
  }

  /**
   * Export schedule for persistence
   * @returns {Object[]}
   */
  exportSchedule() {
    return [...this.queue.values()].map(post => ({
      ...post,
      article: post.article ? {
        headline: post.article.headline,
        url: post.article.url,
        source: post.article.source
      } : null
    }));
  }

  /**
   * Import schedule from persistence
   * @param {Object[]} schedule
   */
  importSchedule(schedule) {
    this.queue.clear();
    for (const post of schedule) {
      this.queue.set(post.id, post);
      if (post.status === 'posted') {
        this.postedToday.add(post.id);
      }
    }
    logger.info(`Imported ${schedule.length} posts`);
  }

  /**
   * Check if we should run scraping now
   * @param {Date} [now]
   * @returns {boolean}
   */
  shouldRunScraping(now = new Date()) {
    const isDST = isEasternDST(now);
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // 7:30 AM EST = 12:30 UTC (or 11:30 during DST)
    const targetHour = isDST ? 11 : 12;
    const targetMinute = 30;

    return utcHour === targetHour && utcMinute >= targetMinute && utcMinute < targetMinute + 5;
  }

  /**
   * Check if we should run posting now
   * @param {Date} [now]
   * @returns {boolean}
   */
  shouldRunPosting(now = new Date()) {
    const isDST = isEasternDST(now);
    const utcHour = now.getUTCHours();

    return getTimeSlotForUTCHour(utcHour, isDST) !== null;
  }

  /**
   * Get time until next post
   * @param {Date} [now]
   * @returns {{ hours: number, minutes: number, nextSlot: Object|null }}
   */
  getTimeUntilNextPost(now = new Date()) {
    const isDST = isEasternDST(now);
    const currentUTCHour = now.getUTCHours();
    const currentMinutes = now.getUTCMinutes();

    // Find next slot
    for (const slot of POSTING_SCHEDULE) {
      const slotUTCHour = isDST ? slot.utcHourDST : slot.utcHour;
      if (slotUTCHour > currentUTCHour) {
        const hoursUntil = slotUTCHour - currentUTCHour - 1;
        const minutesUntil = 60 - currentMinutes;
        return {
          hours: hoursUntil + Math.floor(minutesUntil / 60),
          minutes: minutesUntil % 60,
          nextSlot: slot
        };
      }
    }

    // No more posts today
    return { hours: 0, minutes: 0, nextSlot: null };
  }
}

/**
 * Create a scheduler service instance
 * @returns {SchedulerService}
 */
export function createSchedulerService() {
  return new SchedulerService();
}

export default SchedulerService;
