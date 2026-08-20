import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { EditorClient } from "./editor-client";

interface KeywordVM {
  id: string;
  keywordText: string;
}

interface CategoryVM {
  id: string;
  name: string;
}

interface PostVM {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  excerpt: string | null;
  body: string;
  status: string;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: string[];
  categoryId: string | null;
  primaryKeywordId: string | null;
  featuredImageUrl: string | null;
  featuredImageAltText: string | null;
  canonicalUrl: string | null;
}

export default async function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [keywords, categories] = await Promise.all([
    prisma.keyword.findMany({ orderBy: { keywordText: "asc" } }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const keywordVMs: KeywordVM[] = keywords.map((k) => ({ id: k.id, keywordText: k.keywordText }));
  const categoryVMs: CategoryVM[] = categories.map((c) => ({ id: c.id, name: c.name }));

  if (params.id === "new") {
    return (
      <EditorClient
        post={null}
        keywords={keywordVMs}
        categories={categoryVMs}
      />
    );
  }

  const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!post) notFound();

  const postVM: PostVM = {
    id: post.id,
    title: post.title,
    subtitle: post.subtitle,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    status: post.status,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    tags: Array.isArray(post.tags) ? (post.tags as string[]) : [],
    categoryId: post.categoryId,
    primaryKeywordId: post.primaryKeywordId,
    featuredImageUrl: post.featuredImageUrl,
    featuredImageAltText: post.featuredImageAltText,
    canonicalUrl: post.canonicalUrl,
  };

  return (
    <EditorClient post={postVM} keywords={keywordVMs} categories={categoryVMs} />
  );
}
