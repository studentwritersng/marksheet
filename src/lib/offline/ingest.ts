import { verifyAnswerChecksum } from "./crypto";

export interface SyncUpAnswer {
  questionId: string;
  mcqSelectedOptionId?: string;
  essayResponseText?: string;
  clientTimestamp: string;
  localChecksum: string;
}

export interface SyncUpAttempt {
  hubAttemptId: string;
  studentId: string;
  examId: string;
  startedAt: string;
  submittedAt: string;
  status: string;
  shuffledQuestionIds: string[] | null;
  shuffledOptionOrder: Record<string, string[]> | null;
  answers: SyncUpAnswer[];
}

export interface SyncUpPayload {
  bundleId: string;
  attempts: SyncUpAttempt[];
}

export interface AttemptKey {
  hubId: string;
  hubAttemptId: string;
}

export interface AttemptRecord {
  hubId: string;
  hubAttemptId: string;
  studentId: string;
  examId: string;
  startedAt: string;
  submittedAt: string;
  status: string;
  shuffledQuestionIds: unknown;
  shuffledOptionOrder: unknown;
  syncStatus: string;
}

export interface AnswerRecord {
  attemptId: string;
  questionId: string;
  mcqSelectedOptionId: string | null;
  essayResponseText: string | null;
  checksumFlagged: boolean;
}

export interface IngestStore {
  findAttempt(key: AttemptKey): Promise<boolean>;
  createAttempt(record: AttemptRecord): Promise<string>;
  createAnswers(records: AnswerRecord[]): Promise<void>;
}

export async function processSyncUp(
  payload: SyncUpPayload,
  hub: { id: string; signingSecret: string },
  store: IngestStore,
): Promise<Array<{ hubAttemptId: string; status: "accepted" | "duplicate" | "flagged" }>> {
  const results: Array<{ hubAttemptId: string; status: "accepted" | "duplicate" | "flagged" }> = [];

  for (const attempt of payload.attempts) {
    const key: AttemptKey = { hubId: hub.id, hubAttemptId: attempt.hubAttemptId };

    if (await store.findAttempt(key)) {
      results.push({ hubAttemptId: attempt.hubAttemptId, status: "duplicate" });
      continue;
    }

    let flagged = false;
    const answers: AnswerRecord[] = [];
    for (const a of attempt.answers) {
      const payloadStr = a.mcqSelectedOptionId ?? a.essayResponseText ?? "";
      const valid = verifyAnswerChecksum(
        hub.signingSecret,
        attempt.hubAttemptId,
        a.questionId,
        a.clientTimestamp,
        payloadStr,
        a.localChecksum,
      );
      if (!valid) flagged = true;
      answers.push({
        attemptId: attempt.hubAttemptId, // replaced with the real DB id below
        questionId: a.questionId,
        mcqSelectedOptionId: a.mcqSelectedOptionId ?? null,
        essayResponseText: a.essayResponseText ?? null,
        checksumFlagged: !valid,
      });
    }

    const attemptId = await store.createAttempt({
      hubId: hub.id,
      hubAttemptId: attempt.hubAttemptId,
      studentId: attempt.studentId,
      examId: attempt.examId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      status: attempt.status,
      shuffledQuestionIds: attempt.shuffledQuestionIds,
      shuffledOptionOrder: attempt.shuffledOptionOrder,
      syncStatus: "synced",
    });

    if (answers.length > 0) await store.createAnswers(answers.map((a) => ({ ...a, attemptId })));

    results.push({ hubAttemptId: attempt.hubAttemptId, status: flagged ? "flagged" : "accepted" });
  }

  return results;
}