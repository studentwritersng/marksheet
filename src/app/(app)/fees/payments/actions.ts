"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { withContext, type ActionState } from "../actions";

export async function recordPaymentAction(
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
  const method = String(fd.get("method") ?? "cash");
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
    method,
    paymentDate: dateRaw ? new Date(dateRaw) : undefined,
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
    afterValue: { amount, method } as never,
  });

  revalidatePath("/fees/payments");
  return { success: "Payment recorded." };
}

export async function deletePaymentAction(
  id: string,
  _prev: ActionState,
  _fd: FormData,
): Promise<ActionState> {
  const ctx = await withContext();
  if (!ctx) return { error: "Not authorised." };

  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  if (!id) return { error: "Payment id is required." };

  const existing = await prisma.studentPayment.findFirst({
    where: { id, schoolId: ctx.schoolId },
    select: { id: true, studentId: true, amount: true, method: true },
  });
  if (!existing) return { error: "Payment not found." };

  await prisma.studentPayment.delete({ where: { id } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "delete",
    entityType: "student_payment",
    entityId: id,
    beforeValue: {
      studentId: existing.studentId,
      amount: existing.amount.toString(),
      method: existing.method,
    } as never,
  });

  revalidatePath("/fees/payments");
  return { success: "Payment deleted." };
}

export async function bulkRecordPaymentAction(
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

  // Accept a JSON array under "studentIds" or repeated "studentIds" fields.
  const rawIds = fd.get("studentIds");
  let studentIds: string[] = [];
  if (rawIds != null && String(rawIds).trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(String(rawIds));
      if (Array.isArray(parsed)) studentIds = parsed.map(String);
    } catch {
      studentIds = [];
    }
  } else {
    studentIds = fd.getAll("studentIds").map(String).filter(Boolean);
  }

  const termId = String(fd.get("termId") ?? "");
  const amount = Number(fd.get("amount"));
  const method = String(fd.get("method") ?? "cash");
  const note = String(fd.get("note") ?? "").trim() || null;

  if (
    studentIds.length === 0 ||
    !termId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return {
      error: "At least one student, a term, and a positive amount are required.",
    };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (students.length === 0) return { error: "No matching students found." };
  const validIds = students.map((s) => s.id);

  const data: Prisma.StudentPaymentUncheckedCreateInput[] = validIds.map(
    (studentId) => ({
      schoolId: ctx.schoolId,
      studentId,
      termId,
      amount: new Prisma.Decimal(amount),
      method,
      note: note ?? undefined,
      recordedBy: ctx.user!.userId,
    }),
  );

  await prisma.$transaction(
    data.map((d) => prisma.studentPayment.create({ data: d })),
  );

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "create",
    entityType: "student_payment_bulk",
    afterValue: {
      termId,
      studentIds: validIds,
      count: validIds.length,
      amount,
      method,
    } as never,
  });

  revalidatePath("/fees/payments");
  return { success: `Recorded ${validIds.length} payment(s).` };
}
