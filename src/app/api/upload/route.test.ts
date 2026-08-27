import { describe, it, expect } from "vitest";
import { bufferMatchesType } from "@/app/api/upload/route";
import { sanitizeSvg } from "@/lib/sanitize";

describe("bufferMatchesType", () => {
  it("accepts a real PNG", () => {
    const b = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(bufferMatchesType(b, ".png")).toBe(true);
  });
  it("rejects a PNG extension with non-PNG bytes", () => {
    expect(bufferMatchesType(Buffer.from("not an image"), ".png")).toBe(false);
  });
  it("accepts a JPEG", () => {
    expect(bufferMatchesType(Buffer.from([0xff, 0xd8, 0xff, 0x00]), ".jpg")).toBe(true);
  });
  it("accepts a PDF", () => {
    expect(bufferMatchesType(Buffer.from("%PDF-1.4"), ".pdf")).toBe(true);
  });
  it("accepts an SVG", () => {
    expect(bufferMatchesType(Buffer.from('<?xml version="1.0"?><svg></svg>'), ".svg")).toBe(true);
  });
  it("rejects an SVG that is actually a script", () => {
    expect(bufferMatchesType(Buffer.from("<script>alert(1)</script>"), ".svg")).toBe(false);
  });
});

describe("sanitizeSvg", () => {
  it("strips scripts and event handlers from SVG", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="1" cy="1" r="1" onload="alert(2)"/></svg>';
    const out = sanitizeSvg(svg);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onload");
  });
  it("keeps safe SVG markup", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1"/></svg>';
    expect(sanitizeSvg(svg)).toContain("<circle");
  });
});
