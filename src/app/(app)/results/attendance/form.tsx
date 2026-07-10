"use client";

import { useState, useActionState } from "react";
import { ClassTermSelector, type StudentVM } from "../term-data-form";
import { saveAttendanceAction } from "../term-actions";

export function AttendanceForm({
  classes, terms, selectedClassId, selectedTermId, students, existingAttendance,
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  selectedClassId: string;
  selectedTermId: string;
  students: StudentVM[];
  existingAttendance: Record<string, Record<string, number | string>>;
}) {
  const [state, action, pending] = useActionState(saveAttendanceAction, {});
  const [attendance, setAttendance] = useState<Record<string, { daysPresent: number; daysAbsent: number; totalDays: number }>>(
    Object.fromEntries(students.map((s) => [
      s.id,
      {
        daysPresent: (existingAttendance[s.id]?.daysPresent as number) ?? 0,
        daysAbsent: (existingAttendance[s.id]?.daysAbsent as number) ?? 0,
        totalDays: (existingAttendance[s.id]?.totalDays as number) ?? 0,
      },
    ]))
  );

  function setField(studentId: string, field: string, value: number) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  }

  return (
    <div className="space-y-4">
      <ClassTermSelector classes={classes} terms={terms} selectedClassId={selectedClassId} selectedTermId={selectedTermId} />

      {students.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant py-4">No students found in this class.</p>
      )}

      {students.length > 0 && (
        <form action={action}>
          <input type="hidden" name="termId" value={selectedTermId} />
          <input type="hidden" name="attendance" value={JSON.stringify(attendance)} />

          <div className="overflow-x-auto border border-outline-variant rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>
                  <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Student</th>
                  <th className="py-2 px-2 font-label-sm text-label-sm text-on-surface-variant uppercase text-center w-24">Days Present</th>
                  <th className="py-2 px-2 font-label-sm text-label-sm text-on-surface-variant uppercase text-center w-24">Days Absent</th>
                  <th className="py-2 px-2 font-label-sm text-label-sm text-on-surface-variant uppercase text-center w-24">Total Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low">
                    <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface whitespace-nowrap">
                      {s.name}
                      <span className="ml-2 text-on-surface-variant text-xs">{s.admissionNumber}</span>
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input type="number" min={0} value={attendance[s.id]?.daysPresent ?? 0}
                        onChange={(e) => setField(s.id, "daysPresent", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 border border-outline-variant rounded px-2 py-1 text-xs text-center bg-surface-container-lowest"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input type="number" min={0} value={attendance[s.id]?.daysAbsent ?? 0}
                        onChange={(e) => setField(s.id, "daysAbsent", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 border border-outline-variant rounded px-2 py-1 text-xs text-center bg-surface-container-lowest"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input type="number" min={0} value={attendance[s.id]?.totalDays ?? 0}
                        onChange={(e) => setField(s.id, "totalDays", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 border border-outline-variant rounded px-2 py-1 text-xs text-center bg-surface-container-lowest"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button type="submit" disabled={pending}
              className="bg-[#002046] text-white font-label-md text-label-md py-2 px-6 rounded hover:bg-[#003366] disabled:opacity-60"
            >{pending ? "Saving..." : "Save All Attendance"}</button>
            {state.success && <p className="text-green-700 font-body-sm text-body-sm">{state.success}</p>}
            {state.error && <p className="text-red-600 font-body-sm text-body-sm">{state.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
