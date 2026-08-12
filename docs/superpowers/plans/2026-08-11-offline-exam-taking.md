# Offline Exam-Taking on the Hub — Implementation Plan

**Date:** 2026-08-11
**Status:** Ready to execute
**Author:** AI pair (session `teta-exam`)

## Purpose

Enable exam-taking to happen **fully offline** on a classroom hub when the internet
is unavailable. Students sign in on the hub (via a simple SPA served by the hub
Express server), take the exam with the same UX and timing rules as the online
"Take Exam" screen, autosave answers to the local SQLite DB with integrity
checksums, and submit locally. Later, when connectivity returns, the existing
sync process pushes submitted attempts to the cloud.

The exam-taking experience is ported out of the Next.js app into a **shared
module** so the online app and the hub SPA render the exact same component and
behavior.

## Global Constraints

1. **Shell quirk:** plain PowerShell hangs in this environment. Wrap every shell
   command as `cmd /c "..."`. When chaining, use `cmd /c "a && b"`.
2. **Do NOT commit** `error.log` (deleted, don't restore) or `build_error.log`
   (untracked). The `hub/` dir already contains `.gitignore`; if anything odd
   appears in git status, leave it.
3. **Type-check is authoritative for the app:** `npm run typecheck` /
   `npx tsc --noEmit` in `marksheet/`. `next build` stalls at page-data collection
   on this machine and is NOT a valid verification. `npm run lint` is valid.
4. Hub verification uses `npm test` (vitest) inside `hub/` and `tsx` smoke runs.
   No full server boot in CI-style checks.
5. Never regress existing online behavior. The online app continues to work
   exactly as before; the change is structural (shared module) not behavioral.
6. **Corrected alias path (vs. parent spec):** the app `tsconfig.json` sits at
   the repo root (`marksheet/`), so the shared-module path alias is
   `"@exam-rendering/*": ["./shared/exam-rendering/*"]` — NOT `"../../shared/..."`.
7. The hub server is a separate package; its server code imports the shared core
   via **relative paths** (`../../shared/exam-rendering/...`). The hub SPA uses a
   Vite `@exam-rendering` alias.
8. Each task ends with a commit **only if the user asks**. Otherwise leave the
   working tree; report results.

## Repo layout recap

- Git root: `marksheet/`
- Next.js app: `marksheet/src/`
- Hub package: `marksheet/hub/` (own package.json, node_modules, tsconfig)
- Shared module (new): `marksheet/shared/exam-rendering/`
- Existing hub DB (`marksheet/hub/src/db.ts`) is SQLite via `better-sqlite3`
- Existing cloud "Take Exam" UI: `marksheet/src/app/(app)/exams/take/exam-taking-view.tsx`
- Existing server actions: `marksheet/src/app/(app)/exams/take/exam-taking-actions.ts`
- Existing cloud bundle module: `marksheet/src/lib/offline/bundle.ts`
- Existing hub sync: `marksheet/hub/src/sync.ts`

---

## Task 1 — Shared module: types + pure core logic (with tests)

**Files**
- `shared/exam-rendering/types.ts` (new)
- `shared/exam-rendering/exam-taking-core.ts` (new)
- `shared/exam-rendering/exam-taking-core.test.ts` (new)
- `marksheet/tsconfig.json` (add path alias)
- `marksheet/vitest.config.ts` (include shared tests + alias)

### 1.1 `shared/exam-rendering/types.ts`

```ts
export interface ExamQuestionOption {
  id: string;
  text: string;
}

export interface ExamQuestionPart {
  id: string;
  questionId: string;
  type: "mcq" | "essay";
  text: string;
  maxMarks: number | null;
  mcqOptions: ExamQuestionOption[] | null;
}

export interface ExamQuestion {
  id: string;
  questionGroupId: string | null;
  groupInternallyShufflable: boolean | null;
  parts: ExamQuestionPart[];
}

export interface AttemptData {
  status: "started" | "submitted";
  startedAt: string;
  submittedAt: string | null;
  endsAt: string;
  shuffledQuestionIds: string[] | null;
  shuffledOptionOrder: Record<string, string[]> | null;
  lastAutosaveAt: string | null;
}

export interface AnswerValue {
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp: string;
  localChecksum?: string | null;
}

export interface SavedAnswersMap {
  [questionId: string]: AnswerValue;
}

export interface ExamTakingAdapters {
  start?(): Promise<{
    attemptId: string;
    endsAt: string;
    shuffledQuestionIds?: string[] | null;
    shuffledOptionOrder?: Record<string, string[]> | null;
  }>;
  tick?(attemptId: string): Promise<{ remainingSeconds: number; expired?: boolean }>;
  autoSave(attemptId: string, answers: AnswerValue[]): Promise<void>;
  submit(attemptId: string, answers: AnswerValue[]): Promise<string>;
}
```

### 1.2 `shared/exam-rendering/exam-taking-core.ts`

Pure functions (no React, no I/O). All behavior ported from the online
`exam-taking-view.tsx` and `exam-taking-actions.ts` so both platforms stay
identical.

```ts
import type { AnswerValue, ExamQuestion, ExamQuestionPart, ExamQuestionOption } from "./types";

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function remainingFromEndsAt(endsAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function shouldAutoSubmit(remainingSeconds: number, endsAt: string, thresholdMs = 5000): boolean {
  return remainingSeconds <= 0 || Date.now() >= new Date(endsAt).getTime() - thresholdMs;
}

export interface ParsedSubQuestion {
  id: string;            // optionId for mcq parts, questionId for essay parts
  type: "mcq" | "essay";
  questionId: string;
  questionText: string;  // parent question text (+ option text for mcq)
  marks: number | null;
  optionId?: string;
}

export function parseSubQuestions(parts: ExamQuestionPart[]): ParsedSubQuestion[] {
  const out: ParsedSubQuestion[] = [];
  for (const part of parts) {
    if (part.type === "mcq" && part.mcqOptions) {
      for (const opt of part.mcqOptions) {
        out.push({
          id: opt.id,
          type: "mcq",
          questionId: part.questionId,
          questionText: `${part.text} ${opt.text}`.trim(),
          marks: part.maxMarks,
          optionId: opt.id,
        });
      }
    } else {
      out.push({
        id: part.questionId,
        type: "essay",
        questionId: part.questionId,
        questionText: part.text,
        marks: part.maxMarks,
      });
    }
  }
  return out;
}

export function buildAnswerList(
  questions: ExamQuestion[],
  answers: AnswerValue[],
): AnswerValue[] {
  const list: AnswerValue[] = [];
  for (const q of questions) {
    for (const part of q.parts) {
      if (part.type === "mcq" && part.mcqOptions) {
        const selected = answers.find((a) => a.questionId === q.id && a.mcqSelectedOptionId);
        if (selected) {
          list.push({
            questionId: q.id,
            mcqSelectedOptionId: selected.mcqSelectedOptionId,
            essayResponseText: null,
            clientTimestamp: selected.clientTimestamp,
            localChecksum: selected.localChecksum ?? null,
          });
        }
      } else {
        const essay = answers.find((a) => a.questionId === q.id && a.essayResponseText);
        if (essay) {
          list.push({
            questionId: q.id,
            mcqSelectedOptionId: null,
            essayResponseText: essay.essayResponseText,
            clientTimestamp: essay.clientTimestamp,
            localChecksum: essay.localChecksum ?? null,
          });
        }
      }
    }
  }
  return list;
}

export function buildShuffle(
  questions: Pick<ExamQuestion, "id" | "questionGroupId" | "groupInternallyShufflable" | "parts">[],
  shuffleEnabled: boolean,
): { shuffledQuestionIds: string[] | null; shuffledOptionOrder: Record<string, string[]> | null } {
  if (!shuffleEnabled) return { shuffledQuestionIds: null, shuffledOptionOrder: null };

  const groups = new Map<string, string[]>();
  const standalone: string[] = [];
  for (const q of questions) {
    if (q.questionGroupId) {
      const list = groups.get(q.questionGroupId) ?? [];
      list.push(q.id);
      groups.set(q.questionGroupId, list);
    } else {
      standalone.push(q.id);
    }
  }

  const items: string[][] = [];
  for (const id of standalone) items.push([id]);
  for (const [gid, ids] of groups) {
    const internallyShufflable = questions.some((q) => q.questionGroupId === gid && q.groupInternallyShufflable);
    items.push(internallyShufflable ? shuffleArray(ids) : ids);
  }
  const shuffledQuestionIds = shuffleArray(items).flat();

  const shuffledOptionOrder: Record<string, string[]> = {};
  for (const q of questions) {
    const options = q.parts.flatMap((p) => p.mcqOptions ?? []);
    if (options.length > 1) {
      shuffledOptionOrder[q.id] = shuffleArray(options.map((o: ExamQuestionOption) => o.id));
    }
  }
  return { shuffledQuestionIds, shuffledOptionOrder };
}

export function orderQuestions(
  questions: ExamQuestion[],
  shuffledQuestionIds: string[] | null,
): ExamQuestion[] {
  if (!shuffledQuestionIds) return questions;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ordered = shuffledQuestionIds.map((id) => byId.get(id)).filter((q): q is ExamQuestion => !!q);
  for (const q of questions) {
    if (!shuffledQuestionIds.includes(q.id)) ordered.push(q);
  }
  return ordered;
}

export function orderOptions(
  questionId: string,
  options: ExamQuestionOption[],
  shuffledOptionOrder: Record<string, string[]> | null,
): ExamQuestionOption[] {
  const order = shuffledOptionOrder?.[questionId];
  if (!order) return options;
  const byId = new Map(options.map((o) => [o.id, o]));
  const ordered = order.map((id) => byId.get(id)).filter((o): o is ExamQuestionOption => !!o);
  for (const o of options) {
    if (!order.includes(o.id)) ordered.push(o);
  }
  return ordered;
}
```

### 1.3 `marksheet/tsconfig.json` — add path alias

Inside existing `compilerOptions.paths`:

```json
"paths": {
  "@/*": ["./src/*"],
  "@exam-rendering/*": ["./shared/exam-rendering/*"]
}
```

### 1.4 `marksheet/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "shared/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@exam-rendering": path.resolve(__dirname, "shared/exam-rendering"),
    },
  },
});
```

> Note: `hub/**/*.test.ts` is removed from the root config; hub gets its own
> vitest config in Task 4.

### 1.5 Tests `shared/exam-rendering/exam-taking-core.test.ts`

Test: `parseSubQuestions` builds option rows for mcq parts and question rows for
essay parts; `buildAnswerList` only emits answered parts (mcq selected, essay
non-empty) with checksum passthrough; `buildShuffle` — disabled returns nulls,
enabled never splits groups, group internal order locked when
`groupInternallyShufflable` false, option order shuffled only for >1 options;
`orderQuestions`/`orderOptions` preserve unlisted items; `remainingFromEndsAt`
and `shouldAutoSubmit` boundary behavior.

### 1.6 Verify Task 1

```powershell
cmd /c "cd /d marksheet && npx vitest run shared/exam-rendering --passWithNoTests"
cmd /c "cd /d marksheet && npx tsc --noEmit"
```

---

## Task 2 — Shared design tokens CSS

The online app defines its theme tokens via `@theme inline` in
`src/app/globals.css`. Extract that block into the shared module and import it
from both app and hub so the offline UI looks identical.

**Files**
- `shared/exam-rendering/exam-tokens.css` (new)
- `marksheet/src/app/globals.css` (import the tokens file)
- `marksheet/hub/src/client/main.css` (new — created in Task 8, but the import
  line is defined here)

### 2.1 `shared/exam-rendering/exam-tokens.css`

Copy the existing `@theme inline { ... }` block verbatim from
`marksheet/src/app/globals.css` (colors, fonts, radius, shadows, animations).
No changes to the token values.

### 2.2 `marksheet/src/app/globals.css`

Add at the very top:

```css
@import "../../shared/exam-rendering/exam-tokens.css";
```

Keep the rest of the file unchanged (tailwind directives, body styles).

### 2.3 `marksheet/hub/src/client/main.css` (created fully in Task 8)

```css
@import "tailwindcss";
@import "../../../shared/exam-rendering/exam-tokens.css";
```

### 2.4 Verify Task 2

```powershell
cmd /c "cd /d marksheet && npm run lint"
cmd /c "cd /d marksheet && npx tsc --noEmit"
```

---

## Task 3 — Hub DB additions

Extend `marksheet/hub/src/db.ts` with session-open state, sign-in lockout table,
autosave timestamp, and the queries the exam-taking logic needs.

**File:** `marksheet/hub/src/db.ts`

### 3.1 Schema additions (idempotent migrations inside the existing migration block)

```ts
CREATE TABLE IF NOT EXISTS signin_locks (
  bundle_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  PRIMARY KEY (bundle_id, student_id)
)
```

On `bundles` table (migrate existing column add):
```ts
ALTER TABLE bundles ADD COLUMN session_open INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bundles ADD COLUMN session_duration_minutes INTEGER NOT NULL DEFAULT 0;
```
(Guard: run `ALTER TABLE` inside a `PRAGMA table_info` check so it does not
error on re-run, matching the style used for existing migrations.)

On `attempts` table:
```ts
ALTER TABLE attempts ADD COLUMN last_autosave_at TEXT;
```
(Guarded the same way.)

### 3.2 Type + Db-interface additions

```ts
export interface SessionRow {
  bundleId: string;
  openedAt: string;
  durationMinutes: number;
}

export interface BundleWithStatusRow {
  bundleId: string;
  payload: string;
  expiresAt: string;
  sessionOpen: 0 | 1;
  sessionDurationMinutes: number;
}

export interface AttemptRow {
  hubAttemptId: string;
  bundleId: string;
  studentId: string;
  status: "started" | "submitted";
  startedAt: string;
  submittedAt: string | null;
  endsAt: string;
  shuffledQuestionIds: string | null;  // JSON string or null
  shuffledOptionOrder: string | null;  // JSON string or null
  lastAutosaveAt: string | null;
  synced: 0 | 1;
}

export interface AnswerRow {
  id: number;
  hubAttemptId: string;
  questionId: string;
  mcqSelectedOptionId: string | null;
  essayResponseText: string | null;
  clientTimestamp: string;
  localChecksum: string | null;
}
```

New methods on the `Db` interface + SQLite implementation:

```ts
setSessionOpen(bundleId: string, open: boolean, durationMinutes?: number): void
// UPDATE bundles SET session_open = ?, session_duration_minutes = ?, opened_at = ? WHERE bundle_id = ?
// (add `opened_at TEXT` column to bundles with same guarded migration)

getBundleWithStatus(bundleId: string): BundleWithStatusRow | null

getOpenBundles(): BundleWithStatusRow[]
// WHERE session_open = 1 AND expires_at > now

getAttemptByStudent(bundleId: string, studentId: string): AttemptRow | null

getAttempt(hubAttemptId: string): AttemptRow | null

getAnswers(hubAttemptId: string): AnswerRow[]

upsertAnswer(args: {
  hubAttemptId: string;
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp: string;
  localChecksum?: string | null;
}): void
// INSERT INTO answers (...) VALUES (...) ON CONFLICT(hub_attempt_id, question_id) DO UPDATE SET ...

markAttemptSubmitted(hubAttemptId: string, submittedAt: string): void
touchLastAutosave(hubAttemptId: string, at: string): void

getSigninLock(bundleId: string, studentId: string): { failedAttempts: number; lockedUntil: string | null } | null
recordSigninFailure(bundleId: string, studentId: string): void
// UPSERT failed_attempts = failed_attempts + 1
clearSigninLock(bundleId: string, studentId: string): void
```

### 3.3 `getLocalOnlyAttempts` — only submitted attempts sync

Change its SQL so sync only pushes finished attempts:

```sql
SELECT * FROM attempts WHERE synced = 0 AND status = 'submitted'
```

(`sync.ts` currently already filters/uses this method; verify after the change
that nothing else depended on unsubmitted rows.)

### 3.4 `insertAttempt` signature

Extend `insertAttempt` (or add `insertAttemptWithShuffle`) so the caller can
persist `shuffledQuestionIds`, `shuffledOptionOrder`, and `endsAt`. Signature:

```ts
insertAttempt(args: {
  bundleId: string;
  studentId: string;
  status: "started";
  startedAt: string;
  submittedAt: string | null;
  endsAt: string;
  shuffledQuestionIds: string | null;
  shuffledOptionOrder: string | null;
}): string  // returns hubAttemptId
```

(Keep any existing callers compiling — `sync.ts` does not insert attempts, only
the online path did; the hub is the new sole writer.)

### 3.5 Verify Task 3

```powershell
cmd /c "cd /d marksheet\hub && npx tsc --noEmit"
cmd /c "cd /d marksheet\hub && npx tsx -e \"import { openDb } from './src/db.ts'; const db = openDb(':memory:'); db.setSessionOpen('x', true, 30); console.log('db ok', db.getBundleWithStatus('x'));\""
```

---

## Task 4 — Hub exam-taking logic + tests

**Files**
- `marksheet/hub/src/crypto.ts` (add `answerChecksum`)
- `marksheet/hub/src/exam-taking.ts` (new)
- `marksheet/hub/vitest.config.ts` (new)
- `marksheet/hub/src/exam-taking.test.ts` (new)
- `marksheet/hub/package.json` (add `vitest` devDep + `test` script)
- `marksheet/hub/tsconfig.json` (add `shared` include so server type-checks the
  relative imports)

### 4.1 `marksheet/hub/src/crypto.ts` — add

```ts
import { createHash } from "node:crypto";

export function answerChecksum(
  attemptId: string,
  questionId: string,
  clientTimestamp: string,
  answerPayload: string,
): string {
  return createHash("sha256")
    .update(`answer:${attemptId}:${questionId}:${clientTimestamp}:${answerPayload}`)
    .digest("hex");
}
```

The cloud verifier (in `src/lib/offline/crypto.ts`) recomputes
`answer:${attemptId}:${questionId}:${clientTimestamp}:${answerPayload}` and also
accepts a variant using the bundleId in place of attemptId — the hub produces the
attemptId form. Verification helper:

```ts
export function verifyAnswerChecksum(
  attemptId: string,
  bundleId: string,
  questionId: string,
  clientTimestamp: string,
  answerPayload: string,
  checksum: string,
): boolean {
  const attempt = answerChecksum(attemptId, questionId, clientTimestamp, answerPayload);
  const bundle = answerChecksum(bundleId, questionId, clientTimestamp, answerPayload);
  return checksum === attempt || checksum === bundle;
}
```

### 4.2 `marksheet/hub/src/exam-taking.ts`

Local types + pure-ish logic over the Db interface. Server code imports the
shared core via relative path:

```ts
import { buildAnswerList, buildShuffle, remainingFromEndsAt } from "../../shared/exam-rendering/exam-taking-core";
import type { ExamQuestion } from "../../shared/exam-rendering/types";
import type { Db } from "./db";
import { verifyAnswerChecksum } from "./crypto";

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 10;

export interface BundlePayload {
  subjectName: string;
  classNames: string[];
  termLabel: string;
  durationMinutes: number;
  shuffleEnabled: boolean;
  questions: ExamQuestion[];
  roster: { admissionNumber: string; studentName: string; studentPhoto?: string | null; pin: string }[];
}

export interface RosterStudent {
  studentId: string;          // = admissionNumber
  admissionNumber: string;
  studentName: string;
  studentPhoto: string | null;
}
```

Functions:

```ts
parsePayload(raw: string): BundlePayload        // JSON.parse + shape validation, throws on malformed
getRosterStudent(payload: BundlePayload, admissionNumber: string): RosterStudent | null

signIn(db, bundleId, admissionNumber, pin): SignInResult
// 1. lock check -> if locked, { ok:false, error, lockoutSeconds }
// 2. parse bundle, find roster student by admissionNumber
// 3. pin mismatch -> recordSigninFailure; when failedAttempts >= MAX -> set locked_until = now + 10min;
//    return { ok:false, error:"Invalid PIN." } (or lockout message)
// 4. success -> clearSigninLock; build SignInResult
// SignInResult success shape:
//   { ok:true, student, exam:{subjectName, termLabel, durationMinutes, questionCount},
//     questions, attempt: AttemptInfo | null }
// AttemptInfo = { hubAttemptId, startedAt, submittedAt, endsAt,
//                 shuffledQuestionIds, shuffledOptionOrder, lastAutosaveAt }

startAttempt(db, bundleId, studentId): { ok:true; attempt: AttemptInfo }
//  - parse bundle, verify roster contains studentId
//  - if an existing attempt for (bundleId, studentId) exists -> return it (idempotent)
//  - compute shuffle = buildShuffle(payload.questions, payload.shuffleEnabled)
//  - endsAt = new Date(Date.now() + durationMinutes*60000).toISOString()
//  - insertAttempt(...); return attempt

saveAnswers(db, attemptId, answers: IncomingAnswer[]): { accepted: number; rejected: number }
//  - load attempt; if status submitted -> reject all
//  - upsertAnswer per entry; return counts

tickAttempt(db, attemptId): { remainingSeconds: number; expired: boolean }
//  - load attempt; remaining = remainingFromEndsAt(endsAt)
//  - if remaining <= 0 && status still "started" -> markAttemptSubmitted(now); expired = true

submitAttempt(db, attemptId, bundleId, answers: IncomingAnswer[]): { ok:true; message: string }
//  - load attempt (must be "started")
//  - verify checksums via verifyAnswerChecksum (reject mismatches), upsert valid ones
//  - markAttemptSubmitted(now); idempotent if already submitted -> return success message
```

Where:

```ts
export interface IncomingAnswer {
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp: string;
  localChecksum?: string | null;
}
```

### 4.3 `marksheet/hub/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: { "@exam-rendering": path.resolve(__dirname, "../shared/exam-rendering") },
  },
});
```

### 4.4 `marksheet/hub/package.json`

```json
"scripts": { "test": "vitest run" }
```
devDependencies: `"vitest": "^3"`.

### 4.5 `marksheet/hub/tsconfig.json`

```json
"include": ["src", "scripts", "../shared/exam-rendering"]
```

### 4.6 Tests `marksheet/hub/src/exam-taking.test.ts`

Use an in-memory temp SQLite DB (`openDb` against a temp dir), insert a bundle
via `insertBundle`, then cover:

- `signIn` happy path returns student + questions + null attempt
- `signIn` wrong PIN increments failures; 5th failure locks; locked sign-in
  returns `lockoutSeconds`
- `startAttempt` creates attempt with `endsAt ≈ now + duration`; idempotent on
  second call
- `saveAnswers` persists; rejects after submission
- `tickAttempt` counts down; `expired: true` when past endsAt and auto-submits
- `submitAttempt` stores checksummed answers and marks submitted; idempotent
- `verifyAnswerChecksum` accepts attemptId and bundleId variants, rejects bad
  checksums
- `buildShuffle` (through `startAttempt`) never splits groups

### 4.7 Verify Task 4

```powershell
cmd /c "cd /d marksheet\hub && npm test"
cmd /c "cd /d marksheet\hub && npx tsc --noEmit"
```

---

## Task 5 — Hub endpoints + config

Expose the logic as HTTP endpoints and serve the SPA.

**Files**
- `marksheet/hub/src/index.ts` (add routes + static serving)
- `marksheet/hub/src/config.ts` (add `invigilatorCode`)
- `marksheet/hub/config.example.json` (add `invigilatorCode`)

### 5.1 `config.ts`

Add to the config interface/type:

```ts
invigilatorCode: string;
```

Fallback: `process.env.INVIGILATOR_CODE ?? ""`. For local runs, copy
`config.example.json` → `config.json` and set a code.

### 5.2 `index.ts`

- `app.use(express.json())` (body parser for POSTs).
- Serve SPA build (created in Task 8):
  ```ts
  const PUBLIC_DIR = path.join(import.meta.dirname, "../dist/public");
  app.use(express.static(PUBLIC_DIR));
  app.get(["/admin", "/admin/*"], (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
  ```
- Admin auth helper: require header `x-invigilator-code === config.invigilatorCode`
  (constant-time compare), else `401`.

Routes:

```
GET  /api/open-sessions
  -> db.getOpenBundles() -> [{ bundleId, subjectName, termLabel, durationMinutes, questionCount, openedAt }]
     (skip bundles whose payload fails parsePayload)

POST /api/sign-in          { bundleId, admissionNumber, pin }
  -> exam-taking.signIn -> 200 { student, exam, questions, attempt } | 400 { error, lockoutSeconds? }

POST /api/attempts/start   { bundleId, studentId }
  -> exam-taking.startAttempt -> 200 { attempt } | 400/404 { error }

POST /api/attempts/:id/autosave   { answers: IncomingAnswer[] }
  -> exam-taking.saveAnswers -> 200 { accepted, rejected } | 404/409 { error }

POST /api/attempts/:id/tick
  -> exam-taking.tickAttempt -> 200 { remainingSeconds, expired } | 404 { error }

POST /api/attempts/:id/submit     { answers: IncomingAnswer[] }
  -> exam-taking.submitAttempt(db, attemptId, bundleIdFromAttempt, answers)
     -> 200 { message } | 404/409 { error }

GET  /api/admin/sessions           (auth)
  -> [{ bundleId, subjectName, termLabel, durationMinutes, status: "open"|"closed" }]

POST /api/admin/sessions/:bundleId/open    (auth)  body { durationMinutes? }
  -> parse payload -> db.setSessionOpen(bundleId, true, durationMinutes ?? payload.durationMinutes)

POST /api/admin/sessions/:bundleId/close   (auth)
  -> db.setSessionOpen(bundleId, false)
```

Errors: `res.status(...).json({ error })`. Every route wraps logic in try/catch
returning `500 { error: message }`.

### 5.3 Verify Task 5

Smoke-run the server briefly with a temp DB and curl one endpoint, then stop:

```powershell
cmd /c "cd /d marksheet\hub && set HUB_DB_DIR=%TEMP%\hub-smoke && npx tsx src/index.ts"
```
(in a separate call once the user confirms it started, then Ctrl-C via the
harness). Also:
```powershell
cmd /c "cd /d marksheet\hub && npx tsc --noEmit"
```

---

## Task 6 — Shared headless hook `use-exam-taking`

Port the state machine from the online `exam-taking-view.tsx` into a React hook
in the shared module, parameterized by `ExamTakingAdapters`.

**File:** `shared/exam-rendering/use-exam-taking.ts`

### Signature

```ts
export interface UseExamTakingOptions {
  questions: ExamQuestion[];
  savedAnswers: SavedAnswersMap;
  attemptData: AttemptData | null;
  adapters: ExamTakingAdapters;
  durationMinutes: number;
  autosaveIntervalMs?: number;  // default 30_000
  onComplete?: (message: string) => void;
}

export function useExamTaking(opts: UseExamTakingOptions): {
  // derived
  orderedQuestions: ExamQuestion[];
  parts: ParsedSubQuestion[];          // flattened, ordered
  // state
  currentIndex: number;
  answers: SavedAnswersMap;
  essayParts: string[];                // essay question ids in order
  remaining: number;                   // seconds
  submitted: boolean;
  confirming: boolean;
  msg: string | null;
  starting: boolean;
  autoSaving: boolean;
  skipped: Set<string>;
  attemptId: string | null;
  // handlers
  startExam(): Promise<void>;
  handleSubmit(): Promise<void>;
  cancelSubmit(): void;
  goTo(i: number): void;
  goNext(): void;
  goPrev(): void;
  handleSkip(questionId: string): void;
  isAnswered(questionId: string): boolean;
  isSkipped(questionId: string): boolean;
  tickHandler(): Promise<void>;
};
```

Behavior (faithful port of the current online view):

1. **Init:** ordered parts from `orderQuestions` + `orderOptions` using
   `attemptData.shuffledQuestionIds`/`shuffledOptionOrder` (or bundle order if
   null). `remaining` from `remainingFromEndsAt(attemptData.endsAt)` else
   `durationMinutes * 60`. `attemptId` from `attemptData`.
2. **Start screen:** if `!attemptId`, show Start; `startExam()` calls
   `adapters.start()`, sets `attemptId` + `endsAt`, applies returned shuffle.
3. **Countdown:** 1s interval decrements `remaining`; when `shouldAutoSubmit`
   fires, auto-run submit once. If `adapters.tick` exists, call it each interval
   to reconcile with server time and mark `expired` (auto-submit).
4. **Autosave:** interval `autosaveIntervalMs` — build `buildAnswerList(...)`,
   call `adapters.autoSave(attemptId, list)`, set `autoSaving` during, swallow
   errors (autosave must never crash the session).
5. **Submit:** confirm dialog → `buildAnswerList` → `adapters.submit(...)` →
   set `msg` from returned string, `submitted = true`, stop intervals, call
   `onComplete(msg)`. Guard double-submit and submit-while-submitted.
6. **Skip:** toggles `skipped`; "Answer review" nav unaffected otherwise.

No network/auth logic lives here — adapters provide it.

### Verify Task 6

```powershell
cmd /c "cd /d marksheet && npx tsc --noEmit"
cmd /c "cd /d marksheet && npm run lint"
```

---

## Task 7 — Shared view component + online adapter wrapper

Move the actual UI JSX from `src/app/(app)/exams/take/exam-taking-view.tsx` into
the shared module, then make the app's file a thin wrapper that supplies online
server-action adapters. Online behavior is unchanged.

**Files**
- `shared/exam-rendering/exam-taking-view.tsx` (new — port of current view UI)
- `marksheet/src/app/(app)/exams/take/exam-taking-view.tsx` (replace body with wrapper)
- `marksheet/src/app/(app)/exams/take/[id]/page.tsx` (build `attemptData` from
  `existingAttempt`; confirm prop names)

### 7.1 `shared/exam-rendering/exam-taking-view.tsx`

```tsx
export interface ExamTakingViewProps {
  examId: string;
  studentId: string;
  attemptData: AttemptData | null;
  subjectName: string;
  className: string;
  assessmentTypeId: string;
  durationMinutes: number;
  termName: string;
  questions: ExamQuestion[];
  savedAnswers: SavedAnswersMap;
  studentName: string;
  studentPhoto: string | null;
  adapters: ExamTakingAdapters;
}
```

Component uses `useExamTaking` and renders the exact same markup as today's
`exam-taking-view.tsx` (Start screen, timer header, question nav, answer
review with skip marks, submit confirm, success banner). The only differences:
props source from `ExamTakingViewProps` and state/handlers come from the hook.

### 7.2 `marksheet/src/app/(app)/exams/take/exam-taking-view.tsx` (wrapper)

```tsx
import SharedExamTakingView, { type ExamTakingViewProps } from "@exam-rendering/exam-taking-view";
import {
  startExamAction,
  autoSaveExamAction,
  submitExamAction,
  tickExamAction,
} from "./exam-taking-actions";

export default function ExamTakingView(props: Omit<ExamTakingViewProps, "adapters">) {
  const adapters = useMemo<ExamTakingAdapters>(() => ({
    start: async () => {
      const res = await startExamAction(props.examId, props.studentId);
      if (!res.attemptId) throw new Error(res.error ?? "Failed to start exam.");
      return { attemptId: res.attemptId, endsAt: new Date(Date.now() + props.durationMinutes * 60000).toISOString() };
    },
    tick: async (attemptId) => await tickExamAction(attemptId),
    autoSave: async (attemptId, answers) => {
      await autoSaveExamAction(attemptId, { answers });
    },
    submit: async (attemptId, answers) => {
      const res = await submitExamAction(attemptId, { answers });
      return res.success ?? res.error ?? "Submitted.";
    },
  }), [props.examId, props.studentId, props.durationMinutes]);

  return <SharedExamTakingView {...props} adapters={adapters} />;
}
```

> Confirm the server-action response shapes (`startExamAction` returns
> `{ attemptId?, error? }`, `tickExamAction` returns `{ remainingSeconds, error? }`,
> `submitExamAction` returns `{ success?, error? }`, `autoSaveExamAction` returns
> `void`/`{ error? }`) against the current `exam-taking-actions.ts` and adjust the
> wrapper accordingly.

### 7.3 `marksheet/src/app/(app)/exams/take/[id]/page.tsx`

Build `attemptData` from `existingAttempt`:

```tsx
const attemptData: AttemptData | null = existingAttempt
  ? {
      status: existingAttempt.status,
      startedAt: existingAttempt.startedAt.toISOString(),
      submittedAt: existingAttempt.submittedAt?.toISOString() ?? null,
      endsAt: existingAttempt.endsAt.toISOString(),
      shuffledQuestionIds: existingAttempt.shuffledQuestionIds ?? null,
      shuffledOptionOrder: existingAttempt.shuffledOptionOrder ?? null,
      lastAutosaveAt: existingAttempt.lastAutosaveAt?.toISOString() ?? null,
    }
  : null;
```

and pass it (plus `examId`, `studentId`, and the other existing props) to the
wrapper. Keep all other page logic identical.

### 7.4 Verify Task 7

```powershell
cmd /c "cd /d marksheet && npx tsc --noEmit"
cmd /c "cd /d marksheet && npm run lint"
```

Manual smoke (best-effort, if user can run the dev server): visit the Take Exam
page and confirm start/countdown/autosave/submit still work online.

---

## Task 8 — Hub SPA (Vite + React, student + admin flows)

**Files**
- `marksheet/hub/package.json` (deps)
- `marksheet/hub/vite.config.ts` (new)
- `marksheet/hub/index.html` (new)
- `marksheet/hub/src/client/main.tsx` (new)
- `marksheet/hub/src/client/student-flow.tsx` (new)
- `marksheet/hub/src/client/admin-flow.tsx` (new)
- `marksheet/hub/src/client/main.css` (new — defined in Task 2.3)

### 8.1 `marksheet/hub/package.json`

```json
"dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
"devDependencies": {
  "vite": "^5", "@vitejs/plugin-react": "^4", "tailwindcss": "^4", "@tailwindcss/vite": "^4",
  "@types/react": "^18", "@types/react-dom": "^18"
}
"scripts": { "dev:spa": "vite", "build:spa": "vite build" }
```

### 8.2 `marksheet/hub/vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "."),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@exam-rendering": path.resolve(__dirname, "../shared/exam-rendering") } },
  build: { outDir: path.resolve(__dirname, "dist/public"), emptyOutDir: true },
  server: { port: 5199, proxy: { "/api": "http://localhost:3001" } },
});
```

### 8.3 `marksheet/hub/index.html`

Standard Vite entry: `<div id="root">`, `<script type="module" src="/src/client/main.tsx">`, title "Exam Hub".

### 8.4 `marksheet/hub/src/client/main.tsx`

- `ReactDOM.createRoot(...)` render `<App/>` under a `createBrowserRouter`-lite
  approach or simple `useState` router with two screens:
  - `route === "home"` → student entry (session picker + sign-in)
  - `route === "admin"` → invigilator (code → session open/close)
- `Api` helper module-level functions wrapping `fetch` (same origin, `/api/...`).

### 8.5 `marksheet/hub/src/client/student-flow.tsx`

States: `loading sessions → picking → signing in → ready`.

- **Session picker:** `GET /api/open-sessions` → list cards (subject, class,
  term, duration, question count). Refresh button.
- **Sign-in:** admission number + PIN → `POST /api/sign-in`. On `attempt` null,
  render `<SharedExamTakingView>` with `attemptData={null}` (Start screen). On
  `attempt` present, pass it. Adapters:
  ```ts
  start: async () => {
    const r = await api(`/api/attempts/start`, { method: "POST", body: JSON.stringify({ bundleId, studentId: student.admissionNumber }) });
    if (!r.ok) throw new Error((await r.json()).error ?? "Failed to start.");
    return (await r.json()).attempt; // { attemptId, endsAt, shuffledQuestionIds, shuffledOptionOrder }
  },
  tick: async (attemptId) => (await (await api(`/api/attempts/${attemptId}/tick`, { method: "POST" })).json()),
  autoSave: async (attemptId, answers) => {
    await api(`/api/attempts/${attemptId}/autosave`, { method: "POST", body: JSON.stringify({ answers }) });
  },
  submit: async (attemptId, answers) => {
    const r = await api(`/api/attempts/${attemptId}/submit`, { method: "POST", body: JSON.stringify({ answers }) });
    const j = await r.json();
    return j.message ?? "Exam submitted.";
  },
  ```
  (In `submit`, if `!r.ok`, return `j.error ?? "Submit failed."` so the UI shows
  it; the hub submit is idempotent so retry is safe.)
- On `onComplete` show the success banner and disable further edits (the shared
  view already gates on `submitted`).

### 8.6 `marksheet/hub/src/client/admin-flow.tsx`

- Prompt for invigilator code (persist in `sessionStorage`).
- `GET /api/admin/sessions` with header `x-invigilator-code`.
- List bundles with `Open` / `Close` buttons → the two admin POSTs. Refresh list.

### 8.7 Verify Task 8

```powershell
cmd /c "cd /d marksheet\hub && npm install"
cmd /c "cd /d marksheet\hub && npm run build:spa"
cmd /c "cd /d marksheet\hub && npx tsc --noEmit"
```

Manual end-to-end (requires user running the hub):
1. `npm run drill` (or an existing import script) to load a bundle into
   `hub/data/`.
2. Open a session in `/admin`, sign in on `/` with a roster student + PIN.
3. Answer questions, watch autosave ticks, submit, verify the attempt row is
   `submitted` with checksummed answers.

---

## Task 9 — Final verification

```powershell
cmd /c "cd /d marksheet && npx vitest run"                 # app + shared tests
cmd /c "cd /d marksheet && npx tsc --noEmit"               # app type-check
cmd /c "cd /d marksheet && npm run lint"                   # app lint
cmd /c "cd /d marksheet\hub && npm test"                   # hub logic tests
cmd /c "cd /d marksheet\hub && npx tsc --noEmit"           # hub type-check
cmd /c "cd /d marksheet\hub && npm run build:spa"          # hub SPA builds
```

Confirm git status contains no stray `error.log` / `build_error.log` additions.

Report:
- Summary of changes per task.
- Any deviations from the plan.
- Manual end-to-end steps the user must run (bundle import + sign-in + submit,
  and online Take Exam smoke).

---

## Open questions for the user (do not block execution)

1. Hub port (default `3001`) and whether to keep the existing drill/import
   script path for loading bundles into the hub DB.
2. Whether roster PINs in the bundle are plaintext (they are in the bundle spec)
   — the hub compares against stored value directly; the cloud verifies via
   server action at sign-in too.
3. Confirm the exact current server-action response shapes (Task 7.2) at
   execution time; the plan notes the expected shapes and the executor should
   read `exam-taking-actions.ts` first.
