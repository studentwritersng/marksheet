"use client";

import { useState, useActionState } from "react";
import { ClassTermSelector, type StudentVM } from "../term-data-form";
import { saveRemarksAction } from "../term-actions";

export function RemarksForm({
  classes, terms, selectedClassId, selectedTermId, students, existingRemarks,
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  selectedClassId: string;
  selectedTermId: string;
  students: StudentVM[];
  existingRemarks: Record<string, { teacherComment: string; principalComment: string }>;
}) {
  const [state, action, pending] = useActionState(saveRemarksAction, {});
  const [remarks, setRemarks] = useState<Record<string, { teacherComment: string; principalComment: string }>>(existingRemarks);

  function setField(studentId: string, field: "teacherComment" | "principalComment", value: string) {
    setRemarks((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { teacherComment: "", principalComment: "" }), [field]: value },
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
          <input type="hidden" name="remarks" value={JSON.stringify(remarks)} />

          <div className="space-y-3">
            {students.map((s) => (
              <div key={s.id} className="border border-outline-variant rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-label-md text-label-md text-on-surface font-semibold">{s.name}</p>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{s.admissionNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Teacher&apos;s Comment</label>
                    <textarea
                      value={remarks[s.id]?.teacherComment ?? ""}
                      onChange={(e) => setField(s.id, "teacherComment", e.target.value)}
                      rows={3}
                      placeholder="Write teacher's comment..."
                      className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Principal&apos;s Comment</label>
                    <textarea
                      value={remarks[s.id]?.principalComment ?? ""}
                      onChange={(e) => setField(s.id, "principalComment", e.target.value)}
                      rows={3}
                      placeholder="Write principal's comment..."
                      className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button type="submit" disabled={pending}
              className="bg-[#002046] text-white font-label-md text-label-md py-2 px-6 rounded hover:bg-[#003366] disabled:opacity-60"
            >{pending ? "Saving..." : "Save All Remarks"}</button>
            {state.success && <p className="text-green-700 font-body-sm text-body-sm">{state.success}</p>}
            {state.error && <p className="text-red-600 font-body-sm text-body-sm">{state.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
