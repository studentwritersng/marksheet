# Offline Exam Sync — Phase 1: Hub v0 + Sync Plumbing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cloud-side hub registry, encrypted exam bundle builder, sync-down pull endpoint, and idempotent sync-up ingest with HMAC checksum verification — plus the `hub/` Node.js package skeleton (Express + SQLite) and an end-to-end drill script proving the whole pipeline with a fake exam.

**Architecture:** The cloud app (Next.js + Neon/Prisma) is the only source of truth. Staff register per-school hubs in the platform console. Releasing a published exam builds an encrypted bundle (answer keys stripped) with per-student PINs. Hubs poll `GET /api/hub/sync-down` to receive bundles and push attempts to `POST /api/hub/sync-up`; ingest is keyed on `(hubId, hubAttemptId)` for idempotency and each answer's HMAC checksum is verified. The hub package is a portable Express + better-sqlite3 service that stores bundles and (in later phases) serves the exam UI. This phase delivers the plumbing; the student exam UI, grading, and result publication are Phases 2–4.

**Tech Stack:** Next.js 16 server actions + API route handlers, Prisma/Postgres (Neon), Node `crypto` (AES-256-GCM, HMAC-SHA256), bcryptjs (hub API key), vitest (tests), Express + better-sqlite3 (hub package).

## Global Constraints

- Framework floors (copy verbatim from package.json): `next@16.2.10`, `@prisma/client@^6.19.3`, `react@19.2.4`, `bcryptjs@^3.0.3`, `typescript@^5`.
- Schema changes are applied with `npm run db:push` (repo convention; `prisma migrate dev` fails with P3006 on this setup) and mirrored by a hand-written migration SQL file under `prisma/migrations/<name>/migration.sql` for history.
- Windows PowerShell environment: no `&&`, no `grep`, no `ls -la`. Chain with `;` and `if ($?) { ... }`. Use `Select-String`, `Get-ChildItem`.
- Vitest is not installed yet — Task 1 adds it. No other test framework is present.
- All times in bundles and payloads are ISO-8601 UTC strings.
- The answer key (`McqOption.isCorrect`, `EssayGradingSpec.modelAnswer`/`rubricPoints`/`gradingPrompt`) must NEVER appear in an offline bundle. Tests enforce this.
- Naming: camelCase in TS; table names snake_case (`@@map`). Bundle format version prefix: `msb1.`.
- Students never see scores. This phase stores raw answers only; grading is a later phase.

---

## File Structure

**Cloud (Next.js app):**
- Create `src/lib/offline/crypto.ts` — AES-256-GCM encrypt/decrypt, HMAC checksum, bundle-key derivation. Pure, no Prisma.
- Create `src/lib/offline/bundle.ts` — `serializeBundle()`, `fetchExamDataForBundle()`, `releaseExamToHub()`, `parseBundlePayload()`.
- Create `src/lib/offline/ingest.ts` — `processSyncUp()` with a `IngestStore` interface (pure idempotency + checksum logic, DB adapter injected).
- Create `src/lib/offline/actions.ts` — `registerHubAction`, `revokeHubAction` (console server actions).
- Create `src/app/api/hub/sync-down/route.ts` — GET handler (thin).
- Create `src/app/api/hub/sync-up/route.ts` — POST handler (thin).
- Create `src/app/console/(main)/offline-hubs/page.tsx`, `offline-hubs-client.tsx`, and reuse `actions.ts` — hub management UI.
- Modify `src/app/console/(main)/theme-wrapper.tsx` — add nav item.
- Modify `src/app/(app)/exams/[id]/page.tsx` + create `src/app/(app)/exams/[id]/offline-sync-card.tsx` — release action + offline status card.
- Modify `prisma/schema.prisma` — new models + fields (below).
- Create `prisma/migrations/20260809_add_offline_sync/migration.sql` — history mirror of db:push.
- Create `vitest.config.ts`, add `test` script to `package.json`.
- Tests: `src/lib/offline/crypto.test.ts`, `src/lib/offline/bundle.test.ts`, `src/lib/offline/ingest.test.ts`.

**Hub package:**
- Create `hub/package.json`, `hub/tsconfig.json`, `hub/.gitignore`.
- Create `hub/src/config.ts` — loads `hub/config.json`.
- Create `hub/src/db.ts` — better-sqlite3 open + schema init.
- Create `hub/src/crypto.ts` — hub-side decrypt + key derivation (must match cloud).
- Create `hub/src/sync.ts` — `syncDown()`, `syncUp()`.
- Create `hub/src/index.ts` — Express bootstrap on port 3210.
- Create `hub/config.example.json` — documented config template.
- Create `hub/scripts/drill.ts` — end-to-end drill (fake exam attempt).

---

### Task 1: Add vitest test infrastructure

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.ts`
- Test: `src/lib/offline/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` runs vitest on `src/**/*.test.ts` and `hub/**/*.test.ts`.

- [ ] **Step 1: Install vitest**

Run: `npm i -D vitest@^3.2.0`
Expected: added to devDependencies, `node_modules/vitest` present.

- [ ] **Step 2: Add test script to package.json**

Edit `package.json` `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "hub/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 4: Write the failing smoke test**

`src/lib/offline/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("offline smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/offline/smoke.test.ts
git commit -m "test: add vitest infra for offline sync"
```

---

### Task 2: Prisma schema — Hub, OfflineBundle, ExamPin + sync fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260809_add_offline_sync/migration.sql`

**Interfaces:**
- Produces models used by Tasks 4–8: `Hub`, `OfflineBundle`, `ExamPin`; fields `Exam.offlineStatus`, `Exam.offlineBundles`, `ExamAttempt.hubId`, `ExamAttempt.hubAttemptId`, `ExamAttempt.hub`, `StudentAnswer.checksumFlagged`, `School.hubs`, `School.offlineBundles`.
- Consumes: existing `School`, `Exam`, `ExamAttempt`, `StudentAnswer` models.

- [ ] **Step 1: Add the enum and fields to schema.prisma**

Add a new enum before `model Hub`:
```prisma
enum HubStatus {
  active
  revoked
}
```

Add to `model School` (append to its relations list):
```prisma
  hubs            Hub[]
  offlineBundles  OfflineBundle[]
```

Add to `model Exam` (append to relations list):
```prisma
  offlineBundles OfflineBundle[]
  offlineStatus  String   @default("none") // none | released | synced
```

Add to `model ExamAttempt` (append fields + relation + index):
```prisma
  hubId          String?
  hubAttemptId   String?
  hub            Hub?       @relation(fields: [hubId], references: [id])
```
and a unique index for idempotency:
```prisma
  @@unique([hubId, hubAttemptId])
```

Add to `model StudentAnswer` (append field):
```prisma
  checksumFlagged Boolean   @default(false)
```

Append the three new models at the end of `schema.prisma`:
```prisma
model Hub {
  id                  String    @id @default(cuid())
  schoolId            String
  name                String
  apiKeyHash          String
  signingSecret       String
  invigilatorCodeHash String
  status              HubStatus @default(active)
  lastSeenAt          DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  school   School          @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  bundles  OfflineBundle[]
  attempts ExamAttempt[]

  @@index([schoolId])
  @@map("hubs")
}

model OfflineBundle {
  id        String   @id @default(cuid())
  bundleId  String   @unique
  examId    String
  hubId     String
  schoolId  String
  status    String   @default("pending") // pending | downloaded | closed
  payload   String   // encrypted msb1.<iv>.<tag>.<ct>
  issuedAt  DateTime @default(now())
  expiresAt DateTime
  createdAt DateTime @default(now())

  exam Exam           @relation(fields: [examId], references: [id])
  hub  Hub            @relation(fields: [hubId], references: [id])
  pins ExamPin[]

  @@index([hubId])
  @@index([examId])
  @@map("offline_bundles")
}

model ExamPin {
  id        String   @id @default(cuid())
  bundleId  String
  examId    String
  studentId String
  pinHash   String
  createdAt DateTime @default(now())

  bundle OfflineBundle @relation(fields: [bundleId], references: [id], onDelete: Cascade)

  @@unique([bundleId, studentId])
  @@index([examId])
  @@map("exam_pins")
}
```

- [ ] **Step 2: Apply to the database**

Run: `npm run db:generate; npm run db:push`
Expected: Prisma client regenerated, `hubs`, `offline_bundles`, `exam_pins` tables created, `exam_attempts.hubId`, `exam_attempts.hubAttemptId`, `exam_attempts` unique index, `student_answers.checksumFlagged`, `exams.offlineStatus` added.

- [ ] **Step 3: Write the history migration file**

Create `prisma/migrations/20260809_add_offline_sync/migration.sql`:
```sql
-- Offline exam sync (Phase 1)
CREATE TYPE "HubStatus" AS ENUM ('active', 'revoked');

CREATE TABLE "hubs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "apiKeyHash" TEXT NOT NULL,
  "signingSecret" TEXT NOT NULL,
  "invigilatorCodeHash" TEXT NOT NULL,
  "status" "HubStatus" NOT NULL DEFAULT 'active',
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offline_bundles" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payload" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_bundles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_pins" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_pins_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "exams" ADD COLUMN "offlineStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "exam_attempts" ADD COLUMN "hubId" TEXT, ADD COLUMN "hubAttemptId" TEXT;
ALTER TABLE "student_answers" ADD COLUMN "checksumFlagged" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "hubs" ADD CONSTRAINT "hubs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offline_bundles" ADD CONSTRAINT "offline_bundles_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offline_bundles" ADD CONSTRAINT "offline_bundles_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offline_bundles" ADD CONSTRAINT "offline_bundles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_pins" ADD CONSTRAINT "exam_pins_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "offline_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "offline_bundles_bundleId_key" ON "offline_bundles"("bundleId");
CREATE INDEX "offline_bundles_hubId_idx" ON "offline_bundles"("hubId");
CREATE INDEX "offline_bundles_examId_idx" ON "offline_bundles"("examId");
CREATE UNIQUE INDEX "exam_pins_bundleId_studentId_key" ON "exam_pins"("bundleId", "studentId");
CREATE INDEX "exam_pins_examId_idx" ON "exam_pins"("examId");
CREATE INDEX "hubs_schoolId_idx" ON "hubs"("schoolId");
CREATE UNIQUE INDEX "exam_attempts_hubId_hubAttemptId_key" ON "exam_attempts"("hubId", "hubAttemptId");
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT=0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260809_add_offline_sync/migration.sql
git commit -m "feat: add offline sync hub, bundle, and pin schema"
```

---

### Task 3: Crypto helpers (AES-256-GCM, HMAC checksum, key derivation)

**Files:**
- Create: `src/lib/offline/crypto.ts`
- Test: `src/lib/offline/crypto.test.ts`

**Interfaces:**
- Produces (used by Tasks 4, 6, 7, and mirrored in `hub/src/crypto.ts`):
  - `generateRandomBytes(n: number): string` — hex.
  - `deriveBundleKey(signingSecret: string, bundleId: string): string` — hex 32 bytes: `HMAC-SHA256(signingSecret, "bundle-key:" + bundleId)`.
  - `encryptBundle(plaintext: string, keyHex: string): string` — `msb1.<ivHex>.<tagHex>.<ctBase64url>`.
  - `decryptBundle(payload: string, keyHex: string): string`.
  - `answerChecksum(signingSecret: string, attemptId: string, questionId: string, clientTimestamp: string, answerPayload: string): string` — hex HMAC.
  - `verifyAnswerChecksum(signingSecret: string, attemptId: string, questionId: string, clientTimestamp: string, answerPayload: string, expected: string): boolean` — constant-time compare.

- [ ] **Step 1: Write the failing tests**

`src/lib/offline/crypto.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  encryptBundle,
  decryptBundle,
  deriveBundleKey,
  answerChecksum,
  verifyAnswerChecksum,
} from "./crypto";

describe("crypto", () => {
  const secret = "test-signing-secret";
  const key = deriveBundleKey(secret, "bundle-1");

  it("derives a stable 64-char hex key per bundle", () => {
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveBundleKey(secret, "bundle-1")).toBe(key);
    expect(deriveBundleKey(secret, "bundle-2")).not.toBe(key);
  });

  it("encrypts and decrypts round-trip", () => {
    const payload = JSON.stringify({ hello: "world", n: 42 });
    const enc = encryptBundle(payload, key);
    expect(enc.startsWith("msb1.")).toBe(true);
    expect(enc).not.toContain("world");
    expect(decryptBundle(enc, key)).toBe(payload);
  });

  it("fails to decrypt with a different key", () => {
    const enc = encryptBundle("secret", key);
    expect(() => decryptBundle(enc, deriveBundleKey(secret, "bundle-9"))).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptBundle("secret", key);
    const parts = enc.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptBundle(parts.join("."), key)).toThrow();
  });

  it("computes and verifies answer checksums", () => {
    const c = answerChecksum(secret, "att-1", "q-1", "2026-08-09T10:00:00Z", "opt-5");
    expect(verifyAnswerChecksum(secret, "att-1", "q-1", "2026-08-09T10:00:00Z", "opt-5", c)).toBe(true);
    expect(verifyAnswerChecksum(secret, "att-1", "q-1", "2026-08-09T10:00:00Z", "opt-6", c)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/offline/crypto.test.ts`
Expected: FAIL — module `./crypto` not found.

- [ ] **Step 3: Write the implementation**

`src/lib/offline/crypto.ts`:
```ts
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRandomBytes(n = 32): string {
  return randomBytes(n).toString("hex");
}

export function deriveBundleKey(signingSecret: string, bundleId: string): string {
  return createHmac("sha256", signingSecret).update(`bundle-key:${bundleId}`).digest("hex");
}

const PREFIX = "msb1.";

export function encryptBundle(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("Bundle key must be 32 bytes hex.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}.${tag.toString("hex")}.${ct.toString("base64url")}`;
}

export function decryptBundle(payload: string, keyHex: string): string {
  if (!payload.startsWith(PREFIX)) throw new Error("Invalid bundle payload.");
  const [, ivHex, tagHex, ctB64] = payload.split(".");
  if (!ivHex || !tagHex || !ctB64) throw new Error("Invalid bundle payload.");
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const ct = Buffer.from(ctB64, "base64url");
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function answerChecksum(
  signingSecret: string,
  attemptId: string,
  questionId: string,
  clientTimestamp: string,
  answerPayload: string,
): string {
  return createHmac("sha256", signingSecret)
    .update(`answer:${attemptId}:${questionId}:${clientTimestamp}:${answerPayload}`)
    .digest("hex");
}

export function verifyAnswerChecksum(
  signingSecret: string,
  attemptId: string,
  questionId: string,
  clientTimestamp: string,
  answerPayload: string,
  expected: string,
): boolean {
  const actual = Buffer.from(
    answerChecksum(signingSecret, attemptId, questionId, clientTimestamp, answerPayload),
    "hex",
  );
  const exp = Buffer.from(expected ?? "", "hex");
  if (actual.length !== exp.length) return false;
  return timingSafeEqual(actual, exp);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/crypto.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/crypto.ts src/lib/offline/crypto.test.ts
git commit -m "feat: offline bundle crypto, HMAC checksum, and key derivation"
```

---

### Task 4: Bundle serializer + PIN generation

**Files:**
- Create: `src/lib/offline/bundle.ts`
- Test: `src/lib/offline/bundle.test.ts`

**Interfaces:**
- Produces:
  - `interface OfflineQuestionVM` — id, text, type, marks, classLevel, topic, questionGroupId, groupInternallyShufflable, stimulus {id,type,content} | null, mcqOptions {id, optionText}[] (NO `isCorrect`).
  - `interface OfflineRosterEntry` — studentId, admissionNumber, firstName, lastName, pin.
  - `interface OfflineBundleV1` — schemaVersion:1, bundleId, examId, schoolId, issuedAt, expiresAt, durationMinutes, shuffleEnabled, exam {subjectName, classNames[], termLabel}, questions[], roster[].
  - `serializeBundle(data: unknown, manifest: {...}): string` — validates shape, encrypts, returns `msb1.` string.
  - `generatePin(): string` — 6-digit string with leading zeros allowed.
  - `hashPin(pin: string): string` — HMAC-SHA256 with a server secret from `process.env.PIN_HMAC_SECRET` (falls back to a dev constant), hex.
  - `parseBundlePayload(payload: string, keyHex: string): OfflineBundleV1` — decrypt + shape assert.
- Consumes: `deriveBundleKey`, `encryptBundle`, `decryptBundle` from Task 3.

- [ ] **Step 1: Write the failing tests**

`src/lib/offline/bundle.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { serializeBundle, generatePin, hashPin, parseBundlePayload, type OfflineBundleV1 } from "./bundle";
import { deriveBundleKey } from "./crypto";

function makeData(): OfflineBundleV1 {
  return {
    schemaVersion: 1,
    bundleId: "bundle-1",
    examId: "exam-1",
    schoolId: "school-1",
    issuedAt: "2026-08-09T08:00:00Z",
    expiresAt: "2026-08-20T08:00:00Z",
    durationMinutes: 60,
    shuffleEnabled: true,
    exam: { subjectName: "Maths", classNames: ["SS1A"], termLabel: "Term 1 (2026/2027)" },
    questions: [
      {
        id: "q-1",
        text: "What is 2+2?",
        type: "mcq",
        marks: 2,
        classLevel: "SS1",
        topic: "Arithmetic",
        questionGroupId: null,
        groupInternallyShufflable: null,
        stimulus: null,
        mcqOptions: [
          { id: "opt-1", optionText: "3" },
          { id: "opt-2", optionText: "4" },
        ],
      },
    ],
    roster: [
      { studentId: "stu-1", admissionNumber: "ADM/001", firstName: "Ada", lastName: "Obi", pin: "123456" },
    ],
  };
}

describe("bundle serializer", () => {
  const key = deriveBundleKey("secret", "bundle-1");

  it("serializes and round-trips through parse", () => {
    const enc = serializeBundle(makeData(), "secret", "bundle-1");
    const parsed = parseBundlePayload(enc, key);
    expect(parsed.examId).toBe("exam-1");
    expect(parsed.questions.length).toBe(1);
    expect(parsed.roster[0].pin).toBe("123456");
  });

  it("rejects payloads that would leak the answer key", () => {
    const leaked = makeData() as unknown as OfflineBundleV1;
    (leaked.questions[0] as unknown as { mcqOptions: { isCorrect?: boolean }[] }).mcqOptions[0].isCorrect = true;
    expect(() => serializeBundle(leaked, "secret", "bundle-1")).toThrow(/isCorrect/);
  });

  it("generates 6-digit pins", () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it("hashes pins non-reversibly and deterministically", () => {
    expect(hashPin("123456")).toBe(hashPin("123456"));
    expect(hashPin("123456")).not.toBe(hashPin("654321"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/offline/bundle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/offline/bundle.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/bundle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/bundle.ts src/lib/offline/bundle.test.ts
git commit -m "feat: offline bundle serializer with answer-key leak guard and pins"
```

---

### Task 5: Bundle builder (Prisma fetch) + release action

**Files:**
- Modify: `src/lib/offline/bundle.ts`
- Create: `src/lib/offline/actions.ts`

**Interfaces:**
- Produces:
  - `fetchExamDataForBundle(examId: string, schoolId: string): Promise<{ exam: {...}; questions: OfflineQuestionVM[]; roster: { studentId; admissionNumber; firstName; lastName }[] }>` — throws if exam missing / not in this school / not published / has no questions.
  - `releaseExamToHub(examId: string, hubId: string): Promise<{ bundleId: string; hubName: string; examTitle: string; studentCount: number; questionCount: number }>` — builds bundle, stores `OfflineBundle` + `ExamPin` rows, sets `Exam.offlineStatus = "released"`.
  - Server actions `registerHubAction(prev, formData)` and `revokeHubAction(prev, formData)` — console hub management; `registerHubAction` returns plaintext `apiKey`, `signingSecret`, `invigilatorCode` exactly once.
- Consumes: Task 2 models, Task 3 crypto, Task 4 `serializeBundle`/`generatePin`/`hashPin`, `getCurrentUser`.

- [ ] **Step 1: Add the Prisma-backed builder to bundle.ts**

Append to `src/lib/offline/bundle.ts` (add `prisma` to the existing imports at the top of the file — do NOT import from `./bundle` inside bundle.ts):
```ts
import { prisma } from "@/lib/prisma";

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
```
Note: `mcqOptions` in the builder must select `isCorrect` ONLY inside the fetch (so the guard test can assert it's stripped by `serializeBundle`); the mapping deliberately drops it.

- [ ] **Step 2: Write the failing test for fetch+build via a mocked prisma**

`src/lib/offline/bundle-build.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { fetchExamDataForBundle, serializeBundle, type OfflineBundleV1 } from "./bundle";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const baseExam = {
  id: "exam-1",
  schoolId: "school-1",
  status: "published",
  durationMinutes: 60,
  shuffleEnabled: true,
  subject: { name: "Maths" },
  term: { name: "Term 1", session: { label: "2026/2027" } },
  classes: [{ class: { id: "cls-1", name: "SS1A" } }],
  examQuestions: [
    {
      question: {
        id: "q-1",
        text: "2+2?",
        type: "mcq",
        marks: 2,
        classLevel: "SS1",
        topic: null,
        questionGroupId: null,
        mcqOptions: [{ id: "opt-1", optionText: "3", isCorrect: false }, { id: "opt-2", optionText: "4", isCorrect: true }],
        group: null,
      },
    },
  ],
};

beforeEach(() => {
  (prisma.exam.findFirst as any) = vi.fn().mockResolvedValue(baseExam);
  (prisma.student.findMany as any) = vi.fn().mockResolvedValue([
    { id: "stu-1", admissionNumber: "ADM/001", firstName: "Ada", lastName: "Obi" },
  ]);
});

describe("fetchExamDataForBundle", () => {
  it("strips answer keys and produces serializable data", async () => {
    const data = await fetchExamDataForBundle("exam-1", "school-1");
    expect(data.questions[0].mcqOptions[0]).not.toHaveProperty("isCorrect");
    expect(data.questions[0].mcqOptions[1]).not.toHaveProperty("isCorrect");
    const bundle: OfflineBundleV1 = {
      schemaVersion: 1,
      bundleId: "bundle-1",
      examId: "exam-1",
      schoolId: "school-1",
      issuedAt: "2026-08-09T08:00:00Z",
      expiresAt: "2026-08-20T08:00:00Z",
      durationMinutes: data.exam.durationMinutes,
      shuffleEnabled: data.exam.shuffleEnabled,
      exam: { subjectName: data.exam.subjectName, classNames: data.exam.classNames, termLabel: data.exam.termLabel },
      questions: data.questions,
      roster: data.students.map((s) => ({ ...s, pin: "123456" })),
    };
    const enc = serializeBundle(bundle, "secret", "bundle-1");
    expect(enc.startsWith("msb1.")).toBe(true);
    expect(enc).not.toContain("opt-2"); // ciphertext, no option ids visible
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/bundle-build.test.ts`
Expected: PASS.

- [ ] **Step 4: Add release + hub actions**

Create `src/lib/offline/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { generateRandomBytes } from "./crypto";
import { fetchExamDataForBundle, serializeBundle, generatePin, hashPin, type OfflineBundleV1 } from "./bundle";

export interface OfflineActionResult {
  error?: string;
  success?: string;
  data?: {
    apiKey?: string;
    signingSecret?: string;
    invigilatorCode?: string;
  };
}

export async function registerHubAction(
  _prev: OfflineActionResult,
  formData: FormData,
): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") return { error: "Not authorised." };

  const schoolId = (formData.get("schoolId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!schoolId || !name) return { error: "School and hub name are required." };

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return { error: "School not found." };

  const apiKey = `mk_hub_${generateRandomBytes(24)}`;
  const signingSecret = generateRandomBytes(32);
  const invigilatorCode = Math.floor(100000 + Math.random() * 900000).toString();
  const bcrypt = (await import("bcryptjs")).default;

  const hub = await prisma.hub.create({
    data: {
      schoolId,
      name,
      apiKeyHash: await bcrypt.hash(apiKey, 10),
      signingSecret,
      invigilatorCodeHash: await bcrypt.hash(invigilatorCode, 10),
    },
  });

  revalidatePath("/console/offline-hubs");
  return {
    success: `Hub "${name}" registered.`,
    data: { apiKey, signingSecret, invigilatorCode },
  };
}

export async function revokeHubAction(
  _prev: OfflineActionResult,
  formData: FormData,
): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") return { error: "Not authorised." };

  const hubId = (formData.get("hubId") as string)?.trim();
  if (!hubId) return { error: "Hub id is required." };

  await prisma.hub.update({ where: { id: hubId }, data: { status: "revoked" } });
  revalidatePath("/console/offline-hubs");
  return { success: "Hub revoked." };
}

export async function releaseExamToHub(examId: string, hubId: string): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId, status: "active" } });
  if (!hub) return { error: "Active hub not found for this school." };

  const examData = await fetchExamDataForBundle(examId, user.schoolId);
  const bundleId = `b-${generateRandomBytes(8)}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const roster = examData.students.map((s) => ({ ...s, pin: generatePin() }));

  const bundle: OfflineBundleV1 = {
    schemaVersion: 1,
    bundleId,
    examId,
    schoolId: examData.exam.schoolId,
    issuedAt,
    expiresAt,
    durationMinutes: examData.exam.durationMinutes,
    shuffleEnabled: examData.exam.shuffleEnabled,
    exam: {
      subjectName: examData.exam.subjectName,
      classNames: examData.exam.classNames,
      termLabel: examData.exam.termLabel,
    },
    questions: examData.questions,
    roster,
  };

  const payload = serializeBundle(bundle, hub.signingSecret, bundleId);

  const created = await prisma.$transaction(async (tx) => {
    const offline = await tx.offlineBundle.create({
      data: {
        bundleId,
        examId,
        hubId: hub.id,
        schoolId: hub.schoolId,
        payload,
        issuedAt: new Date(issuedAt),
        expiresAt: new Date(expiresAt),
      },
    });
    await tx.examPin.createMany({
      data: roster.map((r) => ({
        bundleId: offline.id, // FK to offline_bundles.id
        examId,
        studentId: r.studentId,
        pinHash: hashPin(r.pin),
      })),
      skipDuplicates: true,
    });
    await tx.exam.update({ where: { id: examId }, data: { offlineStatus: "released" } });
    return offline;
  });

  revalidatePath(`/exams/${examId}`);
  return {
    success: `Exam released to hub "${hub.name}".`,
    data: { examTitle: `${examData.exam.subjectName}`, studentCount: roster.length, questionCount: examData.questions.length },
  };
}
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT=0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/offline/bundle.ts src/lib/offline/actions.ts src/lib/offline/bundle-build.test.ts
git commit -m "feat: exam bundle builder and hub registration actions"
```

---

### Task 6: Hub authentication + sync-down API route

**Files:**
- Create: `src/lib/offline/hub-auth.ts`
- Create: `src/app/api/hub/sync-down/route.ts`

**Interfaces:**
- Produces:
  - `authenticateHub(request: Request): Promise<{ hub: { id; schoolId; signingSecret; name } } | null>` — reads `Authorization: Bearer <apiKey>`, compares bcrypt against `apiKeyHash`, updates `lastSeenAt`, rejects revoked hubs.
  - `GET /api/hub/sync-down` — returns `{ bundles: Array<{ bundleId; examId; status; issuedAt; expiresAt; payload; keyHex }> }` for the authenticated hub with `status = "pending"`, then marks them `downloaded`.
- Consumes: Task 2 models, Task 3 `deriveBundleKey`.

- [ ] **Step 1: Write the failing tests (auth helper with mocked prisma)**

`src/lib/offline/hub-auth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateHub } from "./hub-auth";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { prisma } = await import("@/lib/prisma");
const bcrypt = (await import("bcryptjs")).default;

const fakeHash = await bcrypt.hash("mk_hub_testkey", 4);

beforeEach(() => {
  (prisma.hub.findMany as any) = vi.fn().mockResolvedValue([
    { id: "hub-1", schoolId: "school-1", name: "Hall 1", signingSecret: "sec", apiKeyHash: fakeHash, status: "active" },
  ]);
  (prisma.hub.update as any) = vi.fn().mockResolvedValue({});
});

describe("authenticateHub", () => {
  it("accepts a valid API key", async () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer mk_hub_testkey" } });
    const res = await authenticateHub(req);
    expect(res?.hub.id).toBe("hub-1");
  });

  it("rejects a wrong key", async () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer mk_hub_wrong" } });
    expect(await authenticateHub(req)).toBeNull();
  });

  it("rejects missing header", async () => {
    expect(await authenticateHub(new Request("http://x"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/offline/hub-auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write hub-auth.ts**

```ts
import { prisma } from "@/lib/prisma";

export async function authenticateHub(
  request: Request,
): Promise<{ hub: { id: string; schoolId: string; name: string; signingSecret: string } } | null> {
  const header = request.headers.get("authorization") ?? "";
  const apiKey = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!apiKey) return null;

  // Match by trying bcrypt against all active hubs is O(n); instead match by hash scan:
  const hubs = await prisma.hub.findMany({ where: { status: "active" }, select: { id: true, schoolId: true, name: true, signingSecret: true, apiKeyHash: true } });
  const bcrypt = (await import("bcryptjs")).default;
  for (const h of hubs) {
    const ok = await bcrypt.compare(apiKey, h.apiKeyHash);
    if (ok) {
      await prisma.hub.update({ where: { id: h.id }, data: { lastSeenAt: new Date() } });
      return { hub: { id: h.id, schoolId: h.schoolId, name: h.name, signingSecret: h.signingSecret } };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/hub-auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the sync-down route**

`src/app/api/hub/sync-down/route.ts`:
```ts
import { NextResponse } from "next/server";
import { authenticateHub } from "@/lib/offline/hub-auth";
import { deriveBundleKey } from "@/lib/offline/crypto";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await authenticateHub(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bundles = await prisma.offlineBundle.findMany({
    where: { hubId: auth.hub.id, status: "pending" },
    orderBy: { issuedAt: "asc" },
  });

  const now = new Date();
  const active = bundles.filter((b) => b.expiresAt > now);

  for (const b of active) {
    await prisma.offlineBundle.update({ where: { id: b.id }, data: { status: "downloaded" } });
  }

  return NextResponse.json({
    bundles: active.map((b) => ({
      bundleId: b.bundleId,
      examId: b.examId,
      status: "downloaded",
      issuedAt: b.issuedAt.toISOString(),
      expiresAt: b.expiresAt.toISOString(),
      payload: b.payload,
      keyHex: deriveBundleKey(auth.hub.signingSecret, b.bundleId),
    })),
  });
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT=0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/offline/hub-auth.ts src/lib/offline/hub-auth.test.ts src/app/api/hub/sync-down/route.ts
git commit -m "feat: hub auth and sync-down endpoint"
```

---

### Task 7: Sync-up ingest (idempotency + checksum verification)

**Files:**
- Create: `src/lib/offline/ingest.ts`
- Test: `src/lib/offline/ingest.test.ts`

**Interfaces:**
- Produces:
  - `interface SyncUpPayload` — `{ bundleId, attempts: Array<{ hubAttemptId, studentId, examId, startedAt, submittedAt, status, shuffledQuestionIds: string[] | null, shuffledOptionOrder: Record<string,string[]> | null, answers: Array<{ questionId, mcqSelectedOptionId?: string, essayResponseText?: string, clientTimestamp: string, localChecksum: string }> }> }`.
  - `interface IngestStore` — `{ findAttempt(key: { hubId; hubAttemptId }): Promise<boolean>; createAttempt(...): Promise<string>; createAnswers(...): Promise<void>; }` — `createAttempt` returns the created `ExamAttempt.id`.
  - `processSyncUp(payload, hub: { id; signingSecret }, store: IngestStore): Promise<Array<{ hubAttemptId; status: "accepted" | "duplicate" | "flagged" }>>` — pure; idempotent via `findAttempt`; each answer checksum-verified, mismatch → `checksumFlagged`.
- Consumes: Task 3 `verifyAnswerChecksum`, Task 2 schema via the store adapter.

- [ ] **Step 1: Write the failing tests**

`src/lib/offline/ingest.test.ts`:
```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/offline/ingest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/offline/ingest.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/ingest.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/ingest.ts src/lib/offline/ingest.test.ts
git commit -m "feat: idempotent sync-up ingest with checksum flagging"
```

---

### Task 8: Sync-up API route (Prisma adapter)

**Files:**
- Create: `src/app/api/hub/sync-up/route.ts`

**Interfaces:**
- Produces: `POST /api/hub/sync-up` — authenticates hub, wraps `processSyncUp` with a Prisma `IngestStore`, returns per-attempt statuses.
- Consumes: Task 6 `authenticateHub`, Task 7 `processSyncUp`/types, Task 2 models.

- [ ] **Step 1: Write the route**

`src/app/api/hub/sync-up/route.ts`:
```ts
import { NextResponse } from "next/server";
import { authenticateHub } from "@/lib/offline/hub-auth";
import { processSyncUp, type SyncUpPayload, type AttemptKey, type AttemptRecord, type AnswerRecord, type IngestStore } from "@/lib/offline/ingest";
import { prisma } from "@/lib/prisma";

const store: IngestStore = {
  async findAttempt(key: AttemptKey) {
    const found = await prisma.examAttempt.findUnique({
      where: { hubId_hubAttemptId: { hubId: key.hubId, hubAttemptId: key.hubAttemptId } },
      select: { id: true },
    });
    return found !== null;
  },
  async createAttempt(record: AttemptRecord) {
    const created = await prisma.examAttempt.create({
      data: {
        hubId: record.hubId,
        hubAttemptId: record.hubAttemptId,
        studentId: record.studentId,
        examId: record.examId,
        startedAt: new Date(record.startedAt),
        submittedAt: record.submittedAt ? new Date(record.submittedAt) : null,
        status: record.status as "in_progress" | "submitted" | "absent",
        shuffledQuestionIds: record.shuffledQuestionIds,
        shuffledOptionOrder: record.shuffledOptionOrder,
        syncStatus: "synced",
      },
    });
    return created.id;
  },
  async createAnswers(records: AnswerRecord[]) {
    await prisma.studentAnswer.createMany({ data: records });
  },
};

export async function POST(request: Request) {
  const auth = await authenticateHub(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: SyncUpPayload;
  try {
    payload = (await request.json()) as SyncUpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload || !payload.bundleId || !Array.isArray(payload.attempts)) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const results = await processSyncUp(payload, { id: auth.hub.id, signingSecret: auth.hub.signingSecret }, store);
  return NextResponse.json({ results });
}
```
Note: the composite unique index name `hubId_hubAttemptId` matches Prisma's default for `@@unique([hubId, hubAttemptId])`.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT=0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/hub/sync-up/route.ts
git commit -m "feat: sync-up ingest route with prisma adapter"
```

---

### Task 9: Console hub management UI

**Files:**
- Create: `src/app/console/(main)/offline-hubs/page.tsx`
- Create: `src/app/console/(main)/offline-hubs/offline-hubs-client.tsx`
- Modify: `src/app/console/(main)/theme-wrapper.tsx` (nav item)

**Interfaces:**
- Consumes: Task 5 `registerHubAction`, `revokeHubAction`, Task 2 models.

- [ ] **Step 1: Add nav item to theme-wrapper.tsx**

Edit the `navItems` array in `src/app/console/(main)/theme-wrapper.tsx`:
```tsx
  { label: "Offline Hubs", href: "/console/offline-hubs", icon: "router" },
```

- [ ] **Step 2: Create the server page**

`src/app/console/(main)/offline-hubs/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { OfflineHubsClient } from "./offline-hubs-client";

export default async function OfflineHubsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [hubs, schools] = await Promise.all([
    prisma.hub.findMany({
      orderBy: { createdAt: "desc" },
      include: { school: { select: { name: true } } },
    }),
    prisma.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <OfflineHubsClient
      hubs={hubs.map((h) => ({
        id: h.id,
        name: h.name,
        schoolName: h.school.name,
        status: h.status,
        lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
      schools={schools.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
```

- [ ] **Step 3: Create the client component**

`src/app/console/(main)/offline-hubs/offline-hubs-client.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registerHubAction, revokeHubAction, type OfflineActionResult } from "@/lib/offline/actions";

const init: OfflineActionResult = {};

type HubRow = { id: string; name: string; schoolName: string; status: string; lastSeenAt: string | null; createdAt: string };
type SchoolRow = { id: string; name: string };

export function OfflineHubsClient({ hubs, schools }: { hubs: HubRow[]; schools: SchoolRow[] }) {
  const [state, action, pending] = useActionState(registerHubAction, init);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeHubAction, init);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Offline Hubs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Register a school&apos;s exam-hall hub. The API key and signing secret are shown once —
          copy them into the hub&apos;s config.
        </p>
      </div>

      <form action={action} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="schoolId" required className="rounded-lg border border-gray-300 p-2 text-sm">
            <option value="">Select school…</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input name="name" required placeholder="e.g. Exam Hall 1" className="rounded-lg border border-gray-300 p-2 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm px-4 py-2 disabled:opacity-60">
          {pending ? "Registering…" : "Register hub"}
        </button>
        {state.error && <p className="text-red-600 text-xs">{state.error}</p>}
        {state.success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-1">
            <p className="text-emerald-700 font-medium">{state.success}</p>
            {state.data?.apiKey && !revealed && (
              <button type="button" onClick={() => setRevealed(true)} className="text-blue-700 underline text-xs">
                Reveal credentials (shown once)
              </button>
            )}
            {revealed && (
              <div className="text-xs font-mono text-gray-800 space-y-1">
                <p>API key: {state.data?.apiKey}</p>
                <p>Signing secret: {state.data?.signingSecret}</p>
                <p>Invigilator code: {state.data?.invigilatorCode}</p>
              </div>
            )}
          </div>
        )}
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">School</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last seen</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hubs.map((h) => (
              <tr key={h.id}>
                <td className="p-3 font-medium">{h.name}</td>
                <td className="p-3 text-gray-600">{h.schoolName}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {h.status}
                  </span>
                </td>
                <td className="p-3 text-gray-500">{h.lastSeenAt ? new Date(h.lastSeenAt).toLocaleString() : "never"}</td>
                <td className="p-3 text-right">
                  {h.status === "active" && (
                    <form action={revokeAction}>
                      <input type="hidden" name="hubId" value={h.id} />
                      <button type="submit" disabled={revokePending} className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50">
                        Revoke
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {hubs.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">No hubs registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT=0.

- [ ] **Step 5: Commit**

```bash
git add src/app/console/"(main)"/offline-hubs/page.tsx src/app/console/"(main)"/offline-hubs/offline-hubs-client.tsx src/app/console/"(main)"/theme-wrapper.tsx
git commit -m "feat: console hub management page"
```

---

### Task 10: Exam page "Offline sync" card + release trigger

**Files:**
- Create: `src/app/(app)/exams/[id]/offline-sync-card.tsx`
- Modify: `src/app/(app)/exams/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 5 `releaseExamToHub`, Task 2 models.

- [ ] **Step 1: Create the offline sync card client component**

`src/app/(app)/exams/[id]/offline-sync-card.tsx`:
```tsx
"use client";

import { useState } from "react";
import { releaseExamToHub, type OfflineActionResult } from "@/lib/offline/actions";

type HubRow = { id: string; name: string; status: string };

export function OfflineSyncCard({ examId, hubs, offlineStatus }: {
  examId: string;
  hubs: HubRow[];
  offlineStatus: string;
}) {
  const [hubId, setHubId] = useState("");
  const [state, setState] = useState<OfflineActionResult>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!hubId) return;
    setPending(true);
    const res = await releaseExamToHub(examId, hubId);
    setState(res);
    setPending(false);
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <h2 className="font-label-lg text-label-lg text-on-surface font-semibold mb-1">Offline sync</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Status: <span className="font-medium text-on-surface">{offlineStatus}</span>
      </p>
      {offlineStatus === "none" && hubs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface"
          >
            <option value="">Select hub…</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={pending || !hubId}
            className="rounded-lg bg-[#002046] hover:bg-[#003366] text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {pending ? "Releasing…" : "Release to hub"}
          </button>
        </div>
      )}
      {offlineStatus === "none" && hubs.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No active hubs for this school. Contact the platform team.
        </p>
      )}
      {state.error && <p className="mt-2 text-red-600 text-xs">{state.error}</p>}
      {state.success && <p className="mt-2 text-emerald-600 text-xs">{state.success}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the exam detail page**

In `src/app/(app)/exams/[id]/page.tsx`:
- Import the card.
- After the `examQuestionsFull` query block, fetch active hubs for the school:
```tsx
  const hubs = await prisma.hub.findMany({
    where: { schoolId: user.schoolId, status: "active" },
    select: { id: true, name: true },
  });
```
- Render the card inside the returned `<div className="space-y-6">`, after the "Component summary" block:
```tsx
      <OfflineSyncCard
        examId={exam.id}
        hubs={hubs.map((h) => ({ id: h.id, name: h.name, status: "active" }))}
        offlineStatus={exam.offlineStatus}
      />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT=0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/exams/[id]/offline-sync-card.tsx" "src/app/(app)/exams/[id]/page.tsx"
git commit -m "feat: release exam to hub from exam detail page"
```

---

### Task 11: Hub package skeleton (Express + SQLite + config)

**Files:**
- Create: `hub/package.json`, `hub/tsconfig.json`, `hub/.gitignore`, `hub/config.example.json`
- Create: `hub/src/config.ts`, `hub/src/db.ts`, `hub/src/index.ts`

**Interfaces:**
- Produces: `hub start` command runs an Express server on port 3210 with `/health` and `/admin/status` stubs; SQLite schema `bundles`, `attempts`, `answers`, `sync_state` tables created on open.
- Produces for Task 12: `openDb(): Database`, `getConfig(): HubConfig`, `decryptStoredBundle(bundleId: string): OfflineBundleV1 | null`.

- [ ] **Step 1: Create hub package files**

`hub/package.json`:
```json
{
  "name": "marksheet-hub",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "drill": "tsx scripts/drill.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^5.0.0",
    "tsx": "^4.23.0",
    "typescript": "^5"
  }
}
```

`hub/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "scripts"]
}
```

`hub/.gitignore`:
```
node_modules/
config.json
data/
```

`hub/config.example.json`:
```json
{
  "cloudBaseUrl": "https://marksheet.sch.ng",
  "apiKey": "mk_hub_...",
  "signingSecret": "...",
  "port": 3210,
  "dataDir": "./data",
  "syncIntervalMs": 60000
}
```

`hub/src/config.ts`:
```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface HubConfig {
  cloudBaseUrl: string;
  apiKey: string;
  signingSecret: string;
  port: number;
  dataDir: string;
  syncIntervalMs: number;
}

export function getConfig(configPath = resolve(import.meta.dirname, "../config.json")): HubConfig {
  const raw = readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw) as Partial<HubConfig>;
  if (!cfg.cloudBaseUrl || !cfg.apiKey || !cfg.signingSecret) {
    throw new Error("hub/config.json must define cloudBaseUrl, apiKey, and signingSecret.");
  }
  return {
    cloudBaseUrl: cfg.cloudBaseUrl.replace(/\/+$/, ""),
    apiKey: cfg.apiKey,
    signingSecret: cfg.signingSecret,
    port: cfg.port ?? 3210,
    dataDir: cfg.dataDir ?? "./data",
    syncIntervalMs: cfg.syncIntervalMs ?? 60000,
  };
}
```

`hub/src/db.ts`:
```ts
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
  const getLocalOnly = raw.prepare("SELECT hub_attempt_id FROM attempts WHERE synced = 0");
  const markSynced = raw.prepare("UPDATE attempts SET synced = 1 WHERE hub_attempt_id = ?");

  return {
    raw,
    insertBundle: (bundleId, payload, examId, expiresAt) => insertBundle.run(bundleId, examId, payload, expiresAt),
    getBundle: (bundleId) => getBundle.get(bundleId) as { bundleId: string; payload: string } | undefined,
    getBundles: () => getBundles.all() as { bundleId: string; examId: string; payload: string }[],
    insertAttempt: (attempt) => insertAttempt.run(attempt),
    getLocalOnlyAttempts: () => getLocalOnly.all() as { hubAttemptId: string }[],
    markAttemptSynced: (hubAttemptId) => markSynced.run(hubAttemptId),
  };
}
```

`hub/src/index.ts`:
```ts
import express from "express";
import { getConfig } from "./config";
import { openDb } from "./db";

const cfg = getConfig();
const db = openDb();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "marksheet-hub", db: db.raw.prepare("SELECT COUNT(*) AS n FROM bundles").get().n });
});

app.get("/admin/status", (_req, res) => {
  const bundles = db.getBundles().length;
  const pending = db.getLocalOnlyAttempts().length;
  res.json({ bundles, pendingSyncAttempts: pending });
});

app.listen(cfg.port, () => {
  console.log(`Marksheet hub listening on http://0.0.0.0:${cfg.port}`);
});
```

- [ ] **Step 2: Install hub dependencies**

Run: `cd hub; npm install`
Expected: `node_modules` created.

- [ ] **Step 3: Verify the hub boots**

Run: `npm run start` (in `hub/`), then from another shell:
Run: `Invoke-RestMethod http://localhost:3210/health`
Expected: `{ ok = True }`. Stop the hub (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add hub/package.json hub/package-lock.json hub/tsconfig.json hub/.gitignore hub/config.example.json hub/src/config.ts hub/src/db.ts hub/src/index.ts
git commit -m "feat: hub package skeleton (express + sqlite)"
```

---

### Task 12: Hub sync engine + drill script

**Files:**
- Create: `hub/src/crypto.ts`
- Create: `hub/src/sync.ts`
- Create: `hub/scripts/drill.ts`

**Interfaces:**
- Produces: `syncDown(db)` and `syncUp(db)` functions; `hub/scripts/drill.ts` proves the full pipeline against a running cloud dev server.

- [ ] **Step 1: Hub-side crypto mirror**

`hub/src/crypto.ts`:
```ts
import { createDecipheriv, createHmac } from "node:crypto";

export function deriveBundleKey(signingSecret: string, bundleId: string): string {
  return createHmac("sha256", signingSecret).update(`bundle-key:${bundleId}`).digest("hex");
}

export function decryptBundle(payload: string, keyHex: string): string {
  const PREFIX = "msb1.";
  if (!payload.startsWith(PREFIX)) throw new Error("Invalid bundle payload.");
  const [, ivHex, tagHex, ctB64] = payload.split(".");
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 2: Sync engine**

`hub/src/sync.ts`:
```ts
import { getConfig } from "./config";
import { openDb, type Db } from "./db";
import { deriveBundleKey, decryptBundle } from "./crypto";

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

  const attempts = pending.map((a) => {
    const row = db.raw.prepare("SELECT * FROM attempts WHERE hub_attempt_id = ?").get(a.hubAttemptId) as Record<string, unknown>;
    const answers = db.raw.prepare("SELECT * FROM answers WHERE hub_attempt_id = ?").all(a.hubAttemptId) as Array<Record<string, unknown>>;
    const bundle = db.raw.prepare("SELECT bundle_id FROM attempts WHERE hub_attempt_id = ?").get(a.hubAttemptId) as { bundle_id: string };
    return {
      hubAttemptId: a.hubAttemptId,
      studentId: row.student_id,
      examId: (db.raw.prepare("SELECT exam_id FROM bundles WHERE bundle_id = ?").get(bundle.bundle_id) as { exam_id: string }).exam_id,
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
    body: JSON.stringify({ bundleId: "", attempts }),
  });
  if (!res.ok) throw new Error(`sync-up failed: ${res.status}`);
  const body = (await res.json()) as { results: Array<{ hubAttemptId: string; status: string }> };

  for (const r of body.results) {
    if (r.status !== "duplicate") db.markAttemptSynced(r.hubAttemptId);
  }
  return { uploaded: attempts.length };
}
```

- [ ] **Step 3: Drill script (fake exam, full pipeline)**

`hub/scripts/drill.ts`:
```ts
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
  const parsed = JSON.parse(bundle.payload) as { examId: string; roster: Array<{ studentId: string; admissionNumber: string }> };
  const student = parsed.roster[0];

  console.log(`2) Simulate attempt by ${student.admissionNumber} on exam ${parsed.examId} …`);
  const hubAttemptId = `att-${randomBytes(4).toString("hex")}`;
  const ts = new Date().toISOString();
  const answer = { questionId: "q-1", mcqSelectedOptionId: "opt-1", clientTimestamp: ts };
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
  });
  db.raw.prepare(
    "INSERT INTO answers (hub_attempt_id, question_id, mcq_selected_option_id, client_timestamp, local_checksum) VALUES (?, ?, ?, ?, ?)",
  ).run(hubAttemptId, answer.questionId, answer.mcqSelectedOptionId, ts, checksum(cfg.signingSecret, hubAttemptId, answer.questionId, ts, "opt-1"));

  console.log("3) Sync up …");
  const { uploaded } = await syncUp(db);
  console.log(`   uploaded ${uploaded} attempt(s)`);

  console.log("Done. Check the cloud exam detail page for the synced attempt.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Manual end-to-end drill**

Prereqs: cloud dev server running (`npm run dev` on port 3000), a school, a published exam with questions and enrolled active students, and a registered hub from Task 9.

1. Create `hub/config.json` from `config.example.json` with the real `apiKey` + `signingSecret` from the console (Task 9 reveal).
2. In the exam detail page, release the exam to the hub (Task 10).
3. Run: `npm run drill` (in `hub/`).
4. In the cloud: check the exam's attempts — one submitted attempt for the fake student should exist, with `syncStatus = synced`.

Expected: drill prints `pulled 1 bundle(s)`, `uploaded 1 attempt(s)`, and the cloud DB shows the attempt + answer rows.

- [ ] **Step 5: Commit**

```bash
git add hub/src/crypto.ts hub/src/sync.ts hub/scripts/drill.ts
git commit -m "feat: hub sync engine and end-to-end drill"
```

---

## Self-Review Notes

- **Spec coverage:** §4 (bundle build, strip keys, PINs, HTTP pull, expires) → Tasks 4, 5, 6; §6.1–6.4 (sync-up, idempotency, checksum, MCQs later) → Tasks 7, 8 (grading intentionally deferred to Phase 3); §3 hub registry → Tasks 2, 5, 9; release trigger → Task 10. Hub runtime exam-taking, console live room, USB fallback, resit/absent handling are explicitly Phase 2–4.
- **Placeholder scan:** none — every step contains real code or an exact command.
- **Type consistency:** `processSyncUp` returns `"accepted" | "duplicate" | "flagged"` everywhere; `hubId_hubAttemptId` matches Prisma's default unique index name; `OfflineBundleV1` fields used identically across Task 4/5/12.
- **Deliberate simplification:** `authenticateHub` scans active hubs with bcrypt.compare (O(n) per request). Acceptable at this scale; can be optimized to a keyed lookup later. `syncUp` sends `bundleId: ""` for the fake drill — real attempts must carry their bundleId; tightened in Phase 2 when real attempts exist.

## Amendments (pre-flight review)

Five plan-text defects found during the pre-flight scan and fixed in this revision:

1. **Task 6** — `hub-auth.test.ts` mocked `prisma.hub.findFirst` but `authenticateHub` calls `prisma.hub.findMany` (never mocked → TypeError), plus a dead `findFirst` line. Fixed: mock `findMany` returning an array; removed the dead `findFirst`.
2. **Task 7/8** — `StudentAnswer.attemptId` was set to `hubAttemptId` in `processSyncUp`, but Task 8's adapter creates `ExamAttempt` with a generated cuid `id`, so `student_answers.attemptId` would violate the FK. Fixed: `IngestStore.createAttempt` now returns the created DB `ExamAttempt.id` (`Promise<string>`), and `processSyncUp` maps answer records to that real id via `answers.map((a) => ({ ...a, attemptId }))`.
3. **Task 12** — the drill re-decrypted `bundles.payload`, but `syncDown` already stores the DECRYPTED plaintext there. Fixed: drill parses `bundle.payload` directly with `JSON.parse` and no longer imports `deriveBundleKey`/`decryptBundle`.
4. **Task 5** — the appended `bundle.ts` block self-imported from `"./bundle"`. Fixed: only `import { prisma } from "@/lib/prisma"` is added; `fetchExamDataForBundle` uses `prisma.exam.findFirst` scoped by `schoolId` (also fixes Finding 5).
5. **Task 5** — `releaseExamToHub`/`fetchExamDataForBundle` had no cross-school authorization: any staff user could release another school's exam to their hub via the directly-callable server action. Fixed: `fetchExamDataForBundle(examId, schoolId)` filters `where: { id: examId, schoolId }`, and `releaseExamToHub` passes `user.schoolId`.

6. **Task 2** — migration SQL aligned to the applied schema/`db push` (schema is the source of truth; migration is a history mirror): `offline_bundles_hubId_fkey` `ON DELETE CASCADE` → `RESTRICT` (Prisma default for required relation with no `onDelete`), added the missing `exam_attempts_hubId_fkey` (`ON DELETE SET NULL ON UPDATE CASCADE`, Prisma default for optional `ExamAttempt.hub`), and `exam_pins_bundleId_studentId_key` changed to `CREATE UNIQUE INDEX` to match `@@unique([bundleId, studentId])`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-09-offline-exam-sync-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
