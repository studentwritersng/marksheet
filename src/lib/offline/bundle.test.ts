import { describe, it, expect } from "vitest";
import { serializeBundle, generatePin, hashPin, parseBundlePayload, type OfflineBundleV1 } from "./bundle";
import { deriveBundleKey } from "./crypto";

function makeData(): OfflineBundleV1 {
  return {
    schemaVersion: 1,
    bundleId: "bundle-1",
    examId: "exam-1",
    schoolId: "school-1",
    issuedAt: "2026-08-09T08:00:00Z",
    expiresAt: "2026-08-20T08:00:00Z",
    durationMinutes: 60,
    shuffleEnabled: true,
    exam: { subjectName: "Maths", classNames: ["SS1A"], termLabel: "Term 1 (2026/2027)" },
    questions: [
      {
        id: "q-1",
        text: "What is 2+2?",
        type: "mcq",
        marks: 2,
        classLevel: "SS1",
        topic: "Arithmetic",
        questionGroupId: null,
        groupInternallyShufflable: null,
        stimulus: null,
        mcqOptions: [
          { id: "opt-1", optionText: "3" },
          { id: "opt-2", optionText: "4" },
        ],
      },
    ],
    roster: [
      { studentId: "stu-1", admissionNumber: "ADM/001", firstName: "Ada", lastName: "Obi", pin: "123456" },
    ],
  };
}

describe("bundle serializer", () => {
  const key = deriveBundleKey("secret", "bundle-1");

  it("serializes and round-trips through parse", () => {
    const enc = serializeBundle(makeData(), "secret", "bundle-1");
    const parsed = parseBundlePayload(enc, key);
    expect(parsed.examId).toBe("exam-1");
    expect(parsed.questions.length).toBe(1);
    expect(parsed.roster[0].pin).toBe("123456");
  });

  it("rejects payloads that would leak the answer key", () => {
    const leaked = makeData() as unknown as OfflineBundleV1;
    (leaked.questions[0] as unknown as { mcqOptions: { isCorrect?: boolean }[] }).mcqOptions[0].isCorrect = true;
    expect(() => serializeBundle(leaked, "secret", "bundle-1")).toThrow(/isCorrect/);
  });

  it("generates 6-digit pins", () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it("hashes pins non-reversibly and deterministically", () => {
    expect(hashPin("123456")).toBe(hashPin("123456"));
    expect(hashPin("123456")).not.toBe(hashPin("654321"));
  });
});