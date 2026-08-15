# Spec: Teacher Access to Exam Grading

**Date:** 2026-08-15
**Status:** Approved

## Problem

Teachers can set exams, but they cannot grade them. Two gaps block the grading
workflow for anyone who is not an admin or exam officer:

1. **No navigation entry.** The "Essay Grading" page (`/essay-grading`) already
   permits teachers (`isTeacher` check at `essay-grading/page.tsx:11`), but the
   teacher sidebar (`src/lib/nav.ts` generic-staff branch) never links to it.
2. **Manual score entry is admin-only.** The exam detail page
   (`src/app/(app)/exams/[id]/page.tsx:16`) is gated to
   `canManageSchool || canReviewExams`, and its save action
   `upsertManualScoresAction` (`src/lib/exams/actions.ts:659`) uses
   `requireSchoolAdmin()`. A teacher who sets an exam cannot open it or save
   scores.

The teacher "My Exams" list (`/exams`) already scopes to the teacher's own exams
(`createdBy: user.staffId`) and links each exam to `/exams/[id]`, but that link
is blocked today.

## Goal

Let a teacher grade the exams they set:

- **Manual score entry** (practical / offline theory / objective papers, and
  platform-score overrides) via the `ScoreEntryTable` on the exam detail page.
- **AI essay grading review** via the `Essay Grading` page.

Access is scoped: a teacher sees and grades only exams they are entitled to
(their own created exams, plus exams for subjects/classes they teach or head).

## Approach

### 1. Sidebar nav (`src/lib/nav.ts`)

In the generic-staff branch `Assessments` parent (around line 129), add an
`Essay Grading` child:

```ts
{ label: "Essay Grading", href: "/essay-grading", icon: "rate_review" }
```

Manual score entry is reached by opening the exam from "My Exams" → exam detail.

### 2. Exam detail page (`src/app/(app)/exams/[id]/page.tsx`)

- Add an `isTeacher` constant (subject/class/HoD assignments), mirroring the
  pattern used elsewhere (`exams/page.tsx:16`, `essay-grading/page.tsx:11`).
- Relax the gate at line 16 so teachers are admitted:
  `if ((!canManageSchool(perms) && !canReviewExams(perms) && !isTeacher) || !user.schoolId)`.
- After the exam is fetched, enforce scope for non-admin/non-officer callers:
  the exam must be within the teacher's `visibleSubjectIds` / `visibleClassIds`
  or be `createdBy: user.staffId`; otherwise `notFound()`.
- The existing `isOfficer` branch (line 90) stays admin/officer-only (question
  review). Non-officers already fall through to `ScoreEntryTable` (line 234),
  which is exactly the teacher grading UI.

### 3. Save action (`src/lib/exams/actions.ts`)

- `upsertManualScoresAction` (line 654): change `requireSchoolAdmin()` to
  `requireSchoolStaff()` (permits teachers) and add the same exam-scope check
  used by the page before mutating.
- `getExamManualScoresAction` (line 715) and `getExamStudentsAction`
  (line 731): relax `requireSchoolAdmin()` → `requireSchoolStaff()` for
  consistency (these are "fetch my exam's data" actions a grading teacher may
  need; currently unused on the web side but clearly teacher-scoped).

### 4. Verification

- `npx tsc --noEmit` exits 0.
- `npx vitest run` — 81 tests pass.
- Manual reasoning: a teacher opening "My Exams" → an exam they set now reaches
  the `ScoreEntryTable`; saving calls `upsertManualScoresAction` which now
  accepts `requireSchoolStaff` and passes the scope check. "Essay Grading"
  appears under Assessments and lists their essay-pending exams.

## Out of scope

- Exam review/approval (still officer/admin only) — no change to `canReviewExams`.
- Result computation from scores — unchanged.
- Offline hub (`hub/*`) grading — separate codebase; the relaxed getters help
  but hub wiring is not part of this change.
- Reusing the single `isTeacher` predicate across pages (tracked as a follow-up
  from the prior branch review).

## Files touched

- `src/lib/nav.ts`
- `src/app/(app)/exams/[id]/page.tsx`
- `src/lib/exams/actions.ts`
