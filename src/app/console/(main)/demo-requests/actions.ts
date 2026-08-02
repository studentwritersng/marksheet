"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePlatformOwner } from "@/lib/auth/platform-owner";

export interface DemoRequestActionResult {
  error?: string;
  success?: string;
}

const VALID_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;
type DemoStatus = (typeof VALID_STATUSES)[number];

export async function updateDemoRequestStatusAction(demoRequestId: string, status: string): Promise<DemoRequestActionResult> {
  try { await requirePlatformOwner(); } catch { return { error: "Not authorised." }; }
  if (!VALID_STATUSES.includes(status as DemoStatus)) return { error: "Invalid status." };
  await prisma.demoRequest.update({ where: { id: demoRequestId }, data: { status: status as DemoStatus } });
  revalidatePath("/console/demo-requests");
  return { success: "Status updated." };
}

export async function deleteDemoRequestAction(demoRequestId: string): Promise<DemoRequestActionResult> {
  try { await requirePlatformOwner(); } catch { return { error: "Not authorised." }; }
  await prisma.demoRequest.delete({ where: { id: demoRequestId } });
  revalidatePath("/console/demo-requests");
  return { success: "Demo request deleted." };
}
