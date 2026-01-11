#!/usr/bin/env node

/**
 * MAB AI Strategies Twitter SEO Agent
 * Process Analytics CSV Upload
 *
 * Watches for uploaded Twitter analytics CSV files and processes them.
 *
 * Usage: node scripts/process-analytics-csv.js [csv-file-path]
 */

import 'dotenv/config';
import { readFileSync, readdirSync, renameSync, mkdirSync, existsSync, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAnalyticsAgent } from '../src/agents/analytics.js';
import { getConfig } from '../src/utils/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', 'analytics-uploads');
const ARCHIVE_DIR = join(__dirname, '..', 'analytics-archive');

/**
 * Process a single CSV file
 */
async function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  console.log('-'.repeat(40));

  try {
    const csvContent = readFileSync(filePath, 'utf-8');
    console.log(`File size: ${csvContent.length} bytes`);

    const lines = csvContent.split('\n').filter(l => l.trim());
    console.log(`Total rows: ${lines.length}`);

    // Get config and create analytics agent
    const config = getConfig();
    const analytics = createAnalyticsAgent(config);

    // Process the CSV
    const result = await analytics.processAnalyticsCsv(csvContent);

    console.log();
    console.log('Results:');
    console.log(`  Rows processed: ${result.rowsProcessed}`);
    console.log(`  Tweets updated: ${result.tweetsUpdated}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.slice(0, 5).forEach(err => {
        console.log(`  - Tweet ${err.tweetId}: ${err.error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more`);
      }
    }

    // Archive the file
    if (result.success) {
      const fileName = filePath.split('/').pop();
      const archivePath = join(ARCHIVE_DIR, fileName);

      if (!existsSync(ARCHIVE_DIR)) {
        mkdirSync(ARCHIVE_DIR, { recursive: true });
      }

      renameSync(filePath, archivePath);
      console.log(`\n✓ File archived to: ${archivePath}`);
    }

    return result;

  } catch (error) {
    console.error('✗ Processing failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Watch upload directory for new files
 */
function watchForUploads() {
  console.log('='.repeat(60));
  console.log('MAB AI Strategies - Analytics CSV Processor');
  console.log('='.repeat(60));
  console.log();
  console.log(`Watching: ${UPLOAD_DIR}`);
  console.log('Drop Twitter analytics CSV files here to process them.');
  console.log();
  console.log('Press Ctrl+C to stop.');
  console.log();

  // Create upload directory if it doesn't exist
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Process any existing files
  const existingFiles = readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.csv'));
  if (existingFiles.length > 0) {
    console.log(`Found ${existingFiles.length} existing file(s):`);
    existingFiles.forEach(async (file) => {
      await processFile(join(UPLOAD_DIR, file));
    });
  }

  // Watch for new files
  watch(UPLOAD_DIR, async (eventType, filename) => {
    if (eventType === 'rename' && filename && filename.endsWith('.csv')) {
      const filePath = join(UPLOAD_DIR, filename);

      // Wait a moment for file to be fully written
      await new Promise(r => setTimeout(r, 1000));

      if (existsSync(filePath)) {
        console.log(`\nNew file detected: ${filename}`);
        await processFile(filePath);
        console.log('\nWaiting for new files...\n');
      }
    }
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Process specific file
    const filePath = args[0];

    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('MAB AI Strategies - Analytics CSV Processor');
    console.log('='.repeat(60));
    console.log();

    const result = await processFile(filePath);

    console.log();
    console.log('='.repeat(60));
    console.log(result.success ? 'Processing complete!' : 'Processing failed');
    console.log('='.repeat(60));

    process.exit(result.success ? 0 : 1);

  } else {
    // Watch mode
    watchForUploads();
  }
}

main().catch(console.error);
