/**
 * Fee status gating utilities.
 */
import { prisma } from "@/lib/prisma";

export interface FeeGateConfig {
  gateExams: boolean;
  gateResults: boolean;
}

export async function getSchoolFeeGateConfig(schoolId: string): Promise<FeeGateConfig> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { feeGateExams: true, feeGateResults: true },
  });
  return {
    gateExams: school?.feeGateExams ?? false,
    gateResults: school?.feeGateResults ?? false,
  };
}

export async function getStudentFeeStatus(studentId: string, termId: string): Promise<string> {
  const feeStatus = await prisma.feeStatus.findUnique({
    where: { studentId_termId: { studentId, termId } },
    select: { status: true },
  });
  return feeStatus?.status ?? "not_cleared";
}

/**
 * Check if a student can access an exam based on fee status.
 * Returns null if allowed, or an error message string if blocked.
 */
export async function checkExamFeeGate(
  schoolId: string,
  studentId: string,
  termId: string,
): Promise<string | null> {
  const config = await getSchoolFeeGateConfig(schoolId);
  if (!config.gateExams) return null;

  const status = await getStudentFeeStatus(studentId, termId);
  if (status === "not_cleared") {
    return "Please see the school office regarding your account status.";
  }
  return null;
}

/**
 * Check if a student's results should be visible based on fee status.
 * Returns true if results are visible (allowed), false if blocked.
 */
export async function isResultVisibleByFeeGate(
  schoolId: string,
  studentId: string,
  termId: string,
): Promise<boolean> {
  const config = await getSchoolFeeGateConfig(schoolId);
  if (!config.gateResults) return true;

  const status = await getStudentFeeStatus(studentId, termId);
  return status !== "not_cleared";
}
