import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// Render per-request so the sitemap always lists the current published posts
// (a cached response omitted newer posts).
export const dynamic = "force-dynamic";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, lastModified: new Date() },
  { url: `${SITE_URL}/blog`, lastModified: new Date() },
  { url: `${SITE_URL}/legal/acceptable-use`, lastModified: new Date() },
  { url: `${SITE_URL}/legal/cookies`, lastModified: new Date() },
  { url: `${SITE_URL}/legal/privacy`, lastModified: new Date() },
  { url: `${SITE_URL}/legal/refund`, lastModified: new Date() },
  { url: `${SITE_URL}/legal/terms`, lastModified: new Date() },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;

  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true, publishedAt: true },
    });

    const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
    }));

    return [...STATIC_ROUTES, ...blogRoutes];
  } catch {
    // If the blog query fails, still return the static routes so Google
    // receives valid XML instead of the HTML error page.
    console.error("[sitemap] blogPost query failed — returning static routes only");
    return STATIC_ROUTES;
  }
}
