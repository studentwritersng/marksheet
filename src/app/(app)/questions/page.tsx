import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { QuestionList } from "./question-list";
import { CreateQuestionForm } from "./create-question-form";
import { QuestionCsvImport } from "./question-csv-import";

export default async function QuestionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [subjects, questions, classLevels] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.question.findMany({
      where: { schoolId: user.schoolId },
      include: {
        subject: { select: { name: true } },
        mcqOptions: true,
        essaySpec: true,
      },
      orderBy: [{ topic: "asc" }, { createdAt: "desc" }],
    }),
    prisma.question.findMany({
      where: { schoolId: user.schoolId, classLevel: { not: null } },
      distinct: ["classLevel"],
      select: { classLevel: true },
    }),
  ]);

  const uniqueClassLevels = [...new Set(classLevels.map((c) => c.classLevel).filter(Boolean))].sort() as string[];

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Question Bank</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Questions grouped by topic. Filter by class, subject, and type to find what you need.
      </p>

      <div className="mt-6 space-y-6">
        <CreateQuestionForm
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        />

        <QuestionCsvImport
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      <div className="mt-8">
        <QuestionList
          questions={questions.map((q) => ({
            id: q.id,
            topic: q.topic,
            text: q.text,
            type: q.type,
            marks: q.marks,
            subject: q.subject.name,
            classLevel: q.classLevel,
            status: q.status,
            source: q.source,
            difficulty: q.difficulty,
            mcqOptions: q.mcqOptions.map((o) => ({ id: o.id, text: o.optionText, isCorrect: o.isCorrect })),
            modelAnswer: q.essaySpec?.modelAnswer ?? null,
          }))}
          classLevels={uniqueClassLevels}
          subjects={subjects.map((s) => s.name)}
        />
      </div>
    </div>
  );
}
