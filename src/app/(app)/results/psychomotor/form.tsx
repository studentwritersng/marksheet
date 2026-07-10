"use client";

import { useState, useActionState } from "react";
import { ClassTermSelector, type StudentVM } from "../term-data-form";
import { saveAffectiveRatingsAction } from "../term-actions";

const DEFAULT_TRAITS = ["Punctuality", "Neatness", "Attentiveness", "Honesty", "Politeness", "Teamwork", "Leadership"];

export function PsychomotorForm({
  classes, terms, selectedClassId, selectedTermId, students, existingRatings,
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  selectedClassId: string;
  selectedTermId: string;
  students: StudentVM[];
  existingRatings: Record<string, Record<string, number>>;
}) {
  const [state, action, pending] = useActionState(saveAffectiveRatingsAction, {});
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>(existingRatings);

  function setRating(studentId: string, trait: string, value: number) {
    setRatings((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [trait]: value },
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
          <input type="hidden" name="ratings" value={JSON.stringify(ratings)} />

          <div className="overflow-x-auto border border-outline-variant rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>
                  <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase sticky left-0 bg-surface-container">Student</th>
                  {DEFAULT_TRAITS.map((trait) => (
                    <th key={trait} className="py-2 px-2 font-label-sm text-label-sm text-on-surface-variant uppercase text-center min-w-[90px]">{trait}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low">
                    <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface sticky left-0 bg-surface-container-lowest whitespace-nowrap">
                      {s.name}
                      <span className="ml-2 text-on-surface-variant text-xs">{s.admissionNumber}</span>
                    </td>
                    {DEFAULT_TRAITS.map((trait) => (
                      <td key={trait} className="py-1 px-2 text-center">
                        <select
                          value={ratings[s.id]?.[trait] ?? 0}
                          onChange={(e) => setRating(s.id, trait, Number(e.target.value))}
                          className="w-16 border border-outline-variant rounded px-1 py-1 text-xs text-center bg-surface-container-lowest"
                        >
                          <option value={0}>-</option>
                          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button type="submit" disabled={pending}
              className="bg-[#002046] text-white font-label-md text-label-md py-2 px-6 rounded hover:bg-[#003366] disabled:opacity-60"
            >{pending ? "Saving..." : "Save All Ratings"}</button>
            {state.success && <p className="text-green-700 font-body-sm text-body-sm">{state.success}</p>}
            {state.error && <p className="text-red-600 font-body-sm text-body-sm">{state.error}</p>}
          </div>

          <div className="mt-2 flex items-center gap-4 text-[11px] text-on-surface-variant">
            <span>Rating scale: 1 = Poor, 2 = Fair, 3 = Good, 4 = Very Good, 5 = Excellent</span>
          </div>
        </form>
      )}
    </div>
  );
}
