"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { TermName } from "@prisma/client";

export interface ActionState {
  error?: string;
  success?: string;
}

const THREE_TERMS: TermName[] = [
  TermName.First,
  TermName.Second,
  TermName.Third,
];

/**
 * Create a Session — auto-generates exactly 3 Terms with editable default
 * dates. The count of 3 is fixed.
 */
export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const label = String(formData.get("label") ?? "").trim();
  if (!/^\d{4}\/\d{4}$/.test(label)) {
    return { error: "Label must be in the form YYYY/YYYY (e.g. 2025/2026)." };
  }

  const existing = await prisma.session.findUnique({
    where: { schoolId_label: { schoolId: ctx.schoolId, label } },
  });
  if (existing) return { error: `Session ${label} already exists.` };

  const startYear = Number(label.slice(0, 4));

  const session = await prisma.session.create({
    data: {
      schoolId: ctx.schoolId,
      label,
      status: "upcoming",
      terms: {
        create: THREE_TERMS.map((name, i) => ({
          name,
          // Default, editable date ranges spanning the Nigerian calendar.
          startDate: new Date(startYear, 8 + i * 4, 15),
          endDate: new Date(startYear, 11 + i * 4, 15),
        })),
      },
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "session",
    entityId: session.id,
    afterValue: { label, status: "upcoming" },
  });

  revalidatePath("/sessions");
  return { success: `Session ${label} created with 3 terms.` };
}

/**
 * Mark a session current — closes the previously current session.
 * The confirmation prompt lives in the UI; this action performs the switch.
 */
export async function setCurrentSessionAction(
  sessionId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const target = await prisma.session.findFirst({
    where: { id: sessionId, schoolId: ctx.schoolId },
  });
  if (!target) return { error: "Session not found." };

  await prisma.$transaction(async (tx) => {
    // Close whatever is currently active/current.
    await tx.session.updateMany({
      where: { schoolId: ctx.schoolId, isCurrent: true },
      data: { isCurrent: false, status: "closed" },
    });
    await tx.session.update({
      where: { id: sessionId },
      data: { isCurrent: true, status: "active" },
    });
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "session",
    entityId: sessionId,
    afterValue: { isCurrent: true, status: "active" },
  });

  revalidatePath("/sessions");
  return { success: `${target.label} is now the current session.` };
}

/** Explicit admin switch of the current term (not date-driven). */
export async function setCurrentTermAction(
  termId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term || term.session.schoolId !== ctx.schoolId) {
    return { error: "Term not found." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.term.updateMany({
      where: { sessionId: term.sessionId, isCurrent: true },
      data: { isCurrent: false },
    });
    await tx.term.update({ where: { id: termId }, data: { isCurrent: true } });
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "term",
    entityId: termId,
    afterValue: { isCurrent: true },
  });

  revalidatePath("/sessions");
  return { success: `${term.name} Term is now current.` };
}

/** Edit term start/end dates. */
export async function updateTermDatesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const termId = String(formData.get("termId") ?? "");
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term || term.session.schoolId !== ctx.schoolId) {
    return { error: "Term not found." };
  }

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (startDate && endDate && startDate > endDate) {
    return { error: "Start date must be before end date." };
  }

  const before = { startDate: term.startDate, endDate: term.endDate };
  await prisma.term.update({
    where: { id: termId },
    data: { startDate, endDate },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "term",
    entityId: termId,
    beforeValue: before as never,
    afterValue: { startDate, endDate } as never,
  });

  revalidatePath("/sessions");
  return { success: `${term.name} Term dates updated.` };
}
