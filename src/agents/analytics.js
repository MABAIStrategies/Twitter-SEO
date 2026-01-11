/**
 * MAB AI Strategies Twitter SEO Agent
 * Phase 4: Analytics Agent
 *
 * Collects and tracks tweet performance metrics.
 * Runs at scheduled intervals after posting.
 */

import { createLogger } from '../utils/logger.js';
import { createTwitterService } from '../services/twitter.js';
import { createSheetsService, SHEET_NAMES } from '../services/sheets.js';
import { createEmailService } from '../services/email.js';
import { getConfig, isDryRun, getAIProvider } from '../utils/config.js';
import { formatDate, getTodayString, hoursBetween } from '../utils/date-utils.js';

const logger = createLogger('info').child('analytics');

/**
 * Collection schedule (hours after posting)
 */
const COLLECTION_SCHEDULE = {
  initial: 0.083, // 5 minutes
  day1: 24,
  day3: 72,
  day10: 240
};

/**
 * Analytics Agent class
 */
export class AnalyticsAgent {
  /**
   * @param {Object} config - Full configuration object
   */
  constructor(config) {
    this.config = config;
    this.twitter = createTwitterService(config);
    this.sheets = createSheetsService(config);
    this.email = createEmailService(config);
    this.dryRun = isDryRun(config);
    this.aiProvider = getAIProvider(config);
  }

  /**
   * Collect metrics for recent tweets
   * @param {string} [collectionType='initial'] - Type of collection
   * @returns {Promise<Object>}
   */
  async collectMetrics(collectionType = 'initial') {
    logger.info(`Starting metrics collection: ${collectionType}`);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      collectionType,
      tweetsProcessed: 0,
      errors: []
    };

    try {
      // Get tweets that need metrics collection
      const tweetsToProcess = await this.getTweetsForCollection(collectionType);

      logger.info(`Found ${tweetsToProcess.length} tweets to process`);

      if (tweetsToProcess.length === 0) {
        return result;
      }

      // Collect metrics in batches (Twitter API allows up to 100)
      const batchSize = 100;
      for (let i = 0; i < tweetsToProcess.length; i += batchSize) {
        const batch = tweetsToProcess.slice(i, i + batchSize);
        const tweetIds = batch.map(t => t.tweetId);

        try {
          const metrics = await this.twitter.getBatchMetrics(tweetIds);

          for (const tweet of batch) {
            const tweetMetrics = metrics[tweet.tweetId];
            if (tweetMetrics) {
              await this.saveMetrics(tweet, tweetMetrics, collectionType);
              result.tweetsProcessed++;
            }
          }
        } catch (batchError) {
          logger.warn(`Batch metrics collection failed`, { error: batchError.message });
          result.errors.push({ batch: i, error: batchError.message });
        }
      }

      logger.info(`Collected metrics for ${result.tweetsProcessed} tweets`);

    } catch (error) {
      logger.error('Metrics collection failed', error);
      result.success = false;
      result.errors.push({ phase: 'collection', error: error.message });
    }

    return result;
  }

  /**
   * Get tweets that need metrics collection
   * @param {string} collectionType
   * @returns {Promise<Object[]>}
   */
  async getTweetsForCollection(collectionType) {
    const hoursThreshold = COLLECTION_SCHEDULE[collectionType];
    const now = new Date();

    // Read posted tweets from sheets
    const postedTweets = await this.sheets.readSheet(SHEET_NAMES.POSTED_TWEETS);

    if (postedTweets.length <= 1) return []; // Only header or empty

    // Filter tweets based on collection type timing
    return postedTweets
      .slice(1) // Skip header
      .map(row => ({
        postedAt: row[0],
        tweetId: row[1],
        text: row[2],
        articleUrl: row[3],
        category: row[4],
        postNumber: parseInt(row[5], 10)
      }))
      .filter(tweet => {
        if (!tweet.tweetId || !tweet.postedAt) return false;

        const postedDate = new Date(tweet.postedAt);
        const hoursAgo = hoursBetween(postedDate, now);

        // For each collection type, check if it's time
        switch (collectionType) {
          case 'initial':
            return hoursAgo >= 0.083 && hoursAgo < 1; // 5 min to 1 hour
          case 'day1':
            return hoursAgo >= 24 && hoursAgo < 48;
          case 'day3':
            return hoursAgo >= 72 && hoursAgo < 96;
          case 'day10':
            return hoursAgo >= 240 && hoursAgo < 264;
          default:
            return false;
        }
      });
  }

  /**
   * Save metrics to Google Sheets
   * @param {Object} tweet
   * @param {Object} metrics
   * @param {string} collectionType
   */
  async saveMetrics(tweet, metrics, collectionType) {
    const engagementRate = this.calculateEngagementRate(metrics);
    const viralityScore = this.calculateViralityScore(metrics);

    const performance = {
      postDate: tweet.postedAt?.split('T')[0],
      postTime: tweet.postedAt?.split('T')[1]?.substring(0, 5),
      category: tweet.category,
      rank: tweet.postNumber,
      articleUrl: tweet.articleUrl,
      postText: tweet.text?.substring(0, 200),
      tweetId: tweet.tweetId,
      tweetUrl: this.twitter.getTweetUrl(tweet.tweetId),
      likes: metrics.like_count || 0,
      retweets: metrics.retweet_count || 0,
      replies: metrics.reply_count || 0,
      quotes: metrics.quote_count || 0,
      engagementRate: engagementRate.toFixed(4),
      viralityScore: viralityScore.toFixed(4),
      collectionType
    };

    await this.sheets.logPerformance(performance);
  }

  /**
   * Calculate engagement rate
   * @param {Object} metrics
   * @returns {number}
   */
  calculateEngagementRate(metrics) {
    const totalEngagement =
      (metrics.like_count || 0) +
      (metrics.retweet_count || 0) +
      (metrics.reply_count || 0) +
      (metrics.quote_count || 0);

    // Without impressions, we return raw engagement
    // When CSV is imported, we can calculate true rate
    return totalEngagement;
  }

  /**
   * Calculate virality score
   * @param {Object} metrics
   * @returns {number}
   */
  calculateViralityScore(metrics) {
    const shares = (metrics.retweet_count || 0) + (metrics.quote_count || 0);
    const likes = (metrics.like_count || 0) + 1; // +1 to avoid division by zero
    return shares / likes;
  }

  /**
   * Process uploaded analytics CSV
   * @param {string} csvContent - CSV file content
   * @returns {Promise<Object>}
   */
  async processAnalyticsCsv(csvContent) {
    logger.info('Processing analytics CSV');

    const result = {
      success: true,
      rowsProcessed: 0,
      tweetsUpdated: 0,
      errors: []
    };

    try {
      // Parse CSV (simple parsing, assumes standard Twitter analytics format)
      const lines = csvContent.split('\n');
      const headers = this.parseCsvLine(lines[0]);

      // Find column indices
      const tweetIdCol = headers.findIndex(h =>
        h.toLowerCase().includes('tweet id') || h.toLowerCase() === 'id'
      );
      const impressionsCol = headers.findIndex(h =>
        h.toLowerCase().includes('impressions')
      );
      const engagementsCol = headers.findIndex(h =>
        h.toLowerCase().includes('engagements')
      );
      const linkClicksCol = headers.findIndex(h =>
        h.toLowerCase().includes('link clicks') || h.toLowerCase().includes('url clicks')
      );
      const profileVisitsCol = headers.findIndex(h =>
        h.toLowerCase().includes('profile')
      );

      if (tweetIdCol === -1) {
        throw new Error('Could not find Tweet ID column in CSV');
      }

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = this.parseCsvLine(line);
        result.rowsProcessed++;

        const tweetId = values[tweetIdCol];
        if (!tweetId) continue;

        try {
          await this.updateTweetWithCsvData(tweetId, {
            impressions: impressionsCol !== -1 ? parseInt(values[impressionsCol], 10) : null,
            engagements: engagementsCol !== -1 ? parseInt(values[engagementsCol], 10) : null,
            linkClicks: linkClicksCol !== -1 ? parseInt(values[linkClicksCol], 10) : null,
            profileVisits: profileVisitsCol !== -1 ? parseInt(values[profileVisitsCol], 10) : null
          });
          result.tweetsUpdated++;
        } catch (updateError) {
          result.errors.push({ tweetId, error: updateError.message });
        }
      }

      // Log import
      await this.logCsvImport(result);

      logger.info(`CSV processed: ${result.tweetsUpdated}/${result.rowsProcessed} tweets updated`);

    } catch (error) {
      logger.error('CSV processing failed', error);
      result.success = false;
      result.errors.push({ phase: 'csv-processing', error: error.message });
    }

    return result;
  }

  /**
   * Parse a CSV line
   * @param {string} line
   * @returns {string[]}
   */
  parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Update tweet performance with CSV data
   * @param {string} tweetId
   * @param {Object} csvData
   */
  async updateTweetWithCsvData(tweetId, csvData) {
    // Find the tweet in Post_Performance sheet
    const found = await this.sheets.findRow(SHEET_NAMES.POST_PERFORMANCE, 6, tweetId);

    if (!found) {
      logger.debug(`Tweet ${tweetId} not found in performance sheet`);
      return;
    }

    // Calculate derived metrics
    let ctr = null;
    if (csvData.impressions && csvData.linkClicks) {
      ctr = (csvData.linkClicks / csvData.impressions * 100).toFixed(2) + '%';
    }

    let engagementRate = null;
    if (csvData.impressions && csvData.engagements) {
      engagementRate = (csvData.engagements / csvData.impressions * 100).toFixed(2) + '%';
    }

    // Update the row (columns M onwards for impressions, etc.)
    const updates = [
      [
        csvData.impressions || '',
        csvData.linkClicks || '',
        csvData.profileVisits || '',
        ctr || '',
        engagementRate || ''
      ]
    ];

    await this.sheets.updateRange(
      SHEET_NAMES.POST_PERFORMANCE,
      `M${found.rowIndex}:Q${found.rowIndex}`,
      updates
    );
  }

  /**
   * Log CSV import to sheet
   * @param {Object} result
   */
  async logCsvImport(result) {
    await this.sheets.getOrCreateSheet(SHEET_NAMES.ANALYTICS_IMPORT);

    await this.sheets.appendRows(SHEET_NAMES.ANALYTICS_IMPORT, [[
      new Date().toISOString(),
      result.rowsProcessed,
      result.tweetsUpdated,
      result.errors.length,
      JSON.stringify(result.errors.slice(0, 5)) // First 5 errors only
    ]]);
  }

  /**
   * Generate weekly AI insights
   * @returns {Promise<Object>}
   */
  async generateWeeklyInsights() {
    logger.info('Generating weekly AI insights');

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      insights: null
    };

    try {
      // Get last 30 days of performance data
      const performanceData = await this.sheets.readSheet(SHEET_NAMES.POST_PERFORMANCE);

      if (performanceData.length <= 1) {
        result.insights = { message: 'Not enough data for insights' };
        return result;
      }

      // Calculate summary statistics
      const stats = this.calculateStats(performanceData.slice(1));

      // Generate insights using AI or heuristics
      let insights;
      if (this.aiProvider !== 'heuristic') {
        insights = await this.generateAIInsights(stats);
      } else {
        insights = this.generateHeuristicInsights(stats);
      }

      result.insights = insights;

      // Save insights to sheet
      await this.saveInsights(insights);

      // Send weekly email
      await this.email.sendWeeklyInsights(insights);

      logger.info('Weekly insights generated');

    } catch (error) {
      logger.error('Insights generation failed', error);
      result.success = false;
      result.error = error.message;
    }

    return result;
  }

  /**
   * Calculate summary statistics
   * @param {Array[]} rows
   * @returns {Object}
   */
  calculateStats(rows) {
    const stats = {
      totalPosts: rows.length,
      byCategory: {},
      byTime: {},
      avgLikes: 0,
      avgRetweets: 0,
      avgEngagement: 0,
      topPosts: [],
      worstPosts: []
    };

    let totalLikes = 0;
    let totalRetweets = 0;
    let totalEngagement = 0;

    for (const row of rows) {
      const category = row[2];
      const time = row[1]?.split(':')[0]; // Hour
      const likes = parseInt(row[8], 10) || 0;
      const retweets = parseInt(row[9], 10) || 0;
      const engagement = likes + retweets + (parseInt(row[10], 10) || 0);

      // By category
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { count: 0, totalEngagement: 0 };
      }
      stats.byCategory[category].count++;
      stats.byCategory[category].totalEngagement += engagement;

      // By time
      if (time && !stats.byTime[time]) {
        stats.byTime[time] = { count: 0, totalEngagement: 0 };
      }
      if (time) {
        stats.byTime[time].count++;
        stats.byTime[time].totalEngagement += engagement;
      }

      totalLikes += likes;
      totalRetweets += retweets;
      totalEngagement += engagement;

      // Track for top/worst
      stats.topPosts.push({
        text: row[5]?.substring(0, 100),
        engagement,
        category
      });
    }

    // Averages
    stats.avgLikes = (totalLikes / rows.length).toFixed(1);
    stats.avgRetweets = (totalRetweets / rows.length).toFixed(1);
    stats.avgEngagement = (totalEngagement / rows.length).toFixed(1);

    // Sort and slice top/worst
    stats.topPosts.sort((a, b) => b.engagement - a.engagement);
    stats.worstPosts = [...stats.topPosts].reverse().slice(0, 5);
    stats.topPosts = stats.topPosts.slice(0, 5);

    // Calculate averages for categories and times
    for (const cat of Object.values(stats.byCategory)) {
      cat.avgEngagement = (cat.totalEngagement / cat.count).toFixed(1);
    }
    for (const time of Object.values(stats.byTime)) {
      time.avgEngagement = (time.totalEngagement / time.count).toFixed(1);
    }

    return stats;
  }

  /**
   * Generate insights using AI
   * @param {Object} stats
   * @returns {Promise<Object>}
   */
  async generateAIInsights(stats) {
    const prompt = `Analyze this Twitter performance data and provide actionable recommendations:

Stats:
- Total Posts: ${stats.totalPosts}
- Average Engagement: ${stats.avgEngagement}
- By Category: ${JSON.stringify(stats.byCategory)}
- By Time: ${JSON.stringify(stats.byTime)}
- Top Posts: ${JSON.stringify(stats.topPosts)}

Provide insights in this JSON format:
{
  "summary": "2-3 sentence summary",
  "doubleDown": ["3 things working well"],
  "pivot": ["3 things to change"],
  "focus": ["3 focus areas for next week"]
}`;

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
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error('OpenAI API error');

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      try {
        return JSON.parse(content);
      } catch {
        return { summary: content, metrics: stats };
      }
    }

    return this.generateHeuristicInsights(stats);
  }

  /**
   * Generate insights using heuristics
   * @param {Object} stats
   * @returns {Object}
   */
  generateHeuristicInsights(stats) {
    const insights = {
      summary: `Analyzed ${stats.totalPosts} posts with ${stats.avgEngagement} average engagement.`,
      doubleDown: [],
      pivot: [],
      focus: [],
      metrics: {
        totalPosts: stats.totalPosts,
        avgEngagement: stats.avgEngagement,
        bestTime: null,
        topCategory: null
      }
    };

    // Find best time
    let bestTime = null;
    let bestTimeEngagement = 0;
    for (const [time, data] of Object.entries(stats.byTime)) {
      if (parseFloat(data.avgEngagement) > bestTimeEngagement) {
        bestTimeEngagement = parseFloat(data.avgEngagement);
        bestTime = time;
      }
    }
    insights.metrics.bestTime = bestTime ? `${bestTime}:00` : 'N/A';

    // Find best category
    let topCategory = null;
    let topCategoryEngagement = 0;
    for (const [cat, data] of Object.entries(stats.byCategory)) {
      if (parseFloat(data.avgEngagement) > topCategoryEngagement) {
        topCategoryEngagement = parseFloat(data.avgEngagement);
        topCategory = cat;
      }
    }
    insights.metrics.topCategory = topCategory || 'N/A';

    // Generate recommendations
    if (bestTime) {
      insights.doubleDown.push(`Posts at ${bestTime}:00 performing well - consider expanding this window`);
    }
    if (topCategory) {
      insights.doubleDown.push(`${topCategory} category showing strong engagement`);
    }
    if (stats.topPosts.length > 0) {
      insights.doubleDown.push(`Posts with statistics/numbers showing higher engagement`);
    }

    insights.pivot.push('Consider testing new posting times');
    insights.focus.push('Monitor engagement trends over the next week');

    return insights;
  }

  /**
   * Save insights to sheet
   * @param {Object} insights
   */
  async saveInsights(insights) {
    await this.sheets.getOrCreateSheet(SHEET_NAMES.AI_INSIGHTS);

    await this.sheets.appendRows(SHEET_NAMES.AI_INSIGHTS, [[
      new Date().toISOString(),
      insights.summary || '',
      JSON.stringify(insights.doubleDown || []),
      JSON.stringify(insights.pivot || []),
      JSON.stringify(insights.focus || []),
      JSON.stringify(insights.metrics || {})
    ]]);
  }

  /**
   * Send weekly analytics reminder email
   */
  async sendWeeklyReminder() {
    return this.email.sendAnalyticsReminder();
  }
}

/**
 * Create and run metrics collection
 * @param {Object} env - Cloudflare Workers env object
 * @param {string} collectionType - Type of collection
 * @returns {Promise<Object>}
 */
export async function collectMetrics(env, collectionType = 'initial') {
  const config = getConfig(env);
  const agent = new AnalyticsAgent(config);
  return agent.collectMetrics(collectionType);
}

/**
 * Process analytics CSV
 * @param {Object} env
 * @param {string} csvContent
 * @returns {Promise<Object>}
 */
export async function processCsv(env, csvContent) {
  const config = getConfig(env);
  const agent = new AnalyticsAgent(config);
  return agent.processAnalyticsCsv(csvContent);
}

/**
 * Generate weekly insights
 * @param {Object} env
 * @returns {Promise<Object>}
 */
export async function generateInsights(env) {
  const config = getConfig(env);
  const agent = new AnalyticsAgent(config);
  return agent.generateWeeklyInsights();
}

/**
 * Send weekly reminder
 * @param {Object} env
 * @returns {Promise<Object>}
 */
export async function sendReminder(env) {
  const config = getConfig(env);
  const agent = new AnalyticsAgent(config);
  return agent.sendWeeklyReminder();
}

/**
 * Create an analytics agent instance
 * @param {Object} config
 * @returns {AnalyticsAgent}
 */
export function createAnalyticsAgent(config) {
  return new AnalyticsAgent(config);
}

export default AnalyticsAgent;
