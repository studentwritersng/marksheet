"use client";

import { useActionState, useState } from "react";
import { activateAddonWithCodeAction, purchaseAddonAction } from "./actions";

interface AddonVM {
  id: string; name: string; description: string | null; features: string[] | null;
  basicPrice: number | null; standardPrice: number | null; premiumPrice: number | null; price: number | null;
  durationDays: number | null; isActive: boolean; sortOrder: number;
}
interface SchoolAddonVM { addonId: string; status: string; activatedVia: string; expiresAt: string | null; }
interface MethodVM { id: string; type: string; label: string; details: Record<string, string> | null; }

function formatPrice(n?: number | null) {
  if (n == null) return "Free";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

// Colorful gradient themes — cycles through these per addon
const THEMES = [
  { name: "indigo",   gradient: "from-indigo-500 via-purple-500 to-pink-500",   soft: "bg-indigo-50 border-indigo-200",    text: "text-indigo-600",   badge: "bg-indigo-100 text-indigo-700" },
  { name: "emerald",  gradient: "from-emerald-500 via-teal-500 to-cyan-500",   soft: "bg-emerald-50 border-emerald-200",   text: "text-emerald-600",   badge: "bg-emerald-100 text-emerald-700" },
  { name: "amber",    gradient: "from-amber-500 via-orange-500 to-red-500",     soft: "bg-amber-50 border-amber-200",       text: "text-amber-600",     badge: "bg-amber-100 text-amber-700" },
  { name: "violet",   gradient: "from-violet-500 via-fuchsia-500 to-pink-500",  soft: "bg-violet-50 border-violet-200",     text: "text-violet-600",    badge: "bg-violet-100 text-violet-700" },
  { name: "sky",      gradient: "from-sky-500 via-blue-500 to-indigo-500",      soft: "bg-sky-50 border-sky-200",           text: "text-sky-600",      badge: "bg-sky-100 text-sky-700" },
  { name: "rose",     gradient: "from-rose-500 via-pink-500 to-fuchsia-500",    soft: "bg-rose-50 border-rose-200",         text: "text-rose-600",     badge: "bg-rose-100 text-rose-700" },
];

// Map known addon names to specific icons
const ADDON_ICONS: Record<string, string> = {
  "timetable generator": "calendar_view_week",
  "period tracker": "track_changes",
  "daily attendance": "qr_code_scanner",
  "notifications": "notifications_active",
  "multi-branch": "workspaces",
  "sms": "sms",
  "whatsapp": "chat",
};

function getIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const key in ADDON_ICONS) {
    if (lower.includes(key)) return ADDON_ICONS[key];
  }
  return "extension";
}

function getPriceForStage(addon: AddonVM, stage: string): number | null {
  const stagePrice =
    stage === "basic" ? addon.basicPrice
      : stage === "standard" ? addon.standardPrice
        : addon.premiumPrice;
  return stagePrice ?? addon.price;
}

// Map feature text to an appropriate icon
function getFeatureIcon(feature: string): string {
  const f = feature.toLowerCase();
  if (f.includes("dashboard") || f.includes("overview")) return "dashboard";
  if (f.includes("qr") || f.includes("scan")) return "qr_code_scanner";
  if (f.includes("ai") || f.includes("smart") || f.includes("optim")) return "auto_awesome";
  if (f.includes("calendar") || f.includes("schedule") || f.includes("period")) return "calendar_view_week";
  if (f.includes("notification") || f.includes("sms") || f.includes("whatsapp") || f.includes("message")) return "notifications_active";
  if (f.includes("transfer") || f.includes("cross")) return "swap_horiz";
  if (f.includes("comparison") || f.includes("compare")) return "compare_arrows";
  if (f.includes("track") || f.includes("monitor")) return "track_changes";
  if (f.includes("room") || f.includes("manage")) return "meeting_room";
  if (f.includes("template") || f.includes("custom")) return "tune";
  if (f.includes("report") || f.includes("card")) return "description";
  if (f.includes("real-time") || f.includes("live")) return "bolt";
  if (f.includes("verify") || f.includes("verification") || f.includes("two-way")) return "verified";
  if (f.includes("credit") || f.includes("cost")) return "savings";
  if (f.includes("anti") || f.includes("delay") || f.includes("ban")) return "shield";
  if (f.includes("group") || f.includes("branch")) return "workspaces";
  if (f.includes("license")) return "payments";
  if (f.includes("proprietor")) return "person";
  return "check_circle";
}

export function AddonsClient({ addons, activeAddons, schoolStage, methods }: {
  addons: AddonVM[]; activeAddons: SchoolAddonVM[]; schoolStage: string; methods: MethodVM[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"code" | "purchase">("code");
  const [codeState, codeAction, codePending] = useActionState(activateAddonWithCodeAction, {});
  const [purchaseState, purchaseAction, purchasePending] = useActionState(purchaseAddonAction, {});

  const activeMap = new Map(activeAddons.map((a) => [a.addonId, a]));
  const activeAddonsList = addons.filter((a) => a.isActive);

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Addons</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Extend your school&apos;s platform with additional features.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeAddonsList.map((addon, index) => {
          const theme = THEMES[index % THEMES.length];
          const active = activeMap.get(addon.id);
          const isExpanded = expanded === addon.id;
          const isAction = actionFor === addon.id;
          const price = getPriceForStage(addon, schoolStage);
          const icon = getIcon(addon.name);

          return (
            <div key={addon.id} className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ${theme.soft} border`}>
              {/* Gradient header */}
              <div className={`bg-gradient-to-br ${theme.gradient} p-5 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-4 -mb-4" />
                <div className="relative flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[24px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  {active && (
                    <span className={`text-[10px] rounded-full px-2.5 py-1 font-semibold ${
                      active.status === "active" ? "bg-white/90 text-emerald-600" : "bg-white/90 text-amber-600"
                    }`}>
                      {active.status === "active" ? "✓ Active" : "Pending"}
                    </span>
                  )}
                </div>
                <h2 className="relative text-white font-bold text-lg mt-3">{addon.name}</h2>
                {addon.description && <p className="relative text-white/80 text-xs mt-0.5 line-clamp-2">{addon.description}</p>}
              </div>

              {/* Body */}
              <div className="p-5 space-y-3">
                {/* Price */}
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-on-surface">{formatPrice(price)}</span>
                  <span className="text-xs text-on-surface-variant">
                    {addon.durationDays ? `/ ${addon.durationDays} days` : price ? "one-time" : ""}
                  </span>
                </div>

                {/* Features */}
                <button onClick={() => setExpanded(isExpanded ? null : addon.id)}
                  className={`flex items-center gap-1 text-xs ${theme.text} hover:underline transition-colors`}>
                  <span className="material-symbols-outlined text-[14px]">{isExpanded ? "expand_less" : "expand_more"}</span>
                  {isExpanded ? "Hide features" : `${addon.features?.length ?? 0} features`}
                </button>

                {isExpanded && addon.features && addon.features.length > 0 && (
                  <ul className="space-y-2 pt-1 border-t border-outline-variant/50">
                    {addon.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                        <span className={`material-symbols-outlined text-[18px] ${theme.text} mt-0.5 shrink-0`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {getFeatureIcon(f)}
                        </span>
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Action */}
                {!active || active.status !== "active" ? (
                  <button onClick={() => { setActionFor(isAction ? null : addon.id); setExpanded(addon.id); }}
                    className={`mt-1 w-full bg-gradient-to-r ${theme.gradient} text-white font-semibold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-md`}>
                    {isAction ? "Cancel" : "Activate"}
                  </button>
                ) : (
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-200">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {active.activatedVia === "code" ? "Activated via code" : "Purchased"}
                    {active.expiresAt && ` · ${new Date(active.expiresAt).toLocaleDateString()}`}
                  </div>
                )}

                {/* Activation panel */}
                {isAction && !active && (
                  <div className="border-t border-outline-variant pt-3 space-y-3">
                    <div className="flex rounded-lg border border-outline-variant overflow-hidden text-xs">
                      <button type="button" onClick={() => setActionMode("code")}
                        className={`flex-1 py-2 text-center font-medium transition-colors ${actionMode === "code" ? `text-white bg-gradient-to-r ${theme.gradient}` : "text-on-surface-variant hover:bg-surface-container-lowest"}`}>
                        Enter Code
                      </button>
                      {price && price > 0 && (
                        <button type="button" onClick={() => setActionMode("purchase")}
                          className={`flex-1 py-2 text-center font-medium transition-colors ${actionMode === "purchase" ? `text-white bg-gradient-to-r ${theme.gradient}` : "text-on-surface-variant hover:bg-surface-container-lowest"}`}>
                          Purchase
                        </button>
                      )}
                    </div>

                    {actionMode === "code" && (
                      <form action={codeAction} className="space-y-2">
                        <input type="hidden" name="addonId" value={addon.id} />
                        <input name="code" required placeholder="ADDON-XXXXXX"
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 font-mono tracking-widest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        <button type="submit" disabled={codePending}
                          className={`w-full bg-gradient-to-r ${theme.gradient} text-white text-sm py-2 rounded-lg disabled:opacity-60 shadow-sm`}>
                          {codePending ? "Activating..." : "Activate with Code"}
                        </button>
                        {codeState.error && <p className="text-red-600 text-xs">{codeState.error}</p>}
                        {codeState.success && <p className="text-emerald-600 text-xs">{codeState.success}</p>}
                      </form>
                    )}

                    {actionMode === "purchase" && price && (
                      <form action={purchaseAction} className="space-y-2">
                        <input type="hidden" name="addonId" value={addon.id} />
                        {methods.length > 0 && (
                          <select name="methodId" required className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                            <option value="">Select payment method</option>
                            {methods.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.type.replace("_", " ")})</option>)}
                          </select>
                        )}
                        <input name="reference" placeholder="Payment reference / teller ID"
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        <input name="notes" placeholder="Optional notes"
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        <button type="submit" disabled={purchasePending}
                          className={`w-full bg-gradient-to-r ${theme.gradient} text-white text-sm py-2 rounded-lg disabled:opacity-60 shadow-sm`}>
                          {purchasePending ? "Processing..." : `Pay ${formatPrice(price)}`}
                        </button>
                        {purchaseState.error && <p className="text-red-600 text-xs">{purchaseState.error}</p>}
                        {purchaseState.success && <p className="text-emerald-600 text-xs">{purchaseState.success}</p>}
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {activeAddonsList.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/30">extension_off</span>
            <p className="text-on-surface-variant text-sm mt-2">No addons available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
