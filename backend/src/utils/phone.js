/**
 * Normalizes and sanitizes phone numbers for Ethiopian and international formats.
 * Corrects common typos like leading '#' (e.g. '#21989536877' -> '+251989536877').
 *
 * @param {string} phone
 * @returns {string} Sanitized E.164-style phone number or cleaned digits
 */
export function sanitizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';

  let cleaned = phone.trim();

  // If starts with '#' or typos like '#21' or '#251'
  if (cleaned.startsWith('#')) {
    cleaned = '+' + cleaned.slice(1).trim();
  }

  // Remove spaces, hyphens, and parentheses
  cleaned = cleaned.replace(/[\s\-()]/g, '');

  // Common typo: +219... or 219... instead of +2519...
  // In Ethiopian local input, typing 21 instead of 251 or 09
  if (/^\+21\d{8,9}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(3);
  } else if (/^21\d{8,9}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(2);
  }

  // If starts with 09... or 07... (Ethiopian domestic mobile, 10 digits)
  if (/^0[79]\d{8}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(1);
  } else if (/^[79]\d{8}$/.test(cleaned)) {
    cleaned = '+251' + cleaned;
  } else if (/^251[79]\d{8}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Formats a phone number for Chapa payment gateway.
 * Chapa requires Ethiopian phone numbers to be in 10-digit domestic format: 09xxxxxxxx or 07xxxxxxxx.
 * If the number is not a valid 10-digit Ethiopian mobile number, returns empty string so that
 * the optional field does not cause validation failure on Chapa's API.
 *
 * @param {string} phone
 * @returns {string} 10-digit domestic phone number (e.g. "0911223344") or empty string
 */
export function formatPhoneForChapa(phone) {
  if (!phone || typeof phone !== 'string') return '';

  const normalized = sanitizePhoneNumber(phone);

  // If in E.164 Ethiopian format (+2519... or +2517...), convert to 09... / 07...
  if (/^\+251([79]\d{8})$/.test(normalized)) {
    const match = normalized.match(/^\+251([79]\d{8})$/);
    return '0' + match[1];
  }

  // If already in 09... or 07... format
  if (/^0[79]\d{8}$/.test(normalized)) {
    return normalized;
  }

  // 9-digit Ethiopian number starting with 9 or 7
  if (/^[79]\d{8}$/.test(normalized)) {
    return '0' + normalized;
  }

  return '';
}

/**
 * Validates whether a phone number represents a valid phone format.
 * Accepts Ethiopian domestic formats (09..., 07...), E.164 (+251...), or international numbers.
 *
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = sanitizePhoneNumber(phone);
  // Valid if Ethiopian (+2519... or +2517... 13 chars total) or standard international E.164
  return /^\+251[79]\d{8}$/.test(cleaned) || /^\+[1-9]\d{7,14}$/.test(cleaned);
}

export default sanitizePhoneNumber;
