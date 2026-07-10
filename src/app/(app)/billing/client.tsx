"use client";

import { useActionState, useState } from "react";
import { submitPaymentAction } from "./actions";

interface PlanVM { id: string; name: string; durationType: string; price?: number | null; durationDays?: number | null; }
interface MethodVM { id: string; type: string; label: string; details: Record<string, string> | null; }
interface PaymentVM { id: string; planName: string; amount: number; methodLabel: string; status: string; createdAt: string; }
interface LicenseVM { status: string; endDate?: string; planName?: string; }

function formatPrice(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export function BillingClient({ plans, methods, payments, license, schoolName }: {
  plans: PlanVM[]; methods: MethodVM[]; payments: PaymentVM[]; license?: LicenseVM | null; schoolName: string;
}) {
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [state, action, pending] = useActionState(submitPaymentAction, {});

  const chosenPlan = plans.find((p) => p.id === selectedPlan);
  const chosenMethod = methods.find((m) => m.id === selectedMethod);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing & License</h1>
        <p className="text-sm text-white/40 mt-1">{schoolName}</p>
      </div>

      {license && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">Current License</h2>
          <div className="flex items-center gap-3">
            <span className={`rounded-full text-xs px-3 py-1 font-medium ${
              license.status === "active" ? "bg-emerald-900/50 text-emerald-300" :
              license.status === "grace_period" ? "bg-amber-900/50 text-amber-300" :
              "bg-red-900/50 text-red-300"
            }`}>{license.status.replace("_", " ")}</span>
            <span className="text-white/70 text-sm">{license.planName}</span>
            {license.endDate && (
              <span className="text-white/40 text-xs">Expires {new Date(license.endDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Choose a Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => {
            const active = selectedPlan === p.id;
            return (
              <button key={p.id} onClick={() => { setSelectedPlan(p.id); setSelectedMethod(""); }}
                className={`text-left rounded-xl p-4 border transition-all ${
                  active ? "border-emerald-500/50 bg-emerald-900/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <p className="text-white font-semibold">{p.name}</p>
                <p className="text-xs text-white/40 capitalize">{p.durationType}</p>
                <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                  {p.price != null && <span className="text-emerald-400 font-semibold">{formatPrice(p.price)}</span>}
                  {p.durationDays && <span>{p.durationDays} days</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedPlan && methods.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Payment Method</h2>
          <div className="space-y-2">
            {methods.map((m) => {
              const active = selectedMethod === m.id;
              return (
                <button key={m.id} onClick={() => setSelectedMethod(m.id)}
                  className={`w-full text-left rounded-lg p-3 border transition-all ${
                    active ? "border-emerald-500/50 bg-emerald-900/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-white/40 capitalize">{m.type.replace("_", " ")}</p>
                    </div>
                    {active && <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>}
                  </div>
                  {active && m.type === "bank_transfer" && m.details && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/60 space-y-0.5">
                      <p>Bank: <span className="text-white/80">{m.details.bankName}</span></p>
                      <p>Account: <span className="text-white/80">{m.details.accountNumber}</span></p>
                      <p>Name: <span className="text-white/80">{m.details.accountName}</span></p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlan && selectedMethod && (
        <form action={action} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Submit Payment</h2>

          <input type="hidden" name="planId" value={selectedPlan} />
          <input type="hidden" name="methodId" value={selectedMethod} />

          {chosenMethod?.type === "bank_transfer" && (
            <div>
              <label className="text-xs text-white/50 block mb-1">Payment Reference / Teller ID</label>
              <input name="reference" required placeholder="Enter bank teller ID or transaction ref"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
            </div>
          )}

          <div>
            <label className="text-xs text-white/50 block mb-1">Notes (optional)</label>
            <textarea name="notes" rows={2} placeholder="Any additional info..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-60"
            >{pending ? "Submitting..." : `Pay ${formatPrice(chosenPlan?.price) ?? ""}`}</button>
            {chosenMethod?.type === "cash" && (
              <span className="text-xs text-amber-400">You'll pay cash at the school office. This request needs verification.</span>
            )}
          </div>
          {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
          {state.success && <p className="text-emerald-400 text-xs">{state.success}</p>}
        </form>
      )}

      {payments.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Payment History</h2>
          </div>
          <div className="divide-y divide-white/5">
            {payments.map((p) => {
              const colors: Record<string, string> = {
                pending: "text-amber-400",
                verified: "text-emerald-400",
                failed: "text-red-400",
              };
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-white/70">{p.planName}</p>
                    <p className="text-xs text-white/40">{p.methodLabel} · {new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white">{formatPrice(p.amount)}</p>
                    <p className={`text-xs capitalize ${colors[p.status] ?? "text-white/40"}`}>{p.status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
