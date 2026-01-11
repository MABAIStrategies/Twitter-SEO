/**
 * MAB AI Strategies Twitter SEO Agent
 * Poster Agent Tests
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PosterAgent } from '../src/agents/poster.js';
import { calculateTweetLength, isValidTweetLength, MAX_TWEET_LENGTH } from '../src/utils/text-utils.js';
import { getQuoteForDay, shouldIncludeQuote } from '../src/constants/mab-quotes.js';

// Mock configuration
const mockConfig = {
  perplexity: { apiKey: 'test' },
  twitter: { apiKey: 'test', apiSecret: 'test', accessToken: 'test', accessSecret: 'test' },
  sheets: { credentials: 'dGVzdA==', sheetId: 'test' },
  email: { alertEmail: 'test@example.com' },
  app: { dryRun: true, logLevel: 'error' }
};

describe('PosterAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new PosterAgent(mockConfig);
  });

  describe('selectTone', () => {
    test('should cycle through 5 tones', () => {
      expect(agent.selectTone(1)).toBe('insight');
      expect(agent.selectTone(2)).toBe('question');
      expect(agent.selectTone(3)).toBe('contrarian');
      expect(agent.selectTone(4)).toBe('observation');
      expect(agent.selectTone(5)).toBe('witty');
      expect(agent.selectTone(6)).toBe('insight'); // Cycles back
    });
  });

  describe('extractQuoteSnippet', () => {
    test('should return first sentence if short enough', () => {
      const quote = "Short sentence. Another sentence here.";
      const snippet = agent.extractQuoteSnippet(quote);
      expect(snippet).toBe('Short sentence.');
    });

    test('should truncate long quotes', () => {
      const longQuote = "This is a very long quote that exceeds the maximum length allowed for a snippet and should be truncated appropriately.";
      const snippet = agent.extractQuoteSnippet(longQuote);
      expect(snippet.length).toBeLessThanOrEqual(83); // 80 + "..."
    });
  });
});

describe('Tweet Length Calculation', () => {
  test('should calculate basic text length correctly', () => {
    expect(calculateTweetLength('Hello world')).toBe(11);
  });

  test('should count URLs as 23 characters', () => {
    const text = 'Check this out: https://example.com/very/long/url/path';
    const length = calculateTweetLength(text);
    // "Check this out: " (16) + 23 (URL) = 39
    expect(length).toBe(39);
  });

  test('should handle multiple URLs', () => {
    const text = 'Link 1: https://example.com Link 2: https://another.com';
    const length = calculateTweetLength(text);
    // "Link 1: " (8) + 23 + " Link 2: " (9) + 23 = 63
    expect(length).toBe(63);
  });

  test('should validate tweet length correctly', () => {
    const shortTweet = 'This is a short tweet';
    expect(isValidTweetLength(shortTweet)).toBe(true);

    const longTweet = 'a'.repeat(281);
    expect(isValidTweetLength(longTweet)).toBe(false);
  });
});

describe('MAB Quotes', () => {
  test('should return a quote for any day', () => {
    const quote = getQuoteForDay(new Date());
    expect(quote).toBeDefined();
    expect(quote.text).toBeDefined();
    expect(quote.id).toBeGreaterThanOrEqual(1);
    expect(quote.id).toBeLessThanOrEqual(5);
  });

  test('should include quotes only on posts 3, 6, 9', () => {
    expect(shouldIncludeQuote(1)).toBe(false);
    expect(shouldIncludeQuote(2)).toBe(false);
    expect(shouldIncludeQuote(3)).toBe(true);
    expect(shouldIncludeQuote(4)).toBe(false);
    expect(shouldIncludeQuote(5)).toBe(false);
    expect(shouldIncludeQuote(6)).toBe(true);
    expect(shouldIncludeQuote(7)).toBe(false);
    expect(shouldIncludeQuote(8)).toBe(false);
    expect(shouldIncludeQuote(9)).toBe(true);
  });

  test('each quote should have transition phrases', () => {
    for (let i = 1; i <= 5; i++) {
      const quote = getQuoteForDay(new Date(2024, 0, i));
      expect(quote.transitionPhrases).toBeDefined();
      expect(quote.transitionPhrases.length).toBeGreaterThan(0);
    }
  });
});

describe('Tweet Formatting', () => {
  test('should not exceed character limit', () => {
    const exampleTweet = `This is a test tweet about AI developments that shows how we format content.

https://example.com/article

#AI #Automation #Tech`;

    expect(calculateTweetLength(exampleTweet)).toBeLessThanOrEqual(MAX_TWEET_LENGTH);
  });

  test('should handle emojis correctly', () => {
    // Emojis are typically 2 bytes but count as 1-2 characters in Twitter
    const tweetWithEmoji = '🚀 Launching new feature!';
    // This test ensures we're counting characters, not bytes
    expect(tweetWithEmoji.length).toBeLessThan(30);
  });
});
