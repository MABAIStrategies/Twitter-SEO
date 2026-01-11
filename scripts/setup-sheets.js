#!/usr/bin/env node

/**
 * MAB AI Strategies Twitter SEO Agent
 * Google Sheets Setup Script
 *
 * Creates all required tabs and headers in the Google Sheet.
 *
 * Usage: node scripts/setup-sheets.js
 */

import 'dotenv/config';
import { createSheetsService, SHEET_NAMES } from '../src/services/sheets.js';
import { getConfig } from '../src/utils/config.js';

/**
 * Sheet configurations with headers
 */
const SHEET_CONFIGS = {
  [SHEET_NAMES.POSTED_TWEETS]: [
    'Posted_At', 'Tweet_ID', 'Text', 'Article_URL', 'Category',
    'Post_Number', 'Include_Quote', 'Hashtags'
  ],

  [SHEET_NAMES.POST_PERFORMANCE]: [
    'Post_Date', 'Post_Time', 'Category', 'Rank', 'Article_URL',
    'Post_Text', 'Tweet_ID', 'Tweet_URL',
    'Likes', 'Retweets', 'Replies', 'Quotes',
    'Impressions', 'Link_Clicks', 'Profile_Visits', 'CTR', 'Engagement_Rate',
    'Collection_Type'
  ],

  [SHEET_NAMES.POSTING_QUEUE]: [
    'Scheduled_Time', 'Post_Number', 'Category', 'Headline', 'URL',
    'Tweet_Text', 'Hashtags', 'Include_Quote', 'Quote_ID', 'Status'
  ],

  [SHEET_NAMES.ERROR_LOG]: [
    'Timestamp', 'Phase', 'Error_Message', 'Stack_Trace', 'Context'
  ],

  [SHEET_NAMES.AI_INSIGHTS]: [
    'Generated_At', 'Summary', 'Double_Down', 'Pivot', 'Focus', 'Metrics'
  ],

  [SHEET_NAMES.ANALYTICS_IMPORT]: [
    'Import_Time', 'Rows_Processed', 'Tweets_Updated', 'Errors', 'Error_Details'
  ]
};

async function main() {
  console.log('='.repeat(60));
  console.log('MAB AI Strategies - Google Sheets Setup');
  console.log('='.repeat(60));
  console.log();

  // Get configuration
  const config = getConfig();

  if (!config.sheets.credentials) {
    console.error('ERROR: GOOGLE_SHEETS_CREDENTIALS not found');
    console.log('\nSetup instructions:');
    console.log('1. Create a Google Cloud Project');
    console.log('2. Enable Google Sheets API');
    console.log('3. Create a Service Account');
    console.log('4. Download the JSON key');
    console.log('5. Base64 encode: base64 -i service-account.json');
    console.log('6. Set GOOGLE_SHEETS_CREDENTIALS=<base64 encoded>');
    process.exit(1);
  }

  if (!config.sheets.sheetId) {
    console.error('ERROR: GOOGLE_SHEET_ID not found');
    console.log('\nSet GOOGLE_SHEET_ID to your Google Sheet ID');
    console.log('(Find it in the URL: docs.google.com/spreadsheets/d/[SHEET_ID]/edit)');
    process.exit(1);
  }

  console.log('Sheet ID: ' + config.sheets.sheetId);
  console.log();

  // Create service
  const sheets = createSheetsService(config);

  // Test connection
  console.log('Testing connection...');
  console.log('-'.repeat(40));

  try {
    const connected = await sheets.testConnection();
    if (connected) {
      console.log('✓ Connected to Google Sheets');
    } else {
      console.log('✗ Connection failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('✗ Connection error:', error.message);
    console.log('\nMake sure you have:');
    console.log('1. Shared the sheet with your service account email');
    console.log('2. Given the service account Editor access');
    process.exit(1);
  }

  console.log();

  // Create sheets
  console.log('Creating sheets and headers...');
  console.log('-'.repeat(40));

  for (const [sheetName, headers] of Object.entries(SHEET_CONFIGS)) {
    try {
      console.log(`\nCreating: ${sheetName}`);

      // Create sheet if it doesn't exist
      await sheets.getOrCreateSheet(sheetName);
      console.log('  ✓ Sheet created/exists');

      // Check if headers exist
      const existing = await sheets.readSheet(sheetName, 'A1:Z1');

      if (existing.length === 0 || !existing[0] || existing[0].length === 0) {
        // Add headers
        await sheets.updateRange(sheetName, 'A1', [headers]);
        console.log('  ✓ Headers added');
      } else {
        console.log('  ✓ Headers already exist');
      }

    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Google Sheets setup complete!');
  console.log('='.repeat(60));
  console.log();
  console.log('Your Google Sheet is ready for the Twitter agent.');
  console.log();
  console.log('Created tabs:');
  Object.keys(SHEET_CONFIGS).forEach(name => {
    console.log(`  - ${name}`);
  });
  console.log();
  console.log('Daily tabs will be created automatically:');
  console.log('  - Scrape_YYYY-MM-DD');
  console.log('  - Headlines_YYYY-MM-DD');
}

main().catch(console.error);
