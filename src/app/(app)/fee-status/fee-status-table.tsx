"use client";

import { useState, useActionState, useTransition, Fragment } from "react";
import { updateFeeStatusAction, bulkUpdateFeeStatusAction, type ActionState } from "./actions";

interface StudentRow {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  status: string;
  notes: string;
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
  const [bulkPending, startBulk] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("cleared");
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleAll() {
    if (selected.size === students.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map((s) => s.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulk() {
    startBulk(async () => {
      const res = await bulkUpdateFeeStatusAction(
        Array.from(selected),
        selectedTermId,
        bulkStatus,
      );
      if (res.error) alert(res.error);
    });
  }

  if (students.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No active students.</p>;
  }

  return (
    <div>
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-surface-container-low border border-outline-variant rounded-lg px-4 py-3">
          <span className="font-label-md text-label-md text-on-surface">
            {selected.size} selected
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          >
            <option value="cleared">Cleared</option>
            <option value="not_cleared">Not cleared</option>
            <option value="partial">Partial</option>
          </select>
          <button
            onClick={handleBulk}
            disabled={bulkPending}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {bulkPending ? "Updating…" : `Mark as ${bulkStatus}`}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full text-left font-body-sm text-body-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === students.length && students.length > 0}
                  onChange={toggleAll}
                  className="rounded border-outline-variant text-on-surface"
                />
              </th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Admission</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Name</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Class</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
              <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <Fragment key={s.id}>
                <tr
                   className={`cursor-pointer transition ${
                    expanded === s.id ? "bg-surface-container-low" : "hover:bg-surface-container-low"
                  }`}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      className="rounded border-outline-variant text-on-surface"
                    />
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                    {s.admissionNumber}
                  </td>
                  <td
                    className="px-3 py-2 font-label-md text-label-md text-on-surface"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{s.className}</td>
                  <td className="px-3 py-2">
                    <FeeBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2">
                    <form action={action} onClick={(e) => e.stopPropagation()}>
                      <input type="hidden" name="studentId" value={s.id} />
                      <input type="hidden" name="termId" value={selectedTermId} />
                      <div className="flex items-center gap-2">
                        <select
                          name="status"
                          defaultValue={s.status}
                          className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest"
                        >
                          <option value="cleared">Cleared</option>
                          <option value="not_cleared">Not cleared</option>
                          <option value="partial">Partial</option>
                        </select>
                        <button
                          type="submit"
                          disabled={pending}
                          className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface disabled:opacity-60"
                        >
                          Set
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
                {expanded === s.id && (
                  <tr className="bg-surface-container-low">
                    <td colSpan={6} className="px-3 py-2">
                      <form action={action}>
                        <input type="hidden" name="studentId" value={s.id} />
                        <input type="hidden" name="termId" value={selectedTermId} />
                        <input type="hidden" name="status" value={s.status} />
                        <div className="flex items-center gap-2">
                          <input
                            name="notes"
                            defaultValue={s.notes}
                            placeholder="Notes (optional)"
                            className="flex-1 rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest"
                          />
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded bg-surface-container px-2 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-low disabled:opacity-60"
                          >
                            Save notes
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-green-600">{state.success}</p>}

      {!bulkPending && bulkPending === false && null}
      {bulkPending && (
        <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Bulk update in progress…</p>
      )}
    </div>
  );
}

function FeeBadge({ status }: { status: string }) {
  const cls =
    status === "cleared"
      ? "bg-secondary-container text-on-secondary-container"
      : status === "partial"
        ? "bg-amber-100 text-amber-700"
        : "bg-error-container text-on-error-container";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}
