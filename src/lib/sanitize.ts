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

/**
 * Sanitizes an uploaded SVG file: keeps valid SVG markup but strips <script>,
 * inline event handlers, and external/active content that could execute when
 * the SVG is served and rendered.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return "";
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}
