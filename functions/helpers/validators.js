// functions/helpers/validators.js
// ============================================================
//  Validators - Input validation and sanitization utilities.
// ============================================================

/**
 * Validate an email address.
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

/**
 * Validate a phone number (basic international format).
 * Accepts digits, '+', spaces, parentheses, hyphens.
 */
export function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  // Remove common separators
  const cleaned = phone.replace(/[\s()\-.]/g, '');
  // Must start with optional '+' and then digits, at least 10 digits
  return /^\+?\d{10,15}$/.test(cleaned);
}

/**
 * Validate and sanitize a URL.
 * Returns the URL if valid, else null.
 */
export function validateUrl(url) {
  if (typeof url !== 'string') return null;
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize input to prevent XSS (basic string escape).
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
