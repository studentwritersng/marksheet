"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/blog/seo";

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export async function upsertKeywordAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const id = (formData.get("id") as string | null)?.trim() || null;
    const data = {
      keywordText: String(formData.get("keywordText") ?? "").trim(),
      type: String(formData.get("type") ?? "short_tail"),
      searchIntent: String(formData.get("searchIntent") ?? "informational"),
      targetAudience: String(formData.get("targetAudience") ?? "general"),
      status: String(formData.get("status") ?? "planned"),
      priority: Number(formData.get("priority") ?? 0),
      notes: formData.get("notes") ? String(formData.get("notes")) : null,
    };
    if (!data.keywordText) return { ok: false, error: "keywordText required" };

    if (id) {
      const existing = await prisma.keyword.findUnique({ where: { id } });
      if (existing) {
        await recordAudit({
          actorId: user.userId,
          action: "update",
          entityType: "keyword",
          entityId: id,
          beforeValue: { keywordText: existing.keywordText, status: existing.status, priority: existing.priority },
          afterValue: data,
        });
      }
    }

    await prisma.keyword.upsert({
      where: { id: id ?? "___new___" },
      create: data,
      update: data,
    });

    if (!id) {
      await recordAudit({
        actorId: user.userId,
        action: "create",
        entityType: "keyword",
        afterValue: data,
      });
    }

    revalidatePath("/console/blog");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteKeywordAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const id = String(formData.get("id"));
    const existing = await prisma.keyword.findUnique({ where: { id } });
    await prisma.keyword.delete({ where: { id } });
    await recordAudit({
      actorId: user.userId,
      action: "delete",
      entityType: "keyword",
      entityId: id,
      beforeValue: existing ? { keywordText: existing.keywordText } : null,
    });
    revalidatePath("/console/blog");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertCategoryAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const id = (formData.get("id") as string | null)?.trim() || null;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "name required" };

    const slug = slugify(name);
    if (!slug) return { ok: false, error: "name must produce a valid slug" };

    if (id) {
      const existing = await prisma.blogCategory.findUnique({ where: { id } });
      const slugCollision = await prisma.blogCategory.findFirst({ where: { slug, NOT: { id } } });
      if (slugCollision) return { ok: false, error: `Slug "${slug}" already in use.` };
      if (existing) {
        await recordAudit({
          actorId: user.userId,
          action: "update",
          entityType: "blog_category",
          entityId: id,
          beforeValue: { name: existing.name, slug: existing.slug },
          afterValue: { name, slug },
        });
      }
      await prisma.blogCategory.update({ where: { id }, data: { name, slug } });
    } else {
      const slugCollision = await prisma.blogCategory.findUnique({ where: { slug } });
      if (slugCollision) return { ok: false, error: `Slug "${slug}" already in use.` };
      const created = await prisma.blogCategory.create({ data: { name, slug } });
      await recordAudit({
        actorId: user.userId,
        action: "create",
        entityType: "blog_category",
        entityId: created.id,
        afterValue: { name, slug },
      });
    }

    revalidatePath("/console/blog");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteCategoryAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const id = String(formData.get("id"));
    const existing = await prisma.blogCategory.findUnique({ where: { id } });
    if (existing) {
      await recordAudit({
        actorId: user.userId,
        action: "delete",
        entityType: "blog_category",
        entityId: id,
        beforeValue: { name: existing.name, slug: existing.slug },
      });
    }
    await prisma.blogCategory.delete({ where: { id } });
    revalidatePath("/console/blog");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
