import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ScoreEntryTable } from "./score-entry";

export default async function ExamDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const exam = await prisma.exam.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      subject: { select: { name: true } },
      term: { include: { session: { select: { label: true } } } },
      classes: { include: { class: { select: { id: true, name: true } } } },
      examQuestions: { select: { questionId: true } },
      attempts: {
        where: { status: "submitted" },
        select: { studentId: true, submittedAt: true },
      },
    },
  });
  if (!exam) notFound();

  // Parse sub-assessment component config
  type SubWeight = { subAssessmentTypeId: string; weightPercentage: number };
  const subWeights = (exam.subAssessmentWeights as SubWeight[] | null) ?? [];

  // Resolve sub-assessment type details (id → code/name)
  const subTypeIds = subWeights.map((sw) => sw.subAssessmentTypeId);
  const subTypes = subTypeIds.length > 0
    ? await prisma.assessmentType.findMany({
        where: { id: { in: subTypeIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const subTypeMap = new Map(subTypes.map((t) => [t.id, t]));

  // Components with their mark allocation
  const components = subWeights
    .map((sw) => {
      const t = subTypeMap.get(sw.subAssessmentTypeId);
      if (!t) return null;
      return {
        id: sw.subAssessmentTypeId,
        code: t.code,
        name: t.name,
        marks: sw.weightPercentage, // marks out of parent total
        isPractical: t.code === "PRC",
        isManualOnly: t.code === "PRC", // practicals are always manual
      };
    })
    .filter(Boolean) as {
      id: string; code: string; name: string; marks: number;
      isPractical: boolean; isManualOnly: boolean;
    }[];

  // Students enrolled in this exam's classes
  const classIds = exam.classes.map((ec) => ec.classId);
  const students = await prisma.student.findMany({
    where: { schoolId: user.schoolId, currentClassId: { in: classIds }, status: "active" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, admissionNumber: true, firstName: true, lastName: true },
  });

  // Existing manual scores
  const manualScores = await prisma.manualScore.findMany({
    where: { examId: id },
    select: { studentId: true, subAssessmentTypeCode: true, rawScore: true, maxRawScore: true, note: true },
  });

  // Attempt map
  const attemptMap = new Map(exam.attempts.map((a) => [a.studentId, a]));

  const classNames = exam.classes.map((ec) => ec.class.name).join(", ");
  const termLabel = `${exam.term.name} (${exam.term.session.label})`;
  const totalParentMarks = subWeights.reduce((s, sw) => s + sw.weightPercentage, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <a href="/exams" className="font-label-sm text-label-sm text-primary hover:underline">
          ← Back to Exams
        </a>
        <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">
          {exam.subject.name} — {exam.assessmentTypeId}
        </h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {classNames} · {termLabel} · {exam.durationMinutes} min ·{" "}
          {exam.examQuestions.length} question{exam.examQuestions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Component summary */}
      {components.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h2 className="font-label-lg text-label-lg text-on-surface font-semibold mb-3">
            Assessment Components
          </h2>
          <div className="flex flex-wrap gap-3">
            {components.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 bg-surface-container-low rounded-lg px-4 py-2.5"
              >
                <span className={`w-2 h-2 rounded-full ${
                  c.code === "OBJ" ? "bg-blue-500"
                  : c.code === "THEORY" ? "bg-amber-500"
                  : "bg-green-500"
                }`} />
                <span className="font-label-md text-label-md text-on-surface">{c.name}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {c.marks} / {totalParentMarks} marks
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  c.isManualOnly
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {c.isManualOnly ? "Manual only" : "Platform + manual override"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
            Total: {totalParentMarks} marks · {exam.attempts.length} submission{exam.attempts.length !== 1 ? "s" : ""} received
          </p>
        </div>
      )}

      {/* Score entry */}
      <ScoreEntryTable
        examId={id}
        components={components}
        hasQuestionBank={exam.examQuestions.length > 0}
        students={students.map((s) => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          fullName: `${s.lastName}, ${s.firstName}`,
          hasSubmitted: attemptMap.has(s.id),
        }))}
        existingManualScores={manualScores}
      />
    </div>
  );
}
