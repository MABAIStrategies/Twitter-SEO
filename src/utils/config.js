/**
 * MAB AI Strategies Twitter SEO Agent
 * Configuration Management
 *
 * Handles environment variables and configuration for both
 * local development and Cloudflare Workers deployment.
 */

/**
 * @typedef {Object} Config
 * @property {Object} perplexity - Perplexity API configuration
 * @property {Object} newsapi - NewsAPI configuration
 * @property {Object} twitter - Twitter API configuration
 * @property {Object} sheets - Google Sheets configuration
 * @property {Object} openai - OpenAI configuration (optional)
 * @property {Object} email - Email notification configuration
 * @property {Object} app - Application settings
 */

/**
 * Get configuration from environment
 * Works in both Node.js and Cloudflare Workers environments
 *
 * @param {Object} [env] - Cloudflare Workers env object (optional in Node.js)
 * @returns {Config}
 */
export function getConfig(env = {}) {
  // In Node.js, we might have process.env
  const processEnv = typeof process !== 'undefined' ? process.env : {};

  // Merge Cloudflare env with process.env (Cloudflare takes precedence)
  const getEnv = (key, defaultValue = '') => {
    return env[key] || processEnv[key] || defaultValue;
  };

  return {
    perplexity: {
      apiKey: getEnv('PERPLEXITY_API_KEY'),
      endpoint: 'https://api.perplexity.ai/chat/completions',
      model: 'sonar-pro'
    },

    newsapi: {
      apiKey: getEnv('NEWSAPI_KEY'),
      endpoint: 'https://newsapi.org/v2/everything',
      maxRequestsPerDay: 100
    },

    twitter: {
      apiKey: getEnv('TWITTER_API_KEY'),
      apiSecret: getEnv('TWITTER_API_SECRET'),
      accessToken: getEnv('TWITTER_ACCESS_TOKEN'),
      accessSecret: getEnv('TWITTER_ACCESS_SECRET'),
      userId: getEnv('TWITTER_USER_ID'),
      apiBaseUrl: 'https://api.twitter.com/2'
    },

    sheets: {
      credentials: getEnv('GOOGLE_SHEETS_CREDENTIALS'),
      sheetId: getEnv('GOOGLE_SHEET_ID')
    },

    openai: {
      apiKey: getEnv('OPENAI_API_KEY'),
      model: 'gpt-4-turbo-preview'
    },

    anthropic: {
      apiKey: getEnv('ANTHROPIC_API_KEY'),
      model: 'claude-3-sonnet-20240229'
    },

    email: {
      alertEmail: getEnv('ALERT_EMAIL'),
      smtpHost: getEnv('SMTP_HOST'),
      smtpPort: parseInt(getEnv('SMTP_PORT', '587'), 10),
      smtpUser: getEnv('SMTP_USER'),
      smtpPass: getEnv('SMTP_PASS')
    },

    app: {
      environment: getEnv('ENVIRONMENT', 'development'),
      timezone: getEnv('TIMEZONE', 'America/New_York'),
      dryRun: getEnv('DRY_RUN', 'true') === 'true',
      logLevel: getEnv('LOG_LEVEL', 'info'),
      maxRetries: parseInt(getEnv('MAX_RETRIES', '3'), 10),
      retryDelayMs: parseInt(getEnv('RETRY_DELAY_MS', '5000'), 10)
    }
  };
}

/**
 * Validate that all required configuration is present
 * @param {Config} config - Configuration object
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateConfig(config) {
  const missing = [];

  // Check Perplexity (primary news source)
  if (!config.perplexity.apiKey) {
    missing.push('PERPLEXITY_API_KEY');
  }

  // NewsAPI is backup, but should be configured
  if (!config.newsapi.apiKey) {
    missing.push('NEWSAPI_KEY (backup news source)');
  }

  // Twitter is required for posting
  if (!config.twitter.apiKey) missing.push('TWITTER_API_KEY');
  if (!config.twitter.apiSecret) missing.push('TWITTER_API_SECRET');
  if (!config.twitter.accessToken) missing.push('TWITTER_ACCESS_TOKEN');
  if (!config.twitter.accessSecret) missing.push('TWITTER_ACCESS_SECRET');

  // Google Sheets is required for logging
  if (!config.sheets.credentials) missing.push('GOOGLE_SHEETS_CREDENTIALS');
  if (!config.sheets.sheetId) missing.push('GOOGLE_SHEET_ID');

  // Alert email is recommended
  if (!config.email.alertEmail) {
    missing.push('ALERT_EMAIL (recommended for error notifications)');
  }

  return {
    valid: missing.filter(m => !m.includes('recommended') && !m.includes('backup')).length === 0,
    missing
  };
}

/**
 * Check if running in dry-run mode
 * @param {Config} config - Configuration object
 * @returns {boolean}
 */
export function isDryRun(config) {
  return config.app.dryRun;
}

/**
 * Check if running in production
 * @param {Config} config - Configuration object
 * @returns {boolean}
 */
export function isProduction(config) {
  return config.app.environment === 'production';
}

/**
 * Get the appropriate AI service for scoring
 * Prefers OpenAI if available, falls back to Anthropic, then heuristics
 * @param {Config} config - Configuration object
 * @returns {'openai'|'anthropic'|'heuristic'}
 */
export function getAIProvider(config) {
  if (config.openai.apiKey) return 'openai';
  if (config.anthropic.apiKey) return 'anthropic';
  return 'heuristic';
}

export default getConfig;
