/**
 * MAB AI Strategies Twitter SEO Agent
 * Scraper Agent Tests
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ScraperAgent } from '../src/agents/scraper.js';
import { CATEGORIES } from '../src/constants/categories.js';

// Mock configuration
const mockConfig = {
  perplexity: {
    apiKey: 'test-perplexity-key',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    model: 'sonar-pro'
  },
  newsapi: {
    apiKey: 'test-newsapi-key',
    endpoint: 'https://newsapi.org/v2/everything',
    maxRequestsPerDay: 100
  },
  sheets: {
    credentials: 'dGVzdA==', // 'test' in base64
    sheetId: 'test-sheet-id'
  },
  email: {
    alertEmail: 'test@example.com'
  },
  app: {
    dryRun: true,
    logLevel: 'error'
  }
};

// Sample article data
const mockArticles = [
  {
    headline: 'OpenAI Announces GPT-5 Preview',
    url: 'https://example.com/article1',
    source: 'TechCrunch',
    publishDate: new Date().toISOString(),
    summary: 'OpenAI has announced a preview of GPT-5 with significant improvements.'
  },
  {
    headline: 'Google Expands AI Enterprise Solutions',
    url: 'https://example.com/article2',
    source: 'The Verge',
    publishDate: new Date().toISOString(),
    summary: 'Google announces new AI tools for enterprise customers.'
  }
];

describe('ScraperAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new ScraperAgent(mockConfig);
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('enrichArticle', () => {
    test('should add category and API info to article', () => {
      const article = {
        headline: 'Test Article',
        url: 'https://example.com/test',
        source: 'Test Source',
        publishDate: '2024-01-15T10:00:00Z',
        summary: 'This is a test article summary.'
      };

      const enriched = agent.enrichArticle(article, 'ai-providers', 'perplexity');

      expect(enriched).not.toBeNull();
      expect(enriched.category).toBe('ai-providers');
      expect(enriched.apiUsed).toBe('perplexity');
      expect(enriched.scrapedAt).toBeDefined();
    });

    test('should return null for invalid articles', () => {
      expect(agent.enrichArticle(null, 'cat', 'api')).toBeNull();
      expect(agent.enrichArticle({}, 'cat', 'api')).toBeNull();
    });
  });

  describe('getAllArticles', () => {
    test('should combine articles from all categories', () => {
      const results = {
        categories: {
          'ai-providers': { articles: mockArticles },
          'business-ai': { articles: [mockArticles[0]] },
          'ai-safety': { articles: [] }
        }
      };

      const allArticles = agent.getAllArticles(results);

      expect(allArticles).toHaveLength(3);
    });
  });
});

describe('Categories', () => {
  test('should have 3 categories defined', () => {
    expect(CATEGORIES).toHaveLength(3);
  });

  test('each category should have required fields', () => {
    CATEGORIES.forEach(category => {
      expect(category.id).toBeDefined();
      expect(category.name).toBeDefined();
      expect(category.description).toBeDefined();
      expect(category.newsApiQueries).toBeDefined();
      expect(Array.isArray(category.newsApiQueries)).toBe(true);
    });
  });

  test('category IDs should be unique', () => {
    const ids = CATEGORIES.map(c => c.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids).toHaveLength(uniqueIds.length);
  });
});
