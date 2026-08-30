import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// Render per-request so the sitemap always lists the current published posts
// (a cached response omitted newer posts).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;

  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    select: { slug: true, updatedAt: true, publishedAt: true },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/blog`, lastModified: new Date() },
    { url: `${base}/legal/acceptable-use`, lastModified: new Date() },
    { url: `${base}/legal/cookies`, lastModified: new Date() },
    { url: `${base}/legal/privacy`, lastModified: new Date() },
    { url: `${base}/legal/refund`, lastModified: new Date() },
    { url: `${base}/legal/terms`, lastModified: new Date() },
  ];

  const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
  }));

  return [...staticRoutes, ...blogRoutes];
}
