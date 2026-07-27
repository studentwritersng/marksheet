"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";

export interface ReportCardConfig {
  showAttendance: boolean;
  showAffective: boolean;
  showPosition: boolean;
  showGrade: boolean;
  showRemark: boolean;
  showCumulativeAverage: boolean;
  showTeacherComment: boolean;
  showPrincipalComment: boolean;
  showStamp: boolean;
  showSignatures: boolean;
  showGradingKey: boolean;
  showPassportPhoto: boolean;
  showWatermarkLogo: boolean;
}

export const DEFAULT_RC_CONFIG: ReportCardConfig = {
  showAttendance: true,
  showAffective: true,
  showPosition: true,
  showGrade: true,
  showRemark: true,
  showCumulativeAverage: true,
  showTeacherComment: true,
  showPrincipalComment: true,
  showStamp: true,
  showSignatures: true,
  showGradingKey: true,
  showPassportPhoto: true,
  showWatermarkLogo: true,
};

export async function getReportCardConfig(schoolId: string): Promise<ReportCardConfig> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { letterheadSettings: true },
  });
  const stored = (school?.letterheadSettings as any)?.reportCardConfig as Partial<ReportCardConfig> | undefined;
  return { ...DEFAULT_RC_CONFIG, ...stored };
}

export async function saveReportCardConfigAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const boolField = (key: string) => formData.get(key) === "on";

  const config: ReportCardConfig = {
    showAttendance: boolField("showAttendance"),
    showAffective: boolField("showAffective"),
    showPosition: boolField("showPosition"),
    showGrade: boolField("showGrade"),
    showRemark: boolField("showRemark"),
    showCumulativeAverage: boolField("showCumulativeAverage"),
    showTeacherComment: boolField("showTeacherComment"),
    showPrincipalComment: boolField("showPrincipalComment"),
    showStamp: boolField("showStamp"),
    showSignatures: boolField("showSignatures"),
    showGradingKey: boolField("showGradingKey"),
    showPassportPhoto: boolField("showPassportPhoto"),
    showWatermarkLogo: boolField("showWatermarkLogo"),
  };

  const school = await prisma.school.findUnique({
    where: { id: ctx.schoolId },
    select: { letterheadSettings: true },
  });
  const existing = (school?.letterheadSettings as any) ?? {};
  await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { letterheadSettings: { ...existing, reportCardConfig: config } },
  });

  revalidatePath("/results/report-card-settings");
  revalidatePath("/results");
  return { success: "Report card settings saved." };
}
