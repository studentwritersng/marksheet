"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LANDING_STAT_DEFAULTS } from "@/lib/landing-stats";

export interface LandingStatsActionResult {
  error?: string;
  success?: string;
}

const KNOWN_KEYS = LANDING_STAT_DEFAULTS.map((d) => d.key);

export async function updateLandingStatAction(
  _prev: LandingStatsActionResult,
  formData: FormData,
): Promise<LandingStatsActionResult> {
  let user;
  try {
    user = await getCurrentUser();
    if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  } catch {
    return { error: "Not authorised." };
  }

  const id = (formData.get("statId") as string)?.trim();
  if (!id) return { error: "Missing stat." };

  const stat = await prisma.landingStat.findUnique({ where: { id } });
  if (!stat) return { error: "Stat not found." };

  const label = (formData.get("label") as string)?.trim() || stat.label;
  const valueSourceRaw = (formData.get("valueSource") as string)?.trim();
  const manualValue = (formData.get("manualValue") as string)?.trim() ?? "";
  const enabled = (formData.get("enabled") as string) === "on";

  if (!valueSourceRaw || !["auto", "manual"].includes(valueSourceRaw)) {
    return { error: "Invalid value source." };
  }
  const valueSource = valueSourceRaw as "auto" | "manual";

  // Only allow known stat keys to keep the DB clean.
  if (!KNOWN_KEYS.includes(stat.key)) {
    return { error: "Unrecognised stat." };
  }

  const beforeValue = {
    label: stat.label,
    valueSource: stat.valueSource,
    manualValue: stat.manualValue,
    enabled: stat.enabled,
  };

  await prisma.landingStat.update({
    where: { id },
    data: { label, valueSource, manualValue, enabled },
  });

  await recordAudit({
    actorId: user.userId,
    action: "update",
    entityType: "landing_stat",
    entityId: id,
    beforeValue: beforeValue as unknown as Record<string, unknown>,
    afterValue: { label, valueSource, manualValue, enabled } as unknown as Record<string, unknown>,
  });

  revalidatePath("/console/landing-stats");
  revalidatePath("/");
  return { success: "Stat updated. The landing page reflects it immediately." };
}
