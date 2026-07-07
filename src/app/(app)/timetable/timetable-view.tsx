"use client";

import { useState, useActionState } from "react";
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
  periods: { id: string; name: string; startTime: string; endTime: string }[];
  subjects: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  entries: { id: string; classId: string; periodId: string; dayOfWeek: number; subjectName: string; staffName: string }[];
}) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodState, periodAction, periodPending] = useActionState(createPeriodAction, {});
  const [entryState, entryAction, entryPending] = useActionState(setEntryAction, {});
  const [editCell, setEditCell] = useState<{ periodId: string; dayOfWeek: number } | null>(null);

  const classEntries = entries.filter((e) => e.classId === selectedClass);

  function getEntry(periodId: string, day: number) {
    return classEntries.find((e) => e.periodId === periodId && e.dayOfWeek === day);
  }

  return (
    <div className="space-y-6">
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
            {periodPending ? "Adding…" : "Add Period"}
          </button>

          {/* Existing periods */}
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
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse bg-surface-container-lowest border border-outline-variant rounded-lg">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-32">Period</th>
              {DAYS.map((d) => (
                <th key={d} className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {periods.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">
                  No periods defined. Create periods first.
                </td>
              </tr>
            )}
            {periods.map((period) => (
              <tr key={period.id} className="hover:bg-surface-container-low transition-colors">
                <td className="py-3 px-4 font-label-md text-label-md text-on-surface font-semibold">
                  {period.name}
                  <span className="block font-label-sm text-label-sm text-on-surface-variant font-normal">{period.startTime} - {period.endTime}</span>
                </td>
                {[0, 1, 2, 3, 4].map((day) => {
                  const entry = getEntry(period.id, day);
                  const isEditing = editCell?.periodId === period.id && editCell?.dayOfWeek === day;
                  return (
                    <td key={day} className="py-2 px-4">
                      {isEditing ? (
                        <form action={entryAction} className="flex flex-col gap-1">
                          <input type="hidden" name="classId" value={selectedClass} />
                          <input type="hidden" name="periodId" value={period.id} />
                          <input type="hidden" name="dayOfWeek" value={day} />
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
                        <div className="group relative">
                          <p className="font-label-md text-label-md text-on-surface">{entry.subjectName}</p>
                          <p className="font-label-sm text-label-sm text-on-surface-variant">{entry.staffName}</p>
                          <button
                            onClick={() => setEditCell({ periodId: period.id, dayOfWeek: day })}
                            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary text-xs"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditCell({ periodId: period.id, dayOfWeek: day })}
                          className="text-on-surface-variant hover:text-primary font-label-sm text-label-sm opacity-50 hover:opacity-100 transition-opacity"
                        >
                          + Add
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
