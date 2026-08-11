import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "./config";

export interface Db {
  raw: Database.Database;
  insertBundle(bundleId: string, payload: string, examId: string, expiresAt: string): void;
  getBundle(bundleId: string): { bundleId: string; payload: string } | undefined;
  getBundles(): { bundleId: string; examId: string; payload: string }[];
  insertAttempt(attempt: Record<string, unknown>): void;
  getLocalOnlyAttempts(): { hubAttemptId: string; payload: string }[];
  markAttemptSynced(hubAttemptId: string): void;
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
      imported_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const insertBundle = raw.prepare(
    "INSERT OR REPLACE INTO bundles (bundle_id, exam_id, payload, expires_at) VALUES (?, ?, ?, ?)",
  );
  const getBundle = raw.prepare("SELECT bundle_id, payload FROM bundles WHERE bundle_id = ?");
  const getBundles = raw.prepare("SELECT bundle_id, exam_id, payload FROM bundles");
  const insertAttempt = raw.prepare(
    `INSERT OR REPLACE INTO attempts
      (hub_attempt_id, bundle_id, student_id, status, started_at, submitted_at, ends_at, shuffled_question_ids, shuffled_option_order)
     VALUES (@hubAttemptId, @bundleId, @studentId, @status, @startedAt, @submittedAt, @endsAt, @shuffledQuestionIds, @shuffledOptionOrder)`,
  );
  const getLocalOnly = raw.prepare(
    "SELECT a.hub_attempt_id AS hubAttemptId, b.payload AS payload FROM attempts a LEFT JOIN bundles b ON a.bundle_id = b.bundle_id WHERE a.synced = 0",
  );
  const markSynced = raw.prepare("UPDATE attempts SET synced = 1 WHERE hub_attempt_id = ?");

  return {
    raw,
    insertBundle: (bundleId, payload, examId, expiresAt) => insertBundle.run(bundleId, examId, payload, expiresAt),
    getBundle: (bundleId) => getBundle.get(bundleId) as { bundleId: string; payload: string } | undefined,
    getBundles: () => getBundles.all() as { bundleId: string; examId: string; payload: string }[],
    insertAttempt: (attempt) => insertAttempt.run(attempt),
    getLocalOnlyAttempts: () => getLocalOnly.all() as { hubAttemptId: string; payload: string }[],
    markAttemptSynced: (hubAttemptId) => markSynced.run(hubAttemptId),
  };
}