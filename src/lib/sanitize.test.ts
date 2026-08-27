import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("keeps safe formatting markup", () => {
    const out = sanitizeHtml("<p>Hello <strong>world</strong> <a href=\"https://x.com\">link</a></p>");
    expect(out).toContain("<strong>world</strong>");
    expect(out).toContain("href=\"https://x.com\"");
  });

  it("strips <script> tags", () => {
    const out = sanitizeHtml("<p>ok</p><script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert(1)");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeHtml("<img src=x onerror=alert(1)><p>hi</p>");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeHtml("<a href=\"javascript:alert(1)\">x</a>");
    expect(out).not.toContain("javascript:");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});
