"use client";

/**
 * MathRenderer
 * ──────────────────────────────────────────────────────────────────────────
 * Parses a mixed plain-text / LaTeX string and renders it properly.
 *
 * Supported delimiters:
 *   Block  : $$...$$ (rendered as a centred display block)
 *   Inline : $...$   (rendered inline)
 *
 * The component intentionally avoids wrapping the entire string in KaTeX so
 * that plain-text segments pass through untouched and only the math fragments
 * are rendered as KaTeX HTML.
 *
 * IMAGE PLACEHOLDER support:
 *   Strings of the form [IMAGE SUGGESTED: ...] are rendered as a styled
 *   dashed-border box so teachers can see at a glance where real images
 *   are needed before publishing.
 */

import React from "react";
import katex from "katex";
// KaTeX CSS is imported globally in the Next.js layout (see layout.tsx note below).

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment =
  | { kind: "text"; value: string }
  | { kind: "math-block"; value: string }
  | { kind: "math-inline"; value: string }
  | { kind: "image-placeholder"; description: string };

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Splits a raw string into alternating text / math / image-placeholder segments.
 * Order of precedence: block math ($$) → inline math ($) → image placeholder.
 */
export function parseSegments(raw: string): Segment[] {
  const segments: Segment[] = [];
  // Combined pattern:
  //   Group 1 — block math:           \$\$(.+?)\$\$
  //   Group 2 — inline math:          \$(.+?)\$
  //   Group 3 — image placeholder:    \[IMAGE SUGGESTED:([^\]]+)\]
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\[IMAGE SUGGESTED:([^\]]+)\]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: raw.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // Block math $$...$$
      segments.push({ kind: "math-block", value: match[1] });
    } else if (match[2] !== undefined) {
      // Inline math $...$
      segments.push({ kind: "math-inline", value: match[2] });
    } else if (match[3] !== undefined) {
      // Image placeholder
      segments.push({ kind: "image-placeholder", description: match[3].trim() });
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  if (lastIndex < raw.length) {
    segments.push({ kind: "text", value: raw.slice(lastIndex) });
  }

  return segments;
}

// ─── KaTeX renderer (safe — never throws to the client) ──────────────────────

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "htmlAndMathml",
    });
  } catch {
    // Fallback: show the raw LaTeX wrapped in a code element
    return `<code class="katex-error">${latex}</code>`;
  }
}

// ─── Image Placeholder component ─────────────────────────────────────────────

function ImagePlaceholder({ description }: { description: string }) {
  return (
    <span
      data-image-placeholder
      className="
        inline-flex items-center gap-2
        my-2 px-3 py-2 w-full
        border-2 border-dashed border-amber-400
        rounded-lg bg-amber-50 text-amber-800
        font-body-sm text-sm leading-snug
        print:border-amber-600 print:bg-amber-100
      "
      role="img"
      aria-label={`Image needed: ${description}`}
    >
      {/* Simple SVG image-frame icon — no external icon dependency */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-amber-500"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <span>
        <span className="font-semibold">Image needed: </span>
        {description}
      </span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MathRendererProps {
  /** The raw string that may contain $...$, $$...$$, [IMAGE SUGGESTED:...], and plain text. */
  text: string;
  /** Extra CSS classes for the wrapper span. */
  className?: string;
}

/**
 * Renders a mixed LaTeX + plain-text string, handling:
 * - $$...$$ → KaTeX display (block) math
 * - $...$   → KaTeX inline math
 * - [IMAGE SUGGESTED: ...]  → image placeholder box
 * - everything else         → plain text (React fragment)
 */
export function MathRenderer({ text, className }: MathRendererProps) {
  if (!text) return null;

  const segments = parseSegments(text);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case "math-block": {
            const html = renderKatex(seg.value, true);
            return (
              <span
                key={i}
                className="block my-2 overflow-x-auto text-center"
                // KaTeX produces sanitised HTML with MathML — dangerouslySetInnerHTML is safe here.
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          case "math-inline": {
            const html = renderKatex(seg.value, false);
            return (
              <span
                key={i}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          case "image-placeholder":
            return <ImagePlaceholder key={i} description={seg.description} />;
          default:
            return <React.Fragment key={i}>{seg.value}</React.Fragment>;
        }
      })}
    </span>
  );
}
