"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageFees } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

async function withContext(): Promise<{ user: Awaited<ReturnType<typeof getCurrentUser>>; schoolId: string } | null> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return null;
  const perms = await resolvePermissions(user);
  if (!canManageFees(perms)) return null;
  return { user, schoolId: user.schoolId };
}

export async function createPaymentAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await withContext();
  if (!ctx) return { error: "Not authorised." };

  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const studentId = String(fd.get("studentId") ?? "");
  const termId = String(fd.get("termId") ?? "");
  const amount = Number(fd.get("amount"));
  const note = String(fd.get("note") ?? "").trim() || null;
  const dateRaw = String(fd.get("date") ?? "").trim();

  if (!studentId || !termId || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Student, term, and a positive amount are required." };
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!student) return { error: "Student not found." };

  const data: Prisma.StudentPaymentUncheckedCreateInput = {
    schoolId: ctx.schoolId,
    studentId,
    termId,
    amount: new Prisma.Decimal(amount),
    note: note ?? undefined,
    recordedBy: ctx.user!.userId,
  };

  await prisma.studentPayment.create({ data });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "create",
    entityType: "student_payment",
    entityId: studentId,
    afterValue: { termId, amount, note, date: dateRaw || undefined } as never,
  });

  revalidatePath("/fees/payments");
  return { success: "Payment recorded." };
}
