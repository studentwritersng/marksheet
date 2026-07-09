import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ExamsList } from "./exams-list";

export default async function ExamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [exams, subjects, classes, terms, questions, classSubjects, assessmentTypes, weightings] = await Promise.all([
    prisma.exam.findMany({
      where: { schoolId: user.schoolId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        term: { include: { session: true } },
        examQuestions: { include: { question: { select: { id: true, text: true, type: true, marks: true } } } },
        attempts: { select: { id: true, studentId: true, status: true } },
        classes: { include: { class: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.term.findMany({
      where: { session: { schoolId: user.schoolId } },
      include: { session: true },
      orderBy: [{ session: { label: "desc" } }, { name: "asc" }],
    }),
    prisma.question.findMany({
      where: { schoolId: user.schoolId, status: "approved" },
      include: { mcqOptions: { select: { id: true, optionText: true, isCorrect: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.classSubject.findMany({
      where: { schoolId: user.schoolId },
      include: { subject: { select: { id: true, name: true } } },
    }),
    prisma.assessmentType.findMany({
      where: { schoolId: user.schoolId, parentId: null },
      include: {
        children: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.assessmentWeighting.findMany({
      where: { schoolId: user.schoolId },
    }),
  ]);

  const csvHeaders = ["Subject", "Classes", "Term", "Assessment Type", "Duration (min)", "Questions", "Submissions"];
  const csvRows = exams.map((e) => [
    e.subject.name,
    e.classes.map((ec) => ec.class.name).join("; "),
    `${e.term.name}${e.term.session ? ` (${e.term.session.label})` : ""}`,
    e.assessmentTypeId,
    String(e.durationMinutes),
    String(e.examQuestions.length),
    `${e.attempts.filter((a) => a.status === "submitted").length}/${e.attempts.length}`,
  ]);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Exams
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Create and manage exams, track submissions, and assign resits.
          </p>
        </div>
      </div>

      <ExamsList
        csvData={{ headers: csvHeaders, rows: csvRows }}
        contentId="exams-content"
        exams={exams.map((e) => ({
          id: e.id,
          subjectName: e.subject.name,
          className: e.classes.map((ec) => ec.class.name).join(", "),
          classNames: e.classes.map((ec) => ec.class.name).join(", "),
          termName: `${e.term.name}${e.term.session ? ` (${e.term.session.label})` : ""}`,
          assessmentTypeId: e.assessmentTypeId,
          durationMinutes: e.durationMinutes,
          questionCount: e.examQuestions.length,
          attemptCount: e.attempts.length,
          submittedCount: e.attempts.filter((a) => a.status === "submitted").length,
          questionIds: e.examQuestions.map((eq) => eq.question.id),
        }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, department: c.department }))}
        terms={terms.map((t) => ({ id: t.id, name: `${t.name} (${t.session.label})` }))}
        questions={questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          marks: q.marks,
          mcqOptions: q.mcqOptions.map((o) => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect })),
        }))}
        classSubjects={classSubjects.map((cs) => ({
          classId: cs.classId,
          subjectId: cs.subject.id,
          subjectName: cs.subject.name,
        }))}
        assessmentTypes={assessmentTypes.map((t) => {
          const w = weightings.find(
            (w) => w.assessmentTypeId === t.code && w.subjectId === null
          );
          return {
            id: t.id,
            name: t.name,
            code: t.code,
            defaultWeight: w?.weightPercentage ?? null,
            children: t.children.map((c) => ({
              id: c.id,
              name: c.name,
              code: c.code,
            })),
          };
        })}
        weightings={weightings.map((w) => ({
          assessmentTypeId: w.assessmentTypeId,
          weightPercentage: w.weightPercentage,
          subjectId: w.subjectId,
        }))}
      />
    </div>
  );
}
