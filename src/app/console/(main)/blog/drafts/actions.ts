"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";
import {
  generateBlogDraft,
  type BlogDraftInput,
  type BlogDraftPackage,
} from "@/lib/blog/generate";
import { slugify, countInternalLinks, firstParagraph } from "@/lib/blog/seo";

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export type GenerateDraftActionInput = BlogDraftInput & {
  keywordId?: string | null;
};

export type CreateDraftPostMeta = {
  categoryId?: string | null;
  primaryKeywordId?: string | null;
  slug?: string | null;
};

export type CreateDraftPostDraft = {
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  body: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[] | null;
  imagePrompt?: string | null;
  featuredImageUrl?: string | null;
  featuredImageAltText?: string | null;
};

export async function generateDraftAction(
  input: GenerateDraftActionInput,
): Promise<{ ok: boolean; pkg?: BlogDraftPackage & { requestId: string }; error?: string }> {
  try {
    const user = await requireOwner();
    if (!input.keyword && !input.topic) {
      return { ok: false, error: "keyword or topic required" };
    }
    const pkg = await generateBlogDraft(input);
    const req = await prisma.aiBlogDraftRequest.create({
      data: {
        keywordId: input.keywordId ?? null,
        topicText: input.topic ?? null,
        targetAudience: input.targetAudience,
        requestedBy: user.userId,
        status: "completed",
        generatedTitleOptions: pkg.titleOptions,
        generatedSubtitle: pkg.subtitle,
        generatedExcerpt: pkg.excerpt,
        generatedBody: pkg.body,
        generatedMetaTitle: pkg.metaTitle,
        generatedMetaDescription: pkg.metaDescription,
        generatedTags: pkg.tags,
        generatedImagePrompt: pkg.imagePrompt,
      },
    });
    await recordAudit({
      actorId: user.userId,
      action: "create",
      entityType: "ai_blog_draft_request",
      entityId: req.id,
      afterValue: { topic: input.topic ?? null, keyword: input.keyword ?? null },
    });
    return { ok: true, pkg: { ...pkg, requestId: req.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createDraftPostAction(
  draft: CreateDraftPostDraft,
  meta: CreateDraftPostMeta,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const user = await requireOwner();
    const title = (draft.title ?? "").trim();
    if (!title) return { ok: false, error: "title required" };

    const slug = slugify(meta.slug ? String(meta.slug) : title);
    if (!slug) return { ok: false, error: "title must produce a valid slug" };

    const slugCollision = await prisma.blogPost.findUnique({ where: { slug } });
    if (slugCollision) return { ok: false, error: `Slug "${slug}" already in use.` };

    const post = await prisma.blogPost.create({
      data: {
        title,
        subtitle: draft.subtitle ?? null,
        slug,
        excerpt: draft.excerpt ?? null,
        body: draft.body,
        status: "draft",
        primaryKeywordId: meta.primaryKeywordId ?? null,
        categoryId: meta.categoryId ?? null,
        metaTitle: draft.metaTitle ?? null,
        metaDescription: draft.metaDescription ?? null,
        tags: draft.tags ?? undefined,
        source: "ai_generated",
        featuredImageUrl: draft.featuredImageUrl ?? null,
        featuredImageAltText: draft.featuredImageAltText ?? null,
      },
    });

    await recordAudit({
      actorId: user.userId,
      action: "create",
      entityType: "blog_post",
      entityId: post.id,
      afterValue: { title, slug, status: "draft" },
    });

    revalidatePath("/console/blog");
    return { ok: true, id: post.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export type UpdatePostInput = {
  title: string;
  slug?: string | null;
  subtitle?: string | null;
  excerpt?: string | null;
  body: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[] | null;
  categoryId?: string | null;
  primaryKeywordId?: string | null;
  featuredImageUrl?: string | null;
  featuredImageAltText?: string | null;
  canonicalUrl?: string | null;
  status?: string | null;
};

const EDITABLE_STATUSES = ["draft", "pending_review", "archived"];

export async function updatePostAction(
  postId: string,
  data: UpdatePostInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const title = (data.title ?? "").trim();
    if (!title) return { ok: false, error: "title required" };

    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) return { ok: false, error: "Blog post not found." };

    let slug = post.slug;
    if (data.slug && data.slug.trim()) {
      const desired = slugify(data.slug.trim());
      if (desired && desired !== post.slug) {
        const collision = await prisma.blogPost.findUnique({ where: { slug: desired } });
        if (collision) return { ok: false, error: `Slug "${desired}" already in use.` };
        slug = desired;
      }
    }

    const nextStatus = data.status && EDITABLE_STATUSES.includes(data.status) ? data.status : post.status;

    const before = { title: post.title, slug: post.slug, status: post.status };
    const updated = await prisma.blogPost.update({
      where: { id: postId },
      data: {
        title,
        slug,
        subtitle: data.subtitle ?? null,
        excerpt: data.excerpt ?? null,
        body: data.body,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        tags: data.tags ?? undefined,
        categoryId: data.categoryId ?? null,
        primaryKeywordId: data.primaryKeywordId ?? null,
        featuredImageUrl: data.featuredImageUrl ?? null,
        featuredImageAltText: data.featuredImageAltText ?? null,
        canonicalUrl: data.canonicalUrl ?? null,
        status: nextStatus,
      },
    });

    await recordAudit({
      actorId: user.userId,
      action: "update",
      entityType: "blog_post",
      entityId: postId,
      beforeValue: before,
      afterValue: { title: updated.title, slug: updated.slug, status: updated.status },
    });

    revalidatePath("/console/blog");
    revalidatePath("/blog", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function publishPostAction(
  postId: string,
): Promise<{
  ok: boolean;
  id?: string;
  firstParagraph?: string;
  internalLinkCount?: number;
  error?: string;
}> {
  try {
    const user = await requireOwner();
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) return { ok: false, error: "Blog post not found." };

    const computedFirstParagraph = firstParagraph(post.body);
    const internalLinkCount = countInternalLinks(post.body);

    const updated = await prisma.blogPost.update({
      where: { id: postId },
      data: { status: "published", publishedAt: new Date() },
    });

    await recordAudit({
      actorId: user.userId,
      action: "update",
      entityType: "blog_post",
      entityId: postId,
      beforeValue: { status: post.status, publishedAt: post.publishedAt },
      afterValue: { status: "published", publishedAt: updated.publishedAt },
    });

    revalidatePath("/console/blog");
    revalidatePath("/blog", "layout");
    return {
      ok: true,
      id: postId,
      firstParagraph: computedFirstParagraph,
      internalLinkCount,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
