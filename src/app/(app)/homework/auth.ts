"use server";

import { resolvePermissions } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

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

export async function requireStudentSelf(): Promise<{ studentId: string; schoolId: string } | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student" || !user.schoolId) return null;
  const student = await prisma.student.findFirst({
    where: { userId: user.userId, schoolId: user.schoolId },
    select: { id: true, schoolId: true },
  });
  if (!student) return null;
  return { studentId: student.id, schoolId: student.schoolId };
}
