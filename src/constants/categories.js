/**
 * MAB AI Strategies Twitter SEO Agent
 * News Categories Configuration
 *
 * These categories define the types of AI news we scrape and post about.
 * Each category has specific search queries for both Perplexity and NewsAPI.
 */

/**
 * @typedef {Object} Category
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - Full description for Perplexity queries
 * @property {string[]} newsApiQueries - Backup queries for NewsAPI
 * @property {string[]} keywords - SEO keywords for scoring
 * @property {string[]} hashtags - Preferred hashtags for this category
 */

/** @type {Category[]} */
export const CATEGORIES = [
  {
    id: 'ai-providers',
    name: 'AI News from Major Providers',
    description: 'AI News from Google, OpenAI, Anthropic and other major providers',
    newsApiQueries: [
      '(Google OR OpenAI OR Anthropic OR Microsoft OR Meta) AND "artificial intelligence"',
      '(GPT OR Claude OR Gemini OR "large language model") AND (announcement OR launch OR release)',
      '"AI model" AND (Google OR OpenAI OR Anthropic) AND (new OR latest OR breakthrough)'
    ],
    keywords: [
      'OpenAI', 'Google', 'Anthropic', 'Microsoft', 'Meta', 'GPT', 'Claude',
      'Gemini', 'LLM', 'large language model', 'AI model', 'neural network',
      'machine learning', 'deep learning', 'foundation model'
    ],
    hashtags: ['#AI', '#OpenAI', '#GoogleAI', '#Anthropic', '#MachineLearning', '#LLM']
  },
  {
    id: 'business-ai',
    name: 'Business AI and Automation',
    description: 'Business (mid-markets) AI and Automation',
    newsApiQueries: [
      '"mid-market" AND (AI OR automation OR "artificial intelligence")',
      '("business automation" OR "enterprise AI") AND (implementation OR adoption OR ROI)',
      '"AI strategy" AND (business OR enterprise OR company) AND (success OR growth OR transformation)'
    ],
    keywords: [
      'mid-market', 'enterprise', 'business automation', 'digital transformation',
      'ROI', 'efficiency', 'productivity', 'workflow', 'operations', 'AI adoption',
      'AI implementation', 'AI strategy', 'business intelligence'
    ],
    hashtags: ['#AI', '#Automation', '#DigitalTransformation', '#B2B', '#EnterpriseAI', '#BusinessAutomation']
  },
  {
    id: 'ai-safety',
    name: 'AI Safety and Regulation',
    description: 'AI Safety and Regulation',
    newsApiQueries: [
      '"AI safety" OR "AI regulation" OR "AI ethics"',
      '("artificial intelligence" AND (regulation OR policy OR governance OR law))',
      '("AI risk" OR "AI alignment" OR "responsible AI") AND (government OR legislation OR compliance)'
    ],
    keywords: [
      'AI safety', 'AI regulation', 'AI ethics', 'AI governance', 'AI policy',
      'responsible AI', 'AI risk', 'AI alignment', 'AI legislation', 'AI compliance',
      'AI standards', 'AI transparency', 'AI accountability'
    ],
    hashtags: ['#AI', '#AISafety', '#AIEthics', '#AIRegulation', '#ResponsibleAI', '#AIGovernance']
  }
];

/**
 * Get category by ID
 * @param {string} id - Category ID
 * @returns {Category|undefined}
 */
export function getCategoryById(id) {
  return CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get category by index (0-based)
 * @param {number} index - Category index
 * @returns {Category}
 */
export function getCategoryByIndex(index) {
  return CATEGORIES[index % CATEGORIES.length];
}

/**
 * Get all category IDs
 * @returns {string[]}
 */
export function getCategoryIds() {
  return CATEGORIES.map(cat => cat.id);
}

export default CATEGORIES;
