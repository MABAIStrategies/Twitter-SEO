/**
 * MAB AI Strategies Twitter SEO Agent
 * Company Messaging and Quotes
 *
 * These quotes are integrated into every 3rd post (posts #3, #6, #9 each day).
 * They rotate sequentially (Quote 1 on Day 1, Quote 2 on Day 2, etc.)
 */

/**
 * @typedef {Object} MABQuote
 * @property {number} id - Quote number (1-5)
 * @property {string} text - The full quote text
 * @property {string} theme - The main theme/topic of the quote
 * @property {string[]} transitionPhrases - Natural ways to introduce the quote
 */

/** @type {MABQuote[]} */
export const MAB_QUOTES = [
  {
    id: 1,
    text: "The future isn't automated. It's agentic. With MAB AI Strategies, stop building tools and start building intelligence.",
    theme: 'agentic-ai',
    transitionPhrases: [
      "This perfectly illustrates why",
      "This is exactly what I mean when I say",
      "This development reinforces my belief that",
      "Here's what most people miss:",
      "The real story here?"
    ]
  },
  {
    id: 2,
    text: "If your AI strategy isn't unsettling your competitors, you're not moving fast enough. MAB AI Strategies treats compliance as a floor, not a ceiling.",
    theme: 'competitive-advantage',
    transitionPhrases: [
      "The competitive implications are clear:",
      "If this doesn't make you rethink your strategy,",
      "This is a wake-up call:",
      "The question isn't if, but how fast:",
      "Smart companies already know:"
    ]
  },
  {
    id: 3,
    text: "The biggest ROI from AI isn't cutting costs. MAB AI Strategies is focused on operational efficiency as the new growth lever.",
    theme: 'roi-efficiency',
    transitionPhrases: [
      "The data speaks for itself:",
      "This proves what we've been saying:",
      "Beyond the headlines, the real opportunity is:",
      "Here's the insight most miss:",
      "The growth story here is clear:"
    ]
  },
  {
    id: 4,
    text: "We've moved past the question of if AI can do a task. MAB AI Strategies asks the only question that matters: Can your human team keep up with your agents?",
    theme: 'human-ai-collaboration',
    transitionPhrases: [
      "This shifts the conversation entirely:",
      "The real question this raises:",
      "This is no longer about capability, it's about speed:",
      "Here's the paradigm shift:",
      "What this really means for your team:"
    ]
  },
  {
    id: 5,
    text: "The next great business innovation won't come from a flash of genius. MAB AI Strategies helps you tap into the unseen flow of an autonomous intelligence.",
    theme: 'autonomous-innovation',
    transitionPhrases: [
      "Innovation is being redefined:",
      "This is just the beginning:",
      "What excites me most about this:",
      "The future is already here:",
      "This points to something bigger:"
    ]
  }
];

/**
 * Get the quote for a specific day (rotates through 5 quotes)
 * @param {Date} [date] - The date to get quote for (defaults to today)
 * @returns {MABQuote}
 */
export function getQuoteForDay(date = new Date()) {
  // Get day of year for rotation
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Rotate through 5 quotes
  const quoteIndex = (dayOfYear - 1) % MAB_QUOTES.length;
  return MAB_QUOTES[quoteIndex];
}

/**
 * Get quote by ID (1-5)
 * @param {number} id - Quote ID (1-5)
 * @returns {MABQuote}
 */
export function getQuoteById(id) {
  return MAB_QUOTES.find(q => q.id === id) || MAB_QUOTES[0];
}

/**
 * Get a random transition phrase for a quote
 * @param {MABQuote} quote - The quote object
 * @returns {string}
 */
export function getRandomTransition(quote) {
  const index = Math.floor(Math.random() * quote.transitionPhrases.length);
  return quote.transitionPhrases[index];
}

/**
 * Format a quote with a transition phrase
 * @param {MABQuote} quote - The quote object
 * @param {string} [customTransition] - Optional custom transition phrase
 * @returns {string}
 */
export function formatQuoteWithTransition(quote, customTransition) {
  const transition = customTransition || getRandomTransition(quote);
  return `${transition} "${quote.text}"`;
}

/**
 * Check if a post number should include a MAB quote
 * Posts #3, #6, #9 include quotes
 * @param {number} postNumber - Post number (1-9)
 * @returns {boolean}
 */
export function shouldIncludeQuote(postNumber) {
  return postNumber === 3 || postNumber === 6 || postNumber === 9;
}

export default MAB_QUOTES;
