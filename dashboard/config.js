/**
 * MAB AI Strategies Twitter Dashboard
 * Configuration
 */

const CONFIG = {
  // Google Sheets Configuration
  // To use Google Sheets API:
  // 1. Create a Google Cloud Project
  // 2. Enable Google Sheets API
  // 3. Create an API Key (restrict to Sheets API)
  // 4. Make your Google Sheet publicly readable (View only)
  sheets: {
    apiKey: '', // Your Google Sheets API key
    sheetId: '', // Your Google Sheet ID
    refreshInterval: 5 * 60 * 1000 // 5 minutes in milliseconds
  },

  // Worker API Configuration (for direct API calls)
  api: {
    baseUrl: '', // Your Cloudflare Worker URL, e.g., 'https://mab-twitter-seo-agent.your-subdomain.workers.dev'
    endpoints: {
      health: '/health',
      status: '/status',
      triggerScrape: '/trigger/scrape',
      triggerPost: '/trigger/post',
      triggerMetrics: '/trigger/metrics'
    }
  },

  // Dashboard Settings
  dashboard: {
    // Date range for data display
    defaultDays: 30,

    // Chart colors matching MAB brand
    colors: {
      primary: '#D4AF37',     // Champagne
      secondary: '#1A4B7A',   // Ocean accent
      background: '#1E3A5F',  // Deep blue
      text: '#F5F5DC',        // Cream
      success: '#22C55E',
      warning: '#F59E0B',
      error: '#EF4444'
    },

    // Time format
    timezone: 'America/New_York',
    timeFormat: '12h' // '12h' or '24h'
  },

  // Sheet tab names (must match your Google Sheet)
  sheetNames: {
    postedTweets: 'Posted_Tweets',
    postPerformance: 'Post_Performance',
    aiInsights: 'AI_Insights',
    errorLog: 'Error_Log'
  },

  // Demo mode (uses sample data instead of real API)
  demoMode: true
};

// Demo data for testing without API
const DEMO_DATA = {
  stats: {
    totalPosts: 279,
    avgEngagement: 48.5,
    bestTime: '11:00 AM',
    topCategory: 'AI Safety',
    trends: {
      posts: '+12%',
      engagement: '+0.3%',
      categoryPercentage: '38%'
    }
  },

  engagementTimeline: {
    labels: Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 20)
  },

  categoryPerformance: {
    labels: ['AI Providers', 'Business AI', 'AI Safety'],
    data: [52, 41, 55],
    counts: [93, 93, 93]
  },

  heatmapData: {
    '9': [45, 52, 48, 41, 38],
    '10': [51, 49, 58, 55, 47],
    '11': [62, 65, 68, 58, 52],
    '12': [48, 45, 42, 38, 35],
    '13': [52, 55, 51, 48, 42],
    '14': [58, 52, 55, 51, 45],
    '15': [45, 48, 45, 42, 38],
    '16': [42, 45, 48, 45, 38],
    '17': [38, 42, 45, 41, 35]
  },

  hashtagPerformance: [
    { tag: '#AI', avgEngagement: 58.2, uses: 145, trend: 'up' },
    { tag: '#ArtificialIntelligence', avgEngagement: 52.1, uses: 89, trend: 'up' },
    { tag: '#MachineLearning', avgEngagement: 49.8, uses: 67, trend: 'neutral' },
    { tag: '#AISafety', avgEngagement: 61.3, uses: 54, trend: 'up' },
    { tag: '#Automation', avgEngagement: 45.2, uses: 48, trend: 'down' },
    { tag: '#AIEthics', avgEngagement: 55.7, uses: 42, trend: 'up' },
    { tag: '#DigitalTransformation', avgEngagement: 41.8, uses: 38, trend: 'neutral' },
    { tag: '#TechNews', avgEngagement: 38.5, uses: 35, trend: 'down' },
    { tag: '#B2B', avgEngagement: 44.1, uses: 32, trend: 'neutral' },
    { tag: '#AIStrategy', avgEngagement: 67.2, uses: 27, trend: 'up' }
  ],

  topPosts: [
    {
      text: "Everyone's talking about the speed. I'm more interested in the direction. This partnership shows exactly what I mean when I say...",
      category: 'AI Providers',
      engagement: 82,
      clicks: 156,
      ctr: '2.4%'
    },
    {
      text: "Hot take: This isn't actually about the technology. The real story here is about operational efficiency...",
      category: 'Business AI',
      engagement: 79,
      clicks: 142,
      ctr: '2.1%'
    },
    {
      text: "If you're not uncomfortable with how fast this is moving, you're not paying attention. The regulatory implications are...",
      category: 'AI Safety',
      engagement: 71,
      clicks: 128,
      ctr: '1.9%'
    },
    {
      text: "The question isn't if AI can do a task anymore. The real question: Can your human team keep up with your agents?",
      category: 'AI Providers',
      engagement: 68,
      clicks: 115,
      ctr: '1.8%'
    },
    {
      text: "Worth watching: Mid-market businesses are seeing 3x ROI on automation investments. Here's why...",
      category: 'Business AI',
      engagement: 65,
      clicks: 108,
      ctr: '1.7%'
    }
  ],

  insights: {
    doubleDown: [
      'AI Safety posts getting 35% more engagement than average',
      '11 AM posts consistently outperform (try 10-12 AM window)',
      'Posts with statistics/numbers: +42% engagement'
    ],
    pivot: [
      'Friday afternoon posts underperforming (-28%)',
      'Hashtag #Innovation showing saturation',
      'Consider #AIEthics as replacement'
    ],
    focus: [
      'Cover: Anthropic\'s new model announcement (trending)',
      'Angle: Mid-market implications (underserved topic)',
      'Test: Posting at 10:30 AM instead of 11 AM'
    ]
  }
};

// Export for use in other files
window.CONFIG = CONFIG;
window.DEMO_DATA = DEMO_DATA;
