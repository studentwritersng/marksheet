# Parent Academic Hub — Design Spec

**Date:** 2026-08-27
**Status:** Approved (design)
**Author:** opencode (with user)

## 1. Overview

Add a single parent-facing "Academic hub" page at `/parent/results` that aggregates, across all of a parent's wards, the **published results**, **homework**, and **exams/assessments** they are entitled to see. Parents can filter by ward and term, and each item links through to its existing detail view.

This complements (and does not replace) the existing per-ward page at `/parent/ward/[studentId]`, which already shows scores and a "View Report Card" link.

## 2. Goals

- Give parents one place to see all published academic activity for their children.
- Show scores (not just an index): result averages/positions, CA + exam component marks, homework scores, and exam marks.
- Keep navigation simple: a single new "Results" nav entry for the parent role.

## 3. Non-goals

- No new database tables or schema migrations.
- No changes to how results/homework/exams are published (existing publish flows stay).
- No restructuring of the existing per-ward page.
- No teacher/admin functionality changes.

## 4. Navigation

Add a `Results` item to the parent branch in `src/lib/nav.ts` (currently lines ~98–104):

```ts
{ label: "Results", href: "/parent/results", icon: "analytics" }
```

Keep the existing `My Wards` (`/parent`) entry.

## 5. Route & Page

- New file: `src/app/(app)/parent/results/page.tsx`
- Server component, guarded with `requireRole(["parent"])`.
- Reads `searchParams` for the active `wardId` / `termId` filter (optional; client filtering is also acceptable). Default: all wards, most recent term.

## 6. Data Sources (no new schema)

| Category | Source | Published meaning |
|----------|--------|------------------|
| Results | `TermResult` (`status: "finalised"`) + `SubjectResult` (`totalScore`, `grade`, `subjectPosition`, `assessmentScores` JSON) | `finalised` = published (set by `results/actions.ts` publish flow) |
| Homework | `Homework` (`status: "published"`) for the ward's class+term, joined to `HomeworkAttempt` (per student: `status`, `totalScore`, `percentage`, `published`) | `Homework.status === "published"` |
| Exams | `Exam` (`status: "published"`) linked to the ward's class via `ExamClass`, term-scoped | `Exam.status === "published"`; marks read from `SubjectResult.assessmentScores` exam component |

`SubjectResult.assessmentScores` is a JSON object of the form `{ raw, weight, weighted }` per assessment type — it already contains both continuous-assessment and exam components. This is the single source for "scores" in the hub.

## 7. Data Access (new server function)

New module, e.g. `src/app/(app)/parent/results/actions.ts`:

- **Ward resolution:** reuse the existing guardian-scoped ward fetch already used by `src/app/(app)/parent/page.tsx` so the parent can only ever query their own wards. All subsequent queries are filtered by those `studentId`s.
- For the selected ward(s) + term:
  1. Fetch finalised `TermResult`s (with `term` + `session`) and their `SubjectResult`s.
  2. Fetch published `Homework` for each ward's `classId` + `termId`, with the ward's `HomeworkAttempt`.
  3. Fetch published `Exam`s for each ward's `classId` + `termId` (via `ExamClass`), and pull the exam mark from the matching `SubjectResult.assessmentScores`.
- Return a typed aggregate shaped for rendering (grouped by ward → term).

## 8. UI / Components

- **Filter bar:** ward `<select>` + term `<select>`. Filtering is client-side over the already-fetched (small) dataset for instant response; the server still does the secure scoping.
- **Published Results section:**
  - Per ward → per term card: overall average, position, teacher/principal comments.
  - Expandable subject list: subject name, `totalScore`, `grade`, `subjectPosition`, and the CA + exam component marks from `assessmentScores`.
  - "View Report Card" link → `/results/[studentId]?termId=…` (already parent-accessible via guardian check).
- **Homework section:** published homework for the ward's class: title, subject, due date, the ward's submission status (submitted/pending), and score/percentage when `HomeworkAttempt.published`. Link → `/homework/[id]`.
- **Exams section:** published exams for the ward's class: subject, assessment type, and the exam mark (from `SubjectResult.assessmentScores`). Link to the report card (and to `/exams/[id]` only if a parent-accessible view exists).
- Per-section **empty states** ("No published results yet", etc.).
- Visual style follows the existing `(app)` design tokens (surface containers, `FeeStatusBadge`-style chips where useful).

## 9. Security

- Every query is scoped to the parent's wards via the reused guardian fetch. A parent cannot read another student's records.
- Server-side `requireRole(["parent"])` guard on the page.
- No client-exposed raw student ids beyond the parent's own wards.

## 10. Reuse

- Ward resolution: existing logic in `src/app/(app)/parent/page.tsx`.
- Report card: existing `/results/[studentId]` (parent guardian check already present).
- Published homework view: existing `/homework/[id]` (gated on `status === "published"`).
- Design tokens / chip styling already used across `(app)`.

## 11. Open Questions

- **Exam deep-link:** Parent access to a standalone `/exams/[id]` page may be restricted. Default behavior: show exam marks inline in the Exams section and link to the report card; only deep-link to `/exams/[id]` if a parent view exists. Confirm during implementation.
- **Filter mechanism:** Server `searchParams` vs client filter — default to client filter over fetched data; switch to `searchParams` if data volume warrants.

## 12. Verification

- `npx tsc --noEmit` passes (note: `next.config.ts` has a pre-existing harmless `eslint` type quirk — not introduced by this work).
- Manual verification on the deployed app (Neon DB reachable only via Vercel; local Prisma cannot reach Neon due to DNS).
- Sanity: a parent sees only their wards; published (finalised) results appear; homework/exam scores render; empty states show when nothing is published.
