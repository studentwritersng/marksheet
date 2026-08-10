import { createHmac } from "node:crypto";
import { encryptBundle, decryptBundle, deriveBundleKey } from "./crypto";
import { prisma } from "@/lib/prisma";

export interface OfflineQuestionVM {
  id: string;
  text: string;
  type: string;
  marks: number;
  classLevel: string | null;
  topic: string | null;
  questionGroupId: string | null;
  groupInternallyShufflable: boolean | null;
  stimulus: { id: string; type: string; content: string } | null;
  mcqOptions: { id: string; optionText: string }[];
}

export interface OfflineRosterEntry {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  pin: string;
}

export interface OfflineBundleV1 {
  schemaVersion: 1;
  bundleId: string;
  examId: string;
  schoolId: string;
  issuedAt: string;
  expiresAt: string;
  durationMinutes: number;
  shuffleEnabled: boolean;
  exam: { subjectName: string; classNames: string[]; termLabel: string };
  questions: OfflineQuestionVM[];
  roster: OfflineRosterEntry[];
}

export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const PIN_HMAC_SECRET = process.env.PIN_HMAC_SECRET ?? "dev-pin-hmac-secret-change-me";

export function hashPin(pin: string): string {
  return createHmac("sha256", PIN_HMAC_SECRET).update(`pin:${pin}`).digest("hex");
}

function assertNoAnswerKey(data: OfflineBundleV1): void {
  for (const q of data.questions) {
    for (const opt of q.mcqOptions) {
      if (Object.prototype.hasOwnProperty.call(opt, "isCorrect")) {
        throw new Error("Answer key leak: isCorrect present in bundle.");
      }
    }
  }
}

export function serializeBundle(data: OfflineBundleV1, signingSecret: string, bundleId: string): string {
  if (data.schemaVersion !== 1) throw new Error("Unsupported bundle schema version.");
  assertNoAnswerKey(data);
  return encryptBundle(JSON.stringify(data), deriveBundleKey(signingSecret, bundleId));
}

export function parseBundlePayload(payload: string, keyHex: string): OfflineBundleV1 {
  const raw = decryptBundle(payload, keyHex);
  const parsed = JSON.parse(raw) as OfflineBundleV1;
  if (parsed.schemaVersion !== 1 || !parsed.bundleId || !Array.isArray(parsed.questions) || !Array.isArray(parsed.roster)) {
    throw new Error("Invalid bundle payload shape.");
  }
  return parsed;
}

export async function fetchExamDataForBundle(examId: string, schoolId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: {
      subject: { select: { name: true } },
      term: { include: { session: { select: { label: true } } } },
      classes: { include: { class: { select: { id: true, name: true } } } },
      examQuestions: {
        include: {
          question: {
            include: {
              mcqOptions: { select: { id: true, optionText: true, isCorrect: true } },
              group: { select: { id: true, internallyShufflable: true, stimulus: true } },
            },
          },
        },
      },
    },
  });
  if (!exam) throw new Error("Exam not found.");
  if (exam.status !== "published") throw new Error("Only published exams can be released offline.");
  if (exam.examQuestions.length === 0) throw new Error("Exam has no questions.");

  const classIds = exam.classes.map((ec) => ec.classId);
  const students = await prisma.student.findMany({
    where: { schoolId: exam.schoolId, currentClassId: { in: classIds }, status: "active" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, admissionNumber: true, firstName: true, lastName: true },
  });
  if (students.length === 0) throw new Error("No active students are enrolled in this exam's classes.");

  const questions: OfflineQuestionVM[] = exam.examQuestions.map((eq) => {
    const q = eq.question;
    return {
      id: q.id,
      text: q.text,
      type: q.type,
      marks: q.marks,
      classLevel: q.classLevel,
      topic: q.topic,
      questionGroupId: q.questionGroupId,
      groupInternallyShufflable: q.group?.internallyShufflable ?? null,
      stimulus: q.group?.stimulus
        ? { id: q.group.stimulus.id, type: q.group.stimulus.type, content: q.group.stimulus.content }
        : null,
      mcqOptions: q.mcqOptions.map((o) => ({ id: o.id, optionText: o.optionText })),
    };
  });

  return {
    exam: {
      id: exam.id,
      schoolId: exam.schoolId,
      durationMinutes: exam.durationMinutes,
      shuffleEnabled: exam.shuffleEnabled,
      subjectName: exam.subject.name,
      classNames: exam.classes.map((ec) => ec.class.name),
      termLabel: `${exam.term.name} (${exam.term.session.label})`,
    },
    questions,
    students,
  };
}