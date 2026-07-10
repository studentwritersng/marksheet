import { prisma } from "@/lib/prisma";
import type { AssignmentType } from "@prisma/client";
import type { SessionPayload } from "./session";

/**
 * Permission resolution (PRD 02).
 * Effective permissions for a staff member = the UNION of all their active
 * assignments for the current session/term. Roles are assignment-based, not
 * fixed labels. Temporary assignments layer on top and expire at end_date.
 */

export interface ResolvedAssignment {
  id: string;
  type: AssignmentType;
  subjectId: string | null;
  classId: string | null;
  isTemporary: boolean;
}

export interface EffectivePermissions {
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isExamOfficer: boolean;
  isFeeStatusManager: boolean;
  assignments: ResolvedAssignment[];
  // Distinct scope sets derived from assignments
  subjectTeacherClassIds: Set<string>;
  subjectTeacherSubjectIds: Set<string>;
  classTeacherClassIds: Set<string>;
  hodSubjectIds: Set<string>;
  visibleSubjectIds: Set<string>;
  visibleClassIds: Set<string>;
}

/**
 * Resolve the active assignments for a staff member within the current
 * session/term of their school. "Active" = not expired temporary, and
 * belonging to the current session (or session-wide when termId is null).
 */
export async function resolvePermissions(
  user: SessionPayload,
): Promise<EffectivePermissions> {
  const empty: EffectivePermissions = {
    isSuperAdmin: user.role === "super_admin" || user.role === "platform_owner",
    isSchoolAdmin: false,
    isExamOfficer: false,
    isFeeStatusManager: false,
    assignments: [],
    subjectTeacherClassIds: new Set(),
    subjectTeacherSubjectIds: new Set(),
    classTeacherClassIds: new Set(),
    hodSubjectIds: new Set(),
    visibleSubjectIds: new Set(),
    visibleClassIds: new Set(),
  };

  if (user.role === "super_admin" || user.role === "platform_owner") return empty;
  if (!user.staffId || !user.schoolId) return empty;

  // Current session for this school.
  const currentSession = await prisma.session.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
    select: { id: true },
  });

  const now = new Date();
  const assignments = await prisma.assignment.findMany({
    where: {
      staffId: user.staffId,
      schoolId: user.schoolId,
      // session-scoped or global assignments
      OR: [
        { sessionId: currentSession?.id ?? undefined },
        { sessionId: null },
      ],
      // temporary assignments must be within their active window
      AND: [
        {
          OR: [
            { isTemporary: false },
            { isTemporary: true, startDate: { lte: now }, endDate: { gte: now } },
            { isTemporary: true, startDate: null, endDate: null },
          ],
        },
      ],
    },
    select: {
      id: true,
      assignmentType: true,
      subjectId: true,
      classId: true,
      isTemporary: true,
    },
  });

  const result: EffectivePermissions = {
    ...empty,
    assignments: assignments.map((a) => ({
      id: a.id,
      type: a.assignmentType,
      subjectId: a.subjectId,
      classId: a.classId,
      isTemporary: a.isTemporary,
    })),
    subjectTeacherClassIds: new Set(),
    subjectTeacherSubjectIds: new Set(),
    classTeacherClassIds: new Set(),
    hodSubjectIds: new Set(),
    visibleSubjectIds: new Set(),
    visibleClassIds: new Set(),
  };

  for (const a of assignments) {
    switch (a.assignmentType) {
      case "school_admin":
        result.isSchoolAdmin = true;
        break;
      case "exam_officer":
        result.isExamOfficer = true;
        break;
      case "fee_status_manager":
        result.isFeeStatusManager = true;
        break;
      case "subject_teacher":
        if (a.classId) {
          result.subjectTeacherClassIds.add(a.classId);
          result.visibleClassIds.add(a.classId);
        }
        if (a.subjectId) {
          result.subjectTeacherSubjectIds.add(a.subjectId);
          result.visibleSubjectIds.add(a.subjectId);
        }
        break;
      case "class_teacher":
        if (a.classId) {
          result.classTeacherClassIds.add(a.classId);
          result.visibleClassIds.add(a.classId);
        }
        break;
      case "hod":
        if (a.subjectId) {
          result.hodSubjectIds.add(a.subjectId);
          result.visibleSubjectIds.add(a.subjectId);
        }
        break;
    }
  }

  return result;
}

/** School Admin OR Super Admin — full school-level management access. */
export function canManageSchool(p: EffectivePermissions): boolean {
  return p.isSuperAdmin || p.isSchoolAdmin;
}
