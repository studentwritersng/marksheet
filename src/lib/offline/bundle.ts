import { createHmac } from "node:crypto";
import { encryptBundle, decryptBundle, deriveBundleKey } from "./crypto";

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