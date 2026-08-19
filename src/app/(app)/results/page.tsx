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

  // ── Department filtering for subject results ───────────────────────────────
  // Fetch class-subject links with department info and student departments
  // so we can filter out subjects a student is not registered for.
  const classSubjectLinks = selectedClassId
    ? await prisma.classSubject.findMany({
        where: { classId: selectedClassId },
        select: { subjectId: true, department: true },
      })
    : [];

  // Build a map of studentId → set of registered subjectIds
  const studentDeptMap = new Map<string, string>();
  const studentRegisteredSubjects = new Map<string, Set<string>>();

  if (selectedClassId && selectedTermId && subjectResults.length > 0) {
    const studentIds = [...new Set(subjectResults.map((sr) => sr.studentId))];
    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, id: { in: studentIds } },
      select: { id: true, department: true },
    });
    for (const s of students) {
      studentDeptMap.set(s.id, s.department || "");
      const registered = new Set(
        classSubjectLinks
          .filter((cs) => {
            if (cs.department === "general") return true;
            return s.department && cs.department === s.department;
          })
          .map((cs) => cs.subjectId),
      );
      studentRegisteredSubjects.set(s.id, registered);
    }
    // Filter subjectResults to only include subjects the student is registered for
    subjectResults = subjectResults.filter((sr) => {
      const registered = studentRegisteredSubjects.get(sr.studentId);
      return registered?.has(sr.subjectId) ?? true;
    });
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

  // AssessmentType id→info (code + name)
  const allAtypes = await prisma.assessmentType.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true, code: true, name: true },
  });
  const atInfo = new Map(allAtypes.map((a) => [a.id, a]));
  const atCodeToName = Object.fromEntries(allAtypes.map((a) => [a.code, a.name]));

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
      select: { id: true, admissionNumber: true, firstName: true, lastName: true, department: true },
    });

    // Determine which department the selected subject belongs to
    const selectedSubjectDept = classSubjectLinks.find((cs) => cs.subjectId === effectiveSubjectId)?.department ?? "general";

    // Filter students to only those registered for this subject's department
    const eligibleStudentIds = new Set(
      students
        .filter((s) => {
          const studentDept = s.department || "";
          if (selectedSubjectDept === "general") return true;
          return studentDept === selectedSubjectDept;
        })
        .map((s) => s.id),
    );

    // SubjectResult for score display
    const subjectResultMap = new Map(
      subjectResults
        .filter((sr) => sr.subject?.name === subjects.find((s) => s.id === effectiveSubjectId)?.name)
        .map((sr) => [sr.studentId, sr])
    );

    for (const exam of exams) {
      type SubWeight = { subAssessmentTypeId: string; weightPercentage: number };
      const subWeights = (exam.subAssessmentWeights as SubWeight[] | null) ?? [];
      const components = subWeights.map((sw) => ({
        code: atInfo.get(sw.subAssessmentTypeId)?.code ?? sw.subAssessmentTypeId,
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

       const rows = students
         .filter((s) => eligibleStudentIds.has(s.id))
         .map((s) => {
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
        assessmentTypeName: atInfo.get(exam.assessmentTypeId)?.name ?? exam.assessmentTypeId,
        assessmentTypeCode: atInfo.get(exam.assessmentTypeId)?.code ?? exam.assessmentTypeId,
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
          isAdmin={canManageSchool(perms)}
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
            assessmentScores: (sr.assessmentScores ?? null) as Record<string, number> | null,
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
          assessmentTypeNames={atCodeToName}
        />
      </div>
    </div>
  );
}
