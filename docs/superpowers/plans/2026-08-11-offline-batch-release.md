# Offline Batch Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Batch release exams" panel to the Offline Hubs page that releases many eligible exams to one hub in a single server action, with per-exam skip/fail reporting.

**Architecture:** Extract the per-exam release internals from `releaseExamToHub` into a private `releaseSingleExamToHub(examId, hub)` helper. Add `batchReleaseExamsToHub(hubId, examIds)` that re-checks eligibility, loops the helper per exam with `try/catch` isolation, and returns `released/skipped/failed`. A new client component `BatchReleasePanel` renders hub dropdown + exam checklist + results on `/offline-hubs`.

**Tech Stack:** Next.js 16 server actions, Prisma, React 19 client components, vitest, Tailwind (existing design tokens).

## Global Constraints

- Follow the approved spec: `docs/superpowers/specs/2026-08-11-offline-batch-release-design.md`
- No schema changes, no API-route changes. Bundle expiry stays fixed at 7 days.
- Eligibility: `status: "published"`, `offlineStatus: "none"`, has questions, has active students in the exam's classes.
- One bundle per exam per run; already-released exams are skipped, never duplicated.
- Auth for batch: `getCurrentUser` must have `schoolId` and (`canManageSchool` or `canReviewExams`), else `Not authorised.`
- Hub must be active and belong to the user's school, else `Active hub not found for this school.`
- UI: reuse existing design token classes (`bg-surface-container-lowest`, `border-outline-variant`, `rounded-xl`).
- Existing 19 tests in `src/lib/offline/hub-actions.test.ts` must stay green (regression net).
- Run offline suite via `npx vitest run src/lib/offline` and typecheck via `npx tsc --noEmit`.

---

## File Structure

- Modify: `src/lib/offline/actions.ts` — extract helper, add `batchReleaseExamsToHub`, extend `OfflineActionResult` type.
- Test: `src/lib/offline/hub-actions.test.ts` — keep existing tests, add batch tests.
- Create: `src/components/offline/batch-release-panel.tsx` — client component.
- Modify: `src/app/(app)/offline-hubs/page.tsx` — fetch eligible exams + active hubs, render panel.

---

### Task 1: Extract `releaseSingleExamToHub` helper

**Files:**
- Modify: `src/lib/offline/actions.ts:116-193`
- Test: `src/lib/offline/hub-actions.test.ts` (existing tests only)

**Interfaces:**
- Consumes: nothing new (current `releaseExamToHub` behavior).
- Produces: `async function releaseSingleExamToHub(examId: string, hub: { id: string; name: string; signingSecret: string; schoolId: string }): Promise<{ examTitle: string; studentCount: number; questionCount: number }>` — private, throws on failure (fetch/build/DB), no auth, no revalidate. Used by Task 2.

- [ ] **Step 1: Run existing tests to confirm the regression net is green before refactoring**

Run: `npx vitest run src/lib/offline/hub-actions.test.ts`
Expected: 19 passing.

- [ ] **Step 2: Extract the helper and slim `releaseExamToHub`**

In `src/lib/offline/actions.ts`, replace the entire body of `releaseExamToHub` (lines 116-193) with:

```ts
async function releaseSingleExamToHub(
  examId: string,
  hub: { id: string; name: string; signingSecret: string; schoolId: string },
): Promise<{ examTitle: string; studentCount: number; questionCount: number }> {
  const examData = await fetchExamDataForBundle(examId, hub.schoolId);
  const bundleId = `b-${generateRandomBytes(8)}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const roster = examData.students.map((s) => ({
    studentId: s.id,
    admissionNumber: s.admissionNumber,
    firstName: s.firstName,
    lastName: s.lastName,
    pin: generatePin(),
  }));

  const bundle: OfflineBundleV1 = {
    schemaVersion: 1,
    bundleId,
    examId,
    schoolId: examData.exam.schoolId,
    issuedAt,
    expiresAt,
    durationMinutes: examData.exam.durationMinutes,
    shuffleEnabled: examData.exam.shuffleEnabled,
    exam: {
      subjectName: examData.exam.subjectName,
      classNames: examData.exam.classNames,
      termLabel: examData.exam.termLabel,
    },
    questions: examData.questions,
    roster,
  };

  const payload = serializeBundle(bundle, hub.signingSecret, bundleId);

  await prisma.$transaction(async (tx) => {
    const offline = await tx.offlineBundle.create({
      data: {
        bundleId,
        examId,
        hubId: hub.id,
        schoolId: hub.schoolId,
        payload,
        issuedAt: new Date(issuedAt),
        expiresAt: new Date(expiresAt),
      },
    });
    await tx.examPin.createMany({
      data: roster.map((r) => ({
        bundleId: offline.id,
        examId,
        studentId: r.studentId,
        pinHash: hashPin(r.pin),
      })),
      skipDuplicates: true,
    });
    await tx.exam.update({ where: { id: examId }, data: { offlineStatus: "released" } });
  });

  return { examTitle: examData.exam.subjectName, studentCount: roster.length, questionCount: examData.questions.length };
}

export async function releaseExamToHub(examId: string, hubId: string): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) && !canReviewExams(perms)) return { error: "Not authorised." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId, status: "active" } });
  if (!hub) return { error: "Active hub not found for this school." };

  let data;
  try {
    data = await releaseSingleExamToHub(examId, hub);
  } catch {
    return { error: "Exam not found or not ready to release." };
  }

  revalidatePath(`/exams/${examId}`);
  return {
    success: `Exam released to hub "${hub.name}".`,
    data,
  };
}
```

- [ ] **Step 3: Run existing tests to verify the refactor is behavior-preserving**

Run: `npx vitest run src/lib/offline/hub-actions.test.ts`
Expected: 19 passing (especially "lets a school admin release an exam" and "returns a graceful error when the exam cannot be fetched").

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/actions.ts
git commit -m "refactor: extract releaseSingleExamToHub helper"
```

---

### Task 2: Add `batchReleaseExamsToHub` (TDD)

**Files:**
- Modify: `src/lib/offline/actions.ts:11-22` (type) and append new action.
- Test: `src/lib/offline/hub-actions.test.ts`

**Interfaces:**
- Consumes: `releaseSingleExamToHub(examId, hub)` from Task 1; `prisma.hub.findFirst`, `prisma.exam.findMany`, `prisma.exam.update` mocks.
- Produces: `export interface BatchReleaseItem { examId: string; title: string; reason?: string }` and `export async function batchReleaseExamsToHub(hubId: string, examIds: string[]): Promise<OfflineActionResult>`. `OfflineActionResult.data` gains `released?/skipped?/failed?: BatchReleaseItem[]`. Used by Task 3.

- [ ] **Step 1: Write the failing tests**

In `src/lib/offline/hub-actions.test.ts`:
1. Update the import at line 2: `import { registerHubAction, revokeHubAction, releaseExamToHub, cancelReleaseToHubAction, batchReleaseExamsToHub } from "./actions";`
2. Add `BatchReleaseItem` to the `batchReleaseExamsToHub` import so tests can type results: `import { ..., type BatchReleaseItem } from "./actions";` (or annotate assertions with the inferred types — `expect(...).toEqual(...)` needs no annotation).
3. Append this describe block at the end of the file:

```ts
describe("batchReleaseExamsToHub", () => {
  beforeEach(() => {
    (prisma.hub as any) = { findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1", name: "Hall 1", signingSecret: "sec" }) };
    (prisma.offlineBundle as any) = { create: vi.fn().mockResolvedValue({ id: "bundle-1" }) };
    (prisma.examPin as any) = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    (prisma.exam as any) = {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma.$transaction as any) = async (fn: any) => fn(prisma);
  });

  it("releases multiple eligible exams to one hub", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "published", offlineStatus: "none", subject: { name: "Maths" } },
      { id: "exam-2", status: "published", offlineStatus: "none", subject: { name: "English" } },
    ]);

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1", "exam-2"]);

    expect(res.data?.released).toHaveLength(2);
    expect(prisma.exam.update).toHaveBeenCalledTimes(2);
    expect(prisma.exam.update).toHaveBeenCalledWith({ where: { id: "exam-2" }, data: { offlineStatus: "released" } });
  });

  it("skips already-released exams without re-releasing", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "published", offlineStatus: "released", subject: { name: "Maths" } },
      { id: "exam-2", status: "published", offlineStatus: "none", subject: { name: "English" } },
    ]);

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1", "exam-2"]);

    expect(res.data?.released).toHaveLength(1);
    expect(res.data?.skipped).toEqual([
      { examId: "exam-1", title: "Maths", reason: "already released" },
    ]);
    expect(prisma.exam.update).toHaveBeenCalledTimes(1);
  });

  it("skips non-published exams", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "draft", offlineStatus: "none", subject: { name: "Maths" } },
    ]);

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1"]);

    expect(res.data?.released).toHaveLength(0);
    expect(res.data?.skipped).toEqual([{ examId: "exam-1", title: "Maths", reason: "not published" }]);
  });

  it("isolates a per-exam failure so other exams still release", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "published", offlineStatus: "none", subject: { name: "Maths" } },
      { id: "exam-2", status: "published", offlineStatus: "none", subject: { name: "English" } },
    ]);
    const { fetchExamDataForBundle } = await import("./bundle");
    (fetchExamDataForBundle as any).mockRejectedValueOnce(new Error("No active students"));

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1", "exam-2"]);

    expect(res.data?.released).toHaveLength(1);
    expect(res.data?.failed).toEqual([
      { examId: "exam-1", title: "Maths", reason: "No active students" },
    ]);

    (fetchExamDataForBundle as any).mockImplementation(async () => ({
      exam: { id: "exam-1", schoolId: "school-1", durationMinutes: 60, shuffleEnabled: false, subjectName: "Maths", classNames: "JSS1", termLabel: "Term 1" },
      questions: [],
      students: [{ id: "stu-1", admissionNumber: "A1", firstName: "Ada", lastName: "Lovelace" }],
    }));
  });

  it("rejects a teacher without admin/officer permission", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1"]);

    expect(res.error).toBe("Not authorised.");
  });

  it("cannot release to a hub outside the school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any).findFirst.mockResolvedValue(null);

    const res = await batchReleaseExamsToHub("other-hub", ["exam-1"]);

    expect(res.error).toBe("Active hub not found for this school.");
  });

  it("no-ops when given an empty exam list", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());

    const res = await batchReleaseExamsToHub("hub-1", []);

    expect(res.data?.released).toEqual([]);
    expect(res.success).toContain("0 released");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/offline/hub-actions.test.ts`
Expected: batch describe tests FAIL — `batchReleaseExamsToHub is not a function`. (The 19 existing tests still pass.)

- [ ] **Step 3: Extend the `OfflineActionResult` type**

In `src/lib/offline/actions.ts`, replace the `OfflineActionResult` interface (lines 11-22) with:

```ts
export interface BatchReleaseItem {
  examId: string;
  title: string;
  reason?: string;
}

export interface OfflineActionResult {
  error?: string;
  success?: string;
  data?: {
    apiKey?: string;
    signingSecret?: string;
    invigilatorCode?: string;
    examTitle?: string;
    studentCount?: number;
    questionCount?: number;
    released?: BatchReleaseItem[];
    skipped?: BatchReleaseItem[];
    failed?: BatchReleaseItem[];
  };
}
```

- [ ] **Step 4: Implement `batchReleaseExamsToHub`**

Append to `src/lib/offline/actions.ts` (after `releaseExamToHub`):

```ts
export async function batchReleaseExamsToHub(hubId: string, examIds: string[]): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) && !canReviewExams(perms)) return { error: "Not authorised." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId, status: "active" } });
  if (!hub) return { error: "Active hub not found for this school." };

  const requested = await prisma.exam.findMany({
    where: { id: { in: examIds }, schoolId: user.schoolId },
    select: { id: true, status: true, offlineStatus: true, subject: { select: { name: true } } },
  });
  const byId = new Map(requested.map((e) => [e.id, e]));

  const released: BatchReleaseItem[] = [];
  const skipped: BatchReleaseItem[] = [];
  const failed: BatchReleaseItem[] = [];

  for (const examId of examIds) {
    const exam = byId.get(examId);
    if (!exam) {
      skipped.push({ examId, title: examId, reason: "not found in this school" });
      continue;
    }
    if (exam.status !== "published") {
      skipped.push({ examId, title: exam.subject.name, reason: "not published" });
      continue;
    }
    if (exam.offlineStatus !== "none") {
      skipped.push({ examId, title: exam.subject.name, reason: "already released" });
      continue;
    }
    try {
      await releaseSingleExamToHub(examId, hub);
      released.push({ examId, title: exam.subject.name });
      revalidatePath(`/exams/${examId}`);
    } catch (e: any) {
      failed.push({ examId, title: exam.subject.name, reason: e.message ?? "release failed" });
    }
  }

  revalidatePath("/offline-hubs");
  return {
    success: `${released.length} released, ${skipped.length} skipped, ${failed.length} failed.`,
    data: { released, skipped, failed },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/offline/hub-actions.test.ts`
Expected: all 26 tests pass (19 existing + 7 new).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/offline/actions.ts src/lib/offline/hub-actions.test.ts
git commit -m "feat: add batchReleaseExamsToHub server action"
```

---

### Task 3: Build `BatchReleasePanel` and wire it into `/offline-hubs`

**Files:**
- Create: `src/components/offline/batch-release-panel.tsx`
- Modify: `src/app/(app)/offline-hubs/page.tsx`

**Interfaces:**
- Consumes: `batchReleaseExamsToHub(hubId, examIds)` + `OfflineActionResult` from Task 2.
- Produces: `<BatchReleasePanel hubs: { id: string; name: string }[] exams: { id: string; subjectName: string; classNames: string; termLabel: string; questionCount: number; studentCount: number }[] />`.

- [ ] **Step 1: Create the client component**

Create `src/components/offline/batch-release-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { batchReleaseExamsToHub, type OfflineActionResult } from "@/lib/offline/actions";

type HubRow = { id: string; name: string };
type ExamRow = {
  id: string;
  subjectName: string;
  classNames: string;
  termLabel: string;
  questionCount: number;
  studentCount: number;
};

export function BatchReleasePanel({ hubs, exams }: { hubs: HubRow[]; exams: ExamRow[] }) {
  const [hubId, setHubId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<OfflineActionResult>({});

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === exams.length ? new Set() : new Set(exams.map((e) => e.id))));
  }

  async function submit() {
    if (!hubId || selected.size === 0) return;
    setPending(true);
    const res = await batchReleaseExamsToHub(hubId, [...selected]);
    setState(res);
    setPending(false);
    const releasedCount = res.data?.released?.length ?? 0;
    const skippedCount = res.data?.skipped?.length ?? 0;
    if (releasedCount > 0 && skippedCount === 0) {
      setSelected(new Set());
    }
  }

  const canSubmit = hubId !== "" && selected.size > 0 && !pending;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <h2 className="font-label-lg text-label-lg text-on-surface font-semibold mb-1">Batch release exams</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Release several exams to one hub in a single action. Only published, unreleased exams with questions and enrolled students are listed.
      </p>

      {hubs.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          <a href="/offline-hubs" className="text-primary underline">Register a hub</a> to release exams offline.
        </p>
      ) : exams.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No eligible exams to release.</p>
      ) : (
        <>
          <select
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface mb-3"
          >
            <option value="">Select hub…</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-on-surface mb-2">
            <input type="checkbox" checked={selected.size === exams.length} onChange={toggleAll} className="accent-[#002046]" />
            Select all
          </label>

          <div className="max-h-64 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant">
            {exams.map((e) => (
              <label key={e.id} className="flex items-start gap-3 p-3 cursor-pointer">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="mt-1 accent-[#002046]" />
                <span className="text-sm">
                  <span className="font-medium text-on-surface block">{e.subjectName}</span>
                  <span className="text-on-surface-variant text-xs">
                    {e.classNames} · {e.termLabel} · {e.questionCount} questions · {e.studentCount} students
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="mt-3 rounded-lg bg-[#002046] hover:bg-[#003366] text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {pending ? "Releasing…" : `Release ${selected.size} exam${selected.size === 1 ? "" : "s"} to hub`}
          </button>

          {state.error && <p className="mt-2 text-red-600 text-xs">{state.error}</p>}
          {state.success && <p className="mt-2 text-emerald-600 text-xs">{state.success}</p>}
          {state.data?.released && state.data.released.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {state.data.released.map((r) => (
                <li key={r.examId} className="text-emerald-600">Released {r.title}</li>
              ))}
            </ul>
          )}
          {state.data?.skipped && state.data.skipped.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {state.data.skipped.map((s) => (
                <li key={s.examId} className="text-amber-600">Skipped {s.title}: {s.reason}</li>
              ))}
            </ul>
          )}
          {state.data?.failed && state.data.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {state.data.failed.map((f) => (
                <li key={f.examId} className="text-red-600">Failed {f.title}: {f.reason}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the panel into the page**

Replace the content of `src/app/(app)/offline-hubs/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { HubManager } from "@/components/offline/hub-manager";
import { BatchReleasePanel } from "@/components/offline/batch-release-panel";

export default async function OfflineHubsPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [hubs, eligibleExams] = await Promise.all([
    prisma.hub.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.exam.findMany({
      where: { schoolId: user.schoolId, status: "published", offlineStatus: "none" },
      include: {
        subject: { select: { name: true } },
        term: { include: { session: { select: { label: true } } } },
        classes: { include: { class: { select: { name: true } } } },
        examQuestions: { select: { questionId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeHubs = hubs.filter((h) => h.status === "active");

  const allClassIds = [...new Set(eligibleExams.flatMap((e) => e.classes.map((ec) => ec.classId)))];
  const studentCounts = allClassIds.length > 0
    ? await prisma.student.groupBy({
        by: ["currentClassId"],
        where: { schoolId: user.schoolId, status: "active", currentClassId: { in: allClassIds } },
        _count: { _all: true },
      })
    : [];
  const countsByClass = new Map(studentCounts.map((s) => [s.currentClassId, s._count._all]));

  const releaseExams = eligibleExams
    .map((e) => ({
      id: e.id,
      subjectName: e.subject.name,
      classNames: e.classes.map((ec) => ec.class.name).join(", "),
      termLabel: `${e.term.name} (${e.term.session.label})`,
      questionCount: e.examQuestions.length,
      studentCount: e.classes.reduce((n, ec) => n + (countsByClass.get(ec.classId) ?? 0), 0),
    }))
    .filter((e) => e.questionCount > 0 && e.studentCount > 0);

  return (
    <div className="space-y-6">
      <BatchReleasePanel
        hubs={activeHubs.map((h) => ({ id: h.id, name: h.name }))}
        exams={releaseExams}
      />
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
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full offline test suite**

Run: `npx vitest run src/lib/offline`
Expected: all tests pass (includes 26 from hub-actions).

- [ ] **Step 5: Build to catch integration issues**

Run: `npm run build`
Expected: compiles + TypeScript passes. (If the "Collecting page data" stage hangs in this environment, that is a known pre-existing issue — `tsc --noEmit` is the authoritative check.)

- [ ] **Step 6: Commit**

```bash
git add src/components/offline/batch-release-panel.tsx "src/app/(app)/offline-hubs/page.tsx"
git commit -m "feat: add batch release panel to offline hubs page"
```

---

## Self-Review

**Spec coverage:**
- Server action with auth + active-hub check + eligibility re-check + per-exam isolation → Task 2. ✅
- Fixed 7-day expiry, no schema/API changes → Task 1 preserves existing expiry; no migration tasks. ✅
- Panel on `/offline-hubs`, hub dropdown + checklist + select-all + results → Task 3. ✅
- Pre-validated eligible list (published, unreleased, has questions, has students) → Task 3 page query + filter. ✅
- Require ≥1 exam + hub before submit → Task 3 `canSubmit` guard. ✅
- Tests: batch auth, hub-not-found, skip-released, skip-unpublished, per-exam isolation, empty list → Task 2. ✅

**Placeholder scan:** All steps contain concrete code; no TBD/TODO. ✅

**Type consistency:** `BatchReleaseItem { examId; title; reason? }` defined in Task 2 and used in Task 2 results + Task 3 panel. `OfflineActionResult.data.released/skipped/failed` matches. `releaseSingleExamToHub(examId, hub)` signature consistent between Tasks 1 and 2. `BatchReleasePanel` props match the page's `releaseExams` mapping. ✅
