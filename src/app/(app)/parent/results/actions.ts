import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import {
  shapeAssessmentScores,
  type AcademicHubData,
  type HubWard,
  type HubTermResult,
  type HubHomework,
  type HubExam,
} from "./shape";

export async function getAcademicHub(user: SessionPayload): Promise<AcademicHubData> {
  if (!user.schoolId) return { wards: [], termOptions: [] };

  // 1. Guardian-scoped wards (mirrors parent/page.tsx).
  const guardians = await prisma.guardian.findMany({
    where: { parentUserId: user.userId, student: { schoolId: user.schoolId ?? undefined } },
    include: {
      student: {
        include: {
          currentClass: { select: { name: true } },
          termResults: {
            where: { status: "finalised" },
            include: { term: { include: { session: true } } },
            orderBy: { term: { session: { label: "desc" } } },
          },
        },
      },
    },
  });

  if (guardians.length === 0) return { wards: [], termOptions: [] };

  const wards = guardians.map((g) => g.student);
  const studentIds = wards.map((s) => s.id);
  const allTermIds = Array.from(
    new Set(wards.flatMap((s) => s.termResults.map((tr) => tr.termId))),
  );

  // 2. Map assessment-type id -> code, and code -> label.
  const assessmentTypes = await prisma.assessmentType.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true, code: true, name: true },
  });
  const idToCode = new Map(assessmentTypes.map((a) => [a.id, a.code]));
  const codeToLabel = new Map(assessmentTypes.map((a) => [a.code, a.name]));
  const idToLabel = new Map(assessmentTypes.map((a) => [a.id, a.name]));

  // 3. Subject results for the finalised terms (CA + exam components live here).
  const subjectResults = await prisma.subjectResult.findMany({
    where: { studentId: { in: studentIds }, termId: { in: allTermIds } },
    include: { subject: { select: { name: true } } },
  });

  // 4. Published homework for each ward's class+term, with the ward's attempt.
  const homeworkOr = wards
    .filter((s) => s.currentClassId)
    .map((s) => ({ classId: s.currentClassId as string, termId: { in: allTermIds } }));
  const homework = await prisma.homework.findMany({
    where: {
      schoolId: user.schoolId,
      status: "published",
      ...(homeworkOr.length > 0 ? { OR: homeworkOr } : {}),
    },
    include: {
      subject: { select: { name: true } },
      attempts: { where: { studentId: { in: studentIds } } },
    },
  });

  // 5. Published exams for each ward's class+term.
  const examsOr = wards.flatMap((s) =>
    s.currentClassId
      ? [
          { classId: s.currentClassId as string },
          { classes: { some: { classId: s.currentClassId as string } } },
        ]
      : [],
  );
  const exams = await prisma.exam.findMany({
    where: {
      schoolId: user.schoolId,
      status: "published",
      termId: { in: allTermIds },
      ...(examsOr.length > 0 ? { OR: examsOr } : {}),
    },
    include: { subject: { select: { name: true } }, classes: true },
  });

  // 6. Shape per ward.
  const builtWards: HubWard[] = wards.map((s) => {
    const finalised = s.termResults; // already status:"finalised"
    const subjectRows = subjectResults.filter((sr) => sr.studentId === s.id);

    const terms: HubTermResult[] = finalised.map((tr) => {
      const subs = subjectRows
        .filter((sr) => sr.termId === tr.termId)
        .map((sr) => ({
          subjectId: sr.subjectId,
          subjectName: sr.subject.name,
          totalScore: sr.totalScore,
          grade: sr.grade,
          subjectPosition: sr.subjectPosition,
          components: shapeAssessmentScores(
            sr.assessmentScores as Record<string, number> | null,
            codeToLabel,
          ),
        }));
      return {
        termId: tr.termId,
        termName: tr.term.name,
        sessionLabel: tr.term.session.label,
        overallAverage: tr.overallAverage,
        overallPosition: tr.overallPosition,
        teacherComment: tr.teacherComment,
        principalComment: tr.principalComment,
        subjects: subs,
        reportCardHref: `/results/${s.id}?termId=${tr.termId}`,
      };
    });

    const hw: HubHomework[] = homework
      .filter((h) => h.classId === s.currentClassId)
      .map((h) => {
        const attempt = h.attempts.find((a) => a.studentId === s.id) ?? null;
        return {
          id: h.id,
          termId: h.termId,
          title: h.title,
          subjectName: h.subject.name,
          dueDate: h.dueDate ? h.dueDate.toISOString() : null,
          attemptStatus: attempt ? String(attempt.status) : null,
          score: attempt?.totalScore ?? null,
          percentage: attempt?.percentage ?? null,
          published: attempt?.published ?? false,
          href: `/homework/${h.id}`,
        };
      });

    const ex: HubExam[] = exams
      .filter(
        (e) =>
          e.classId === s.currentClassId ||
          e.classes.some((ec) => ec.classId === s.currentClassId),
      )
      .map((e) => {
        const code = idToCode.get(e.assessmentTypeId) ?? e.assessmentTypeId;
        const label = idToLabel.get(e.assessmentTypeId) ?? code;
        const subj = subjectRows.find(
          (sr) => sr.subjectId === e.subjectId && sr.termId === e.termId,
        );
        const raw = (subj?.assessmentScores as Record<string, number> | null)?.[code] ?? null;
        return {
          id: e.id,
          termId: e.termId,
          subjectName: e.subject.name,
          assessmentTypeLabel: label,
          examMark: typeof raw === "number" ? raw : null,
          href: `/results/${s.id}?termId=${e.termId}`,
        };
      });

    return {
      studentId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      className: s.currentClass?.name ?? "No class",
      admissionNumber: s.admissionNumber,
      terms,
      homework: hw,
      exams: ex,
    };
  });

  // 7. Term dropdown options (union of all finalised terms).
  const termOptions = Array.from(
    new Map(
      wards
        .flatMap((s) => s.termResults)
        .map((tr) => [tr.termId, { id: tr.termId, label: `${tr.term.session.label} · ${tr.term.name}` }]),
    ).values(),
  );

  return { wards: builtWards, termOptions };
}
