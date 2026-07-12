import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> },
) {
  const { examId } = await params;
  const user = await getCurrentUser();
  if (!user?.schoolId) {
    return Response.json({ answers: [] });
  }

  const answers = await prisma.studentAnswer.findMany({
    where: {
      gradingStatus: { in: ["ai_complete", "teacher_reviewed", "ai_pending"] },
      essayResponseText: { not: null },
      attempt: { examId },
    },
    include: {
      question: { select: { text: true, marks: true } },
      attempt: { include: { student: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    answers: answers.map((a) => ({
      id: a.id,
      studentName: `${a.attempt.student.firstName} ${a.attempt.student.lastName}`,
      questionText: a.question.text,
      essayResponseText: a.essayResponseText,
      aiSuggestedScore: a.aiSuggestedScore,
      aiReasoning: a.aiReasoning,
      rubricPointResults: a.rubricPointMatches,
      finalScore: a.finalScore,
      gradingStatus: a.gradingStatus,
      maxMarks: a.question.marks,
    })),
  });
}
