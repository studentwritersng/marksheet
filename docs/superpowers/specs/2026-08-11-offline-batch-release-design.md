# Offline Batch Release — Design

Date: 2026-08-11
Status: Approved

## Problem

Releasing an exam for offline sync is one exam → one hub per action, via the dropdown on the exam detail page. Running a day's batch of exams (e.g., Maths, English, Physics to Hall 1) requires N manual releases. There is also no server-side guard against creating duplicate bundles for the same exam across runs.

## Goal

Add a batch release workflow on the Offline Hubs page that releases many eligible exams to one hub in a single action, with per-exam skip/report semantics.

## Decisions

- **Location**: Offline Hubs page (`/offline-hubs`), a single "Batch release exams" panel above the hub list.
- **Mapping**: One hub, many exams per run.
- **Already-released exams**: Skipped and reported (never re-released, never duplicated).
- **Eligible exams**: Only pre-validated — `offlineStatus: "none"`, `status: "published"`, has questions, has active students in the exam's classes.
- **Panel shape**: Single panel with a hub dropdown, exam checklist, release button, and results summary.
- **Expiry**: Keep the existing fixed 7-day bundle expiry (same as single release). No schema changes.
- **Selection**: Require at least one exam selected and a hub chosen before the button is enabled.
- **Duplicates**: One bundle per exam per run; the `offlineStatus` check prevents cross-run duplicates.
- **Approach**: Dedicated `batchReleaseExamsToHub` server action reusing extracted per-exam release internals.

## Architecture

### Server (`src/lib/offline/actions.ts`)

Extract the bundle-building + persistence body of `releaseExamToHub` (actions.ts:83-160) into a private helper:

```ts
async function releaseSingleExamToHub(examId: string, hub: { id: string; name: string; signingSecret: string }): Promise<void>
```

Behavior preserved from today:
- `fetchExamDataForBundle(examId, hub.schoolId)` builds bundle data.
- Creates `OfflineBundle` + `ExamPin` rows inside one `$transaction`.
- Sets `Exam.offlineStatus = "released"`.
- Bundles use the fixed 7-day expiry.

`releaseExamToHub(examId, hubId)` becomes a thin wrapper: auth check → find active hub → call the helper. The exam-page card keeps working unchanged.

New action:

```ts
export async function batchReleaseExamsToHub(
  hubId: string,
  examIds: string[],
): Promise<OfflineActionResult>
```

Behavior:
1. Auth: `getCurrentUser`, must have `schoolId`; `canManageSchool` or `canReviewExams`, else `Not authorised.`
2. Find active hub: `prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId, status: "active" } })`; missing → `Active hub not found for this school.`
3. Load eligible exams in one query: `prisma.exam.findMany({ where: { id: { in: examIds }, schoolId: user.schoolId, status: "published", offlineStatus: "none" }, include: { subject: { select: { name: true } } } })`.
4. Any requested exam not in the eligible set → `skipped` with reason (`not published`, `already released`, or `not found in this school`).
5. Loop `releaseSingleExamToHub` per eligible exam, `try/catch` each.
6. `revalidatePath("/offline-hubs")` and `revalidatePath(`/exams/${examId}`)` for each released exam.
7. Return `data: { released, skipped, failed }` and a `success` summary line.

Result item shape:

```ts
{ examId: string; title: string }          // released
{ examId: string; title: string; reason: string }  // skipped / failed
```

### Page (`src/app/(app)/offline-hubs/page.tsx`)

Server component fetches and passes to the panel:
- Active hubs (already fetched).
- Eligible exams: `offlineStatus: "none"`, `status: "published"`, with `subject.name`, term label, class names, `examQuestions._count`, and a count of active students whose `currentClassId` is in the exam's class set (matching `fetchExamDataForBundle`, which queries `currentClassId`). Exams with 0 eligible students are excluded from the selectable list.

### UI (`src/components/offline/batch-release-panel.tsx`)

New client component `BatchReleasePanel`:

- Props: `hubs: { id; name }[]`, `exams: { id; subjectName; classNames; termLabel; questionCount; studentCount }[]`.
- State: `hubId`, `Set<examId>` selection, `pending`, `result` (the action's returned data/error).
- Layout: card titled "Batch release exams" above the hub list.
  - Hub dropdown (active hubs only).
  - Exam checklist: checkbox + subject name + classes + term + question/student counts.
  - "Select all eligible" checkbox.
  - **Release to hub** button — disabled until a hub is chosen AND ≥1 exam is checked.
- Pending: button swaps to "Releasing…" and disables (prevents double-submit).
- Results: summary block after the action returns — released (green), skipped/failed (amber/red) with reasons. On full success, clear the checklist; keep skipped/failed visible.
- Empty states: no hubs → link to register one; no eligible exams → "No eligible exams to release".
- Styling: reuses existing design tokens/classes (`bg-surface-container-lowest`, `border-outline-variant`, `rounded-xl`).

## Data Flow

1. Page loads active hubs + eligible exams → panel.
2. User picks hub, checks exams → Release.
3. Panel calls `batchReleaseExamsToHub(hubId, [...selected])`.
4. Action re-validates eligibility server-side, releases per exam, returns results.
5. Panel renders released/skipped/failed. `revalidatePath("/offline-hubs")` refreshes the eligible list.

No schema or API-route changes.

## Error Handling

- Per-exam isolation via `try/catch` in the loop; failures recorded in `failed`, batch continues.
- Server re-checks eligibility so stale client selection is skipped, never duplicated.
- Transaction per exam — no partial bundle for a failing exam.
- Results always returned (even all-failed → `success` + `failed` list). Hard errors only for auth / hub-not-found.
- Batch requires a valid `hubId`; empty/foreign hub → `Active hub not found for this school.`

## Testing

Unit tests in `src/lib/offline/hub-actions.test.ts`:

- Existing `releaseExamToHub` tests stay green after the refactor (regression net).
- New `describe("batchReleaseExamsToHub")`:
  - releases multiple eligible exams to one hub → each gets bundle + pins + `offlineStatus: "released"`; all in `released`
  - skips already-released exams → `skipped`, not re-released
  - skips non-published exams → `skipped`
  - isolates per-exam failure → one throws, others release; failing one in `failed`
  - auth: teacher → `Not authorised.`
  - hub not found / other school → `Active hub not found for this school.`
  - empty exam list → no-op, empty `released`

Verification: full offline suite + `tsc --noEmit`.
