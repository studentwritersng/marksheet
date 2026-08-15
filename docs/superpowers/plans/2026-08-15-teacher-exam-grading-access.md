# Teacher Access to Exam Grading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher grade the exams they set — both manual score entry (ScoreEntryTable) and AI essay-grading review — by opening the nav + relaxing the two admin-only gates that block them.

**Architecture:** Two surfaces are involved. The essay-grading page already permits teachers but has no nav link. The exam detail page (`/exams/[id]`) and its save action (`upsertManualScoresAction`) are hard-gated to admins/officers. We add the nav link and relax those gates to `requireSchoolStaff()`, adding a shared teacher-scope check (exam's subject/class is in the teacher's visible sets, or the teacher created it) so a teacher only touches their own/assigned exams.

**Tech Stack:** Next.js App Router (server components + server actions), Prisma, Vitest. TypeScript.

## Global Constraints

- No schema or migration changes.
- No new dependencies.
- Do not add code comments.
- Shell is PowerShell on Windows: use `;` not `&&`; quote git paths containing `(app)`, e.g. `git add "src/app/(app)/exams/[id]/page.tsx"`.
- `user.staffId` is the **Staff.id** (`string | null`); `user.userId` is the **User.id** — keep them distinct. `createdBy` columns store `staffId`.
- Verification gate: `npx tsc --noEmit` exits 0; `npx vitest run` passes (currently 81; Task 1 adds 1 nav test → 82).
- Reuse the existing scope idiom from `src/app/(app)/exams/page.tsx` (teacher exam scope = `subjectId in visibleSubjectIds` OR `classId in visibleClassIds` OR `createdBy === staffId`).

---

### Task 1: Add Essay Grading to teacher sidebar nav

**Files:**
- Modify: `src/lib/nav.ts` (generic-staff `Assessments` parent, ~line 129)
- Test: `src/lib/nav.test.ts` (new)

**Interfaces:**
- Consumes: `buildNav(user: SessionPayload, perms: EffectivePermissions, isStudentCaptain?: boolean): NavItem[]` (already exported from `nav.ts`).
- Produces: teacher `Assessments` group whose `children` include `{ label: "Essay Grading", href: "/essay-grading", icon: "rate_review" }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/nav.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildNav } from "./nav";
import type { SessionPayload } from "@/lib/auth/session";
import type { EffectivePermissions } from "@/lib/auth/permissions";

function teacherPayload(): SessionPayload {
  return {
    userId: "user_1",
    role: "staff",
    schoolId: "school_1",
    staffId: "staff_1",
    email: "t@example.com",
    mustChangePassword: false,
  };
}

function teacherPerms(): EffectivePermissions {
  const visibleSubjectIds = new Set(["subj_1"]);
  return {
    isSuperAdmin: false,
    isSchoolAdmin: false,
    isExamOfficer: false,
    isFeeStatusManager: false,
    isReceptionist: false,
    assignments: [],
    subjectTeacherClassIds: new Set(),
    subjectTeacherSubjectIds: new Set(["subj_1"]),
    classTeacherClassIds: new Set(),
    hodSubjectIds: new Set(),
    visibleSubjectIds,
    visibleClassIds: new Set(),
  };
}

describe("buildNav teacher branch", () => {
  it("includes Essay Grading under the Assessments group", () => {
    const nav = buildNav(teacherPayload(), teacherPerms());
    const assessments = nav.find((n) => n.label === "Assessments");
    expect(assessments).toBeDefined();
    const children = assessments!.children ?? [];
    const essay = children.find((c) => c.label === "Essay Grading");
    expect(essay).toBeDefined();
    expect(essay!.href).toBe("/essay-grading");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: FAIL — `essay` is undefined (no Essay Grading child yet).

- [ ] **Step 3: Add the nav entry**

In `src/lib/nav.ts`, inside the generic-staff `Assessments` parent `children` array (after the `My Exams` entry, ~line 134), add:

```ts
          { label: "Essay Grading", href: "/essay-grading", icon: "rate_review" },
```

so the parent reads:

```ts
      items.push({
        label: "Assessments",
        icon: "quiz",
        children: [
          { label: "My Question Bank", href: "/questions", icon: "quiz" },
          { label: "My Exams", href: "/exams", icon: "assignment" },
          { label: "Essay Grading", href: "/essay-grading", icon: "rate_review" },
        ],
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts
git commit -m "feat: add Essay Grading link to teacher Assessments nav"
```

---

### Task 2: Open exam detail page to teachers (scoped)

**Files:**
- Modify: `src/app/(app)/exams/[id]/page.tsx` (gate ~line 16; scope after exam fetch ~line 33)

**Interfaces:**
- Consumes: `canManageSchool(perms)` and `canReviewExams(perms)` (both already imported: `permissions` and `guards`). `user.staffId` from `getCurrentUser()`.
- Produces: a teacher who set/teaches the exam can reach the `ScoreEntryTable`; others get `notFound()`.

- [ ] **Step 1: Add the teacher-scope gate**

Replace the top guard (lines 15-18) with one that also admits teachers and scopes the loaded exam:

```ts
  const isTeacher =
    perms.subjectTeacherSubjectIds.size > 0 ||
    perms.classTeacherClassIds.size > 0 ||
    perms.hodSubjectIds.size > 0;
  if ((!canManageSchool(perms) && !canReviewExams(perms) && !isTeacher) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }
```

- [ ] **Step 2: Scope the fetched exam**

After the existing `const exam = await prisma.exam.findFirst({...});` and the `if (!exam) notFound();` (lines 20-33), add a teacher scope check:

```ts
  const teacherOwnsExam =
    isTeacher &&
    (perms.visibleSubjectIds.has(exam.subjectId) ||
      (exam.classId != null && perms.visibleClassIds.has(exam.classId)) ||
      exam.createdBy === user.staffId);
  if (!canManageSchool(perms) && !canReviewExams(perms) && !teacherOwnsExam) {
    notFound();
  }
```

(The `isOfficer` branch at line 90 already restricts the question-review view to officers/admins; non-officers fall through to `ScoreEntryTable` at line 234 — that is the teacher grading UI, unchanged.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx vitest run`
Expected: all pass (82).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/exams/[id]/page.tsx"
git commit -m "feat: allow teachers to open exams they set for grading"
```

---

### Task 3: Relax save action + getters to school staff (scoped)

**Files:**
- Modify: `src/lib/exams/actions.ts` (`upsertManualScoresAction` ~line 654; `getExamManualScoresAction` ~line 715; `getExamStudentsAction` ~line 731)

**Interfaces:**
- Consumes: `requireSchoolStaff()` (already imported), `canManageSchool`, `canReviewExams` (already imported), `user.staffId`.
- Produces: teachers may save/load manual scores for exams they are entitled to; admins/officers unaffected.

- [ ] **Step 1: Relax `upsertManualScoresAction` and add scope**

Change the guard at line 659:

```ts
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
```

After the existing `const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: ctx.schoolId } }); if (!exam) return { error: "Exam not found." };` (lines 662-663), add:

```ts
  const isTeacher =
    ctx.perms.subjectTeacherSubjectIds.size > 0 ||
    ctx.perms.classTeacherClassIds.size > 0 ||
    ctx.perms.hodSubjectIds.size > 0;
  const teacherOwnsExam =
    isTeacher &&
    (ctx.perms.visibleSubjectIds.has(exam.subjectId) ||
      (exam.classId != null && ctx.perms.visibleClassIds.has(exam.classId)) ||
      exam.createdBy === ctx.user.staffId);
  if (!canManageSchool(ctx.perms) && !canReviewExams(ctx.perms) && !teacherOwnsExam) {
    return { error: "Not authorised to grade this exam." };
  }
```

- [ ] **Step 2: Relax the two getters**

At line 719 (`getExamManualScoresAction`):

```ts
  try { ctx = await requireSchoolStaff(); } catch { return []; }
```

At line 735 (`getExamStudentsAction`):

```ts
  try { ctx = await requireSchoolStaff(); } catch { return []; }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx vitest run`
Expected: all pass (82).

- [ ] **Step 4: Commit**

```bash
git add src/lib/exams/actions.ts
git commit -m "feat: let teachers save and load manual exam scores they are entitled to"
```

---

### Task 4: Final verification

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx vitest run`
Expected: all pass (82).

- [ ] **Step 2: Confirm only intended files changed**

Run: `git status --short`
Expected: clean except this work's commits; pre-existing unrelated dirt (`hub/*`, `error.log`, `build_error.log`, `importError.txt`, youtube doc, `2026-08-12-ai-rate-limiting.md`) left untouched.

- [ ] **Step 3: Report**

Summarize the three commits and the verification result; do NOT push until the user confirms.
