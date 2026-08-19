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
  rawScores: Record<string, number>; // parent assessmentTypeCode -> raw marks (for display)
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

export type ScoreMap = Record<string, Record<string, Record<string, number>>>;
export interface AssembleParams {
  exams: { id: string; subjectId: string; assessmentTypeId: string; subAssessmentWeights: unknown }[];
  attempts: { examId: string; studentId: string; answers: { finalScore?: number | null; aiSuggestedScore?: number | null; gradedScore?: number | null }[] }[];
  manualScores: { examId: string; studentId: string; subAssessmentTypeCode: string; rawScore: number; maxRawScore: number }[];
  atIdToCode: Map<string, string>;
  examMaxScores: Record<string, number>;
  examSubWeights: Record<string, { subAssessmentTypeId: string; weightPercentage: number }[]>;
}
export function assembleScoreMap(p: AssembleParams): ScoreMap {
  const { exams, attempts, manualScores, atIdToCode, examMaxScores, examSubWeights } = p;
  // manualMap (verbatim from current lines 124-133)
  const manualMap: Record<string, Record<string, Record<string, { raw: number; max: number }>>> = {};
  for (const ms of manualScores) {
    if (!manualMap[ms.examId]) manualMap[ms.examId] = {};
    if (!manualMap[ms.examId][ms.subAssessmentTypeCode]) manualMap[ms.examId][ms.subAssessmentTypeCode] = {};
    manualMap[ms.examId][ms.subAssessmentTypeCode][ms.studentId] = { raw: ms.rawScore, max: ms.maxRawScore };
  }
  const scoreMap: ScoreMap = {};
  // --- attempt loop (verbatim from current lines 157-230) ---
  for (const attempt of attempts) {
    const exam = exams.find((e) => e.id === attempt.examId);
    if (!exam) continue;
    const { subjectId, assessmentTypeId } = exam;
    const gradedAnswers = attempt.answers.filter((a) => a.finalScore != null || a.aiSuggestedScore != null || a.gradedScore != null);
    if (gradedAnswers.length === 0) continue;
    const platformRaw = attempt.answers.reduce((sum, a) => sum + Number(a.finalScore ?? a.aiSuggestedScore ?? a.gradedScore ?? 0), 0);
    const platformMax = examMaxScores[attempt.examId] ?? 0;
    const subWeights = (examSubWeights[attempt.examId] ?? []) as { subAssessmentTypeId: string; weightPercentage: number }[];
    if (!scoreMap[attempt.studentId]) scoreMap[attempt.studentId] = {};
    if (!scoreMap[attempt.studentId][subjectId]) scoreMap[attempt.studentId][subjectId] = {};
    if (subWeights.length === 0) {
      if (platformMax > 0) {
        const existingManual = Object.values(manualMap[attempt.examId] ?? {}).some((b) => b[attempt.studentId] != null);
        if (!existingManual) {
          const pCode = atIdToCode.get(assessmentTypeId) ?? assessmentTypeId;
          scoreMap[attempt.studentId][subjectId][pCode] =
            (scoreMap[attempt.studentId][subjectId][pCode] ?? 0) + platformRaw;
        }
      }
    } else {
      const platformComponents = subWeights.filter((sw) => {
        const code = atIdToCode.get(sw.subAssessmentTypeId) ?? "";
        return code === "OBJ" || code === "THEORY";
      });
      const platformComponentTotal = platformComponents.reduce((s, sw) => s + sw.weightPercentage, 0);
      for (const sw of subWeights) {
        const code = atIdToCode.get(sw.subAssessmentTypeId) ?? "";
        const compMarks = sw.weightPercentage;
        const manual = manualMap[attempt.examId]?.[code]?.[attempt.studentId];
        if (manual) {
          const scaled = manual.max > 0 ? (manual.raw / manual.max) * compMarks : 0;
          scoreMap[attempt.studentId][subjectId][code] = (scoreMap[attempt.studentId][subjectId][code] ?? 0) + scaled;
        } else if (code === "OBJ" || code === "THEORY") {
          if (platformMax > 0 && platformComponentTotal > 0) {
            const componentShare = compMarks / platformComponentTotal;
            const scaled = (platformRaw / platformMax) * compMarks * componentShare;
            scoreMap[attempt.studentId][subjectId][code] = (scoreMap[attempt.studentId][subjectId][code] ?? 0) + scaled;
          }
        }
      }
    }
  }
  // --- manual-only loop (verbatim from current lines 232-260) ---
  for (const exam of exams) {
    const subWeights = (examSubWeights[exam.id] ?? []) as { subAssessmentTypeId: string; weightPercentage: number }[];
    const manualForExam = manualMap[exam.id] ?? {};
    for (const [code, byStudent] of Object.entries(manualForExam)) {
      for (const [studentId, { raw, max }] of Object.entries(byStudent)) {
        if (!scoreMap[studentId]) scoreMap[studentId] = {};
        if (!scoreMap[studentId][exam.subjectId]) scoreMap[studentId][exam.subjectId] = {};
        if (subWeights.length === 0) {
          const pCode = atIdToCode.get(exam.assessmentTypeId) ?? exam.assessmentTypeId;
          if (scoreMap[studentId][exam.subjectId][pCode] == null) {
            scoreMap[studentId][exam.subjectId][pCode] = raw;
          }
        } else {
          const sw = subWeights.find((w) => (atIdToCode.get(w.subAssessmentTypeId) ?? "") === code);
          const compMarks = sw?.weightPercentage ?? 0;
          if (compMarks === 0) continue;
          if (scoreMap[studentId][exam.subjectId][code] == null) {
            scoreMap[studentId][exam.subjectId][code] = max > 0 ? (raw / max) * compMarks : 0;
          }
        }
      }
    }
  }
  return scoreMap;
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

  // 3. Get subject-class links for this class (department filtering)
  const classSubjects = await prisma.classSubject.findMany({
    where: { classId },
    select: { subjectId: true, department: true },
  });
  // 4. Get all students in this class
  const students = await prisma.student.findMany({
    where: { schoolId, currentClassId: classId, status: "active" },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, department: true },
    orderBy: { lastName: "asc" },
  });

  // 5. Get subjects — union of all students' eligible subjects
  const allSubjectIds = new Set<string>();
  const studentRegisteredSubjects: Record<string, Set<string>> = {};
  for (const student of students) {
    const sIds = new Set(
      classSubjects
        .filter((cs) => {
          if (cs.department === "general") return true;
          return student.department && cs.department === student.department;
        })
        .map((cs) => cs.subjectId),
    );
    studentRegisteredSubjects[student.id] = sIds;
    for (const sid of sIds) allSubjectIds.add(sid);
  }
  const subjects = allSubjectIds.size > 0
    ? await prisma.subject.findMany({
        where: { schoolId, id: { in: [...allSubjectIds] } },
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
  const scoreMap = assembleScoreMap({
    exams,
    attempts,
    manualScores,
    atIdToCode,
    examMaxScores,
    examSubWeights,
  });

  // 6. Compute results per student per subject
  const results: TermResultOutput[] = [];

  for (const student of students) {
    const subjectResults: SubjectScoreRow[] = [];
    const registered = studentRegisteredSubjects[student.id] ?? new Set();
    let totalEarned = 0;
    let totalAvailable = 0;

    for (const subject of subjects) {
      // Skip subjects this student is not registered for
      if (!registered.has(subject.id)) continue;

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
      // B) No sub-components (parent code keyed, normalised 0–100): multiply by (weight/100).
      const parentCodes = new Set(weightMap.keys());

      // Track: per assessment type → { earned, available }
      // "earned" = marks the student actually got
      // "available" = marks that were possible from assessments that have been sat so far
      const aggregatedScores: Record<string, { earned: number; available: number; mode: "marks" | "pct" }> = {};

      for (const [code, raw] of Object.entries(studentScores)) {
        if (parentCodes.has(code)) {
          // Parent code with raw score: find the max marks for this assessment type
          const parentExam = exams.find((e) => {
            if (e.subjectId !== subject.id) return false;
            return atIdToCode.get(e.assessmentTypeId) === code;
          });
          // For offline exams (no question bank), examMaxScores[id] = 0.
          // In that case use the maxRawScore from any ManualScore for this exam as the denominator.
          let examMax = parentExam ? examMaxScores[parentExam.id] : 0;
          if (examMax === 0 && parentExam) {
            // Offline/manual-only exam — derive max from manualMap
            const manualsByCode = manualMap[parentExam.id]?.[code] ?? {};
            const firstEntry = Object.values(manualsByCode)[0];
            examMax = firstEntry?.max ?? weightMap.get(code) ?? 100;
          }
          if (examMax === 0) examMax = weightMap.get(code) ?? 100;
          const existing = aggregatedScores[code];
          aggregatedScores[code] = {
            earned: (existing?.earned ?? 0) + raw,
            available: (existing?.available ?? 0) + examMax,
            mode: "marks",
          };
        } else {
          // Case A: sub-component score already in parent marks units
          const parentExam = exams.find((e) => {
            if (e.subjectId !== subject.id) return false;
            const sws = examSubWeights[e.id] ?? [];
            return sws.some((sw) => (atIdToCode.get(sw.subAssessmentTypeId) ?? "") === code);
          });
          const parentCode = parentExam?.assessmentTypeId ?? code;

          // Find how many marks this component was worth (its allocated marks = its max possible)
          const parentExamSws = parentExam ? (examSubWeights[parentExam.id] ?? []) : [];
          const compSw = parentExamSws.find((sw) => (atIdToCode.get(sw.subAssessmentTypeId) ?? "") === code);
          const compMax = compSw?.weightPercentage ?? 0;

          const existing = aggregatedScores[parentCode];
          aggregatedScores[parentCode] = {
            earned: (existing?.earned ?? 0) + raw,
            available: (existing?.available ?? 0) + compMax,
            mode: "marks",
          };
        }
      }

      // Compute weighted score out of 100.
      // For each assessment type that has data:
      //   - Grade the student on what's been sat so far: (earned / available) * weight
      // Then normalise by totalWeight if not all assessments have been sat yet.
      let weightedScore = 0;
      let totalWeight = 0;

      for (const [assessType, { earned, available, mode }] of Object.entries(aggregatedScores)) {
        const weight = weightMap.get(assessType) ?? 0;
        if (weight === 0) continue;
        // earned/available gives proportion of this assessment type's sat marks
        // multiply by weight to get the contribution to the term total
        const proportion = available > 0 ? earned / available : 0;
        weightedScore += proportion * weight;
        totalWeight += weight;
      }

      // Normalise to 100 if only some assessments have been sat
      // so the grade reflects performance so far, not a projection to full term
      if (totalWeight > 0 && totalWeight < 100) {
        weightedScore = (weightedScore / totalWeight) * 100;
      }

      const grade = applyGradingScale(weightedScore, gradingScale);

      // Accumulate earned/available for overall percentage
      for (const { earned, available } of Object.values(aggregatedScores)) {
        totalEarned += earned;
        totalAvailable += available;
      }

      // Build display scores: parent assessment type code → raw marks (for broadsheet columns).
      // For sub-component exams (WBT → THEORY/OBJ), collapse sub-component scores into the
      // parent code using the actual raw values so the broadsheet shows e.g. WBT:12 (out of 15).
      const displayScores: Record<string, number> = {};
      for (const [code, rawVal] of Object.entries(studentScores)) {
        if (parentCodes.has(code)) {
          // Already keyed by parent code — store as-is (raw marks)
          displayScores[code] = (displayScores[code] ?? 0) + rawVal;
        } else {
          // Sub-component code — find its parent exam's assessmentTypeId
          const parentExam = exams.find((e) => {
            if (e.subjectId !== subject.id) return false;
            const sws = examSubWeights[e.id] ?? [];
            return sws.some((sw) => (atIdToCode.get(sw.subAssessmentTypeId) ?? "") === code);
          });
          const parentCode = parentExam?.assessmentTypeId ?? code;

          // rawVal here is already scaled to compMarks units. To get the actual raw mark
          // (e.g. 12 out of 15 for WBT), back-calculate from the ManualScore via manualMap.
          // Find any ManualScore entry for this student/exam/code and use its raw value.
          const manualEntry = Object.entries(manualMap[parentExam?.id ?? ""] ?? {})
            .find(([c]) => c === code)?.[1]?.[student.id];
          if (manualEntry) {
            displayScores[parentCode] = (displayScores[parentCode] ?? 0) + manualEntry.raw;
          } else {
            // Fallback: use scaled value
            displayScores[parentCode] = (displayScores[parentCode] ?? 0) + rawVal;
          }
        }
      }

      subjectResults.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        subjectId: subject.id,
        subjectName: subject.name,
        rawScores: displayScores,
        weightedScore: Math.round(weightedScore),
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
      totalAvailable > 0
        ? Math.round((totalEarned / totalAvailable) * 100)
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
    // Delete old subject results for students in this class to remove
    // subjects the student is no longer registered for.
    const studentIds = results.map((r) => r.studentId);
    if (studentIds.length > 0) {
      await tx.subjectResult.deleteMany({
        where: { termId, studentId: { in: studentIds } },
      });
    }

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
