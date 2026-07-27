import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ResultsView, type ExamScoreRow } from "./results-view";

export default async function ResultsPage(props: {
  searchParams: Promise<{ classId?: string; termId?: string; subjectId?: string; tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const isClassTeacher = perms.classTeacherClassIds.size > 0;
  if (!canManageSchool(perms) && !isClassTeacher || !user.schoolId) {
    return <p className="text-sm text-slate-500">Not authorised.</p>;
  }

  // Class teachers only see their assigned classes
  const classIdFilter = canManageSchool(perms)
    ? { schoolId: user.schoolId, archived: false }
    : { schoolId: user.schoolId, archived: false, id: { in: [...perms.classTeacherClassIds] } };

  const [classes, terms] = await Promise.all([
    prisma.class.findMany({
      where: classIdFilter,
      orderBy: { name: "asc" },
    }),
    prisma.term.findMany({
      where: { session: { schoolId: user.schoolId, isCurrent: true } },
      include: { session: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const selectedClassId = searchParams.classId || classes[0]?.id;
  const selectedTermId = searchParams.termId || terms.find((t) => t.isCurrent)?.id || terms[0]?.id;
  const selectedSubjectId = searchParams.subjectId ?? "";
  const activeTab = searchParams.tab === "scores" ? "scores" : "compute";

  // Fetch computed results if available
  let subjectResults: any[] = [];
  let termResults: any[] = [];
  if (selectedClassId && selectedTermId) {
    [subjectResults, termResults] = await Promise.all([
      prisma.subjectResult.findMany({
        where: {
          termId: selectedTermId,
          student: { schoolId: user.schoolId, currentClassId: selectedClassId },
        },
        include: { subject: { select: { name: true } } },
        orderBy: [{ student: { lastName: "asc" } }, { subject: { name: "asc" } }],
      }),
      prisma.termResult.findMany({
        where: {
          termId: selectedTermId,
          student: { schoolId: user.schoolId, currentClassId: selectedClassId },
        },
        include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
        orderBy: { overallPosition: { sort: "asc", nulls: "last" } },
      }),
    ]);
  }

  // ── Scores tab data ──────────────────────────────────────────────────────
  // Subjects for the selected class
  const classSubjects = selectedClassId
    ? await prisma.classSubject.findMany({
        where: { classId: selectedClassId },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: { subject: { name: "asc" } },
      })
    : [];
  const subjects = classSubjects.map((cs) => cs.subject);
  const effectiveSubjectId = selectedSubjectId || subjects[0]?.id || "";

  // Exams for the selected class/term/subject
  let examScoreRows: ExamScoreRow[] = [];

  if (activeTab === "scores" && selectedClassId && selectedTermId && effectiveSubjectId) {
    // Get exams for this class/term/subject
    const exams = await prisma.exam.findMany({
      where: {
        termId: selectedTermId,
        subjectId: effectiveSubjectId,
        classes: { some: { classId: selectedClassId } },
      },
      select: {
        id: true,
        assessmentTypeId: true,
        subAssessmentWeights: true,
        examQuestions: { select: { question: { select: { marks: true } } } },
        attempts: {
          where: { status: "submitted" },
          select: {
            studentId: true,
            answers: { select: { gradedScore: true, aiSuggestedScore: true, finalScore: true } },
          },
        },
        manualScores: {
          select: { studentId: true, subAssessmentTypeCode: true, rawScore: true, maxRawScore: true },
        },
      },
    });

    // Students in this class
    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, currentClassId: selectedClassId, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, admissionNumber: true, firstName: true, lastName: true },
    });

    // SubjectResult for score display
    const subjectResultMap = new Map(
      subjectResults
        .filter((sr) => sr.subject?.name === subjects.find((s) => s.id === effectiveSubjectId)?.name)
        .map((sr) => [sr.studentId, sr])
    );

    // AssessmentType id→code
    const allAtypes = await prisma.assessmentType.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, code: true },
    });
    const atIdToCode = new Map(allAtypes.map((a) => [a.id, a.code]));

    for (const exam of exams) {
      type SubWeight = { subAssessmentTypeId: string; weightPercentage: number };
      const subWeights = (exam.subAssessmentWeights as SubWeight[] | null) ?? [];
      const components = subWeights.map((sw) => ({
        code: atIdToCode.get(sw.subAssessmentTypeId) ?? sw.subAssessmentTypeId,
        marks: sw.weightPercentage,
      }));

      const examMaxScore = exam.examQuestions.reduce((s, eq) => s + eq.question.marks, 0);
      const attemptMap = new Map(exam.attempts.map((a) => [a.studentId, a]));
      const manualMap = new Map<string, { code: string; raw: number; max: number }[]>();
      for (const ms of exam.manualScores) {
        const list = manualMap.get(ms.studentId) ?? [];
        list.push({ code: ms.subAssessmentTypeCode, raw: ms.rawScore, max: ms.maxRawScore });
        manualMap.set(ms.studentId, list);
      }

      const rows = students.map((s) => {
        const attempt = attemptMap.get(s.id);
        const platformScore = attempt
          ? attempt.answers.reduce((sum, a) => sum + Number(a.finalScore ?? a.aiSuggestedScore ?? a.gradedScore ?? 0), 0)
          : null;
        const sr = subjectResultMap.get(s.id);
        return {
          studentId: s.id,
          studentName: `${s.lastName}, ${s.firstName}`,
          admissionNumber: s.admissionNumber,
          platformScore,
          platformMax: examMaxScore || null,
          manualScores: manualMap.get(s.id) ?? [],
          subjectScore: sr?.totalScore ?? null,
          grade: sr?.grade ?? null,
        };
      });

      examScoreRows.push({
        examId: exam.id,
        assessmentTypeId: exam.assessmentTypeId,
        components,
        students: rows,
      });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Results</h1>
      <p className="mt-1 text-sm text-slate-500">
        View exam scores, compute weighted results, finalize, and generate report cards.
      </p>

      <div className="mt-6">
        <ResultsView
          schoolId={user.schoolId}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
          subjects={subjects}
          selectedClassId={selectedClassId ?? ""}
          selectedTermId={selectedTermId ?? ""}
          selectedSubjectId={effectiveSubjectId}
          activeTab={activeTab}
          subjectResults={subjectResults.map((sr) => ({
            studentId: sr.studentId,
            subjectName: sr.subject.name,
            totalScore: sr.totalScore,
            grade: sr.grade,
            subjectPosition: sr.subjectPosition,
          }))}
          termResults={termResults.map((tr) => ({
            studentId: tr.studentId,
            studentName: `${tr.student.firstName} ${tr.student.lastName}`,
            admissionNumber: tr.student.admissionNumber,
            overallAverage: tr.overallAverage,
            overallPosition: tr.overallPosition,
            status: tr.status,
          }))}
          examScoreRows={examScoreRows}
        />
      </div>
    </div>
  );
}
