# Per-Sub-Assessment Exam Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a parent assessment type has sub-assessments (OBJ / THEORY / PRC), let the teacher create **separate exam entities per sub-assessment**, each with its own question bank, its own timer, and its own attempt; each is graded on its own max and scaled to its shared (allocated) marks. PRC stays manual via the existing practical scores sheet.

**Architecture:** Add a nullable `subAssessmentTypeId` to `Exam` (child `AssessmentType` id; `null` = legacy single exam). The create action builds **N separate `Exam` rows** (one per enabled component) instead of one; each child is a normal exam that reuses all existing attempt/timer/offline/review/publish/score-entry code. Grading (`compute.ts`) already handles a single-`subAssessmentWeights`-entry exam correctly, so the new model needs **no compute logic change** — only a testable extraction to lock that behavior. PRC children carry no questions and are graded through the existing `ManualScore` ("PRC") path.

**Tech Stack:** Next.js (App Router) + React client components, Prisma + PostgreSQL, TypeScript, Vitest (unit). DB schema changes applied via `prisma db push` (migrations are broken in this repo).

## Global Constraints

- Keep the legacy single-exam proportional-split path **unchanged** (backward compat).
- Scale-to-allocation grading: contribution = `platformRaw / platformMax × allocation`.
- Per-sub-assessment timer: separate `durationMinutes` per component (PRC has none).
- PRC stays manual via existing `ManualScore` (`subAssessmentTypeCode = "PRC"`); no new screen.
- No migration of old data.
- Reuse existing exam-taking/offline/review/publish code (children are normal exams).
- Listing shows separate rows, no visual grouping (v1).
- Type-check: `npx tsc --noEmit --skipLibCheck` must exit 0.
- Schema change applied with `npx prisma db push --accept-data-loss --skip-generate` (stop the dev server first — it holds the query-engine DLL and makes `db push` hang).
- Commit only task files. Do NOT stage pre-existing dirt: `hub/*`, `error.log`, `build_error.log`, `importError.txt`, `local_error.txt`, `login_screen/`, `docs/youtube-content-plan-2026-08-12.md`, `docs/superpowers/plans/2026-08-12-ai-rate-limiting.md`, `hub/spa/src/admin/LiveRoom.tsx`, `hub/src/room.test.ts`, `hub/src/room.ts`, and the `scripts/` folder (gitignored). Push to `master`.
- Tests: `npx vitest run` (config already includes `src/**/*.test.ts`).

---

## File Structure

- `prisma/schema.prisma` — add `subAssessmentTypeId` to `Exam` (+ index). (Task 1)
- `src/lib/results/scoring.ts` (CREATE) — pure `scaleToAllocation` / `scaleManual` helpers. (Task 2)
- `src/lib/exams/build-child-exams.ts` (CREATE) — pure `buildChildExamSpecs`. (Task 3)
- `src/lib/exams/actions.ts` (MODIFY) — `createExamAction` creates N child exams; `updateExamAction` guards child exams. (Task 4)
- `src/lib/results/compute.ts` (MODIFY) — extract `assembleScoreMap` (behavior preserved). (Task 5)
- `src/app/(app)/exams/exams-list.tsx` (MODIFY) — `CreateExamForm` per-component duration + per-component question picker; listing label shows component. (Task 6, Task 7)
- `src/app/(app)/exams/page.tsx` (MODIFY) — include `subAssessmentTypeId` in exam query + `ExamVM`. (Task 7)
- Tests: `src/lib/results/scoring.test.ts`, `src/lib/exams/build-child-exams.test.ts`, `src/lib/results/compute.test.ts`. (Tasks 2, 3, 5)

---

### Task 1: Schema — add `subAssessmentTypeId` to `Exam`

**Files:**
- Modify: `prisma/schema.prisma` (inside `model Exam`, around line 812)

**Interfaces:** (none — schema only)

- [ ] **Step 1: Add the column + index**

In `model Exam` add after `assessmentTypeId String` (line 812):

```prisma
  assessmentTypeId     String
  subAssessmentTypeId String? // child AssessmentType id; null = legacy single exam
  durationMinutes      Int
```

And add to the index block (near line 841):

```prisma
  @@index([schoolId])
  @@index([subjectId, classId, termId])
  @@index([status])
  @@index([subAssessmentTypeId])
```

- [ ] **Step 2: Apply schema to DB (stop dev server first)**

Run:
```bash
# Stop the Next dev server if running, then:
npx prisma db push --accept-data-loss --skip-generate 2>&1 | tail -15
```
Expected: "Database schema is now in sync" / "already in sync". (This also regenerates the Prisma client.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: exit 0 (new optional field introduces no errors).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(exams): add nullable subAssessmentTypeId to Exam"
```

---

### Task 2: Pure scaling helpers + tests

**Files:**
- Create: `src/lib/results/scoring.ts`
- Test: `src/lib/results/scoring.test.ts`

**Interfaces:**
- Produces: `scaleToAllocation(obtained: number, maximum: number, allocation: number): number` and `scaleManual(raw: number, max: number, allocation: number): number` (used by compute/action docs and asserted by tests).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/results/scoring.test.ts
import { describe, it, expect } from "vitest";
import { scaleToAllocation, scaleManual } from "./scoring";

describe("scaleToAllocation", () => {
  it("scales a component score to its allocated marks", () => {
    // THEORY allocated 60, student scored 45/75 on the THEORY bank
    expect(scaleToAllocation(45, 75, 60)).toBeCloseTo(36, 6);
  });
  it("returns 0 when the bank max is 0", () => {
    expect(scaleToAllocation(10, 0, 60)).toBe(0);
  });
  it("returns full allocation when perfect", () => {
    expect(scaleToAllocation(75, 75, 60)).toBeCloseTo(60, 6);
  });
});

describe("scaleManual", () => {
  it("scales a manual raw to its allocated marks", () => {
    // PRC allocated 20, teacher entered 15/20
    expect(scaleManual(15, 20, 20)).toBeCloseTo(15, 6);
  });
  it("returns 0 when manual max is 0", () => {
    expect(scaleManual(15, 0, 20)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/results/scoring.test.ts`
Expected: FAIL (`Cannot find module ./scoring`).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/results/scoring.ts
/**
 * Scale an obtained score (out of `maximum`) to `allocation` marks.
 * Used so a sub-exam graded on its own question-bank total counts toward the
 * parent assessment type by its shared (allocated) marks, independent of the
 * main examination's total.
 */
export function scaleToAllocation(obtained: number, maximum: number, allocation: number): number {
  if (maximum <= 0) return 0;
  return (obtained / maximum) * allocation;
}

/** Scale a manually entered raw/max score to `allocation` marks (PRC practical sheet). */
export function scaleManual(raw: number, max: number, allocation: number): number {
  if (max <= 0) return 0;
  return (raw / max) * allocation;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/results/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/results/scoring.ts src/lib/results/scoring.test.ts
git commit -m "feat(results): add pure scale-to-allocation scoring helpers"
```

---

### Task 3: Pure `buildChildExamSpecs` + tests

**Files:**
- Create: `src/lib/exams/build-child-exams.ts`
- Test: `src/lib/exams/build-child-exams.test.ts`

**Interfaces:**
- Consumes: `ComponentInput` shapes built by the create form.
- Produces: `buildChildExamSpecs(input): ChildExamSpec[]` — returns `[]` when no sub-assessments are enabled (caller then creates a legacy single exam). Used by `createExamAction` (Task 4).

```ts
// src/lib/exams/build-child-exams.ts
export interface ComponentInput {
  subAssessmentTypeId: string; // child AssessmentType id
  code: string;                // "OBJ" | "THEORY" | "PRC"
  enabled: boolean;
  allocation: number;          // marks out of parent total
  durationMinutes: number;     // 0 for PRC (manual)
  questionIds: string[];
}
export interface BuildChildExamInput {
  parentHasSubAssessments: boolean;
  parentWeight: number;        // allocations must sum to this
  components: ComponentInput[];
}
export interface ChildExamSpec {
  subAssessmentTypeId: string;
  durationMinutes: number;
  allocation: number;
  questionIds: string[];
}
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/exams/build-child-exams.test.ts
import { describe, it, expect } from "vitest";
import { buildChildExamSpecs, type ComponentInput } from "./build-child-exams";

const base: ComponentInput[] = [
  { subAssessmentTypeId: "obj1", code: "OBJ", enabled: true, allocation: 20, durationMinutes: 20, questionIds: ["q1", "q2"] },
  { subAssessmentTypeId: "th1", code: "THEORY", enabled: true, allocation: 60, durationMinutes: 90, questionIds: ["q3"] },
  { subAssessmentTypeId: "prc1", code: "PRC", enabled: true, allocation: 20, durationMinutes: 0, questionIds: [] },
];

describe("buildChildExamSpecs", () => {
  it("returns one spec per enabled component", () => {
    const specs = buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: base });
    expect(specs).toHaveLength(3);
    expect(specs[0]).toMatchObject({ subAssessmentTypeId: "obj1", durationMinutes: 20, allocation: 20, questionIds: ["q1", "q2"] });
    expect(specs[2].questionIds).toEqual([]); // PRC has no questions
  });

  it("throws when allocations do not sum to parent weight", () => {
    const bad = base.map((c) => (c.code === "PRC" ? { ...c, allocation: 19 } : c));
    expect(() => buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: bad }))
      .toThrow(/sum/i);
  });

  it("throws when an enabled platform component has no questions", () => {
    const bad = base.map((c) => (c.code === "OBJ" ? { ...c, questionIds: [] } : c));
    expect(() => buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: bad }))
      .toThrow(/question/i);
  });

  it("throws when an enabled platform component has no duration", () => {
    const bad = base.map((c) => (c.code === "THEORY" ? { ...c, durationMinutes: 0 } : c));
    expect(() => buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: bad }))
      .toThrow(/duration/i);
  });

  it("allows PRC-only (manual) exams", () => {
    const onlyPrc = [base[2]];
    const specs = buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: onlyPrc });
    expect(specs).toHaveLength(1);
    expect(specs[0].subAssessmentTypeId).toBe("prc1");
  });

  it("returns [] when parent has no sub-assessments (legacy single exam)", () => {
    expect(buildChildExamSpecs({ parentHasSubAssessments: false, parentWeight: 0, components: base }))
      .toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/exams/build-child-exams.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/exams/build-child-exams.ts
import type { ComponentInput, BuildChildExamInput, ChildExamSpec } from "./build-child-exams";

export function buildChildExamSpecs(input: BuildChildExamInput): ChildExamSpec[] {
  const { parentHasSubAssessments, parentWeight, components } = input;
  if (!parentHasSubAssessments) return [];

  const enabled = components.filter((c) => c.enabled);
  if (enabled.length === 0) return [];

  const platform = enabled.filter((c) => c.code === "OBJ" || c.code === "THEORY");
  const sum = enabled.reduce((s, c) => s + (Number(c.allocation) || 0), 0);
  if (Math.abs(sum - parentWeight) > 0.01) {
    throw new Error(`Component marks must sum to ${parentWeight}`);
  }

  for (const c of platform) {
    if ((Number(c.allocation) || 0) <= 0) throw new Error(`${c.code} must have marks > 0`);
    if ((Number(c.durationMinutes) || 0) <= 0) throw new Error(`${c.code} requires a duration > 0`);
    if (c.questionIds.length === 0) throw new Error(`${c.code} requires at least one question`);
  }
  for (const c of enabled.filter((x) => x.code === "PRC")) {
    if ((Number(c.allocation) || 0) <= 0) throw new Error("PRC must have marks > 0");
  }

  return enabled.map((c) => ({
    subAssessmentTypeId: c.subAssessmentTypeId,
    durationMinutes: Math.max(0, Math.round(Number(c.durationMinutes) || 0)),
    allocation: Number(c.allocation) || 0,
    questionIds: c.code === "PRC" ? [] : c.questionIds,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/exams/build-child-exams.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exams/build-child-exams.ts src/lib/exams/build-child-exams.test.ts
git commit -m "feat(exams): add pure buildChildExamSpecs for per-sub-assessment creation"
```

---

### Task 4: `createExamAction` builds N child exams (legacy path preserved)

**Files:**
- Modify: `src/app/(app)/exams/...` no — `src/lib/exams/actions.ts` (`createExamAction` ~line 39, `updateExamAction` ~line 110)
- Modify (import): add `import { buildChildExamSpecs, type ComponentInput } from "./build-child-exams";`

**Interfaces:**
- Consumes: `buildChildExamSpecs` (Task 3).
- Produces: N `Exam` rows (each with `subAssessmentTypeId`, own `durationMinutes`, own `subAssessmentWeights:[{subAssessmentTypeId, weightPercentage}]`, own `examQuestions`); legacy path unchanged when `specs.length === 0`.

- [ ] **Step 1: Update `createExamAction` to read `componentsJson` and branch**

In `createExamAction`, after reading `assessmentTypeId`/`durationMinutes` and the existing `subAssessmentWeightsRaw`, add:

```ts
  const componentsJson = formData.get("componentsJson") as string | null;
  let components: ComponentInput[] = [];
  if (componentsJson) {
    try { components = JSON.parse(componentsJson) as ComponentInput[]; } catch { components = []; }
  }
  const parentType = assessmentType; // resolved at line 68 (findFirst by code)
  const parentHasSub = (parentType as any) && (assessmentType as any); // replaced below
```

Replace the resolution at line 65-74 so `assessmentType` lookup also returns children. Use the existing `assessmentTypes` passed to the form? The action re-queries; query children too:

```ts
  const assessmentType = await prisma.assessmentType.findFirst({
    where: { code: assessmentTypeId, schoolId: ctx.schoolId },
    include: { children: { select: { id: true, code: true } } },
  });
  if (!assessmentType) return { error: "Assessment type not found." };
  const childIds = new Set(assessmentType.children.map((c) => c.id));
```

Then build specs and branch:

```ts
  const specs = buildChildExamSpecs({
    parentHasSubAssessments: assessmentType.children.length > 0,
    parentWeight: (assessmentType as any).defaultWeight ?? 0,
    components,
  });

  // Authorize: every spec's subAssessmentTypeId must be a real child of this parent
  for (const s of specs) {
    if (!childIds.has(s.subAssessmentTypeId)) return { error: "Invalid sub-assessment." };
  }

  if (specs.length === 0) {
    // LEGACY single exam (unchanged behaviour)
    const exam = await prisma.exam.create({
      data: {
        schoolId: ctx.schoolId, subjectId, classId: classIds[0], termId,
        assessmentTypeId: assessmentType.id, durationMinutes, shuffleEnabled: true,
        status: "draft", createdBy: ctx.user.staffId ?? undefined, subAssessmentWeights: undefined,
        classes: { create: classIds.map((cId) => ({ classId: cId })) },
      },
    });
    if (questionIds.length > 0) {
      await prisma.examQuestion.createMany({ data: questionIds.map((qId) => ({ examId: exam.id, questionId: qId })) });
    }
    return { success: "Exam created." };
  }

  // NEW: one Exam per enabled component
  for (const spec of specs) {
    const exam = await prisma.exam.create({
      data: {
        schoolId: ctx.schoolId, subjectId, classId: classIds[0], termId,
        assessmentTypeId: assessmentType.id,
        subAssessmentTypeId: spec.subAssessmentTypeId,
        durationMinutes: spec.durationMinutes,
        shuffleEnabled: true, status: "draft",
        createdBy: ctx.user.staffId ?? undefined,
        subAssessmentWeights: [{ subAssessmentTypeId: spec.subAssessmentTypeId, weightPercentage: spec.allocation }] as Prisma.InputJsonValue,
        classes: { create: classIds.map((cId) => ({ classId: cId })) },
      },
    });
    if (spec.questionIds.length > 0) {
      await prisma.examQuestion.createMany({ data: spec.questionIds.map((qId) => ({ examId: exam.id, questionId: qId })) });
    }
  }
  return { success: "Exams created (one per component)." };
```

Remove the old single-exam create block (lines 76-98) — replaced by the branch above. Keep the `recordAudit`/revalidate at the end for both paths.

- [ ] **Step 2: Guard `updateExamAction` for child exams**

In `updateExamAction`, after loading `existing`, add:

```ts
  if (existing.subAssessmentTypeId && (!subWeights || (subWeights as any[]).length === 0 ||
      !(subWeights as any[]).some((w) => w.subAssessmentTypeId === existing.subAssessmentTypeId))) {
    return { error: "This component exam must keep its sub-assessment allocation." };
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/exams/actions.ts
git commit -m "feat(exams): create one Exam per sub-assessment; preserve legacy path"
```

---

### Task 5: Extract `assembleScoreMap` (lock compute behavior, no logic change)

**Files:**
- Modify: `src/lib/results/compute.ts` (move the scoreMap assembly, currently lines ~155-260, into a pure exported function)
- Test: `src/lib/results/compute.test.ts`

**Interfaces:**
- Produces: `assembleScoreMap(params): ScoreMap` where `ScoreMap = Record<string, Record<string, Record<string, number>>>`. `computeClassResults` keeps its DB queries and then calls `assembleScoreMap` with the already-fetched inputs; output is unchanged.

- [ ] **Step 1: Write the failing test (fixtures for new + legacy models)**

```ts
// src/lib/results/compute.test.ts
import { describe, it, expect } from "vitest";
import { assembleScoreMap, type AssembleParams } from "./compute";

const atTypes = [
  { id: "obj1", code: "OBJ", parentId: "parent1" },
  { id: "th1", code: "THEORY", parentId: "parent1" },
  { id: "prc1", code: "PRC", parentId: "parent1" },
  { id: "parent1", code: "EXM", parentId: null },
];
const atIdToCode = new Map(atTypes.map((a) => [a.id, a.code]));

describe("assembleScoreMap — new per-sub-assessment model", () => {
  it("scales each component to its allocation", () => {
    const params: AssembleParams = {
      exams: [
        { id: "eObj", subjectId: "sub1", assessmentTypeId: "parent1", subAssessmentWeights: [{ subAssessmentTypeId: "obj1", weightPercentage: 20 }] },
        { id: "eTh", subjectId: "sub1", assessmentTypeId: "parent1", subAssessmentWeights: [{ subAssessmentTypeId: "th1", weightPercentage: 60 }] },
        { id: "ePrc", subjectId: "sub1", assessmentTypeId: "parent1", subAssessmentWeights: [{ subAssessmentTypeId: "prc1", weightPercentage: 20 }] },
      ],
      attempts: [
        { examId: "eObj", studentId: "s1", answers: [{ finalScore: 18 }, { finalScore: 0 }] }, // 18/20
        { examId: "eTh", studentId: "s1", answers: [{ finalScore: 45 }] },                     // 45/75
      ],
      manualScores: [{ examId: "ePrc", studentId: "s1", subAssessmentTypeCode: "PRC", rawScore: 15, maxRawScore: 20 }],
      atIdToCode,
      examMaxScores: { eObj: 20, eTh: 75 },
      examSubWeights: {
        eObj: [{ subAssessmentTypeId: "obj1", weightPercentage: 20 }],
        eTh: [{ subAssessmentTypeId: "th1", weightPercentage: 60 }],
        ePrc: [{ subAssessmentTypeId: "prc1", weightPercentage: 20 }],
      },
    };
    const sm = assembleScoreMap(params);
    expect(sm["s1"]["sub1"]["OBJ"]).toBeCloseTo(18, 6);   // 18/20 * 20
    expect(sm["s1"]["sub1"]["THEORY"]).toBeCloseTo(36, 6); // 45/75 * 60
    expect(sm["s1"]["sub1"]["PRC"]).toBeCloseTo(15, 6);    // 15/20 * 20
  });
});

describe("assembleScoreMap — legacy single exam (unchanged)", () => {
  it("proportionally splits the combined raw score (existing behaviour)", () => {
    const params: AssembleParams = {
      exams: [
        { id: "eLegacy", subjectId: "sub1", assessmentTypeId: "parent1",
          subAssessmentWeights: [
            { subAssessmentTypeId: "obj1", weightPercentage: 20 },
            { subAssessmentTypeId: "th1", weightPercentage: 60 },
            { subAssessmentTypeId: "prc1", weightPercentage: 20 },
          ] },
      ],
      attempts: [
        { examId: "eLegacy", studentId: "s1",
          answers: [{ finalScore: 10 }, { finalScore: 8 }, { finalScore: 5 }, { finalScore: 40 }] }, // 63/95 combined
      ],
      manualScores: [],
      atIdToCode,
      examMaxScores: { eLegacy: 95 },
      examSubWeights: {
        eLegacy: [
          { subAssessmentTypeId: "obj1", weightPercentage: 20 },
          { subAssessmentTypeId: "th1", weightPercentage: 60 },
          { subAssessmentTypeId: "prc1", weightPercentage: 20 },
        ],
      },
    };
    const sm = assembleScoreMap(params);
    // platformComponentTotal (OBJ+THEORY) = 80; OBJ share = 20/80 = 0.25
    // OBJ = (63/95) * 20 * 0.25 = 3.3158 ; THEORY = (63/95) * 60 * 0.75 = 29.842
    expect(sm["s1"]["sub1"]["OBJ"]).toBeCloseTo(3.3158, 3);
    expect(sm["s1"]["sub1"]["THEORY"]).toBeCloseTo(29.842, 3);
    expect(sm["s1"]["sub1"]["PRC"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/results/compute.test.ts`
Expected: FAIL (`assembleScoreMap` not exported).

- [ ] **Step 3: Extract the function (behavior preserved verbatim)**

At the top of `compute.ts` add the exported types and function, moving the existing scoreMap-building loop (the code currently between the `// Build a map: studentId → ...` comment at ~line 155 and the end of the attempt+manual loops at ~line 260) into it. The loop body is **unchanged** — only its inputs are passed in instead of closed-over.

```ts
export type ScoreMap = Record<string, Record<string, Record<string, number>>>;
export interface AssembleParams {
  exams: { id: string; subjectId: string; assessmentTypeId: string; subAssessmentWeights: unknown }[];
  attempts: { examId: string; studentId: string; answers: { finalScore?: number | null; aiSuggestedScore?: number | null; gradedScore?: number | null }[] }[];
  manualScores: { examId: string; studentId: string; subAssessmentTypeCode: string; rawScore: number; maxRawScore: number }[];
  atIdToCode: Map<string, string>;
  examMaxScores: Record<string, number>;
  examSubWeights: Record<string, { subAssessmentTypeId: string; weightPercentage: number }[]>;
}
export function assembleScoreMap(p: AssembleParams): ScoreMap {
  const { exams, attempts, manualScores, atIdToCode, examMaxScores, examSubWeights } = p;
  // manualMap (verbatim from current lines 124-133)
  const manualMap: Record<string, Record<string, Record<string, { raw: number; max: number }>>> = {};
  for (const ms of manualScores) {
    if (!manualMap[ms.examId]) manualMap[ms.examId] = {};
    if (!manualMap[ms.examId][ms.subAssessmentTypeCode]) manualMap[ms.examId][ms.subAssessmentTypeCode] = {};
    manualMap[ms.examId][ms.subAssessmentTypeCode][ms.studentId] = { raw: ms.rawScore, max: ms.maxRawScore };
  }
  const scoreMap: ScoreMap = {};
  // --- attempt loop (verbatim from current lines 157-230) ---
  for (const attempt of attempts) {
    const exam = exams.find((e) => e.id === attempt.examId);
    if (!exam) continue;
    const { subjectId, assessmentTypeId } = exam;
    const gradedAnswers = attempt.answers.filter((a) => a.finalScore != null || a.aiSuggestedScore != null || a.gradedScore != null);
    if (gradedAnswers.length === 0) continue;
    const platformRaw = attempt.answers.reduce((sum, a) => sum + Number(a.finalScore ?? a.aiSuggestedScore ?? a.gradedScore ?? 0), 0);
    const platformMax = examMaxScores[attempt.examId] ?? 0;
    const subWeights = (examSubWeights[attempt.examId] ?? []) as { subAssessmentTypeId: string; weightPercentage: number }[];
    if (!scoreMap[attempt.studentId]) scoreMap[attempt.studentId] = {};
    if (!scoreMap[attempt.studentId][subjectId]) scoreMap[attempt.studentId][subjectId] = {};
    if (subWeights.length === 0) {
      if (platformMax > 0) {
        const existingManual = Object.values(manualMap[attempt.examId] ?? {}).some((b) => b[attempt.studentId] != null);
        if (!existingManual) {
          scoreMap[attempt.studentId][subjectId][assessmentTypeId] =
            (scoreMap[attempt.studentId][subjectId][assessmentTypeId] ?? 0) + platformRaw;
        }
      }
    } else {
      const platformComponents = subWeights.filter((sw) => {
        const code = atIdToCode.get(sw.subAssessmentTypeId) ?? "";
        return code === "OBJ" || code === "THEORY";
      });
      const platformComponentTotal = platformComponents.reduce((s, sw) => s + sw.weightPercentage, 0);
      for (const sw of subWeights) {
        const code = atIdToCode.get(sw.subAssessmentTypeId) ?? "";
        const compMarks = sw.weightPercentage;
        const manual = manualMap[attempt.examId]?.[code]?.[attempt.studentId];
        if (manual) {
          const scaled = manual.max > 0 ? (manual.raw / manual.max) * compMarks : 0;
          scoreMap[attempt.studentId][subjectId][code] = (scoreMap[attempt.studentId][subjectId][code] ?? 0) + scaled;
        } else if (code === "OBJ" || code === "THEORY") {
          if (platformMax > 0 && platformComponentTotal > 0) {
            const componentShare = compMarks / platformComponentTotal;
            const scaled = (platformRaw / platformMax) * compMarks * componentShare;
            scoreMap[attempt.studentId][subjectId][code] = (scoreMap[attempt.studentId][subjectId][code] ?? 0) + scaled;
          }
        }
      }
    }
  }
  // --- manual-only loop (verbatim from current lines 232-260) ---
  for (const exam of exams) {
    const subWeights = (examSubWeights[exam.id] ?? []) as { subAssessmentTypeId: string; weightPercentage: number }[];
    const manualForExam = manualMap[exam.id] ?? {};
    for (const [code, byStudent] of Object.entries(manualForExam)) {
      for (const [studentId, { raw, max }] of Object.entries(byStudent)) {
        if (!scoreMap[studentId]) scoreMap[studentId] = {};
        if (!scoreMap[studentId][exam.subjectId]) scoreMap[studentId][exam.subjectId] = {};
        if (subWeights.length === 0) {
          if (scoreMap[studentId][exam.subjectId][exam.assessmentTypeId] == null) {
            scoreMap[studentId][exam.subjectId][exam.assessmentTypeId] = max > 0 ? (raw / max) * (examMaxScores[exam.id] || 100) : 0;
          }
        } else {
          const sw = subWeights.find((w) => (atIdToCode.get(w.subAssessmentTypeId) ?? "") === code);
          const compMarks = sw?.weightPercentage ?? 0;
          if (compMarks === 0) continue;
          if (scoreMap[studentId][exam.subjectId][code] == null) {
            scoreMap[studentId][exam.subjectId][code] = max > 0 ? (raw / max) * compMarks : 0;
          }
        }
      }
    }
  }
  return scoreMap;
}
```

Then in `computeClassResults`, delete the inline loop (lines 124-260) and replace with:

```ts
  const scoreMap = assembleScoreMap({
    exams,
    attempts,
    manualScores,
    atIdToCode,
    examMaxScores,
    examSubWeights,
  });
```

(All those variables already exist in `computeClassResults`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/results/compute.test.ts`
Expected: PASS (new model scaled; legacy unchanged).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: exit 0.

```bash
git add src/lib/results/compute.ts src/lib/results/compute.test.ts
git commit -m "refactor(results): extract assembleScoreMap; lock new + legacy grading"
```

---

### Task 6: Create form UI — per-component duration + per-component question picker

**Files:**
- Modify: `src/app/(app)/exams/exams-list.tsx` (`CreateExamForm`, ~line 292)

**Interfaces:**
- Consumes: `buildChildExamSpecs` shape (Task 3) — the form builds a `ComponentInput[]` and posts it as a `componentsJson` hidden field; each platform child carries its own `questionIds`.
- Produces: the new `componentsJson` FormData field consumed by `createExamAction` (Task 4).

- [ ] **Step 1: Extend `CreateExamForm` state**

Add per-component state alongside `subWeights`/`enabledComps`:

```ts
  // Per-component question selections: childId -> questionId[]
  const [compQuestions, setCompQuestions] = useState<Record<string, string[]>>({});
  // Per-component durations: childId -> minutes
  const [compDurations, setCompDurations] = useState<Record<string, string>>({});
```

Replace the single top-level `Duration (minutes)` block (lines 419-423) so it only renders when `!hasSubAssessments` (legacy). When `hasSubAssessments`, remove that block.

- [ ] **Step 2: Add duration + scoped question picker to each component row**

Inside the existing `selectedType.children.map(...)` block (lines 443-492), add a duration input next to the marks input:

```tsx
  <input type="number" min={1} value={compDurations[child.id] ?? ""} disabled={!enabled}
    onChange={(e) => setCompDurations((d) => ({ ...d, [child.id]: e.target.value }))}
    placeholder="min" className="w-20 border rounded p-1.5 text-sm text-right disabled:opacity-40" />
```

For PRC (`child.code === "PRC"`) skip the question picker and show "Manual only". For OBJ/THEORY, render a scoped picker that toggles `compQuestions[child.id]`:

```tsx
  {child.code !== "PRC" && (
    <div className="mt-2 border rounded p-2 max-h-40 overflow-y-auto">
      {topicGroups.map(([topic, qs]) => (
        <div key={topic}>
          <p className="font-label-sm text-label-sm">{topic}</p>
          {qs.map((q) => (
            <label key={q.id} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={(compQuestions[child.id] ?? []).includes(q.id)}
                onChange={(e) => setCompQuestions((prev) => {
                  const cur = prev[child.id] ?? [];
                  return { ...prev, [child.id]: e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id) };
                })} />
              <span className="line-clamp-1">{q.text}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )}
```

- [ ] **Step 3: Emit `componentsJson` hidden field**

Replace the existing `<input type="hidden" name="subAssessmentWeights" ... />` (lines 345-351) with:

```tsx
  <input type="hidden" name="componentsJson" value={JSON.stringify(
    hasSubAssessments
      ? selectedType.children
          .filter((c) => enabledComps.has(c.id))
          .map((c) => ({
            subAssessmentTypeId: c.id,
            code: c.code,
            enabled: true,
            allocation: parseFloat(subWeights[c.id] || "0") || 0,
            durationMinutes: parseFloat(compDurations[c.id] || "0") || 0,
            questionIds: c.code === "PRC" ? [] : (compQuestions[c.id] ?? []),
          }))
      : []
  )} />
```

(Keep the legacy `questionIds[]` checkboxes path only when `!hasSubAssessments`, so `createExamAction` still receives `questionIds[]` for legacy exams.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/exams/exams-list.tsx"
git commit -m "feat(exams): per-component duration + question bank in create form"
```

---

### Task 7: Listing label shows the component

**Files:**
- Modify: `src/app/(app)/exams/page.tsx` (exam query + `ExamVM`)
- Modify: `src/app/(app)/exams/exams-list.tsx` (`ExamVM` type + label render)

**Interfaces:**
- Produces: a display label `{Subject} · {AssessmentType} · {COMPONENT}` for child exams; legacy exams show only `{Subject} · {AssessmentType}`.

- [ ] **Step 1: Include `subAssessmentTypeId` in the exam query + VM**

In `page.tsx`, add `subAssessmentTypeId: true` to the exam `select`, and add `subAssessmentTypeId?: string | null` to the `ExamVM` mapped object.

In `exams-list.tsx`, add `subAssessmentTypeId?: string | null` to the `ExamVM` interface (line 13) and to the prop type (line 36).

- [ ] **Step 2: Render the component label**

In the table row (around line 140-142), compute the component code from `assessmentTypes`:

```tsx
  const compCode = exam.subAssessmentTypeId
    ? (assessmentTypes.find((t) => t.children.some((c) => c.id === exam.subAssessmentTypeId))?.children.find((c) => c.id === exam.subAssessmentTypeId)?.code ?? "")
    : "";
  const typeLabel = compCode ? `${exam.assessmentTypeId} · ${compCode}` : exam.assessmentTypeId;
```

Render `<span>{typeLabel}</span>` instead of the raw `exam.assessmentTypeId`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/exams/page.tsx" "src/app/(app)/exams/exams-list.tsx"
git commit -m "feat(exams): show sub-assessment component in exam list label"
```

---

### Task 8: Verification + push

**Files:** (none new)

- [ ] **Step 1: Run full type-check + tests**

Run:
```bash
npx tsc --noEmit --skipLibCheck && npx vitest run
```
Expected: tsc exit 0; all tests PASS (scoring, build-child-exams, compute).

- [ ] **Step 2: Manual smoke checklist (no code change needed)**

- PRC child exam: open its score entry — `components` is derived from its `subAssessmentWeights` (`[{subAssessmentTypeId: prc1, weightPercentage: 20}]`), so the manual sheet shows one "PRC" component and writes `subAssessmentTypeCode:"PRC"` (already supported by `score-entry.tsx` + `upsertManualScoresAction`). Confirm.
- A student taking OBJ vs THEORY sees two separate exams with their own timers (children are normal exams). Confirm in `exams/take`.
- Legacy single exam (no `subAssessmentTypeId`) still computes via the proportional-split path (Task 5 test locks this).

- [ ] **Step 3: Push**

```bash
git push origin master
```

---

## Self-Review Notes

- **Spec coverage:** §3 schema → Task 1; §4 create flow + per-component timer → Tasks 4 & 6; §5 exam-taking reuse → no code (children are normal exams, noted in Tasks 4/8); §6 grading → Task 5 (no logic change, locked by test); §7 PRC via `ManualScore` → Task 8 verification (already supported); §8 listing → Task 7; §9 validation → Tasks 3 & 4; §10 tests → Tasks 2, 3, 5.
- **Placeholders:** none — every step has concrete code/commands.
- **Type consistency:** `ComponentInput`/`ChildExamSpec` (Task 3) match the `componentsJson` shape emitted in Task 6 and parsed in Task 4; `AssembleParams`/`ScoreMap` (Task 5) match the test fixtures and `computeClassResults` call; `subAssessmentTypeId` naming is consistent across schema (Task 1), action (Task 4), and listing (Task 7).
