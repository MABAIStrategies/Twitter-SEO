/**
 * MAB AI Strategies Twitter SEO Agent
 * Phase 2: Filter & Ranking Agent
 *
 * Scores and ranks articles based on recency, source authority,
 * engagement potential, virality indicators, and SEO value.
 */

import { createLogger } from '../utils/logger.js';
import { createSheetsService } from '../services/sheets.js';
import { createSchedulerService } from '../services/scheduler.js';
import { CATEGORIES } from '../constants/categories.js';
import { getQuoteForDay } from '../constants/mab-quotes.js';
import { POSTING_SCHEDULE } from '../constants/posting-schedule.js';
import { calculateRecencyScore } from '../utils/date-utils.js';
import { containsStatistics, containsQuestion, isProvocative, containsKeywords } from '../utils/text-utils.js';
import { getConfig, isDryRun, getAIProvider } from '../utils/config.js';

const logger = createLogger('info').child('filter');

/**
 * Source authority tiers
 */
const SOURCE_TIERS = {
  tier1: {
    score: 25,
    sources: [
      'techcrunch', 'the verge', 'bloomberg', 'reuters', 'wsj',
      'wall street journal', 'nyt', 'new york times', 'wired'
    ]
  },
  tier2: {
    score: 20,
    sources: [
      'venturebeat', 'ars technica', 'mit technology review',
      'the information', 'protocol', 'axios'
    ]
  },
  tier3: {
    score: 15,
    sources: [
      'forbes', 'business insider', 'zdnet', 'cnet', 'engadget'
    ]
  },
  tier4: {
    score: 10,
    sources: [
      'openai', 'google', 'anthropic', 'microsoft', 'meta',
      'deepmind', 'blog.google', 'openai.com'
    ]
  },
  tier5: {
    score: 5,
    sources: [] // Default for all other sources
  }
};

/**
 * Minimum score threshold for quality gate
 */
const MIN_SCORE_THRESHOLD = 60;

/**
 * Articles to select per category
 */
const ARTICLES_PER_CATEGORY = 3;

/**
 * Filter Agent class
 */
export class FilterAgent {
  /**
   * @param {Object} config - Full configuration object
   */
  constructor(config) {
    this.config = config;
    this.sheets = createSheetsService(config);
    this.scheduler = createSchedulerService();
    this.aiProvider = getAIProvider(config);
    this.dryRun = isDryRun(config);
  }

  /**
   * Run the filter agent
   * @param {Object[]} articles - Articles from scraper agent
   * @returns {Promise<Object>}
   */
  async run(articles) {
    logger.info(`Starting filter agent with ${articles.length} articles`);

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      inputArticles: articles.length,
      scoredArticles: [],
      selectedArticles: [],
      schedule: null,
      errors: []
    };

    try {
      // Score all articles
      const scoredArticles = await this.scoreArticles(articles);
      results.scoredArticles = scoredArticles;

      logger.info(`Scored ${scoredArticles.length} articles`);

      // Select top articles per category
      const selectedArticles = this.selectTopArticles(scoredArticles);
      results.selectedArticles = selectedArticles;

      logger.info(`Selected ${selectedArticles.length} articles for posting`);

      // Create posting schedule
      this.scheduler.initializeDailySchedule();
      this.scheduler.assignArticlesToSchedule(selectedArticles);
      results.schedule = this.scheduler.exportSchedule();

      // Save to Google Sheets
      if (!this.dryRun) {
        await this.saveResults(results);
      }

      logger.info('Filter agent completed successfully');

    } catch (error) {
      logger.error('Filter agent failed', error);
      results.success = false;
      results.errors.push({ phase: 'filter', error: error.message });
    }

    return results;
  }

  /**
   * Score all articles
   * @param {Object[]} articles
   * @returns {Promise<Object[]>}
   */
  async scoreArticles(articles) {
    const scoredArticles = [];

    for (const article of articles) {
      try {
        const scored = await this.scoreArticle(article);
        if (scored) {
          scoredArticles.push(scored);
        }
      } catch (error) {
        logger.warn(`Failed to score article: ${article.headline?.substring(0, 50)}`, {
          error: error.message
        });
      }
    }

    // Sort by score descending
    return scoredArticles.sort((a, b) => b.score - a.score);
  }

  /**
   * Score a single article
   * @param {Object} article
   * @returns {Promise<Object>}
   */
  async scoreArticle(article) {
    // 1. Recency Score (20 points)
    const recencyScore = calculateRecencyScore(article.publishDate);

    // 2. Source Authority Score (25 points)
    const authorityScore = this.calculateAuthorityScore(article.source);

    // 3. Engagement Potential Score (25 points)
    const engagementScore = await this.calculateEngagementScore(article);

    // 4. Virality Indicators Score (20 points)
    const viralityScore = this.calculateViralityScore(article);

    // 5. SEO Value Score (10 points)
    const seoScore = this.calculateSeoScore(article);

    // Total score
    const score = recencyScore + authorityScore + engagementScore + viralityScore + seoScore;

    return {
      ...article,
      score,
      recencyScore,
      authorityScore,
      engagementScore,
      viralityScore,
      seoScore
    };
  }

  /**
   * Calculate source authority score
   * @param {string} source
   * @returns {number}
   */
  calculateAuthorityScore(source) {
    const sourceLower = source.toLowerCase();

    for (const [tier, data] of Object.entries(SOURCE_TIERS)) {
      if (data.sources.some(s => sourceLower.includes(s))) {
        return data.score;
      }
    }

    return SOURCE_TIERS.tier5.score;
  }

  /**
   * Calculate engagement potential score
   * Uses AI if available, otherwise uses heuristics
   * @param {Object} article
   * @returns {Promise<number>}
   */
  async calculateEngagementScore(article) {
    if (this.aiProvider === 'heuristic') {
      return this.calculateEngagementScoreHeuristic(article);
    }

    try {
      return await this.calculateEngagementScoreAI(article);
    } catch (error) {
      logger.warn('AI scoring failed, falling back to heuristics', { error: error.message });
      return this.calculateEngagementScoreHeuristic(article);
    }
  }

  /**
   * Calculate engagement score using heuristics
   * @param {Object} article
   * @returns {number}
   */
  calculateEngagementScoreHeuristic(article) {
    let score = 0;
    const text = `${article.headline} ${article.summary}`;

    // Controversy/debate angle (10 pts)
    if (isProvocative(text)) {
      score += 5;
    }
    if (containsQuestion(text)) {
      score += 3;
    }
    // Check for opinion-indicating words
    if (/\b(should|must|need|wrong|right|better|worse|best|worst)\b/i.test(text)) {
      score += 2;
    }

    // Practical business application (10 pts)
    const businessKeywords = ['ROI', 'revenue', 'growth', 'efficiency', 'productivity',
      'cost', 'profit', 'implementation', 'adoption', 'strategy'];
    const businessMatches = businessKeywords.filter(k => text.toLowerCase().includes(k.toLowerCase()));
    score += Math.min(businessMatches.length * 2, 10);

    // Novel data/research/announcement (5 pts)
    if (/\b(study|research|report|survey|data|announce|launch|release|unveil)\b/i.test(text)) {
      score += 5;
    }

    return Math.min(score, 25);
  }

  /**
   * Calculate engagement score using AI
   * @param {Object} article
   * @returns {Promise<number>}
   */
  async calculateEngagementScoreAI(article) {
    const prompt = `Rate this headline's engagement potential for a Twitter business audience on a scale of 0-25:

Headline: ${article.headline}
Summary: ${article.summary}

Consider:
- Controversy/debate potential (0-10 points)
- Practical business application (0-10 points)
- Novel data/research/announcement (0-5 points)

Return ONLY a single number between 0 and 25, nothing else.`;

    if (this.aiProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openai.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 10,
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error('OpenAI API error');

      const data = await response.json();
      const scoreText = data.choices[0]?.message?.content?.trim();
      const score = parseInt(scoreText, 10);

      return isNaN(score) ? 12 : Math.min(Math.max(score, 0), 25);

    } else if (this.aiProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.config.anthropic.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 10,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error('Anthropic API error');

      const data = await response.json();
      const scoreText = data.content[0]?.text?.trim();
      const score = parseInt(scoreText, 10);

      return isNaN(score) ? 12 : Math.min(Math.max(score, 0), 25);
    }

    return this.calculateEngagementScoreHeuristic(article);
  }

  /**
   * Calculate virality indicators score
   * @param {Object} article
   * @returns {number}
   */
  calculateViralityScore(article) {
    let score = 0;
    const text = `${article.headline} ${article.summary}`;

    // Contains numbers/statistics (+5 pts)
    if (containsStatistics(text)) {
      score += 5;
    }

    // Provocative question or claim (+5 pts)
    if (containsQuestion(article.headline) || isProvocative(article.headline)) {
      score += 5;
    }

    // Involves major company/figure (+5 pts)
    const majorEntities = [
      'OpenAI', 'Google', 'Microsoft', 'Apple', 'Meta', 'Amazon', 'Anthropic',
      'Elon Musk', 'Sam Altman', 'Satya Nadella', 'Sundar Pichai', 'Mark Zuckerberg',
      'GPT', 'ChatGPT', 'Claude', 'Gemini', 'Copilot'
    ];
    if (containsKeywords(text, majorEntities)) {
      score += 5;
    }

    // Timing advantage - breaking news (+5 pts)
    // Check for recency and breaking news indicators
    if (/\b(just|breaking|now|today|announces?|launches?|reveals?)\b/i.test(text)) {
      score += 5;
    }

    return Math.min(score, 20);
  }

  /**
   * Calculate SEO value score
   * @param {Object} article
   * @returns {number}
   */
  calculateSeoScore(article) {
    let score = 0;
    const text = `${article.headline} ${article.summary}`;

    // SEO keywords (+5 pts)
    const seoKeywords = ['AI strategy', 'automation', 'mid-market', 'enterprise',
      'digital transformation', 'business intelligence', 'ROI'];
    if (containsKeywords(text, seoKeywords)) {
      score += 5;
    }

    // B2B audience appeal (+5 pts)
    const b2bKeywords = ['B2B', 'enterprise', 'business', 'corporate', 'company',
      'organization', 'industry', 'sector', 'market'];
    if (containsKeywords(text, b2bKeywords)) {
      score += 5;
    }

    return Math.min(score, 10);
  }

  /**
   * Select top articles per category
   * @param {Object[]} scoredArticles
   * @returns {Object[]}
   */
  selectTopArticles(scoredArticles) {
    const selectedArticles = [];
    const articlesByCategory = {};

    // Group by category
    for (const article of scoredArticles) {
      if (!articlesByCategory[article.category]) {
        articlesByCategory[article.category] = [];
      }
      articlesByCategory[article.category].push(article);
    }

    // Select top N from each category
    for (const category of CATEGORIES) {
      const categoryArticles = articlesByCategory[category.id] || [];

      // Filter by minimum score threshold
      const qualifiedArticles = categoryArticles.filter(a => a.score >= MIN_SCORE_THRESHOLD);

      // If not enough qualified articles, take all we have
      const articlesToSelect = qualifiedArticles.length >= ARTICLES_PER_CATEGORY
        ? qualifiedArticles.slice(0, ARTICLES_PER_CATEGORY)
        : categoryArticles.slice(0, ARTICLES_PER_CATEGORY);

      // Assign rank
      articlesToSelect.forEach((article, index) => {
        article.categoryRank = index + 1;
      });

      selectedArticles.push(...articlesToSelect);
    }

    // Assign posting slots and MAB quotes
    this.assignPostingSlots(selectedArticles);

    return selectedArticles;
  }

  /**
   * Assign posting time slots and MAB quotes to articles
   * @param {Object[]} articles
   */
  assignPostingSlots(articles) {
    const quoteOfDay = getQuoteForDay();

    for (const slot of POSTING_SCHEDULE) {
      // Find matching article
      const article = articles.find(
        a => a.category === slot.categoryId && a.categoryRank === slot.categoryRank
      );

      if (article) {
        article.postingSlot = `${slot.hour}:00`;
        article.postNumber = slot.postNumber;

        if (slot.includeQuote) {
          article.mabQuoteNumber = quoteOfDay.id;
          article.mabQuote = quoteOfDay;
        }
      }
    }
  }

  /**
   * Save results to Google Sheets
   * @param {Object} results
   */
  async saveResults(results) {
    // Save scored headlines
    await this.sheets.saveHeadlines(results.selectedArticles);

    // Add to posting queue
    for (const post of results.schedule) {
      if (post.article) {
        await this.sheets.addToPostingQueue({
          scheduledTime: `${post.hour}:00 EST`,
          postNumber: post.postNumber,
          category: post.categoryId,
          headline: post.article.headline,
          url: post.article.url,
          tweetText: '', // Will be filled by poster agent
          includeQuote: post.includeQuote,
          mabQuoteId: post.quoteId
        });
      }
    }

    logger.info('Results saved to Google Sheets');
  }

  /**
   * Get the scheduler for use by poster agent
   * @returns {SchedulerService}
   */
  getScheduler() {
    return this.scheduler;
  }
}

/**
 * Create and run the filter agent
 * @param {Object} env - Cloudflare Workers env object
 * @param {Object[]} articles - Articles from scraper
 * @returns {Promise<Object>}
 */
export async function run(env, articles) {
  const config = getConfig(env);
  const agent = new FilterAgent(config);
  return agent.run(articles);
}

/**
 * Create a filter agent instance
 * @param {Object} config
 * @returns {FilterAgent}
 */
export function createFilterAgent(config) {
  return new FilterAgent(config);
}

export default FilterAgent;
