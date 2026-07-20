"use client";

import { useState, useActionState, useRef } from "react";
import { createPeriodAction, setEntryAction } from "@/lib/timetable/actions";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function TimetableView({
  classes,
  periods,
  subjects,
  staff,
  entries,
}: {
  classes: { id: string; name: string }[];
  periods: { id: string; name: string; startTime: string; endTime: string; periodType?: string }[];
  subjects: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  entries: { id: string; classId: string; className: string; periodId: string; dayOfWeek: number; subjectName: string; staffId: string; staffName: string }[];
}) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodState, periodAction, periodPending] = useActionState(createPeriodAction, {});
  const [entryState, entryAction, entryPending] = useActionState(setEntryAction, {});
  const [editCell, setEditCell] = useState<{ periodId: string; dayOfWeek: number } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const classEntries = entries.filter((e) => e.classId === selectedClass);

  function getEntry(periodId: string, day: number) {
    return classEntries.find((e) => e.periodId === periodId && e.dayOfWeek === day);
  }

  // Filter out assembly and closing periods
  const filteredPeriods = periods.filter(
    (p) => p.periodType !== "assembly" && p.periodType !== "assemble" && p.periodType !== "closing"
  );

  // Live Clash Checking
  const teacherClashes: {
    staffId: string;
    staffName: string;
    dayOfWeek: number;
    periodId: string;
    periodName: string;
    classes: string[];
  }[] = [];

  const subjectClashes: {
    classId: string;
    className: string;
    subjectName: string;
    dayOfWeek: number;
    periods: string[];
  }[] = [];

  // 1. Check teacher clashes (same teacher in different classes at the same period & day)
  const teacherGroups: Record<string, typeof entries> = {};
  for (const entry of entries) {
    if (!entry.staffId) continue;
    // Only check for teacher clashes in filtered periods
    if (!filteredPeriods.some(p => p.id === entry.periodId)) continue;
    const key = `${entry.staffId}|${entry.dayOfWeek}|${entry.periodId}`;
    if (!teacherGroups[key]) teacherGroups[key] = [];
    teacherGroups[key].push(entry);
  }

  for (const key in teacherGroups) {
    const group = teacherGroups[key];
    if (group.length > 1) {
      const first = group[0];
      const periodName = filteredPeriods.find(p => p.id === first.periodId)?.name ?? "Unknown Period";
      teacherClashes.push({
        staffId: first.staffId,
        staffName: first.staffName,
        dayOfWeek: first.dayOfWeek,
        periodId: first.periodId,
        periodName,
        classes: Array.from(new Set(group.map(g => g.className))),
      });
    }
  }

  // 2. Check subject duplicate clashes (same subject multiple times per day per class)
  const classDaySubjectGroups: Record<string, typeof entries> = {};
  for (const entry of entries) {
    // Only check for subject clashes in filtered periods
    if (!filteredPeriods.some(p => p.id === entry.periodId)) continue;
    const key = `${entry.classId}|${entry.dayOfWeek}|${entry.subjectName}`;
    if (!classDaySubjectGroups[key]) classDaySubjectGroups[key] = [];
    classDaySubjectGroups[key].push(entry);
  }

  for (const key in classDaySubjectGroups) {
    const group = classDaySubjectGroups[key];
    if (group.length > 1) {
      const first = group[0];
      const pNames = group.map(g => {
        return filteredPeriods.find(p => p.id === g.periodId)?.name ?? "Unknown";
      });
      subjectClashes.push({
        classId: first.classId,
        className: first.className,
        subjectName: first.subjectName,
        dayOfWeek: first.dayOfWeek,
        periods: pNames,
      });
    }
  }

  const hasClashes = teacherClashes.length > 0 || subjectClashes.length > 0;

  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const selectedClassName = classes.find((c) => c.id === selectedClass)?.name ?? "";

    const tableRows = DAYS.map((dayName, dayIndex) => {
      const cells = filteredPeriods.map((period) => {
        if (period.periodType === "break") {
          if (dayIndex > 0) return ""; // Omit Monday-Friday for subsequent rows to allow vertical rowspan merge
          return `<td rowspan="5" style="border:1px solid #000;padding:12px 6px;font-size:18px;font-weight:bold;text-align:center;vertical-align:middle;background:#f9f9f9;writing-mode:vertical-lr;transform:rotate(180deg);letter-spacing:4px;text-transform:uppercase;color:#333;">
            ${period.name}
          </td>`;
        }
        const entry = getEntry(period.id, dayIndex);
        return entry
          ? `<td style="border:1px solid #000;padding:6px 10px;font-size:12px;text-align:center;vertical-align:middle;">
              <div style="font-weight:600;">${entry.subjectName}</div>
              <div style="font-size:11px;color:#555;">${entry.staffName}</div>
            </td>`
          : `<td style="border:1px solid #000;padding:6px 10px;font-size:12px;text-align:center;color:#999;"></td>`;
      }).join("");
      return `<tr><td style="border:1px solid #000;padding:6px 10px;font-weight:600;font-size:12px;background:#f5f5f5;">${dayName}</td>${cells}</tr>`;
    });

    const periodHeaders = filteredPeriods.map((p) => {
      const title = p.periodType === "break" ? p.name : "";
      return `<th style="border:1px solid #000;padding:6px 10px;font-size:12px;background:#f5f5f5;text-align:center;">
        ${title ? `<div style="font-weight:700;color:#002046;margin-bottom:2px;text-transform:uppercase;">${title}</div>` : ""}
        <span style="font-weight:600;font-size:11px;color:#555;">${p.startTime}-${p.endTime}</span>
      </th>`;
    }).join("");

    printWindow.document.write(`
      <html>
      <head>
        <title>Timetable - ${selectedClassName}</title>
        <style>
          body { font-family:Arial,sans-serif; margin:20px; }
          h1 { font-size:18px; margin-bottom:4px; text-align:center; }
          h2 { font-size:14px; font-weight:400; color:#555; margin-bottom:16px; text-align:center; }
          table { border-collapse:collapse; width:100%; margin-top:10px; }
          th, td { border:1px solid #000; padding:8px 10px; font-size:12px; }
          th { background:#f5f5f5; }
          @media print { body { margin:10mm; } }
        </style>
      </head>
      <body>
        <h1>Timetable</h1>
        <h2>Class: ${selectedClassName}</h2>
        <table>
          <thead><tr><th style="border:1px solid #000;padding:6px 10px;background:#f5f5f5;width:80px;">Day</th>${periodHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #timetable-print-area, #timetable-print-area * { visibility: visible; }
          #timetable-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          #timetable-print-area table { border-collapse: collapse; width: 100%; }
          #timetable-print-area th, #timetable-print-area td { border: 1px solid #000 !important; padding: 6px 10px !important; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Clashes Alert Box */}
        {hasClashes && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              Live Clash Detection Alert
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-red-600">
              {teacherClashes.map((c, i) => (
                <li key={`tc-${i}`}>
                  <strong>Teacher Double-Booking:</strong> {c.staffName} is assigned to multiple classes simultaneously ({c.classes.join(", ")}) on {DAYS[c.dayOfWeek]} during {c.periodName}.
                </li>
              ))}
              {subjectClashes.map((c, i) => (
                <li key={`sc-${i}`}>
                  <strong>Subject Duplication:</strong> {c.subjectName} appears {c.periods.length} times for {c.className} on {DAYS[c.dayOfWeek]} (Periods: {c.periods.join(", ")}).
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setEditCell(null); }}
            className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
          >
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => setShowPeriodForm(!showPeriodForm)}
            className="border border-outline-variant text-primary font-label-md text-label-md py-2 px-4 rounded bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
          >
            {showPeriodForm ? "Cancel" : "Manage Periods"}
          </button>
          <button
            onClick={handlePrint}
            className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
          >
            Print
          </button>
        </div>

        {/* Period form */}
        {showPeriodForm && (
          <form action={periodAction} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-3">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Add Period</h3>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" name="name" placeholder="e.g. Period 1" required
                className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
              <input type="time" name="startTime" required
                className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
              <input type="time" name="endTime" required
                className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
            </div>
            {periodState.success && <p className="bg-secondary-container text-on-secondary-container font-body-sm text-body-sm px-3 py-2 rounded">{periodState.success}</p>}
            {periodState.error && <p className="bg-error-container text-on-error-container font-body-sm text-body-sm px-3 py-2 rounded">{periodState.error}</p>}
            <button type="submit" disabled={periodPending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
              {periodPending ? "Adding\u2026" : "Add Period"}
            </button>

            {periods.length > 0 && (
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Existing periods:</p>
                <div className="flex flex-wrap gap-2">
                  {periods.map((p) => (
                    <span key={p.id} className="bg-surface-variant text-on-surface-variant px-2 py-1 rounded font-label-sm text-label-sm">
                      {p.name} ({p.startTime}-{p.endTime})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* Timetable grid */}
        <div id="timetable-print-area" ref={printRef} className="overflow-x-auto">
          <table className="w-full text-left border-collapse bg-surface-container-lowest border border-outline-variant rounded-lg">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-32">Day</th>
                {filteredPeriods.map((p) => (
                  <th key={p.id} className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider min-w-[120px] text-center">
                    {p.periodType === "break" && (
                      <span className="block font-semibold text-primary uppercase text-xs tracking-wider mb-1">{p.name}</span>
                    )}
                    <span className="block font-label-sm text-label-sm text-on-surface font-semibold">{p.startTime} - {p.endTime}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredPeriods.length === 0 && (
                <tr>
                  <td colSpan={filteredPeriods.length + 1} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">
                    No periods defined. Create periods first.
                  </td>
                </tr>
              )}
              {DAYS.map((dayName, dayIndex) => (
                <tr key={dayIndex} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-3 px-4 font-label-md text-label-md text-on-surface font-semibold border-r border-outline-variant">
                    {dayName}
                  </td>
                  {filteredPeriods.map((period) => {
                    // Check if break column to span vertically
                    if (period.periodType === "break") {
                      if (dayIndex > 0) return null; // Omit cells for subsequent rows
                      return (
                        <td key={period.id} rowSpan={5} className="py-4 px-2 border-r border-outline-variant text-center align-middle bg-surface-container-low font-bold">
                          <div style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }} className="text-xl md:text-3xl tracking-widest text-on-surface-variant uppercase inline-block my-auto select-none mx-auto py-6">
                            {period.name}
                          </div>
                        </td>
                      );
                    }

                    const entry = getEntry(period.id, dayIndex);
                    const isEditing = editCell?.periodId === period.id && editCell?.dayOfWeek === dayIndex;

                    // Determine cell status for styling
                    const cellTeacherClash = entry && teacherClashes.some(c => c.staffId === entry.staffId && c.dayOfWeek === dayIndex && c.periodId === period.id);
                    const cellSubjectClash = entry && subjectClashes.some(c => c.classId === entry.classId && c.dayOfWeek === dayIndex && c.subjectName === entry.subjectName);
                    const isClashing = cellTeacherClash || cellSubjectClash;

                    return (
                      <td key={period.id} className={`py-2 px-4 border-r border-outline-variant transition-colors ${isClashing ? "bg-red-50 text-red-900 border-red-200" : ""}`}>
                        {isEditing ? (
                          <form action={entryAction} className="flex flex-col gap-1">
                            <input type="hidden" name="classId" value={selectedClass} />
                            <input type="hidden" name="periodId" value={period.id} />
                            <input type="hidden" name="dayOfWeek" value={dayIndex} />
                            <select name="subjectId" required className="border border-outline-variant rounded p-1 font-body-sm text-body-sm bg-surface-container-lowest">
                              <option value="">Subject</option>
                              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select name="staffId" required className="border border-outline-variant rounded p-1 font-body-sm text-body-sm bg-surface-container-lowest">
                              <option value="">Teacher</option>
                              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <div className="flex gap-1">
                              <button type="submit" disabled={entryPending} className="bg-primary text-on-primary font-label-sm text-label-sm py-1 px-2 rounded text-xs">
                                Save
                              </button>
                              <button type="button" onClick={() => setEditCell(null)} className="border border-outline-variant rounded px-2 py-1 font-label-sm text-label-sm text-on-surface-variant text-xs">
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : entry ? (
                          <div className="group relative text-center">
                            <p className="font-label-md text-label-md font-semibold">{entry.subjectName}</p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">{entry.staffName}</p>
                            {isClashing && (
                              <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center justify-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                {cellTeacherClash ? "Teacher Clash" : "Duplicate Subject"}
                              </p>
                            )}
                            <button
                              onClick={() => setEditCell({ periodId: period.id, dayOfWeek: dayIndex })}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary text-xs"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <button
                              onClick={() => setEditCell({ periodId: period.id, dayOfWeek: dayIndex })}
                              className="text-on-surface-variant hover:text-primary font-label-sm text-label-sm opacity-50 hover:opacity-100 transition-opacity"
                            >
                              + Add
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
