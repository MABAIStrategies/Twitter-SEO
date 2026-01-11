/**
 * MAB AI Strategies Twitter SEO Agent
 * Analytics Agent Tests
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AnalyticsAgent } from '../src/agents/analytics.js';

// Mock configuration
const mockConfig = {
  twitter: { apiKey: 'test', apiSecret: 'test', accessToken: 'test', accessSecret: 'test' },
  sheets: { credentials: 'dGVzdA==', sheetId: 'test' },
  email: { alertEmail: 'test@example.com' },
  openai: { apiKey: '' },
  anthropic: { apiKey: '' },
  app: { dryRun: true, logLevel: 'error' }
};

describe('AnalyticsAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new AnalyticsAgent(mockConfig);
  });

  describe('calculateEngagementRate', () => {
    test('should sum all engagement metrics', () => {
      const metrics = {
        like_count: 10,
        retweet_count: 5,
        reply_count: 2,
        quote_count: 1
      };

      const rate = agent.calculateEngagementRate(metrics);
      expect(rate).toBe(18);
    });

    test('should handle missing metrics', () => {
      const metrics = {
        like_count: 10
        // Other metrics missing
      };

      const rate = agent.calculateEngagementRate(metrics);
      expect(rate).toBe(10);
    });

    test('should handle all zero metrics', () => {
      const metrics = {
        like_count: 0,
        retweet_count: 0,
        reply_count: 0,
        quote_count: 0
      };

      const rate = agent.calculateEngagementRate(metrics);
      expect(rate).toBe(0);
    });
  });

  describe('calculateViralityScore', () => {
    test('should calculate shares to likes ratio', () => {
      const metrics = {
        like_count: 10,
        retweet_count: 5,
        quote_count: 2
      };

      const score = agent.calculateViralityScore(metrics);
      // (5 + 2) / (10 + 1) = 7/11 ≈ 0.636
      expect(score).toBeCloseTo(0.636, 2);
    });

    test('should handle zero likes (avoid division by zero)', () => {
      const metrics = {
        like_count: 0,
        retweet_count: 5,
        quote_count: 0
      };

      const score = agent.calculateViralityScore(metrics);
      // (5 + 0) / (0 + 1) = 5
      expect(score).toBe(5);
    });
  });

  describe('parseCsvLine', () => {
    test('should parse simple CSV line', () => {
      const line = 'value1,value2,value3';
      const result = agent.parseCsvLine(line);
      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    test('should handle quoted values with commas', () => {
      const line = '"value with, comma",value2,"another, value"';
      const result = agent.parseCsvLine(line);
      expect(result).toEqual(['value with, comma', 'value2', 'another, value']);
    });

    test('should handle empty values', () => {
      const line = 'value1,,value3';
      const result = agent.parseCsvLine(line);
      expect(result).toEqual(['value1', '', 'value3']);
    });
  });

  describe('calculateStats', () => {
    test('should calculate averages correctly', () => {
      const rows = [
        ['2024-01-15', '11:00', 'ai-providers', '1', 'url1', 'text1', 'id1', 'url1', '10', '5', '2', '1'],
        ['2024-01-15', '12:00', 'business-ai', '2', 'url2', 'text2', 'id2', 'url2', '20', '10', '4', '2']
      ];

      const stats = agent.calculateStats(rows);

      expect(stats.totalPosts).toBe(2);
      expect(parseFloat(stats.avgLikes)).toBe(15); // (10 + 20) / 2
      expect(parseFloat(stats.avgRetweets)).toBe(7.5); // (5 + 10) / 2
    });

    test('should track top posts', () => {
      const rows = [
        ['2024-01-15', '11:00', 'ai-providers', '1', 'url1', 'High engagement post', 'id1', 'url1', '100', '50', '20', '10'],
        ['2024-01-15', '12:00', 'business-ai', '2', 'url2', 'Low engagement post', 'id2', 'url2', '5', '2', '1', '0']
      ];

      const stats = agent.calculateStats(rows);

      expect(stats.topPosts.length).toBe(2);
      expect(stats.topPosts[0].engagement).toBeGreaterThan(stats.topPosts[1].engagement);
    });
  });

  describe('generateHeuristicInsights', () => {
    test('should identify best performing time', () => {
      const stats = {
        totalPosts: 10,
        avgEngagement: '50',
        byTime: {
          '9': { avgEngagement: '40' },
          '11': { avgEngagement: '60' },
          '14': { avgEngagement: '45' }
        },
        byCategory: {
          'ai-providers': { avgEngagement: '55' },
          'business-ai': { avgEngagement: '45' }
        },
        topPosts: []
      };

      const insights = agent.generateHeuristicInsights(stats);

      expect(insights.metrics.bestTime).toBe('11:00');
      expect(insights.metrics.topCategory).toBe('ai-providers');
    });

    test('should return structured insights object', () => {
      const stats = {
        totalPosts: 5,
        avgEngagement: '30',
        byTime: {},
        byCategory: {},
        topPosts: []
      };

      const insights = agent.generateHeuristicInsights(stats);

      expect(insights).toHaveProperty('summary');
      expect(insights).toHaveProperty('doubleDown');
      expect(insights).toHaveProperty('pivot');
      expect(insights).toHaveProperty('focus');
      expect(insights).toHaveProperty('metrics');
    });
  });
});

describe('Collection Schedule', () => {
  const COLLECTION_SCHEDULE = {
    initial: 0.083, // 5 minutes
    day1: 24,
    day3: 72,
    day10: 240
  };

  test('should have correct timing for initial collection', () => {
    expect(COLLECTION_SCHEDULE.initial * 60).toBeCloseTo(5, 0); // ~5 minutes
  });

  test('should have correct timing for day 1 collection', () => {
    expect(COLLECTION_SCHEDULE.day1).toBe(24); // 24 hours
  });

  test('should have correct timing for day 3 collection', () => {
    expect(COLLECTION_SCHEDULE.day3).toBe(72); // 72 hours = 3 days
  });

  test('should have correct timing for day 10 collection', () => {
    expect(COLLECTION_SCHEDULE.day10).toBe(240); // 240 hours = 10 days
  });
});
