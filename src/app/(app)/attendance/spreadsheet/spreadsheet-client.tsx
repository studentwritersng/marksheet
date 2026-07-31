"use client";

import { useState, useMemo } from "react";
import {
  getStudentAttendanceSpreadsheet,
  getStaffAttendanceSpreadsheet,
  type AttendanceStatus,
} from "@/lib/attendance/actions";
import { exportToCSV } from "@/lib/export/csv";

interface ClassVM { id: string; name: string; level: string; section: string }

interface StudentRow {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  dates: { date: string; status: AttendanceStatus | null }[];
}

interface StaffRow {
  staffId: string;
  fullName: string;
  dates: { date: string; status: AttendanceStatus | null }[];
}

const STATUS_MAP: Record<string, string> = {
  present: "P",
  absent: "A",
  late: "L",
  excused: "E",
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-[#E8F5E9] text-[#2E7D32]",
  absent: "bg-[#FFEBEE] text-[#C62828]",
  late: "bg-[#FFF8E1] text-[#F57F17]",
  excused: "bg-[#E3F2FD] text-[#1565C0]",
};

export function SpreadsheetView({ schoolId, classes, today, isAdmin }: { schoolId: string; classes: ClassVM[]; today: string; isAdmin: boolean }) {
  const [mode, setMode] = useState<"students" | "staff">("students");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StudentRow[] | StaffRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      if (mode === "students") {
        const data = await getStudentAttendanceSpreadsheet(schoolId, classId, fromDate, toDate);
        setRows(data.rows);
        setDates(data.rows[0]?.dates.map((d) => d.date) ?? []);
      } else {
        const data = await getStaffAttendanceSpreadsheet(schoolId, fromDate, toDate);
        setRows(data.rows);
        setDates(data.rows[0]?.dates.map((d) => d.date) ?? []);
      }
    } catch (e) {
      console.error("Failed to load attendance spreadsheet", e);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    if (rows.length === 0 || dates.length === 0) return;

    const headers = mode === "students"
      ? ["Admission No.", "Student Name", ...dates.map((d) => d)]
      : ["Staff Name", ...dates.map((d) => d)];

    const csvRows = rows.map((row) => {
      const base = mode === "students"
        ? [(row as StudentRow).admissionNumber, (row as StudentRow).fullName]
        : [(row as StaffRow).fullName];
      const statuses = row.dates.map((d) => STATUS_MAP[d.status ?? ""] ?? "");
      return [...base, ...statuses];
    });

    const filename = `Attendance_${mode}_${fromDate}_to_${toDate}`.replace(/\s+/g, "_");
    exportToCSV(headers, csvRows, filename);
  }

  function handlePrint() {
    if (rows.length === 0) return;
    const printWin = window.open("", "_blank", "width=1200,height=800");
    if (!printWin) return;

    const title = mode === "students" ? "Student Attendance" : "Staff Attendance";
    const labelColumn = mode === "students" ? "Student" : "Staff";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - ${fromDate} to ${toDate}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { font-size: 18pt; text-align: center; margin-bottom: 4pt; }
          .subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 20pt; }
          table { border-collapse: collapse; width: 100%; font-size: 10pt; }
          th, td { border: 1px solid #999; padding: 4pt 6pt; text-align: center; }
          th { background: #e0e0e0; font-weight: bold; }
          .label-col { text-align: left; font-weight: bold; background: #f5f5f5; }
          .present { background: #E8F5E9; }
          .absent { background: #FFEBEE; }
          .late { background: #FFF8E1; }
          .excused { background: #E3F2FD; }
          .empty { background: #fafafa; color: #ccc; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p class="subtitle">${fromDate} to ${toDate}</p>
        <table>
          <thead>
            <tr>
              <th class="label-col">${labelColumn}</th>
              ${dates.map((d) => {
                const dt = new Date(d + "T00:00:00");
                const day = dt.toLocaleDateString([], { weekday: "short" });
                const dateStr = dt.toLocaleDateString([], { month: "short", day: "numeric" });
                return `<th>${day}<br/>${dateStr}</th>`;
              }).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td class="label-col">${mode === "students" ? (row as StudentRow).fullName : (row as StaffRow).fullName}</td>
                ${row.dates.map((d) => {
                  const status = d.status;
                  if (!status) return `<td class="empty">-</td>`;
                  return `<td class="${status}">${STATUS_MAP[status] ?? status}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as "students" | "staff")}
              className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm">
              <option value="students">Students</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          {mode === "students" && (
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)}
                className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.level} - {c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm" />
          </div>
          <button onClick={loadData} disabled={loading}
            className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366] disabled:opacity-60">
            {loading ? "Loading…" : "Load"}
          </button>
          {rows.length > 0 && (
            <>
              <button onClick={handleExportCSV}
                className="border border-outline-variant px-3 py-2 font-label-sm text-label-sm text-on-surface hover:bg-surface-container">
                Export CSV
              </button>
              <button onClick={handlePrint}
                className="border border-outline-variant px-3 py-2 font-label-sm text-label-sm text-on-surface hover:bg-surface-container">
                Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* Spreadsheet */}
      {rows.length > 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-container">
                <th className="border border-outline-variant px-3 py-2 text-left font-label-sm text-label-sm text-on-surface sticky left-0 bg-surface-container z-10">
                  {mode === "students" ? "Student" : "Staff"}
                </th>
                {mode === "students" && (
                  <th className="border border-outline-variant px-3 py-2 text-left font-label-sm text-label-sm text-on-surface sticky left-[120px] bg-surface-container z-10">
                    Admission No.
                  </th>
                )}
                {dates.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const day = dt.toLocaleDateString([], { weekday: "short" });
                  const dateStr = dt.toLocaleDateString([], { month: "short", day: "numeric" });
                  return (
                    <th key={d} className="border border-outline-variant px-2 py-2 text-center font-label-xs text-label-xs text-on-surface-variant min-w-[50px]">
                      {day}<br/>{dateStr}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                  <td className="border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm text-on-surface sticky left-0 bg-surface-container-lowest z-10">
                    {mode === "students" ? (row as StudentRow).fullName : (row as StaffRow).fullName}
                  </td>
                  {mode === "students" && (
                    <td className="border border-outline-variant px-3 py-1.5 font-body-sm text-body-sm text-on-surface-variant sticky left-[120px] bg-surface-container-lowest z-10">
                      {(row as StudentRow).admissionNumber}
                    </td>
                  )}
                  {row.dates.map((d) => {
                    const status = d.status;
                    if (!status) {
                      return (
                        <td key={d.date} className="border border-outline-variant px-2 py-1.5 text-center">
                          <span className="text-on-surface-variant text-xs">-</span>
                        </td>
                      );
                    }
                    return (
                      <td key={d.date} className={`border border-outline-variant px-2 py-1.5 text-center font-label-sm text-label-sm ${STATUS_COLORS[status] ?? ""}`}>
                        {STATUS_MAP[status] ?? status}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {loading ? "Loading..." : "Select a date range and click Load to view attendance."}
          </p>
        </div>
      )}
    </div>
  );
}
