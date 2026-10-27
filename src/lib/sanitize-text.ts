/**
 * Plain-text sanitization for public form input (prayer requests, contact
 * messages, admin-edited public text). Pure module.
 *
 * HTML is deliberately NOT stripped: these values are only ever rendered as
 * React text (auto-escaped), never as HTML or Markdown, and never put into
 * emails. So "<3" or "a < b" is kept as typed.
 */

// C0/C1 control characters except \t (U+0009) and \n (U+000A).
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
// Bidi overrides/isolates, zero-width space and BOM. ZWNJ/ZWJ (U+200C/U+200D)
// are kept: Devanagari needs them.
const INVISIBLE_RE = /[\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/g;

/** Multi-line text: NFC, LF line ends, no control/bidi chars, <= 1 blank line in a row. */
export function sanitizePlainText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_RE, "")
    .replace(INVISIBLE_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Single-line text (name, subject): like sanitizePlainText, whitespace collapsed. */
export function sanitizeSingleLine(value: string): string {
  return sanitizePlainText(value).replace(/\s+/g, " ").trim();
}
