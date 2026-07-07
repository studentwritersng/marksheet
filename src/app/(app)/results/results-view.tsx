"use client";

import { useState, useTransition } from "react";
import { computeResultsAction, finalizeTermResultsAction } from "./actions";

interface ClassVM { id: string; name: string }
interface TermVM { id: string; name: string }

export function ResultsView({
  schoolId,
  classes,
  terms,
  selectedClassId,
  selectedTermId,
  subjectResults,
  termResults,
}: {
  schoolId: string;
  classes: ClassVM[];
  terms: TermVM[];
  selectedClassId: string;
  selectedTermId: string;
  subjectResults: { studentId: string; subjectName: string; totalScore: number | null; grade: string | null; subjectPosition: number | null }[];
  termResults: { studentId: string; studentName: string; admissionNumber: string; overallAverage: number | null; overallPosition: number | null; status: string }[];
}) {
  const [computing, startCompute] = useTransition();
  const [finalizing, startFinalize] = useTransition();
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleCompute() {
    setMsg("");
    startCompute(async () => {
      const res = await computeResultsAction(selectedClassId, selectedTermId);
      setMsg(res.success ?? res.error ?? "");
    });
  }

  function handleFinalize() {
    if (!confirm("Finalize results? This will generate verification codes and lock scores.")) return;
    setMsg("");
    startFinalize(async () => {
      const res = await finalizeTermResultsAction(selectedTermId);
      setMsg(res.success ?? res.error ?? "");
    });
  }

  // Group subject results by studentId
  const subjectByStudent = subjectResults.reduce<Record<string, typeof subjectResults>>((acc, sr) => {
    (acc[sr.studentId] ??= []).push(sr);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <form method="GET" className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Class</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            onChange={(e) => e.target.form?.submit()}
            className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          >
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Term</label>
          <select
            name="termId"
            defaultValue={selectedTermId}
            onChange={(e) => e.target.form?.submit()}
            className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          >
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} Term</option>)}
          </select>
        </div>
      </form>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleCompute}
          disabled={computing}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
        >
          {computing ? "Computing…" : "Compute results"}
        </button>
        {termResults.some((tr) => tr.status === "computed") && (
          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="border border-outline-variant text-primary font-label-md text-label-md py-2 px-4 rounded bg-surface-container-lowest hover:bg-surface-container-low transition-colors disabled:opacity-60"
          >
            {finalizing ? "Finalizing…" : "Finalize results"}
          </button>
        )}
      </div>

      {msg && <p className="font-body-sm text-body-sm text-on-surface">{msg}</p>}

      {/* Term results table */}
      {termResults.length > 0 && (
        <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Pos</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Student</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Admission</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Average</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {termResults.map((tr) => (
                <>
                  <tr
                    key={tr.studentId}
                    className="cursor-pointer transition hover:bg-surface-container-low"
                    onClick={() => setExpanded(expanded === tr.studentId ? null : tr.studentId)}
                  >
                    <td className="px-3 py-2 font-label-md text-label-md text-on-surface">
                      {tr.overallPosition ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-on-surface">{tr.studentName}</td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{tr.admissionNumber}</td>
                    <td className="px-3 py-2">{tr.overallAverage?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tr.status === "finalised" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-variant text-on-surface-variant"
                      }`}>
                        {tr.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                      {expanded === tr.studentId ? "Hide" : "Details"}
                    </td>
                  </tr>
                  {expanded === tr.studentId && (
                    <tr key={`${tr.studentId}-detail`}>
                      <td colSpan={6} className="px-6 py-3 bg-surface-container-low">
                        <p className="mb-2 font-label-sm text-label-sm text-on-surface-variant">Subject breakdown</p>
                        {(subjectByStudent[tr.studentId] ?? []).length === 0 && (
                          <p className="font-label-sm text-label-sm text-on-surface-variant">No subject results yet.</p>
                        )}
                        {(subjectByStudent[tr.studentId] ?? []).map((sr) => (
                          <div key={sr.subjectName} className="flex items-center justify-between py-1 font-body-sm text-body-sm">
                            <span className="text-on-surface">{sr.subjectName}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-on-surface-variant">{sr.totalScore?.toFixed(1) ?? "—"}</span>
                              <span className="w-8 text-center font-label-md text-label-md text-on-surface">{sr.grade ?? "—"}</span>
                              <span className="font-label-sm text-label-sm text-on-surface-variant">#{sr.subjectPosition ?? "—"}</span>
                            </div>
                          </div>
                        ))}
                        <div className="mt-3">
                          <a
                            href={`/results/${tr.studentId}?termId=${selectedTermId}`}
                            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface underline"
                          >
                            View report card →
                          </a>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {termResults.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No results yet. Select a class and term, then click &quot;Compute results&quot;.
        </p>
      )}
    </div>
  );
}
