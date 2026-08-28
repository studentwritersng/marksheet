import sanitizeHtmlLib from "sanitize-html";

/**
 * Tags allowed in user-generated rich text (announcement content). Mirrors what
 * the rich-text editor can produce: formatting, lists, links, headings, tables.
 * Deliberately excludes <script>, <style>, <iframe>, <object>, <embed>, <form>
 * and <img> so no active or remote content can be injected.
 */
const RICH_TEXT_TAGS = [
  "p", "br", "hr", "div", "span",
  "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "small", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "pre", "code",
  "a",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
];

/**
 * Tags allowed in an uploaded SVG. Shape/structure/text elements only — no
 * <script>, <foreignObject>, <use> (which can pull remote refs), or event
 * handling elements such as <set>/<animate>.
 */
const SVG_TAGS = [
  "svg", "g", "defs", "symbol", "title", "desc", "metadata",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath",
  "linearGradient", "radialGradient", "stop", "pattern",
  "clipPath", "mask", "filter",
  "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feMerge",
  "feMergeNode", "feFlood", "feComposite", "feDropShadow",
];

/**
 * Sanitizes user-generated HTML (e.g. announcement content from the rich-text
 * editor) before it is injected via dangerouslySetInnerHTML. Strips <script>,
 * inline event handlers (onerror/onload/...), javascript: URLs, and other
 * active content while preserving safe formatting markup.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtmlLib(html, {
    allowedTags: RICH_TEXT_TAGS,
    // Only href/title on links, plus alignment/colspan on table cells. No
    // `on*` handler can survive because it is not on the allow-list.
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    // javascript:, data:, vbscript: and friends are rejected — only these
    // schemes may appear in an href.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    // Force external links to be safe to click.
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.href
          ? { ...attribs, rel: "noopener noreferrer nofollow" }
          : attribs,
      }),
    },
    // Drop the contents of disallowed tags entirely rather than leaking the
    // inner text (so `<script>alert(1)</script>` leaves nothing behind).
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  });
}

/**
 * Sanitizes an uploaded SVG file: keeps valid SVG markup but strips <script>,
 * inline event handlers, and external/active content that could execute when
 * the SVG is served and rendered.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return "";
  return sanitizeHtmlLib(svg, {
    allowedTags: SVG_TAGS,
    allowedAttributes: {
      "*": [
        "id", "class", "style",
        "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
        "width", "height", "viewBox", "preserveAspectRatio", "points",
        "transform", "fill", "fill-opacity", "fill-rule", "stroke",
        "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
        "stroke-opacity", "opacity", "offset", "stop-color", "stop-opacity",
        "gradientUnits", "gradientTransform", "clip-path", "clip-rule", "mask",
        "font-family", "font-size", "font-weight", "text-anchor",
        "xmlns", "xmlns:xlink", "version",
      ],
    },
    // No remote or scripted schemes anywhere in an SVG.
    allowedSchemes: [],
    // `parser` must keep SVG's camelCase tag/attribute names intact —
    // sanitize-html lowercases by default, which would break viewBox etc.
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    nonTextTags: ["script", "style", "foreignObject"],
  });
}
