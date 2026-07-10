import { prisma } from "@/lib/prisma";

export interface LicenseCheckResult {
  valid: boolean;
  status: string | null;
  daysRemaining: number | null;
  message: string;
}

/**
 * Check whether a school has an active license.
 * Enforces: active → full access; grace_period → full access with warnings;
 * expired/suspended/no-license → mutation blocked.
 *
 * This function queries the database every time — it must, per PRD 15 §4.4:
 * "All license enforcement must be checked server-side against the database on
 * every relevant request — never rely on a client-stored value."
 */
export async function requireActiveLicense(
  schoolId: string,
  gracePeriodDays: number = 7,
): Promise<LicenseCheckResult> {
  const now = new Date();

  const license = await prisma.schoolLicense.findFirst({
    where: { schoolId, status: { in: ["active", "grace_period"] } },
    orderBy: { endDate: "desc" },
    select: { status: true, endDate: true },
  });

  // No license at all → block
  if (!license) {
    return {
      valid: false,
      status: null,
      daysRemaining: null,
      message: "No license assigned. Contact the platform owner to activate your school.",
    };
  }

  const daysRemaining = Math.ceil(
    (license.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Grace period: endDate already passed but status still grace_period
  if (license.status === "grace_period" && daysRemaining < -gracePeriodDays) {
    // Grace period exhausted — auto-expire and block
    await prisma.schoolLicense.updateMany({
      where: { schoolId, status: "grace_period" },
      data: { status: "expired" },
    });
    return {
      valid: false,
      status: "expired",
      daysRemaining,
      message: "Your school's license has expired. Contact the platform owner to renew.",
    };
  }

  // Active license → always valid
  if (license.status === "active" && daysRemaining >= 0) {
    return {
      valid: true,
      status: "active",
      daysRemaining,
      message: "",
    };
  }

  // Grace period (endDate may be slightly in the past, but within grace window)
  if (license.status === "grace_period") {
    return {
      valid: true,
      status: "grace_period",
      daysRemaining,
      message: `Your license expired ${Math.abs(daysRemaining)} day(s) ago. Renew within ${gracePeriodDays} days to avoid service interruption.`,
    };
  }

  // Past endDate and status is active — auto-transition to grace
  if (license.status === "active" && daysRemaining < 0) {
    await prisma.schoolLicense.updateMany({
      where: { schoolId, status: "active" },
      data: { status: "grace_period" },
    });
    return {
      valid: true,
      status: "grace_period",
      daysRemaining,
      message: `Your license expired ${Math.abs(daysRemaining)} day(s) ago. You are in a ${gracePeriodDays}-day grace period.`,
    };
  }

  // Fallback — should not reach here
  return {
    valid: false,
    status: license.status,
    daysRemaining,
    message: "Access restricted. Contact the platform owner.",
  };
}

/**
 * Convenience wrapper that throws an error if the school's license is invalid.
 * Use in server actions next to requireSchoolAdmin().
 */
export async function guardActiveLicense(schoolId: string): Promise<void> {
  const result = await requireActiveLicense(schoolId);
  if (!result.valid) {
    throw new Error(result.message);
  }
}
