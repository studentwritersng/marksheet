import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes user-generated HTML (e.g. announcement content from the rich-text
 * editor) before it is injected via dangerouslySetInnerHTML. Strips <script>,
 * inline event handlers (onerror/onload/...), javascript: URLs, and other
 * active content while preserving safe formatting markup.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html);
}
