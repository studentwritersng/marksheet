"use client";

import { useActionState, useState } from "react";
import { activateAddonWithCodeAction, purchaseAddonAction } from "./actions";

interface AddonVM { id: string; name: string; description: string | null; features: string[] | null; price?: number | null; durationDays?: number | null; isActive: boolean; }
interface SchoolAddonVM { addonId: string; status: string; activatedVia: string; expiresAt: string | null; }
interface MethodVM { id: string; type: string; label: string; details: Record<string, string> | null; }

function formatPrice(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export function AddonsClient({ addons, activeAddons, methods }: {
  addons: AddonVM[]; activeAddons: SchoolAddonVM[]; methods: MethodVM[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"code" | "purchase">("code");
  const [codeState, codeAction, codePending] = useActionState(activateAddonWithCodeAction, {});
  const [purchaseState, purchaseAction, purchasePending] = useActionState(purchaseAddonAction, {});

  const activeMap = new Map(activeAddons.map((a) => [a.addonId, a]));

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Addons</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Extend your school&apos;s platform with additional features.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {addons.filter((a) => a.isActive).map((addon) => {
          const active = activeMap.get(addon.id);
          const isExpanded = expanded === addon.id;
          const isAction = actionFor === addon.id;

          return (
            <div key={addon.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">{addon.name}</h2>
                  {active && (
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                      active.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>{active.status}</span>
                  )}
                </div>
                {addon.description && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{addon.description}</p>}
                <p className="font-label-md text-label-md text-on-surface mt-2">
                  {formatPrice(addon.price) ?? "Free"}
                  {addon.durationDays ? ` / ${addon.durationDays} days` : addon.price ? " / one-time" : ""}
                </p>

                <button onClick={() => setExpanded(isExpanded ? null : addon.id)}
                  className="mt-2 text-xs text-primary underline hover:text-primary-container transition-colors">
                  {isExpanded ? "Hide features" : `View features (${addon.features?.length ?? 0})`}
                </button>

                {isExpanded && addon.features && addon.features.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {addon.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px] text-primary mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {!active || active.status !== "active" ? (
                  <button onClick={() => { setActionFor(isAction ? null : addon.id); setExpanded(addon.id); }}
                    className="mt-4 w-full bg-[#002046] hover:bg-[#003366] text-white text-sm py-2 rounded-lg disabled:opacity-60">
                    {isAction ? "Cancel" : "Activate"}
                  </button>
                ) : (
                  <div className="mt-4 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 text-center">
                    {active.activatedVia === "code" ? "Activated via code" : "Purchased"}
                    {active.expiresAt && ` · Expires ${new Date(active.expiresAt).toLocaleDateString()}`}
                  </div>
                )}
              </div>

              {isAction && !active && (
                <div className="border-t border-outline-variant p-4 space-y-3 bg-surface-container-low">
                  {/* Tab toggle */}
                  <div className="flex rounded-lg border border-outline-variant overflow-hidden text-xs">
                    <button type="button" onClick={() => setActionMode("code")}
                      className={`flex-1 py-2 text-center ${actionMode === "code" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-lowest"}`}>Enter Code</button>
                    {addon.price && addon.price > 0 && (
                      <button type="button" onClick={() => setActionMode("purchase")}
                        className={`flex-1 py-2 text-center ${actionMode === "purchase" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-lowest"}`}>Purchase</button>
                    )}
                  </div>

                  {actionMode === "code" && (
                    <form action={codeAction} className="space-y-2">
                      <input type="hidden" name="addonId" value={addon.id} />
                      <input name="code" required placeholder="Enter activation code (e.g. ADDON-A3B7K9)"
                        className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 font-mono tracking-widest" />
                      <button type="submit" disabled={codePending}
                        className="w-full bg-[#002046] hover:bg-[#003366] text-white text-sm py-1.5 rounded-lg disabled:opacity-60">
                        {codePending ? "..." : "Activate with Code"}
                      </button>
                      {codeState.error && <p className="text-red-600 text-xs">{codeState.error}</p>}
                      {codeState.success && <p className="text-emerald-600 text-xs">{codeState.success}</p>}
                    </form>
                  )}

                  {actionMode === "purchase" && addon.price && (
                    <form action={purchaseAction} className="space-y-2">
                      <input type="hidden" name="addonId" value={addon.id} />
                      {methods.length > 0 && (
                        <select name="methodId" required className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface">
                          <option value="">Select payment method</option>
                          {methods.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.type.replace("_", " ")})</option>)}
                        </select>
                      )}
                      <input name="reference" placeholder="Payment reference / teller ID (for bank transfer)"
                        className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface placeholder:text-on-surface-variant/50" />
                      <input name="notes" placeholder="Optional notes"
                        className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm text-on-surface placeholder:text-on-surface-variant/50" />
                      <button type="submit" disabled={purchasePending}
                        className="w-full bg-[#002046] hover:bg-[#003366] text-white text-sm py-1.5 rounded-lg disabled:opacity-60">
                        {purchasePending ? "..." : `Pay ${formatPrice(addon.price)}`}
                      </button>
                      {purchaseState.error && <p className="text-red-600 text-xs">{purchaseState.error}</p>}
                      {purchaseState.success && <p className="text-emerald-600 text-xs">{purchaseState.success}</p>}
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {addons.filter((a) => a.isActive).length === 0 && (
          <p className="text-on-surface-variant text-sm col-span-full py-12 text-center">No addons available yet.</p>
        )}
      </div>
    </div>
  );
}
