# Teacher "My Lesson Notes" + "My Exams" Submenus — Design

Date: 2026-08-15

## Problem

Teachers can generate lesson notes but cannot see the notes they generated. They also have no
sidebar links at all to the Question Bank (`/questions`) or Exams (`/exams`) pages, even though
both pages already open to teachers and are scoped to their subjects/classes.

### Root cause of the "can't see notes" bug

`src/app/(app)/lesson-notes/actions.ts` stores `createdBy: ctx.user.userId` (the `User.id`),
but the lesson-notes list page filters by `createdBy: user.staffId` (the `Staff.id`). These are
different identifiers, so a teacher's own notes never match the page query and never render.

Exams already do this correctly — `src/lib/exams/actions.ts` stores `createdBy: ctx.user.staffId`.

## Goals

1. Fix the `createdBy` mismatch so teachers can see the notes they generated.
2. Restructure the **Lesson Notes** nav into a parent menu with **Generate** and **My Lesson Notes**.
3. Add an **Assessments** nav group for teachers with **My Question Bank** and **My Exams** links.

## Design

### 1. Fix `createdBy` in lesson-notes actions

In `src/app/(app)/lesson-notes/actions.ts`:

- `createLessonNoteAction` — change `createdBy: ctx.user.userId` → `createdBy: ctx.user.staffId`.
- `aiGenerateNoteAction` — same change.

This matches the schema comment (`createdBy String // staff id`) and the exam precedent.

### 2. New `/lesson-notes/mine` page

New server component `src/app/(app)/lesson-notes/mine/page.tsx`:

- Auth: `getCurrentUser()` → redirect to `/login` if missing; require school staff
  (same check as the existing lesson-notes page: admin OR has subject/class/HoD assignments).
- Query lesson notes:
  - Admins (`canManageSchool`): all notes in the school (same as existing `/lesson-notes`).
  - Teachers: `createdBy: user.staffId` (their own notes).
- Include `subject`, `class`, `term` names; map to the same `NoteVM` shape used by
  `LessonNotesList`.
- Render the existing `LessonNotesList` client component (no class/subject filter — a clean
  list of their notes with view / edit / publish / delete / export already built in).
- Heading: "My Lesson Notes".

### 3. Nav restructure in `src/lib/nav.ts`

**Teachers** (generic staff branch, `subjectTeacherSubjectIds.size > 0`):

Replace the flat `{ label: "Lesson Notes", href: "/lesson-notes", icon: "note" }` with a parent:

```ts
{ label: "Lesson Notes", icon: "note", children: [
  { label: "Generate", href: "/lesson-notes", icon: "note_add" },
  { label: "My Lesson Notes", href: "/lesson-notes/mine", icon: "note" },
]}
```

Add an **Assessments** group after the Lesson Notes/Period Tracker/Curriculum Tracker links:

```ts
{ label: "Assessments", icon: "quiz", children: [
  { label: "My Question Bank", href: "/questions", icon: "quiz" },
  { label: "My Exams", href: "/exams", icon: "assignment" },
]}
```

**Admins** (admin branch, Teaching Resources group): change the flat `Lesson Notes` item to the
same parent submenu (Generate + My Lesson Notes). The sidebar already supports 2-level nesting
(`sidebar-nav.tsx` `nested` prop), so this renders correctly.

No change to admin Assessments group — admins already have Assessment Weights / Exams / Essay
Grading. `My Question Bank` and `My Exams` map to existing `/questions` and `/exams` pages
(no new pages for the assessments side).

### 4. Existing pages reused (no changes)

- `/questions` (`src/app/(app)/questions/page.tsx`) already opens to teachers and scopes
  questions/subjects to their visible subjects; supports create, AI-generate, approve, reject,
  edit, delete, CSV import.
- `/exams` (`src/app/(app)/exams/page.tsx`) already opens to teachers and scopes exams to their
  subjects/classes/created-by; supports create, edit, manage questions, submit for review.
- `/lesson-notes` keeps the generator form AND the list below it (unchanged behavior);
  `/lesson-notes/mine` is the dedicated clean list.

## Out of scope

- No new DB schema / migrations.
- No changes to permissions or guards (`requireSchoolStaff`, `canAccessSubject`,
  `canAccessClass` already exist).
- Exam review/approval workflow unchanged (teacher creates, admin/form master submits,
  exam officer approves/rejects).
- The student-facing `/my-exams` page (student exam-taking) is unrelated and unchanged.

## Verification

- `npx tsc --noEmit` (exit 0)
- `npx vitest run` (81 tests pass)
- Manual: teacher logs in → Lesson Notes parent has Generate + My Lesson Notes; My Lesson Notes
  lists only their generated notes; Assessments group shows My Question Bank + My Exams.