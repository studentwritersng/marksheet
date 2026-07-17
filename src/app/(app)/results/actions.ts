"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/actions";
import { hookResultPublished } from "@/lib/notifications/event-hooks";
import { computeClassResults, persistResults } from "@/lib/results/compute";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Compute and store results for a class/term.
 */
export async function computeResultsAction(
  classId: string,
  termId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const results = await computeClassResults({
    schoolId: ctx.schoolId,
    classId,
    termId,
  });

  if (results.length === 0) {
    return { error: "No data to compute. Ensure exams have been submitted." };
  }

  await persistResults(ctx.schoolId, termId, results);

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "subject_result",
    afterValue: { classId, termId, studentsComputed: results.length } as never,
  });

  revalidatePath("/results");
  return { success: `Results computed for ${results.length} student(s).` };
}

/**
 * Finalize a term result (marks as finalised, generates verification code).
 */
export async function finalizeTermResultsAction(
  termId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const { getSchoolFeeGateConfig, getStudentFeeStatus } = await import("@/lib/fees/gate");
  const feeGate = await getSchoolFeeGateConfig(ctx.schoolId);

  const termResults = await prisma.termResult.findMany({
    where: { termId, student: { schoolId: ctx.schoolId } },
    select: { id: true, studentId: true, student: { select: { userId: true, firstName: true, lastName: true } } },
  });

  if (termResults.length === 0) return { error: "No computed results to finalize." };

  await prisma.$transaction(async (tx) => {
    for (const tr of termResults) {
      let finalStatus = "finalised";
      let skipCode = false;

      if (feeGate.gateResults) {
        const feeStatus = await getStudentFeeStatus(tr.studentId, termId);
        if (feeStatus === "not_cleared") {
          finalStatus = "withheld";
          skipCode = true;
        }
      }

      await tx.termResult.update({
        where: { id: tr.id },
        data: { status: finalStatus, finalizedAt: new Date() },
      });

      if (!skipCode) {
        const existing = await tx.verificationCode.findFirst({
          where: { termResultId: tr.id },
        });
        if (!existing) {
          await tx.verificationCode.create({
            data: {
              termResultId: tr.id,
              code: generateVerificationCode(),
              status: "active",
            },
          });
        }
      }
    }
  });

  // Notify students
  const term = await prisma.term.findUnique({ where: { id: termId }, select: { name: true } });
  await Promise.all(
    termResults
      .filter((tr) => tr.student.userId)
      .map((tr) =>
        createNotification({
          schoolId: ctx.schoolId,
          recipientType: "student",
          recipientId: tr.student.userId!,
          eventType: "result_published",
          title: "Results Published",
          content: `Your ${term?.name ?? ""} term results have been published. Check your results now.`,
        })
      )
  );

  // Fire WhatsApp/SMS notification hook for parents
  hookResultPublished(
    ctx.schoolId,
    termId,
    term?.name ?? "",
    termResults.filter((tr) => tr.student.userId).map((tr) => tr.studentId),
  );

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "term_result",
    afterValue: { status: "finalised", termId } as never,
  });

  revalidatePath("/results");
  return { success: `${termResults.length} result(s) finalised with verification codes.` };
}

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MS-";
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
