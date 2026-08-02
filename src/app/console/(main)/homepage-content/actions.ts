"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePlatformOwner } from "@/lib/auth/platform-owner";
import { DEFAULT_CONTENT } from "@/lib/marketing/content";

export interface ContentBlockActionResult {
  error?: string;
  success?: string;
}

export async function updateContentBlockAction(_prev: ContentBlockActionResult, formData: FormData): Promise<ContentBlockActionResult> {
  try { await requirePlatformOwner(); } catch { return { error: "Not authorised." }; }
  const sectionKey = String(formData.get("sectionKey") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  const isVisible = formData.get("isVisible") === "on";

  if (!sectionKey || !(sectionKey in DEFAULT_CONTENT)) return { error: "Unknown content block." };

  const existing = await prisma.homepageContentBlock.findUnique({ where: { sectionKey } });
  try {
    if (existing) {
      await prisma.homepageContentBlock.update({
        where: { sectionKey },
        data: { content, isVisible },
      });
    } else {
      await prisma.homepageContentBlock.create({
        data: { sectionKey, content, isVisible },
      });
    }
  } catch {
    return { error: "Failed to save content block." };
  }

  revalidatePath("/");
  revalidatePath("/console/homepage-content");
  return { success: "Saved. Changes are live on the homepage." };
}

export async function resetContentBlockAction(sectionKey: string): Promise<ContentBlockActionResult> {
  try { await requirePlatformOwner(); } catch { return { error: "Not authorised." }; }
  if (!(sectionKey in DEFAULT_CONTENT)) return { error: "Unknown content block." };
  await prisma.homepageContentBlock.deleteMany({ where: { sectionKey } });
  revalidatePath("/");
  revalidatePath("/console/homepage-content");
  return { success: "Reverted to default." };
}
