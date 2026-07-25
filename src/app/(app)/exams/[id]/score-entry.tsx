"use client";

import { useState, useTransition } from "react";
import { upsertManualScoresAction, type ManualScoreInput } from "@/lib/exams/actions";

interface Component {
  id: string;
  code: string;
  name: string;
  marks: number;
  isPractical: boolean;
  isManualOnly: boolean;
}

interface StudentRow {
  id: string;
  admissionNumber: string;
  fullName: string;
  hasSubmitted: boolean;
}

interface ExistingScore {
  studentId: string;
  subAssessmentTypeCode: string;
  rawScore: number;
  maxRawScore: number;
  note: string | null;
}

// Per-student, per-component score state
type ScoreState = Record<string, Record<string, { raw: string; max: string; note: string }>>;

export function ScoreEntryTable({
  examId,
  components,
  hasQuestionBank,
  students,
  existingManualScores,
}: {
  examId: string;
  components: Component[];
  hasQuestionBank: boolean;
  students: StudentRow[];
  existingManualScores: ExistingScore[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeComponent, setActiveComponent] = useState<string>(components[0]?.code ?? "");

  // Initialise score state from existing manual scores
  const [scores, setScores] = useState<ScoreState>(() => {
    const init: ScoreState = {};
    for (const s of existingManualScores) {
      if (!init[s.studentId]) init[s.studentId] = {};
      init[s.studentId][s.subAssessmentTypeCode] = {
        raw: String(s.rawScore),
        max: String(s.maxRawScore),
        note: s.note ?? "",
      };
    }
    return init;
  });

  const activeComp = components.find((c) => c.code === activeComponent);

  function setScore(studentId: string, code: string, field: "raw" | "max" | "note", value: string) {
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [code]: {
          ...(prev[studentId]?.[code] ?? { raw: "", max: "", note: "" }),
          [field]: value,
        },
      },
    }));
  }

  // Fill all "max" fields for active component with the same value
  function fillMaxAll(value: string) {
    if (!activeComponent) return;
    setScores((prev) => {
      const next = { ...prev };
      for (const s of students) {
        next[s.id] = {
          ...(next[s.id] ?? {}),
          [activeComponent]: {
            ...(next[s.id]?.[activeComponent] ?? { raw: "", max: "", note: "" }),
            max: value,
          },
        };
      }
      return next;
    });
  }

  function handleSave() {
    if (!activeComponent) return;
    setMsg(null);

    const inputs: ManualScoreInput[] = [];
    for (const s of students) {
      const entry = scores[s.id]?.[activeComponent];
      if (!entry?.raw && !entry?.max) continue; // skip untouched rows

      const raw = parseFloat(entry.raw);
      const max = parseFloat(entry.max);

      if (isNaN(raw) || isNaN(max)) continue;
      if (max <= 0) {
        setMsg({ type: "error", text: `Max score must be greater than 0 (student: ${s.fullName}).` });
        return;
      }
      if (raw < 0 || raw > max) {
        setMsg({ type: "error", text: `Score ${raw} is out of range 0–${max} for ${s.fullName}.` });
        return;
      }
      inputs.push({
        studentId: s.id,
        subAssessmentTypeCode: activeComponent,
        rawScore: raw,
        maxRawScore: max,
        note: entry.note || undefined,
      });
    }

    if (inputs.length === 0) {
      setMsg({ type: "error", text: "No scores to save. Fill in at least one row." });
      return;
    }

    startTransition(async () => {
      const res = await upsertManualScoresAction(examId, inputs);
      setMsg({ type: res.error ? "error" : "success", text: res.error ?? res.success ?? "Done." });
    });
  }

  if (components.length === 0) {
    if (!hasQuestionBank) {
      return (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            No components configured and no question bank linked. Edit the exam to add sub-assessment components or attach questions.
          </p>
        </div>
      );
    }
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">
          This exam uses the question bank only — scores are computed automatically from student submissions.
          No manual entry needed.
        </p>
        <a href="/results" className="mt-3 inline-block font-label-md text-label-md text-primary hover:underline">
          Go to Results →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Score Entry
            </h2>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              Enter raw scores per component. Scores are scaled automatically to each component's mark allocation.
            </p>
          </div>
        </div>

        {/* Component tabs */}
        <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 w-fit mb-5">
          {components.map((c) => (
            <button
              key={c.code}
              onClick={() => setActiveComponent(c.code)}
              className={`px-4 py-2 rounded-md font-label-md text-label-md transition-colors ${
                activeComponent === c.code
                  ? "bg-white text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {c.name}
              <span className="ml-1.5 font-label-sm text-label-sm text-on-surface-variant">
                ({c.marks} marks)
              </span>
            </button>
          ))}
        </div>

        {activeComp && (
          <>
            {/* Info banner per component type */}
            <div className={`mb-4 rounded-lg px-4 py-3 font-body-sm text-body-sm ${
              activeComp.code === "PRC"
                ? "bg-green-50 text-green-800"
                : activeComp.code === "OBJ"
                ? "bg-blue-50 text-blue-800"
                : "bg-amber-50 text-amber-800"
            }`}>
              {activeComp.code === "PRC" && (
                <>
                  <strong>Practical</strong> — always manually graded. Enter the raw score and the maximum raw score
                  (e.g. student scored 18 out of 20). This will be scaled to {activeComp.marks} marks automatically.
                </>
              )}
              {activeComp.code === "OBJ" && (
                <>
                  <strong>Objective (MCQ)</strong> — if the exam was taken on the platform, scores are computed
                  automatically. Use manual entry only if the exam was taken offline, or to override a platform score.
                  Enter raw score and the max mark the paper was out of.
                </>
              )}
              {activeComp.code === "THEORY" && (
                <>
                  <strong>Theory (Essay)</strong> — if the exam was taken on the platform, AI-suggested scores
                  are available for teacher review in the Essay Grading page. Use manual entry for offline papers
                  or to override. Enter raw score and the max mark the paper was out of.
                </>
              )}
            </div>

            {/* Bulk-fill max score */}
            <div className="flex items-center gap-3 mb-3">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                Set "out of" for all:
              </label>
              <input
                type="number"
                min={1}
                placeholder={`e.g. ${activeComp.marks}`}
                className="w-24 border border-outline-variant rounded px-2 py-1.5 font-body-sm text-body-sm text-on-surface"
                onChange={(e) => fillMaxAll(e.target.value)}
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">marks</span>
            </div>

            {/* Score table */}
            <div className="overflow-x-auto border border-outline-variant rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-[180px]">
                      Student
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-[100px]">
                      Admission No.
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Platform Submitted
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-[120px]">
                      Score (raw)
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-[100px]">
                      Out of
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-[80px]">
                      → Scaled
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {students.map((s) => {
                    const entry = scores[s.id]?.[activeComp.code] ?? { raw: "", max: "", note: "" };
                    const raw = parseFloat(entry.raw);
                    const max = parseFloat(entry.max);
                    const scaled = !isNaN(raw) && !isNaN(max) && max > 0
                      ? ((raw / max) * activeComp.marks).toFixed(1)
                      : null;
                    const isValid = !isNaN(raw) && !isNaN(max) && max > 0 && raw >= 0 && raw <= max;

                    return (
                      <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-body-sm text-body-sm text-on-surface font-medium">
                          {s.fullName}
                        </td>
                        <td className="px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
                          {s.admissionNumber}
                        </td>
                        <td className="px-4 py-3">
                          {s.hasSubmitted ? (
                            <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Submitted
                            </span>
                          ) : (
                            <span className="font-label-sm text-label-sm text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={entry.raw}
                            onChange={(e) => setScore(s.id, activeComp.code, "raw", e.target.value)}
                            placeholder="0"
                            className={`w-full border rounded px-2 py-1.5 font-body-sm text-body-sm text-right focus:outline-none focus:border-primary ${
                              entry.raw && !isValid
                                ? "border-red-400 bg-red-50"
                                : "border-outline-variant"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            step={0.5}
                            value={entry.max}
                            onChange={(e) => setScore(s.id, activeComp.code, "max", e.target.value)}
                            placeholder={String(activeComp.marks)}
                            className="w-full border border-outline-variant rounded px-2 py-1.5 font-body-sm text-body-sm text-right focus:outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {scaled != null ? (
                            <span className={`font-label-md text-label-md font-semibold ${
                              isValid ? "text-primary" : "text-red-500"
                            }`}>
                              {scaled}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.note}
                            onChange={(e) => setScore(s.id, activeComp.code, "note", e.target.value)}
                            placeholder="Optional note"
                            className="w-full border border-outline-variant rounded px-2 py-1.5 font-body-sm text-body-sm focus:outline-none focus:border-primary"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save button */}
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={pending}
                className="bg-[#002046] text-white font-label-md text-label-md py-2 px-5 rounded hover:bg-[#003366] disabled:opacity-60 transition-colors"
              >
                {pending ? "Saving…" : `Save ${activeComp.name} Scores`}
              </button>
              {msg && (
                <p className={`font-body-sm text-body-sm ${
                  msg.type === "error" ? "text-red-600" : "text-green-700"
                }`}>
                  {msg.text}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
