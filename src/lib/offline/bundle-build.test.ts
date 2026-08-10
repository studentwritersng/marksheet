import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { fetchExamDataForBundle, serializeBundle, type OfflineBundleV1 } from "./bundle";

vi.mock("@/lib/prisma", () => ({ prisma: { exam: {}, student: {} } }));

const baseExam = {
  id: "exam-1",
  schoolId: "school-1",
  status: "published",
  durationMinutes: 60,
  shuffleEnabled: true,
  subject: { name: "Maths" },
  term: { name: "Term 1", session: { label: "2026/2027" } },
  classes: [{ class: { id: "cls-1", name: "SS1A" } }],
  examQuestions: [
    {
      question: {
        id: "q-1",
        text: "2+2?",
        type: "mcq",
        marks: 2,
        classLevel: "SS1",
        topic: null,
        questionGroupId: null,
        mcqOptions: [{ id: "opt-1", optionText: "3", isCorrect: false }, { id: "opt-2", optionText: "4", isCorrect: true }],
        group: null,
      },
    },
  ],
};

beforeEach(() => {
  (prisma.exam.findFirst as any) = vi.fn().mockResolvedValue(baseExam);
  (prisma.student.findMany as any) = vi.fn().mockResolvedValue([
    { id: "stu-1", admissionNumber: "ADM/001", firstName: "Ada", lastName: "Obi" },
  ]);
});

describe("fetchExamDataForBundle", () => {
  it("strips answer keys and produces serializable data", async () => {
    const data = await fetchExamDataForBundle("exam-1", "school-1");
    expect(data.questions[0].mcqOptions[0]).not.toHaveProperty("isCorrect");
    expect(data.questions[0].mcqOptions[1]).not.toHaveProperty("isCorrect");
    const bundle: OfflineBundleV1 = {
      schemaVersion: 1,
      bundleId: "bundle-1",
      examId: "exam-1",
      schoolId: "school-1",
      issuedAt: "2026-08-09T08:00:00Z",
      expiresAt: "2026-08-20T08:00:00Z",
      durationMinutes: data.exam.durationMinutes,
      shuffleEnabled: data.exam.shuffleEnabled,
      exam: { subjectName: data.exam.subjectName, classNames: data.exam.classNames, termLabel: data.exam.termLabel },
      questions: data.questions,
      roster: data.students.map((s) => ({
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        pin: "123456",
      })),
    };
    const enc = serializeBundle(bundle, "secret", "bundle-1");
    expect(enc.startsWith("msb1.")).toBe(true);
    expect(enc).not.toContain("opt-2"); // ciphertext, no option ids visible
  });
});