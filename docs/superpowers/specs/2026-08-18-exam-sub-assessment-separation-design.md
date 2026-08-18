# Exam → Per-Sub-Assessment Separation Design

**Date:** 2026-08-18
**Status:** Approved (design)
**Author:** Marksheet team

## 1. Problem

Today a single `Exam` record holds one combined question bank plus a `subAssessmentWeights`
JSON, and `results/compute.ts` **proportionally splits the one combined raw score** across
OBJ/THEORY by weight. This means OBJ and THEORY are never actually measured independently —
a student strong in THEORY but weak in OBJ gets a blended score. Practical (PRC) is already
manual via `ManualScore`.

Goal: when a parent assessment type has sub-assessments (e.g. OBJ / THEORY / PRC), the
teacher should create **separate exam entities per sub-assessment**, each with its own
question bank, its own timer, and its own attempt. Each sub-exam is graded on its own maximum
and **scaled to its shared (allocated) marks** within the parent. PRC stays manual, entered
through the existing practical scores sheet (`ManualScore`).

## 2. Confirmed decisions

- **Separate sittings:** OBJ, THEORY, PRC each become their own `Exam` (own timer, attempt,
  publish/review, question bank). Student takes them independently.
- **Scale to allocation:** each sub-exam is graded on its own question-bank total, then the
  raw score is scaled to that sub-assessment's allocated marks. e.g. THEORY allocated 60,
  student scores 45/75 on the THEORY bank → contributes `45/75 × 60 = 36` to the 100 total.
- **Backward compatible:** existing single-combined exams keep working via the legacy
  proportional-split path; both paths coexist. No migration of old data.
- **Per-sub-assessment timer:** each sub-assessment has its **own duration** (e.g. OBJ 20 min,
  THEORY 90 min). PRC (manual) has no timer.

## 3. Data model (`prisma/schema.prisma`)

Add to `Exam`:

```prisma
subAssessmentTypeId String? // child AssessmentType id; null = legacy single exam
@@index([subAssessmentTypeId])
```

- `assessmentTypeId` stays = the **parent** assessment type.
- Each child exam stores its own allocation in `subAssessmentWeights` as a single entry:
  `[{ subAssessmentTypeId: childId, weightPercentage: <allocation> }]`.
- Legacy exams keep their multi-entry `subAssessmentWeights` (OBJ+THEORY+PRC) unchanged.
- `ExamClass`, `ExamQuestion`, `ExamAttempt`, `StudentAnswer`, `ManualScore` are unchanged.
- `ManualScore.subAssessmentTypeCode` ("OBJ" | "THEORY" | "PRC") is unchanged and is how PRC
  marks are entered/consumed.

## 4. Create flow (`exams-list.tsx` → `CreateExamForm`)

Top fields: subject, classes, term, parent assessment type. (No single shared duration here
when sub-assessments are present.)

Component section — one row per sub-assessment (child of the selected parent type):

- **Enable checkbox** (default: all enabled).
- **Marks allocation** (editable number, prefilled from the school's assessment weighting for
  that sub-assessment). Validated to sum to the parent total.
- **Duration (minutes)** — per-component, editable, required for platform components (OBJ/THEORY).
  Prefilled with a sensible default (e.g. 20 for OBJ, 90 for THEORY, or the parent's current
  default). PRC row shows "Manual only" and no duration field.
- **Question bank picker** — for OBJ/THEORY only: a topic-grouped multi-select of the subject's
  approved questions (same component as today's single picker, but scoped to that component).
  PRC shows "Manual only — enter scores in practical sheet"; no questions attached.
- PRC child created with **no questions** and `durationMinutes` irrelevant (manual).

Validation: enabled platform allocations must sum to parent total; at least one platform
component required unless the exam is manual-only; each enabled platform component needs ≥1
question and a duration > 0.

`createExamAction` (`src/lib/exams/actions.ts`): instead of one `Exam`, it creates **one
`Exam` per enabled component** (sharing subject/class/term/parent type), each with its own
`questionIds`, `durationMinutes`, `subAssessmentTypeId`, and `subAssessmentWeights` =
`[{ subAssessmentTypeId, weightPercentage }]`. Each starts `status: draft`.

## 5. Exam-taking (`exams/take/*`, offline sync, review/publish)

Unchanged. Each child exam is a normal `Exam`:
- Appears as its own row in the student exam list (OBJ, THEORY separately; PRC not listed for
  taking).
- Own `durationMinutes` drives its own server-side `endsAt` timer.
- Own `ExamAttempt`, grading, offline bundle/sync. Review/approve/publish workflow runs per
  child exam.

## 6. Grading / compute (`src/lib/results/compute.ts`)

Two paths, selected by `exam.subAssessmentTypeId`:

- **Legacy** (`subAssessmentTypeId == null`): existing proportional-split logic unchanged.
- **New** (`subAssessmentTypeId` set):
  - Component code = `AssessmentType.code` of `subAssessmentTypeId` (OBJ/THEORY/PRC).
  - Platform child (OBJ/THEORY): for each attempt, `platformRaw / platformMax × allocation`
    where `platformMax` = sum of marks of that child's own `examQuestions`. Stored under
    `scoreMap[studentId][subjectId][componentCode]`.
  - PRC child: handled by the existing `ManualScore` loop (`subAssessmentTypeCode = "PRC"`),
    scaled `raw / max × PRCallocation`.
  - `allocation` = `weightPercentage` from the child's own `subAssessmentWeights[0]`.
  - Roll-up: all children share the parent `assessmentTypeId` bucket; the existing weighting
    step (lines ~285) is unchanged. Final subject total per parent = sum of OBJ + THEORY + PRC
    contributions (each already in allocated marks).

Manual override (existing): a `ManualScore` for a platform component overrides the platform
contribution for that student.

## 7. Practical scores sheet

Reuse the existing `ManualScore` entry UI (`exams/[id]/score-entry.tsx`) on the PRC child
exam. No new screen. Teacher enters per-student `rawScore` / `maxRawScore` with
`subAssessmentTypeCode = "PRC"`; `compute.ts` scales to the PRC allocation.

## 8. Listing / UX (`exams/page.tsx`, `exams-list.tsx`)

Each child exam is its own row. Label derived as `{Subject} · {AssessmentType} · {COMPONENT}`
(e.g. "Mathematics · Examination · OBJ"). Filtering by subject/class/type unchanged. (Visual
grouping of a parent's children into one collapsible set is explicitly out of scope for v1.)

## 9. Error handling

- Create: allocations sum to parent total; ≥1 platform component (unless manual-only); each
  enabled platform component has ≥1 question and duration > 0; all entities verified to belong
  to the caller's school (existing `requireSchoolStaff` + `canAccessSubject` guards).
- Compute: guard `platformMax > 0` before scaling; manual `max > 0` before scaling; missing
  allocation falls back to school weighting for that sub-assessment.
- Editing an existing child exam: `updateExamAction` already rewrites `subAssessmentWeights`,
  `classes`, etc.; it must also allow updating `durationMinutes` and `subAssessmentTypeId`
  (kept for consistency). Legacy edit path unchanged.

## 10. Testing

- **Unit (`compute.ts`):**
  - New model: OBJ 20 / THEORY 60 / PRC 20; student scores 18/20 OBJ, 45/75 THEORY, PRC 15/20
    manual → expected contributions 18, 36, 15 (total 69 of 100).
  - Manual override of a platform component.
  - PRC-only / platform-only edge cases.
  - **Regression:** legacy single-exam output identical to current behavior (fixture test).
- **Manual E2E:** create a 3-component exam (OBJ 20 min, THEORY 90 min, PRC manual); take OBJ
  and THEORY as separate sittings; enter PRC via practical sheet; verify subject total and
  report-card breakdown.

## 11. Out of scope (v1)

- Visual grouping of a parent's child exams in one card.
- Migrating existing single-combined exams into the new model.
- Changing the review/approve/publish workflow beyond per-child exams.
- New practical-scores UI (reuse `ManualScore`).
