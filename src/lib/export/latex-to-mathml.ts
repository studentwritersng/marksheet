/**
 * latex-to-mathml.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Converts LaTeX math expressions to MathML using Temml.
 *
 * Used by the DOC export pipeline so that Word receives native <math> elements
 * instead of raw LaTeX strings. Word 2007+ renders inline MathML natively when
 * the document declares the MathML namespace.
 *
 * Public API
 * ──────────
 *   latexToMathml(latex, displayMode)   → MathML string for a single expression
 *   convertLatexInHtml(html)            → replace all $…$ / $$…$$ in an HTML
 *                                         string with <math> elements
 */

import temml from "temml";

// ── Single expression conversion ──────────────────────────────────────────────

/**
 * Render one LaTeX expression to a MathML string.
 *
 * @param latex       The raw LaTeX source (without delimiters).
 * @param displayMode true → block/display math; false → inline math.
 * @returns           A `<math …>` element string, or a fallback <code> on error.
 */
export function latexToMathml(latex: string, displayMode: boolean): string {
  try {
    // Temml renderToString produces a self-contained <math> element.
    // We request "mathml" output (no extra HTML wrappers).
    return temml.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: "#cc0000",
    });
  } catch {
    // Never crash the export; degrade gracefully to escaped text.
    const escaped = latex.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<code class="katex-error">${escaped}</code>`;
  }
}

// ── HTML post-processor ───────────────────────────────────────────────────────

/**
 * Walk through an HTML string and replace every LaTeX math delimiter pair
 * with a proper <math> element produced by Temml.
 *
 * Handled delimiters (in precedence order):
 *   $$…$$   → display/block math
 *   $…$     → inline math
 *   [IMAGE SUGGESTED: …]  → left as-is (handled separately by the renderer)
 *
 * The function is deliberately simple (regex-based) because the HTML arriving
 * here is already serialised DOM innerHTML — it won't contain nested LaTeX
 * inside attribute values or inside `<script>` tags.
 */
export function convertLatexInHtml(html: string): string {
  // Process block math first ($$…$$), then inline ($…$).
  // Using a two-pass approach avoids ambiguity between the delimiters.

  // Pass 1 — block math: $$…$$
  let result = html.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    const mathml = latexToMathml(latex.trim(), true);
    // Wrap in a paragraph-level container so Word treats it as a block element.
    return `<p style="text-align:center;margin:6pt 0;">${mathml}</p>`;
  });

  // Pass 2 — inline math: $…$  (single dollar signs, not preceded by another $)
  // The negative lookbehind/lookahead keeps us from re-matching already-replaced
  // block math remnants.
  result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g, (_match, latex: string) => {
    return latexToMathml(latex.trim(), false);
  });

  return result;
}
