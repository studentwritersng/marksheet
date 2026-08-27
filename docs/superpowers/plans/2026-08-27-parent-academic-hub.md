# Parent Academic Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parent-facing `/parent/results` page that aggregates, across all of a parent's wards and filterable by ward/term, the published results (with CA + exam component scores), homework (with status + score), and exams (with marks).

**Architecture:** A server component fetches all guardian-scoped data in one batched module (`parent/results/actions.ts`), shapes it into a typed `AcademicHubData` object, and hands it to a small client component (`hub-client.tsx`) that does instant ward/term filtering. A pure helper `shapeAssessmentScores` turns the `SubjectResult.assessmentScores` JSON (`Record<code, raw>`) into labelled components and is unit-tested without a DB. The page reuses the existing guardian fetch pattern from `parent/page.tsx` and the existing report-card / homework detail links.

**Tech Stack:** Next.js 15 App Router (server components + one client component), Prisma, TypeScript, existing `(app)` design tokens (Material Symbols icons, `surface-container` classes).

## Global Constraints

- Every record fetched MUST be scoped to the parent's own wards (via `prisma.guardian.findMany({ where: { parentUserId: user.userId, student: { schoolId: user.schoolId ?? undefined } } })`) — no cross-student leakage. (Spec §9)
- Page guarded with `getCurrentUser()` + `if (user.role !== "parent") redirect("/login")` (mirror `src/app/(app)/parent/page.tsx:9-11`), not a new auth helper.
- No database schema/migration changes. (Spec §3)
- "Published results" = `TermResult.status === "finalised"`. "Published homework" = `Homework.status === "published"`. "Published exams" = `Exam.status === "published"`. (Spec §6)
- `SubjectResult.assessmentScores` is `Record<string, number>` keyed by assessment-type **code** (e.g. `"OBJ"`, `"TH"`, `"PRC"`) → raw marks. (From `compute.ts:21,411`)
- Reuse existing detail links: report card `/results/[studentId]?termId=…` (parent-accessible via guardian check), homework `/homework/[id]` (gated on `status === "published"`).
- Visual style follows existing `(app)` tokens; chips like `FeeStatusBadge` may be referenced for styling consistency.

---

## File Structure

- **Create** `src/app/(app)/parent/results/shape.ts` — pure helpers: `shapeAssessmentScores(raw, codeToLabel)`, types `HubSubjectScore`, `HubTermResult`, `HubHomework`, `HubExam`, `HubWard`, `AcademicHubData`, `CodeLabelMap`. Unit-tested.
- **Create** `src/app/(app)/parent/results/shape.test.ts` — unit tests for `shapeAssessmentScores` (no DB).
- **Create** `src/app/(app)/parent/results/actions.ts` — server-only `getAcademicHub(user)` that runs the batched Prisma queries and calls `shapeAssessmentScores`.
- **Create** `src/app/(app)/parent/results/hub-client.tsx` — `"use client"` filter UI (ward + term `<select>`) over `AcademicHubData`.
- **Create** `src/app/(app)/parent/results/page.tsx` — server component; `getCurrentUser()` guard; calls `getAcademicHub`; renders `<HubClient data={...} />`.
- **Modify** `src/lib/nav.ts` — add `Results` nav entry to the parent branch (lines ~98-104).

---

### Task 1: Add parent "Results" nav entry

**Files:**
- Modify: `src/lib/nav.ts:98-104`

**Interfaces:** None (pure UI nav).

- [ ] **Step 1: Add the nav item**

In the `else if (user.role === "parent")` branch, add a `Results` entry after `My Wards`:

```ts
} else if (user.role === "parent") {
  items.push(
    { label: "Messages", href: "/messages", icon: "chat" },
    { label: "My Wards", href: "/parent", icon: "family_history" },
    { label: "Results", href: "/parent/results", icon: "analytics" },
    { label: "Curriculum Tracker", href: "/curriculum-tracker", icon: "checklist" },
    { label: "Notification Prefs", href: "/parent/settings", icon: "notifications" },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v "next.config.ts" | head`
Expected: no errors referencing `nav.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nav.ts
git commit -m "feat(nav): add parent Results entry"
```

---

### Task 2: Pure shaping helpers + unit tests (TDD)

**Files:**
- Create: `src/app/(app)/parent/results/shape.ts`
- Create: `src/app/(app)/parent/results/shape.test.ts`

**Interfaces:**
- Produces: `shapeAssessmentScores(raw: Record<string, number> | null | undefined, codeToLabel: Map<string, string>): HubSubjectScore["components"]`, and the exported types used by Tasks 3–4.

- [ ] **Step 1: Write the failing test**

`src/app/(app)/parent/results/shape.test.ts`:

```ts
import { describe, it, expect } from "vitest"; // or "node:test" if project uses that
import { shapeAssessmentScores } from "./shape";

describe("shapeAssessmentScores", () => {
  const codeToLabel = new Map<string, string>([
    ["OBJ", "Objective"],
    ["TH", "Theory"],
    ["PRC", "Practical"],
  ]);

  it("maps codes to labelled components, preserving raw marks", () => {
    const raw = { OBJ: 18, TH: 42, PRC: 15 };
    const out = shapeAssessmentScores(raw, codeToLabel);
    expect(out).toEqual([
      { code: "OBJ", label: "Objective", raw: 18 },
      { code: "TH", label: "Theory", raw: 42 },
      { code: "PRC", label: "Practical", raw: 15 },
    ]);
  });

  it("falls back to the code as label when no mapping exists", () => {
    const out = shapeAssessmentScores({ XYZ: 9 }, codeToLabel);
    expect(out).toEqual([{ code: "XYZ", label: "XYZ", raw: 9 }]);
  });

  it("returns an empty array for null/undefined", () => {
    expect(shapeAssessmentScores(null, codeToLabel)).toEqual([]);
    expect(shapeAssessmentScores(undefined, codeToLabel)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/\(app\)/parent/results/shape.test.ts` (or the repo's test runner — check `package.json` scripts; if `vitest` is unavailable use `node --test`).
Expected: FAIL — `shapeAssessmentScores` is not defined / module missing.

- [ ] **Step 3: Write minimal implementation**

`src/app/(app)/parent/results/shape.ts`:

```ts
export type CodeLabelMap = Map<string, string>;

export interface AssessmentComponent {
  code: string;
  label: string;
  raw: number;
}

export interface HubSubjectScore {
  subjectId: string;
  subjectName: string;
  totalScore: number | null;
  grade: string | null;
  subjectPosition: number | null;
  components: AssessmentComponent[];
}

export interface HubTermResult {
  termId: string;
  termName: string;
  sessionLabel: string;
  overallAverage: number | null;
  overallPosition: number | null;
  teacherComment: string | null;
  principalComment: string | null;
  subjects: HubSubjectScore[];
  reportCardHref: string;
}

export interface HubHomework {
  id: string;
  title: string;
  subjectName: string;
  dueDate: string | null;
  attemptStatus: string | null;
  score: number | null;
  percentage: number | null;
  published: boolean;
  href: string;
}

export interface HubExam {
  id: string;
  subjectName: string;
  assessmentTypeLabel: string;
  examMark: number | null;
  href: string;
}

export interface HubWard {
  studentId: string;
  name: string;
  className: string;
  admissionNumber: string;
  terms: HubTermResult[];
  homework: HubHomework[];
  exams: HubExam[];
}

export interface AcademicHubData {
  wards: HubWard[];
  termOptions: { id: string; label: string }[];
}

export function shapeAssessmentScores(
  raw: Record<string, number> | null | undefined,
  codeToLabel: CodeLabelMap,
): AssessmentComponent[] {
  if (!raw) return [];
  return Object.entries(raw).map(([code, value]) => ({
    code,
    label: codeToLabel.get(code) ?? code,
    raw: typeof value === "number" ? value : Number(value) || 0,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/\(app\)/parent/results/shape.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/parent/results/shape.ts src/app/\(app\)/parent/results/shape.test.ts
git commit -m "feat(parent-results): add shapeAssessmentScores helper + tests"
```

---

### Task 3: Server data fetch `getAcademicHub`

**Files:**
- Create: `src/app/(app)/parent/results/actions.ts`

**Interfaces:**
- Consumes: `shapeAssessmentScores` (Task 2), `getCurrentUser`/user shape, Prisma models `guardian`, `termResult`, `subjectResult`, `homework`, `exam`, `assessmentType`.
- Produces: `getAcademicHub(user: SessionPayload): Promise<AcademicHubData>`.

- [ ] **Step 1: Write the implementation**

`src/app/(app)/parent/results/actions.ts` (server-only — no `"use server"` needed since it's a plain async fn called by the page):

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import {
  shapeAssessmentScores,
  type AcademicHubData,
  type HubWard,
  type HubTermResult,
  type HubHomework,
  type HubExam,
} from "./shape";

export async function getAcademicHub(user: SessionPayload): Promise<AcademicHubData> {
  if (!user.schoolId) return { wards: [], termOptions: [] };

  // 1. Guardian-scoped wards (mirrors parent/page.tsx).
  const guardians = await prisma.guardian.findMany({
    where: { parentUserId: user.userId, student: { schoolId: user.schoolId ?? undefined } },
    include: {
      student: {
        include: {
          currentClass: { select: { name: true } },
          termResults: {
            where: { status: "finalised" },
            include: { term: { include: { session: true } } },
            orderBy: { term: { session: { label: "desc" } } },
          },
        },
      },
    },
  });

  if (guardians.length === 0) return { wards: [], termOptions: [] };

  const wards = guardians.map((g) => g.student);
  const studentIds = wards.map((s) => s.id);
  const allTermIds = Array.from(
    new Set(wards.flatMap((s) => s.termResults.map((tr) => tr.termId))),
  );

  // 2. Map assessment-type id -> code, and code -> label.
  const assessmentTypes = await prisma.assessmentType.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true, code: true, name: true },
  });
  const idToCode = new Map(assessmentTypes.map((a) => [a.id, a.code]));
  const codeToLabel = new Map(assessmentTypes.map((a) => [a.code, a.name]));

  // 3. Subject results for the finalised terms (CA + exam components live here).
  const subjectResults = await prisma.subjectResult.findMany({
    where: { studentId: { in: studentIds }, termId: { in: allTermIds } },
    include: { subject: { select: { name: true } } },
  });

  // 4. Published homework for each ward's class+term, with the ward's attempt.
  const homework = await prisma.homework.findMany({
    where: {
      schoolId: user.schoolId,
      status: "published",
      OR: wards.map((s) => ({ classId: s.classId, termId: { in: allTermIds } })),
    },
    include: {
      subject: { select: { name: true } },
      attempts: { where: { studentId: { in: studentIds } } },
    },
  });

  // 5. Published exams for each ward's class+term.
  const exams = await prisma.exam.findMany({
    where: {
      schoolId: user.schoolId,
      status: "published",
      termId: { in: allTermIds },
      OR: wards.flatMap((s) => [
        { classId: s.classId },
        { classes: { some: { classId: s.classId } } },
      ]),
    },
    include: { subject: { select: { name: true } }, assessmentType: true },
  });

  // 6. Shape per ward.
  const builtWards: HubWard[] = wards.map((s) => {
    const finalised = s.termResults; // already status:"finalised"
    const subjectRows = subjectResults.filter((sr) => sr.studentId === s.id);

    const terms: HubTermResult[] = finalised.map((tr) => {
      const subs = subjectRows
        .filter((sr) => sr.termId === tr.termId)
        .map((sr) => ({
          subjectId: sr.subjectId,
          subjectName: sr.subject.name,
          totalScore: sr.totalScore,
          grade: sr.grade,
          subjectPosition: sr.subjectPosition,
          components: shapeAssessmentScores(
            sr.assessmentScores as Record<string, number> | null,
            codeToLabel,
          ),
        }));
      return {
        termId: tr.termId,
        termName: tr.term.name,
        sessionLabel: tr.term.session.label,
        overallAverage: tr.overallAverage,
        overallPosition: tr.overallPosition,
        teacherComment: tr.teacherComment,
        principalComment: tr.principalComment,
        subjects: subs,
        reportCardHref: `/results/${s.id}?termId=${tr.termId}`,
      };
    });

    const hw: HubHomework[] = homework
      .filter((h) => h.classId === s.classId)
      .map((h) => {
        const attempt = h.attempts.find((a) => a.studentId === s.id) ?? null;
        return {
          id: h.id,
          title: h.title,
          subjectName: h.subject.name,
          dueDate: h.dueDate ? h.dueDate.toISOString() : null,
          attemptStatus: attempt?.status ?? null,
          score: attempt?.totalScore ?? null,
          percentage: attempt?.percentage ?? null,
          published: attempt?.published ?? false,
          href: `/homework/${h.id}`,
        };
      });

    const ex: HubExam[] = exams
      .filter(
        (e) =>
          e.classId === s.classId ||
          e.classes.some((ec) => ec.classId === s.classId),
      )
      .map((e) => {
        const code = idToCode.get(e.assessmentTypeId) ?? e.assessmentTypeId;
        const subj = subjectRows.find(
          (sr) => sr.subjectId === e.subjectId && sr.termId === e.termId,
        );
        const raw = (subj?.assessmentScores as Record<string, number> | null)?.[code] ?? null;
        return {
          id: e.id,
          subjectName: e.subject.name,
          assessmentTypeLabel: e.assessmentType?.name ?? code,
          examMark: typeof raw === "number" ? raw : null,
          href: `/results/${s.id}?termId=${e.termId}`,
        };
      });

    return {
      studentId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      className: s.currentClass?.name ?? "No class",
      admissionNumber: s.admissionNumber,
      terms,
      homework: hw,
      exams: ex,
    };
  });

  // 7. Term dropdown options (union of all finalised terms).
  const termOptions = Array.from(
    new Map(
      wards
        .flatMap((s) => s.termResults)
        .map((tr) => [tr.termId, { id: tr.termId, label: `${tr.term.session.label} · ${tr.term.name}` }]),
    ).values(),
  );

  return { wards: builtWards, termOptions };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v "next.config.ts" | head`
Expected: no type errors in `parent/results/actions.ts`. (DB integration is verified manually on Vercel — local Prisma cannot reach Neon due to DNS; see Spec §12.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/parent/results/actions.ts
git commit -m "feat(parent-results): add getAcademicHub server fetch"
```

---

### Task 4: Client filter component + page

**Files:**
- Create: `src/app/(app)/parent/results/hub-client.tsx`
- Create: `src/app/(app)/parent/results/page.tsx`

**Interfaces:**
- Consumes: `AcademicHubData` (Task 2/3) passed as a prop.
- Produces: rendered hub UI.

- [ ] **Step 1: Write the client filter component**

`src/app/(app)/parent/results/hub-client.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AcademicHubData, HubWard } from "./shape";

export default function HubClient({ data }: { data: AcademicHubData }) {
  const [wardId, setWardId] = useState<string>("all");
  const [termId, setTermId] = useState<string>("all");

  const wards = useMemo<HubWard[]>(() => {
    const list = wardId === "all" ? data.wards : data.wards.filter((w) => w.studentId === wardId);
    if (termId === "all") return list;
    return list.map((w) => ({
      ...w,
      terms: w.terms.filter((t) => t.termId === termId),
      homework: w.homework.filter((h) => data.termOptions.find((t) => t.id === termId)),
      exams: w.exams,
    }));
  }, [data, wardId, termId]);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex flex-wrap gap-3">
        <select value={wardId} onChange={(e) => setWardId(e.target.value)} className="border border-outline-variant rounded px-3 py-2 bg-surface-container-lowest">
          <option value="all">All wards</option>
          {data.wards.map((w) => (
            <option key={w.studentId} value={w.studentId}>{w.name}</option>
          ))}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className="border border-outline-variant rounded px-3 py-2 bg-surface-container-lowest">
          <option value="all">All terms</option>
          {data.termOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {wards.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant py-8 text-center">No academic data available yet.</p>
      )}

      {wards.map((w) => (
        <section key={w.studentId} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{w.name}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{w.className} · {w.admissionNumber}</p>

          {/* Results */}
          <h4 className="mt-4 font-label-md text-label-md text-on-surface">Published Results</h4>
          {w.terms.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No published results.</p>}
          {w.terms.map((t) => (
            <div key={t.termId} className="mt-2 border border-outline-variant rounded p-3">
              <div className="flex items-center gap-3">
                <span className="font-label-md text-label-md text-on-surface">{t.termName} ({t.sessionLabel})</span>
                <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded font-label-sm text-label-sm">Avg: {t.overallAverage != null ? Math.round(t.overallAverage) : "—"}%</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Pos: #{t.overallPosition ?? "—"}</span>
                <Link href={t.reportCardHref} className="font-label-sm text-label-sm text-primary hover:underline ml-auto">View Report Card</Link>
              </div>
              <table className="w-full text-left mt-2">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Subject</th>
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Score</th>
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Grade</th>
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Components</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {t.subjects.map((s) => (
                    <tr key={s.subjectId}>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.subjectName}</td>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.totalScore != null ? Math.round(s.totalScore) : "—"}</td>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.grade ?? "—"}</td>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface-variant">
                        {s.components.map((c) => `${c.label}: ${c.raw}`).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Homework */}
          <h4 className="mt-4 font-label-md text-label-md text-on-surface">Homework</h4>
          {w.homework.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No published homework.</p>}
          {w.homework.map((h) => (
            <div key={h.id} className="mt-2 border border-outline-variant rounded p-3 flex items-center gap-3">
              <Link href={h.href} className="font-body-md text-body-md text-on-surface hover:underline">{h.title}</Link>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{h.subjectName}</span>
              {h.dueDate && <span className="font-body-sm text-body-sm text-on-surface-variant">Due: {new Date(h.dueDate).toLocaleDateString()}</span>}
              <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                {h.published && h.percentage != null ? `Score: ${Math.round(h.percentage)}%` : (h.attemptStatus ? h.attemptStatus : "Not submitted")}
              </span>
            </div>
          ))}

          {/* Exams */}
          <h4 className="mt-4 font-label-md text-label-md text-on-surface">Exams</h4>
          {w.exams.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No published exams.</p>}
          {w.exams.map((e) => (
            <div key={e.id} className="mt-2 border border-outline-variant rounded p-3 flex items-center gap-3">
              <Link href={e.href} className="font-body-md text-body-md text-on-surface hover:underline">{e.subjectName} — {e.assessmentTypeLabel}</Link>
              <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                {e.examMark != null ? `Mark: ${e.examMark}` : "No mark yet"}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

`src/app/(app)/parent/results/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAcademicHub } from "./actions";
import HubClient from "./hub-client";

export default async function ParentResultsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") redirect("/login");

  const data = await getAcademicHub(user);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Academic Hub</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Published results, homework and exams for your wards.</p>
      </div>
      <HubClient data={data} />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v "next.config.ts" | head`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/parent/results/hub-client.tsx src/app/\(app\)/parent/results/page.tsx
git commit -m "feat(parent-results): add Academic Hub page + client filter"
```

---

### Task 5: Final typecheck + manual verification notes

**Files:** none new.

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "next.config.ts"`
Expected: clean (only the pre-existing harmless `next.config.ts` `eslint` quirk may appear — that is unrelated).

- [ ] **Step 2: Record manual verification checklist (for Vercel deploy)**

Note in the PR/commit body that the following must be confirmed on the deployed app (Neon reachable only via Vercel; local Prisma DNS-blocked):
- A parent sees only their own wards.
- Published (finalised) results appear with averages, positions, and CA + exam component marks.
- Homework shows due dates, submission status, and scores when published.
- Exams show marks where recorded.
- Empty states render when nothing is published.

- [ ] **Step 3: Commit verification note (if needed) and push with the fee/parent fixes**

The hub work lands on `master` together with the previously completed fee/parent fixes (fee-status manual-selection removal, parent fee-status authorization, parent report-card link). Stage and push:

```bash
git add -A
git commit -m "feat: parent academic hub + fee/parent fixes" || echo "nothing to commit"
git push origin master
```

---

## Self-Review Notes

- **Spec coverage:** Nav entry (Task 1) ✓; route + `requireRole` guard via `getCurrentUser` (Task 4) ✓; batched guardian-scoped fetch (Task 3) ✓; published results/CA+exam scores via `shapeAssessmentScores` (Tasks 2–3) ✓; homework status+score (Task 3–4) ✓; exams marks (Task 3–4) ✓; filter bar ward+term (Task 4) ✓; empty states (Task 4) ✓; security scoping (Tasks 1/3) ✓; reuse of report-card/homework links (Tasks 3–4) ✓; no schema changes (all tasks) ✓; verification (Task 5) ✓.
- **Placeholder scan:** No TBD/TODO; every implementation step shows code. Exam deep-link open point resolved by linking exams to the report card (Spec §11 default).
- **Type consistency:** `AcademicHubData`, `HubWard`, `HubTermResult`, `HubHomework`, `HubExam`, `shapeAssessmentScores`, `getAcademicHub` names/types are defined in Task 2/3 and consumed consistently in Tasks 3–4. `codeToLabel` is a `Map<string,string>` everywhere.
