// src/lib/results/compute.test.ts
import { describe, it, expect } from "vitest";
import { assembleScoreMap, type AssembleParams } from "./compute";

const atTypes = [
  { id: "obj1", code: "OBJ", parentId: "parent1" },
  { id: "th1", code: "THEORY", parentId: "parent1" },
  { id: "prc1", code: "PRC", parentId: "parent1" },
  { id: "parent1", code: "EXM", parentId: null },
];
const atIdToCode = new Map(atTypes.map((a) => [a.id, a.code]));

describe("assembleScoreMap — new per-sub-assessment model", () => {
  it("scales each component to its allocation", () => {
    const params: AssembleParams = {
      exams: [
        { id: "eObj", subjectId: "sub1", assessmentTypeId: "parent1", subAssessmentWeights: [{ subAssessmentTypeId: "obj1", weightPercentage: 20 }] },
        { id: "eTh", subjectId: "sub1", assessmentTypeId: "parent1", subAssessmentWeights: [{ subAssessmentTypeId: "th1", weightPercentage: 60 }] },
        { id: "ePrc", subjectId: "sub1", assessmentTypeId: "parent1", subAssessmentWeights: [{ subAssessmentTypeId: "prc1", weightPercentage: 20 }] },
      ],
      attempts: [
        { examId: "eObj", studentId: "s1", answers: [{ finalScore: 18 }, { finalScore: 0 }] }, // 18/20
        { examId: "eTh", studentId: "s1", answers: [{ finalScore: 45 }] },                     // 45/75
      ],
      manualScores: [{ examId: "ePrc", studentId: "s1", subAssessmentTypeCode: "PRC", rawScore: 15, maxRawScore: 20 }],
      atIdToCode,
      examMaxScores: { eObj: 20, eTh: 75 },
      examSubWeights: {
        eObj: [{ subAssessmentTypeId: "obj1", weightPercentage: 20 }],
        eTh: [{ subAssessmentTypeId: "th1", weightPercentage: 60 }],
        ePrc: [{ subAssessmentTypeId: "prc1", weightPercentage: 20 }],
      },
    };
    const sm = assembleScoreMap(params);
    expect(sm["s1"]["sub1"]["OBJ"]).toBeCloseTo(18, 6);   // 18/20 * 20
    expect(sm["s1"]["sub1"]["THEORY"]).toBeCloseTo(36, 6); // 45/75 * 60
    expect(sm["s1"]["sub1"]["PRC"]).toBeCloseTo(15, 6);    // 15/20 * 20
  });
});

describe("assembleScoreMap — legacy single exam (unchanged)", () => {
  it("proportionally splits the combined raw score (existing behaviour)", () => {
    const params: AssembleParams = {
      exams: [
        { id: "eLegacy", subjectId: "sub1", assessmentTypeId: "parent1",
          subAssessmentWeights: [
            { subAssessmentTypeId: "obj1", weightPercentage: 20 },
            { subAssessmentTypeId: "th1", weightPercentage: 60 },
            { subAssessmentTypeId: "prc1", weightPercentage: 20 },
          ] },
      ],
      attempts: [
        { examId: "eLegacy", studentId: "s1",
          answers: [{ finalScore: 10 }, { finalScore: 8 }, { finalScore: 5 }, { finalScore: 40 }] }, // 63/95 combined
      ],
      manualScores: [],
      atIdToCode,
      examMaxScores: { eLegacy: 95 },
      examSubWeights: {
        eLegacy: [
          { subAssessmentTypeId: "obj1", weightPercentage: 20 },
          { subAssessmentTypeId: "th1", weightPercentage: 60 },
          { subAssessmentTypeId: "prc1", weightPercentage: 20 },
        ],
      },
    };
    const sm = assembleScoreMap(params);
    // platformComponentTotal (OBJ+THEORY) = 80; OBJ share = 20/80 = 0.25
    // OBJ = (63/95) * 20 * 0.25 = 3.3158 ; THEORY = (63/95) * 60 * 0.75 = 29.842
    expect(sm["s1"]["sub1"]["OBJ"]).toBeCloseTo(3.3158, 3);
    expect(sm["s1"]["sub1"]["THEORY"]).toBeCloseTo(29.842, 3);
    expect(sm["s1"]["sub1"]["PRC"]).toBeUndefined();
  });
});
