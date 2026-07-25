import { prisma } from "@/lib/prisma";
import { defaultGradingScale, type GradeBand } from "@/lib/grading-scale";

/**
 * Weighted computation engine.
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
    select: {
      id: true,
      subjectId: true,
      assessmentTypeId: true,
      subAssessmentWeights: true,
    },
  });

  const examIds = exams.map((e) => e.id);

  // --- Platform attempt scores ---
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: { in: examIds }, status: "submitted" },
    include: { answers: true },
  });

  // Total possible marks per exam from the question bank
  const examMaxScores: Record<string, number> = {};
  for (const examId of examIds) {
    const eqs = await prisma.examQuestion.findMany({
      where: { examId },
      include: { question: { select: { marks: true } } },
    });
    examMaxScores[examId] = eqs.reduce((s, eq) => s + eq.question.marks, 0);
  }

  // --- Manual scores ---
  const manualScores = await prisma.manualScore.findMany({
    where: { examId: { in: examIds } },
  });

  // Build a map: examId → subCode → studentId → { raw, max }
  const manualMap: Record<string, Record<string, Record<string, { raw: number; max: number }>>> = {};
  for (const ms of manualScores) {
    if (!manualMap[ms.examId]) manualMap[ms.examId] = {};
    if (!manualMap[ms.examId][ms.subAssessmentTypeCode]) manualMap[ms.examId][ms.subAssessmentTypeCode] = {};
    manualMap[ms.examId][ms.subAssessmentTypeCode][ms.studentId] = {
      raw: ms.rawScore,
      max: ms.maxRawScore,
    };
  }

  // Parse subAssessmentWeights from each exam:
  // [{ subAssessmentTypeId: string, weightPercentage: number }]
  // weightPercentage here is "marks out of the parent total", e.g. OBJ=30, THEORY=10 for a 40-mark type
  type SubWeight = { subAssessmentTypeId: string; weightPercentage: number };
  const examSubWeights: Record<string, SubWeight[]> = {};
  for (const exam of exams) {
    if (exam.subAssessmentWeights && Array.isArray(exam.subAssessmentWeights)) {
      examSubWeights[exam.id] = exam.subAssessmentWeights as SubWeight[];
    } else {
      examSubWeights[exam.id] = [];
    }
  }

  // Resolve AssessmentType id → code map for subAssessmentTypeId lookups
  const allAssessmentTypes = await prisma.assessmentType.findMany({
    where: { schoolId },
    select: { id: true, code: true, parentId: true },
  });
  const atIdToCode = new Map(allAssessmentTypes.map((a) => [a.id, a.code]));

  // Build a map: studentId → subjectId → assessmentTypeCode → score (scaled to parent marks)
  const scoreMap: Record<string, Record<string, Record<string, number>>> = {};

  for (const attempt of attempts) {
    const exam = exams.find((e) => e.id === attempt.examId);
    if (!exam) continue;
    const { subjectId, assessmentTypeId } = exam;

    // Raw platform score for this attempt
    const platformRaw = attempt.answers.reduce((sum, ans) => {
      const score = ans.finalScore ?? ans.aiSuggestedScore ?? ans.gradedScore ?? 0;
      return sum + Number(score);
    }, 0);
    const platformMax = examMaxScores[attempt.examId] ?? 0;

    // Determine which sub-component this platform attempt contributes to.
    // Platform exams with OBJ questions → OBJ component; essay questions → THEORY component.
    // If the exam has mixed questions, we treat the whole attempt as contributing to both by
    // type-split — but the simpler approach (matching current schema) is: the teacher sets
    // the sub-component weights on the exam, and the platform attempt covers whatever
    // question types are in it. We scale the full attempt score to each enabled component
    // proportionally unless a ManualScore exists for that component (manual overrides platform).
    const subWeights = examSubWeights[attempt.examId] ?? [];

    if (!scoreMap[attempt.studentId]) scoreMap[attempt.studentId] = {};
    if (!scoreMap[attempt.studentId][subjectId]) scoreMap[attempt.studentId][subjectId] = {};

    if (subWeights.length === 0) {
      // No sub-components configured: the platform attempt IS the whole assessment.
      // Scale: (platformRaw / platformMax) * parentMarkAllocation
      // We don't know the parent mark allocation here without the weightMap, so we store
      // a normalised 0–100 percentage and let the weighted score step handle it.
      // Store as the assessmentTypeCode (parent) keyed score, normalised to 100.
      if (platformMax > 0) {
        const normalised = (platformRaw / platformMax) * 100;
        const existingManual = Object.values(manualMap[attempt.examId] ?? {})
          .some((byStudent) => byStudent[attempt.studentId] != null);
        if (!existingManual) {
          // Store normalised score; weighting step will multiply by (weight/100)
          scoreMap[attempt.studentId][subjectId][assessmentTypeId] =
            (scoreMap[attempt.studentId][subjectId][assessmentTypeId] ?? 0) + normalised;
        }
      }
    } else {
      // Sub-components configured: distribute the platform score across components
      // Platform score covers OBJ and/or THEORY (never PRC — practicals are always manual)
      const platformComponents = subWeights.filter((sw) => {
        const code = atIdToCode.get(sw.subAssessmentTypeId) ?? "";
        return code === "OBJ" || code === "THEORY";
      });
      const platformComponentTotal = platformComponents.reduce((s, sw) => s + sw.weightPercentage, 0);

      for (const sw of subWeights) {
        const code = atIdToCode.get(sw.subAssessmentTypeId) ?? "";
        const compMarks = sw.weightPercentage; // marks this component is worth out of parent total

        // Check if a manual score overrides this component for this student
        const manual = manualMap[attempt.examId]?.[code]?.[attempt.studentId];
        if (manual) {
          // Manual override: scale manual raw to component marks
          const scaled = manual.max > 0 ? (manual.raw / manual.max) * compMarks : 0;
          scoreMap[attempt.studentId][subjectId][code] =
            (scoreMap[attempt.studentId][subjectId][code] ?? 0) + scaled;
        } else if (code === "OBJ" || code === "THEORY") {
          // Platform score: scale the platform raw proportionally to this component's share
          if (platformMax > 0 && platformComponentTotal > 0) {
            const componentShare = compMarks / platformComponentTotal;
            const scaled = (platformRaw / platformMax) * compMarks * componentShare;
            scoreMap[attempt.studentId][subjectId][code] =
              (scoreMap[attempt.studentId][subjectId][code] ?? 0) + scaled;
          }
        }
        // PRC without a manual score: nothing to add from platform
      }
    }
  }

  // Apply manual scores for students who have NO platform attempt (fully offline exams)
  for (const exam of exams) {
    const subWeights = examSubWeights[exam.id] ?? [];
    const manualForExam = manualMap[exam.id] ?? {};

    for (const [code, byStudent] of Object.entries(manualForExam)) {
      for (const [studentId, { raw, max }] of Object.entries(byStudent)) {
        if (!scoreMap[studentId]) scoreMap[studentId] = {};
        if (!scoreMap[studentId][exam.subjectId]) scoreMap[studentId][exam.subjectId] = {};

        if (subWeights.length === 0) {
          // No sub-component config: store normalised 0-100 score under parent code
          if (scoreMap[studentId][exam.subjectId][exam.assessmentTypeId] == null) {
            scoreMap[studentId][exam.subjectId][exam.assessmentTypeId] =
              max > 0 ? (raw / max) * 100 : 0;
          }
        } else {
          // Find what marks this component is worth
          const sw = subWeights.find((w) => (atIdToCode.get(w.subAssessmentTypeId) ?? "") === code);
          const compMarks = sw?.weightPercentage ?? 0;
          if (compMarks === 0) continue;

          // Only write if not already set by the platform attempt path above
          if (scoreMap[studentId][exam.subjectId][code] == null) {
            scoreMap[studentId][exam.subjectId][code] = max > 0 ? (raw / max) * compMarks : 0;
          }
        }
      }
    }
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

      // Aggregate sub-component scores into their parent assessment type code.
      // Two cases:
      // A) Sub-components configured (OBJ/THEORY/PRC keyed scores): already scaled to parent marks.
      //    e.g. OBJ=24, PRC=8 for a 40-mark Mid Term → sum = 32 → store as Mid Term = 32.
      //    Final: 32/40 * 40 = 32 → weighted = 32/100 of total term.
      // B) No sub-components (parent code keyed, normalised 0–100): multiply by (weight/100).
      //    e.g. score=80 (out of 100), weight=40 → contribution = 80 * (40/100) = 32.
      const parentCodes = new Set(weightMap.keys());
      const aggregatedScores: Record<string, { total: number; mode: "marks" | "pct" }> = {};

      for (const [code, raw] of Object.entries(studentScores)) {
        if (parentCodes.has(code)) {
          // Case B: normalised percentage score under the parent code
          const existing = aggregatedScores[code];
          aggregatedScores[code] = {
            total: (existing?.total ?? 0) + raw,
            mode: "pct",
          };
        } else {
          // Case A: sub-component score already in parent marks units
          const parentExam = exams.find((e) => {
            if (e.subjectId !== subject.id) return false;
            const sws = examSubWeights[e.id] ?? [];
            return sws.some((sw) => (atIdToCode.get(sw.subAssessmentTypeId) ?? "") === code);
          });
          const parentCode = parentExam?.assessmentTypeId ?? code;
          const existing = aggregatedScores[parentCode];
          aggregatedScores[parentCode] = {
            total: (existing?.total ?? 0) + raw,
            mode: "marks",
          };
        }
      }

      // Compute weighted score out of 100
      let weightedScore = 0;
      let totalWeight = 0;

      for (const [assessType, { total, mode }] of Object.entries(aggregatedScores)) {
        const weight = weightMap.get(assessType) ?? 0;
        if (weight === 0) continue;
        if (mode === "marks") {
          // total is raw marks out of `weight` mark allocation → contribution = total
          weightedScore += total;
        } else {
          // total is a 0–100 normalised score → contribution = total * (weight / 100)
          weightedScore += total * (weight / 100);
        }
        totalWeight += weight;
      }

      // Normalise if only some assessments have scores (missing data)
      if (totalWeight > 0 && totalWeight < 100) {
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



export function applyGradingScale(score: number, scale: GradeBand[]): string {
  for (const band of scale) {
    if (score >= band.min && score <= band.max) return band.grade;
  }
  return "F9";
}
