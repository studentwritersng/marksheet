import { describe, it, expect } from "vitest";
import { processSyncUp, type SyncUpPayload, type IngestStore } from "./ingest";
import { answerChecksum } from "./crypto";

const SECRET = "hub-secret";

function payload(): SyncUpPayload {
  return {
    bundleId: "bundle-1",
    attempts: [
      {
        hubAttemptId: "att-1",
        studentId: "stu-1",
        examId: "exam-1",
        startedAt: "2026-08-09T09:00:00Z",
        submittedAt: "2026-08-09T09:55:00Z",
        status: "submitted",
        shuffledQuestionIds: ["q-1", "q-2"],
        shuffledOptionOrder: { "q-1": ["opt-2", "opt-1"] },
        answers: [
          {
            questionId: "q-1",
            mcqSelectedOptionId: "opt-2",
            clientTimestamp: "2026-08-09T09:50:00Z",
            localChecksum: answerChecksum(SECRET, "att-1", "q-1", "2026-08-09T09:50:00Z", "opt-2"),
          },
        ],
      },
    ],
  };
}

function makeStore(): IngestStore & { calls: any[] } {
  const seen = new Set<string>();
  return {
    calls: [],
    async findAttempt(key) {
      this.calls.push(["find", key]);
      return seen.has(key.hubAttemptId);
    },
    async createAttempt(...args) {
      this.calls.push(["create", args]);
      seen.add((args[0] as any).hubAttemptId);
      return "db-att-1";
    },
    async createAnswers(...args) {
      this.calls.push(["answers", args]);
    },
    async getGradingInfo() {
      // q-1: mcq, 2 marks, correct option opt-2. q-2: essay.
      return [
        { questionId: "q-1", type: "mcq", marks: 2, correctOptionId: "opt-2" },
        { questionId: "q-2", type: "essay", marks: 5, correctOptionId: null },
      ];
    },
  };
}

describe("processSyncUp", () => {
  it("accepts a new attempt with valid checksums", async () => {
    const store = makeStore();
    const res = await processSyncUp(payload(), { id: "hub-1", signingSecret: SECRET }, store);
    expect(res[0].status).toBe("accepted");
    expect(store.calls.some((c) => c[0] === "create")).toBe(true);
  });

  it("returns duplicate for replayed attempts", async () => {
    const store = makeStore();
    const p = payload();
    await processSyncUp(p, { id: "hub-1", signingSecret: SECRET }, store);
    const res = await processSyncUp(p, { id: "hub-1", signingSecret: SECRET }, store);
    expect(res[0].status).toBe("duplicate");
    expect(store.calls.filter((c) => c[0] === "create").length).toBe(1);
  });

  it("flags tampered checksums and excludes from scoring", async () => {
    const p = payload();
    p.attempts[0].answers[0].localChecksum = answerChecksum(SECRET, "att-1", "q-1", "2026-08-09T09:50:00Z", "opt-9");
    const store = makeStore();
    const res = await processSyncUp(p, { id: "hub-1", signingSecret: SECRET }, store);
    expect(res[0].status).toBe("flagged");
  });

  it("accepts a batch with no attempts", async () => {
    const store = makeStore();
    const res = await processSyncUp({ bundleId: "bundle-1", attempts: [] }, { id: "hub-1", signingSecret: SECRET }, store);
    expect(res).toEqual([]);
  });

  it("grades a correct MCQ answer at ingest time", async () => {
    const store = makeStore();
    await processSyncUp(payload(), { id: "hub-1", signingSecret: SECRET }, store);
    const answers = store.calls.find((c) => c[0] === "answers")?.[1]?.[0];
    expect(answers?.[0]?.gradedScore).toBe(2); // opt-2 is correct, 2 marks
    expect(answers?.[0]?.gradingStatus).toBe("teacher_reviewed");
  });

  it("grades a wrong MCQ answer as 0", async () => {
    const p = payload();
    p.attempts[0].answers[0].mcqSelectedOptionId = "opt-1"; // wrong option
    p.attempts[0].answers[0].localChecksum = answerChecksum(SECRET, "att-1", "q-1", "2026-08-09T09:50:00Z", "opt-1");
    const store = makeStore();
    await processSyncUp(p, { id: "hub-1", signingSecret: SECRET }, store);
    const answers = store.calls.find((c) => c[0] === "answers")?.[1]?.[0];
    expect(answers?.[0]?.gradedScore).toBe(0);
  });

  it("leaves essays ungraded", async () => {
    const p = payload();
    p.attempts[0].answers = [
      {
        questionId: "q-2",
        essayResponseText: "My essay answer",
        clientTimestamp: "2026-08-09T09:50:00Z",
        localChecksum: answerChecksum(SECRET, "att-1", "q-2", "2026-08-09T09:50:00Z", "My essay answer"),
      },
    ];
    const store = makeStore();
    await processSyncUp(p, { id: "hub-1", signingSecret: SECRET }, store);
    const answers = store.calls.find((c) => c[0] === "answers")?.[1]?.[0];
    expect(answers?.[0]?.gradedScore).toBeNull();
  });

  it("does not grade flagged (checksum-tampered) answers", async () => {
    const p = payload();
    p.attempts[0].answers[0].localChecksum = answerChecksum(SECRET, "att-1", "q-1", "2026-08-09T09:50:00Z", "opt-9");
    const store = makeStore();
    await processSyncUp(p, { id: "hub-1", signingSecret: SECRET }, store);
    const answers = store.calls.find((c) => c[0] === "answers")?.[1]?.[0];
    expect(answers?.[0]?.checksumFlagged).toBe(true);
    expect(answers?.[0]?.gradedScore).toBeNull(); // flagged answers must not earn marks
  });
});