# Teacher "My Lesson Notes" + "My Exams" Submenus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the lesson-note `createdBy` mismatch so teachers can see their own notes, add a new `/lesson-notes/mine` page, and restructure the sidebar nav (Lesson Notes parent menu + teacher Assessments group).

**Architecture:** Three isolated changes — (1) two one-line fixes in lesson-notes actions storing `staffId` instead of `userId`; (2) a new server-component page reusing the existing `LessonNotesList` client component; (3) nav tree changes in `src/lib/nav.ts`. No schema, no new permissions, no changes to the questions/exams pages.

**Tech Stack:** Next.js App Router (server components + `"use client"` lists), Prisma, TypeScript, Material Symbols icons.

## Global Constraints

- Shell is PowerShell on Windows: use `;` not `&&`; quote git paths containing `(app)` (e.g. `git add "src/app/(app)/lesson-notes/actions.ts"`).
- Session payload: `user.staffId` is the Staff.id, `user.userId` is the User.id — they differ. Store `staffId` in any `createdBy` column.
- No new dependencies. No schema/migration changes.
- Follow existing code style — no comments unless matching surrounding style.
- Verify with `npx tsc --noEmit` (exit 0) and `npx vitest run` (81 tests) from workdir `C:\Users\Teta\Downloads\teta-exam\marksheet`.
- Commit only the task's files; do NOT stage pre-existing unrelated dirt (`hub/*`, `error.log`, `build_error.log`, `importError.txt`, `docs/youtube-content-plan-2026-08-12.md`, `docs/superpowers/plans/2026-08-12-ai-rate-limiting.md`).

---

### Task 1: Fix `createdBy` in lesson-notes actions

**Files:**
- Modify: `src/app/(app)/lesson-notes/actions.ts` (two lines: ~65 and ~344)

**Interfaces:**
- Produces: `createLessonNoteAction(_prev, formData): Promise<ActionState>` and `aiGenerateNoteAction(_prev, formData): Promise<ActionState>` both now persist `createdBy` as the staff id.

- [ ] **Step 1: Change `createLessonNoteAction`'s `createdBy`**

In `src/app/(app)/lesson-notes/actions.ts`, inside the `prisma.lessonNote.create` of `createLessonNoteAction`, change:
```ts
      createdBy: ctx.user.userId,
```
to:
```ts
      createdBy: ctx.user.staffId,
```

- [ ] **Step 2: Change `aiGenerateNoteAction`'s `createdBy`**

In the same file, inside the `prisma.lessonNote.create` of `aiGenerateNoteAction`, change:
```ts
      createdBy: ctx.user.userId,
```
to:
```ts
      createdBy: ctx.user.staffId,
```

- [ ] **Step 3: Typecheck**

Run (workdir `C:\Users\Teta\Downloads\teta-exam\marksheet`):
```
npx tsc --noEmit; Write-Host "tsc exit: $LASTEXITCODE"
```
Expected: exit 0. Note: `ctx.user.staffId` is `string | null`; `LessonNote.createdBy` is `String` (required). If tsc errors on the null union, wrap with `ctx.user.staffId ?? ""` (same pattern the lesson-notes page already uses: `user.staffId ?? ""`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: 81 passed.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(app)/lesson-notes/actions.ts"
git commit -m "fix: store staff id as lesson note creator so teachers can see their own notes"
```

---

### Task 2: Create `/lesson-notes/mine` page

**Files:**
- Create: `src/app/(app)/lesson-notes/mine/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()` from `@/lib/auth/current-user`; `resolvePermissions`, `canManageSchool` from `@/lib/auth/permissions`; `prisma` from `@/lib/prisma`; `LessonNotesList` (default export, `NoteVM[]` prop) from `../lesson-notes-list`.
- Produces: page at route `/lesson-notes/mine` that renders `LessonNotesList` with notes filtered to the current staff (teachers) or all notes (admins).

- [ ] **Step 1: Create the page file**

Create `src/app/(app)/lesson-notes/mine/page.tsx` with exactly this content:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { LessonNotesList } from "../lesson-notes-list";

export default async function MyLessonNotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const isTeacher =
    perms.subjectTeacherSubjectIds.size > 0 ||
    perms.classTeacherClassIds.size > 0 ||
    perms.hodSubjectIds.size > 0;
  if ((!canManageSchool(perms) && !isTeacher) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const isAdmin = canManageSchool(perms);
  const notes = isAdmin
    ? await prisma.lessonNote.findMany({
        where: { schoolId: user.schoolId },
        include: { subject: { select: { name: true } }, class: { select: { name: true } }, term: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.lessonNote.findMany({
        where: { schoolId: user.schoolId, createdBy: user.staffId ?? "" },
        include: { subject: { select: { name: true } }, class: { select: { name: true } }, term: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });

  const notesData = notes.map((n) => ({
    id: n.id,
    topic: n.topic,
    subject: n.subject.name,
    class: n.class.name,
    term: n.term.name,
    source: n.source,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    previousKnowledge: n.previousKnowledge,
    introduction: n.introduction,
    content: n.content,
    evaluation: n.evaluation,
    summary: n.summary,
    assignment: n.assignment,
    behaviouralObjectives: n.behaviouralObjectives as string[] | null,
  }));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">My Lesson Notes</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        {isAdmin
          ? "All lesson notes in this school."
          : "Lesson notes you created. Publish drafts to make them available for question generation and essay grading."}
      </p>
      <div className="mt-6">
        <LessonNotesList notes={notesData} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit; Write-Host "tsc exit: $LASTEXITCODE"`
Expected: exit 0. `LessonNotesList` expects `{ notes: NoteVM[]; filter?: ListFilter }`; passing only `notes` is valid since `filter` is optional.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: 81 passed.

- [ ] **Step 4: Commit**

```powershell
git add "src/app/(app)/lesson-notes/mine/page.tsx"
git commit -m "feat: add My Lesson Notes page listing teacher's own lesson notes"
```

---

### Task 3: Restructure sidebar nav

**Files:**
- Modify: `src/lib/nav.ts` (teacher branch ~115-119, admin Teaching Resources group ~44-49)

**Interfaces:**
- Consumes: nothing new — `NavItem` type already supports `children`.
- Produces: teacher generic-staff nav gains a `Lesson Notes` parent (children `Generate`, `My Lesson Notes`) and an `Assessments` parent (children `My Question Bank`, `My Exams`); admin Teaching Resources group's `Lesson Notes` item becomes the same parent submenu.

- [ ] **Step 1: Replace the flat teacher "Lesson Notes" item with a parent**

In `src/lib/nav.ts`, in the generic staff branch (`else` block), inside `if (perms.subjectTeacherSubjectIds.size > 0)`, replace:
```ts
      items.push({ label: "Lesson Notes", href: "/lesson-notes", icon: "note" });
```
with:
```ts
      items.push({
        label: "Lesson Notes",
        icon: "note",
        children: [
          { label: "Generate", href: "/lesson-notes", icon: "note_add" },
          { label: "My Lesson Notes", href: "/lesson-notes/mine", icon: "note" },
        ],
      });
```

- [ ] **Step 2: Add the teacher "Assessments" group**

Still inside `if (perms.subjectTeacherSubjectIds.size > 0)`, after the `Curriculum Tracker` push, add:
```ts
      items.push({
        label: "Assessments",
        icon: "quiz",
        children: [
          { label: "My Question Bank", href: "/questions", icon: "quiz" },
          { label: "My Exams", href: "/exams", icon: "assignment" },
        ],
      });
```

- [ ] **Step 3: Convert the admin "Lesson Notes" item to a parent submenu**

In the `admin` branch, inside the `Teaching Resources` group children, replace:
```ts
        { label: "Lesson Notes", href: "/lesson-notes", icon: "note" },
```
with:
```ts
        { label: "Lesson Notes", icon: "note", children: [
          { label: "Generate", href: "/lesson-notes", icon: "note_add" },
          { label: "My Lesson Notes", href: "/lesson-notes/mine", icon: "note" },
        ]},
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit; Write-Host "tsc exit: $LASTEXITCODE"`
Expected: exit 0.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: 81 passed. (There are no nav tests; this guards against regressions.)

- [ ] **Step 6: Commit**

```powershell
git add "src/lib/nav.ts"
git commit -m "feat: add Lesson Notes parent menu and teacher Assessments submenu to sidebar nav"
```

---

### Task 4: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full typecheck + tests**

Run (workdir `C:\Users\Teta\Downloads\teta-exam\marksheet`):
```
npx tsc --noEmit; Write-Host "tsc exit: $LASTEXITCODE"
npx vitest run
```
Expected: tsc exit 0; 81 passed.

- [ ] **Step 2: Confirm commit history**

Run: `git log --oneline -5`
Expected: three new commits on top of `962126f` (design doc).

- [ ] **Step 3: Push (after user confirmation)**

```powershell
git push origin master
```
Expected: output like `master -> master` (red stderr text in PowerShell is cosmetic and not an error).