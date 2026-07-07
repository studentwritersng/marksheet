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
