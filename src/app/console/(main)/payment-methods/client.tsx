"use client";
import { useActionState, useState } from "react";
import { createPaymentMethodAction, togglePaymentMethodAction, deletePaymentMethodAction } from "./actions";
interface PMVM { id: string; type: string; label: string; isActive: boolean; details: Record<string, string> | null; }

function PaymentMethodCard({ m }: { m: PMVM }) {
  const [togState, togAction, togPending] = useActionState(async () => togglePaymentMethodAction(m.id, !m.isActive), {});
  const [delState, delAction, delPending] = useActionState(async () => deletePaymentMethodAction(m.id), {});
  const tLabels: Record<string, string> = { bank_transfer: "Bank Transfer", cash: "Cash", online: "Online Payment" };
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-white font-semibold text-sm">{m.label}</p>
          <p className="text-white/40 text-xs">{tLabels[m.type] ?? m.type}</p>
        </div>
        {m.isActive ? <span className="text-[10px] text-emerald-400 bg-emerald-900/30 rounded-full px-2 py-0.5">Active</span> : <span className="text-[10px] text-gray-400 bg-gray-800/30 rounded-full px-2 py-0.5">Inactive</span>}
      </div>
      {m.details && (
        <div className="text-xs text-white/50 space-y-0.5 mb-3 bg-white/[0.02] rounded-lg p-2">
          {Object.entries(m.details).filter(([k]) => k !== "instructions").map(([k, v]) => (
            <div key={k} className="flex gap-2"><span className="capitalize text-white/30">{k.replace(/([A-Z])/g, " $1").trim()}:</span><span className="text-white/70">{v}</span></div>
          ))}
          {m.details.instructions && <div className="mt-1.5 pt-1.5 border-t border-white/5"><span className="text-white/30 block mb-0.5">Instructions:</span><span className="text-white/60 whitespace-pre-wrap">{m.details.instructions}</span></div>}
        </div>
      )}
      <div className="flex gap-2">
        <form action={togAction}><button type="submit" disabled={togPending} className="text-[10px] text-white/40 hover:text-white/70 underline">{m.isActive ? "Deactivate" : "Activate"}</button></form>
        {!m.isActive && <form action={delAction}><button type="submit" disabled={delPending} className="text-[10px] text-red-400 hover:text-red-300 underline">Delete</button></form>}
      </div>
      {togState.success && <p className="text-emerald-400 text-[10px] mt-1">{togState.success}</p>}
      {togState.error && <p className="text-red-400 text-[10px] mt-1">{togState.error}</p>}
      {delState.success && <p className="text-emerald-400 text-[10px] mt-1">{delState.success}</p>}
    </div>
  );
}

export function PaymentMethodsClient({ methods }: { methods: PMVM[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, action, pending] = useActionState(createPaymentMethodAction, {});
  const [methodType, setMethodType] = useState("bank_transfer");
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Payment Methods</h1>
          <p className="text-sm text-white/40 mt-1">{methods.length} method{methods.length !== 1 ? "s" : ""} configured</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30">{showForm ? "Cancel" : "Add Method"}</button>
      </div>
      {showForm && (
        <form action={action} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Type</label>
              <select name="type" value={methodType} onChange={e => setMethodType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="online">Online Payment</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Label</label>
              <input name="label" required placeholder={methodType === "bank_transfer" ? "e.g. GTBank" : methodType === "cash" ? "e.g. Cash Payment" : "e.g. Paystack"} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
            </div>
          </div>
          {methodType === "bank_transfer" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Bank Name</label>
                  <input name="bankName" required placeholder="e.g. Guaranty Trust Bank" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Account Number</label>
                  <input name="accountNumber" required placeholder="0123456789" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Account Name</label>
                  <input name="accountName" required placeholder="e.g. Marksheet Ltd" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Payment Instructions (shown to school)</label>
                <textarea name="instructions" rows={3} placeholder="e.g. Make a transfer to the account above, then enter the teller ID and upload the receipt below." className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
            </>
          )}
          {methodType === "online" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">Provider</label>
                <input name="provider" required placeholder="e.g. Paystack" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Public Key</label>
                <input name="publicKey" required placeholder="pk_live_..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
            </div>
          )}
          <button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">{pending ? "..." : "Add"}</button>
          {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
          {state.success && <p className="text-emerald-400 text-xs">{state.success}</p>}
        </form>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {methods.map((m) => <PaymentMethodCard key={m.id} m={m} />)}
        {methods.length === 0 && <p className="text-white/30 text-sm col-span-full py-8 text-center">No payment methods configured.</p>}
      </div>
    </div>
  );
}
