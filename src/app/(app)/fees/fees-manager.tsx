"use client";

import { useActionState } from "react";
import {
  createFeeItemAction,
  updateFeeItemAction,
  deleteFeeItemAction,
  copyFeeItemsFromTermAction,
  type ActionState,
} from "./actions";
import { formatNaira } from "@/lib/format";

interface FeeItemRow {
  id: string;
  level: string;
  name: string;
  amount: number;
}

const init: ActionState = {};

const inputCls =
  "rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors";
const btnCls =
  "bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60";

export function FeesManager({
  activeTermId,
  activeTermName,
  sessionLabel,
  levels,
  feeItems,
  sourceTerms,
}: {
  activeTermId: string;
  activeTermName: string;
  sessionLabel: string;
  levels: string[];
  feeItems: FeeItemRow[];
  sourceTerms: { id: string; label: string; termName: string }[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createFeeItemAction,
    init,
  );
  const [copyState, copyAction, copyPending] = useActionState(
    copyFeeItemsFromTermAction,
    init,
  );

  // Group items by level for display.
  const byLevel = new Map<string, FeeItemRow[]>();
  for (const it of feeItems) {
    const arr = byLevel.get(it.level) ?? [];
    arr.push(it);
    byLevel.set(it.level, arr);
  }
  const sortedLevels = Array.from(byLevel.keys()).sort();

  return (
    <div className="flex flex-col gap-8">
      {/* Add fee item form */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Add fee item
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Add a charge for <strong>{activeTermName}</strong> ({sessionLabel}).
        </p>
        <form action={createAction} className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <input type="hidden" name="termId" value={activeTermId} />
          <div className="flex flex-col gap-1">
            <label className={`${inputCls} border-0 p-0 bg-transparent font-label-md text-label-md text-on-surface`}>Level</label>
            <select name="level" defaultValue={levels[0] ?? ""} className={inputCls} required>
              {levels.length === 0 && <option value="">No levels</option>}
              {levels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="font-label-md text-label-md text-on-surface">Name</label>
            <input name="name" placeholder="e.g. Tuition" className={inputCls} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface">Amount (₦)</label>
            <input name="amount" type="number" min="0" step="any" placeholder="0" className={inputCls} required />
          </div>
          <button type="submit" disabled={createPending} className={btnCls}>
            {createPending ? "Adding…" : "Add"}
          </button>
        </form>
        {createState.error && <p className="mt-3 text-sm text-red-600">{createState.error}</p>}
        {createState.success && <p className="mt-3 text-sm text-green-600">{createState.success}</p>}
      </section>

      {/* Copy from previous term */}
      {sourceTerms.length > 0 && (
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Copy from another term
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Replaces the current term&apos;s items with a copy of another term&apos;s items.
          </p>
          <form action={copyAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="termId" value={activeTermId} />
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Source term</label>
              <select name="fromTermId" className={inputCls} required defaultValue={sourceTerms[0]?.id ?? ""}>
                {sourceTerms.map((t) => (
                  <option key={t.id} value={t.id}>{t.termName} Term · {t.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={copyPending} className={btnCls}>
              {copyPending ? "Copying…" : "Copy"}
            </button>
          </form>
          {copyState.error && <p className="mt-3 text-sm text-red-600">{copyState.error}</p>}
          {copyState.success && <p className="mt-3 text-sm text-green-600">{copyState.success}</p>}
        </section>
      )}

      {/* Fee items table */}
      <section>
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">
          Fee items for {activeTermName} ({sessionLabel})
        </h2>
        {feeItems.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No fee items yet. Add one above or copy from another term.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {sortedLevels.map((level) => {
              const items = byLevel.get(level)!;
              const total = items.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={level} className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
                  <div className="px-4 py-2 bg-surface-container border-b border-outline-variant flex items-center justify-between">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">{level}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Total: {formatNaira(total)}
                    </span>
                  </div>
                  <table className="w-full text-left font-body-sm text-body-sm">
                    <thead className="bg-surface-container">
                      <tr>
                        <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Name</th>
                        <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Amount</th>
                        <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it) => (
                        <FeeItemRow key={it.id} item={it} levels={levels} />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function FeeItemRow({ item, levels }: { item: FeeItemRow; levels: string[] }) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateFeeItemAction,
    init,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteFeeItemAction,
    init,
  );

  return (
    <tr className="align-top">
      <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
        {item.name}
      </td>
      <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
        {formatNaira(item.amount)}
      </td>
      <td className="px-3 py-2">
        <form action={updateAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={item.id} />
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface">Name</label>
            <input name="name" defaultValue={item.name} className={inputCls} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface">Level</label>
            <select name="level" defaultValue={item.level} className={inputCls} required>
              {levels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface">Amount</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="any"
              defaultValue={item.amount}
              className={`${inputCls} w-28`}
              required
            />
          </div>
          <button
            type="submit"
            formAction={updateAction}
            disabled={updatePending}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface disabled:opacity-60"
          >
            {updatePending ? "Saving…" : "Save"}
          </button>
          <button
            type="submit"
            formAction={deleteAction}
            disabled={deletePending}
            className="font-label-sm text-label-sm text-red-600 hover:text-red-800 disabled:opacity-60"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </form>
        {updateState.error && <p className="mt-1 text-xs text-red-600">{updateState.error}</p>}
        {updateState.success && <p className="mt-1 text-xs text-green-600">{updateState.success}</p>}
        {deleteState.error && <p className="mt-1 text-xs text-red-600">{deleteState.error}</p>}
        {deleteState.success && <p className="mt-1 text-xs text-green-600">{deleteState.success}</p>}
      </td>
    </tr>
  );
}
