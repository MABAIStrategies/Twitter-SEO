/**
 * MAB AI Strategies Twitter SEO Agent
 * Main Entry Point for Cloudflare Workers
 *
 * Handles cron triggers and HTTP requests for the Twitter automation system.
 */

import { createScraperAgent } from './agents/scraper.js';
import { createFilterAgent } from './agents/filter.js';
import { createPosterAgent } from './agents/poster.js';
import { createAnalyticsAgent, sendReminder, generateInsights, processCsv } from './agents/analytics.js';
import { createSchedulerService } from './services/scheduler.js';
import { createEmailService } from './services/email.js';
import { createSheetsService } from './services/sheets.js';
import { getConfig, validateConfig, isDryRun } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { isWeekday, getEasternHour, isEasternDST, getTodayString } from './utils/date-utils.js';
import { getTimeSlotForUTCHour, SCRAPING_SCHEDULE, ANALYTICS_REMINDER, INSIGHTS_GENERATION } from './constants/posting-schedule.js';

const logger = createLogger('info').child('main');

/**
 * Main worker export
 */
export default {
  /**
   * Handle scheduled cron triggers
   * @param {ScheduledEvent} event
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(event, env, ctx) {
    const config = getConfig(env);
    const now = new Date(event.scheduledTime);
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay();
    const isDST = isEasternDST(now);

    logger.info(`Scheduled event triggered`, {
      utcHour,
      utcMinute,
      dayOfWeek,
      isDST,
      cron: event.cron
    });

    try {
      // Check for Sunday analytics reminder (UTC 14:00 = 9 AM EST)
      if (dayOfWeek === 0 && utcHour === (isDST ? 13 : 14) && utcMinute === 0) {
        logger.info('Running weekly analytics reminder');
        await sendReminder(env);
        return;
      }

      // Check for Monday insights generation (UTC 11:00 = 6 AM EST)
      if (dayOfWeek === 1 && utcHour === (isDST ? 10 : 11) && utcMinute === 0) {
        logger.info('Running weekly insights generation');
        await generateInsights(env);
        return;
      }

      // Skip non-weekdays for regular operations
      if (!isWeekday(now)) {
        logger.info('Skipping - not a weekday');
        return;
      }

      // Check for scraping time (7:30 AM EST)
      const scrapingHour = isDST ? SCRAPING_SCHEDULE.utcHourDST : SCRAPING_SCHEDULE.utcHour;
      if (utcHour === scrapingHour && utcMinute >= 30 && utcMinute < 35) {
        logger.info('Running Phase 1 & 2: Scraping and Filtering');
        await runScrapingAndFiltering(config);
        return;
      }

      // Check for posting time
      const postingSlot = getTimeSlotForUTCHour(utcHour, isDST);
      if (postingSlot && utcMinute < 5) {
        logger.info(`Running Phase 3: Posting for slot ${postingSlot.hour}:00 EST`);
        await runPosting(config, utcHour);
        return;
      }

      // Check for metrics collection
      // Run 5 minutes after each posting slot
      if (utcMinute >= 5 && utcMinute < 10) {
        const previousHour = utcHour;
        const previousSlot = getTimeSlotForUTCHour(previousHour, isDST);
        if (previousSlot) {
          logger.info('Running Phase 4: Initial metrics collection');
          await runMetricsCollection(config, 'initial');
        }
      }

    } catch (error) {
      logger.error('Scheduled task failed', error);

      // Send error alert
      const email = createEmailService(config);
      await email.sendErrorAlert('scheduled-task', error, {
        utcHour,
        utcMinute,
        cron: event.cron
      });
    }
  },

  /**
   * Handle HTTP requests (for manual triggers and webhooks)
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for dashboard
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health' || path === '/') {
        const validation = validateConfig(config);
        return jsonResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          config: {
            valid: validation.valid,
            missing: validation.missing
          },
          dryRun: isDryRun(config)
        }, corsHeaders);
      }

      // Manual triggers (require auth in production)
      if (path === '/trigger/scrape') {
        const result = await runScrapingAndFiltering(config);
        return jsonResponse(result, corsHeaders);
      }

      if (path === '/trigger/post') {
        const result = await runPosting(config);
        return jsonResponse(result, corsHeaders);
      }

      if (path === '/trigger/metrics') {
        const type = url.searchParams.get('type') || 'initial';
        const result = await runMetricsCollection(config, type);
        return jsonResponse(result, corsHeaders);
      }

      if (path === '/trigger/insights') {
        const result = await generateInsights(env);
        return jsonResponse(result, corsHeaders);
      }

      if (path === '/trigger/reminder') {
        const result = await sendReminder(env);
        return jsonResponse({ sent: result }, corsHeaders);
      }

      // CSV upload endpoint
      if (path === '/upload/csv' && request.method === 'POST') {
        const csvContent = await request.text();
        const result = await processCsv(env, csvContent);
        return jsonResponse(result, corsHeaders);
      }

      // Status endpoint
      if (path === '/status') {
        const sheets = createSheetsService(config);
        const today = getTodayString();

        const status = {
          date: today,
          scraping: await getScrapingStatus(sheets, today),
          posting: await getPostingStatus(sheets, today),
          metrics: await getMetricsStatus(sheets, today)
        };

        return jsonResponse(status, corsHeaders);
      }

      // Test endpoints
      if (path === '/test/sheets') {
        const sheets = createSheetsService(config);
        const diagnostics = {
          connected: false,
          credentialsParsed: false,
          hasClientEmail: false,
          hasPrivateKey: false,
          hasSheetId: false,
          tokenObtained: false,
          error: null
        };

        // Check credentials parsing
        try {
          diagnostics.hasSheetId = !!config.sheets.sheetId;
          diagnostics.credentialsParsed = !!sheets.credentials;
          if (sheets.credentials) {
            diagnostics.hasClientEmail = !!sheets.credentials.client_email;
            diagnostics.hasPrivateKey = !!sheets.credentials.private_key;
            if (sheets.credentials.client_email) {
              diagnostics.clientEmail = sheets.credentials.client_email;
            }
          }

          // Try to get access token
          try {
            await sheets.getAccessToken();
            diagnostics.tokenObtained = true;
          } catch (tokenError) {
            diagnostics.error = `Token error: ${tokenError.message}`;
          }

          // Try to connect
          if (diagnostics.tokenObtained) {
            diagnostics.connected = await sheets.testConnection();
          }
        } catch (error) {
          diagnostics.error = error.message;
        }

        return jsonResponse(diagnostics, corsHeaders);
      }

      if (path === '/test/twitter') {
        const { createTwitterService } = await import('./services/twitter.js');
        const twitter = createTwitterService(config);
        const connected = await twitter.testConnection();
        return jsonResponse({ connected }, corsHeaders);
      }

      if (path === '/test/perplexity') {
        const { createPerplexityService } = await import('./services/perplexity.js');
        const perplexity = createPerplexityService(config);
        const connected = await perplexity.testConnection();
        return jsonResponse({ connected }, corsHeaders);
      }

      // Quick scrape test - just one category, faster for HTTP timeout
      if (path === '/trigger/scrape-quick') {
        const category = url.searchParams.get('category') || 'ai-providers';
        const { createPerplexityService } = await import('./services/perplexity.js');
        const { CATEGORIES } = await import('./constants/categories.js');

        const perplexity = createPerplexityService(config);
        const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];

        try {
          const articles = await perplexity.searchNews(cat.description);
          return jsonResponse({
            success: true,
            category: cat.id,
            articleCount: articles.length,
            articles: articles.slice(0, 3).map(a => ({
              headline: a.headline,
              source: a.source
            }))
          }, corsHeaders);
        } catch (error) {
          return jsonResponse({
            success: false,
            category: cat.id,
            error: error.message
          }, corsHeaders);
        }
      }

      // Background scrape - starts scraping and returns immediately
      if (path === '/trigger/scrape-background') {
        ctx.waitUntil(runScrapingAndFiltering(config));
        return jsonResponse({
          status: 'started',
          message: 'Scraping started in background. Check /status in 30 seconds.'
        }, corsHeaders);
      }

      // 404 for unknown paths
      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

    } catch (error) {
      logger.error('Request handler failed', error);
      return jsonResponse({
        error: error.message,
        stack: isDryRun(config) ? error.stack : undefined
      }, corsHeaders, 500);
    }
  }
};

/**
 * Run scraping and filtering phases
 * @param {Object} config
 */
async function runScrapingAndFiltering(config) {
  logger.info('Starting scraping and filtering');

  // Phase 1: Scraping
  const scraper = createScraperAgent(config);
  const scrapingResult = await scraper.run();

  if (!scrapingResult.success) {
    logger.error('Scraping failed', { errors: scrapingResult.errors });
    return scrapingResult;
  }

  // Get all scraped articles
  const articles = scraper.getAllArticles(scrapingResult);

  // Phase 2: Filtering
  const filter = createFilterAgent(config);
  const filterResult = await filter.run(articles);

  return {
    scraping: scrapingResult,
    filtering: filterResult,
    success: scrapingResult.success && filterResult.success
  };
}

/**
 * Run posting phase
 * @param {Object} config
 * @param {number} [utcHour]
 */
async function runPosting(config, utcHour) {
  logger.info('Starting posting phase');

  const poster = createPosterAgent(config);

  // Load today's schedule if not in memory
  // In production, this might be loaded from KV or D1
  const scheduler = createSchedulerService();
  scheduler.initializeDailySchedule();

  // Load articles from sheets
  const sheets = createSheetsService(config);
  const today = getTodayString();

  try {
    const headlines = await sheets.readSheet(`Headlines_${today}`);
    if (headlines.length > 1) {
      const articles = headlines.slice(1).map(row => ({
        headline: row[2],
        url: row[3],
        source: row[4],
        score: parseFloat(row[5]),
        category: row[1],
        categoryRank: parseInt(row[0], 10),
        postingSlot: row[11],
        mabQuoteNumber: row[12] ? parseInt(row[12], 10) : null
      }));

      scheduler.assignArticlesToSchedule(articles);
    }
  } catch (error) {
    logger.warn('Could not load headlines from sheets', { error: error.message });
  }

  // Import schedule to poster
  poster.importSchedule(scheduler.exportSchedule());

  // Run the poster
  const result = await poster.run(utcHour);

  return result;
}

/**
 * Run metrics collection
 * @param {Object} config
 * @param {string} type
 */
async function runMetricsCollection(config, type) {
  logger.info(`Starting ${type} metrics collection`);

  const analytics = createAnalyticsAgent(config);
  return analytics.collectMetrics(type);
}

/**
 * Get scraping status for today
 * @param {SheetsService} sheets
 * @param {string} today
 */
async function getScrapingStatus(sheets, today) {
  try {
    const data = await sheets.readSheet(`Scrape_${today}`);
    return {
      completed: data.length > 1,
      articleCount: Math.max(0, data.length - 1)
    };
  } catch {
    return { completed: false, articleCount: 0 };
  }
}

/**
 * Get posting status for today
 * @param {SheetsService} sheets
 * @param {string} today
 */
async function getPostingStatus(sheets, today) {
  try {
    const data = await sheets.readSheet('Posted_Tweets');
    const todayPosts = data.filter(row => row[0]?.startsWith(today));
    return {
      postsToday: todayPosts.length,
      target: 9
    };
  } catch {
    return { postsToday: 0, target: 9 };
  }
}

/**
 * Get metrics status
 * @param {SheetsService} sheets
 * @param {string} today
 */
async function getMetricsStatus(sheets, today) {
  try {
    const data = await sheets.readSheet('Post_Performance');
    const todayMetrics = data.filter(row => row[0] === today);
    return {
      collectionsToday: todayMetrics.length
    };
  } catch {
    return { collectionsToday: 0 };
  }
}

/**
 * Create JSON response
 * @param {Object} data
 * @param {Object} corsHeaders
 * @param {number} [status=200]
 */
function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
