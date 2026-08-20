import { describe, it, expect } from "vitest";
import { validateBlogSeo, slugify, isUrlSafeSlug } from "@/lib/blog/seo";

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("WAEC Registration: A Guide for 2026!")).toBe("waec-registration-a-guide-for-2026");
  });
});
describe("isUrlSafeSlug", () => {
  it("rejects spaces and uppercase", () => {
    expect(isUrlSafeSlug("Bad Slug")).toBe(false);
    expect(isUrlSafeSlug("good-slug-2026")).toBe(true);
  });
});
describe("validateBlogSeo", () => {
  const base = {
    title: "WAEC Registration Guide",
    slug: "waec-registration-guide",
    metaTitle: "WAEC Registration Guide",
    metaDescription: "x".repeat(155),
    excerpt: "answer up front",
    body: "# WAEC Registration Guide\n\nDirect answer here.\n\n## H2",
    featuredImageAltText: "alt",
    internalLinkCount: 2,
    primaryKeyword: "waec registration",
  };
  it("returns no warnings for a clean post", () => {
    expect(validateBlogSeo(base)).toEqual([]);
  });
  it("warns on meta title > 60 chars", () => {
    const w = validateBlogSeo({ ...base, metaTitle: "x".repeat(61) });
    expect(w.some((x) => x.code === "META_TITLE_LONG")).toBe(true);
  });
  it("warns on missing image alt", () => {
    const w = validateBlogSeo({ ...base, featuredImageAltText: "" });
    expect(w.some((x) => x.code === "MISSING_IMG_ALT")).toBe(true);
  });
  it("warns on zero internal links", () => {
    const w = validateBlogSeo({ ...base, internalLinkCount: 0 });
    expect(w.some((x) => x.code === "NO_INTERNAL_LINKS")).toBe(true);
  });
  it("warns when keyword absent from title/H1/opening", () => {
    const w = validateBlogSeo({ ...base, title: "Other Title", body: "# Other Title\n\nDifferent opening.", primaryKeyword: "waec registration" });
    expect(w.some((x) => x.code === "KEYWORD_MISSING")).toBe(true);
  });
});
