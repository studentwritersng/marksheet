"use client";

import { useState, useActionState, useRef, useTransition } from "react";
import { createPeriodAction, setEntryAction } from "@/lib/timetable/actions";
import { getFreeTeachersAction } from "./actions";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface TimetableEntry {
  id: string;
  classId: string;
  className: string;
  periodId: string;
  dayOfWeek: number;
  subjectId: string;
  subjectName: string;
  staffId: string;
  staffName: string;
  roomId: string | null;
  roomName: string | null;
}

interface FreeTeacher {
  id: string;
  name: string;
  isFree: boolean;
}

interface CellSlot {
  entries: TimetableEntry[];
}

export function TimetableView({
  classes,
  periods,
  subjects,
  staff,
  rooms,
  entries,
  readOnly,
}: {
  classes: { id: string; name: string }[];
  periods: { id: string; name: string; startTime: string; endTime: string; periodType?: string }[];
  subjects: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  entries: TimetableEntry[];
  readOnly?: boolean;
}) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodState, periodAction, periodPending] = useActionState(createPeriodAction, {});
  const [entryState, entryAction, entryPending] = useActionState(setEntryAction, {});
  const [editCell, setEditCell] = useState<{ periodId: string; dayOfWeek: number } | null>(null);
  const [freeTeachers, setFreeTeachers] = useState<FreeTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const selectedClassObj = classes.find((c) => c.id === selectedClass) ?? null;

  const classEntries = entries.filter((e) => e.classId === selectedClass);

  function getCellSlot(periodId: string, dayOfWeek: number): CellSlot {
    return { entries: classEntries.filter(
      (e) => e.periodId === periodId && e.dayOfWeek === dayOfWeek,
    ) };
  }

  const isSSS = selectedClassObj?.name?.startsWith("SSS") ?? false;

  function handleCellClick(periodId: string, dayOfWeek: number) {
    setEditCell({ periodId, dayOfWeek });
    setFreeTeachers([]);
    // Pre-fill values when an entry already exists; leave blank for empty slots.
  }

  async function handleSubjectChange(subjectId: string) {
    if (!subjectId || !editCell) { setFreeTeachers([]); return; }
    setLoadingTeachers(true);
    startTransition(async () => {
      const result = await getFreeTeachersAction(editCell.periodId, editCell.dayOfWeek, selectedClass, subjectId);
      setFreeTeachers(result);
      setLoadingTeachers(false);
    });
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
    dayOfWeek: number;
    subjectName: string;
    periods: string[];
  }[] = [];

  const teacherSlotMap = new Map<string, typeof classEntries>();
  for (const entry of classEntries) {
    if (!entry.staffId) continue;
    const key = `${entry.staffId}|${entry.dayOfWeek}|${entry.periodId}`;
    if (!teacherSlotMap.has(key)) teacherSlotMap.set(key, []);
    teacherSlotMap.get(key)!.push(entry);
  }
  for (const [, conflicting] of teacherSlotMap) {
    if (conflicting.length < 2) continue;
    const first = conflicting[0];
    teacherClashes.push({
      staffId: first.staffId,
      staffName: first.staffName,
      dayOfWeek: first.dayOfWeek,
      periodId: first.periodId,
      periodName: periods.find((p) => p.id === first.periodId)?.name || "Unknown",
      classes: [...new Set(conflicting.map((e) => e.className))],
    });
  }

  const subjectDayMap = new Map<string, typeof classEntries>();
  for (const entry of classEntries) {
    const key = `${entry.classId}|${entry.dayOfWeek}|${entry.subjectName}`;
    if (!subjectDayMap.has(key)) subjectDayMap.set(key, []);
    subjectDayMap.get(key)!.push(entry);
  }
  for (const [, conflicting] of subjectDayMap) {
    if (conflicting.length < 2) continue;
    const first = conflicting[0];
    subjectClashes.push({
      classId: first.classId,
      className: first.className,
      dayOfWeek: first.dayOfWeek,
      subjectName: first.subjectName,
      periods: conflicting.map((e) => periods.find((p) => p.id === e.periodId)?.name || "?"),
    });
  }

  const hasClashes = teacherClashes.length > 0 || subjectClashes.length > 0;

  async function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;

    const clsName = classes.find((c) => c.id === selectedClass)?.name || "Timetable";
    const pnc = periods.filter((p) => p.periodType !== "assembly" && p.periodType !== "closing");
    const tableBody = DAYS.map((dayName, dayIndex) => {
      let row = `<td style="border:1px solid #000;padding:4px;font-weight:600;">${dayName}</td>`;
      for (const period of pnc) {
        if (period.periodType === "break") {
          row += `<td style="border:1px solid #000;padding:4px;background:#e5e5e5;font-weight:600;text-align:center;" rowSpan="5"><span style="writing-mode:vertical-lr;text-orientation:mixed;display:inline-block;transform:rotate(180deg);letter-spacing:2px;">${period.name}</span></td>`;
          continue;
        }
        const slot = getCellSlot(period.id, dayIndex);
        if (slot.entries.length > 0) {
          const subjectText = slot.entries.map((e) => e.subjectName).join(" / ");
          const teacherText = slot.entries[0]?.staffName ?? "";
          const roomText = slot.entries[0]?.roomName ?? "";
          row += `<td style="border:1px solid #000;padding:4px;text-align:center;">
            <div style="font-weight:600;font-size:12px;">${subjectText}</div>
            ${teacherText ? `<div style="font-size:10px;color:#555;">${teacherText}</div>` : ""}
            ${roomText ? `<div style="font-size:10px;color:#666;">${roomText}</div>` : ""}
          </td>`;
        } else {
          row += `<td style="border:1px solid #000;padding:4px;"></td>`;
        }
      }
      return `<tr>${row}</tr>`;
    }).join("");

    const tableHead = `<td style="border:1px solid #000;padding:4px;"></td>${pnc.map((p) => `<td style="border:1px solid #000;padding:4px;text-align:center;font-weight:600;">${p.name}<br/>${p.startTime} - ${p.endTime}</td>`).join("")}`;

    win.document.write(`
      <html>
        <head>
          <title>${clsName} - Timetable</title>
          <style>body{font-family:sans-serif;margin:20px;}table{border-collapse:collapse;width:100%;font-size:12px;}</style>
        </head>
        <body>
          <h2>${clsName}</h2>
          <table>
            <thead><tr>${tableHead}</tr></thead>
            <tbody>${tableBody}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Timetable</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Manage periods and schedule subjects per class.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="bg-primary text-on-primary font-label-sm text-label-sm py-1.5 px-3 rounded-lg hover:bg-primary/90 text-xs">
            Print / PDF
          </button>
          <a href="/timetable/wizard?restart=1" className="border border-outline-variant text-on-surface font-label-sm text-label-sm py-1.5 px-3 rounded-lg hover:bg-surface-container text-xs">
            Re-run Setup
          </a>
        </div>
      </div>

      {hasClashes && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3">
          <h3 className="font-headline-sm text-headline-sm text-red-700 flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[16px]">error</span>
            Scheduling Conflict{teacherClashes.length + subjectClashes.length > 1 ? "s" : ""}
          </h3>
          <ul className="space-y-0.5">
            {teacherClashes.map((c, i) => (
              <li key={`teacher-${i}`} className="text-xs text-red-800">
                <strong>Teacher double-booked:</strong> {c.staffName} on {c.classes.join(", ")} — {DAYS[c.dayOfWeek]} {c.periodName}.
              </li>
            ))}
            {subjectClashes.map((c, i) => (
              <li key={`subject-${i}`} className="text-xs text-red-800">
                <strong>Subject duplicated:</strong> {c.subjectName} ×{c.periods.length} for {c.className} on {DAYS[c.dayOfWeek]}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Class</label>
          <select
            className="border border-outline-variant rounded-lg px-2 py-1.5 text-sm bg-surface"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {!readOnly && (
          <button onClick={() => setShowPeriodForm((p) => !p)}
            className="border border-outline-variant text-on-surface-variant font-label-sm text-label-sm py-1.5 px-3 rounded-lg hover:bg-surface-container text-xs">
            {showPeriodForm ? "Hide Period Form" : "Manage Periods"}
          </button>
        )}
      </div>

      {!readOnly && showPeriodForm && (
        <form action={periodAction} className="flex gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-on-surface-variant mb-0.5">Period Name</label>
            <input name="name" required placeholder="e.g. Period 5" className="w-full border border-outline-variant rounded-lg px-2 py-1.5 text-sm bg-surface" />
          </div>
          <div className="w-24">
            <label className="block text-xs text-on-surface-variant mb-0.5">Start</label>
            <input name="startTime" type="time" required className="w-full border border-outline-variant rounded-lg px-2 py-1.5 text-sm bg-surface" />
          </div>
          <div className="w-24">
            <label className="block text-xs text-on-surface-variant mb-0.5">End</label>
            <input name="endTime" type="time" required className="w-full border border-outline-variant rounded-lg px-2 py-1.5 text-sm bg-surface" />
          </div>
          <button type="submit" disabled={periodPending}
            className="bg-primary text-on-primary font-label-md text-label-md py-1.5 px-4 rounded-lg text-sm"
          >{periodPending ? "Saving..." : "Add"}</button>
          {(periodState.error || periodState.success) && (
            <p className={`text-xs ${periodState.error ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50"} rounded-lg px-2 py-1`}>
              {periodState.error ?? periodState.success}
            </p>
          )}
        </form>
      )}

      {entryState.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{entryState.error}</p>
      )}

      <div className="overflow-x-auto" ref={printRef}>
        <table className="border-collapse w-full min-w-[640px] text-xs">
          <thead>
            <tr className="bg-surface-container-lowest">
              <th className="py-2 px-2 border border-outline-variant text-left font-semibold text-on-surface-variant text-xs w-16"></th>
              {filteredPeriods.map((period) => (
                <th key={period.id} className={`py-2 px-2 border border-outline-variant text-center font-semibold text-xs ${period.periodType === "break" ? "bg-neutral-100 text-neutral-500" : "text-on-surface"}`}>
                  <div className="font-semibold">{period.name}</div>
                  <div className="font-normal">{period.startTime}–{period.endTime}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPeriods.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-on-surface-variant text-xs">No teaching periods defined.</td></tr>
            )}
            {DAYS.map((dayName, dayIndex) => (
              <tr key={dayIndex} className="hover:bg-surface-container-low transition-colors">
                <td className="py-2 px-2 font-medium text-on-surface border-r border-outline-variant text-xs">
                  {DAY_SHORT[dayIndex]}
                </td>
                {filteredPeriods.map((period) => {
                  if (period.periodType === "break") {
                    if (dayIndex > 0) return null;
                    return (
                      <td key={period.id} rowSpan={5}
                        className="py-4 px-2 border-r border-outline-variant text-center align-middle bg-neutral-100 font-bold text-xs">
                        <div style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }} className="tracking-widest text-neutral-400 uppercase inline-block my-auto select-none mx-auto py-4">
                          {period.name}
                        </div>
                      </td>
                    );
                  }

                  const slot = getCellSlot(period.id, dayIndex);
                  const isEditing = editCell?.periodId === period.id && editCell?.dayOfWeek === dayIndex;

                  const cellTeacherClash = slot.entries.some(
                    (entry) => teacherClashes.some(
                      (c) => c.staffId === entry.staffId && c.dayOfWeek === dayIndex && c.periodId === period.id,
                    ),
                  );
                  const cellSubjectClash = slot.entries.some(
                    (entry) => subjectClashes.some(
                      (c) => c.classId === entry.classId && c.dayOfWeek === dayIndex && c.subjectName === entry.subjectName,
                    ),
                  );
                  const isClashing = cellTeacherClash || cellSubjectClash;

                  return (
                    <td key={period.id} className={`py-1.5 px-1.5 border border-outline-variant transition-colors ${isClashing ? "bg-red-50 text-red-900 border-red-200" : ""} ${isEditing ? "bg-blue-50" : ""}`}>
                      {isEditing ? (
                        <div className="space-y-1">
                          <form action={entryAction} className="flex flex-col gap-1">
                            <input type="hidden" name="classId" value={selectedClass} />
                            <input type="hidden" name="periodId" value={period.id} />
                            <input type="hidden" name="dayOfWeek" value={dayIndex} />

                            <select name="subjectId" required defaultValue={slot.entries[0]?.subjectId ?? ""}
                              onChange={(e) => handleSubjectChange(e.target.value)}
                              className="border border-outline-variant rounded p-1 font-body-sm text-body-sm bg-surface-container-lowest text-xs w-full">
                              <option value="">Subject</option>
                              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>

                            {/* selected subject's free teachers */}
                            {loadingTeachers && <p className="text-xs text-on-surface-variant">Loading…</p>}
                            {!loadingTeachers && freeTeachers.length > 0 && (
                              <div className="text-xs">
                                <div className="flex flex-wrap gap-0.5">
                                  {freeTeachers.map((t) => (
                                    <span key={t.id} className={`px-1.5 py-0.5 rounded text-xs font-medium ${t.isFree ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700 line-through"}`}>
                                      {t.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <input type="hidden" name="staffId" value={slot.entries[0]?.staffId ?? (freeTeachers.find((t) => t.isFree)?.id ?? "")} />
                            <select name="roomId" className="border border-outline-variant rounded p-1 font-body-sm text-body-sm bg-surface-container-lowest text-xs w-full">
                              <option value="">No Room</option>
                              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <div className="flex gap-1">
                              <button type="submit" disabled={entryPending}
                                className="bg-primary text-on-primary font-label-sm text-label-sm py-1 px-2 rounded text-xs"
                              >Save</button>
                              <button type="button" onClick={() => { setEditCell(null); setFreeTeachers([]); }}
                                className="border border-outline-variant rounded px-2 py-1 font-label-sm text-label-sm text-on-surface-variant text-xs"
                              >Cancel</button>
                            </div>
                          </form>
                        </div>
                      ) : slot.entries.length > 0 ? (
                        <div
                          className={readOnly ? "cursor-default text-center" : "group cursor-pointer text-center"}
                          onClick={readOnly ? undefined : () => handleCellClick(period.id, dayIndex)}
                          title={readOnly ? "" : "Click to edit"}
                        >
                          <p className="font-medium leading-tight text-xs text-on-surface">
                            {slot.entries[0].subjectName}
                          </p>
                          <p className="text-on-surface-variant text-[10px] leading-tight mt-0.5">{slot.entries[0]?.staffName}</p>
                          {slot.entries[0]?.roomName && (
                            <p className="text-on-surface-variant/60 text-[10px] leading-tight">{slot.entries[0]?.roomName}</p>
                          )}
                          {isClashing && (
                            <p className="text-[9px] text-red-600 font-semibold mt-0.5">
                              <span className="material-symbols-outlined text-[10px]">warning</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={readOnly ? undefined : () => handleCellClick(period.id, dayIndex)}
                          disabled={readOnly}
                          className="w-full text-on-surface-variant/40 text-[11px] hover:bg-primary-container hover:text-on-primary-container rounded py-1 transition-all disabled:opacity-20"
                          title={readOnly ? "" : "Click to assign subject"}
                        >
                          +
                        </button>
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
  );
}
