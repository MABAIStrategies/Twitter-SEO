/**
 * MAB AI Strategies Twitter SEO Agent
 * Filter Agent Tests
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { FilterAgent } from '../src/agents/filter.js';
import { calculateRecencyScore } from '../src/utils/date-utils.js';

// Mock configuration
const mockConfig = {
  perplexity: { apiKey: 'test' },
  newsapi: { apiKey: 'test' },
  twitter: { apiKey: 'test', apiSecret: 'test', accessToken: 'test', accessSecret: 'test' },
  sheets: { credentials: 'dGVzdA==', sheetId: 'test' },
  email: { alertEmail: 'test@example.com' },
  openai: { apiKey: '' },
  anthropic: { apiKey: '' },
  app: { dryRun: true, logLevel: 'error' }
};

// Sample articles for testing
const createTestArticle = (overrides = {}) => ({
  headline: 'OpenAI Announces Major AI Breakthrough with 50% Performance Gains',
  url: 'https://techcrunch.com/article',
  source: 'TechCrunch',
  publishDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  summary: 'OpenAI has unveiled significant improvements to their AI models, showing 50% better performance.',
  category: 'ai-providers',
  ...overrides
});

describe('FilterAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new FilterAgent(mockConfig);
  });

  describe('calculateAuthorityScore', () => {
    test('should score Tier 1 sources at 25 points', () => {
      expect(agent.calculateAuthorityScore('TechCrunch')).toBe(25);
      expect(agent.calculateAuthorityScore('The Verge')).toBe(25);
      expect(agent.calculateAuthorityScore('Bloomberg')).toBe(25);
      expect(agent.calculateAuthorityScore('Reuters')).toBe(25);
    });

    test('should score Tier 2 sources at 20 points', () => {
      expect(agent.calculateAuthorityScore('VentureBeat')).toBe(20);
      expect(agent.calculateAuthorityScore('Ars Technica')).toBe(20);
      expect(agent.calculateAuthorityScore('MIT Technology Review')).toBe(20);
    });

    test('should score Tier 3 sources at 15 points', () => {
      expect(agent.calculateAuthorityScore('Forbes')).toBe(15);
      expect(agent.calculateAuthorityScore('Business Insider')).toBe(15);
    });

    test('should score Tier 4 (company blogs) at 10 points', () => {
      expect(agent.calculateAuthorityScore('OpenAI Blog')).toBe(10);
      expect(agent.calculateAuthorityScore('Google AI')).toBe(10);
    });

    test('should score unknown sources at 5 points', () => {
      expect(agent.calculateAuthorityScore('Random Blog')).toBe(5);
      expect(agent.calculateAuthorityScore('Unknown Source')).toBe(5);
    });
  });

  describe('calculateViralityScore', () => {
    test('should add points for statistics', () => {
      const article = createTestArticle({
        headline: 'AI Performance Improves 50% in Latest Benchmark'
      });
      const score = agent.calculateViralityScore(article);
      expect(score).toBeGreaterThanOrEqual(5);
    });

    test('should add points for major companies', () => {
      const article = createTestArticle({
        headline: 'OpenAI and Google Announce Partnership'
      });
      const score = agent.calculateViralityScore(article);
      expect(score).toBeGreaterThanOrEqual(5);
    });

    test('should add points for provocative claims', () => {
      const article = createTestArticle({
        headline: 'Is This the End of Traditional Software Development?'
      });
      const score = agent.calculateViralityScore(article);
      expect(score).toBeGreaterThanOrEqual(5);
    });

    test('should cap score at 20', () => {
      const article = createTestArticle({
        headline: 'Breaking: OpenAI Just Announced 100% Improvement?'
      });
      const score = agent.calculateViralityScore(article);
      expect(score).toBeLessThanOrEqual(20);
    });
  });

  describe('calculateSeoScore', () => {
    test('should add points for SEO keywords', () => {
      const article = createTestArticle({
        summary: 'This AI strategy improves digital transformation for mid-market businesses.'
      });
      const score = agent.calculateSeoScore(article);
      expect(score).toBeGreaterThan(0);
    });

    test('should add points for B2B keywords', () => {
      const article = createTestArticle({
        summary: 'Enterprise organizations are adopting this B2B AI solution.'
      });
      const score = agent.calculateSeoScore(article);
      expect(score).toBeGreaterThan(0);
    });

    test('should cap score at 10', () => {
      const article = createTestArticle({
        headline: 'AI Strategy for Mid-Market Enterprise B2B Digital Transformation',
        summary: 'AI Strategy for Mid-Market Enterprise B2B Digital Transformation'
      });
      const score = agent.calculateSeoScore(article);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe('calculateEngagementScoreHeuristic', () => {
    test('should score provocative content higher', () => {
      const provocative = createTestArticle({
        headline: 'Everyone Must Adopt AI Now or Fail',
        summary: 'The truth about AI adoption that every business needs to know.'
      });
      const neutral = createTestArticle({
        headline: 'Company Releases New Software Update',
        summary: 'A software update was released today.'
      });

      const provocativeScore = agent.calculateEngagementScoreHeuristic(provocative);
      const neutralScore = agent.calculateEngagementScoreHeuristic(neutral);

      expect(provocativeScore).toBeGreaterThan(neutralScore);
    });

    test('should cap score at 25', () => {
      const maxArticle = createTestArticle({
        headline: 'This Revolutionary Research Shows ROI Growth Must Change Everything',
        summary: 'Every business should adopt this for productivity and efficiency gains.'
      });
      const score = agent.calculateEngagementScoreHeuristic(maxArticle);
      expect(score).toBeLessThanOrEqual(25);
    });
  });

  describe('selectTopArticles', () => {
    test('should select top 3 articles per category', () => {
      const articles = [
        createTestArticle({ score: 90, category: 'ai-providers' }),
        createTestArticle({ score: 85, category: 'ai-providers' }),
        createTestArticle({ score: 80, category: 'ai-providers' }),
        createTestArticle({ score: 75, category: 'ai-providers' }),
        createTestArticle({ score: 70, category: 'business-ai' }),
        createTestArticle({ score: 65, category: 'business-ai' }),
        createTestArticle({ score: 60, category: 'ai-safety' })
      ];

      const selected = agent.selectTopArticles(articles);
      const aiProviders = selected.filter(a => a.category === 'ai-providers');

      expect(aiProviders.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('Recency Score', () => {
  test('should score articles under 6 hours at 20 points', () => {
    const recentDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    expect(calculateRecencyScore(recentDate)).toBe(20);
  });

  test('should score articles 6-12 hours at 15 points', () => {
    const date = new Date(Date.now() - 9 * 60 * 60 * 1000); // 9 hours ago
    expect(calculateRecencyScore(date)).toBe(15);
  });

  test('should score articles 12-18 hours at 10 points', () => {
    const date = new Date(Date.now() - 15 * 60 * 60 * 1000); // 15 hours ago
    expect(calculateRecencyScore(date)).toBe(10);
  });

  test('should score articles 18-24 hours at 5 points', () => {
    const date = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20 hours ago
    expect(calculateRecencyScore(date)).toBe(5);
  });

  test('should score articles over 24 hours at 0 points', () => {
    const date = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
    expect(calculateRecencyScore(date)).toBe(0);
  });
});
