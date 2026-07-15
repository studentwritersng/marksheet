"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { defaultGradingScale, type GradeBand } from "@/lib/grading-scale";

export interface GradingScaleState {
  error?: string;
  success?: string;
}

export async function saveGradingScaleAction(
  _prev: GradingScaleState,
  formData: FormData,
): Promise<GradingScaleState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const bandsJson = formData.get("bands") ?? "[]";
  let bands: GradeBand[];
  try {
    bands = JSON.parse(bandsJson as string);
  } catch {
    return { error: "Invalid grading scale data." };
  }

  if (!Array.isArray(bands) || bands.length === 0) {
    return { error: "At least one grade band is required." };
  }

  for (const b of bands) {
    if (!b.grade || typeof b.min !== "number" || typeof b.max !== "number") {
      return { error: `Invalid band: ${b.grade ?? "missing grade"}` };
    }
    if (b.min > b.max) {
      return { error: `Min cannot exceed max for grade ${b.grade}.` };
    }
  }

  // Validate bands don't overlap and cover 0-100
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  let prevMin = 101;
  for (const b of sorted) {
    if (b.max >= prevMin) {
      return { error: `Overlapping bands detected for grade ${b.grade}.` };
    }
    prevMin = b.min;
  }

  await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { gradingScale: bands as never },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "grading_scale",
    afterValue: { bands } as never,
  });

  revalidatePath("/grading-scale");
  return { success: "Grading scale saved." };
}

export async function resetGradingScaleAction(): Promise<GradingScaleState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { gradingScale: defaultGradingScale as never },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "reset",
    entityType: "grading_scale",
  });

  revalidatePath("/grading-scale");
  return { success: "Grading scale reset to default." };
}
