"use server";

import { resolvePermissions } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function requireHomeworkManager(): Promise<{ schoolId: string; user: { userId: string } } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const ctx = await resolvePermissions(user);
  const allowed =
    ctx.isSuperAdmin || ctx.isSchoolAdmin ||
    ctx.assignments.some((a) => a.type === "subject_teacher" || a.type === "class_teacher");
  if (!allowed || !user.schoolId) return null;
  return { schoolId: user.schoolId, user: { userId: user.userId } };
}
