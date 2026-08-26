"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageFees } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import {
  getStudentFeeSummaryBatch,
  buildFeeReminderContent,
  type WardLine,
} from "@/lib/fees/bursary";
import { createNotification } from "@/lib/notifications/actions";

export interface ActionState {
  error?: string;
  success?: string;
}

async function requireBursar() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  if (!canManageFees(perms) || !user.schoolId) throw new Error("FORBIDDEN");
  return { user, schoolId: user.schoolId };
}

interface GuardianGroup {
  parentUserId?: string;
  email?: string;
  name?: string;
  wards: WardLine[];
}

/**
 * Group students who owe (expected > paid, with a fee structure) by guardian.
 * Shared by both the "Send now" action and the server-rendered preview.
 */
async function groupOwingGuardians(
  schoolId: string,
  termId: string,
  classId?: string,
): Promise<Map<string, GuardianGroup>> {
  const students = await prisma.student.findMany({
    where: { schoolId, ...(classId ? { currentClassId: classId } : {}) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentClass: { select: { name: true } },
      guardians: {
        select: { parentUserId: true, email: true, fullName: true },
      },
    },
  });
  const summaries = await getStudentFeeSummaryBatch(schoolId, termId);
  const guardByParent = new Map<string, GuardianGroup>();
  for (const s of students) {
    const sum = summaries.get(s.id);
    if (!sum || !sum.hasStructure || sum.balance <= 0) continue; // only owing + structured
    for (const g of s.guardians) {
      const key = g.parentUserId ?? g.email ?? "";
      if (!key) continue;
      if (!guardByParent.has(key)) {
        guardByParent.set(key, {
          parentUserId: g.parentUserId ?? undefined,
          email: g.email ?? undefined,
          name: g.fullName,
          wards: [],
        });
      }
      guardByParent.get(key)!.wards.push({
        name: `${s.firstName} ${s.lastName}`,
        className: s.currentClass?.name ?? "",
        expected: sum.expected,
        paid: sum.paid,
        balance: sum.balance,
      });
    }
  }
  return guardByParent;
}

/**
 * Send fee reminders to every owing guardian of a school for a term.
 * Exported + callable WITHOUT a request context (server-side cron) — no
 * requireX() guard here; takes explicit schoolId/termId and uses prisma
 * directly. Delivers BOTH an in-app/push notification (channel "in_app" rides
 * push via after()) and an email (channel "email") per guardian.
 */
export async function sendRemindersForSchool(
  schoolId: string,
  termId: string,
  classId?: string,
): Promise<{ sentPush: number; sentEmail: number; failed: number }> {
  // Guard against an empty/missing school or term.
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  });
  if (!school) return { sentPush: 0, sentEmail: 0, failed: 0 };
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { id: true },
  });
  if (!term) return { sentPush: 0, sentEmail: 0, failed: 0 };

  const guardByParent = await groupOwingGuardians(schoolId, termId, classId);
  let sentPush = 0,
    sentEmail = 0,
    failed = 0;
  for (const g of guardByParent.values()) {
    const content = buildFeeReminderContent(g.wards);
    if (g.parentUserId) {
      await createNotification({
        schoolId,
        recipientType: "parent",
        recipientId: g.parentUserId,
        eventType: "fee_reminder",
        title: "Fee Reminder",
        content,
        channel: "in_app",
      });
      sentPush++;
    }
    if (g.email) {
      await createNotification({
        schoolId,
        recipientType: "parent",
        recipientId: g.parentUserId ?? "",
        recipientEmail: g.email,
        eventType: "fee_reminder",
        title: "Fee Reminder",
        content,
        channel: "email",
      });
      sentEmail++;
    }
    if (!g.parentUserId && !g.email) failed++;
  }
  return { sentPush, sentEmail, failed };
}

export async function sendRemindersAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  let ctx: Awaited<ReturnType<typeof requireBursar>>;
  try {
    ctx = await requireBursar();
  } catch {
    return { error: "Not authorised." };
  }
  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const termId = String(fd.get("termId") ?? "");
  const classId = String(fd.get("classId") ?? "") || undefined;
  if (!termId) return { error: "Active term is required." };

  const res = await sendRemindersForSchool(ctx.schoolId, termId, classId);
  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "fee_reminders_sent",
    afterValue: res as never,
  });
  revalidatePath("/fees/reminders");
  return {
    success: `Sent ${res.sentPush} push / ${res.sentEmail} email · ${res.failed} failed.`,
  };
}

// Alias kept so any caller referencing the brief's name still resolves.
export const sendFeeRemindersAction = sendRemindersAction;

export async function updateReminderConfigAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  let ctx: Awaited<ReturnType<typeof requireBursar>>;
  try {
    ctx = await requireBursar();
  } catch {
    return { error: "Not authorised." };
  }
  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const weeklyEnabled = fd.get("weeklyEnabled") === "on";
  const dayOfWeek = Number(fd.get("dayOfWeek") ?? 1);
  await prisma.feeReminderConfig.upsert({
    where: { schoolId: ctx.schoolId },
    update: { weeklyEnabled, dayOfWeek },
    create: { schoolId: ctx.schoolId, weeklyEnabled, dayOfWeek },
  });
  revalidatePath("/fees/reminders");
  return { success: "Reminder schedule updated." };
}
