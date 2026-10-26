import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Raw Markdown is stored; it is rendered here and sanitized on output.
 * This is the ONLY source of HTML passed to dangerouslySetInnerHTML.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "h2",
    "h3",
    "h4",
    "strong",
    "em",
    "del",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
  ],
  // `rel` must be allowed: sanitize-html filters attributes after transformTags.
  allowedAttributes: { a: ["href", "title", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    h1: "h2",
    // merge = true: always overwrites any author-supplied rel.
    a: sanitizeHtml.simpleTransform(
      "a",
      { rel: "noopener noreferrer nofollow" },
      true,
    ),
  },
};

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: false });
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
