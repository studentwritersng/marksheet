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
    <div>
      {/* Selector */}
      <div className="flex flex-wrap items-end gap-4 mb-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
        <div>
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="border border-outline-variant rounded p-2 font-body-md text-body-md"
          >
            <option value="">Select class...</option>
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
            className="border border-outline-variant rounded p-2 font-body-md text-body-md"
          >
            <option value="">Select term...</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Broadsheet */}
      {!data && (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-12">
          Select a class and term to view the broadsheet.
        </p>
      )}

      {data && (
        <div id="broadsheet-content" className="overflow-auto border border-outline-variant rounded-lg">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
            <div className="space-y-1">
              <p className="font-label-md text-label-md text-primary">{schoolName}</p>
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">TERM RESULT BROADSHEET</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {data.className} &middot; {data.termLabel} &middot; Generated: {data.generatedAt}
              </p>
            </div>
            <ExportButtons
              contentId="broadsheet-content"
              filename={`Broadsheet_${data.className}_${data.termLabel.replace(/\s+/g, "_")}`}
              pdfTitle={`${data.className} - ${data.termLabel} Broadsheet`}
            />
          </div>

          <div className="overflow-x-auto" style={{ minHeight: 400 }}>
            <BroadsheetTable data={data} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Broadsheet Table
// ---------------------------------------------------------------------------

function BroadsheetTable({ data }: { data: BroadsheetData }) {
  const { subjects, students, footers, assessmentTypeCodes } = data;
  const colSpanPerSubject = assessmentTypeCodes.length + 2; // codes + Total + Grade

  return (
    <table className="broadsheet-table">
      {/* --- HEADER ROWS --- */}
      <thead>
        {/* Row 1: Subject header spanning assessment sub-columns */}
        <tr className="broadsheet-header">
          <th rowSpan={3} className="fixed-left sn">S/N</th>
          <th rowSpan={3} className="fixed-left adm">Adm No</th>
          <th rowSpan={3} className="fixed-left name">Student Name</th>
          {subjects.map((sub) => (
            <th key={sub.id} colSpan={colSpanPerSubject} className="subject-group">
              {sub.name}
            </th>
          ))}
          <th rowSpan={3} className="summary-col">Grand Total</th>
          <th rowSpan={3} className="summary-col">Average</th>
          <th rowSpan={3} className="summary-col">Grade</th>
          <th rowSpan={3} className="summary-col pos">Position</th>
        </tr>

        {/* Row 2: Assessment type codes + Total + Grade per subject */}
        <tr className="broadsheet-header">
          {subjects.flatMap((sub) => [
            ...assessmentTypeCodes.map((code) => (
              <th key={`${sub.id}-${code}`} className="assess-code">{code}</th>
            )),
            <th key={`${sub.id}-total`} className="assess-code">Total</th>,
            <th key={`${sub.id}-grade`} className="assess-code">Grade</th>,
          ])}
          {subjects.length === 0 && <th colSpan={4} className="assess-code">No subjects</th>}
        </tr>

        {/* Row 3: Sub-columns (max marks / placeholder) */}
        <tr className="broadsheet-header">
          {subjects.flatMap((sub) => [
            ...assessmentTypeCodes.map((_code, ci) => (
              <th key={`${sub.id}-p-${ci}`} className="assess-code-sub">MAX</th>
            )),
            <th key={`${sub.id}-max-total`} className="assess-code-sub">100</th>,
            <th key={`${sub.id}-max-grade`} className="assess-code-sub">&nbsp;</th>,
          ])}
        </tr>
      </thead>

      {/* --- BODY ROWS --- */}
      <tbody>
        {students.length === 0 && (
          <tr>
            <td colSpan={3 + subjects.length * colSpanPerSubject + 4} className="text-center py-8 text-on-surface-variant">
              No students found in this class.
            </td>
          </tr>
        )}
        {students.map((student, idx) => (
          <tr key={student.id} className={idx % 2 === 1 ? "row-alt" : ""}>
            <td className="fixed-left sn">{student.sn}</td>
            <td className="fixed-left adm">{student.admissionNumber}</td>
            <td className="fixed-left name">{student.fullName}</td>
            {subjects.map((sub) => (
              <>
                {assessmentTypeCodes.map((code) => {
                  const score = student.scores[sub.id]?.[code];
                  const isResit = data.resitIndicators.has(`${student.id}:${sub.id}`);
                  return (
                    <td key={`${student.id}-${sub.id}-${code}`} className="score-cell">
                      {score != null ? (
                        <span>
                          {score}
                          {isResit ? <sup className="text-red-600 font-bold">*</sup> : null}
                        </span>
                      ) : "-"}
                    </td>
                  );
                })}
                <td className="score-cell total">
                  {student.totals[sub.id] != null ? student.totals[sub.id] : "-"}
                </td>
                <td className="score-cell grade">
                  {student.grades[sub.id] ?? "-"}
                </td>
              </>
            ))}
            <td className="summary-col">{student.grandTotal != null ? Math.round(student.grandTotal * 10) / 10 : "-"}</td>
            <td className="summary-col">{student.average != null ? Math.round(student.average * 10) / 10 : "-"}</td>
            <td className="summary-col">{student.overallGrade ?? "-"}</td>
            <td className="summary-col pos">{student.position ?? "-"}</td>
          </tr>
        ))}
      </tbody>

      {/* --- FOOTER ROWS --- */}
      <tfoot>
        {/* Class Average */}
        <tr className="broadsheet-footer">
          <td colSpan={3} className="footer-label">Class Average</td>
          {subjects.map((sub) => {
            const f = footers.find((ft) => ft.subjectId === sub.id);
            return (
              <>
                {assessmentTypeCodes.map((code) => (
                  <td key={`avg-${sub.id}-${code}`} className="footer-cell">-</td>
                ))}
                <td className="footer-cell">{f?.classAverage ?? "-"}</td>
                <td className="footer-cell">&nbsp;</td>
              </>
            );
          })}
          <td className="footer-cell">-</td>
          <td className="footer-cell">-</td>
          <td className="footer-cell">&nbsp;</td>
          <td className="footer-cell">&nbsp;</td>
        </tr>

        {/* Highest Score */}
        <tr className="broadsheet-footer">
          <td colSpan={3} className="footer-label">Highest</td>
          {subjects.map((sub) => {
            const f = footers.find((ft) => ft.subjectId === sub.id);
            return (
              <>
                {assessmentTypeCodes.map((code) => (
                  <td key={`hi-${sub.id}-${code}`} className="footer-cell">-</td>
                ))}
                <td className="footer-cell">{f?.highest ?? "-"}</td>
                <td className="footer-cell">&nbsp;</td>
              </>
            );
          })}
          <td className="footer-cell">-</td>
          <td className="footer-cell">-</td>
          <td className="footer-cell">&nbsp;</td>
          <td className="footer-cell">&nbsp;</td>
        </tr>

        {/* Lowest Score */}
        <tr className="broadsheet-footer">
          <td colSpan={3} className="footer-label">Lowest</td>
          {subjects.map((sub) => {
            const f = footers.find((ft) => ft.subjectId === sub.id);
            return (
              <>
                {assessmentTypeCodes.map((code) => (
                  <td key={`lo-${sub.id}-${code}`} className="footer-cell">-</td>
                ))}
                <td className="footer-cell">{f?.lowest ?? "-"}</td>
                <td className="footer-cell">&nbsp;</td>
              </>
            );
          })}
          <td className="footer-cell">-</td>
          <td className="footer-cell">-</td>
          <td className="footer-cell">&nbsp;</td>
          <td className="footer-cell">&nbsp;</td>
        </tr>
      </tfoot>

      {/* --- BOTTOM INFO --- */}
      <caption className="broadsheet-footer-info">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="font-bold text-sm">Grading Scale:</p>
            <p className="text-xs text-on-surface-variant">
              A1 (75-100) Excellent &middot; B2 (70-74) V.Good &middot; B3 (65-69) Good &middot;
              C4 (60-64) Credit &middot; C5 (55-59) Credit &middot; C6 (50-54) Credit &middot;
              D7 (45-49) Pass &middot; E8 (40-44) Pass &middot; F9 (0-39) Fail
            </p>
          </div>
          <div className="text-right space-y-4 mt-4">
            <div className="signature-line">
              <span className="signature-label">Class Teacher</span>
              <span className="signature-date">Date: _______________</span>
            </div>
            <div className="signature-line">
              <span className="signature-label">Exam Officer / HOD</span>
              <span className="signature-date">Date: _______________</span>
            </div>
            <div className="signature-line">
              <span className="signature-label">Principal</span>
              <span className="signature-date">Date: _______________</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          *Resit score &middot; This document is an internal administrative record.
        </p>
      </caption>

      <style>
        {`
/* ------------------------------------------------------------------ */
/* Broadsheet table styles — landscape-oriented, dense grid           */
/* ------------------------------------------------------------------ */
.broadsheet-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
  font-size: 10px;
  line-height: 1.3;
  color: #000;
  background: white;
  position: relative;
}

.broadsheet-table th,
.broadsheet-table td {
  border: 0.5px solid #999;
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

.broadsheet-table .fixed-left {
  position: sticky;
  left: 0;
  z-index: 3;
  background: #f5f5f5;
  text-align: left;
}
.broadsheet-table .fixed-left.sn { width: 28px; min-width: 28px; left: 0; text-align: center; }
.broadsheet-table .fixed-left.adm { width: 70px; min-width: 70px; left: 28px; }
.broadsheet-table .fixed-left.name { width: 150px; min-width: 120px; left: 98px; }

.broadsheet-header th {
  background: #e8e8e8;
  font-weight: 700;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 3px 4px;
  border-bottom: 1.5px solid #666;
}
.broadsheet-header .subject-group {
  background: #d9d9d9;
  font-size: 10px;
  border-left: 1px solid #aaa;
  border-right: 1px solid #aaa;
}
.broadsheet-header .assess-code {
  font-size: 8px;
  font-weight: 600;
  padding: 2px 3px;
  min-width: 26px;
}
.broadsheet-header .assess-code-sub {
  font-size: 7px;
  font-weight: 400;
  color: #555;
  padding: 1px 3px;
  min-width: 26px;
}
.broadsheet-header .summary-col {
  background: #d0d0d0;
  min-width: 50px;
  border-left: 1px solid #888;
}
.broadsheet-header .pos {
  min-width: 35px;
}

.score-cell {
  font-size: 10px;
  padding: 2px 4px;
  min-width: 26px;
}
.score-cell.total {
  font-weight: 600;
  background: #fafafa;
  border-left: 0.5px solid #ccc;
}
.score-cell.grade {
  font-weight: 700;
  font-size: 9px;
  border-right: 0.5px solid #ccc;
}

.summary-col {
  font-weight: 700;
  font-size: 10px;
  background: #f0f0f0;
  border-left: 1.5px solid #888;
  min-width: 45px;
}
.pos { min-width: 30px; }

.row-alt td { background: #f9f9f9; }
.row-alt td.fixed-left { background: #f0f0f0; }

.broadsheet-footer td {
  font-weight: 700;
  font-size: 9px;
  background: #ececec;
  border-top: 1.5px solid #666;
  padding: 3px 4px;
}
.broadsheet-footer .footer-label {
  text-align: left;
  font-size: 9px;
  padding-left: 6px;
}
.broadsheet-footer .footer-cell {
  min-width: 26px;
  font-size: 9px;
}

.broadsheet-footer-info {
  caption-side: bottom;
  padding: 12px 8px;
  background: white;
  border-top: 1px solid #999;
}

.signature-line {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: flex-end;
}
.signature-label {
  font-weight: 700;
  font-size: 10px;
  min-width: 130px;
  text-align: right;
}
.signature-date {
  font-size: 10px;
  color: #555;
  min-width: 120px;
  border-bottom: 0.5px solid #999;
}

/* Landscape print */
@media print {
  @page {
    size: A4 landscape;
    margin: 1cm;
  }
  .broadsheet-table { font-size: 8px; }
  .broadsheet-table th,
  .broadsheet-table td { padding: 1px 3px; }
  .broadsheet-table .fixed-left.name { width: 120px; min-width: 100px; }
}
`}
      </style>
    </table>
  );
}
