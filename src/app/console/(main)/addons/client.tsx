"use client";

import { useActionState, useState } from "react";
import {
  createAddonAction, updateAddonAction, toggleAddonActiveAction, deleteAddonAction, generateAddonCodeAction,
} from "./actions";

interface AddonVM {
  id: string;
  name: string;
  description: string | null;
  features: string[] | null;
  basicPrice: number | null;
  standardPrice: number | null;
  premiumPrice: number | null;
  price: number | null;
  durationDays: number | null;
  isGroupBilling: boolean;
  isActive: boolean;
}
interface CodeVM { id: string; code: string; schoolId: string | null; isUsed: boolean; usedBySchoolId: string | null; createdAt: string; }

function formatPrice(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

// Helper: build a 3-column stage pricing summary
function StagePriceSummary({ a }: { a: AddonVM }) {
  const stages = [
    { label: "Basic",    value: a.basicPrice },
    { label: "Standard", value: a.standardPrice },
    { label: "Premium",  value: a.premiumPrice },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 mt-2">
      {stages.map((s) => (
        <div key={s.label} className="bg-white/5 rounded p-1.5 text-center">
          <p className="text-[9px] text-white/40 uppercase tracking-wider">{s.label}</p>
          <p className="text-xs text-white font-medium">{formatPrice(s.value) ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function AddonCard({ a }: { a: AddonVM }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateAddonAction, {});
  const [togState, togAction, togPending] = useActionState(async () => toggleAddonActiveAction(a.id, !a.isActive), {});
  const [delState, delAction, delPending] = useActionState(async () => deleteAddonAction(a.id), {});

  if (editing) {
    return (
      <form action={editAction} className="bg-white/[0.03] rounded-lg p-4 border border-white/5 space-y-2">
        <input type="hidden" name="addonId" value={a.id} />
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Name</label>
          <input name="name" defaultValue={a.name} required className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white" />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Description</label>
          <textarea name="description" defaultValue={a.description ?? ""} rows={2} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white" />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Features (one per line)</label>
          <textarea name="features" defaultValue={a.features?.join("\n") ?? ""} rows={3} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white" />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Pricing (leave empty = not available for that tier)</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-white/40 block mb-0.5">Basic</label>
              <input name="basicPrice" type="number" step="0.01" min="0" defaultValue={a.basicPrice ?? ""} placeholder="—" className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
            </div>
            <div>
              <label className="text-[9px] text-white/40 block mb-0.5">Standard</label>
              <input name="standardPrice" type="number" step="0.01" min="0" defaultValue={a.standardPrice ?? ""} placeholder="—" className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
            </div>
            <div>
              <label className="text-[9px] text-white/40 block mb-0.5">Premium</label>
              <input name="premiumPrice" type="number" step="0.01" min="0" defaultValue={a.premiumPrice ?? ""} placeholder="—" className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
            </div>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Duration (days, empty = permanent)</label>
          <input name="durationDays" type="number" min="1" defaultValue={a.durationDays ?? ""} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isGroupBilling" value="true" defaultChecked={a.isGroupBilling} className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500" />
          <span className="text-[10px] text-white/50">Group billing — price scales progressively based on number of schools in the group (2: -10%, 3: -15%, 4: -20%, 5+: -25%)</span>
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={editPending} className="text-[10px] text-emerald-400 hover:text-emerald-300 underline">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-[10px] text-white/40 hover:text-white/70 underline">Cancel</button>
        </div>
        {editState.success && <p className="text-emerald-400 text-[10px]">{editState.success}</p>}
        {editState.error && <p className="text-red-400 text-[10px]">{editState.error}</p>}
      </form>
    );
  }

  return (
    <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white font-medium text-sm">{a.name}</p>
        <div className="flex gap-1">
          {a.isGroupBilling && <span className="text-[9px] text-indigo-300 bg-indigo-900/30 rounded-full px-2 py-0.5">Group billing</span>}
          {a.isActive ? <span className="text-[10px] text-emerald-400 bg-emerald-900/30 rounded-full px-2 py-0.5">Active</span> : <span className="text-[10px] text-gray-400 bg-gray-800/30 rounded-full px-2 py-0.5">Inactive</span>}
        </div>
      </div>
      {a.description && <p className="text-white/40 text-xs mb-1">{a.description}</p>}
      {a.features && a.features.length > 0 && (
        <ul className="text-[10px] text-white/30 space-y-0.5 mb-2 pl-3 list-disc">
          {a.features.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
      <StagePriceSummary a={a} />
      <p className="text-[10px] text-white/40 mt-2">
        {a.durationDays ? `${a.durationDays} days` : "Permanent"}
      </p>
      <div className="flex gap-2 mt-2">
        <button onClick={() => setEditing(true)} className="text-[10px] text-white/40 hover:text-white/70 underline">Edit</button>
        <form action={togAction}><button type="submit" disabled={togPending} className="text-[10px] text-white/40 hover:text-white/70 underline">{a.isActive ? "Deactivate" : "Activate"}</button></form>
        {!a.isActive && <form action={delAction}><button type="submit" disabled={delPending} className="text-[10px] text-red-400 hover:text-red-300 underline">Delete</button></form>}
      </div>
      {togState.success && <p className="text-emerald-400 text-[10px] mt-1">{togState.success}</p>}
      {togState.error && <p className="text-red-400 text-[10px] mt-1">{togState.error}</p>}
      {delState.success && <p className="text-emerald-400 text-[10px] mt-1">{delState.success}</p>}
    </div>
  );
}

export function AddonsClient({ addons, codes }: { addons: AddonVM[]; codes: CodeVM[] }) {
  const [showForm, setShowForm] = useState(false);
  const [formState, formAction, formPending] = useActionState(createAddonAction, {});
  const [codeState, codeAction, codePending] = useActionState(generateAddonCodeAction, {});
  const [genAddonId, setGenAddonId] = useState(addons[0]?.id ?? "");
  const [tab, setTab] = useState<"addons" | "codes">("addons");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Addons</h1>
          <p className="text-sm text-white/40 mt-1">{addons.length} addon{addons.length !== 1 ? "s" : ""} defined · pricing is set per tier (Basic / Standard / Premium)</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/5 pb-0">
        {(["addons", "codes"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={"text-sm px-4 pb-2 -mb-px border-b-2 transition-colors " + (tab === t ? "border-emerald-500 text-white" : "border-transparent text-white/40 hover:text-white/70")}
          >{t === "addons" ? "Addons" : "Activation Codes"}</button>
        ))}
      </div>

      {tab === "addons" && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowForm(!showForm)}
              className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
            >{showForm ? "Cancel" : "New Addon"}</button>
          </div>

          {showForm && (
            <form action={formAction} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Name</label>
                  <input name="name" required placeholder="e.g. SMS Notifications" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Duration (days)</label>
                  <input name="durationDays" type="number" min="1" placeholder="Empty = permanent/one-time" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-2">Pricing (leave empty = not available for that tier)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Basic stage</label>
                    <input name="basicPrice" type="number" step="0.01" min="0" placeholder="—" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Standard stage</label>
                    <input name="standardPrice" type="number" step="0.01" min="0" placeholder="—" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Premium stage</label>
                    <input name="premiumPrice" type="number" step="0.01" min="0" placeholder="—" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Description</label>
                <textarea name="description" rows={2} placeholder="Brief description of the addon" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Features (one per line)</label>
                <textarea name="features" rows={4} placeholder="Feature 1&#10;Feature 2&#10;Feature 3" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isGroupBilling" value="true" className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500" />
                <span className="text-xs text-white/50">Group billing — price scales progressively based on number of schools (2: -10%, 3: -15%, 4: -20%, 5+: -25%)</span>
              </label>
              <button type="submit" disabled={formPending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">{formPending ? "..." : "Create"}</button>
              {formState.error && <p className="text-red-400 text-xs">{formState.error}</p>}
              {formState.success && <p className="text-emerald-400 text-xs">{formState.success}</p>}
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {addons.map((a) => <AddonCard key={a.id} a={a} />)}
            {addons.length === 0 && <p className="text-white/30 text-sm col-span-full py-8 text-center">No addons defined yet.</p>}
          </div>
        </>
      )}

      {tab === "codes" && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Generate Activation Code</h2>
            <form action={codeAction} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-white/50 block mb-1">Addon</label>
                <select name="addonId" value={genAddonId} onChange={(e) => setGenAddonId(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">
                  {addons.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                <p className="text-white font-mono text-lg tracking-widest">{codeState.code ?? codeState.success}</p>
                <p className="text-xs text-white/40 mt-1">Give this code to the school to activate the addon.</p>
              </div>
            )}
            {codeState.error && <p className="text-red-400 text-xs mt-2">{codeState.error}</p>}
          </div>

          {codes.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">All Activation Codes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Code</th>
                      <th className="text-left px-4 py-3 font-medium">Pre-assigned School</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {codes.map((c) => (
                      <tr key={c.id} className="text-xs text-white/70">
                        <td className="px-5 py-3 font-mono">{c.code}</td>
                        <td className="px-4 py-3 text-white/50">{c.schoolId ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] rounded-full px-2 py-0.5 ${c.isUsed ? "bg-gray-800 text-gray-400" : "bg-emerald-900/30 text-emerald-300"}`}>
                            {c.isUsed ? "Used" : "Available"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/40">{new Date(c.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
