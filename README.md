# MAB AI Strategies - Twitter SEO Automation Agent

A production-ready, autonomous Twitter content automation system designed for MAB AI Strategies. This agent scrapes AI news, scores articles for engagement potential, generates compelling tweets, and tracks performance - all running on free API tiers with zero monthly costs.

## Overview

This system automates Twitter content creation and posting with four key phases:

1. **Phase 1: News Scraping** (7:30 AM EST) - Scrapes 15-20 AI news articles per category
2. **Phase 2: Filtering & Ranking** - Scores articles on 5 criteria (100-point scale)
3. **Phase 3: Tweet Posting** (9 AM - 5 PM EST) - Posts 9 tweets/day with MAB branding
4. **Phase 4: Analytics** - Tracks engagement metrics and generates AI insights

## Quick Start

```bash
# Clone and install
git clone https://github.com/MABAIStrategies/Twitter-SEO.git
cd Twitter-SEO
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Set up Google Sheets
npm run setup:sheets

# Test connections
npm run test:perplexity
npm run test:newsapi
npm run test:twitter

# Deploy to Cloudflare
npm run deploy
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Scraper  │→ │ Filter   │→ │ Poster   │→ │Analytics │        │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       ▼             ▼             ▼             ▼               │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                 Google Sheets                        │       │
│  │  (Scrape logs, Headlines, Posted Tweets, Metrics)   │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
    ┌─────────┐         ┌─────────┐          ┌──────────┐
    │Perplexity│         │ Twitter │          │Dashboard │
    │+ NewsAPI │         │  API v2 │          │(Pages)   │
    └─────────┘         └─────────┘          └──────────┘
```

## Features

### Content Categories
1. **AI News from Major Providers** - Google, OpenAI, Anthropic announcements
2. **Business AI & Automation** - Mid-market AI adoption and ROI
3. **AI Safety & Regulation** - Policy, ethics, and governance

### Scoring Algorithm (100 points total)
| Factor | Points | Criteria |
|--------|--------|----------|
| Recency | 20 | 0-6h: 20pts, 6-12h: 15pts, 12-18h: 10pts, 18-24h: 5pts |
| Source Authority | 25 | Tier 1-5 ranking (TechCrunch=25, Forbes=15, etc.) |
| Engagement Potential | 25 | AI-scored controversy, business value, novelty |
| Virality Indicators | 20 | Statistics, questions, major companies, breaking news |
| SEO Value | 10 | B2B keywords, AI strategy terms |

### MAB Brand Integration
Every 3rd post (posts #3, #6, #9) includes one of 5 rotating brand messages:

> "The future isn't automated. It's agentic. With MAB AI Strategies, stop building tools and start building intelligence."

## Setup Guide

### 1. Prerequisites

- Node.js 18+
- Cloudflare account (free tier)
- Twitter Developer account with Elevated access
- Google Cloud account
- Perplexity API account
- NewsAPI account (free tier)

### 2. Get API Keys

#### Perplexity API (Primary News Source)
1. Go to https://www.perplexity.ai/settings/api
2. Create an API key
3. Cost: ~$0.015/day = $0.45/month for 3 searches

#### NewsAPI (Backup Source)
1. Register at https://newsapi.org/register
2. Get your free API key
3. Free tier: 100 requests/day (we use ~10)

#### Twitter API v2
1. Apply at https://developer.twitter.com
2. Request Elevated access (required for posting)
3. Create a project and app
4. Enable OAuth 1.0a with Read and Write
5. Generate Consumer Keys and Access Tokens

#### Google Sheets API
1. Create project at https://console.cloud.google.com
2. Enable Google Sheets API
3. Create a Service Account
4. Download JSON key
5. Base64 encode: `base64 -i service-account.json | tr -d '\n'`
6. Create a Google Sheet and share it with the service account email

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PERPLEXITY_API_KEY=pplx-xxx
NEWSAPI_KEY=xxx
TWITTER_API_KEY=xxx
TWITTER_API_SECRET=xxx
TWITTER_ACCESS_TOKEN=xxx
TWITTER_ACCESS_SECRET=xxx
GOOGLE_SHEETS_CREDENTIALS=<base64-encoded-json>
GOOGLE_SHEET_ID=<your-sheet-id>
ALERT_EMAIL=your@email.com
DRY_RUN=true
```

### 4. Set Up Google Sheets

```bash
npm run setup:sheets
```

This creates all required tabs:
- `Posted_Tweets` - Successfully posted tweets
- `Post_Performance` - Engagement metrics
- `Posting_Queue` - Scheduled posts
- `Error_Log` - Error tracking
- `AI_Insights` - Weekly AI recommendations
- `Analytics_Import_Log` - CSV import history

Plus daily tabs: `Scrape_YYYY-MM-DD`, `Headlines_YYYY-MM-DD`

### 5. Test Connections

```bash
# Test each API
npm run test:perplexity
npm run test:newsapi
npm run test:twitter
```

### 6. Deploy to Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Set secrets
wrangler secret put PERPLEXITY_API_KEY
wrangler secret put NEWSAPI_KEY
wrangler secret put TWITTER_API_KEY
wrangler secret put TWITTER_API_SECRET
wrangler secret put TWITTER_ACCESS_TOKEN
wrangler secret put TWITTER_ACCESS_SECRET
wrangler secret put GOOGLE_SHEETS_CREDENTIALS
wrangler secret put GOOGLE_SHEET_ID
wrangler secret put ALERT_EMAIL

# Deploy
npm run deploy
```

### 7. Deploy Dashboard (Optional)

```bash
npm run deploy:dashboard
```

Access at: `https://mab-twitter-dashboard.pages.dev`

## Daily Schedule

All times in Eastern Time (EST/EDT):

| Time | Action |
|------|--------|
| 7:30 AM | Scrape news articles from all 3 categories |
| 7:35 AM | Score and rank articles, create posting queue |
| 9:00 AM | Post #1 - AI Providers, Rank 1 |
| 10:00 AM | Post #2 - Business AI, Rank 1 |
| 11:00 AM | Post #3 - AI Safety, Rank 1 + MAB Quote |
| 12:00 PM | Post #4 - AI Providers, Rank 2 |
| 1:00 PM | Post #5 - Business AI, Rank 2 |
| 2:00 PM | Post #6 - AI Safety, Rank 2 + MAB Quote |
| 3:00 PM | Post #7 - AI Providers, Rank 3 |
| 4:00 PM | Post #8 - Business AI, Rank 3 |
| 5:00 PM | Post #9 - AI Safety, Rank 3 + MAB Quote |

## Weekly Tasks

### Analytics CSV Upload (Sunday)
1. Go to https://analytics.twitter.com
2. Export last 7 days as CSV
3. Upload to `/analytics-uploads/` directory
4. System auto-processes and updates metrics

### AI Insights Generation (Monday 6 AM)
- Automatically analyzes 30-day performance
- Generates actionable recommendations
- Saves to Google Sheets and sends email

## Project Structure

```
twitter-seo-agent/
├── src/
│   ├── index.js              # Main Worker entry point
│   ├── agents/
│   │   ├── scraper.js        # Phase 1: News scraping
│   │   ├── filter.js         # Phase 2: Scoring & ranking
│   │   ├── poster.js         # Phase 3: Tweet creation
│   │   └── analytics.js      # Phase 4: Metrics tracking
│   ├── services/
│   │   ├── perplexity.js     # Perplexity API client
│   │   ├── newsapi.js        # NewsAPI client
│   │   ├── twitter.js        # Twitter API v2 client
│   │   ├── sheets.js         # Google Sheets client
│   │   ├── scheduler.js      # Posting queue manager
│   │   └── email.js          # Email notifications
│   ├── utils/
│   │   ├── config.js         # Configuration management
│   │   ├── logger.js         # Logging utility
│   │   ├── date-utils.js     # Timezone handling
│   │   ├── text-utils.js     # Tweet formatting
│   │   └── validator.js      # Data validation
│   └── constants/
│       ├── categories.js     # News categories
│       ├── mab-quotes.js     # Brand messages
│       ├── brand-colors.js   # Visual identity
│       └── posting-schedule.js
├── dashboard/                # Analytics dashboard (HTML/JS)
├── scripts/                  # Utility scripts
├── tests/                    # Test files
├── package.json
├── wrangler.toml            # Cloudflare config
└── .env.example
```

## API Endpoints

Once deployed, your worker exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and config validation |
| `/status` | GET | Today's scraping and posting status |
| `/trigger/scrape` | GET | Manually trigger scraping |
| `/trigger/post` | GET | Manually trigger current post |
| `/trigger/metrics` | GET | Collect tweet metrics |
| `/trigger/insights` | GET | Generate weekly insights |
| `/upload/csv` | POST | Upload analytics CSV |
| `/test/sheets` | GET | Test Sheets connection |
| `/test/twitter` | GET | Test Twitter connection |

## Error Handling

The system includes comprehensive error handling:

1. **API Failures**: Perplexity → NewsAPI fallback → Previous day's articles
2. **Retry Logic**: 2 retries with 5-minute delays
3. **Error Logging**: All errors logged to Google Sheets
4. **Email Alerts**: Critical failures trigger email notifications

## Troubleshooting

### "Perplexity API error: 401"
- Verify your API key is correct
- Check API key hasn't expired

### "Twitter API error: 403"
- Ensure app has Read and Write permissions
- Verify OAuth 1.0a is enabled
- Check for suspended/restricted account

### "Google Sheets error"
- Verify service account has Editor access to the sheet
- Check base64 encoding of credentials
- Ensure Sheet ID is correct

### Posts not appearing on schedule
- Check Cloudflare cron triggers are active
- Verify timezone calculations (EST vs UTC)
- Review Error_Log sheet for issues

## Cost Analysis

| Service | Usage | Cost |
|---------|-------|------|
| Cloudflare Workers | ~270 requests/month | Free (100K/month included) |
| Perplexity API | 3 searches/day × 22 days | ~$0.45/month |
| NewsAPI | Backup only (~10/day) | Free (100/day limit) |
| Twitter API | 9 posts + metrics/day | Free (Basic tier) |
| Google Sheets API | Read/write operations | Free |
| **Total** | | **~$0.50/month** |

## Security Considerations

- Never commit `.env` or credentials
- Use Cloudflare Secrets for production
- Validate all external data
- Rate limit awareness for all APIs
- Monitor Error_Log for anomalies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

## License

MIT License - See LICENSE file for details.

## Support

- Issues: https://github.com/MABAIStrategies/Twitter-SEO/issues
- Email: support@mabaistrategies.com

---

Built with precision for MAB AI Strategies - The future isn't automated, it's agentic.
