"use client";

import { useState, useActionState } from "react";
import { updateFeeStatusAction, type ActionState } from "./actions";
import { formatNaira } from "@/lib/format";
import { FeeStatusBadge } from "@/components/fee-status-badge";

interface StudentRow {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  status: string;
  notes: string;
  expected: number;
  paid: number;
  balance: number;
  hasStructure: boolean;
}

const init: ActionState = {};

export function FeeStatusTable({
  selectedTermId,
  students,
}: {
  selectedTermId: string;
  students: StudentRow[];
}) {
  const [state, action, pending] = useActionState(updateFeeStatusAction, init);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (students.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No active students.</p>;
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full text-left font-body-sm text-body-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Admission</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Name</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Class</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Expected ₦</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Paid ₦</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Balance ₦</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr
                key={s.id}
                className={`transition ${
                  expanded === s.id ? "bg-surface-container-low" : "hover:bg-surface-container-low"
                }`}
              >
                <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                  {s.admissionNumber}
                </td>
                <td
                  className="px-3 py-2 font-label-md text-label-md text-on-surface cursor-pointer"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{s.className}</td>
                <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface">
                  {s.hasStructure ? formatNaira(s.expected) : "—"}
                </td>
                <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface">
                  {s.hasStructure ? formatNaira(s.paid) : "—"}
                </td>
                <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface">
                  {s.hasStructure ? formatNaira(s.balance) : "—"}
                </td>
                <td className="px-3 py-2">
                  <FeeStatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
                  >
                    {s.notes ? "View" : "Add"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes editor (slide-over row) */}
      {expanded && (
        <div className="mt-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="studentId" value={expanded} />
            <input type="hidden" name="termId" value={selectedTermId} />
            {/* status is derived from payments; preserved here so notes can be saved */}
            <input type="hidden" name="status" value={students.find((x) => x.id === expanded)?.status ?? "not_cleared"} />
            <input
              name="notes"
              defaultValue={students.find((x) => x.id === expanded)?.notes ?? ""}
              placeholder="Notes (optional)"
              className="flex-1 rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-surface-container px-3 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-low disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save notes"}
            </button>
          </form>
        </div>
      )}

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-green-600">{state.success}</p>}
    </div>
  );
}
