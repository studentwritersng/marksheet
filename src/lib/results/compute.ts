import { prisma } from "@/lib/prisma";

/**
 * PRD 08: Weighted computation engine.
 * Computes subject results, applies grading scales, and ranks students within a class.
 */

interface ComputationInput {
  schoolId: string;
  classId: string;
  termId: string;
}

interface SubjectScoreRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  subjectId: string;
  subjectName: string;
  rawScores: Record<string, number>; // assessmentTypeId -> raw score
  weightedScore: number;
  grade: string;
  rank: number;
}

export interface TermResultOutput {
  studentId: string;
  overallAverage: number;
  overallPosition: number;
  subjectResults: SubjectScoreRow[];
}

/**
 * Run full computation for one class/term combination.
 */
export async function computeClassResults(input: ComputationInput): Promise<TermResultOutput[]> {
  const { schoolId, classId, termId } = input;

  // 1. Get school grading scale
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { gradingScale: true },
  });
  const gradingScale = (school?.gradingScale != null ? (school.gradingScale as unknown as GradeBand[]) : defaultGradingScale);

  // 2. Get class details (including department)
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, department: true },
  });

  // 3. Get subject-class links for this class (department filtering)
  const classSubjects = await prisma.classSubject.findMany({
    where: { classId },
    select: { subjectId: true, department: true },
  });
  const deptFilteredSubjectIds = new Set(
    classSubjects
      .filter((cs) => cs.department === "general" || (cls && cls.department && cs.department === cls.department))
      .map((cs) => cs.subjectId)
  );
  const hasDepartmentFilter = classSubjects.some((cs) => cs.department !== "general");

  // 4. Get all students in this class
  const students = await prisma.student.findMany({
    where: { schoolId, currentClassId: classId, status: "active" },
    orderBy: { lastName: "asc" },
  });

  // 5. Get subjects — only those linked to this class with compatible department
  const subjects = hasDepartmentFilter
    ? await prisma.subject.findMany({
        where: { schoolId, id: { in: [...deptFilteredSubjectIds] } },
      })
    : await prisma.subject.findMany({
        where: { schoolId },
      });

  // 6. Get assessment weightings (school-wide + per-subject)
  const weightings = await prisma.assessmentWeighting.findMany({
    where: { schoolId },
  });
  const defaultWeights = weightings.filter((w) => w.subjectId === null);
  const subjectWeights = weightings.filter((w) => w.subjectId !== null);

  // 7. Get exams for this term — include ExamClass for multi-class support
  const exams = await prisma.exam.findMany({
    where: { termId, classes: { some: { classId } } },
    select: { id: true, subjectId: true, assessmentTypeId: true },
  });

  const examIds = exams.map((e) => e.id);
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: { in: examIds }, status: "submitted" },
    include: { answers: true },
  });

  // Build a map: studentId -> subjectId -> assessmentTypeId -> score
  const scoreMap: Record<string, Record<string, Record<string, number>>> = {};

  for (const attempt of attempts) {
    const exam = exams.find((e) => e.id === attempt.examId);
    if (!exam) continue;
    const { subjectId, assessmentTypeId } = exam;

    // For MCQ, use gradedScore (already computed offline). For essay, use finalScore or aiSuggestedScore.
    const totalScore = attempt.answers.reduce((sum, ans) => {
      const score = ans.finalScore ?? ans.aiSuggestedScore ?? ans.gradedScore ?? 0;
      return sum + Number(score);
    }, 0);

    if (!scoreMap[attempt.studentId]) scoreMap[attempt.studentId] = {};
    if (!scoreMap[attempt.studentId][subjectId]) scoreMap[attempt.studentId][subjectId] = {};
    scoreMap[attempt.studentId][subjectId][assessmentTypeId] = totalScore;
  }

  // 6. Compute results per student per subject
  const results: TermResultOutput[] = [];

  for (const student of students) {
    const subjectResults: SubjectScoreRow[] = [];

    for (const subject of subjects) {
      const studentScores = scoreMap[student.id]?.[subject.id] ?? {};
      const subjectAssessments = Object.keys(studentScores);

      if (subjectAssessments.length === 0) continue;

      // Resolve weights: per-subject overrides school default
      const subjWeights = subjectWeights.filter((w) => w.subjectId === subject.id);
      const weightMap = new Map<string, number>();

      for (const sw of subjWeights) {
        weightMap.set(sw.assessmentTypeId, sw.weightPercentage);
      }
      for (const dw of defaultWeights) {
        if (!weightMap.has(dw.assessmentTypeId)) {
          weightMap.set(dw.assessmentTypeId, dw.weightPercentage);
        }
      }

      // Compute weighted score
      let weightedScore = 0;
      let totalWeight = 0;

      for (const [assessType, rawScore] of Object.entries(studentScores)) {
        const weight = weightMap.get(assessType) ?? 0;
        weightedScore += rawScore * (weight / 100);
        totalWeight += weight;
      }

      // Normalize if totalWeight != 100 (some assessments might be missing)
      if (totalWeight > 0) {
        weightedScore = (weightedScore / totalWeight) * 100;
      }

      const grade = applyGradingScale(weightedScore, gradingScale);

      subjectResults.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        subjectId: subject.id,
        subjectName: subject.name,
        rawScores: studentScores,
        weightedScore: Math.round(weightedScore * 100) / 100,
        grade,
        rank: 0, // set after sorting
      });
    }

    // Rank and sort subject results
    subjectResults.sort((a, b) => b.weightedScore - a.weightedScore);
    subjectResults.forEach((sr, i) => {
      sr.rank = i + 1;
      // Handle ties (same score = same rank)
      if (i > 0 && sr.weightedScore === subjectResults[i - 1].weightedScore) {
        sr.rank = subjectResults[i - 1].rank;
      }
    });

    const overallAverage =
      subjectResults.length > 0
        ? Math.round((subjectResults.reduce((s, r) => s + r.weightedScore, 0) / subjectResults.length) * 100) / 100
        : 0;

    results.push({
      studentId: student.id,
      overallAverage,
      overallPosition: 0,
      subjectResults,
    });
  }

  // Overall ranking across class
  results.sort((a, b) => b.overallAverage - a.overallAverage);
  results.forEach((r, i) => {
    r.overallPosition = i + 1;
    if (i > 0 && r.overallAverage === results[i - 1].overallAverage) {
      r.overallPosition = results[i - 1].overallPosition;
    }
  });

  return results;
}

/**
 * Persist computed results to the database.
 */
export async function persistResults(
  schoolId: string,
  termId: string,
  results: TermResultOutput[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const tr of results) {
      for (const sr of tr.subjectResults) {
        await tx.subjectResult.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: sr.studentId,
              subjectId: sr.subjectId,
              termId,
            },
          },
          update: {
            assessmentScores: sr.rawScores as never,
            totalScore: sr.weightedScore,
            grade: sr.grade,
            subjectPosition: sr.rank,
          },
          create: {
            studentId: sr.studentId,
            subjectId: sr.subjectId,
            termId,
            assessmentScores: sr.rawScores as never,
            totalScore: sr.weightedScore,
            grade: sr.grade,
            subjectPosition: sr.rank,
          },
        });
      }

      await tx.termResult.upsert({
        where: {
          studentId_termId: { studentId: tr.studentId, termId },
        },
        update: {
          overallAverage: tr.overallAverage,
          overallPosition: tr.overallPosition,
        },
        create: {
          studentId: tr.studentId,
          termId,
          overallAverage: tr.overallAverage,
          overallPosition: tr.overallPosition,
        },
      });
    }
  });
}

interface GradeBand {
  grade: string;
  min: number;
  max: number;
  remark?: string;
}

const defaultGradingScale: GradeBand[] = [
  { grade: "A1", min: 75, max: 100, remark: "Excellent" },
  { grade: "B2", min: 70, max: 74, remark: "Very Good" },
  { grade: "B3", min: 65, max: 69, remark: "Good" },
  { grade: "C4", min: 60, max: 64, remark: "Credit" },
  { grade: "C5", min: 55, max: 59, remark: "Credit" },
  { grade: "C6", min: 50, max: 54, remark: "Credit" },
  { grade: "D7", min: 45, max: 49, remark: "Pass" },
  { grade: "E8", min: 40, max: 44, remark: "Pass" },
  { grade: "F9", min: 0, max: 39, remark: "Fail" },
];

export function applyGradingScale(score: number, scale: GradeBand[]): string {
  for (const band of scale) {
    if (score >= band.min && score <= band.max) return band.grade;
  }
  return "F9";
}
