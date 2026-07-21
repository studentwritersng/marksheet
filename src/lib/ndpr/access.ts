/**
 * NDPR data access control utilities.
 *
 * Guardian contact details (phone, address) and passport photos are
 * sensitive personal data. They must be visible only to:
 *   - School Admin
 *   - The student's Class Teacher
 *   - Roles with an explicit school-configured exception
 *
 * Any access outside these roles should be logged as an access event.
 */
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import type { EffectivePermissions } from "@/lib/auth/permissions";

export interface SensitiveStudentData {
  passportPhoto?: string | null;
  guardianPhones?: string[];
  guardianEmails?: string[];
  guardianAddresses?: string[];
}

/**
 * Check if the current user is permitted to view a given student's
 * sensitive personal data (guardian contact, passport photo).
 */
export function canViewSensitiveData(
  permissions: EffectivePermissions,
  studentClassId: string | null,
): boolean {
  // School Admin / Super Admin can always view
  if (permissions.isSuperAdmin || permissions.isSchoolAdmin) return true;

  // Class Teacher of this student's class can view
  if (studentClassId && permissions.classTeacherClassIds.has(studentClassId)) return true;

  return false;
}

/**
 * Retrieve sensitive student data, logging the access event.
 * Returns only non-sensitive data if the user is not permitted.
 */
export async function getSensitiveStudentData(
  studentId: string,
  permissions: EffectivePermissions,
  actorId: string,
  schoolId: string,
): Promise<SensitiveStudentData> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      passportPhoto: true,
      currentClassId: true,
      guardians: { select: { phone: true, email: true } },
    },
  });

  if (!student) return {};

  const allowed = canViewSensitiveData(permissions, student.currentClassId);

  if (!allowed) {
    // Log the access attempt as an audit event
    await recordAudit({
      schoolId,
      actorId,
      action: "access",
      entityType: "sensitive_student_data",
      entityId: studentId,
      afterValue: { permitted: false } as never,
    });

    return {}; // Return no sensitive data
  }

  // Log successful access to sensitive data
  await recordAudit({
    schoolId,
    actorId,
    action: "access",
    entityType: "sensitive_student_data",
    entityId: studentId,
    afterValue: { permitted: true } as never,
  });

  return {
    passportPhoto: student.passportPhoto,
    guardianPhones: student.guardians.map((g) => g.phone).filter(Boolean) as string[],
    guardianEmails: student.guardians.map((g) => g.email).filter(Boolean) as string[],
  };
}
