import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "./config";

export interface AttemptRow {
  hubAttemptId: string;
  bundleId: string;
  studentId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  endsAt: string | null;
  shuffledQuestionIds: string | null;
  shuffledOptionOrder: string | null;
  lastAutosaveAt: string | null;
  synced: 0 | 1;
}

export interface AnswerRow {
  id: number;
  hubAttemptId: string;
  questionId: string;
  mcqSelectedOptionId: string | null;
  essayResponseText: string | null;
  clientTimestamp: string | null;
  localChecksum: string | null;
}

export interface BundleRow {
  bundleId: string;
  examId: string;
  payload: string;
  expiresAt: string | null;
  sessionOpen: 0 | 1;
  sessionDurationMinutes: number;
  openedAt: string | null;
}

export interface SigninLockRow {
  bundleId: string;
  studentId: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface UpsertAnswerArgs {
  hubAttemptId: string;
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp: string;
  localChecksum?: string | null;
}

export interface Db {
  raw: Database.Database;
  insertBundle(bundleId: string, payload: string, examId: string, expiresAt: string): void;
  getBundle(bundleId: string): { bundleId: string; payload: string } | undefined;
  getBundleWithStatus(bundleId: string): BundleRow | undefined;
  getBundles(): { bundleId: string; examId: string; payload: string }[];
  getOpenBundles(): BundleRow[];
  setSessionOpen(bundleId: string, open: boolean, durationMinutes?: number): void;
  insertAttempt(attempt: Record<string, unknown>): void;
  getAttemptByStudent(bundleId: string, studentId: string): AttemptRow | undefined;
  getAttempt(hubAttemptId: string): AttemptRow | undefined;
  getLocalOnlyAttempts(): { hubAttemptId: string; payload: string }[];
  markAttemptSynced(hubAttemptId: string): void;
  getAnswers(hubAttemptId: string): AnswerRow[];
  upsertAnswer(args: UpsertAnswerArgs): void;
  markAttemptSubmitted(hubAttemptId: string, submittedAt: string): void;
  touchLastAutosave(hubAttemptId: string, at: string): void;
  getSigninLock(bundleId: string, studentId: string): SigninLockRow | undefined;
  recordSigninFailure(bundleId: string, studentId: string, lockedUntil: string | null): void;
  clearSigninLock(bundleId: string, studentId: string): void;
}

function ensureColumn(raw: Database.Database, table: string, column: string, ddl: string): void {
  const cols = raw.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    raw.exec(ddl);
  }
}

export function openDb(dataDir = getConfig().dataDir): Db {
  mkdirSync(dataDir, { recursive: true });
  const raw = new Database(resolve(dataDir, "hub.sqlite"));
  raw.pragma("journal_mode = WAL");
  raw.exec(`
    CREATE TABLE IF NOT EXISTS bundles (
      bundle_id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      expires_at TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      session_open INTEGER NOT NULL DEFAULT 0,
      session_duration_minutes INTEGER NOT NULL DEFAULT 0,
      opened_at TEXT
    );
    CREATE TABLE IF NOT EXISTS attempts (
      hub_attempt_id TEXT PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      started_at TEXT,
      submitted_at TEXT,
      ends_at TEXT,
      shuffled_question_ids TEXT,
      shuffled_option_order TEXT,
      last_autosave_at TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hub_attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      mcq_selected_option_id TEXT,
      essay_response_text TEXT,
      client_timestamp TEXT,
      local_checksum TEXT
    );
    CREATE TABLE IF NOT EXISTS signin_locks (
      bundle_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      PRIMARY KEY (bundle_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_attempt_question ON answers(hub_attempt_id, question_id);
  `);

  // Migrations for databases created before these columns existed.
  ensureColumn(
    raw,
    "bundles",
    "session_open",
    "ALTER TABLE bundles ADD COLUMN session_open INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    raw,
    "bundles",
    "session_duration_minutes",
    "ALTER TABLE bundles ADD COLUMN session_duration_minutes INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(raw, "bundles", "opened_at", "ALTER TABLE bundles ADD COLUMN opened_at TEXT");
  ensureColumn(raw, "attempts", "last_autosave_at", "ALTER TABLE attempts ADD COLUMN last_autosave_at TEXT");

  const insertBundle = raw.prepare(
    "INSERT OR REPLACE INTO bundles (bundle_id, exam_id, payload, expires_at) VALUES (?, ?, ?, ?)",
  );
  const getBundle = raw.prepare("SELECT bundle_id AS bundleId, payload FROM bundles WHERE bundle_id = ?");
  const bundleRowSql = `SELECT bundle_id AS bundleId, exam_id AS examId, payload, expires_at AS expiresAt,
      session_open AS sessionOpen, session_duration_minutes AS sessionDurationMinutes, opened_at AS openedAt
    FROM bundles`;
  const getBundleWithStatus = raw.prepare(`${bundleRowSql} WHERE bundle_id = ?`);
  const getBundles = raw.prepare("SELECT bundle_id AS bundleId, exam_id AS examId, payload FROM bundles");
  const getOpenBundles = raw.prepare(`${bundleRowSql} WHERE session_open = 1`);
  const setSessionOpen = raw.prepare(
    "UPDATE bundles SET session_open = ?, session_duration_minutes = ?, opened_at = ? WHERE bundle_id = ?",
  );
  const insertAttempt = raw.prepare(
    `INSERT OR REPLACE INTO attempts
      (hub_attempt_id, bundle_id, student_id, status, started_at, submitted_at, ends_at, shuffled_question_ids, shuffled_option_order, last_autosave_at)
     VALUES (@hubAttemptId, @bundleId, @studentId, @status, @startedAt, @submittedAt, @endsAt, @shuffledQuestionIds, @shuffledOptionOrder, @lastAutosaveAt)`,
  );
  const attemptRowSql = `SELECT hub_attempt_id AS hubAttemptId, bundle_id AS bundleId, student_id AS studentId,
      status, started_at AS startedAt, submitted_at AS submittedAt, ends_at AS endsAt,
      shuffled_question_ids AS shuffledQuestionIds, shuffled_option_order AS shuffledOptionOrder,
      last_autosave_at AS lastAutosaveAt, synced
    FROM attempts`;
  const getAttemptByStudent = raw.prepare(
    `${attemptRowSql} WHERE bundle_id = ? AND student_id = ? ORDER BY started_at DESC LIMIT 1`,
  );
  const getAttempt = raw.prepare(`${attemptRowSql} WHERE hub_attempt_id = ?`);
  const getLocalOnly = raw.prepare(
    "SELECT a.hub_attempt_id AS hubAttemptId, b.payload AS payload FROM attempts a LEFT JOIN bundles b ON a.bundle_id = b.bundle_id WHERE a.synced = 0 AND a.status = 'submitted'",
  );
  const markSynced = raw.prepare("UPDATE attempts SET synced = 1 WHERE hub_attempt_id = ?");
  const getAnswers = raw.prepare(
    `SELECT id, hub_attempt_id AS hubAttemptId, question_id AS questionId, mcq_selected_option_id AS mcqSelectedOptionId,
        essay_response_text AS essayResponseText, client_timestamp AS clientTimestamp, local_checksum AS localChecksum
      FROM answers WHERE hub_attempt_id = ? ORDER BY id`,
  );
  const upsertAnswer = raw.prepare(
    `INSERT INTO answers (hub_attempt_id, question_id, mcq_selected_option_id, essay_response_text, client_timestamp, local_checksum)
     VALUES (@hubAttemptId, @questionId, @mcqSelectedOptionId, @essayResponseText, @clientTimestamp, @localChecksum)
     ON CONFLICT(hub_attempt_id, question_id) DO UPDATE SET
       mcq_selected_option_id = excluded.mcq_selected_option_id,
       essay_response_text = excluded.essay_response_text,
       client_timestamp = excluded.client_timestamp,
       local_checksum = excluded.local_checksum`,
  );
  const markSubmitted = raw.prepare("UPDATE attempts SET status = 'submitted', submitted_at = ? WHERE hub_attempt_id = ?");
  const touchAutosave = raw.prepare("UPDATE attempts SET last_autosave_at = ? WHERE hub_attempt_id = ?");
  const getSigninLock = raw.prepare(
    `SELECT bundle_id AS bundleId, student_id AS studentId, failed_attempts AS failedAttempts, locked_until AS lockedUntil
     FROM signin_locks WHERE bundle_id = ? AND student_id = ?`,
  );
  const recordFailure = raw.prepare(
    `INSERT INTO signin_locks (bundle_id, student_id, failed_attempts, locked_until)
     VALUES (@bundleId, @studentId, 1, @lockedUntil)
     ON CONFLICT(bundle_id, student_id) DO UPDATE SET
       failed_attempts = failed_attempts + 1,
       locked_until = CASE WHEN excluded.locked_until IS NOT NULL THEN excluded.locked_until ELSE signin_locks.locked_until END`,
  );
  const clearLock = raw.prepare("DELETE FROM signin_locks WHERE bundle_id = ? AND student_id = ?");

  return {
    raw,
    insertBundle: (bundleId, payload, examId, expiresAt) => insertBundle.run(bundleId, examId, payload, expiresAt),
    getBundle: (bundleId) => getBundle.get(bundleId) as { bundleId: string; payload: string } | undefined,
    getBundleWithStatus: (bundleId) => getBundleWithStatus.get(bundleId) as BundleRow | undefined,
    getBundles: () => getBundles.all() as { bundleId: string; examId: string; payload: string }[],
    getOpenBundles: () => getOpenBundles.all() as BundleRow[],
    setSessionOpen: (bundleId, open, durationMinutes) =>
      setSessionOpen.run(open ? 1 : 0, durationMinutes ?? 0, open ? new Date().toISOString() : null, bundleId),
    insertAttempt: (attempt) => insertAttempt.run(attempt),
    getAttemptByStudent: (bundleId, studentId) => getAttemptByStudent.get(bundleId, studentId) as AttemptRow | undefined,
    getAttempt: (hubAttemptId) => getAttempt.get(hubAttemptId) as AttemptRow | undefined,
    getLocalOnlyAttempts: () => getLocalOnly.all() as { hubAttemptId: string; payload: string }[],
    markAttemptSynced: (hubAttemptId) => markSynced.run(hubAttemptId),
    getAnswers: (hubAttemptId) => getAnswers.all(hubAttemptId) as AnswerRow[],
    upsertAnswer: (args) =>
      upsertAnswer.run({
        hubAttemptId: args.hubAttemptId,
        questionId: args.questionId,
        mcqSelectedOptionId: args.mcqSelectedOptionId ?? null,
        essayResponseText: args.essayResponseText ?? null,
        clientTimestamp: args.clientTimestamp,
        localChecksum: args.localChecksum ?? null,
      }),
    markAttemptSubmitted: (hubAttemptId, submittedAt) => markSubmitted.run(submittedAt, hubAttemptId),
    touchLastAutosave: (hubAttemptId, at) => touchAutosave.run(at, hubAttemptId),
    getSigninLock: (bundleId, studentId) => getSigninLock.get(bundleId, studentId) as SigninLockRow | undefined,
    recordSigninFailure: (bundleId, studentId, lockedUntil) => recordFailure.run({ bundleId, studentId, lockedUntil }),
    clearSigninLock: (bundleId, studentId) => clearLock.run(bundleId, studentId),
  };
}
