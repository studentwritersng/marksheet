# 06 — Server Actions

## 1. What they are

Server Actions are the **only mutation mechanism** in this app. There is no REST client for writes, no tRPC, no GraphQL. A server action is an `async function` in a file marked `"use server"`, called directly from a client component (usually via `<form action={...}>` with `useActionState`).

## 2. The standard action skeleton

Every action follows the same shape. Reference: `src/lib/exams/actions.ts`.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  // 1. Read fields
  const subjectId = formData.get("subjectId") as string;
  const termId = formData.get("termId") as string;
  // ...

  // 2. Validate presence
  if (!subjectId || !termId) return { error: "Missing required fields." };

  // 3. Verify every referenced entity belongs to the caller's school
  const [subject, term] = await Promise.all([
    prisma.subject.findFirst({ where: { id: subjectId, schoolId: ctx.schoolId }, select: { id: true } }),
    prisma.term.findFirst({ where: { id: termId, session: { schoolId: ctx.schoolId } }, select: { id: true } }),
  ]);
  if (!subject || !term) return { error: "Invalid reference." };

  // 4. Mutate
  const exam = await prisma.exam.create({ data: { ... } });

  // 5. Audit
  await recordAudit({
    actorId: ctx.user.userId,
    action: "create",
    entityType: "exam",
    entityId: exam.id,
    beforeValue: null,
    afterValue: { ... } as never,
  });

  // 6. Revalidate
  revalidatePath("/exams");
  return { success: "Exam created." };
}
```

## 3. Conventions (follow these)

1. **File location**: per-domain `src/lib/<domain>/actions.ts`. Also `src/app/console/(main)/<area>/actions.ts` for console actions.
2. **Always start with a guard** — `requireSchoolAdmin()`, `requireExamReviewer()`, `requirePlatformOwner()`, `requireProprietor()`, or `getCurrentUser()`/`requireUser()`. Wrap in `try/catch` and return `{ error: "..." }` on failure.
3. **Return `ActionState`** `{ error?, success? }`. The signature is `(_prev: ActionState, formData: FormData) => Promise<ActionState>` so it plugs into `useActionState`.
4. **Scope every query** with `ctx.schoolId`. Verify referenced entity IDs belong to the caller's school before use (IDOR defense).
5. **Audit every mutation** via `recordAudit({ actorId, action, entityType, entityId, beforeValue, afterValue })`.
6. **Revalidate** the affected pages with `revalidatePath` (and sometimes `revalidateTag`) so server components refresh.
7. **Return messages**, don't throw — actions must return `{ error }`/`{ success }`, not rely on `redirect()` inside try blocks for expected failures.

## 4. Calling an action from the client

### Using a plain form
```tsx
<form action={createExamAction}>
  <input name="subjectId" ... />
  <button type="submit">Create</button>
</form>
```

### Using `useActionState` (recommended — shows success/error inline)
```tsx
"use client";

import { useActionState } from "react";
import { createExamAction } from "@/lib/exams/actions";

const initialState: ActionState = {};
export function ExamForm() {
  const [state, action, pending] = useActionState(createExamAction, initialState);
  return (
    <form action={action}>
      {/* fields ... */}
      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.success && <p className="text-green-600">{state.success}</p>}
      <button disabled={pending}>Create</button>
    </form>
  );
}
```

### Passing extra data
Use `<input type="hidden" name="..." value="..." />` inside the form, or a `bind`:
```tsx
<form action={updateStatAction.bind(null, statId)}>...</form>
```

## 5. Reading the current user

```ts
import { getCurrentUser } from "@/lib/auth/current-user";
const user = await getCurrentUser();   // SessionPayload | null
```

Guard helpers that return context:
```ts
const ctx = await requireSchoolAdmin(); // { user, perms, schoolId }
```

## 6. Audit logging — `src/lib/audit.ts`

```ts
export async function recordAudit(input: {
  actorId: string;
  action: string;                    // "create" | "update" | "delete" | ...
  entityType: string;
  entityId?: string;
  schoolId?: string;
  beforeValue?: Prisma.InputJsonValue | null;
  afterValue?: Prisma.InputJsonValue | null;
}): Promise<void>;
```

- Writes an immutable `AuditLog` row.
- For JSON snapshots use the repo's `as never` cast (the `Prisma.InputJsonValue` type rejects `Record<string, unknown>`):
  ```ts
  afterValue: { examId: exam.id, count: n } as never,
  ```
- Audit log is viewable at `/audit-log` (school) and `/console/audit` (platform).

## 7. License gating

```ts
import { guardActiveLicense } from "@/lib/license";
try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
```
Call this in actions behind a paid feature. Addon gating lives in `src/lib/addons/check.ts` (`ensureSchoolAddon` style helpers).

## 8. Progressively enhanced forms

This app mixes server components (list/render) with client components (forms). The general pattern for a feature page:

1. **Server page** (`page.tsx`) loads data and renders the list + a `<AddForm />` client component.
2. **Client component** holds the form and calls the action via `useActionState`.
3. **Server action** validates, mutates, audits, revalidates, returns `ActionState`.
4. The revalidated page re-renders server-side with fresh data.

## 9. Example actions across the codebase

| Domain | File | Examples |
|---|---|---|
| Exams | `src/lib/exams/actions.ts` | `createExamAction`, publish, review, `studentAnswerAction` |
| Attendance | `src/lib/attendance/actions.ts` | `takeAttendanceAction`, `scanSignInAction` |
| Timetable | `src/lib/timetable/actions.ts` | save entries, wizard steps |
| Results | `src/lib/results/compute.ts` + page actions | compute/finalise |
| Period tracker | `src/lib/period-tracker/actions.ts` | `markTaughtAction` |
| Class subjects | `src/lib/class-subjects/actions.ts` | link/unlink |
| Notifications | `src/lib/notifications/actions.ts` | `notifyStudents`, provider config |
| Tickets | `src/lib/tickets/actions.ts` | create/reply |
| Console | `src/app/console/(main)/landing-stats/actions.ts` | `updateLandingStatAction` |

## 10. Common mistakes to avoid

- Calling `prisma` directly from a **client** component (server-only). Keep all Prisma access in server components or actions.
- Forgetting `schoolId` scoping → cross-tenant data leak (see [15-security.md](./15-security.md)).
- Using `redirect()` where the action is expected to return state (breaks `useActionState`).
- Throwing instead of returning `{ error }` — uncaught errors surface as 500s.
- Forgetting `revalidatePath` → stale server-rendered UI.
