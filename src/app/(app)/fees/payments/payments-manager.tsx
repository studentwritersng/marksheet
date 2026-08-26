"use client";

import { useActionState, useState } from "react";
import {
  recordPaymentAction,
  deletePaymentAction,
  bulkRecordPaymentAction,
} from "./actions";
import type { ActionState } from "../actions";
import { formatNaira } from "@/lib/format";
import type { StudentFeeSummary } from "@/lib/fees/bursary";

export interface PaymentRecord {
  id: string;
  studentId: string;
  amount: number;
  method: string;
  note: string | null;
  paymentDate: string | null;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  admissionNumber: string;
  name: string;
  className: string;
  summary: StudentFeeSummary;
}

const METHODS = ["cash", "bank", "transfer", "pos", "cheque", "ussd"];

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
  history,
}: {
  activeTermId: string;
  activeTermName: string;
  rows: PaymentRow[];
  history: PaymentRecord[];
}) {
  const byStudent = new Map<string, PaymentRecord[]>();
  for (const h of history) {
    const arr = byStudent.get(h.studentId) ?? [];
    arr.push(h);
    byStudent.set(h.studentId, arr);
  }

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
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <PaymentRowItem
                  key={row.id}
                  row={row}
                  activeTermId={activeTermId}
                  records={byStudent.get(row.id) ?? []}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkRecordForm activeTermId={activeTermId} />
    </section>
  );
}

function PaymentRowItem({
  row,
  activeTermId,
  records,
}: {
  row: PaymentRow;
  activeTermId: string;
  records: PaymentRecord[];
}) {
  const [state, action, pending] = useActionState(recordPaymentAction, init);
  const [open, setOpen] = useState(false);

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
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-label-sm text-label-sm text-primary hover:text-primary-container"
          >
            History{records.length > 0 ? ` (${records.length})` : ""}
          </button>
        </div>
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
            <label className="font-label-sm text-label-sm text-on-surface">Method</label>
            <select name="method" defaultValue="cash" className={inputCls}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
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

        {open && (
          <HistoryDialog
            studentName={row.name}
            records={records}
            onClose={() => setOpen(false)}
          />
        )}
      </td>
    </tr>
  );
}

function HistoryDialog({
  studentName,
  records,
  onClose,
}: {
  studentName: string;
  records: PaymentRecord[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Payment history · {studentName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            Close
          </button>
        </div>
        {records.length === 0 ? (
          <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
            No payments recorded for this term.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {records.map((r) => (
              <HistoryRow key={r.id} record={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ record }: { record: PaymentRecord }) {
  const [state, action, pending] = useActionState(
    deletePaymentAction.bind(null, record.id),
    init,
  );
  const when = record.paymentDate ?? record.createdAt;
  return (
    <li className="rounded-lg border border-outline-variant bg-surface-container p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-label-md text-label-md text-on-surface">
            {formatNaira(record.amount)} · {record.method}
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant">
            {new Date(when).toLocaleDateString("en-NG")}
            {record.note ? ` · ${record.note}` : ""}
          </div>
        </div>
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="font-label-sm text-label-sm text-red-600 hover:text-red-800 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-600">{state.success}</p>}
    </li>
  );
}

function BulkRecordForm({ activeTermId }: { activeTermId: string }) {
  const [state, action, pending] = useActionState(bulkRecordPaymentAction, init);
  return (
    <section className="mt-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">
        Bulk record payments
      </h2>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Record the same amount for several students at once. Provide student IDs as a
        JSON array, e.g. {"[\"id1\",\"id2\"]"}.
      </p>
      <form action={action} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
        <input type="hidden" name="termId" value={activeTermId} />
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className="font-label-md text-label-md text-on-surface">Student IDs (JSON)</label>
          <input
            name="studentIds"
            placeholder='["id1","id2"]'
            className={`${inputCls} w-full`}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-label-md text-label-md text-on-surface">Amount (₦)</label>
          <input name="amount" type="number" min="0" step="any" placeholder="0" className={inputCls} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-label-md text-label-md text-on-surface">Method</label>
          <select name="method" defaultValue="cash" className={inputCls}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className="font-label-md text-label-md text-on-surface">Note</label>
          <input name="note" placeholder="Optional" className={`${inputCls} w-full`} />
        </div>
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "Recording…" : "Bulk record"}
        </button>
      </form>
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-green-600">{state.success}</p>}
    </section>
  );
}
