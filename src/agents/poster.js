/**
 * MAB AI Strategies Twitter SEO Agent
 * Phase 3: Poster Agent
 *
 * Creates engaging tweets and posts them to Twitter.
 * Runs at scheduled times (9 AM - 5 PM EST, hourly).
 */

import { createLogger } from '../utils/logger.js';
import { createTwitterService } from '../services/twitter.js';
import { createSheetsService } from '../services/sheets.js';
import { createPerplexityService } from '../services/perplexity.js';
import { createSchedulerService } from '../services/scheduler.js';
import { createEmailService } from '../services/email.js';
import { getQuoteForDay, getRandomTransition } from '../constants/mab-quotes.js';
import { CATEGORIES, getCategoryById } from '../constants/categories.js';
import {
  calculateTweetLength, MAX_TWEET_LENGTH, truncateText,
  formatHashtag, extractHashtags
} from '../utils/text-utils.js';
import { getConfig, isDryRun } from '../utils/config.js';
import { formatDate } from '../utils/date-utils.js';

const logger = createLogger('info').child('poster');

/**
 * Default hashtags by category
 */
const DEFAULT_HASHTAGS = {
  'ai-providers': ['#AI', '#ArtificialIntelligence', '#TechNews'],
  'business-ai': ['#AI', '#Automation', '#DigitalTransformation'],
  'ai-safety': ['#AI', '#AISafety', '#AIEthics']
};

/**
 * Example tone patterns for variety
 */
const TONE_PATTERNS = [
  { type: 'insight', prefix: '', suffix: '' },
  { type: 'question', prefix: '', suffix: '' },
  { type: 'contrarian', prefix: 'Hot take: ', suffix: '' },
  { type: 'observation', prefix: '', suffix: '' },
  { type: 'witty', prefix: '', suffix: '' }
];

/**
 * Poster Agent class
 */
export class PosterAgent {
  /**
   * @param {Object} config - Full configuration object
   */
  constructor(config) {
    this.config = config;
    this.twitter = createTwitterService(config);
    this.sheets = createSheetsService(config);
    this.perplexity = createPerplexityService(config);
    this.scheduler = createSchedulerService();
    this.email = createEmailService(config);
    this.dryRun = isDryRun(config);
  }

  /**
   * Run the poster agent for current time slot
   * @param {number} [utcHour] - Current UTC hour (for testing)
   * @returns {Promise<Object>}
   */
  async run(utcHour) {
    logger.info('Starting poster agent');

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      post: null,
      error: null
    };

    try {
      // Get current post from schedule
      const post = this.scheduler.getCurrentPost();

      if (!post) {
        logger.info('No post scheduled for this time slot');
        result.success = true;
        result.message = 'No post scheduled';
        return result;
      }

      if (post.status !== 'ready') {
        logger.warn(`Post ${post.id} not ready (status: ${post.status})`);
        result.success = false;
        result.error = `Post not ready: ${post.status}`;
        return result;
      }

      // Create tweet content
      const tweetContent = await this.createTweetContent(post);

      // Check for duplicates
      const isDuplicate = await this.twitter.isDuplicate(tweetContent.text);
      if (isDuplicate) {
        logger.warn('Duplicate content detected, regenerating');
        // Try with different tone
        const alternateContent = await this.createTweetContent(post, 'contrarian');
        tweetContent.text = alternateContent.text;
      }

      // Post to Twitter
      let tweetResult;
      if (this.dryRun) {
        logger.info('DRY RUN: Would post tweet', { text: tweetContent.text });
        tweetResult = {
          id: `dry-run-${Date.now()}`,
          text: tweetContent.text,
          created_at: new Date().toISOString()
        };
      } else {
        tweetResult = await this.twitter.postTweet(tweetContent.text);
      }

      // Mark as posted
      this.scheduler.markPosted(post.id, tweetResult.id);

      // Log to sheets
      if (!this.dryRun) {
        await this.logPostedTweet(post, tweetResult, tweetContent);
      }

      result.post = {
        id: post.id,
        tweetId: tweetResult.id,
        text: tweetContent.text,
        hashtags: tweetContent.hashtags,
        category: post.categoryId,
        includeQuote: post.includeQuote
      };

      logger.info(`Successfully posted tweet ${tweetResult.id}`);

      // Schedule initial metrics collection (5 minutes)
      // Note: In production, this would be a separate scheduled task

    } catch (error) {
      logger.error('Poster agent failed', error);
      result.success = false;
      result.error = error.message;

      // Send error alert
      await this.email.sendErrorAlert('poster', error, { post: result.post });
    }

    return result;
  }

  /**
   * Create tweet content for a post
   * @param {Object} post - Scheduled post object
   * @param {string} [forceTone] - Force a specific tone
   * @returns {Promise<Object>}
   */
  async createTweetContent(post, forceTone = null) {
    const article = post.article;

    // Get article summary for context
    let articleContext;
    try {
      articleContext = await this.perplexity.getArticleSummary(article.url);
    } catch (error) {
      logger.warn('Could not get article summary, using headline', { error: error.message });
      articleContext = {
        mainClaim: article.headline,
        businessImplications: article.summary || article.whyItMatters || ''
      };
    }

    // Select tone
    const tone = forceTone || this.selectTone(post.postNumber);

    // Get trending hashtags
    const hashtags = await this.getHashtags(post.categoryId);

    // Generate tweet text
    let tweetText;
    if (post.includeQuote) {
      tweetText = this.createQuoteTweet(article, articleContext, post, hashtags);
    } else {
      tweetText = this.createStandardTweet(article, articleContext, tone, hashtags);
    }

    // Validate length
    const length = calculateTweetLength(tweetText);
    if (length > MAX_TWEET_LENGTH) {
      tweetText = this.shortenTweet(tweetText, hashtags);
    }

    return {
      text: tweetText,
      hashtags,
      tone
    };
  }

  /**
   * Create a standard tweet (no MAB quote)
   * @param {Object} article
   * @param {Object} context
   * @param {string} tone
   * @param {string[]} hashtags
   * @returns {string}
   */
  createStandardTweet(article, context, tone, hashtags) {
    const hookTemplates = {
      insight: [
        `${context.mainClaim || article.headline}`,
        `What this really means: ${context.businessImplications || article.summary}`,
        `The story behind the headline: ${context.mainClaim || article.headline}`
      ],
      question: [
        `Is this the future of AI? ${context.mainClaim || article.headline}`,
        `What does this mean for your business? ${context.mainClaim || article.headline}`,
        `Are you paying attention to this? ${context.mainClaim || article.headline}`
      ],
      contrarian: [
        `Hot take: ${context.businessImplications || article.summary}`,
        `Everyone's missing the point here. ${context.mainClaim || article.headline}`,
        `The real story isn't what you think. ${context.mainClaim || article.headline}`
      ],
      observation: [
        `Interesting development: ${context.mainClaim || article.headline}`,
        `Worth watching: ${context.mainClaim || article.headline}`,
        `This caught my attention: ${context.mainClaim || article.headline}`
      ],
      witty: [
        `If you're not uncomfortable with this, you're not paying attention.`,
        `Everyone's talking about the speed. I'm more interested in the direction.`,
        `The AI space moves fast. This is why.`
      ]
    };

    // Select a hook based on tone
    const hooks = hookTemplates[tone] || hookTemplates.insight;
    const hook = hooks[Math.floor(Math.random() * hooks.length)];

    // Truncate hook if needed
    const maxHookLength = 200;
    const truncatedHook = truncateText(hook, maxHookLength);

    // Build tweet
    const hashtagsStr = hashtags.slice(0, 3).join(' ');
    const tweet = `${truncatedHook}\n\n${article.url}\n\n${hashtagsStr}`;

    return tweet;
  }

  /**
   * Create a tweet with MAB quote integration
   * @param {Object} article
   * @param {Object} context
   * @param {Object} post
   * @param {string[]} hashtags
   * @returns {string}
   */
  createQuoteTweet(article, context, post, hashtags) {
    const quote = post.mabQuote || getQuoteForDay();
    const transition = getRandomTransition(quote);

    // Build the tweet with quote integration
    // Format: [Context] + [Transition] + [Quote snippet] + [Link] + [Hashtags]

    // Shorten the quote if needed
    const quoteSnippet = this.extractQuoteSnippet(quote.text);

    // Create context from article
    const contextSnippet = truncateText(
      context.mainClaim || article.headline,
      80
    );

    // Add #AIStrategy for quote posts
    const quoteHashtags = [...hashtags.slice(0, 2), '#AIStrategy'];

    const tweet = `${contextSnippet}\n\n${transition} "${quoteSnippet}"\n\n${article.url}\n\n${quoteHashtags.join(' ')}`;

    return tweet;
  }

  /**
   * Extract a shorter snippet from a MAB quote
   * @param {string} quoteText
   * @returns {string}
   */
  extractQuoteSnippet(quoteText) {
    // Try to find a natural break point
    const sentences = quoteText.split(/\.\s+/);

    if (sentences.length > 1 && sentences[0].length <= 80) {
      return sentences[0] + '.';
    }

    // Otherwise truncate
    return truncateText(quoteText, 80);
  }

  /**
   * Shorten a tweet to fit within limits
   * @param {string} tweet
   * @param {string[]} hashtags
   * @returns {string}
   */
  shortenTweet(tweet, hashtags) {
    let shortened = tweet;
    const currentLength = calculateTweetLength(shortened);

    if (currentLength <= MAX_TWEET_LENGTH) return shortened;

    // Step 1: Reduce hashtags
    const hashtagsStr = hashtags.slice(0, 2).join(' ');
    shortened = tweet.replace(/#\w+\s*/g, '').trim() + '\n\n' + hashtagsStr;

    if (calculateTweetLength(shortened) <= MAX_TWEET_LENGTH) return shortened;

    // Step 2: Truncate the main content
    const lines = shortened.split('\n\n');
    if (lines.length > 0) {
      const excess = calculateTweetLength(shortened) - MAX_TWEET_LENGTH;
      lines[0] = truncateText(lines[0], lines[0].length - excess - 10);
      shortened = lines.join('\n\n');
    }

    return shortened;
  }

  /**
   * Select tone based on post number (for variety)
   * @param {number} postNumber
   * @returns {string}
   */
  selectTone(postNumber) {
    const tones = ['insight', 'question', 'contrarian', 'observation', 'witty'];
    return tones[(postNumber - 1) % tones.length];
  }

  /**
   * Get hashtags for a category
   * @param {string} categoryId
   * @returns {Promise<string[]>}
   */
  async getHashtags(categoryId) {
    // Try to get trending hashtags
    try {
      const trending = await this.twitter.getTrendingTopics();

      // Filter for AI-related trending topics
      const aiTrending = trending.filter(tag =>
        /ai|artificial|intelligence|tech|robot|automation|machine|learning/i.test(tag)
      );

      if (aiTrending.length >= 2) {
        return aiTrending.slice(0, 3).map(t => t.startsWith('#') ? t : `#${t}`);
      }
    } catch (error) {
      logger.debug('Could not fetch trending hashtags', { error: error.message });
    }

    // Fall back to default hashtags
    return DEFAULT_HASHTAGS[categoryId] || DEFAULT_HASHTAGS['ai-providers'];
  }

  /**
   * Log posted tweet to Google Sheets
   * @param {Object} post
   * @param {Object} tweetResult
   * @param {Object} content
   */
  async logPostedTweet(post, tweetResult, content) {
    await this.sheets.logPostedTweet({
      postedAt: new Date().toISOString(),
      tweetId: tweetResult.id,
      text: content.text,
      articleUrl: post.article.url,
      category: post.categoryId,
      postNumber: post.postNumber,
      includeQuote: post.includeQuote,
      hashtags: content.hashtags
    });
  }

  /**
   * Retry failed post
   * @param {string} postId
   * @returns {Promise<Object>}
   */
  async retryPost(postId) {
    const post = this.scheduler.queue.get(postId);

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    if (post.status !== 'failed') {
      return { success: false, error: `Post status is ${post.status}, not failed` };
    }

    // Reset status and retry
    post.status = 'ready';
    this.scheduler.queue.set(postId, post);

    return this.run();
  }

  /**
   * Load schedule from sheets (for recovery)
   * @returns {Promise<void>}
   */
  async loadScheduleFromSheets() {
    // This would load the posting queue from Google Sheets
    // Useful for recovery after a restart
    logger.info('Loading schedule from Google Sheets');

    // Implementation would read from Posting_Queue sheet
    // and rebuild the scheduler state
  }

  /**
   * Import schedule from filter agent
   * @param {Object[]} schedule
   */
  importSchedule(schedule) {
    this.scheduler.importSchedule(schedule);
  }
}

/**
 * Create and run the poster agent
 * @param {Object} env - Cloudflare Workers env object
 * @param {number} [utcHour] - Current UTC hour
 * @returns {Promise<Object>}
 */
export async function run(env, utcHour) {
  const config = getConfig(env);
  const agent = new PosterAgent(config);
  return agent.run(utcHour);
}

/**
 * Create a poster agent instance
 * @param {Object} config
 * @returns {PosterAgent}
 */
export function createPosterAgent(config) {
  return new PosterAgent(config);
}

export default PosterAgent;
