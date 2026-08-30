import { it, expect, vi, describe } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: { findMany: (...a: unknown[]) => findMany(...a) },
    aiCallLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

async function sitemap() {
  const mod = await import("@/app/sitemap");
  return mod.default();
}

describe("sitemap", () => {
  it("returns static routes plus published blog posts", async () => {
    findMany.mockResolvedValue([
      { slug: "hello", updatedAt: new Date("2026-08-01"), publishedAt: new Date("2026-08-01") },
      { slug: "world", updatedAt: new Date("2026-08-02"), publishedAt: null },
    ]);

    const result = await sitemap();

    const urls = result.map((r) => r.url);
    expect(urls).toContain("https://marksheet.top/");
    expect(urls).toContain("https://marksheet.top/blog/hello");
    expect(urls).toContain("https://marksheet.top/blog/world");
    expect(result).toHaveLength(7 + 2);
  });

  it("falls back to static routes only when the blog query fails", async () => {
    findMany.mockRejectedValue(new Error("DB down"));

    const result = await sitemap();

    const urls = result.map((r) => r.url);
    expect(urls).toContain("https://marksheet.top/");
    expect(urls).toContain("https://marksheet.top/blog");
    expect(urls).not.toContain("https://marksheet.top/blog/hello");
    expect(result).toHaveLength(7);
  });
});
