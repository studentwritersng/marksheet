# Offline Exam Sync — Design Spec

**Date:** 2026-08-09
**Status:** Approved (brainstorming sections 1–7 reviewed and approved by user)
**Source PRD:** `06_PRD_exam_delivery_offline_sync.md` (repo root)

---

## 1. Purpose

Enable schools to run fully offline computer-based exams on a local hub server over the school LAN, then sync results back to the online marksheet platform once connectivity returns. Students never see scores — results are visible only after the school publishes them.

## 2. Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Offline architecture | Local hub server on the school LAN (matches PRD 06) |
| Hub packaging/runtime | Node.js + SQLite service the invigilator runs on a PC (`hub start`) |
| Student auth on hub | Per-exam, per-student PIN (generated at release time; hashed on hub) |
| MCQ grading location | **Cloud-only, after sync.** The answer key never leaves the cloud. |
| Score visibility for students | Never. Students only see "Submitted". (Also requires locking down today's online submit-flow MCQ-score display.) |
| Transport | Direct HTTP (hub polls cloud) as the normal path + file-bundle USB fallback, sharing the same bundle format |

## 3. System architecture

```
┌──────────── CLOUD (existing marksheet app, Next.js + Neon Postgres) ─────────┐
│  New "hub" module:                                                            │
│   - hub registry (per school: API key + HMAC signing secret)                  │
│   - bundle builder + "Release to offline hub" action                          │
│   - sync-down API   GET  /api/hub/sync-down                                   │
│   - sync-up ingest  POST /api/hub/sync-up                                     │
│   - console pages to register/revoke hubs and observe sync                    │
│  MCQ grading happens on ingest; result computation unchanged.                 │
└──────────▲──────────────────────────────────────────────▲─────────────────────┘
           │ HTTPS poll/push with hub API key             │ USB file-bundle fallback
┌──────────┴──────────────────────────────────────────────┴─────────────────────┐
│  HUB (per school) — portable Node.js + Express + better-sqlite3               │
│  service on the invigilator PC.                                               │
│   - serves student exam SPA over LAN at http://<hub-ip>:3210                  │
│   - serves invigilator mini-console at http://<hub-ip>:3210/admin             │
│   - SQLite (WAL mode) local store: bundles, roster, PINs, attempts, answers   │
│   - sync engine: pulls released bundles, pushes completed attempts            │
│   - refuses to run exams unless registered against a valid school API key     │
└──────────────────────────▲────────────────────────────────────────────────────┘
                           │ school LAN (WiFi), NO internet needed during exam
             ┌─────────────┴─────────────┬───────────────┐
        Student browser (kiosk)    Student browser    Student browser…
```

The cloud remains the only source of truth. The hub is a **dumb, secure storage + transport** node — no grading, no result publishing, no editing. Anything staff want to fix (mark absent, resit, reassign) happens in the cloud after sync.

## 4. Sync-down: releasing an exam offline

1. Staff open a published exam in the cloud → action **"Release to offline hub"** → pick the school's hub (or all hubs) → exam marked `releasedForOffline`.
2. A **bundle builder** serializes an encrypted bundle:
   - Exam metadata: id, title, durationMinutes, shuffleEnabled, window (scheduled start/end)
   - Questions with options — **`isCorrect` stripped**, model answers and rubric internals excluded entirely
   - Stimuli/groups + `internallyShufflable` flags
   - Student roster for the exam's classes (student id, name, admission no)
   - Per-student, per-exam **PINs** (4–6 digits), generated at release; cloud stores hash-only
   - Manifest: `bundleId`, `examId`, `schoolId`, `schemaVersion`, `issuedAt`, `expiresAt`
3. Encryption: bundle encrypted with a per-bundle key delivered to the school via the console; hub decrypts into SQLite.
4. Transport: hub polls `GET /api/hub/sync-down` with its API key every 60s when internet exists. Fallback: **Download bundle file** in console → USB → "Import bundle file" on the hub admin page.
5. A bundle becomes live on the hub only when an invigilator presses **Open session** (or at a configured start time).
6. A **server-side assertion + automated test** guarantees the serialized bundle contains no answer-key data (`isCorrect`, model answers, rubric internals).
7. PIN regeneration per student is supported (old PIN invalidated). PIN entry is rate-limited on the hub: 5 wrong attempts → 2-min lockout.

## 5. Taking the exam offline on the hub

1. Student opens `http://hub-ip:3210` → hub sign-in page → enters admission number + exam PIN.
2. Hub verifies against its SQLite roster and starts or resumes exactly one attempt.
3. Kiosk-style full-screen exam view. Question rendering mirrors the online taking view (stimulus groups render once with sticky stimulus, `parseSubQuestions`, etc.) via a **shared `shared/exam-rendering` module** imported by both the Next page and the hub SPA.
4. **Timer is hub-enforced:** at start, `endsAt = startedAt + durationMinutes` stored in SQLite; countdown is driven by a hub tick endpoint; expiry auto-submits whatever exists (partial attempts recorded as-is; unanswered = zero).
5. **Shuffle on hub** with the same algorithm as the online flow: item-level shuffle of standalone questions and groups (groups never split; group internal order locked unless `internallyShufflable`), plus per-question MCQ option shuffle. Persisted locally as `shuffledQuestionIds` / `shuffledOptionOrder`; seeded RNG makes resume reconstruct the same order.
6. **Autosave** (every few seconds + on change) writes answer rows to SQLite with `syncStatus = local_only` and an HMAC-SHA256 checksum: `HMAC(hubSecret, attemptId + questionId + answerPayload + browserTimestamp)`. `hubSecret` is per-hub, provisioned at registration; the cloud verifies each checksum on ingest.
7. **Resume:** any device on the LAN, re-enter admission no + PIN → same attempt, same shuffled order, same remaining time, last-autosave answers pre-loaded.
8. Mass simultaneous submits are served idempotently: first full submission wins; later identical payloads are no-ops.
9. UI is **score-less** — "Submitted" confirmation only.

## 6. Sync-up: results back to the cloud

1. Hub posts attempts to `POST /api/hub/sync-up`. Payload per attempt: id (hub-generated), studentId, examId, startedAt, submittedAt, shuffledQuestionIds, shuffledOptionOrder, status; each answer row (questionId, mcqSelectedOptionId | essayResponseText, localChecksum, clientTimestamp); batch manifest (attemptCount, answerCount, batchHash).
2. **Idempotency:** ingest key = `(hubId, hubAttemptId)` with a unique index on `exam_attempts(hubId, hubAttemptId)`. Retries are no-ops; partial batches resume safely.
3. Processing order:
   - Verify each answer's `localChecksum` with the hub's secret → mismatches marked `flagged` (kept for audit, excluded from scoring, staff alerted).
   - Insert `ExamAttempt` + `StudentAnswer` rows with `syncStatus = synced`.
   - Grade MCQs server-side against the cloud answer key (`gradedScore`, `gradingStatus = teacher_reviewed` — same as online path).
   - Essays enter the existing AI-grading pipeline (`ai_pending`).
   - Existing result computation (`computeClassResults`) runs unchanged.
4. Response: per-attempt statuses (`accepted` / `duplicate` / `flagged`); hub marks them `synced` and locks the session read-only.
5. Fallback transport: same bundle format both directions — staff **Export results file** → USB → cloud-side import page.
6. Resits/absences stay in the cloud flow: mark absent in existing UI; create resit (`originalExamId`) which can itself be released to a hub.

**Staff visibility:** exam detail page gets an "Offline sync" card — which hub received it, landed attempts, checksum anomalies, finalized state.

## 7. Invigilator console on the hub

Served at `http://hub-ip:3210/admin` behind a per-hub invigilator code set at registration.

| Page | Purpose |
|---|---|
| Sessions | List downloaded bundles → **Open session** / **Close session** |
| Live room | Roster grid: seated / in progress (last-autosave timestamp) / submitted / reconnecting; stall flag for physical investigation |
| Reseat/reset | Force-close a stale attempt for clean resume; regenerate a student's PIN |
| Sync status | Connection indicator, **Sync now**, counts of `local_only / queued / synced`, checksum-mismatch alerts |
| Import/Export | USB-file fallback both directions |

## 8. Edge cases

| Case | Behavior |
|---|---|
| Hub dies mid-exam | SQLite WAL journaling; restart reopens same session; students resume from last autosave; remaining time preserved from stored `endsAt` |
| Student device drops off LAN | Last autosave stands; reconnect from any device; PIN resume |
| Two hubs at one school | Attempts uniquely keyed by `(hubId, hubAttemptId)`; distinct secrets per hub → no collisions |
| Lost/stolen hub / wrong school | API key + signing secret are school-scoped; revocable from console |
| Hub clock skew | Durations are hub-relative; cloud only audits `receivedAt` |
| Partial batch upload | Idempotent ingest — replay is safe |
| After-hours online taking | An exam released offline is **not** also available online in the same window; release locks online delivery until closed/synced |

## 9. Also changed by this work

- **Online submit flow fix:** today `submitExamAction` returns `Exam submitted. MCQ score: X/Y`. This contradicts the publish-first rule (students must never see scores until school publication). The fix locks the online submit view to a score-less "Submitted" too.

## 10. Build phasing

| Phase | Delivers |
|---|---|
| **1. Hub v0 + sync plumbing** | Hub skeleton (registration, key/secret, SQLite schema), sync-down bundle build + pull endpoint, sync-up ingest (idempotency + checksum), console hub management. Pipeline exercised with a fake exam. |
| **2. Offline exam-taking** | PIN sign-in, shared rendering, kiosk shell, hub timer, autosave, resume, live room. Full end-to-end offline taking. |
| **3. Result grading + publication (cloud)** | MCQ server-grading on ingest, flag handling, "offline synced" badge, score-less online submit fix. |
| **4. Resilience + ops** | USB import/export both directions, hub OTA-update channel, dashboards, rate limiting, full edge-case matrix testing. |

## 11. Testing

- Unit tests: bundle builder asserts no answer-key leak; HMAC verify; ingest idempotency (replay same batch 3× → one record); result computation parity offline vs online.
- Hub tests with embedded SQLite: autosave cadence, resume, timer expiry auto-submit.
- Manual hall drill: 20 devices on hotspot LAN, kill hub mid-exam, kill internet, swap devices, resume all.
- E2E happy path: release → take offline → sync → results visible only after publication.

## 12. Out of scope (YAGNI)

- No offline for anything beside exam taking (no results/CA/lesson notes offline)
- No behavioral proctoring analytics (physical invigilation remains the control)
- No multi-campus cross-hub attempts
- No offline grading of any kind (MCQ grading is server-side only)
