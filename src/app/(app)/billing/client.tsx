"use client";

import { useActionState, useState, useRef } from "react";
import { submitPaymentAction } from "./actions";

interface PlanVM { id: string; name: string; durationType: string; price?: number | null; durationDays?: number | null; }
interface MethodVM { id: string; type: string; label: string; details: Record<string, string> | null; }
interface PaymentVM { id: string; planName: string; amount: number; methodLabel: string; status: string; createdAt: string; }
interface LicenseVM { status: string; endDate?: string; planName?: string; }
interface StageVM { name: string; price?: number | null; planName: string; }

function formatPrice(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export function BillingClient({ plans, methods, payments, license, schoolName, schoolStage }: {
  plans: PlanVM[]; methods: MethodVM[]; payments: PaymentVM[]; license?: LicenseVM | null; schoolName: string; schoolStage: StageVM | null;
}) {
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [proofBase64, setProofBase64] = useState<string>("");
  const [cashCode, setCashCode] = useState<string>("");
  const [state, action, pending] = useActionState(submitPaymentAction, {});
  const fileRef = useRef<HTMLInputElement>(null);

  const chosenPlan = plans.find((p) => p.id === selectedPlan);
  const chosenMethod = methods.find((m) => m.id === selectedMethod);

  // Use the school's stage price if available, otherwise fall back to plan price
  const effectivePrice = schoolStage?.price ?? chosenPlan?.price;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProofBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Billing & License</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{schoolName}</p>
      </div>

      {schoolStage && (
        <div className="bg-primary-container border border-outline-variant rounded-xl p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Your Pricing Stage</p>
          <p className="font-label-md text-label-md text-on-primary-container font-semibold">{schoolStage.planName} — {schoolStage.name}</p>
          {schoolStage.price != null && <p className="text-lg font-bold text-emerald-700 mt-1">{formatPrice(schoolStage.price)}</p>}
        </div>
      )}

      {license && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Current License</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`rounded-full text-xs px-3 py-1 font-medium ${
              license.status === "active" ? "bg-emerald-100 text-emerald-700" :
              license.status === "grace_period" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
            }`}>{license.status.replace("_", " ")}</span>
            <span className="text-on-surface text-sm font-medium">{license.planName}</span>
            {license.endDate && (
              <span className="text-on-surface-variant text-xs">Expires {new Date(license.endDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Choose a Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => {
            const active = selectedPlan === p.id;
            const displayPrice = schoolStage?.price ?? p.price;
            return (
              <button key={p.id} onClick={() => { setSelectedPlan(p.id); setSelectedMethod(""); setCashCode(""); setProofBase64(""); }}
                className={`text-left rounded-xl p-4 border transition-all ${
                  active ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant bg-surface hover:bg-surface-container-low"
                }`}
              >
                <p className="font-label-md text-label-md font-semibold">{p.name}</p>
                <p className="text-xs text-on-surface-variant capitalize">{p.durationType}</p>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1">
                  {displayPrice != null && <span className="text-emerald-600 font-semibold">{formatPrice(displayPrice)}</span>}
                  {p.durationDays && <span>{p.durationDays} days</span>}
                </div>
                {schoolStage && schoolStage.price != null && (
                  <p className="text-[10px] text-on-surface-variant mt-1">Based on your {schoolStage.name} stage</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedPlan && methods.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Payment Method</h2>
          <div className="space-y-2">
            {methods.map((m) => {
              const active = selectedMethod === m.id;
              return (
                <button key={m.id} onClick={() => { setSelectedMethod(m.id); setCashCode(""); setProofBase64(""); }}
                  className={`w-full text-left rounded-lg p-3 border transition-all ${
                    active ? "border-primary bg-primary-container" : "border-outline-variant bg-surface hover:bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-on-surface text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-on-surface-variant capitalize">{m.type.replace("_", " ")}</p>
                    </div>
                    {active && <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>}
                  </div>
                  {active && m.type === "bank_transfer" && m.details && (
                    <div className="mt-2 pt-2 border-t border-outline-variant text-xs text-on-surface-variant space-y-1">
                      <p>Bank: <span className="text-on-surface font-medium">{m.details.bankName}</span></p>
                      <p>Account: <span className="text-on-surface font-medium">{m.details.accountNumber}</span></p>
                      <p>Name: <span className="text-on-surface font-medium">{m.details.accountName}</span></p>
                      {m.details.instructions && (
                        <div className="mt-2 pt-2 border-t border-outline-variant text-on-surface-variant whitespace-pre-wrap">{m.details.instructions}</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlan && selectedMethod && (
        <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-3">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Submit Payment</h2>

          <input type="hidden" name="planId" value={selectedPlan} />
          <input type="hidden" name="methodId" value={selectedMethod} />
          <input type="hidden" name="proofUrl" value={proofBase64} />
          {schoolStage && <input type="hidden" name="stageId" value={schoolStage.name} />}

          {chosenMethod?.type === "cash" && (
            <div>
              <label className="font-body-sm text-body-sm text-on-surface block mb-1">Cash Payment Code</label>
              <input name="cashCode" value={cashCode} onChange={(e) => setCashCode(e.target.value.toUpperCase())}
                required placeholder="Enter the code provided by your admin (e.g. CASH-A3B7K9)"
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 font-mono tracking-widest" />
              <p className="text-xs text-amber-600 mt-1">Enter the cash payment code you received after paying cash at the school office.</p>
            </div>
          )}

          {chosenMethod?.type === "bank_transfer" && (
            <>
              <div>
                <label className="font-body-sm text-body-sm text-on-surface block mb-1">Payment Reference / Teller ID</label>
                <input name="reference" required placeholder="Enter bank teller ID or transaction ref"
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface placeholder:text-on-surface-variant/50" />
              </div>
              <div>
                <label className="font-body-sm text-body-sm text-on-surface block mb-1">Upload Receipt (optional)</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}
                  className="w-full text-sm text-on-surface-variant file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-[#002046] file:text-white hover:file:bg-[#003366]" />
                {proofBase64 && <img src={proofBase64} alt="Receipt preview" className="mt-2 max-h-32 rounded-lg border border-outline-variant object-contain" />}
              </div>
            </>
          )}

          <div>
            <label className="font-body-sm text-body-sm text-on-surface block mb-1">Notes (optional)</label>
            <textarea name="notes" rows={2} placeholder="Any additional info..."
              className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface placeholder:text-on-surface-variant/50" />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending}
              className="bg-[#002046] hover:bg-[#003366] text-white text-sm px-5 py-2 rounded-lg disabled:opacity-60 font-label-md text-label-md"
            >{pending ? "Submitting..." : chosenMethod?.type === "cash" ? "Activate with Code" : `Pay ${formatPrice(effectivePrice) ?? ""}`}</button>
          </div>
          {state.error && <p className="text-red-600 text-xs">{state.error}</p>}
          {state.success && <p className="text-emerald-600 text-xs">{state.success}</p>}
        </form>
      )}

      {payments.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant">
            <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Payment History</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {payments.map((p) => {
              const colors: Record<string, string> = { pending: "text-amber-600", verified: "text-emerald-600", failed: "text-red-600" };
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-on-surface">{p.planName}</p>
                    <p className="text-xs text-on-surface-variant">{p.methodLabel} · {new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-on-surface font-medium">{formatPrice(p.amount)}</p>
                    <p className={`text-xs capitalize ${colors[p.status] ?? "text-on-surface-variant"}`}>{p.status}</p>
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
