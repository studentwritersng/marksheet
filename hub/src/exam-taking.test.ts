import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type Db } from "./db";
import {
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_MINUTES,
  parsePayload,
  saveAnswers,
  signIn,
  startAttempt,
  submitAttempt,
  tickAttempt,
  type BundlePayload,
} from "./exam-taking";
import { answerChecksum, verifyAnswerChecksum } from "./crypto";

const SECRET = "test-secret";

function makePayload(overrides: Partial<BundlePayload> = {}): BundlePayload {
  return {
    schemaVersion: 1,
    bundleId: "b-1",
    examId: "e-1",
    schoolId: "school-1",
    issuedAt: new Date().toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    durationMinutes: 60,
    shuffleEnabled: false,
    exam: { subjectName: "Mathematics", classNames: ["JSS 1"], termLabel: "First Term (2026/2027)" },
    questions: [
      { id: "q-1", text: "2 + 2", type: "mcq", marks: 2, mcqOptions: [{ id: "opt-1", optionText: "3" }, { id: "opt-2", optionText: "4" }, { id: "opt-3", optionText: "5" }], hasModelAnswer: false },
      { id: "q-2", text: "Explain gravity", type: "essay", marks: 5, mcqOptions: [] },
    ],
    roster: [
      { studentId: "stu-1", admissionNumber: "ADM/001", firstName: "Ada", lastName: "Obi", pin: "123456" },
      { studentId: "stu-2", admissionNumber: "ADM/002", firstName: "Ben", lastName: "Okafor", pin: "654321" },
    ],
    ...overrides,
  };
}

const openDbs: Db[] = [];

function setup(overrides: Partial<BundlePayload> = {}): { db: Db; payload: BundlePayload } {
  const db = openDb(mkdtempSync(join(tmpdir(), "hub-test-")));
  openDbs.push(db);
  const payload = makePayload(overrides);
  db.insertBundle(payload.bundleId, JSON.stringify(payload), payload.examId, payload.expiresAt);
  db.setSessionOpen(payload.bundleId, true, payload.durationMinutes);
  return { db, payload };
}

afterEach(() => {
  for (const db of openDbs.splice(0)) db.raw.close();
});

describe("parsePayload", () => {
  it("parses a valid bundle payload", () => {
    const { payload } = setup();
    const parsed = parsePayload(JSON.stringify(payload));
    expect(parsed.questions).toHaveLength(2);
  });

  it("rejects malformed payloads", () => {
    expect(() => parsePayload(JSON.stringify({ foo: 1 }))).toThrow();
  });
});

describe("signIn", () => {
  it("returns student + questions and no attempt on fresh sign-in", () => {
    const { db } = setup();
    const res = signIn(db, "b-1", "ADM/001", "123456");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.student.studentId).toBe("stu-1");
    expect(res.student.studentName).toBe("Ada Obi");
    expect(res.questions).toHaveLength(2);
    expect(res.exam.subjectName).toBe("Mathematics");
    expect(res.attempt).toBeNull();
  });

  it("rejects sign-in when the session is closed and no attempt exists", () => {
    const { db } = setup();
    db.setSessionOpen("b-1", false);
    const res = signIn(db, "b-1", "ADM/001", "123456");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not open/);
  });

  it("rejects an unknown admission number", () => {
    const { db } = setup();
    const res = signIn(db, "b-1", "ADM/999", "123456");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/admission number/);
  });

  it("rejects a wrong PIN and locks after MAX_PIN_ATTEMPTS failures", () => {
    const { db } = setup();
    for (let i = 0; i < MAX_PIN_ATTEMPTS - 1; i++) {
      const res = signIn(db, "b-1", "ADM/001", "000000");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("Invalid PIN.");
    }
    const last = signIn(db, "b-1", "ADM/001", "000000");
    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.error).toMatch(/Too many failed attempts/);
      expect(last.lockoutSeconds).toBe(PIN_LOCK_MINUTES * 60);
    }
    const lock = db.getSigninLock("b-1", "stu-1");
    expect(lock).toBeDefined();
    expect(new Date(lock!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());
  });

  it("allows resuming an existing attempt even if the session was closed", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    db.setSessionOpen("b-1", false);
    const res = signIn(db, "b-1", "ADM/001", "123456");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.attempt?.hubAttemptId).toBe(started.attempt.hubAttemptId);
  });

  it("clears the lock after a successful sign-in", () => {
    const { db } = setup();
    db.recordSigninFailure("b-1", "stu-1", null);
    db.recordSigninFailure("b-1", "stu-1", null);
    signIn(db, "b-1", "ADM/001", "123456");
    expect(db.getSigninLock("b-1", "stu-1")).toBeUndefined();
  });
});

describe("startAttempt", () => {
  it("creates an attempt ending roughly durationMinutes from now", () => {
    const { db, payload } = setup();
    const before = Date.now();
    const res = startAttempt(db, "b-1", "stu-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ends = new Date(res.attempt.endsAt!).getTime();
    expect(ends - before).toBeGreaterThanOrEqual(payload.durationMinutes * 60_000 - 5000);
    expect(ends - before).toBeLessThanOrEqual(payload.durationMinutes * 60_000 + 5000);
  });

  it("is idempotent for the same student", () => {
    const { db } = setup();
    const first = startAttempt(db, "b-1", "stu-1");
    const second = startAttempt(db, "b-1", "stu-1");
    if (!first.ok || !second.ok) throw new Error("start failed");
    expect(second.attempt.hubAttemptId).toBe(first.attempt.hubAttemptId);
  });

  it("rejects a student not in the roster", () => {
    const { db } = setup();
    const res = startAttempt(db, "b-1", "intruder");
    expect(res.ok).toBe(false);
  });

  it("keeps grouped questions adjacent when shuffling is enabled", () => {
    const grouped: BundlePayload = {
      ...makePayload(),
      shuffleEnabled: true,
      questions: [
        { id: "g-1", text: "a", type: "essay", marks: 2, mcqOptions: [], questionGroupId: "grp" },
        { id: "g-2", text: "b", type: "essay", marks: 2, mcqOptions: [], questionGroupId: "grp" },
        { id: "q-1", text: "standalone", type: "essay", marks: 2, mcqOptions: [] },
      ],
    };
    const { db } = setup(grouped);
    const res = startAttempt(db, "b-1", "stu-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.attempt.shuffledQuestionIds!;
    expect([...ids].sort()).toEqual(["g-1", "g-2", "q-1"]);
    expect(Math.abs(ids.indexOf("g-1") - ids.indexOf("g-2"))).toBe(1);
  });
});

describe("saveAnswers", () => {
  it("persists answers and rejects after submission", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    const attemptId = started.attempt.hubAttemptId;

    const res = saveAnswers(db, attemptId, [
      { questionId: "q-1", mcqSelectedOptionId: "opt-2", clientTimestamp: new Date().toISOString() },
    ], SECRET);
    expect(res.accepted).toBe(1);
    expect(db.getAnswers(attemptId)).toHaveLength(1);
    expect(db.getAttempt(attemptId)!.lastAutosaveAt).toBeTruthy();

    submitAttempt(db, attemptId, [], SECRET);
    const after = saveAnswers(db, attemptId, [{ questionId: "q-2", essayResponseText: "x", clientTimestamp: new Date().toISOString() }], SECRET);
    expect(after.accepted).toBe(0);
    expect(after.rejected).toBe(1);
  });

  it("stores a checksum the cloud verifier accepts", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    const attemptId = started.attempt.hubAttemptId;
    const ts = new Date().toISOString();
    saveAnswers(db, attemptId, [{ questionId: "q-1", mcqSelectedOptionId: "opt-2", clientTimestamp: ts }], SECRET);
    const row = db.getAnswers(attemptId)[0];
    expect(row.localChecksum).toBe(answerChecksum(SECRET, attemptId, "q-1", ts, "opt-2"));
    expect(verifyAnswerChecksum(SECRET, attemptId, "q-1", ts, "opt-2", row.localChecksum!)).toBe(true);
  });
});

describe("tickAttempt", () => {
  it("counts down remaining seconds", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    const tick = tickAttempt(db, started.attempt.hubAttemptId);
    expect(tick.remainingSeconds).toBeGreaterThan(0);
    expect(tick.expired).toBe(false);
  });

  it("auto-submits when the deadline has passed", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    db.raw.prepare("UPDATE attempts SET ends_at = ? WHERE hub_attempt_id = ?").run(
      new Date(Date.now() - 1000).toISOString(),
      started.attempt.hubAttemptId,
    );
    const tick = tickAttempt(db, started.attempt.hubAttemptId);
    expect(tick.expired).toBe(true);
    expect(db.getAttempt(started.attempt.hubAttemptId)!.status).toBe("submitted");
  });
});

describe("submitAttempt", () => {
  it("stores answers with checksums and marks the attempt submitted", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    const attemptId = started.attempt.hubAttemptId;
    const ts = new Date().toISOString();

    const res = submitAttempt(db, attemptId, [
      { questionId: "q-1", mcqSelectedOptionId: "opt-2", clientTimestamp: ts },
      { questionId: "q-2", essayResponseText: "Because mass attracts mass.", clientTimestamp: ts },
    ], SECRET);

    expect(res.ok).toBe(true);
    const attempt = db.getAttempt(attemptId)!;
    expect(attempt.status).toBe("submitted");
    expect(attempt.submittedAt).toBeTruthy();
    expect(db.getAnswers(attemptId)).toHaveLength(2);
    const mcq = db.getAnswers(attemptId).find((a) => a.questionId === "q-1")!;
    expect(mcq.localChecksum).toBe(answerChecksum(SECRET, attemptId, "q-1", ts, "opt-2"));
  });

  it("is idempotent on a second call", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    const first = submitAttempt(db, started.attempt.hubAttemptId, [], SECRET);
    const second = submitAttempt(db, started.attempt.hubAttemptId, [], SECRET);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.message).toMatch(/already submitted/);
  });

  it("rejects an answer with a tampered checksum", () => {
    const { db } = setup();
    const started = startAttempt(db, "b-1", "stu-1");
    if (!started.ok) throw new Error("start failed");
    const attemptId = started.attempt.hubAttemptId;
    const ts = new Date().toISOString();
    const bad = answerChecksum(SECRET, attemptId, "q-1", ts, "opt-9");

    submitAttempt(db, attemptId, [
      { questionId: "q-1", mcqSelectedOptionId: "opt-2", clientTimestamp: ts, localChecksum: bad },
    ], SECRET);

    // The tampered answer is not persisted
    expect(db.getAnswers(attemptId)).toHaveLength(0);
  });
});
