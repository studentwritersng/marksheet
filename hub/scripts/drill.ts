import { openDb } from "../src/db";
import { syncDown, syncUp } from "../src/sync";
import { getConfig } from "../src/config";
import { createHmac, randomBytes } from "node:crypto";

function checksum(secret: string, attemptId: string, questionId: string, ts: string, payload: string): string {
  return createHmac("sha256", secret).update(`answer:${attemptId}:${questionId}:${ts}:${payload}`).digest("hex");
}

async function main() {
  const db = openDb();
  const cfg = getConfig();

  console.log("1) Sync down …");
  const n = await syncDown(db);
  console.log(`   pulled ${n} bundle(s)`);
  if (n === 0) throw new Error("No bundles to drill with. Release an exam to this hub first.");

  const bundle = db.getBundles()[0];
  // syncDown stores the DECRYPTED plaintext payload in bundles.payload, so parse directly.
  const parsed = JSON.parse(bundle.payload) as {
    examId: string;
    roster: Array<{ studentId: string; admissionNumber: string }>;
    questions: Array<{ id: string; mcqOptions: Array<{ id: string }> }>;
  };
  const student = parsed.roster[0];
  const firstQuestion = parsed.questions[0];

  console.log(`2) Simulate attempt by ${student.admissionNumber} on exam ${parsed.examId} …`);
  const hubAttemptId = `att-${randomBytes(4).toString("hex")}`;
  const ts = new Date().toISOString();
  const mcqSelectedOptionId = firstQuestion.mcqOptions[0]?.id ?? null;
  const answer = { questionId: firstQuestion.id, mcqSelectedOptionId, clientTimestamp: ts };
  db.insertAttempt({
    hubAttemptId,
    bundleId: bundle.bundleId,
    studentId: student.studentId,
    status: "submitted",
    startedAt: ts,
    submittedAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    shuffledQuestionIds: null,
    shuffledOptionOrder: null,
    lastAutosaveAt: null,
  });
  db.raw.prepare(
    "INSERT INTO answers (hub_attempt_id, question_id, mcq_selected_option_id, client_timestamp, local_checksum) VALUES (?, ?, ?, ?, ?)",
  ).run(hubAttemptId, answer.questionId, mcqSelectedOptionId, ts, checksum(cfg.signingSecret, hubAttemptId, answer.questionId, ts, mcqSelectedOptionId ?? ""));

  console.log("3) Sync up …");
  const { uploaded } = await syncUp(db);
  console.log(`   uploaded ${uploaded} attempt(s)`);

  console.log("Done. Check the cloud exam detail page for the synced attempt.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});