import { randomBytes } from "node:crypto";
import { buildShuffle, remainingFromEndsAt } from "../../shared/exam-rendering/exam-taking-core";
import type { ExamQuestion, SavedAnswer } from "../../shared/exam-rendering/types";
import type { AttemptRow, Db } from "./db";
import { answerChecksum, verifyAnswerChecksum } from "./crypto";

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 10;

export interface BundleRosterEntry {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  pin: string;
}

export interface BundlePayload {
  schemaVersion: 1;
  bundleId: string;
  examId: string;
  schoolId: string;
  issuedAt: string;
  expiresAt: string;
  durationMinutes: number;
  shuffleEnabled: boolean;
  exam: { subjectName: string; classNames: string[]; termLabel: string };
  questions: ExamQuestion[];
  roster: BundleRosterEntry[];
}

export interface AttemptInfo {
  hubAttemptId: string;
  startedAt: string;
  submittedAt: string | null;
  endsAt: string | null;
  shuffledQuestionIds: string[] | null;
  shuffledOptionOrder: Record<string, string[]> | null;
  lastAutosaveAt: string | null;
}

export interface IncomingAnswer {
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp?: string;
  localChecksum?: string | null;
}

export interface SignInSuccess {
  ok: true;
  student: { studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null };
  exam: { subjectName: string; classNames: string[]; termLabel: string; durationMinutes: number; questionCount: number };
  questions: ExamQuestion[];
  attempt: AttemptInfo | null;
  savedAnswers: SavedAnswer[];
}

export interface SignInFailure {
  ok: false;
  error: string;
  lockoutSeconds?: number;
}

export type SignInResult = SignInSuccess | SignInFailure;

export interface StudentSessionInfo {
  bundleId: string;
  subjectName: string;
  classNames: string[];
  termLabel: string;
  durationMinutes: number;
  questionCount: number;
  openedAt: string | null;
}

export interface StudentSignInSuccess {
  ok: true;
  student: { studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null };
  sessions: StudentSessionInfo[];
}

export type StudentSignInResult = StudentSignInSuccess | SignInFailure;

export function parsePayload(raw: string): BundlePayload {
  const parsed = JSON.parse(raw) as BundlePayload;
  if (
    !parsed ||
    parsed.schemaVersion !== 1 ||
    !parsed.bundleId ||
    !Array.isArray(parsed.questions) ||
    !Array.isArray(parsed.roster)
  ) {
    throw new Error("Invalid bundle payload shape.");
  }
  return parsed;
}

export function getRosterStudent(payload: BundlePayload, admissionNumber: string): BundleRosterEntry | null {
  const norm = admissionNumber.trim().toUpperCase();
  return payload.roster.find((r) => r.admissionNumber.trim().toUpperCase() === norm) ?? null;
}

function toAttemptInfo(row: AttemptRow): AttemptInfo {
  return {
    hubAttemptId: row.hubAttemptId,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    endsAt: row.endsAt,
    shuffledQuestionIds: row.shuffledQuestionIds ? JSON.parse(row.shuffledQuestionIds) : null,
    shuffledOptionOrder: row.shuffledOptionOrder ? JSON.parse(row.shuffledOptionOrder) : null,
    lastAutosaveAt: row.lastAutosaveAt,
  };
}

function lockState(
  db: Db,
  bundleId: string,
  studentId: string,
): { locked: boolean; retryAfterSeconds?: number } {
  const lock = db.getSigninLock(bundleId, studentId);
  if (lock?.lockedUntil && new Date(lock.lockedUntil).getTime() > Date.now()) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((new Date(lock.lockedUntil).getTime() - Date.now()) / 1000),
    };
  }
  return { locked: false };
}

export function signIn(db: Db, bundleId: string, admissionNumber: string, pin: string): SignInResult {
  const bundleStatus = db.getBundleWithStatus(bundleId);
  if (!bundleStatus) return { ok: false, error: "Exam not found on this hub." };

  const payload = parsePayload(bundleStatus.payload);
  const roster = getRosterStudent(payload, admissionNumber);
  if (!roster) return { ok: false, error: "No student found with that admission number." };

  const studentId = roster.studentId;
  const sessionOpen = bundleStatus.sessionOpen === 1;
  const existing = db.getAttemptByStudent(bundleId, studentId);
  if (!sessionOpen && !existing) {
    return { ok: false, error: "This exam session is not open yet." };
  }

  const lock = lockState(db, bundleId, studentId);
  if (lock.locked) {
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${Math.max(1, Math.ceil(lock.retryAfterSeconds! / 60))} minute(s).`,
      lockoutSeconds: lock.retryAfterSeconds,
    };
  }

  if (roster.pin !== pin.trim()) {
    const failures = (db.getSigninLock(bundleId, studentId)?.failedAttempts ?? 0) + 1;
    if (failures >= MAX_PIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString();
      db.recordSigninFailure(bundleId, studentId, lockedUntil);
      return {
        ok: false,
        error: `Too many failed attempts. Try again in ${PIN_LOCK_MINUTES} minutes.`,
        lockoutSeconds: PIN_LOCK_MINUTES * 60,
      };
    }
    db.recordSigninFailure(bundleId, studentId, null);
    return { ok: false, error: "Invalid PIN." };
  }

  db.clearSigninLock(bundleId, studentId);

  const attempt = db.getAttemptByStudent(bundleId, studentId);
  const savedAnswers = attempt
    ? db.getAnswers(attempt.hubAttemptId).map((a) => ({
        questionId: a.questionId,
        mcqSelectedOptionId: a.mcqSelectedOptionId ?? undefined,
        essayResponseText: a.essayResponseText ?? undefined,
      }))
    : [];
  return {
    ok: true,
    student: {
      studentId,
      admissionNumber: roster.admissionNumber,
      studentName: `${roster.firstName} ${roster.lastName}`.trim(),
      studentPhoto: null,
    },
    exam: {
      subjectName: payload.exam.subjectName,
      classNames: payload.exam.classNames,
      termLabel: payload.exam.termLabel,
      durationMinutes: payload.durationMinutes,
      questionCount: payload.questions.length,
    },
    questions: payload.questions,
    attempt: attempt ? toAttemptInfo(attempt) : null,
    savedAnswers,
  };
}

export function signInStudent(db: Db, admissionNumber: string, pin: string): StudentSignInResult {
  const norm = admissionNumber.trim().toUpperCase();
  const bundles = db.getBundles();
  const sessions: StudentSessionInfo[] = [];
  let student: { studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null } | null = null;
  let found = false;
  let validPin = false;

  for (const b of bundles) {
    let payload: BundlePayload;
    try {
      payload = parsePayload(b.payload);
    } catch {
      continue;
    }
    const roster = getRosterStudent(payload, admissionNumber);
    if (!roster) continue;
    found = true;
    if (roster.pin !== pin.trim()) continue;
    validPin = true;
    if (!student) {
      student = {
        studentId: roster.studentId,
        admissionNumber: roster.admissionNumber,
        studentName: `${roster.firstName} ${roster.lastName}`.trim(),
        studentPhoto: null,
      };
    }
    sessions.push({
      bundleId: b.bundleId,
      subjectName: payload.exam.subjectName,
      classNames: payload.exam.classNames,
      termLabel: payload.exam.termLabel,
      durationMinutes: payload.durationMinutes,
      questionCount: payload.questions.length,
      openedAt: null,
    });
  }

  if (!found) {
    return { ok: false, error: "No student found with that admission number on this hub." };
  }
  if (!validPin) {
    return { ok: false, error: "Invalid PIN." };
  }
  if (sessions.length === 0) {
    return { ok: false, error: "No exam sessions are open for you yet." };
  }

  return { ok: true, student: student!, sessions };
}

export type StartAttemptResult =
  | { ok: true; attempt: AttemptInfo }
  | { ok: false; error: string };

export function startAttempt(db: Db, bundleId: string, studentId: string): StartAttemptResult {
  const bundle = db.getBundle(bundleId);
  if (!bundle) return { ok: false, error: "Exam not found on this hub." };

  const payload = parsePayload(bundle.payload);
  if (!payload.roster.some((r) => r.studentId === studentId)) {
    return { ok: false, error: "Student not enrolled in this exam." };
  }

  const existing = db.getAttemptByStudent(bundleId, studentId);
  if (existing) return { ok: true, attempt: toAttemptInfo(existing) };

  const shuffle = buildShuffle(payload.questions, payload.shuffleEnabled);
  const startedAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + payload.durationMinutes * 60_000).toISOString();
  const hubAttemptId = `att-${randomBytes(8).toString("hex")}`;

  db.insertAttempt({
    hubAttemptId,
    bundleId,
    studentId,
    status: "started",
    startedAt,
    submittedAt: null,
    endsAt,
    shuffledQuestionIds: shuffle.shuffledQuestionIds ? JSON.stringify(shuffle.shuffledQuestionIds) : null,
    shuffledOptionOrder: shuffle.shuffledOptionOrder ? JSON.stringify(shuffle.shuffledOptionOrder) : null,
    lastAutosaveAt: null,
  });

  return {
    ok: true,
    attempt: {
      hubAttemptId,
      startedAt,
      submittedAt: null,
      endsAt,
      shuffledQuestionIds: shuffle.shuffledQuestionIds,
      shuffledOptionOrder: shuffle.shuffledOptionOrder,
      lastAutosaveAt: null,
    },
  };
}

export function saveAnswers(
  db: Db,
  attemptId: string,
  answers: IncomingAnswer[],
  signingSecret: string,
): { accepted: number; rejected: number } {
  const attempt = db.getAttempt(attemptId);
  if (!attempt || attempt.status === "submitted") {
    return { accepted: 0, rejected: answers.length };
  }

  const ts = new Date().toISOString();
  let accepted = 0;
  for (const a of answers) {
    const clientTs = a.clientTimestamp ?? ts;
    const payload = a.mcqSelectedOptionId ?? a.essayResponseText ?? "";
    db.upsertAnswer({
      hubAttemptId: attemptId,
      questionId: a.questionId,
      mcqSelectedOptionId: a.mcqSelectedOptionId ?? null,
      essayResponseText: a.essayResponseText ?? null,
      clientTimestamp: clientTs,
      localChecksum: answerChecksum(signingSecret, attemptId, a.questionId, clientTs, payload),
    });
    accepted++;
  }
  db.touchLastAutosave(attemptId, ts);
  return { accepted, rejected: answers.length - accepted };
}

export function tickAttempt(db: Db, attemptId: string): { remainingSeconds: number; expired: boolean } {
  const attempt = db.getAttempt(attemptId);
  if (!attempt || attempt.status === "submitted") return { remainingSeconds: 0, expired: false };

  const remaining = attempt.endsAt ? remainingFromEndsAt(attempt.endsAt) : 0;
  if (remaining <= 0) {
    db.markAttemptSubmitted(attemptId, new Date().toISOString());
    return { remainingSeconds: 0, expired: true };
  }
  return { remainingSeconds: remaining, expired: false };
}

export type SubmitAttemptResult = { ok: true; message: string } | { ok: false; error: string };

export function submitAttempt(
  db: Db,
  attemptId: string,
  answers: IncomingAnswer[],
  signingSecret: string,
): SubmitAttemptResult {
  const attempt = db.getAttempt(attemptId);
  if (!attempt) return { ok: false, error: "Invalid attempt." };
  if (attempt.status === "submitted") return { ok: true, message: "Exam already submitted." };

  const ts = new Date().toISOString();
  let accepted = 0;
  let rejected = 0;
  for (const a of answers) {
    const clientTs = a.clientTimestamp ?? ts;
    const payload = a.mcqSelectedOptionId ?? a.essayResponseText ?? "";
    if (a.localChecksum) {
      const valid = verifyAnswerChecksum(signingSecret, attemptId, a.questionId, clientTs, payload, a.localChecksum);
      if (!valid) {
        rejected++;
        continue;
      }
    }
    db.upsertAnswer({
      hubAttemptId: attemptId,
      questionId: a.questionId,
      mcqSelectedOptionId: a.mcqSelectedOptionId ?? null,
      essayResponseText: a.essayResponseText ?? null,
      clientTimestamp: clientTs,
      localChecksum: answerChecksum(signingSecret, attemptId, a.questionId, clientTs, payload),
    });
    accepted++;
  }

  const remaining = attempt.endsAt ? remainingFromEndsAt(attempt.endsAt) : 0;
  db.markAttemptSubmitted(attemptId, ts);
  return {
    ok: true,
    message: remaining <= 0 ? "Auto-submitted. Your answers were saved." : "Exam submitted. Your answers were saved.",
  };
}
