"use client";

import { useActionState } from "react";
import {
  createPaymentAction,
  type ActionState,
} from "./actions";
import { formatNaira } from "@/lib/format";
import type { StudentFeeSummary } from "@/lib/fees/bursary";

interface PaymentRow {
  id: string;
  admissionNumber: string;
  name: string;
  className: string;
  summary: StudentFeeSummary;
}

const init: ActionState = {};

const inputCls =
  "rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors";
const btnCls =
  "bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60";

function statusBadge(status: StudentFeeSummary["status"]) {
  switch (status) {
    case "cleared":
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 font-label-sm text-label-sm text-green-800">
          Cleared
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-label-sm text-label-sm text-amber-800">
          Partial
        </span>
      );
    case "not_paid":
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 font-label-sm text-label-sm text-red-800">
          Not paid
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
          No structure
        </span>
      );
  }
}

export function PaymentsManager({
  activeTermId,
  activeTermName,
  rows,
}: {
  activeTermId: string;
  activeTermName: string;
  rows: PaymentRow[];
}) {
  return (
    <section>
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">
        Student payments · {activeTermName}
      </h2>
      {rows.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No students enrolled yet.
        </p>
      ) : (
        <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Student</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Class</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Expected ₦</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Paid ₦</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Balance ₦</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Record payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <PaymentRowItem
                  key={row.id}
                  row={row}
                  activeTermId={activeTermId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PaymentRowItem({
  row,
  activeTermId,
}: {
  row: PaymentRow;
  activeTermId: string;
}) {
  const [state, action, pending] = useActionState(
    createPaymentAction,
    init,
  );

  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <div className="font-label-sm text-label-sm text-on-surface">{row.name}</div>
        <div className="font-label-sm text-label-sm text-on-surface-variant">
          {row.admissionNumber}
        </div>
      </td>
      <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
        {row.className}
      </td>
      <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
        {formatNaira(row.summary.expected)}
      </td>
      <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
        {formatNaira(row.summary.paid)}
      </td>
      <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
        {formatNaira(row.summary.balance)}
      </td>
      <td className="px-3 py-2">{statusBadge(row.summary.status)}</td>
      <td className="px-3 py-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="studentId" value={row.id} />
          <input type="hidden" name="termId" value={activeTermId} />
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface">Amount (₦)</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              className={`${inputCls} w-28`}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface">Date</label>
            <input name="date" type="date" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface">Note</label>
            <input name="note" placeholder="Optional" className={`${inputCls} w-40`} />
          </div>
          <button type="submit" disabled={pending} className={btnCls}>
            {pending ? "Saving…" : "Record"}
          </button>
        </form>
        {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
        {state.success && <p className="mt-1 text-xs text-green-600">{state.success}</p>}
      </td>
    </tr>
  );
}
