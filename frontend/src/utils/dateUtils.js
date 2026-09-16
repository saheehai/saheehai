/**
 * Parse a timestamp (string or number) into a Date object
 * @param {string|number} timestamp - Unix timestamp in milliseconds
 * @returns {Date|null} - Date object or null if invalid
 */
export const parseTimestamp = (timestamp) => {
  if (!timestamp) return null;

  // Convert to number if it's a string
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  const date = new Date(ts);

  // Check if date is valid
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Format a timestamp as a full date string
 * @param {string|number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Formatted date string or 'Unknown Date'
 */
export const formatDate = (timestamp) => {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return 'Unknown Date';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format a timestamp as month and year only
 * @param {string|number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Formatted month/year or 'Unknown Date'
 */
export const formatMonthYear = (timestamp) => {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return 'Unknown Date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });
};

/**
 * Get date string in YYYY-MM-DD format (local timezone)
 * @param {string|number} timestamp - Unix timestamp in milliseconds
 * @returns {string|null} - Date string or null if invalid
 */
export const getDateString = (timestamp) => {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return null;
  }

  // en-CA locale formats dates as YYYY-MM-DD
  return date.toLocaleDateString('en-CA');
};
