/**
 * Escapes HTML special characters to prevent HTML injection
 * in email templates and other user-facing HTML output.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize user text input by stripping HTML tags and dangerous characters.
 * This is an input-level sanitizer for admin form fields (store names, addresses,
 * category names, etc.) to provide defense-in-depth against stored XSS.
 *
 * Preserves alphanumeric characters, spaces, Polish diacritics, and common
 * punctuation. Strips HTML tag markup (<...>) and remaining lone angle
 * brackets, but preserves the text content between opening and closing tags.
 */
export function sanitizeText(value: string): string {
  return value
    // Strip HTML tags entirely (including content if they're actual tags)
    .replace(/<[^>]*>/g, "")
    // Replace remaining angle brackets
    .replace(/[<>]/g, "")
    .trim();
}
