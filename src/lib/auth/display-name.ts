import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "./session";

/**
 * Resolves the best display name for a logged-in user.
 *
 * The User model intentionally has no name column — names live on the
 * role-specific records (Staff, Student, Guardian). Every greeting / header
 * surface should use this instead of falling back to `user.email`.
 *
 * Falls back to the email local-part only when no name record exists
 * (e.g. a platform-level super admin without a staff profile).
 */
export async function resolveDisplayName(user: SessionPayload): Promise<string> {
  const emailFallback = user.email.split("@")[0];

  try {
    // Staff roles (school admin, teacher, exam officer...) — linked staff record
    if (user.staffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: user.staffId },
        select: { fullName: true },
      });
      if (staff?.fullName) return staff.fullName;
    } else if (user.schoolId) {
      const staff = await prisma.staff.findFirst({
        where: { schoolId: user.schoolId, email: user.email },
        select: { fullName: true },
      });
      if (staff?.fullName) return staff.fullName;
    }

    if (user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { userId: user.userId },
        select: { firstName: true, lastName: true },
      });
      if (student) return `${student.firstName} ${student.lastName}`.trim();
    }

    if (user.role === "parent") {
      const guardian = await prisma.guardian.findFirst({
        where: { parentUserId: user.userId },
        select: { fullName: true },
      });
      if (guardian?.fullName) return guardian.fullName;
    }
  } catch {
    // Never block the UI on a name lookup failure — fall back below.
  }

  return emailFallback;
}
