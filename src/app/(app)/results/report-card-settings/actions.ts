"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import type { ReportCardConfig } from "./types";
import { DEFAULT_RC_CONFIG } from "./types";

export async function getReportCardConfig(schoolId: string): Promise<ReportCardConfig> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId || user.schoolId !== schoolId) return { ...DEFAULT_RC_CONFIG };
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { letterheadSettings: true },
  });
  const stored = (school?.letterheadSettings as Record<string, unknown> | null)
    ?.reportCardConfig as Partial<ReportCardConfig> | undefined;
  return { ...DEFAULT_RC_CONFIG, ...stored };
}

export async function saveReportCardConfigAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "License error." };
  }

  const bool = (key: string) => formData.get(key) === "on";

  const config: ReportCardConfig = {
    showAttendance:       bool("showAttendance"),
    showAffective:        bool("showAffective"),
    showPosition:         bool("showPosition"),
    showGrade:            bool("showGrade"),
    showRemark:           bool("showRemark"),
    showCumulativeAverage:bool("showCumulativeAverage"),
    showTeacherComment:   bool("showTeacherComment"),
    showPrincipalComment: bool("showPrincipalComment"),
    showStamp:            bool("showStamp"),
    showSignatures:       bool("showSignatures"),
    showGradingKey:       bool("showGradingKey"),
    showPassportPhoto:    bool("showPassportPhoto"),
    showWatermarkLogo:    bool("showWatermarkLogo"),
  };

  const school = await prisma.school.findUnique({
    where: { id: ctx.schoolId },
    select: { letterheadSettings: true },
  });
  const existing = (school?.letterheadSettings as Record<string, unknown> | null) ?? {};
  await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { letterheadSettings: { ...existing, reportCardConfig: config } as never },
  });

  revalidatePath("/results/report-card-settings");
  revalidatePath("/results");
  return { success: "Report card settings saved." };
}
