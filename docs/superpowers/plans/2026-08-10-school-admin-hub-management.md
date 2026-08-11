# School-Admin Hub Management + Exam Detail Reachability

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move offline-hub registration/revocation from the platform-owner console to each school's admin (with the console reduced to read-only oversight), tighten the release action's permissions to admins + exam officers, and make the exam detail page reachable from the exams list as "Details".

**Architecture:** Extract the console's hub-management UI into one shared `HubManager` client component with a `mode` prop (`"manage"` vs `"oversight"`). A new school-scoped page at `/offline-hubs` uses manage mode; the existing `/console/offline-hubs` page uses oversight mode. The server actions guard on `canManageSchool(perms)` / `canReviewExams(perms)` instead of `role === "platform_owner"`, scoping all queries to `user.schoolId`.

**Tech Stack:** Next.js 16 server actions + App Router, Prisma/Postgres (Neon), vitest (tests). Uses existing `canManageSchool` / `canReviewExams` helpers from `@/lib/auth/permissions` and `@/lib/auth/guards`.

## Global Constraints

- All hub queries in actions/pages must be scoped to `user.schoolId` — a hub belonging to another school is never visible or mutable.
- Only `canManageSchool` staff may register/revoke hubs; only `canManageSchool || canReviewExams` staff may release an exam to a hub.
- The platform-owner console page (`/console/offline-hubs`) becomes read-only: no register form, no revoke buttons.
- The credential reveal-once pattern (API key / signing secret / invigilator code shown only in the action success payload) is preserved.
- Follow existing file/component conventions: server pages resolve perms with `resolvePermissions(user)` then guard with `canManageSchool(perms) || !user.schoolId` (as in `src/app/(app)/settings/school/page.tsx`).
- Tests run with `npx vitest run <path>`; the `test` script is `vitest run`.

---

### Task 1: Add permission-guard helper tests for hub actions

**Files:**
- Test: `src/lib/offline/hub-actions.test.ts`

**Interfaces:**
- Consumes: `registerHubAction`, `revokeHubAction`, `releaseExamToHub` from `@/lib/offline/actions`; `getCurrentUser` from `@/lib/auth/current-user`; `resolvePermissions` from `@/lib/auth/permissions`; `prisma` from `@/lib/prisma`.
- Produces: A test suite verifying the authorization matrix. Later tasks implement the actions to satisfy these tests.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/offline/hub-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerHubAction, revokeHubAction, releaseExamToHub } from "./actions";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({
  resolvePermissions: vi.fn(),
  canManageSchool: (p: any) => p.isSuperAdmin || p.isSchoolAdmin,
}));
vi.mock("@/lib/auth/guards", () => ({
  canReviewExams: (p: any) => p.isExamOfficer || p.isSchoolAdmin || p.isSuperAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: async (v: string) => `hashed:${v}` } }));
vi.mock("./crypto", () => ({ generateRandomBytes: (n: number) => "x".repeat(n) }));
vi.mock("./bundle", () => ({
  generatePin: () => "123456",
  hashPin: (p: string) => `pin:${p}`,
  serializeBundle: () => "payload",
  fetchExamDataForBundle: async () => ({
    exam: { id: "exam-1", schoolId: "school-1", durationMinutes: 60, shuffleEnabled: false, subjectName: "Maths", classNames: "JSS1", termLabel: "Term 1" },
    questions: [],
    students: [{ id: "stu-1", admissionNumber: "A1", firstName: "Ada", lastName: "Lovelace" }],
  }),
}));

const { prisma } = await import("@/lib/prisma");
const { getCurrentUser } = await import("@/lib/auth/current-user");
const { resolvePermissions } = await import("@/lib/auth/permissions");
const bcrypt = (await import("bcryptjs")).default;

const adminPerms = { isSuperAdmin: false, isSchoolAdmin: true, isExamOfficer: false } as any;
const officerPerms = { isSuperAdmin: false, isSchoolAdmin: false, isExamOfficer: true } as any;
const teacherPerms = { isSuperAdmin: false, isSchoolAdmin: false, isExamOfficer: false } as any;

function makeUser(over: any = {}) {
  return { id: "u1", role: "staff", staffId: "st1", schoolId: "school-1", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  (resolvePermissions as any).mockResolvedValue(adminPerms);
});

describe("registerHubAction", () => {
  it("lets a school admin register a hub for their own school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.school as any) = { findUnique: vi.fn().mockResolvedValue({ id: "school-1" }) };
    (prisma.hub as any) = { create: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1", name: "Hall 1" }) };
    (bcrypt.hash as any) = async (v: string) => `hashed:${v}`;

    const form = new FormData();
    form.set("name", "Hall 1");
    const res = await registerHubAction({} as any, form);

    expect(res.error).toBeUndefined();
    expect(res.success).toContain("Hall 1");
    expect(res.data?.apiKey).toMatch(/^mk_hub_/);
    expect(prisma.hub.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: "school-1", apiKeyHash: expect.stringContaining("hashed:") }),
    }));
  });

  it("rejects a non-admin", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const form = new FormData();
    form.set("name", "Hall 1");
    expect((await registerHubAction({} as any, form)).error).toBe("Not authorised.");
  });

  it("rejects a staff member with no school scope", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser({ schoolId: null }));
    const form = new FormData();
    form.set("name", "Hall 1");
    expect((await registerHubAction({} as any, form)).error).toBe("Not authorised.");
  });
});

describe("revokeHubAction", () => {
  it("lets a school admin revoke one of their own hubs", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1" }),
      update: vi.fn().mockResolvedValue({}),
    };
    const form = new FormData();
    form.set("hubId", "hub-1");
    const res = await revokeHubAction({} as any, form);
    expect(res.success).toBe("Hub revoked.");
    expect(prisma.hub.update).toHaveBeenCalledWith({ where: { id: "hub-1" }, data: { status: "revoked" } });
  });

  it("cannot revoke a hub belonging to another school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    };
    const form = new FormData();
    form.set("hubId", "other-hub");
    const res = await revokeHubAction({} as any, form);
    expect(res.error).toBe("Hub not found.");
    expect(prisma.hub.update).not.toHaveBeenCalled();
  });

  it("rejects a non-admin", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const form = new FormData();
    form.set("hubId", "hub-1");
    expect((await revokeHubAction({} as any, form)).error).toBe("Not authorised.");
  });
});

describe("releaseExamToHub", () => {
  beforeEach(() => {
    (prisma.hub as any) = { findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1", name: "Hall 1", signingSecret: "sec" }) };
    (prisma.offlineBundle as any) = { create: vi.fn().mockResolvedValue({ id: "bundle-1" }) };
    (prisma.examPin as any) = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    (prisma.exam as any) = { update: vi.fn().mockResolvedValue({}) };
    (prisma.$transaction as any) = async (fn: any) => fn(prisma);
  });

  it("lets a school admin release an exam", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await releaseExamToHub("exam-1", "hub-1");
    expect(res.success).toContain("Hall 1");
    expect(prisma.exam.update).toHaveBeenCalledWith({ where: { id: "exam-1" }, data: { offlineStatus: "released" } });
  });

  it("lets an exam officer release an exam", async () => {
    (resolvePermissions as any).mockResolvedValue(officerPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await releaseExamToHub("exam-1", "hub-1");
    expect(res.success).toContain("Hall 1");
  });

  it("rejects a teacher without admin/officer permission", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await releaseExamToHub("exam-1", "hub-1");
    expect(res.error).toBe("Not authorised.");
  });

  it("cannot release to a hub outside the school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await releaseExamToHub("exam-1", "other-hub");
    expect(res.error).toBe("Active hub not found for this school.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/offline/hub-actions.test.ts`
Expected: FAIL — all actions currently throw because they read `formData.get("schoolId")` (removed in the new design) and `user.role !== "platform_owner"` returns "Not authorised." for the admin case.

- [ ] **Step 3: Commit**

```bash
git add src/lib/offline/hub-actions.test.ts
git commit -m "test: authorization matrix for hub actions"
```

---

### Task 2: Rewire hub actions to school-scoped permission guards

**Files:**
- Modify: `src/lib/offline/actions.ts`
- Test: `src/lib/offline/hub-actions.test.ts`

**Interfaces:**
- Consumes: `canManageSchool` from `@/lib/auth/permissions`, `canReviewExams` from `@/lib/auth/guards`, `resolvePermissions` from `@/lib/auth/permissions`.
- Produces: `registerHubAction(_prev, formData)` — requires `canManageSchool` + `user.schoolId`, reads `name` from the form (schoolId comes from session). `revokeHubAction(_prev, formData)` — same guard, verifies hub ownership. `releaseExamToHub(examId, hubId)` — requires `canManageSchool || canReviewExams` + `user.schoolId`.

- [ ] **Step 1: Update the register and revoke actions**

Replace the body of `registerHubAction` (actions.ts:22-56) and `revokeHubAction` (actions.ts:58-71):

```ts
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { canReviewExams } from "@/lib/auth/guards";

export async function registerHubAction(
  _prev: OfflineActionResult,
  formData: FormData,
): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) return { error: "Not authorised." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Hub name is required." };

  const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
  if (!school) return { error: "School not found." };

  const apiKey = `mk_hub_${generateRandomBytes(24)}`;
  const signingSecret = generateRandomBytes(32);
  const invigilatorCode = Math.floor(100000 + Math.random() * 900000).toString();
  const bcrypt = (await import("bcryptjs")).default;

  const hub = await prisma.hub.create({
    data: {
      schoolId: user.schoolId,
      name,
      apiKeyHash: await bcrypt.hash(apiKey, 10),
      signingSecret,
      invigilatorCodeHash: await bcrypt.hash(invigilatorCode, 10),
    },
  });

  revalidatePath("/offline-hubs");
  revalidatePath("/console/offline-hubs");
  return {
    success: `Hub "${name}" registered.`,
    data: { apiKey, signingSecret, invigilatorCode },
  };
}

export async function revokeHubAction(
  _prev: OfflineActionResult,
  formData: FormData,
): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) return { error: "Not authorised." };

  const hubId = (formData.get("hubId") as string)?.trim();
  if (!hubId) return { error: "Hub id is required." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId } });
  if (!hub) return { error: "Hub not found." };

  await prisma.hub.update({ where: { id: hubId }, data: { status: "revoked" } });
  revalidatePath("/offline-hubs");
  revalidatePath("/console/offline-hubs");
  return { success: "Hub revoked." };
}
```

- [ ] **Step 2: Update the release action's guard**

Replace the opening of `releaseExamToHub` (actions.ts:73-78):

```ts
export async function releaseExamToHub(examId: string, hubId: string): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) && !canReviewExams(perms)) return { error: "Not authorised." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId, status: "active" } });
  if (!hub) return { error: "Active hub not found for this school." };
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/hub-actions.test.ts`
Expected: PASS — all cases.

- [ ] **Step 4: Run the existing offline suite to confirm no regressions**

Run: `npx vitest run src/lib/offline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/actions.ts
git commit -m "feat: school-scoped hub management and release permissions"
```

---

### Task 3: Extract shared HubManager component

**Files:**
- Create: `src/components/offline/hub-manager.tsx`
- Delete: `src/app/console/(main)/offline-hubs/offline-hubs-client.tsx` (replaced by the shared component in Task 4)
- Test: none (UI component; covered by manual + page integration in Tasks 4–5)

**Interfaces:**
- Consumes: `registerHubAction`, `revokeHubAction`, `type OfflineActionResult` from `@/lib/offline/actions`.
- Produces: `HubManager({ mode, hubs }: { mode: "manage" | "oversight"; hubs: HubRow[] })` — a client component rendering the hub list and, in `"manage"` mode, the register form (name only) + credential reveal-once block + revoke buttons. `"oversight"` mode is read-only with a school name column. Props are passed from server pages; the actions' `revalidatePath` calls trigger a server re-render so the table auto-refreshes.

- [ ] **Step 1: Write the component**

Create `src/components/offline/hub-manager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registerHubAction, revokeHubAction, type OfflineActionResult } from "@/lib/offline/actions";

const init: OfflineActionResult = {};

type HubRow = {
  id: string;
  name: string;
  schoolName?: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
};

export function HubManager({ mode, hubs }: { mode: "manage" | "oversight"; hubs: HubRow[] }) {
  const [state, action, pending] = useActionState(registerHubAction, init);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeHubAction, init);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Offline Hubs</h1>
        {mode === "manage" ? (
          <p className="text-sm text-gray-500 mt-1">
            Register your exam-hall hub. The API key and signing secret are shown once —
            copy them into the hub&apos;s config.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-1">
            Read-only oversight of every school&apos;s offline hubs.
          </p>
        )}
      </div>

      {mode === "manage" && (
        <form action={action} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <input name="name" required placeholder="e.g. Exam Hall 1" className="rounded-lg border border-gray-300 p-2 text-sm w-full sm:w-1/2" />
          <div>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm px-4 py-2 disabled:opacity-60">
              {pending ? "Registering…" : "Register hub"}
            </button>
          </div>
          {state.error && <p className="text-red-600 text-xs">{state.error}</p>}
          {state.success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-1">
              <p className="text-emerald-700 font-medium">{state.success}</p>
              {state.data?.apiKey && !revealed && (
                <button type="button" onClick={() => setRevealed(true)} className="text-blue-700 underline text-xs">
                  Reveal credentials (shown once)
                </button>
              )}
              {revealed && (
                <div className="text-xs font-mono text-gray-800 space-y-1">
                  <p>API key: {state.data?.apiKey}</p>
                  <p>Signing secret: {state.data?.signingSecret}</p>
                  <p>Invigilator code: {state.data?.invigilatorCode}</p>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
            <tr>
              <th className="p-3">Name</th>
              {mode === "oversight" && <th className="p-3">School</th>}
              <th className="p-3">Status</th>
              <th className="p-3">Last seen</th>
              {mode === "manage" && <th className="p-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hubs.map((h) => (
              <tr key={h.id}>
                <td className="p-3 font-medium">{h.name}</td>
                {mode === "oversight" && <td className="p-3 text-gray-600">{h.schoolName}</td>}
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {h.status}
                  </span>
                </td>
                <td className="p-3 text-gray-500">{h.lastSeenAt ? new Date(h.lastSeenAt).toLocaleString() : "never"}</td>
                {mode === "manage" && (
                  <td className="p-3 text-right">
                    {h.status === "active" && (
                      <form action={revokeAction}>
                        <input type="hidden" name="hubId" value={h.id} />
                        <button type="submit" disabled={revokePending} className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50">
                          Revoke
                        </button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {hubs.length === 0 && (
              <tr><td colSpan={mode === "manage" ? 4 : 3} className="p-4 text-center text-gray-400">No hubs registered yet.</td></tr>
            )}
          </tbody>
        </table>
        {revokeState.error && <p className="p-3 text-red-600 text-xs">{revokeState.error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/offline/hub-manager.tsx
git commit -m "feat: shared HubManager component with manage/oversight modes"
```

---

### Task 4: School admin page + nav + console read-only

**Files:**
- Create: `src/app/(app)/offline-hubs/page.tsx`
- Modify: `src/app/console/(main)/offline-hubs/page.tsx`
- Delete: `src/app/console/(main)/offline-hubs/offline-hubs-client.tsx`
- Modify: `src/lib/nav.ts:73-77`

**Interfaces:**
- Consumes: `HubManager` from `@/components/offline/hub-manager`; `resolvePermissions` + `canManageSchool` from `@/lib/auth/permissions`; `prisma` from `@/lib/prisma`.
- Produces: `/offline-hubs` page (manage mode, school admin only, hubs filtered to `user.schoolId`) and the console page switched to `mode="oversight"` (all hubs, read-only). Nav gains an "Offline Hubs" item (icon `router`) under the admin System group.

- [ ] **Step 1: Create the school admin page**

Create `src/app/(app)/offline-hubs/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { HubManager } from "@/components/offline/hub-manager";

export default async function OfflineHubsPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const hubs = await prisma.hub.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <HubManager
      mode="manage"
      hubs={hubs.map((h) => ({
        id: h.id,
        name: h.name,
        status: h.status,
        lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
    />
  );
}
```

- [ ] **Step 2: Switch the console page to oversight mode**

Replace `src/app/console/(main)/offline-hubs/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { HubManager } from "@/components/offline/hub-manager";

export default async function OfflineHubsConsolePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const hubs = await prisma.hub.findMany({
    orderBy: { createdAt: "desc" },
    include: { school: { select: { name: true } } },
  });

  return (
    <HubManager
      mode="oversight"
      hubs={hubs.map((h) => ({
        id: h.id,
        name: h.name,
        schoolName: h.school.name,
        status: h.status,
        lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
    />
  );
}
```

- [ ] **Step 3: Delete the old console client component**

Delete `src/app/console/(main)/offline-hubs/offline-hubs-client.tsx` (no longer referenced).

- [ ] **Step 4: Add the nav item for school admins**

In `src/lib/nav.ts`, inside the admin `System` children array (lines 73-77), add:

```ts
{ label: "Offline Hubs", href: "/offline-hubs", icon: "router" },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/offline-hubs/page.tsx" "src/app/console/(main)/offline-hubs/page.tsx" src/lib/nav.ts
git rm "src/app/console/(main)/offline-hubs/offline-hubs-client.tsx"
git commit -m "feat: school-admin offline hubs page; console oversight mode"
```

---

### Task 5: Exam detail reachability from exams list

**Files:**
- Modify: `src/app/(app)/exams/exams-list.tsx:236-237`
- Modify: `src/app/(app)/exams/[id]/offline-sync-card.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: The `canPublish` action link label changes from "Scores" to "Details". The offline-sync card's empty-hub message links to `/offline-hubs`.

- [ ] **Step 1: Rename the link**

In `src/app/(app)/exams/exams-list.tsx` line 237, change:

```tsx
<a href={`/exams/${exam.id}`}
  className="text-primary font-label-sm text-label-sm hover:underline">Details</a>
```

- [ ] **Step 2: Link the empty-hub message to hub management**

In `src/app/(app)/exams/[id]/offline-sync-card.tsx`, replace the empty-hub paragraph (lines 52-56) with:

```tsx
{offlineStatus === "none" && hubs.length === 0 && (
  <p className="font-body-sm text-body-sm text-on-surface-variant">
    No active hubs for this school.{" "}
    <a href="/offline-hubs" className="text-primary underline">Register a hub</a>.
  </p>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/exams/exams-list.tsx" "src/app/(app)/exams/[id]/offline-sync-card.tsx"
git commit -m "feat: clearer exam detail link and hub registration CTA"
```

---

### Task 6: Update design spec to match new ownership model

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-offline-exam-sync-design.md`

- [ ] **Step 1: Edit Section 3 architecture line**

Change line 33 (`console pages to register/revoke hubs and observe sync`) to:

```
   - school-admin page to register/revoke own-school hubs; console read-only oversight
```

- [ ] **Step 2: Edit Section 4 item 4**

Change "Download bundle file in console → USB" to "Download bundle file in the school admin area → USB".

- [ ] **Step 3: Edit Section 8 edge case row**

Change "API key + signing secret are school-scoped; revocable from console" to "API key + signing secret are school-scoped; revocable by the school admin".

- [ ] **Step 4: Add a decision row to Section 2**

Add to the decisions table:

```
| Hub registration authority | School admin registers/revokes own-school hubs; platform owner has read-only console oversight |
| Release permission | School admin or exam officer releases an exam to the school's hub |
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-09-offline-exam-sync-design.md
git commit -m "docs: update offline spec for school-admin hub management"
```

---

### Task 7: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full offline test suite**

Run: `npx vitest run src/lib/offline`
Expected: PASS.

- [ ] **Step 2: Typecheck the project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke (documented for the user)**

Log in as a school admin → sidebar shows **Offline Hubs** under System → register a hub → credentials reveal once → row appears with Revoke. Log in as platform owner → console Offline Hubs shows all schools, no register form, no revoke. Open a published exam → "Details" link → Offline sync card lists the hub → Release to hub works for both admin and exam officer.
