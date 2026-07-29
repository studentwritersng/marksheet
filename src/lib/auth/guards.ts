import { getCurrentUser } from "./current-user";
import { resolvePermissions, canManageSchool } from "./permissions";
import type { SessionPayload } from "./session";
import type { EffectivePermissions } from "./permissions";

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

export function canReviewExams(p: EffectivePermissions): boolean {
  return p.isExamOfficer || p.isSchoolAdmin || p.isSuperAdmin;
}

export function canPublishExams(p: EffectivePermissions): boolean {
  return p.isSchoolAdmin || p.isSuperAdmin;
}
