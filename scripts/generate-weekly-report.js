#!/usr/bin/env node

/**
 * MAB AI Strategies Twitter SEO Agent
 * Weekly Report Generator
 *
 * Generates AI-powered insights from the past week's performance.
 *
 * Usage: node scripts/generate-weekly-report.js
 */

import 'dotenv/config';
import { createAnalyticsAgent } from '../src/agents/analytics.js';
import { getConfig } from '../src/utils/config.js';

async function main() {
  console.log('='.repeat(60));
  console.log('MAB AI Strategies - Weekly Report Generator');
  console.log('='.repeat(60));
  console.log();

  const config = getConfig();

  // Check required config
  if (!config.sheets.credentials || !config.sheets.sheetId) {
    console.error('ERROR: Google Sheets not configured');
    console.log('Please set GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID');
    process.exit(1);
  }

  console.log('Generating weekly insights...');
  console.log('-'.repeat(40));
  console.log();

  const analytics = createAnalyticsAgent(config);

  try {
    const result = await analytics.generateWeeklyInsights();

    if (!result.success) {
      console.error('✗ Failed to generate insights:', result.error);
      process.exit(1);
    }

    const { insights } = result;

    console.log('📊 WEEKLY PERFORMANCE SUMMARY');
    console.log('='.repeat(40));
    console.log();

    if (insights.summary) {
      console.log(insights.summary);
      console.log();
    }

    if (insights.metrics) {
      console.log('Key Metrics:');
      console.log(`  • Total Posts: ${insights.metrics.totalPosts || 'N/A'}`);
      console.log(`  • Avg Engagement: ${insights.metrics.avgEngagement || 'N/A'}`);
      console.log(`  • Best Time: ${insights.metrics.bestTime || 'N/A'}`);
      console.log(`  • Top Category: ${insights.metrics.topCategory || 'N/A'}`);
      console.log();
    }

    console.log('📈 DOUBLE DOWN (What\'s Working):');
    console.log('-'.repeat(40));
    if (insights.doubleDown?.length > 0) {
      insights.doubleDown.forEach(item => console.log(`  • ${item}`));
    } else {
      console.log('  • No specific recommendations');
    }
    console.log();

    console.log('🔄 PIVOT (What to Change):');
    console.log('-'.repeat(40));
    if (insights.pivot?.length > 0) {
      insights.pivot.forEach(item => console.log(`  • ${item}`));
    } else {
      console.log('  • No specific recommendations');
    }
    console.log();

    console.log('🎯 THIS WEEK\'S FOCUS:');
    console.log('-'.repeat(40));
    if (insights.focus?.length > 0) {
      insights.focus.forEach(item => console.log(`  • ${item}`));
    } else {
      console.log('  • No specific recommendations');
    }
    console.log();

    console.log('='.repeat(60));
    console.log('Report saved to Google Sheets: AI_Insights tab');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('✗ Error generating report:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
