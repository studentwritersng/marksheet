"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
export interface ActionState {
  error?: string;
  success?: string;
}

export async function createAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const rawRoles = formData.getAll("targetRoles[]") as string[];
  const isSticky = formData.get("isSticky") === "on";
  const publishMode = formData.get("publishMode") as string;
  const rawExpires = formData.get("expiresAt") as string;

  if (!title || !content || rawRoles.length === 0) {
    return { error: "Title, content, and at least one target role are required." };
  }

  let publishedAt: Date | null = null;
  if (publishMode === "now") {
    publishedAt = new Date();
  } else if (publishMode === "schedule") {
    const rawSchedule = formData.get("scheduledAt") as string;
    if (!rawSchedule) return { error: "Scheduled date required." };
    publishedAt = new Date(rawSchedule);
  }

  let expiresAt: Date | null = null;
  if (rawExpires) {
    expiresAt = new Date(rawExpires);
  }

  await prisma.announcement.create({
    data: {
      schoolId: ctx.schoolId,
      title,
      content,
      targetRoles: rawRoles,
      isSticky,
      publishedAt,
      expiresAt,
    },
  });

  revalidatePath("/announcements");
  return { success: `Announcement "${title}" created.` };
}

export async function deleteAnnouncementAction(id: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  await prisma.announcement.deleteMany({ where: { id, schoolId: ctx.schoolId } });
  revalidatePath("/announcements");
  return { success: "Announcement deleted." };
}
