/**
 * MAB AI Strategies Twitter Dashboard
 * Main Application
 */

class Dashboard {
  constructor() {
    this.charts = {};
    this.data = null;
    this.refreshInterval = null;
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    console.log('Initializing MAB AI Strategies Dashboard...');

    try {
      // Load initial data
      await this.loadData();

      // Render all components
      this.renderStats();
      this.renderEngagementChart();
      this.renderCategoryChart();
      this.renderHeatmap();
      this.renderHashtagTable();
      this.renderTopPosts();
      this.renderInsights();

      // Set up event listeners
      this.setupEventListeners();

      // Start auto-refresh
      this.startAutoRefresh();

      // Update timestamp
      this.updateTimestamp();

      console.log('Dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      utils.showError('Failed to load dashboard data');
    } finally {
      utils.hideLoading();
    }
  }

  /**
   * Load data from API or demo
   */
  async loadData() {
    utils.showLoading();

    if (CONFIG.demoMode) {
      // Use demo data
      this.data = DEMO_DATA;
      return;
    }

    // Fetch from Google Sheets API
    try {
      const sheetsData = await this.fetchFromSheets();
      this.data = this.processSheetData(sheetsData);
    } catch (error) {
      console.warn('Failed to fetch from Sheets, using demo data:', error);
      this.data = DEMO_DATA;
    }
  }

  /**
   * Fetch data from Google Sheets
   */
  async fetchFromSheets() {
    const { apiKey, sheetId } = CONFIG.sheets;

    if (!apiKey || !sheetId) {
      throw new Error('Google Sheets API not configured');
    }

    const ranges = [
      CONFIG.sheetNames.postedTweets,
      CONFIG.sheetNames.postPerformance,
      CONFIG.sheetNames.aiInsights
    ].map(name => encodeURIComponent(name));

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${apiKey}`;

    const response = await utils.fetchWithRetry(url);
    return response.json();
  }

  /**
   * Process raw sheet data into dashboard format
   */
  processSheetData(sheetsData) {
    // This would transform the raw Google Sheets data
    // into the format expected by the dashboard
    // For now, return demo data structure
    return DEMO_DATA;
  }

  /**
   * Render stats cards
   */
  renderStats() {
    const { stats } = this.data;

    document.getElementById('total-posts').textContent = utils.formatNumber(stats.totalPosts);
    document.getElementById('avg-engagement').textContent = stats.avgEngagement.toFixed(1);
    document.getElementById('best-time').textContent = stats.bestTime;
    document.getElementById('top-category').textContent = stats.topCategory;

    // Trends
    document.getElementById('posts-trend').textContent = stats.trends.posts;
    document.getElementById('posts-trend').className = stats.trends.posts.startsWith('+') ? 'text-green-400 text-xs' : 'text-red-400 text-xs';

    document.getElementById('engagement-trend').textContent = stats.trends.engagement;
    document.getElementById('engagement-trend').className = stats.trends.engagement.startsWith('+') ? 'text-green-400 text-xs' : 'text-red-400 text-xs';

    document.getElementById('category-percentage').textContent = stats.trends.categoryPercentage;
  }

  /**
   * Render engagement over time chart
   */
  renderEngagementChart() {
    const ctx = document.getElementById('engagement-chart').getContext('2d');

    if (this.charts.engagement) {
      this.charts.engagement.destroy();
    }

    const { labels, data } = this.data.engagementTimeline;

    this.charts.engagement = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Engagement',
          data,
          borderColor: CONFIG.dashboard.colors.primary,
          backgroundColor: `${CONFIG.dashboard.colors.primary}20`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: CONFIG.dashboard.colors.primary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: CONFIG.dashboard.colors.background,
            titleColor: CONFIG.dashboard.colors.text,
            bodyColor: CONFIG.dashboard.colors.text,
            borderColor: CONFIG.dashboard.colors.primary,
            borderWidth: 1,
            padding: 12,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: {
              color: `${CONFIG.dashboard.colors.primary}10`
            },
            ticks: {
              color: CONFIG.dashboard.colors.text,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7
            }
          },
          y: {
            grid: {
              color: `${CONFIG.dashboard.colors.primary}10`
            },
            ticks: {
              color: CONFIG.dashboard.colors.text
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  /**
   * Render category performance chart
   */
  renderCategoryChart() {
    const ctx = document.getElementById('category-chart').getContext('2d');

    if (this.charts.category) {
      this.charts.category.destroy();
    }

    const { labels, data } = this.data.categoryPerformance;

    this.charts.category = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Avg Engagement',
          data,
          backgroundColor: [
            CONFIG.dashboard.colors.primary,
            CONFIG.dashboard.colors.secondary,
            CONFIG.dashboard.colors.success
          ],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: CONFIG.dashboard.colors.background,
            titleColor: CONFIG.dashboard.colors.text,
            bodyColor: CONFIG.dashboard.colors.text,
            borderColor: CONFIG.dashboard.colors.primary,
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: CONFIG.dashboard.colors.text
            }
          },
          y: {
            grid: {
              color: `${CONFIG.dashboard.colors.primary}10`
            },
            ticks: {
              color: CONFIG.dashboard.colors.text
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  /**
   * Render posting times heatmap
   */
  renderHeatmap() {
    const heatmapBody = document.getElementById('heatmap-body');
    const { heatmapData } = this.data;

    // Find max value for scaling
    let maxValue = 0;
    Object.values(heatmapData).forEach(row => {
      row.forEach(val => {
        if (val > maxValue) maxValue = val;
      });
    });

    let html = '';
    const hours = ['9', '10', '11', '12', '13', '14', '15', '16', '17'];

    hours.forEach(hour => {
      const row = heatmapData[hour] || [0, 0, 0, 0, 0];
      html += `
        <tr>
          <td class="text-cream/70 pr-4">${utils.formatTime(parseInt(hour))}</td>
          ${row.map(val => `
            <td class="text-center p-1">
              <div class="heatmap-cell ${utils.getHeatmapClass(val, maxValue)} mx-auto flex items-center justify-center text-xs font-medium">
                ${val}
              </div>
            </td>
          `).join('')}
        </tr>
      `;
    });

    heatmapBody.innerHTML = html;
  }

  /**
   * Render hashtag performance table
   */
  renderHashtagTable() {
    const hashtagBody = document.getElementById('hashtag-body');
    const { hashtagPerformance } = this.data;

    let html = '';

    hashtagPerformance.forEach(hashtag => {
      html += `
        <tr>
          <td class="text-champagne">${hashtag.tag}</td>
          <td class="text-right">${hashtag.avgEngagement.toFixed(1)}</td>
          <td class="text-right">${hashtag.uses}</td>
          <td class="text-center ${utils.getTrendClass(hashtag.trend)}">${utils.getTrendArrow(hashtag.trend)}</td>
        </tr>
      `;
    });

    hashtagBody.innerHTML = html;
  }

  /**
   * Render top posts table
   */
  renderTopPosts() {
    const topPostsBody = document.getElementById('top-posts-body');
    const { topPosts } = this.data;

    let html = '';

    topPosts.forEach((post, index) => {
      html += `
        <tr>
          <td class="text-champagne font-medium">${index + 1}</td>
          <td class="max-w-md">
            <p class="text-cream/90">"${utils.truncateText(post.text, 80)}"</p>
          </td>
          <td class="text-cream/70">${post.category}</td>
          <td class="text-right text-champagne font-medium">${post.engagement}</td>
          <td class="text-right">${post.clicks}</td>
          <td class="text-right text-green-400">${post.ctr}</td>
        </tr>
      `;
    });

    topPostsBody.innerHTML = html;
  }

  /**
   * Render AI insights
   */
  renderInsights() {
    const { insights } = this.data;

    // Double Down
    const doubleDownList = document.getElementById('double-down-list');
    doubleDownList.innerHTML = insights.doubleDown
      .map(item => `<li class="text-cream/80">• ${item}</li>`)
      .join('');

    // Pivot
    const pivotList = document.getElementById('pivot-list');
    pivotList.innerHTML = insights.pivot
      .map(item => `<li class="text-cream/80">• ${item}</li>`)
      .join('');

    // Focus
    const focusList = document.getElementById('focus-list');
    focusList.innerHTML = insights.focus
      .map(item => `<li class="text-cream/80">• ${item}</li>`)
      .join('');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refresh();
    });

    // Sort select
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.sortTopPosts(e.target.value);
    });
  }

  /**
   * Sort top posts
   * @param {string} sortBy
   */
  sortTopPosts(sortBy) {
    const sorted = [...this.data.topPosts].sort((a, b) => {
      switch (sortBy) {
        case 'engagement':
          return b.engagement - a.engagement;
        case 'likes':
          return b.engagement - a.engagement; // Using engagement as proxy
        case 'retweets':
          return b.engagement - a.engagement;
        case 'date':
          return 0; // Would sort by date if available
        default:
          return 0;
      }
    });

    this.data.topPosts = sorted;
    this.renderTopPosts();
  }

  /**
   * Refresh dashboard data
   */
  async refresh() {
    try {
      await this.loadData();
      this.renderStats();
      this.renderEngagementChart();
      this.renderCategoryChart();
      this.renderHeatmap();
      this.renderHashtagTable();
      this.renderTopPosts();
      this.renderInsights();
      this.updateTimestamp();
    } catch (error) {
      console.error('Refresh failed:', error);
      utils.showError('Failed to refresh data');
    } finally {
      utils.hideLoading();
    }
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, CONFIG.sheets.refreshInterval);
  }

  /**
   * Update last updated timestamp
   */
  updateTimestamp() {
    const el = document.getElementById('last-updated');
    el.textContent = `Last updated: ${utils.formatDate(new Date(), { includeTime: true })}`;
  }

  /**
   * Destroy the dashboard (cleanup)
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
  window.dashboard.init();
});
