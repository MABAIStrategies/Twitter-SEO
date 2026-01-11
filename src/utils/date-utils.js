/**
 * MAB AI Strategies Twitter SEO Agent
 * Date and Timezone Utilities
 *
 * Handles timezone conversions between UTC and Eastern Time,
 * date formatting, and schedule calculations.
 */

/**
 * Timezone offsets
 */
export const TIMEZONE_OFFSETS = {
  EST: -5, // Eastern Standard Time
  EDT: -4, // Eastern Daylight Time
  UTC: 0
};

/**
 * Check if a date is during Eastern Daylight Time
 * DST runs from 2nd Sunday of March to 1st Sunday of November
 *
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
export function isEasternDST(date) {
  const year = date.getUTCFullYear();

  // Find 2nd Sunday of March (DST starts at 2 AM)
  let marchFirst = new Date(Date.UTC(year, 2, 1));
  let daysToSecondSunday = (7 - marchFirst.getUTCDay()) % 7 + 7;
  let dstStart = new Date(Date.UTC(year, 2, 1 + daysToSecondSunday, 7)); // 2 AM EST = 7 AM UTC

  // Find 1st Sunday of November (DST ends at 2 AM)
  let novFirst = new Date(Date.UTC(year, 10, 1));
  let daysToFirstSunday = (7 - novFirst.getUTCDay()) % 7;
  let dstEnd = new Date(Date.UTC(year, 10, 1 + daysToFirstSunday, 6)); // 2 AM EDT = 6 AM UTC

  return date >= dstStart && date < dstEnd;
}

/**
 * Get the current Eastern timezone offset
 * @param {Date} [date] - Date to check (defaults to now)
 * @returns {number} Offset in hours (-5 or -4)
 */
export function getEasternOffset(date = new Date()) {
  return isEasternDST(date) ? TIMEZONE_OFFSETS.EDT : TIMEZONE_OFFSETS.EST;
}

/**
 * Convert UTC date to Eastern Time
 * @param {Date} utcDate - Date in UTC
 * @returns {Date} Date adjusted for Eastern Time
 */
export function utcToEastern(utcDate) {
  const offset = getEasternOffset(utcDate);
  return new Date(utcDate.getTime() + offset * 60 * 60 * 1000);
}

/**
 * Convert Eastern Time to UTC
 * @param {Date} easternDate - Date in Eastern Time
 * @returns {Date} Date in UTC
 */
export function easternToUTC(easternDate) {
  const offset = getEasternOffset(easternDate);
  return new Date(easternDate.getTime() - offset * 60 * 60 * 1000);
}

/**
 * Get the current time in Eastern timezone
 * @returns {Date}
 */
export function nowEastern() {
  return utcToEastern(new Date());
}

/**
 * Get the Eastern hour for a UTC date
 * @param {Date} [date] - UTC date (defaults to now)
 * @returns {number} Hour in Eastern time (0-23)
 */
export function getEasternHour(date = new Date()) {
  const eastern = utcToEastern(date);
  return eastern.getUTCHours();
}

/**
 * Check if today is a weekday (Monday-Friday)
 * @param {Date} [date] - Date to check (defaults to now in Eastern)
 * @returns {boolean}
 */
export function isWeekday(date = new Date()) {
  const eastern = utcToEastern(date);
  const day = eastern.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Get today's date string in YYYY-MM-DD format (Eastern time)
 * @param {Date} [date] - Date to format (defaults to now)
 * @returns {string}
 */
export function getTodayString(date = new Date()) {
  const eastern = utcToEastern(date);
  return eastern.toISOString().split('T')[0];
}

/**
 * Get yesterday's date string in YYYY-MM-DD format (Eastern time)
 * @param {Date} [date] - Reference date (defaults to now)
 * @returns {string}
 */
export function getYesterdayString(date = new Date()) {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTodayString(yesterday);
}

/**
 * Parse a date string to a Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date}
 */
export function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Calculate hours between two dates
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number} Hours (can be negative)
 */
export function hoursBetween(date1, date2) {
  return (date2 - date1) / (1000 * 60 * 60);
}

/**
 * Format a date for display
 * @param {Date} date
 * @param {Object} [options]
 * @param {boolean} [options.includeTime=true]
 * @param {boolean} [options.includeTimezone=true]
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  const { includeTime = true, includeTimezone = true } = options;
  const eastern = utcToEastern(date);

  const year = eastern.getUTCFullYear();
  const month = String(eastern.getUTCMonth() + 1).padStart(2, '0');
  const day = String(eastern.getUTCDate()).padStart(2, '0');

  let result = `${year}-${month}-${day}`;

  if (includeTime) {
    const hours = String(eastern.getUTCHours()).padStart(2, '0');
    const minutes = String(eastern.getUTCMinutes()).padStart(2, '0');
    result += ` ${hours}:${minutes}`;

    if (includeTimezone) {
      result += isEasternDST(date) ? ' EDT' : ' EST';
    }
  }

  return result;
}

/**
 * Format time in 12-hour format
 * @param {number} hour - Hour in 24-hour format
 * @returns {string}
 */
export function formatTime12Hour(hour) {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

/**
 * Get the day of year (1-366)
 * @param {Date} [date] - Date to check (defaults to now)
 * @returns {number}
 */
export function getDayOfYear(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Check if a timestamp is within the last N hours
 * @param {string|Date} timestamp - Timestamp to check
 * @param {number} hours - Number of hours
 * @returns {boolean}
 */
export function isWithinHours(timestamp, hours) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffHours = hoursBetween(date, now);
  return diffHours >= 0 && diffHours <= hours;
}

/**
 * Calculate recency score based on publish time
 * @param {string|Date} publishDate - Article publish date
 * @returns {number} Score from 0-20
 */
export function calculateRecencyScore(publishDate) {
  const date = typeof publishDate === 'string' ? new Date(publishDate) : publishDate;
  const hoursAgo = hoursBetween(date, new Date());

  if (hoursAgo < 0) return 0; // Future date (shouldn't happen)
  if (hoursAgo <= 6) return 20;
  if (hoursAgo <= 12) return 15;
  if (hoursAgo <= 18) return 10;
  if (hoursAgo <= 24) return 5;
  return 0;
}

export default {
  isEasternDST,
  getEasternOffset,
  utcToEastern,
  easternToUTC,
  nowEastern,
  getEasternHour,
  isWeekday,
  getTodayString,
  getYesterdayString,
  parseDate,
  hoursBetween,
  formatDate,
  formatTime12Hour,
  getDayOfYear,
  isWithinHours,
  calculateRecencyScore
};
