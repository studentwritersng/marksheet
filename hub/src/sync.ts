import { getConfig } from "./config";
import { openDb, type Db } from "./db";
import { decryptBundle } from "./crypto";

export async function syncDown(db: Db): Promise<number> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.cloudBaseUrl}/api/hub/sync-down`, {
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`sync-down failed: ${res.status}`);
  const body = (await res.json()) as { bundles: Array<{ bundleId: string; examId: string; payload: string; keyHex: string; expiresAt: string }> };
  for (const b of body.bundles) {
    const plain = decryptBundle(b.payload, b.keyHex);
    const parsed = JSON.parse(plain) as { bundleId: string; examId: string };
    db.insertBundle(b.bundleId, plain, parsed.examId ?? b.examId, b.expiresAt);
  }
  return body.bundles.length;
}

export async function syncUp(db: Db): Promise<{ uploaded: number }> {
  const cfg = getConfig();
  const pending = db.getLocalOnlyAttempts();
  if (pending.length === 0) return { uploaded: 0 };

  const bundle = db.raw.prepare("SELECT bundle_id FROM attempts WHERE hub_attempt_id = ?").get(pending[0].hubAttemptId) as { bundle_id: string };

  const attempts = pending.map((a) => {
    const row = db.raw.prepare("SELECT * FROM attempts WHERE hub_attempt_id = ?").get(a.hubAttemptId) as Record<string, unknown>;
    const answers = db.raw.prepare("SELECT * FROM answers WHERE hub_attempt_id = ?").all(a.hubAttemptId) as Array<Record<string, unknown>>;
    return {
      hubAttemptId: a.hubAttemptId,
      studentId: row.student_id,
      examId: (db.raw.prepare("SELECT exam_id FROM bundles WHERE bundle_id = ?").get(row.bundle_id) as { exam_id: string }).exam_id,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      status: row.status,
      shuffledQuestionIds: row.shuffled_question_ids ? JSON.parse(row.shuffled_question_ids as string) : null,
      shuffledOptionOrder: row.shuffled_option_order ? JSON.parse(row.shuffled_option_order as string) : null,
      answers: answers.map((an) => ({
        questionId: an.question_id,
        mcqSelectedOptionId: an.mcq_selected_option_id ?? undefined,
        essayResponseText: an.essay_response_text ?? undefined,
        clientTimestamp: an.client_timestamp,
        localChecksum: an.local_checksum,
      })),
    };
  });

  const res = await fetch(`${cfg.cloudBaseUrl}/api/hub/sync-up`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ bundleId: bundle.bundle_id, attempts }),
  });
  if (!res.ok) throw new Error(`sync-up failed: ${res.status}`);
  const body = (await res.json()) as { results: Array<{ hubAttemptId: string; status: string }> };

  for (const r of body.results) {
    if (r.status !== "duplicate") db.markAttemptSynced(r.hubAttemptId);
  }
  return { uploaded: attempts.length };
}