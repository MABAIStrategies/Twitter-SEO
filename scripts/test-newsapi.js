#!/usr/bin/env node

/**
 * MAB AI Strategies Twitter SEO Agent
 * NewsAPI Connection Test
 *
 * Usage: node scripts/test-newsapi.js
 */

import 'dotenv/config';
import { createNewsApiService } from '../src/services/newsapi.js';
import { getConfig } from '../src/utils/config.js';
import { CATEGORIES } from '../src/constants/categories.js';

async function main() {
  console.log('='.repeat(60));
  console.log('MAB AI Strategies - NewsAPI Test');
  console.log('='.repeat(60));
  console.log();

  // Get configuration
  const config = getConfig();

  if (!config.newsapi.apiKey) {
    console.error('ERROR: NEWSAPI_KEY not found in environment');
    console.log('\nPlease set your NewsAPI key:');
    console.log('  export NEWSAPI_KEY=your-api-key');
    console.log('\nGet a free API key at: https://newsapi.org/register');
    process.exit(1);
  }

  console.log('API Key: ' + config.newsapi.apiKey.substring(0, 10) + '...');
  console.log('Endpoint: ' + config.newsapi.endpoint);
  console.log('Daily limit: ' + config.newsapi.maxRequestsPerDay + ' requests');
  console.log();

  // Create service
  const newsapi = createNewsApiService(config);

  // Test 1: Basic connection
  console.log('Test 1: Basic Connection');
  console.log('-'.repeat(40));

  try {
    const connected = await newsapi.testConnection();
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

  // Test 2: News search for each category
  console.log('Test 2: Category Searches');
  console.log('-'.repeat(40));

  for (const category of CATEGORIES) {
    console.log(`\nSearching: ${category.name}`);

    try {
      const articles = await newsapi.searchNews(category.id);

      console.log(`  Found ${articles.length} articles`);

      if (articles.length > 0) {
        console.log(`  Sample: ${articles[0].headline?.substring(0, 60)}...`);
      }

    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
  }

  console.log();
  console.log(`Remaining requests today: ${newsapi.getRemainingRequests()}`);

  console.log();
  console.log('='.repeat(60));
  console.log('NewsAPI test complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
