/**
 * MAB AI Strategies Twitter SEO Agent
 * Email Service
 *
 * Handles sending email notifications for errors and weekly reminders.
 * Supports both Cloudflare Email Workers and external SMTP.
 */

import { createLogger } from '../utils/logger.js';
import { formatDate } from '../utils/date-utils.js';

const logger = createLogger('info').child('email');

/**
 * @typedef {Object} EmailConfig
 * @property {string} alertEmail - Email address for alerts
 * @property {string} [smtpHost] - SMTP host
 * @property {number} [smtpPort] - SMTP port
 * @property {string} [smtpUser] - SMTP username
 * @property {string} [smtpPass] - SMTP password
 */

/**
 * @typedef {Object} EmailMessage
 * @property {string} to - Recipient email
 * @property {string} subject - Email subject
 * @property {string} text - Plain text body
 * @property {string} [html] - HTML body
 */

/**
 * Email service for notifications
 */
export class EmailService {
  /**
   * @param {EmailConfig} config
   */
  constructor(config) {
    this.alertEmail = config.alertEmail;
    this.smtpHost = config.smtpHost;
    this.smtpPort = config.smtpPort;
    this.smtpUser = config.smtpUser;
    this.smtpPass = config.smtpPass;

    // Determine which method to use
    this.useSmtp = !!(this.smtpHost && this.smtpUser && this.smtpPass);
  }

  /**
   * Send an email
   * @param {EmailMessage} message
   * @returns {Promise<boolean>}
   */
  async send(message) {
    if (!this.alertEmail) {
      logger.warn('No alert email configured, skipping notification');
      return false;
    }

    logger.info(`Sending email: ${message.subject}`);

    try {
      if (this.useSmtp) {
        return await this.sendViaSmtp(message);
      } else {
        // For Cloudflare, we'll use a webhook or external service
        return await this.sendViaWebhook(message);
      }
    } catch (error) {
      logger.error('Failed to send email', error);
      return false;
    }
  }

  /**
   * Send email via SMTP (requires external library in Node.js)
   * Note: This is a placeholder - SMTP is not natively supported in Cloudflare Workers
   * @param {EmailMessage} message
   * @returns {Promise<boolean>}
   */
  async sendViaSmtp(message) {
    // In Cloudflare Workers, we can't use SMTP directly
    // This is for local testing with Node.js
    logger.warn('SMTP not available in Cloudflare Workers, falling back to webhook');
    return this.sendViaWebhook(message);
  }

  /**
   * Send email via webhook service (e.g., Mailgun, SendGrid, or custom)
   * @param {EmailMessage} message
   * @returns {Promise<boolean>}
   */
  async sendViaWebhook(message) {
    // This is a placeholder for a webhook-based email service
    // In production, you would integrate with:
    // - SendGrid: https://api.sendgrid.com/v3/mail/send
    // - Mailgun: https://api.mailgun.net/v3/your-domain/messages
    // - Cloudflare Email Routing: https://developers.cloudflare.com/email-routing/

    logger.info('Email would be sent (webhook not configured)', {
      to: message.to || this.alertEmail,
      subject: message.subject
    });

    // Log to console for development
    console.log('=== EMAIL NOTIFICATION ===');
    console.log(`To: ${message.to || this.alertEmail}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Body: ${message.text}`);
    console.log('========================');

    return true;
  }

  /**
   * Send error alert
   * @param {string} phase - Which phase encountered the error
   * @param {Error} error - The error object
   * @param {Object} [context] - Additional context
   * @returns {Promise<boolean>}
   */
  async sendErrorAlert(phase, error, context = {}) {
    const subject = `[MAB Twitter Agent] Error in ${phase}`;

    const text = `
Error Alert from MAB AI Strategies Twitter Agent

Phase: ${phase}
Time: ${formatDate(new Date())}
Error: ${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}

Context:
${JSON.stringify(context, null, 2)}

---
This is an automated message from the Twitter SEO Agent.
    `.trim();

    return this.send({
      to: this.alertEmail,
      subject,
      text
    });
  }

  /**
   * Send weekly analytics reminder
   * @returns {Promise<boolean>}
   */
  async sendAnalyticsReminder() {
    const subject = '[MAB Twitter Agent] Weekly Analytics Export Reminder';

    const text = `
Hi there!

It's time for your weekly Twitter analytics export.

Please follow these steps:
1. Go to: https://analytics.twitter.com
2. Click "Export data" → Select "Last 7 days"
3. Download the CSV file
4. Upload it to: /analytics-uploads/twitter-analytics-${formatDate(new Date(), { includeTime: false })}.csv

The system will automatically process the file within 5 minutes of upload.

Why this matters:
The Twitter API free tier doesn't provide impression data. By exporting your analytics weekly, we can:
- Calculate accurate CTR (click-through rate)
- Track impressions and reach
- Identify top-performing content
- Generate AI-powered insights

---
MAB AI Strategies Twitter Agent
    `.trim();

    return this.send({
      to: this.alertEmail,
      subject,
      text
    });
  }

  /**
   * Send daily summary
   * @param {Object} stats - Daily statistics
   * @returns {Promise<boolean>}
   */
  async sendDailySummary(stats) {
    const subject = `[MAB Twitter Agent] Daily Summary - ${formatDate(new Date(), { includeTime: false })}`;

    const text = `
Daily Summary - MAB AI Strategies Twitter Agent

Date: ${formatDate(new Date(), { includeTime: false })}

Posts Summary:
- Total Scheduled: ${stats.total || 0}
- Successfully Posted: ${stats.posted || 0}
- Failed: ${stats.failed || 0}
- Pending: ${stats.pending || 0}

Scraping Summary:
- Articles Scraped: ${stats.articlesScraped || 0}
- From Perplexity: ${stats.perplexityArticles || 0}
- From NewsAPI: ${stats.newsApiArticles || 0}

Errors:
${stats.errors?.length > 0 ? stats.errors.join('\n') : 'No errors today!'}

Top Performing Post (so far):
${stats.topPost ? `"${stats.topPost.text?.substring(0, 100)}..."` : 'Data not yet available'}
${stats.topPost ? `Engagement: ${stats.topPost.engagement}` : ''}

---
MAB AI Strategies Twitter Agent
    `.trim();

    return this.send({
      to: this.alertEmail,
      subject,
      text
    });
  }

  /**
   * Send critical failure alert (both APIs failed)
   * @param {string} category
   * @param {Object} errors
   * @returns {Promise<boolean>}
   */
  async sendCriticalFailure(category, errors) {
    const subject = `[CRITICAL] MAB Twitter Agent - All APIs Failed for ${category}`;

    const text = `
CRITICAL ALERT: News Scraping Failure

Category: ${category}
Time: ${formatDate(new Date())}

Both news APIs have failed for this category:

Perplexity Error:
${errors.perplexity?.message || 'Unknown error'}

NewsAPI Error:
${errors.newsapi?.message || 'Unknown error'}

Action Required:
The system will attempt to use articles from the previous day's scrape.
Please check the API keys and account status.

Perplexity Dashboard: https://www.perplexity.ai/settings/api
NewsAPI Dashboard: https://newsapi.org/account

---
MAB AI Strategies Twitter Agent
    `.trim();

    return this.send({
      to: this.alertEmail,
      subject,
      text
    });
  }

  /**
   * Send weekly insights report
   * @param {Object} insights - AI-generated insights
   * @returns {Promise<boolean>}
   */
  async sendWeeklyInsights(insights) {
    const subject = `[MAB Twitter Agent] Weekly AI Insights - Week of ${formatDate(new Date(), { includeTime: false })}`;

    const text = `
Weekly AI-Powered Insights
MAB AI Strategies Twitter Agent

${insights.summary || 'No summary available'}

DOUBLE DOWN (What's Working):
${insights.doubleDown?.map(item => `• ${item}`).join('\n') || '• Analysis pending'}

PIVOT (What to Change):
${insights.pivot?.map(item => `• ${item}`).join('\n') || '• Analysis pending'}

THIS WEEK'S FOCUS:
${insights.focus?.map(item => `• ${item}`).join('\n') || '• Analysis pending'}

Key Metrics:
- Total Posts: ${insights.metrics?.totalPosts || 'N/A'}
- Avg Engagement Rate: ${insights.metrics?.avgEngagement || 'N/A'}
- Best Time: ${insights.metrics?.bestTime || 'N/A'}
- Top Category: ${insights.metrics?.topCategory || 'N/A'}

View full dashboard: [Your Dashboard URL]

---
MAB AI Strategies Twitter Agent
    `.trim();

    return this.send({
      to: this.alertEmail,
      subject,
      text
    });
  }

  /**
   * Test email sending
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    return this.send({
      to: this.alertEmail,
      subject: '[MAB Twitter Agent] Test Email',
      text: 'This is a test email from the MAB AI Strategies Twitter Agent. If you received this, email notifications are working correctly!'
    });
  }
}

/**
 * Create an email service instance
 * @param {Object} config
 * @returns {EmailService}
 */
export function createEmailService(config) {
  return new EmailService(config.email);
}

export default EmailService;
