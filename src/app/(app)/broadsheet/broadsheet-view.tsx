"use client";

import { useRouter } from "next/navigation";
import { ExportButtons } from "@/components/export-buttons";
import type { BroadsheetData } from "./page";

interface Props {
  classes: { id: string; name: string; level: string }[];
  terms: { id: string; label: string }[];
  selectedClassId: string;
  selectedTermId: string;
  schoolName: string;
  schoolLogo: string | null;
  data: BroadsheetData | null;
}

export function BroadsheetView({
  classes,
  terms,
  selectedClassId,
  selectedTermId,
  schoolName,
  schoolLogo,
  data,
}: Props) {
  const router = useRouter();

  const handleClassChange = (classId: string) => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (selectedTermId) params.set("termId", selectedTermId);
    router.push(`/broadsheet?${params.toString()}`);
  };

  const handleTermChange = (termId: string) => {
    const params = new URLSearchParams();
    if (selectedClassId) params.set("classId", selectedClassId);
    if (termId) params.set("termId", termId);
    router.push(`/broadsheet?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* ── Selector ── */}
      <div className="flex flex-wrap items-end gap-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
        <div>
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Term</label>
          <select
            value={selectedTermId}
            onChange={(e) => handleTermChange(e.target.value)}
            className="border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select term…</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {data && (
          <div className="ml-auto">
            <ExportButtons
              contentId="broadsheet-content"
              filename={`Broadsheet_${data.className}_${data.termLabel.replace(/\s+/g, "_")}`}
              pdfTitle={`${data.className} - ${data.termLabel} Broadsheet`}
            />
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!data && (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-body-md text-body-md">Select a class and term to view the broadsheet.</p>
        </div>
      )}

      {/* ── Broadsheet ── */}
      {data && (
        <div
          id="broadsheet-content"
          className="border border-outline-variant rounded-xl overflow-hidden shadow-sm"
        >
          {/* Header bar */}
          <div className="px-5 py-3 border-b border-outline-variant bg-[#002046] text-white flex items-center justify-between">
            <div>
              <p className="font-label-sm text-label-sm opacity-70 uppercase tracking-widest">{schoolName}</p>
              <h1 className="font-headline-sm text-headline-sm font-bold tracking-wide">TERM RESULT BROADSHEET</h1>
              <p className="font-body-sm text-body-sm opacity-70 mt-0.5">
                {data.className} &middot; {data.termLabel} &middot; {data.generatedAt}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/70">
              <span>{data.students.length} students</span>
              <span>&middot;</span>
              <span>{data.subjects.length} subjects</span>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-auto bs-scroll-container" style={{ maxHeight: "75vh" }}>
            <BroadsheetTable data={data} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Broadsheet Table
// ─────────────────────────────────────────────────────────────────────────────

// Max marks per assessment code — used in header row 3
const MAX_MARKS: Record<string, number> = {
  WBT: 15,
  MDT: 25,
  EXAM: 60,
  CA1: 20,
  CA2: 20,
  CA3: 20,
  EXM: 40,
};

function BroadsheetTable({ data }: { data: BroadsheetData }) {
  const { subjects, students, footers, assessmentTypeCodes } = data;
  // per subject: assessmentCodes + Total + Grade
  const colSpanPerSubject = assessmentTypeCodes.length + 2;
  // Summary columns on the right (must be sticky-right)
  const SUMMARY_COUNT = 4; // Grand Total | Average | Grade | Position

  return (
    <>
      <table className="bs-table">
        {/* ── COLGROUP for sticky right columns ── */}
        <colgroup>
          <col className="col-sn" />
          <col className="col-adm" />
          <col className="col-name" />
          {subjects.flatMap((_, si) => [
            ...assessmentTypeCodes.map((__, ci) => <col key={`c-${si}-${ci}`} className="col-score" />),
            <col key={`c-${si}-total`} className="col-total" />,
            <col key={`c-${si}-grade`} className="col-grade" />,
          ])}
          <col className="col-summary" />
          <col className="col-summary" />
          <col className="col-summary" />
          <col className="col-summary col-pos" />
        </colgroup>

        {/* ── HEADER ── */}
        <thead>
          {/* Row 1: Subject names */}
          <tr className="bs-header-row">
            <th rowSpan={3} className="bs-fixed-left bs-sn bs-th">S/N</th>
            <th rowSpan={3} className="bs-fixed-left bs-adm bs-th">Adm. No</th>
            <th rowSpan={3} className="bs-fixed-left bs-name bs-th" style={{ textAlign: "left" }}>Student Name</th>
            {subjects.map((sub) => (
              <th key={sub.id} colSpan={colSpanPerSubject} className="bs-th bs-subject-header">
                {sub.name}
              </th>
            ))}
            <th rowSpan={3} className="bs-th bs-summary-col bs-sticky-right-0">Grand<br />Total</th>
            <th rowSpan={3} className="bs-th bs-summary-col bs-sticky-right-1">Avg<br />(%)</th>
            <th rowSpan={3} className="bs-th bs-summary-col bs-sticky-right-2">Grade</th>
            <th rowSpan={3} className="bs-th bs-summary-col bs-sticky-right-3">Pos.</th>
          </tr>

          {/* Row 2: Assessment codes + Total + Grade per subject */}
          <tr className="bs-header-row">
            {subjects.flatMap((sub) => [
              ...assessmentTypeCodes.map((code) => (
                <th key={`${sub.id}-${code}`} className="bs-th bs-code-header">{code}</th>
              )),
              <th key={`${sub.id}-total`} className="bs-th bs-code-header bs-total-header">Total</th>,
              <th key={`${sub.id}-grade`} className="bs-th bs-code-header bs-grade-header">Grd</th>,
            ])}
          </tr>

          {/* Row 3: Max marks */}
          <tr className="bs-header-row bs-maxmarks-row">
            {subjects.flatMap((sub) => [
              ...assessmentTypeCodes.map((code) => (
                <th key={`${sub.id}-m-${code}`} className="bs-th bs-maxmarks-cell">
                  /{MAX_MARKS[code] ?? "—"}
                </th>
              )),
              <th key={`${sub.id}-m-total`} className="bs-th bs-maxmarks-cell">/100</th>,
              <th key={`${sub.id}-m-grade`} className="bs-th bs-maxmarks-cell">&nbsp;</th>,
            ])}
          </tr>
        </thead>

        {/* ── BODY ── */}
        <tbody>
          {students.length === 0 && (
            <tr>
              <td colSpan={3 + subjects.length * colSpanPerSubject + SUMMARY_COUNT} className="bs-empty">
                No students found in this class for the selected term.
              </td>
            </tr>
          )}
          {students.map((student, idx) => (
            <tr key={student.id} className={idx % 2 === 0 ? "bs-row-even" : "bs-row-odd"}>
              <td className="bs-fixed-left bs-sn bs-td-center">{student.sn}</td>
              <td className="bs-fixed-left bs-adm bs-td">{student.admissionNumber}</td>
              <td className="bs-fixed-left bs-name bs-td-name">{student.fullName}</td>

              {subjects.map((sub) => (
                <>
                  {assessmentTypeCodes.map((code) => {
                    const raw = student.scores[sub.id]?.[code];
                    const isResit = data.resitIndicators.has(`${student.id}:${sub.id}`);
                    return (
                      <td key={`${student.id}-${sub.id}-${code}`} className="bs-td-center bs-score">
                        {raw != null ? (
                          <>
                            {Math.round(raw)}
                            {isResit && <sup className="text-red-500 font-bold ml-px">*</sup>}
                          </>
                        ) : (
                          <span className="bs-null">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="bs-td-center bs-score bs-total-cell">
                    {(() => {
                      const v = student.totals[sub.id];
                      return v != null ? (
                        <span className={v >= 75 ? "bs-score-a1" : v >= 50 ? "bs-score-pass" : "bs-score-fail"}>
                          {Math.round(v)}
                        </span>
                      ) : <span className="bs-null">—</span>;
                    })()}
                  </td>
                  <td className="bs-td-center bs-grade-cell">
                    {(() => {
                      const g = student.grades[sub.id];
                      return g ? <span className={gradeClass(g)}>{g}</span> : <span className="bs-null">—</span>;
                    })()}
                  </td>
                </>
              ))}

              {/* Summary — sticky right */}
              <td className="bs-td-center bs-summary-col bs-sticky-right-0">
                {student.grandTotal != null ? Math.round(student.grandTotal) : <span className="bs-null">—</span>}
              </td>
              <td className="bs-td-center bs-summary-col bs-sticky-right-1 font-semibold">
                {student.average != null ? Math.round(student.average) : <span className="bs-null">—</span>}
              </td>
              <td className="bs-td-center bs-summary-col bs-sticky-right-2">
                {student.overallGrade ? (
                  <span className={gradeClass(student.overallGrade)}>{student.overallGrade}</span>
                ) : <span className="bs-null">—</span>}
              </td>
              <td className="bs-td-center bs-summary-col bs-sticky-right-3 font-bold">
                {student.position ?? <span className="bs-null">—</span>}
              </td>
            </tr>
          ))}
        </tbody>

        {/* ── FOOTER ── */}
        <tfoot>
          {(["Class Average", "Highest", "Lowest"] as const).map((label, fi) => {
            const footerKey: Record<string, keyof typeof footers[0]> = {
              "Class Average": "classAverage",
              "Highest": "highest",
              "Lowest": "lowest",
            };
            const fk = footerKey[label];
            return (
              <tr key={label} className="bs-footer-row">
                <td colSpan={3} className="bs-fixed-left bs-footer-label">
                  {label}
                </td>
                {subjects.flatMap((sub) => {
                  const f = footers.find((ft) => ft.subjectId === sub.id);
                  return [
                    ...assessmentTypeCodes.map((code) => (
                      <td key={`f${fi}-${sub.id}-${code}`} className="bs-footer-cell">—</td>
                    )),
                    <td key={`f${fi}-${sub.id}-total`} className="bs-footer-cell bs-footer-highlight">
                      {f?.[fk] ?? "—"}
                    </td>,
                    <td key={`f${fi}-${sub.id}-grade`} className="bs-footer-cell">—</td>,
                  ];
                })}
                {/* Sticky-right summary footer cells */}
                <td className="bs-footer-cell bs-summary-col bs-sticky-right-0">—</td>
                <td className="bs-footer-cell bs-summary-col bs-sticky-right-1">—</td>
                <td className="bs-footer-cell bs-summary-col bs-sticky-right-2">—</td>
                <td className="bs-footer-cell bs-summary-col bs-sticky-right-3">—</td>
              </tr>
            );
          })}
        </tfoot>
      </table>

      {/* ── Bottom info ── */}
      <div className="px-5 py-4 bg-gray-50 border-t border-outline-variant flex flex-wrap gap-6 justify-between items-start text-xs text-gray-600">
        <div>
          <p className="font-semibold text-gray-700 mb-1">Grading Scale</p>
          <p>A1 (75–100) Excellent · B2 (70–74) Very Good · B3 (65–69) Good · C4 (60–64) Credit · C5 (55–59) Credit</p>
          <p>C6 (50–54) Credit · D7 (45–49) Pass · E8 (40–44) Pass · F9 (0–39) Fail</p>
          <p className="mt-1 text-gray-400">*Resit score</p>
        </div>
        <div className="space-y-4 text-right">
          {["Class Teacher", "Exam Officer / HOD", "Principal"].map((role) => (
            <div key={role} className="flex gap-8 items-end justify-end">
              <span className="font-semibold text-gray-700 min-w-[130px] text-right">{role}</span>
              <span className="border-b border-gray-400 w-32 inline-block text-gray-400">Date: ___________</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
/* ─────────────────────────────────────────────
   BROADSHEET TABLE — sticky left + right
──────────────────────────────────────────────*/
.bs-table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
  font-size: 10px;
  line-height: 1.35;
  background: white;
}

.bs-table th,
.bs-table td {
  border-right: 0.5px solid #d0d0d0;
  border-bottom: 0.5px solid #d0d0d0;
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

/* ── Sticky left ── */
.bs-fixed-left {
  position: sticky;
  z-index: 4;
  background: #f0f4f8;
}
.bs-sn   { left: 0px;   min-width: 28px; max-width: 28px; border-right: 1px solid #b0b0b0 !important; }
.bs-adm  { left: 28px;  min-width: 72px; max-width: 72px; border-right: 1px solid #b0b0b0 !important; }
.bs-name { left: 100px; min-width: 150px; max-width: 160px; border-right: 2px solid #888 !important; }

/* ── Sticky right offsets (4 columns from right: GT, Avg, Grade, Pos) ── */
.bs-sticky-right-3 { position: sticky; right: 0px;   z-index: 4; background: #f5f0ff !important; border-left: 2px solid #888 !important; min-width: 32px; }
.bs-sticky-right-2 { position: sticky; right: 32px;  z-index: 4; background: #f5f0ff !important; border-left: 1px solid #b0b0b0 !important; min-width: 38px; }
.bs-sticky-right-1 { position: sticky; right: 70px;  z-index: 4; background: #e8f5e9 !important; border-left: 1px solid #b0b0b0 !important; min-width: 38px; }
.bs-sticky-right-0 { position: sticky; right: 108px; z-index: 4; background: #e8f5e9 !important; border-left: 1px solid #b0b0b0 !important; min-width: 48px; }

/* ── Header rows ── */
.bs-header-row th {
  background: #002046;
  color: white;
  font-weight: 700;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 4px 4px;
  position: sticky;
  top: 0;
  z-index: 5;
  border-bottom: 1px solid #335 !important;
  border-right: 0.5px solid rgba(255,255,255,0.15) !important;
}

/* Header-left cells need higher z-index */
.bs-header-row .bs-fixed-left {
  z-index: 6 !important;
  background: #001530 !important;
}
/* Header-right sticky cells */
.bs-header-row .bs-sticky-right-0,
.bs-header-row .bs-sticky-right-1,
.bs-header-row .bs-sticky-right-2,
.bs-header-row .bs-sticky-right-3 {
  z-index: 6 !important;
  background: #1a3a5c !important;
}

.bs-subject-header {
  font-size: 10px !important;
  font-weight: 700 !important;
  background: #003366 !important;
  border-left: 1px solid rgba(255,255,255,0.2) !important;
  border-right: 1px solid rgba(255,255,255,0.2) !important;
  text-align: center !important;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bs-code-header { font-size: 8px !important; font-weight: 600 !important; background: #1a3a5c !important; }
.bs-total-header { background: #254a6e !important; font-weight: 700 !important; }
.bs-grade-header { background: #254a6e !important; }

.bs-maxmarks-row th {
  background: #e8ecf0 !important;
  color: #555 !important;
  font-size: 7px !important;
  font-weight: 500 !important;
  padding: 1px 3px !important;
  top: auto !important;
  position: sticky;
  top: 54px; /* approximate 2-row offset */
}

/* ── Body rows ── */
.bs-row-even td { background: #ffffff; }
.bs-row-odd  td { background: #f7f9fb; }
.bs-row-even .bs-fixed-left, .bs-row-odd .bs-fixed-left { background: #f0f4f8; }
.bs-row-even .bs-sticky-right-0, .bs-row-odd .bs-sticky-right-0 { background: #edfaee !important; }
.bs-row-even .bs-sticky-right-1, .bs-row-odd .bs-sticky-right-1 { background: #edfaee !important; }
.bs-row-even .bs-sticky-right-2, .bs-row-odd .bs-sticky-right-2 { background: #f0edff !important; }
.bs-row-even .bs-sticky-right-3, .bs-row-odd .bs-sticky-right-3 { background: #f0edff !important; }

.bs-td { padding: 2px 5px; text-align: left; font-size: 10px; }
.bs-td-center { padding: 2px 4px; text-align: center; font-size: 10px; }
.bs-td-name { padding: 2px 6px; text-align: left; font-size: 10px; font-weight: 500; }

.bs-score { min-width: 26px; }
.bs-total-cell { font-weight: 700; background: #fafafa; border-left: 1px solid #ccc !important; min-width: 30px; }
.bs-grade-cell { font-weight: 700; font-size: 9px; border-right: 1px solid #aaa !important; min-width: 22px; }
.bs-null { color: #bbb; font-size: 9px; }

.bs-score-a1   { color: #14532d; font-weight: 700; }
.bs-score-pass { color: #1e3a5f; }
.bs-score-fail { color: #7f1d1d; }

/* ── Footer rows ── */
.bs-footer-row td {
  position: sticky;
  z-index: 3;
  background: #edf2f7;
  font-weight: 700;
  font-size: 9px;
  border-top: 1.5px solid #888;
  border-bottom: 0.5px solid #bbb;
}
/* Stack the 3 footer rows */
.bs-footer-row:nth-child(1) td { bottom: 48px; }
.bs-footer-row:nth-child(2) td { bottom: 24px; }
.bs-footer-row:nth-child(3) td { bottom: 0px; }

/* Footer left label */
.bs-footer-label {
  text-align: left !important;
  padding-left: 8px !important;
  font-weight: 700;
  background: #dde6ef !important;
  border-right: 2px solid #888 !important;
}
.bs-footer-cell { min-width: 26px; }
.bs-footer-highlight { background: #d4edda !important; font-weight: 700; }

/* Footer sticky-right cells */
.bs-footer-row .bs-sticky-right-0 { background: #c8e6c9 !important; z-index: 5 !important; }
.bs-footer-row .bs-sticky-right-1 { background: #c8e6c9 !important; z-index: 5 !important; }
.bs-footer-row .bs-sticky-right-2 { background: #d5ccff !important; z-index: 5 !important; }
.bs-footer-row .bs-sticky-right-3 { background: #d5ccff !important; z-index: 5 !important; }

/* ── Empty state ── */
.bs-empty {
  padding: 48px 16px;
  text-align: center;
  color: #888;
  font-size: 12px;
}

/* ── Scrollbar ── */
.bs-scroll-container::-webkit-scrollbar { height: 6px; width: 6px; }
.bs-scroll-container::-webkit-scrollbar-track { background: #f0f0f0; }
.bs-scroll-container::-webkit-scrollbar-thumb { background: #bbb; border-radius: 3px; }

/* ── Print ── */
@media print {
  @page { size: A3 landscape; margin: 0.8cm; }
  .bs-table { font-size: 7px; }
  .bs-table th, .bs-table td { padding: 1px 2px; }
  .bs-fixed-left.bs-name { min-width: 100px !important; max-width: 110px !important; }
  .bs-sticky-right-0, .bs-sticky-right-1, .bs-sticky-right-2, .bs-sticky-right-3 { position: static !important; }
  .bs-fixed-left { position: static !important; }
  .bs-footer-row td { position: static !important; }
}
      `}</style>
    </>
  );
}

// Grade coloring helper
function gradeClass(grade: string | null): string {
  if (!grade) return "";
  const g = grade.toUpperCase();
  if (g === "A1") return "bs-score-a1";
  if (g === "B2" || g === "B3") return "text-blue-700 font-semibold";
  if (g.startsWith("C")) return "text-yellow-700";
  if (g === "D7" || g === "E8") return "text-orange-600";
  return "bs-score-fail";
}
