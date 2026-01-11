/**
 * MAB AI Strategies Twitter SEO Agent
 * Perplexity API Service
 *
 * Primary news source using Perplexity's sonar-pro model.
 * Provides real-time web search with AI summarization.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('info').child('perplexity');

/**
 * @typedef {Object} PerplexityConfig
 * @property {string} apiKey - Perplexity API key
 * @property {string} endpoint - API endpoint
 * @property {string} model - Model to use (sonar-pro)
 */

/**
 * @typedef {Object} Article
 * @property {string} headline - Article headline
 * @property {string} url - Article URL
 * @property {string} source - Source name
 * @property {string} publishDate - Publish date
 * @property {string} summary - Article summary
 * @property {string} whyItMatters - Business relevance
 */

/**
 * Perplexity API client
 */
export class PerplexityService {
  /**
   * @param {PerplexityConfig} config
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || 'https://api.perplexity.ai/chat/completions';
    this.model = config.model || 'sonar-pro';
  }

  /**
   * Make a request to Perplexity API
   * @param {string} query - Search query
   * @returns {Promise<Object>}
   */
  async query(query) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a news research assistant. Return responses in valid JSON format only, with no additional text or markdown formatting.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Search for news articles in a category
   * @param {string} categoryDescription - Category to search for
   * @returns {Promise<Article[]>}
   */
  async searchNews(categoryDescription) {
    logger.info(`Searching Perplexity for: ${categoryDescription}`);

    const query = `Find the 15 most important news articles from the past 24 hours about: ${categoryDescription}.

Return ONLY a valid JSON array with this exact structure (no other text):
[
  {
    "headline": "Article headline here",
    "url": "https://example.com/article",
    "source": "Source Name",
    "publishDate": "2024-01-15T10:30:00Z",
    "summary": "Two sentence summary of the article content.",
    "whyItMatters": "Brief explanation of why this matters for business leaders."
  }
]

Requirements:
- Include exactly 15 articles if possible
- Only articles from reputable sources
- Only articles from the last 24 hours
- Each article must have a valid URL
- Summary should be 2-3 sentences
- Focus on articles relevant to business decision-makers`;

    try {
      const response = await this.query(query);

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response structure from Perplexity');
      }

      const content = response.choices[0].message.content;

      // Try to extract JSON from the response
      let articles = this.parseArticles(content);

      logger.info(`Found ${articles.length} articles from Perplexity`);
      return articles;

    } catch (error) {
      logger.error('Perplexity search failed', error);
      throw error;
    }
  }

  /**
   * Parse articles from Perplexity response
   * @param {string} content - Response content
   * @returns {Article[]}
   */
  parseArticles(content) {
    try {
      // Try to parse directly
      let articles = JSON.parse(content);

      // If it's an object with an articles property, extract it
      if (articles.articles && Array.isArray(articles.articles)) {
        articles = articles.articles;
      }

      if (!Array.isArray(articles)) {
        throw new Error('Response is not an array');
      }

      // Validate and clean each article
      return articles
        .map(article => this.cleanArticle(article))
        .filter(article => article !== null);

    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const articles = JSON.parse(jsonMatch[1]);
          if (Array.isArray(articles)) {
            return articles
              .map(article => this.cleanArticle(article))
              .filter(article => article !== null);
          }
        } catch (e) {
          // Fall through to error
        }
      }

      // Try to find JSON array in the content
      const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try {
          const articles = JSON.parse(arrayMatch[0]);
          return articles
            .map(article => this.cleanArticle(article))
            .filter(article => article !== null);
        } catch (e) {
          // Fall through to error
        }
      }

      logger.error('Failed to parse Perplexity response', { parseError, content: content.substring(0, 500) });
      return [];
    }
  }

  /**
   * Clean and validate an article object
   * @param {Object} article - Raw article data
   * @returns {Article|null}
   */
  cleanArticle(article) {
    if (!article || typeof article !== 'object') return null;

    const headline = article.headline || article.title;
    const url = article.url || article.link;

    if (!headline || !url) return null;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return null;
    }

    return {
      headline: String(headline).trim(),
      url: String(url).trim(),
      source: String(article.source || 'Unknown').trim(),
      publishDate: article.publishDate || article.published_date || new Date().toISOString(),
      summary: String(article.summary || article.description || '').trim(),
      whyItMatters: String(article.whyItMatters || article.why_it_matters || '').trim()
    };
  }

  /**
   * Get article details/summary
   * @param {string} url - Article URL
   * @returns {Promise<Object>}
   */
  async getArticleSummary(url) {
    logger.info(`Getting summary for: ${url}`);

    const query = `Summarize this article in 3 key points: ${url}

Return ONLY a valid JSON object with this structure (no other text):
{
  "mainClaim": "The primary argument or announcement in the article",
  "supportingData": "Key statistics, quotes, or evidence presented",
  "businessImplications": "What this means for mid-market business leaders",
  "keyPoints": [
    "First key point",
    "Second key point",
    "Third key point"
  ]
}`;

    try {
      const response = await this.query(query);
      const content = response.choices[0].message.content;

      // Parse the response
      try {
        return JSON.parse(content);
      } catch {
        // Try to extract JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse summary response');
      }

    } catch (error) {
      logger.error('Failed to get article summary', error);
      throw error;
    }
  }

  /**
   * Test the API connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const response = await this.query('Return exactly: {"status": "ok"}');
      return response.choices?.[0]?.message?.content?.includes('ok') || false;
    } catch (error) {
      logger.error('Perplexity connection test failed', error);
      return false;
    }
  }
}

/**
 * Create a Perplexity service instance
 * @param {Object} config - Configuration with apiKey
 * @returns {PerplexityService}
 */
export function createPerplexityService(config) {
  return new PerplexityService(config.perplexity);
}

export default PerplexityService;
