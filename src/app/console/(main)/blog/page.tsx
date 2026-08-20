import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { BlogClient } from "./blog-client";

export default async function BlogPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [keywords, categories, posts] = await Promise.all([
    prisma.keyword.findMany({ orderBy: [{ priority: "desc" }, { keywordText: "asc" }] }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" }, include: { primaryKeyword: true, category: true } }),
  ]);

  return (
    <BlogClient
      keywords={keywords.map((k) => ({
        id: k.id,
        keywordText: k.keywordText,
        type: k.type,
        searchIntent: k.searchIntent,
        targetAudience: k.targetAudience,
        status: k.status,
        priority: k.priority,
        notes: k.notes,
      }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      posts={posts.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        primaryKeyword: p.primaryKeyword?.keywordText ?? null,
        category: p.category?.name ?? null,
        updatedAt: p.updatedAt.toISOString(),
      }))}
    />
  );
}
