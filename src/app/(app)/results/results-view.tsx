"use client";

import { useState, useTransition } from "react";
import { computeResultsAction, finalizeTermResultsAction } from "./actions";

interface ClassVM { id: string; name: string }
interface TermVM { id: string; name: string }
interface SubjectVM { id: string; name: string }

export interface ExamScoreRow {
  examId: string;
  assessmentTypeId: string;
  assessmentTypeName: string;
  assessmentTypeCode: string;
  components: { code: string; marks: number }[];
  students: {
    studentId: string;
    studentName: string;
    admissionNumber: string;
    platformScore: number | null;
    platformMax: number | null;
    manualScores: { code: string; raw: number; max: number }[];
    subjectScore: number | null;
    grade: string | null;
  }[];
}

export function ResultsView({
  schoolId,
  isAdmin,
  classes,
  terms,
  subjects,
  selectedClassId,
  selectedTermId,
  selectedSubjectId,
  activeTab,
  subjectResults,
  termResults,
  examScoreRows,
  assessmentTypeNames,
}: {
  schoolId: string;
  isAdmin: boolean;
  classes: ClassVM[];
  terms: TermVM[];
  subjects: SubjectVM[];
  selectedClassId: string;
  selectedTermId: string;
  selectedSubjectId: string;
  activeTab: "compute" | "scores";
  subjectResults: { studentId: string; subjectName: string; totalScore: number | null; grade: string | null; subjectPosition: number | null; assessmentScores: Record<string, number> | null }[];
  termResults: { studentId: string; studentName: string; admissionNumber: string; overallAverage: number | null; overallPosition: number | null; status: string }[];
  examScoreRows: ExamScoreRow[];
  assessmentTypeNames: Record<string, string>;
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

  // Build URL for filter changes (preserves active tab)
  function filterUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      classId: selectedClassId,
      termId: selectedTermId,
      subjectId: selectedSubjectId,
      tab: activeTab,
      ...overrides,
    });
    return `/results?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
        <a
          href={filterUrl({ tab: "compute" })}
          className={`px-4 py-2 rounded-md font-label-md text-label-md transition-colors ${
            activeTab === "compute" ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Compute &amp; Finalise
        </a>
        <a
          href={filterUrl({ tab: "scores" })}
          className={`px-4 py-2 rounded-md font-label-md text-label-md transition-colors ${
            activeTab === "scores" ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          View Scores
        </a>
      </div>

      {/* Shared filters — class + term */}
      <form method="GET" className="flex flex-wrap gap-4 items-end">
        <input type="hidden" name="tab" value={activeTab} />
        {/* On the scores tab the subject select provides subjectId — no hidden field needed */}
        {activeTab !== "scores" && selectedSubjectId && (
          <input type="hidden" name="subjectId" value={selectedSubjectId} />
        )}
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Class</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            onChange={(e) => e.target.form?.submit()}
            className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
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
            className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
          >
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} Term</option>)}
          </select>
        </div>
        {/* Subject filter only on Scores tab */}
        {activeTab === "scores" && subjects.length > 0 && (
          <div>
            <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Subject</label>
            <select
              name="subjectId"
              defaultValue={selectedSubjectId}
              onChange={(e) => e.target.form?.submit()}
              className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
            >
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </form>

      {/* ── COMPUTE TAB ──────────────────────────────────────────────── */}
      {activeTab === "compute" && (
        <>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={handleCompute}
              disabled={computing}
              className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
            >
              {computing ? "Computing…" : "Compute results"}
            </button>
            {isAdmin && termResults.some((tr) => tr.status === "computed") && (
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="border border-outline-variant text-primary font-label-md text-label-md py-2 px-4 rounded bg-surface-container-lowest hover:bg-surface-container-low disabled:opacity-60"
              >
                {finalizing ? "Finalizing…" : "Finalize results"}
              </button>
            )}
            {termResults.length > 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Grades reflect the last time &quot;Compute results&quot; was run.
                Click it again after entering new scores to refresh grades.
              </p>
            )}
          </div>

          {msg && <p className="font-body-sm text-body-sm text-on-surface">{msg}</p>}

          {termResults.length > 0 ? (
            <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
              <table className="w-full text-left font-body-sm text-body-sm">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Pos</th>
                    <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Student</th>
                    <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Admission</th>
                    <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Average</th>
                    <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {termResults.map((tr) => (
                    <>
                      <tr
                        key={tr.studentId}
                        className="cursor-pointer transition hover:bg-surface-container-low"
                        onClick={() => setExpanded(expanded === tr.studentId ? null : tr.studentId)}
                      >
                        <td className="px-3 py-2 font-label-md text-label-md text-on-surface">{tr.overallPosition ?? "—"}</td>
                        <td className="px-3 py-2 text-on-surface">{tr.studentName}</td>
                        <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{tr.admissionNumber}</td>
                        <td className="px-3 py-2">{tr.overallAverage != null ? Math.round(tr.overallAverage) : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            tr.status === "finalised"
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-surface-variant text-on-surface-variant"
                          }`}>
                            {tr.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                          {expanded === tr.studentId ? "Hide ▲" : "Details ▼"}
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
                              <div key={sr.subjectName} className="flex items-center justify-between py-1.5 font-body-sm text-body-sm border-b border-outline-variant/40 last:border-0">
                                <span className="text-on-surface min-w-[140px]">{sr.subjectName}</span>
                                <div className="flex items-center gap-3 text-xs flex-wrap justify-end">
                                  {/* Raw assessment scores */}
                                   {sr.assessmentScores && Object.entries(sr.assessmentScores).map(([code, raw]) => (
                                     <span key={code} className="text-on-surface-variant">
                                       {assessmentTypeNames[code] ?? code}: <span className="font-semibold text-on-surface">{Math.round(raw as number)}</span>
                                     </span>
                                   ))}
                                  {/* Separator */}
                                  {sr.assessmentScores && Object.keys(sr.assessmentScores).length > 0 && (
                                    <span className="text-outline-variant">|</span>
                                  )}
                                  <span className="font-label-md text-label-md text-on-surface">
                                    Total: {sr.totalScore != null ? Math.round(sr.totalScore) : "—"}
                                  </span>
                                  <span className="w-8 text-center font-label-md text-label-md text-primary bg-primary/10 rounded px-1">{sr.grade ?? "—"}</span>
                                  <span className="font-label-sm text-label-sm text-on-surface-variant">#{sr.subjectPosition ?? "—"}</span>
                                </div>
                              </div>
                            ))}
                            <div className="mt-3">
                              <a
                                href={`/results/${tr.studentId}?termId=${selectedTermId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-label-sm text-label-sm text-primary hover:underline"
                              >
                                View report card ↗
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
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No results yet. Select a class and term, then click &quot;Compute results&quot;.
            </p>
          )}
        </>
      )}

      {/* ── SCORES TAB ───────────────────────────────────────────────── */}
      {activeTab === "scores" && (
        <>
          {examScoreRows.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
              <p className="font-body-md text-body-md text-on-surface-variant">
                No exams found for this class, term, and subject.
              </p>
              <a href="/exams" className="mt-3 inline-block font-label-md text-label-md text-primary hover:underline">
                Go to Exams →
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {examScoreRows.map((row) => {
                // For simple offline exams (no sub-components), each student has exactly
                // one ManualScore keyed by the parent assessmentTypeId (e.g. "WBT").
                // `maxRawScore` is the actual max for that assessment (15, 25, 60).
                const isOfflineSimple = row.components.length === 0;
                // Derive max from the first student's manual score (consistent across students)
                const offlineMax = isOfflineSimple
                  ? (row.students.find((s) => s.manualScores.length > 0)?.manualScores[0]?.max ?? null)
                  : null;

                return (
                <div key={row.examId} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                  {/* Exam header */}
                  <div className="px-5 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                        {row.assessmentTypeName}
                      </span>
                      {row.components.length > 0 && (
                        <div className="flex gap-2">
                          {row.components.map((c) => (
                            <span key={c.code} className={`text-xs px-2 py-0.5 rounded font-medium ${
                              c.code === "OBJ" ? "bg-blue-100 text-blue-700"
                              : c.code === "THEORY" ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                            }`}>
                              {c.code} ({c.marks} marks)
                            </span>
                          ))}
                        </div>
                      )}
                      {isOfflineSimple && offlineMax != null && (
                        <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                          Max: {offlineMax}
                        </span>
                      )}
                    </div>
                    <a
                      href={`/exams/${row.examId}`}
                      className="font-label-sm text-label-sm text-primary hover:underline"
                    >
                      Enter scores →
                    </a>
                  </div>

                  {/* Score table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-outline-variant bg-surface-container">
                        <tr>
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Student</th>
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Adm. No.</th>
                          {row.components.length > 0 ? (
                            <>
                              {row.components.map((c) => (
                                <th key={c.code} className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                                  {c.code}<br />
                                  <span className="font-normal normal-case text-[10px]">/{c.marks}</span>
                                </th>
                              ))}
                              <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Platform</th>
                            </>
                          ) : (
                            /* Simple offline exam — show raw score column */
                            <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                              Score{offlineMax != null ? ` /${offlineMax}` : ""}
                            </th>
                          )}
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Subject Total</th>
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {row.students.map((s) => {
                          const submittedOnPlatform = s.platformScore != null;
                          return (
                            <tr key={s.studentId} className="hover:bg-surface-container-low transition-colors">
                              <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface font-medium">{s.studentName}</td>
                              <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface-variant">{s.admissionNumber}</td>
                              {row.components.length > 0 ? (
                                <>
                                  {row.components.map((c) => {
                                    const ms = s.manualScores.find((m) => m.code === c.code);
                                    // Show raw score out of this component's max, NOT scaled
                                    return (
                                      <td key={c.code} className="px-4 py-2 text-right">
                                        {ms != null ? (
                                          <span className="font-label-md text-label-md text-on-surface">
                                            {Math.round(ms.raw)}
                                          </span>
                                        ) : (
                                          <span className="text-on-surface-variant text-xs">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-4 py-2 text-right">
                                    {submittedOnPlatform ? (
                                      <span className="font-label-sm text-label-sm text-on-surface">
                                        {s.platformScore != null ? Math.round(s.platformScore) : "—"}/{s.platformMax}
                                      </span>
                                    ) : (
                                      <span className="text-on-surface-variant text-xs">Not submitted</span>
                                    )}
                                  </td>
                                </>
                              ) : (
                                /* Simple offline exam — show the raw ManualScore directly */
                                <td className="px-4 py-2 text-right">
                                  {(() => {
                                    // Manual score for this exam is keyed by the assessment code
                                    const ms = s.manualScores.find(
                                      (m) => m.code === row.assessmentTypeCode
                                    ) ?? s.manualScores[0];
                                    if (ms) {
                                      return (
                                        <span className="font-label-md text-label-md text-on-surface">
                                          {Math.round(ms.raw)}
                                        </span>
                                      );
                                    }
                                    if (submittedOnPlatform) {
                                      return (
                                        <span className="font-label-sm text-label-sm text-on-surface">
                                          {s.platformScore != null ? Math.round(s.platformScore) : "—"}/{s.platformMax}
                                        </span>
                                      );
                                    }
                                    return <span className="text-on-surface-variant text-xs">—</span>;
                                  })()}
                                </td>
                              )}
                              <td className="px-4 py-2 text-right font-label-md text-label-md text-on-surface font-semibold">
                                {s.subjectScore != null ? Math.round(s.subjectScore) : <span className="text-on-surface-variant font-normal text-xs">Not computed</span>}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {s.grade ? (
                                  <span className="inline-block bg-primary/10 text-primary font-label-md text-label-md px-2 py-0.5 rounded">
                                    {s.grade}
                                  </span>
                                ) : (
                                  <span className="text-on-surface-variant text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
