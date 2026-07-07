"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createCompletion } from "@/lib/ai/gateway";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function gradeEssayAnswersAction(examId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const pending = await prisma.studentAnswer.findMany({
    where: {
      gradingStatus: "ai_pending",
      essayResponseText: { not: null },
      attempt: { examId },
    },
    include: {
      question: {
        include: { essaySpec: true },
      },
      attempt: { include: { student: { select: { firstName: true, lastName: true } } } },
    },
  });

  if (pending.length === 0) return { error: "No pending essay answers for this exam." };

  let graded = 0;
  for (const answer of pending) {
    const spec = answer.question.essaySpec;
    const prompt = `You are grading a ${answer.question.marks}-mark essay question.
Question: ${answer.question.text}
Model answer / rubric: ${spec?.modelAnswer ?? "Not provided"}
Rubric points: ${JSON.stringify(spec?.rubricPoints ?? [])}

Student's response:
${answer.essayResponseText}

Provide a JSON response with:
- "score": a number out of ${answer.question.marks}
- "reasoning": a brief explanation
- "pointMatches": array of rubric points matched`;

    const result = await createCompletion({
      taskType: "essay_grading",
      messages: [
        { role: "system", content: "You are an expert examiner grading secondary school exam responses." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(result.content);
      await prisma.studentAnswer.update({
        where: { id: answer.id },
        data: {
          aiSuggestedScore: Math.min(parsed.score, answer.question.marks),
          aiReasoning: parsed.reasoning ?? null,
          rubricPointMatches: parsed.pointMatches ?? null,
          gradingStatus: "ai_complete",
        },
      });
      graded++;
    } catch {
      // If AI response is not valid JSON, store raw content
      await prisma.studentAnswer.update({
        where: { id: answer.id },
        data: {
          aiReasoning: result.content,
          gradingStatus: "ai_complete",
        },
      });
      graded++;
    }
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "student_answer",
    afterValue: { examId, gradedCount: graded } as never,
  });

  revalidatePath("/essay-grading");
  return { success: `${graded} essay answer(s) graded by AI.` };
}

export async function reviewEssayScoreAction(
  answerId: string,
  finalScore: number,
  overrideReason?: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  await prisma.studentAnswer.update({
    where: { id: answerId },
    data: {
      finalScore,
      gradedBy: ctx.user.userId,
      gradingStatus: "teacher_reviewed",
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "student_answer",
    afterValue: { answerId, finalScore, overrideReason } as never,
  });

  revalidatePath("/essay-grading");
  return { success: "Score reviewed and saved." };
}
