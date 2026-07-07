"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
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

  const termResults = await prisma.termResult.findMany({
    where: { termId, student: { schoolId: ctx.schoolId } },
    select: { id: true, studentId: true },
  });

  if (termResults.length === 0) return { error: "No computed results to finalize." };

  await prisma.$transaction(async (tx) => {
    await tx.termResult.updateMany({
      where: { termId, student: { schoolId: ctx.schoolId } },
      data: { status: "finalised", finalizedAt: new Date() },
    });

    for (const tr of termResults) {
      // Generate verification code (PRD 09)
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
  });

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
