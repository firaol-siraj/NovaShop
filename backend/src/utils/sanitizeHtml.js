/**
 * Safe HTML Sanitizer for Support Messages & Inbound Emails
 * Prevents Cross-Site Scripting (XSS), script injection, and clickjacking
 * while preserving safe formatting tags (p, br, strong, em, ul, ol, li, a, blockquote).
 */

const DANGEROUS_TAGS_REGEX = /<\/?(script|style|iframe|object|embed|form|input|button|link|meta|applet|svg|base|frameset|frame)[\s\S]*?>/gi;
const EVENT_HANDLERS_REGEX = /\s+(on[a-zA-Z]+)\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const JAVASCRIPT_URL_REGEX = /(href|src)\s*=\s*(?:['"]\s*(?:javascript|vbscript|data:text\/html):[^'"]*['"]|\s*(?:javascript|vbscript|data:text\/html):[^\s>]+)/gi;

export function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let sanitized = rawHtml;

  // 1. Remove dangerous executable/embed tags
  sanitized = sanitized.replace(DANGEROUS_TAGS_REGEX, '');

  // 2. Remove inline event handlers (e.g. onload, onerror, onclick)
  sanitized = sanitized.replace(EVENT_HANDLERS_REGEX, '');

  // 3. Remove javascript: and dangerous data: URLs in href/src
  sanitized = sanitized.replace(JAVASCRIPT_URL_REGEX, '$1="#"');

  // 4. Ensure target="_blank" and rel="noopener noreferrer" on safe links
  sanitized = sanitized.replace(/<a\s+(.*?)>/gi, (match, attrs) => {
    let cleanAttrs = attrs.replace(/\btarget\s*=\s*['"][^'"]*['"]/gi, '').trim();
    cleanAttrs = cleanAttrs.replace(/\brel\s*=\s*['"][^'"]*['"]/gi, '').trim();
    return `<a ${cleanAttrs} target="_blank" rel="noopener noreferrer">`;
  });

  return sanitized.trim();
}

/**
 * Convert plain text to safe HTML paragraphs
 */
export function textToHtml(plainText) {
  if (!plainText || typeof plainText !== 'string') return '';
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return escaped
    .split(/\r?\n\r?\n/)
    .map(para => `<p>${para.replace(/\r?\n/g, '<br />')}</p>`)
    .join('');
}
