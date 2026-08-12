# Offline Exam-Taking on the Hub — Design Spec

**Date:** 2026-08-11
**Status:** Approved (brainstorming sections 1–3 reviewed and approved by user)
**Parent spec:** `docs/superpowers/specs/2026-08-09-offline-exam-sync-design.md` (approved; this spec implements its Phase 2, first slice)
**Scope:** Phase 2 *slice 1* — student offline exam-taking on the hub (PIN sign-in, shared rendering, kiosk shell, hub timer, autosave, resume) plus a minimal invigilator session open/close page. The full live-room console is a separate, later slice.

---

## 1. Purpose

Deliver full end-to-end offline exam-taking on the school-LAN hub: a student signs in on any device with admission number + PIN, takes the exam in a kiosk view that renders exactly like the online taking view, the hub enforces the timer, autosaves answers to local SQLite (checksummed), and the student can resume from any device. Results never appear to students; they are graded only in the cloud after sync (Phase 3).

## 2. Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Scope slice | Student offline taking first; live-room console in a later slice |
| Shared rendering | Framework-agnostic headless core + presentational view in a shared module; online view refactored to consume it |
| Hub SPA stack | Vite + React 19 + Tailwind 4 inside `hub/`; Express serves the built static files |
| Shared module location | Repo-root `shared/exam-rendering/`; path alias `@exam-rendering/*` in both the app's tsconfig and the hub's Vite config; no workspaces, no build step for the module |
| Shuffle resume strategy | Persist `shuffledQuestionIds` / `shuffledOptionOrder` on first start; resume reads stored order (same as online flow) — no seeded RNG |
| Session gating | Minimal invigilator page (`/admin`) opens/closes a bundle (LIVE/CLOSED); that is the only sign-in gate. Scheduled start/end window NOT enforced in this slice |
| Timer enforcement | Hub-authoritative: `endsAt` stored in SQLite; client countdown derived from `endsAt`, re-anchored via a hub `tick` endpoint; expiry auto-submits whatever exists |
| Autosave cadence | Online keeps its current 30s interval; hub SPA uses 10s interval + debounced save (~3s) on answer change |
| Hub tests | vitest in `hub/`, logic-level against temp-file SQLite; shared-module pure logic tested in the app's vitest |
| Checksum format | `answer:${attemptId}:${questionId}:${clientTimestamp}:${answerPayload}` — matches cloud `answerChecksum` exactly |

## 3. System architecture (slice 1)

```
┌──────────── CLOUD (unchanged by this slice) ───────────────┐
│  Existing bundle builder, release, sync-down/up, ingest.    │
│  (MCQ grading on ingest = Phase 3)                          │
└───────────────────────────▲─────────────────────────────────┘
                            │ HTTPS poll/push (existing)
┌───────────────────────────┴─────────────────────────────────┐
│  HUB — Express + better-sqlite3 + Vite/React/Tailwind SPA   │
│   Student SPA  http://<hub-ip>:3210/                        │
│   Invigilator /admin  http://<hub-ip>:3210/admin            │
│   SQLite: bundles(+session_open), attempts, answers,        │
│           signin_locks, sync_state                          │
│   Endpoints: /api/sign-in, /api/attempts/start,             │
│              /api/attempts/:id/autosave|tick|submit,        │
│              /api/admin/session/open|close,                 │
│              /api/admin/sessions                            │
└─────────────────────────────────────────────────────────────┘
                            │ school LAN — no internet needed
               ┌────────────┴──────────────────┐
          Student browsers (kiosk)         Invigilator PC
```

The cloud remains the only source of truth and grading authority. The hub is a storage + transport + rendering node: it never grades, never shows scores, never edits.

## 4. Shared rendering module

### 4.1 Location and import wiring

Repo-root `shared/exam-rendering/` contains TypeScript + React sources compiled directly by both consumers:

- App `tsconfig.json` gains `paths: { "@exam-rendering/*": ["../../shared/exam-rendering/*"] }`.
- Hub `vite.config.ts` gains `resolve.alias` `@exam-rendering` → `../shared/exam-rendering`.
- No npm workspaces; no separate build/publish step for the module.

### 4.2 Files and responsibilities

| File | Responsibility |
|---|---|
| `types.ts` | `Question`, `AnswerValue`, `AttemptData`, `ExamTakingAdapters` types |
| `exam-taking-core.ts` | Pure, React-free logic: `buildAnswerList`, `remainingFromEndsAt`, `shouldAutoSubmit`, `applyQuestionOrder`, `applyOptionOrder`, group-aware shuffle builder (mirrors online `startExamAction` semantics) |
| `use-exam-taking.ts` | Headless React hook: answers/essayParts/remaining/submitted/confirming/msg/starting/currentIndex/skipped/autoSaving/fullscreen/attemptId; 1s countdown from `endsAt`; optional `tick` re-anchor; autosave scheduling; expiry auto-submit; start/submit handlers |
| `exam-taking-view.tsx` | Presentational JSX (refactored from the current online view markup) consuming the hook |
| `exam-tokens.css` | The `@theme inline` token block + component utility classes extracted from `src/app/globals.css`, shared by both builds |

### 4.3 Adapter interface

```ts
interface ExamTakingAdapters {
  start?(): Promise<{ attemptId: string; endsAt: string; shuffledQuestionIds?: string[]; shuffledOptionOrder?: Record<string, string[]> }>;
  tick?(attemptId: string): Promise<{ remainingSeconds: number; expired?: boolean }>;
  autoSave(attemptId: string, answers: AnswerValue[]): Promise<void>;
  submit(attemptId: string, answers: AnswerValue[]): Promise<void>;
}
```

- **Online page** passes server-action-backed adapters and **no** `tick` → identical local countdown behavior to today. Score-less online submit fix stays deferred (Phase 3).
- **Hub SPA** passes fetch-backed adapters and a `tick` adapter.

### 4.4 Online view refactor

`src/app/(app)/exams/take/exam-taking-view.tsx` becomes a thin wrapper importing the shared view and passing server-action adapters (`startExamAction`, `submitExamAction`, `autoSaveExamAction`) plus the props it already receives. Behavior-preserving: 30s autosave, kiosk effects, submitted screen unchanged.

## 5. Hub server

### 5.1 DB changes (`hub/src/db.ts`)

- `bundles` gains `session_open INTEGER NOT NULL DEFAULT 0`.
- New table `signin_locks (bundle_id TEXT, admission_number TEXT, failures INTEGER, locked_until TEXT, PRIMARY KEY (bundle_id, admission_number))`.
- New `Db` methods:
  - `setSessionOpen(bundleId, open)`
  - `getOpenBundles()` — bundles with `session_open = 1`
  - `getAttemptByStudent(bundleId, studentId)` — latest `in_progress` attempt for resume
  - `upsertAnswer({ attemptId, questionId, mcqSelectedOptionId?, essayResponseText?, clientTimestamp, localChecksum })`
  - `markAttemptSubmitted(attemptId, submittedAt)`
  - `getSigninLock(bundleId, admissionNumber)`, `recordSigninFailure(bundleId, admissionNumber)`, `clearSigninLock(bundleId, admissionNumber)`
  - `touchLastAutosave(attemptId)` (also add `last_autosave_at TEXT` to `attempts`; used by live room later, harmless now)

### 5.2 Pure logic module (`hub/src/exam-taking.ts`)

Express handlers stay thin; all behavior lives in pure functions over the `Db` so they are unit-testable without HTTP:

- `verifyPin(db, bundleId, admissionNumber, pin)` — session OPEN check, roster + PIN lookup against the decrypted bundle payload, lockout enforcement; returns student + exam info + questions, or typed error.
- `startAttempt(db, bundleId, studentId, durationMinutes, shuffleEnabled, questions)` — creates attempt with `endsAt`, generates + persists shuffle when enabled; returns existing `in_progress` attempt if present.
- `saveAnswers(db, attemptId, answers, clientTimestamps, signingSecret)` — upserts answer rows with hub-computed `localChecksum`.
- `tickAttempt(db, attemptId, signingSecret)` — computes `remainingSeconds` from `endsAt`; if expired, marks submitted and records current answers; returns `{ remainingSeconds, expired }`.
- `submitAttempt(db, attemptId, answers, signingSecret)` — idempotent first-submission-wins; marks `status='submitted'`, sets `submittedAt`.

### 5.3 Endpoints

| Endpoint | Behavior |
|---|---|
| `POST /api/sign-in` `{ bundleId, admissionNumber, pin }` | Verify session OPEN + roster/PIN + lockout. Returns `{ student, exam, questions, attempt \| null }`. Existing `in_progress` attempt → resume (includes saved answers, stored order, `endsAt`). |
| `POST /api/attempts/start` `{ bundleId, studentId }` | Create attempt (`endsAt = now + duration`; shuffle persisted when enabled) or return existing `in_progress`. |
| `POST /api/attempts/:id/autosave` | Upsert answers with browser `clientTimestamp` + hub-computed checksum; `touchLastAutosave`. |
| `POST /api/attempts/:id/tick` | Return `{ remainingSeconds, expired }`; if expired, hub marks submitted. On receiving `expired: true`, the client flushes its in-memory answers via `submit` (idempotent) so nothing the student answered since the last autosave is lost; the hub records whatever answers exist either way. |
| `POST /api/attempts/:id/submit` | Idempotent; mark submitted. |
| `POST /api/admin/session/open` / `close` `{ bundleId }` | Set `session_open`; gated by invigilator code. |
| `GET /api/admin/sessions` | List bundles + open state + expiry; gated by invigilator code. |

### 5.4 Invigilator auth

`hub/config.json` / `config.example.json` and `getConfig()` gain `invigilatorCode` (delivered at registration; cloud already stores `invigilatorCodeHash`). Admin endpoints verify it (constant-time compare). Student endpoints are unauthenticated beyond the PIN flow.

### 5.5 Serving

Express serves the built Vite SPA from `hub/dist/client` with an SPA fallback for non-`/api` GETs. `/health` and `/admin/status` remain.

### 5.6 Existing-code fix

`hub/src/db.ts` `getLocalOnlyAttempts` must filter to `status = 'submitted'` (via the query used by `sync.ts`) so in-progress attempts are never uploaded mid-exam.

## 6. Hub SPA

### 6.1 Stack and files

- New dev deps in `hub/`: `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/vite`; existing `tsx`, `typescript` reused.
- `hub/vite.config.ts`, `hub/index.html`, `hub/src/client/main.tsx`, `hub/src/client/main.css` (`@import "tailwindcss"` + shared `exam-tokens.css`).
- Scripts: `"build": "vite build"`, `"test": "vitest run"`; `start` serves API + static.

### 6.2 Views (path switch in one root; no router lib)

- **`/`** — student flow: pick an OPEN session → admission + PIN → Start screen → `ExamTakingView` with fetch adapters → score-less "Submitted" screen.
- **`/admin`** — minimal invigilator: enter invigilator code → list bundles with Open/Close buttons + status. No live-room roster in this slice.

### 6.3 Networking

SPA API calls are relative to the hub origin (same host), so no CORS/cross-origin handling.

## 7. Testing

- `hub/src/exam-taking.test.ts` (vitest, temp-file SQLite): PIN verify success/wrong/lockout; session open/close gating; shuffle persistence + resume identity (same attempt, same order, same remaining); autosave insert + checksum parity with cloud `answerChecksum`; tick expiry auto-submit; submit idempotency (first wins).
- `shared/exam-rendering/exam-taking-core.test.ts` (runs in app's existing vitest): `buildAnswerList` parts-joining, `remainingFromEndsAt`, `shouldAutoSubmit`, group-aware shuffle semantics.
- Regression gate: app offline suite (`npx vitest run src/lib/offline`), `npx tsc --noEmit`. `npm run build` hangs at page-data collection in this env — pre-existing; `tsc` is authoritative.

## 8. Edge cases (in-slice)

| Case | Behavior |
|---|---|
| Student device drops off LAN | Last autosave stands; reconnect to hub + PIN → resume same attempt (stored order, answers, `endsAt`). |
| Hub dies mid-exam | SQLite WAL; restart reopens same session; students resume; remaining time preserved from stored `endsAt`. |
| Timer expires | `tick` marks attempt submitted; last autosave + current answers recorded; unanswered = zero. |
| PIN brute force | 5 wrong → 2-min lockout per (bundle, admission), persisted in `signin_locks`. |
| Partial / duplicate submit | First full submission wins; later identical payloads no-op. |
| In-progress sync | Only `status='submitted'` attempts upload. |
| Two hubs at one school | Attempts keyed by `(hubId, hubAttemptId)`; distinct secrets per hub (existing Phase 1 guarantee). |
| Hub clock skew | Durations hub-relative; cloud audits only `receivedAt` (existing). |

## 9. Out of scope (this slice)

- Live-room roster console (seated/in-progress/submitted/stall flags) — separate later slice
- USB import/export fallback — Phase 4
- Scheduled start/end window enforcement on hub
- Online score-less submit fix — Phase 3
- MCQ server-grading on ingest, flag handling, "offline synced" badge — Phase 3
- Resit/absent handling — stays in cloud flow

## 10. Build phasing (of this slice)

1. Shared module extraction + online view refactor (behavior-preserving).
2. Hub DB changes + pure exam-taking logic + endpoints + sync filter fix.
3. Hub SPA (student flow + minimal admin) + Vite build wiring.
4. Hub vitest suite + shared-module tests.
5. Full verification (offline suite, tsc).
