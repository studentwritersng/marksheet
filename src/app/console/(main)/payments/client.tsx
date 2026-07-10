import { useActionState, useState } from "react";
import { verifyPaymentAction, rejectPaymentAction, generateCashCodeAction } from "./actions";

interface PaymentVM {
  id: string; schoolName: string; planName: string; amount: number;
  methodLabel: string; methodType: string; reference: string | null;
  proofUrl: string | null; notes: string | null; status: string; createdAt: string;
}
interface PlanVM { id: string; name: string; }

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export function PaymentsClient({ payments, plans }: { payments: PaymentVM[]; plans: PlanVM[] }) {
  const [tab, setTab] = useState<"payments" | "codes">("payments");
  const [filter, setFilter] = useState("pending");
  const filtered = filter === "all" ? payments : payments.filter((p) => p.status === filter);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payments</h1>
        <p className="text-sm text-white/40 mt-1">{payments.length} payment{payments.length !== 1 ? "s" : ""}, {payments.filter((p) => p.status === "pending").length} pending</p>
      </div>
      <div className="flex gap-2 border-b border-white/5 pb-0">
        {(["payments", "codes"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={"text-sm px-4 pb-2 -mb-px border-b-2 transition-colors " + (tab === t ? "border-emerald-500 text-white" : "border-transparent text-white/40 hover:text-white/70")}
          >{t === "payments" ? "Payments" : "Cash Codes"}</button>
        ))}
      </div>
      {tab === "payments" && (
        <>
          <div className="flex gap-2">
            {["pending", "verified", "failed", "all"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={"text-xs px-3 py-1.5 rounded-lg " + (filter === f ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70 bg-white/5")}
              >{f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
          <div className="space-y-3">
            {filtered.map((p) => <PaymentCard key={p.id} payment={p} />)}
            {filtered.length === 0 && <p className="text-white/30 text-sm py-8 text-center">No {filter} payments.</p>}
          </div>
        </>
      )}
      {tab === "codes" && <CashCodesSection plans={plans} />}
    </div>
  );
}

function PaymentCard({ payment }: { payment: PaymentVM }) {
  const [days, setDays] = useState(30);
  const [verifyState, verifyAction, verifyPending] = useActionState(async () => verifyPaymentAction(payment.id, days), { error: "", success: "" });
  const [rejectState, rejectAction, rejectPending] = useActionState(async () => rejectPaymentAction(payment.id), { error: "", success: "" });
  const statusColors: Record<string, string> = {
    pending: "bg-amber-900/50 text-amber-300",
    verified: "bg-emerald-900/50 text-emerald-300",
    failed: "bg-red-900/50 text-red-300",
    refunded: "bg-gray-800 text-gray-400",
  };
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold">{payment.schoolName}</h2>
            <span className={"rounded-full text-[10px] px-2 py-0.5 font-medium " + (statusColors[payment.status] || "")}>{payment.status}</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">{payment.planName} · {formatPrice(payment.amount)} · {payment.methodLabel}</p>
        </div>
        <span className="text-[10px] text-white/30">{new Date(payment.createdAt).toLocaleString()}</span>
      </div>
      {payment.notes && <p className="text-xs text-white/50 mb-2">Note: {payment.notes}</p>}
      {payment.reference && <p className="text-xs text-white/50 mb-1">Ref: {payment.reference}</p>}
      {payment.proofUrl && (
        <div className="mb-3">
          <p className="text-xs text-white/50 mb-1">Receipt:</p>
          <img src={payment.proofUrl} alt="Receipt" className="max-w-xs max-h-48 rounded-lg border border-white/10 bg-white/5 object-contain cursor-pointer"
            onClick={() => payment.proofUrl && window.open(payment.proofUrl, "_blank")} />
        </div>
      )}
      {payment.status === "pending" && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50">Days:</label>
            <input type="number" value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 30))}
              className="w-20 bg-white/5 border border-white/10 rounded text-xs text-white p-1.5" />
          </div>
          <form action={verifyAction}><button type="submit" disabled={verifyPending} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">{verifyPending ? "..." : "Verify"}</button></form>
          <form action={rejectAction}><button type="submit" disabled={rejectPending} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-900/50 disabled:opacity-60">{rejectPending ? "..." : "Reject"}</button></form>
          {verifyState.success && <p className="text-emerald-400 text-xs">{verifyState.success}</p>}
          {verifyState.error && <p className="text-red-400 text-xs">{verifyState.error}</p>}
          {rejectState.success && <p className="text-emerald-400 text-xs">{rejectState.success}</p>}
        </div>
      )}
    </div>
  );
}

function CashCodesSection({ plans }: { plans: PlanVM[] }) {
  const [codeState, codeAction, codePending] = useActionState(generateCashCodeAction, { error: "", success: "" });
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Generate Cash Code</h2>
        <form action={codeAction} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-white/50 block mb-1">Plan</label>
            <select name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-white/50 block mb-1">School ID (optional)</label>
            <input name="schoolId" placeholder="Pre-assign to school" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
          </div>
          <button type="submit" disabled={codePending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap">{codePending ? "..." : "Generate"}</button>
        </form>
        {codeState.success && (
          <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
            <p className="text-xs text-emerald-300 mb-1">Code generated:</p>
            <p className="text-white font-mono text-lg tracking-widest">{codeState.success}</p>
            <p className="text-xs text-white/40 mt-1">Give this code to the school for cash payment.</p>
          </div>
        )}
        {codeState.error && <p className="text-red-400 text-xs mt-2">{codeState.error}</p>}
      </div>
    </div>
  );
}