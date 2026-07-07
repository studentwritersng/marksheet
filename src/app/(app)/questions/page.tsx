import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { QuestionList } from "./question-list";
import { CreateQuestionForm } from "./create-question-form";

export default async function QuestionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [subjects, questions] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.question.findMany({
      where: { schoolId: user.schoolId },
      include: {
        subject: { select: { name: true } },
        mcqOptions: true,
        essaySpec: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Question Bank</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        One unified bank for MCQ and essay questions. All sources (manual, CSV, AI) flow
        through the same approval workflow.
      </p>

      <div className="mt-6">
        <CreateQuestionForm
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-4">
          <p className="font-label-md text-label-md text-on-surface">
            All Questions ({questions.length})
          </p>
        </div>
        <QuestionList
          questions={questions.map((q) => ({
            id: q.id,
            text: q.text,
            type: q.type,
            marks: q.marks,
            subject: q.subject.name,
            status: q.status,
            source: q.source,
            difficulty: q.difficulty,
            mcqOptions: q.mcqOptions.map((o) => ({ id: o.id, text: o.optionText, isCorrect: o.isCorrect })),
            modelAnswer: q.essaySpec?.modelAnswer ?? null,
          }))}
        />
      </div>
    </div>
  );
}
