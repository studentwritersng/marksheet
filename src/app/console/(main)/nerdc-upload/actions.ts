"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";

async function guardOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("FORBIDDEN");
}

export interface UploadState { error?: string; success?: string; lineCount?: number }

export async function uploadNerdcAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  try { await guardOwner(); } catch { return { error: "Not authorised." }; }

  const content = formData.get("content") as string;
  if (!content || content.trim().length < 100) {
    return { error: "File content is empty or too short. Upload a valid nerdc.md file." };
  }

  // Upsert: there should only ever be one row
  const existing = await prisma.nerdcContent.findFirst({ orderBy: { createdAt: "desc" } });

  if (existing) {
    await prisma.nerdcContent.update({ where: { id: existing.id }, data: { content } });
  } else {
    await prisma.nerdcContent.create({ data: { content } });
  }

  const lines = content.split("\n").length;
  revalidatePath("/console/curriculum");
  revalidatePath("/console/nerdc-upload");
  return { success: "NERDC syllabus uploaded.", lineCount: lines };
}

export async function getNerdcContentAction(): Promise<string | null> {
  try { await guardOwner(); } catch { return null; }
  const row = await prisma.nerdcContent.findFirst({ orderBy: { createdAt: "desc" } });
  return row?.content ?? null;
}
