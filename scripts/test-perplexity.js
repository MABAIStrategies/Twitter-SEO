#!/usr/bin/env node

/**
 * MAB AI Strategies Twitter SEO Agent
 * Perplexity API Connection Test
 *
 * Usage: node scripts/test-perplexity.js
 */

import 'dotenv/config';
import { createPerplexityService } from '../src/services/perplexity.js';
import { getConfig } from '../src/utils/config.js';
import { CATEGORIES } from '../src/constants/categories.js';

async function main() {
  console.log('='.repeat(60));
  console.log('MAB AI Strategies - Perplexity API Test');
  console.log('='.repeat(60));
  console.log();

  // Get configuration
  const config = getConfig();

  if (!config.perplexity.apiKey) {
    console.error('ERROR: PERPLEXITY_API_KEY not found in environment');
    console.log('\nPlease set your Perplexity API key:');
    console.log('  export PERPLEXITY_API_KEY=your-api-key');
    console.log('\nOr add it to your .env file');
    process.exit(1);
  }

  console.log('API Key: ' + config.perplexity.apiKey.substring(0, 10) + '...');
  console.log('Endpoint: ' + config.perplexity.endpoint);
  console.log('Model: ' + config.perplexity.model);
  console.log();

  // Create service
  const perplexity = createPerplexityService(config);

  // Test 1: Basic connection
  console.log('Test 1: Basic Connection');
  console.log('-'.repeat(40));

  try {
    const connected = await perplexity.testConnection();
    if (connected) {
      console.log('✓ Connection successful');
    } else {
      console.log('✗ Connection failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('✗ Connection error:', error.message);
    process.exit(1);
  }

  console.log();

  // Test 2: News search
  console.log('Test 2: News Search');
  console.log('-'.repeat(40));

  const testCategory = CATEGORIES[0]; // AI Providers
  console.log(`Searching for: ${testCategory.name}`);
  console.log();

  try {
    const articles = await perplexity.searchNews(testCategory.description);

    console.log(`Found ${articles.length} articles:`);
    console.log();

    articles.slice(0, 5).forEach((article, index) => {
      console.log(`${index + 1}. ${article.headline}`);
      console.log(`   Source: ${article.source}`);
      console.log(`   URL: ${article.url?.substring(0, 50)}...`);
      console.log();
    });

    if (articles.length >= 10) {
      console.log('✓ Search returned sufficient articles');
    } else {
      console.log(`⚠ Search returned only ${articles.length} articles (target: 15)`);
    }

  } catch (error) {
    console.log('✗ Search failed:', error.message);
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('All tests passed!');
  console.log('='.repeat(60));
}

main().catch(console.error);
