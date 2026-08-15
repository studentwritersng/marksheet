import { getCurrentUser } from "./current-user";
import { resolvePermissions, canManageSchool } from "./permissions";
import type { SessionPayload } from "./session";
import type { EffectivePermissions } from "./permissions";

export { canManageSchool }; // re-export for guard consumers

export interface AdminContext {
  user: SessionPayload;
  perms: EffectivePermissions;
  schoolId: string;
}

/**
 * Ensures the caller is a School Admin (or Super Admin acting within a school).
 * Throws on failure. Use in server actions guarding school-level mutations.
 */
export async function requireSchoolAdmin(): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) throw new Error("FORBIDDEN");
  if (!user.schoolId) throw new Error("NO_SCHOOL_SCOPE");
  return { user, perms, schoolId: user.schoolId };
}

/**
 * Ensures the caller is a staff member of the school — a School Admin or a
 * teacher with active subject/class/HoD assignments. Throws on failure.
 * Use for feature workflows like lesson notes and question banks that the
 * school dashboard already opens to teachers.
 */
export async function requireSchoolStaff(): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  const isTeacher =
    perms.subjectTeacherSubjectIds.size > 0 ||
    perms.classTeacherClassIds.size > 0 ||
    perms.hodSubjectIds.size > 0;
  if (!(canManageSchool(perms) || isTeacher)) throw new Error("FORBIDDEN");
  if (!user.schoolId) throw new Error("NO_SCHOOL_SCOPE");
  return { user, perms, schoolId: user.schoolId };
}

/**
 * Ensures the caller is an Exam Officer or School Admin (review-capable role).
 * Throws on failure. Use in server actions guarding exam review/approval.
 */
export async function requireExamReviewer(): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  if (!canReviewExams(perms)) throw new Error("FORBIDDEN");
  if (!user.schoolId) throw new Error("NO_SCHOOL_SCOPE");
  return { user, perms, schoolId: user.schoolId };
}

/**
 * Whether the caller may act within a given class. Admins always pass; other
 * staff must hold a subject-teacher or class-teacher assignment for it.
 */
export function canAccessClass(
  p: EffectivePermissions,
  classId: string | null | undefined,
): boolean {
  if (canManageSchool(p)) return true;
  return !!classId && p.visibleClassIds.has(classId);
}

/**
 * Whether the caller may act within a given subject. Admins always pass; other
 * staff must hold a subject-teacher or HoD assignment for it.
 */
export function canAccessSubject(
  p: EffectivePermissions,
  subjectId: string | null | undefined,
): boolean {
  if (canManageSchool(p)) return true;
  return !!subjectId && p.visibleSubjectIds.has(subjectId);
}

export function canReviewExams(p: EffectivePermissions): boolean {
  return p.isExamOfficer || p.isSchoolAdmin || p.isSuperAdmin;
}

export function canPublishExams(p: EffectivePermissions): boolean {
  return p.isSchoolAdmin || p.isSuperAdmin;
}
