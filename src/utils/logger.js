/**
 * MAB AI Strategies Twitter SEO Agent
 * Logging Utility
 *
 * Provides structured logging for both console and Google Sheets.
 * Supports different log levels and error tracking.
 */

/**
 * Log levels
 * @enum {number}
 */
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Log level (debug, info, warn, error)
 * @property {string} phase - Which phase generated the log
 * @property {string} message - Log message
 * @property {Object} [data] - Additional data
 * @property {string} [error] - Error message if applicable
 * @property {string} [stack] - Stack trace if applicable
 */

/**
 * Logger class for structured logging
 */
export class Logger {
  /**
   * @param {Object} options
   * @param {string} [options.level='info'] - Minimum log level
   * @param {string} [options.phase='general'] - Default phase name
   * @param {Function} [options.sheetsWriter] - Function to write to Google Sheets
   */
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level] ?? LOG_LEVELS.info;
    this.phase = options.phase || 'general';
    this.sheetsWriter = options.sheetsWriter || null;
    this.buffer = [];
    this.maxBufferSize = 100;
  }

  /**
   * Create a child logger with a specific phase
   * @param {string} phase - Phase name
   * @returns {Logger}
   */
  child(phase) {
    return new Logger({
      level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.level),
      phase,
      sheetsWriter: this.sheetsWriter
    });
  }

  /**
   * Format log entry for console output
   * @param {LogEntry} entry
   * @returns {string}
   */
  formatConsole(entry) {
    const levelColors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level] || '';

    let output = `${color}[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.phase}]${reset} ${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      output += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error}`;
    }

    if (entry.stack) {
      output += `\n  Stack: ${entry.stack}`;
    }

    return output;
  }

  /**
   * Create a log entry
   * @param {string} level
   * @param {string} message
   * @param {Object} [data]
   * @param {Error} [error]
   * @returns {LogEntry}
   */
  createEntry(level, message, data = {}, error = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      phase: this.phase,
      message,
      data: Object.keys(data).length > 0 ? data : undefined
    };

    if (error) {
      entry.error = error.message;
      entry.stack = error.stack;
    }

    return entry;
  }

  /**
   * Log a message
   * @param {string} level
   * @param {string} message
   * @param {Object} [data]
   * @param {Error} [error]
   */
  async log(level, message, data = {}, error = null) {
    if (LOG_LEVELS[level] < this.level) return;

    const entry = this.createEntry(level, message, data, error);

    // Console output
    console.log(this.formatConsole(entry));

    // Buffer for batch writing to Sheets
    this.buffer.push(entry);

    // If error level, try to write to Sheets immediately
    if (level === 'error' && this.sheetsWriter) {
      try {
        await this.flush();
      } catch (e) {
        console.error('Failed to flush logs to Sheets:', e);
      }
    }

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Debug level log
   * @param {string} message
   * @param {Object} [data]
   */
  debug(message, data = {}) {
    return this.log('debug', message, data);
  }

  /**
   * Info level log
   * @param {string} message
   * @param {Object} [data]
   */
  info(message, data = {}) {
    return this.log('info', message, data);
  }

  /**
   * Warning level log
   * @param {string} message
   * @param {Object} [data]
   */
  warn(message, data = {}) {
    return this.log('warn', message, data);
  }

  /**
   * Error level log
   * @param {string} message
   * @param {Error|Object} [errorOrData]
   * @param {Object} [data]
   */
  error(message, errorOrData = {}, data = {}) {
    if (errorOrData instanceof Error) {
      return this.log('error', message, data, errorOrData);
    }
    return this.log('error', message, errorOrData);
  }

  /**
   * Flush buffered logs to Google Sheets
   */
  async flush() {
    if (this.buffer.length === 0 || !this.sheetsWriter) return;

    const logsToWrite = [...this.buffer];
    this.buffer = [];

    try {
      await this.sheetsWriter(logsToWrite);
    } catch (error) {
      // Re-add failed logs to buffer (at the front)
      this.buffer = [...logsToWrite, ...this.buffer].slice(0, this.maxBufferSize);
      console.error('Failed to write logs to Sheets:', error);
    }
  }

  /**
   * Set the sheets writer function
   * @param {Function} writer
   */
  setSheetsWriter(writer) {
    this.sheetsWriter = writer;
  }
}

/**
 * Create a default logger instance
 * @param {string} [level='info']
 * @returns {Logger}
 */
export function createLogger(level = 'info') {
  return new Logger({ level });
}

/**
 * Format error for logging
 * @param {Error} error
 * @returns {Object}
 */
export function formatError(error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause ? { cause: formatError(error.cause) } : {})
  };
}

export default Logger;
