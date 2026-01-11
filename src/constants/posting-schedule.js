/**
 * MAB AI Strategies Twitter SEO Agent
 * Posting Schedule Configuration
 *
 * Defines the daily posting schedule with 9 posts per day,
 * rotating through 3 categories with 3 posts each.
 */

/**
 * @typedef {Object} TimeSlot
 * @property {number} hour - Hour in EST (24-hour format)
 * @property {number} utcHour - Hour in UTC (24-hour format, standard time)
 * @property {number} utcHourDST - Hour in UTC during Daylight Saving Time
 * @property {number} postNumber - Post number for the day (1-9)
 * @property {string} categoryId - Category ID for this slot
 * @property {number} categoryRank - Rank within category (1-3)
 * @property {boolean} includeQuote - Whether to include MAB quote
 */

/** @type {TimeSlot[]} */
export const POSTING_SCHEDULE = [
  {
    hour: 9,
    utcHour: 14,
    utcHourDST: 13,
    postNumber: 1,
    categoryId: 'ai-providers',
    categoryRank: 1,
    includeQuote: false
  },
  {
    hour: 10,
    utcHour: 15,
    utcHourDST: 14,
    postNumber: 2,
    categoryId: 'business-ai',
    categoryRank: 1,
    includeQuote: false
  },
  {
    hour: 11,
    utcHour: 16,
    utcHourDST: 15,
    postNumber: 3,
    categoryId: 'ai-safety',
    categoryRank: 1,
    includeQuote: true // Quote rotation: posts 3, 6, 9
  },
  {
    hour: 12,
    utcHour: 17,
    utcHourDST: 16,
    postNumber: 4,
    categoryId: 'ai-providers',
    categoryRank: 2,
    includeQuote: false
  },
  {
    hour: 13,
    utcHour: 18,
    utcHourDST: 17,
    postNumber: 5,
    categoryId: 'business-ai',
    categoryRank: 2,
    includeQuote: false
  },
  {
    hour: 14,
    utcHour: 19,
    utcHourDST: 18,
    postNumber: 6,
    categoryId: 'ai-safety',
    categoryRank: 2,
    includeQuote: true // Quote rotation: posts 3, 6, 9
  },
  {
    hour: 15,
    utcHour: 20,
    utcHourDST: 19,
    postNumber: 7,
    categoryId: 'ai-providers',
    categoryRank: 3,
    includeQuote: false
  },
  {
    hour: 16,
    utcHour: 21,
    utcHourDST: 20,
    postNumber: 8,
    categoryId: 'business-ai',
    categoryRank: 3,
    includeQuote: false
  },
  {
    hour: 17,
    utcHour: 22,
    utcHourDST: 21,
    postNumber: 9,
    categoryId: 'ai-safety',
    categoryRank: 3,
    includeQuote: true // Quote rotation: posts 3, 6, 9
  }
];

/**
 * Scraping schedule (Phase 1 & 2)
 */
export const SCRAPING_SCHEDULE = {
  hour: 7,
  minute: 30,
  utcHour: 12,
  utcMinute: 30,
  utcHourDST: 11,
  description: '7:30 AM EST - Scrape and filter news articles'
};

/**
 * Analytics reminder schedule
 */
export const ANALYTICS_REMINDER = {
  dayOfWeek: 0, // Sunday
  hour: 9,
  utcHour: 14,
  utcHourDST: 13,
  description: 'Sunday 9 AM EST - Weekly analytics reminder email'
};

/**
 * AI insights generation schedule
 */
export const INSIGHTS_GENERATION = {
  dayOfWeek: 1, // Monday
  hour: 6,
  utcHour: 11,
  utcHourDST: 10,
  description: 'Monday 6 AM EST - Generate weekly AI insights'
};

/**
 * Get the time slot for a specific UTC hour
 * @param {number} utcHour - Current UTC hour
 * @param {boolean} [isDST=false] - Whether Daylight Saving Time is active
 * @returns {TimeSlot|null}
 */
export function getTimeSlotForUTCHour(utcHour, isDST = false) {
  return POSTING_SCHEDULE.find(slot =>
    isDST ? slot.utcHourDST === utcHour : slot.utcHour === utcHour
  ) || null;
}

/**
 * Get the time slot for a specific EST hour
 * @param {number} estHour - Hour in EST (9-17)
 * @returns {TimeSlot|null}
 */
export function getTimeSlotForESTHour(estHour) {
  return POSTING_SCHEDULE.find(slot => slot.hour === estHour) || null;
}

/**
 * Get all time slots that include a MAB quote
 * @returns {TimeSlot[]}
 */
export function getQuoteSlots() {
  return POSTING_SCHEDULE.filter(slot => slot.includeQuote);
}

/**
 * Get time slots for a specific category
 * @param {string} categoryId - Category ID
 * @returns {TimeSlot[]}
 */
export function getSlotsForCategory(categoryId) {
  return POSTING_SCHEDULE.filter(slot => slot.categoryId === categoryId);
}

/**
 * Check if we're currently in Daylight Saving Time (US Eastern)
 * DST runs from 2nd Sunday of March to 1st Sunday of November
 * @param {Date} [date] - Date to check (defaults to now)
 * @returns {boolean}
 */
export function isEasternDST(date = new Date()) {
  const year = date.getFullYear();

  // Find 2nd Sunday of March
  const marchFirst = new Date(year, 2, 1);
  const marchFirstDay = marchFirst.getDay();
  const dstStart = new Date(year, 2, 8 + (7 - marchFirstDay) % 7 + 7);

  // Find 1st Sunday of November
  const novFirst = new Date(year, 10, 1);
  const novFirstDay = novFirst.getDay();
  const dstEnd = new Date(year, 10, 1 + (7 - novFirstDay) % 7);

  return date >= dstStart && date < dstEnd;
}

/**
 * Format a time slot for display
 * @param {TimeSlot} slot - Time slot object
 * @returns {string}
 */
export function formatTimeSlot(slot) {
  const period = slot.hour >= 12 ? 'PM' : 'AM';
  const displayHour = slot.hour > 12 ? slot.hour - 12 : slot.hour;
  return `${displayHour}:00 ${period} EST`;
}

/**
 * Get the next scheduled posting time
 * @param {Date} [now] - Current time (defaults to now)
 * @returns {TimeSlot|null}
 */
export function getNextPostingSlot(now = new Date()) {
  const isDST = isEasternDST(now);
  const currentUTCHour = now.getUTCHours();

  // Find the next slot
  for (const slot of POSTING_SCHEDULE) {
    const slotUTCHour = isDST ? slot.utcHourDST : slot.utcHour;
    if (slotUTCHour > currentUTCHour) {
      return slot;
    }
  }

  // If no more slots today, return first slot (for tomorrow)
  return POSTING_SCHEDULE[0];
}

export default POSTING_SCHEDULE;
