#!/usr/bin/env node

/**
 * MAB AI Strategies Twitter SEO Agent
 * Twitter API Connection Test (Dry Run)
 *
 * Usage: node scripts/test-twitter.js
 */

import 'dotenv/config';
import { createTwitterService } from '../src/services/twitter.js';
import { getConfig } from '../src/utils/config.js';

async function main() {
  console.log('='.repeat(60));
  console.log('MAB AI Strategies - Twitter API Test');
  console.log('='.repeat(60));
  console.log();

  // Get configuration
  const config = getConfig();

  const missing = [];
  if (!config.twitter.apiKey) missing.push('TWITTER_API_KEY');
  if (!config.twitter.apiSecret) missing.push('TWITTER_API_SECRET');
  if (!config.twitter.accessToken) missing.push('TWITTER_ACCESS_TOKEN');
  if (!config.twitter.accessSecret) missing.push('TWITTER_ACCESS_SECRET');

  if (missing.length > 0) {
    console.error('ERROR: Missing Twitter credentials:');
    missing.forEach(key => console.log(`  - ${key}`));
    console.log('\nPlease set these environment variables or add them to .env');
    console.log('\nGet credentials at: https://developer.twitter.com/en/portal/dashboard');
    process.exit(1);
  }

  console.log('API Key: ' + config.twitter.apiKey.substring(0, 10) + '...');
  console.log('Access Token: ' + config.twitter.accessToken.substring(0, 10) + '...');
  console.log();

  // Create service
  const twitter = createTwitterService(config);

  // Test 1: Authentication
  console.log('Test 1: Authentication');
  console.log('-'.repeat(40));

  try {
    const connected = await twitter.testConnection();
    if (connected) {
      console.log('✓ Successfully authenticated with Twitter');
    } else {
      console.log('✗ Authentication failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('✗ Authentication error:', error.message);
    console.log('\nCommon issues:');
    console.log('  - Incorrect API keys');
    console.log('  - App not approved for User Authentication');
    console.log('  - Missing Read and Write permissions');
    process.exit(1);
  }

  console.log();

  // Test 2: Get user info
  console.log('Test 2: User Information');
  console.log('-'.repeat(40));

  try {
    const user = await twitter.getUserInfo();
    console.log(`Username: @${user.username}`);
    console.log(`Name: ${user.name}`);
    console.log(`Followers: ${user.public_metrics?.followers_count || 'N/A'}`);
    console.log(`Following: ${user.public_metrics?.following_count || 'N/A'}`);
    console.log('✓ User info retrieved successfully');
  } catch (error) {
    console.log('⚠ Could not get user info:', error.message);
  }

  console.log();

  // Test 3: Get recent tweets
  console.log('Test 3: Recent Tweets');
  console.log('-'.repeat(40));

  try {
    const tweets = await twitter.getRecentTweets(5);
    console.log(`Found ${tweets.length} recent tweets`);

    if (tweets.length > 0) {
      console.log('\nMost recent:');
      console.log(`  "${tweets[0].text?.substring(0, 60)}..."`);
    }

    console.log('✓ Tweet retrieval successful');
  } catch (error) {
    console.log('⚠ Could not get recent tweets:', error.message);
  }

  console.log();

  // Test 4: Dry run tweet (don't actually post)
  console.log('Test 4: Tweet Validation (Dry Run)');
  console.log('-'.repeat(40));

  const testTweet = `Test tweet from MAB AI Strategies Twitter Agent

This is a dry run - not actually posted.

#AI #Automation`;

  const { calculateTweetLength, isValidTweetLength } = await import('../src/utils/text-utils.js');

  console.log(`Tweet length: ${calculateTweetLength(testTweet)} characters`);
  console.log(`Valid length: ${isValidTweetLength(testTweet) ? 'Yes' : 'No'}`);
  console.log();
  console.log('Sample tweet:');
  console.log('-'.repeat(40));
  console.log(testTweet);
  console.log('-'.repeat(40));

  console.log();
  console.log('NOTE: This test does NOT post to Twitter.');
  console.log('To test actual posting, set DRY_RUN=false in production.');

  console.log();
  console.log('='.repeat(60));
  console.log('Twitter API test complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
