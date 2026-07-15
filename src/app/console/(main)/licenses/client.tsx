"use client";

import { useActionState, useState } from "react";
import { createPlanAction, updatePlanAction, togglePlanActiveAction, deletePlanAction, setLicenseStatusAction, createStageAction, updateStageAction, deleteStageAction } from "./actions";

interface StageVM { id: string; name: string; price?: number | null; criteria: Record<string, number> | null; sortOrder: number; }
interface PlanVM { id: string; name: string; durationType: string; price?: number | null; durationDays?: number | null; isActive: boolean; stages: StageVM[]; }
interface LicenseVM {
  id: string; schoolName: string; planName: string; stageName: string | null; durationType: string;
  startDate: string; endDate: string; status: string;
  autoRenewIntent: boolean; paymentReference: string | null; setBy: string | null;
}

function formatPrice(price?: number | null) {
  if (price == null) return null;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(price);
}

export function LicensesClient({ plans, licenses }: { plans: PlanVM[]; licenses: LicenseVM[] }) {
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planState, planAction, planPending] = useActionState(createPlanAction, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Licenses</h1>
          <p className="text-sm text-white/40 mt-1">{licenses.length} record{licenses.length !== 1 ? "s" : ""}, {plans.length} plan{plans.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Plan Definitions</h2>
          <button onClick={() => setShowPlanForm(!showPlanForm)}
            className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
          >{showPlanForm ? "Cancel" : "New Plan"}</button>
        </div>

        {showPlanForm && (
          <form action={planAction} className="mb-4 p-4 bg-white/[0.03] rounded-lg border border-white/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">Name</label>
                <input name="name" required placeholder="e.g. Monthly" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Duration Type</label>
                <select name="durationType" required className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">
                  <option value="monthly">Monthly</option>
                  <option value="termly">Termly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Base Price</label>
                <input name="price" type="number" step="0.01" min="0" placeholder="e.g. 50000" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Duration (days)</label>
                <input name="durationDays" type="number" min="1" placeholder="e.g. 30" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
            </div>
            <button type="submit" disabled={planPending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">{planPending ? "..." : "Create"}</button>
            {planState.error && <p className="text-red-400 text-xs">{planState.error}</p>}
            {planState.success && <p className="text-emerald-400 text-xs">{planState.success}</p>}
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => <PlanCard key={p.id} plan={p} />)}
          {plans.length === 0 && <p className="text-white/30 text-sm col-span-full py-4 text-center">No plans defined.</p>}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">License Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">School</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Stage</th>
                <th className="text-left px-4 py-3 font-medium">Start</th>
                <th className="text-left px-4 py-3 font-medium">End</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Auto Renew</th>
                <th className="text-left px-4 py-3 font-medium">Payment Ref</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {licenses.map((l) => <LicenseRow key={l.id} license={l} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanVM }) {
  const [editing, setEditing] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [editState, editAction, editPending] = useActionState(updatePlanAction, {});
  const [togState, togAction, togPending] = useActionState(async () => togglePlanActiveAction(plan.id, !plan.isActive), {});
  const [delState, delAction, delPending] = useActionState(async () => deletePlanAction(plan.id), {});

  if (editing) {
    return (
      <form action={editAction} className="bg-white/[0.03] rounded-lg p-4 border border-white/5 space-y-2">
        <input type="hidden" name="planId" value={plan.id} />
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Name</label>
          <input name="name" defaultValue={plan.name} required className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-0.5">Duration Type</label>
          <select name="durationType" defaultValue={plan.durationType} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white">
            <option value="monthly">Monthly</option>
            <option value="termly">Termly</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-0.5">Base Price</label>
            <input name="price" type="number" step="0.01" min="0" defaultValue={plan.price ?? ""} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-0.5">Days</label>
            <input name="durationDays" type="number" min="1" defaultValue={plan.durationDays ?? ""} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
          </div>
        </div>
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
        <p className="text-white font-medium text-sm">{plan.name}</p>
        {plan.isActive ? <span className="text-[10px] text-emerald-400 bg-emerald-900/30 rounded-full px-2 py-0.5">Active</span> : <span className="text-[10px] text-gray-400 bg-gray-800/30 rounded-full px-2 py-0.5">Inactive</span>}
      </div>
      <p className="text-white/40 text-xs capitalize mb-1">{plan.durationType}</p>
      {plan.price != null && <p className="text-xs text-white/50">{formatPrice(plan.price)}{plan.durationDays ? " · " + plan.durationDays + " days" : ""}</p>}
      {plan.stages.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Stages</p>
          {plan.stages.map((s) => <StageRow key={s.id} stage={s} planId={plan.id} />)}
        </div>
      )}
      <button onClick={() => setShowStages(!showStages)} className="text-[10px] text-white/40 hover:text-white/70 underline mt-1 inline-block">
        {showStages ? "Close stage editor" : `Add / manage stages`}
      </button>
      {showStages && <StageForm planId={plan.id} />}
      <div className="flex gap-2 mt-2">
        <button onClick={() => setEditing(true)} className="text-[10px] text-white/40 hover:text-white/70 underline">Edit</button>
        <form action={togAction}><button type="submit" disabled={togPending} className="text-[10px] text-white/40 hover:text-white/70 underline">{plan.isActive ? "Deactivate" : "Activate"}</button></form>
        {!plan.isActive && <form action={delAction}><button type="submit" disabled={delPending} className="text-[10px] text-red-400 hover:text-red-300 underline">Delete</button></form>}
      </div>
      {togState.success && <p className="text-emerald-400 text-[10px] mt-1">{togState.success}</p>}
      {togState.error && <p className="text-red-400 text-[10px] mt-1">{togState.error}</p>}
      {delState.success && <p className="text-emerald-400 text-[10px] mt-1">{delState.success}</p>}
    </div>
  );
}

function StageRow({ stage, planId }: { stage: StageVM; planId: string }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateStageAction, {});
  const [delState, delAction, delPending] = useActionState(async () => deleteStageAction(stage.id), {});

  if (editing) {
    return (
      <form action={editAction} className="flex items-center gap-1">
        <input type="hidden" name="stageId" value={stage.id} />
        <input name="name" defaultValue={stage.name} required className="w-28 bg-white/5 border border-white/10 rounded p-0.5 text-[10px] text-white" />
        <input name="price" type="number" step="0.01" min="0" defaultValue={stage.price ?? ""} placeholder="Price" className="w-16 bg-white/5 border border-white/10 rounded p-0.5 text-[10px] text-white" />
        <input name="sortOrder" type="number" defaultValue={stage.sortOrder} className="w-10 bg-white/5 border border-white/10 rounded p-0.5 text-[10px] text-white" />
        <button type="submit" disabled={editPending} className="text-[10px] text-emerald-400 hover:text-emerald-300">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="text-[10px] text-white/40 hover:text-white/70">X</button>
        {editState.success && <span className="text-emerald-400 text-[10px]">{editState.success}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between text-[11px] text-white/70">
      <span>{stage.name}</span>
      <div className="flex items-center gap-2">
        {stage.price != null && <span className="text-emerald-400">{formatPrice(stage.price)}</span>}
        <button onClick={() => setEditing(true)} className="text-white/30 hover:text-white/70">Edit</button>
        <form action={delAction}><button type="submit" disabled={delPending} className="text-red-400 hover:text-red-300">Del</button></form>
      </div>
      {delState.error && <p className="text-red-400 text-[10px]">{delState.error}</p>}
    </div>
  );
}

function StageForm({ planId }: { planId: string }) {
  const [state, action, pending] = useActionState(createStageAction, {});
  return (
    <form action={action} className="mt-2 flex items-center gap-1">
      <input type="hidden" name="planId" value={planId} />
      <input name="name" required placeholder="Stage name" className="w-28 bg-white/5 border border-white/10 rounded p-0.5 text-[10px] text-white placeholder:text-white/20" />
      <input name="price" type="number" step="0.01" min="0" placeholder="Price" className="w-16 bg-white/5 border border-white/10 rounded p-0.5 text-[10px] text-white placeholder:text-white/20" />
      <input name="sortOrder" type="number" defaultValue="1" className="w-10 bg-white/5 border border-white/10 rounded p-0.5 text-[10px] text-white" />
      <button type="submit" disabled={pending} className="text-[10px] text-emerald-400 hover:text-emerald-300">Add</button>
      {state.success && <span className="text-emerald-400 text-[10px]">{state.success}</span>}
      {state.error && <span className="text-red-400 text-[10px]">{state.error}</span>}
    </form>
  );
}

function LicenseRow({ license }: { license: LicenseVM }) {
  const [newStatus, setNewStatus] = useState(license.status);
  const [statusState, statusAction, statusPending] = useActionState(async () => setLicenseStatusAction(license.id, newStatus), {});
  const [editing, setEditing] = useState(false);
  const statusColors: Record<string, string> = { active: "bg-emerald-900/50 text-emerald-300", grace_period: "bg-amber-900/50 text-amber-300", expired: "bg-red-900/50 text-red-300", suspended: "bg-gray-800 text-gray-400" };
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-5 py-3 text-white font-medium">{license.schoolName}</td>
      <td className="px-4 py-3 text-white/70">{license.planName}</td>
      <td className="px-4 py-3 text-white/50 text-xs font-mono">{license.stageName ?? "—"}</td>
      <td className="px-4 py-3 text-white/50 text-xs">{new Date(license.startDate).toLocaleDateString()}</td>
      <td className="px-4 py-3 text-white/50 text-xs">{new Date(license.endDate).toLocaleDateString()}</td>
      <td className="px-4 py-3"><span className={"rounded-full text-[11px] px-2.5 py-0.5 font-medium " + (statusColors[license.status] || "bg-gray-800 text-gray-400")}>{license.status.replace("_", " ")}</span></td>
      <td className="px-4 py-3 text-white/50 text-xs">{license.autoRenewIntent ? "Yes" : "No"}</td>
      <td className="px-4 py-3 text-white/30 text-xs font-mono max-w-[120px] truncate">{license.paymentReference || "—"}</td>
      <td className="px-4 py-3">
        {editing ? (
          <form action={statusAction} className="flex items-center gap-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="bg-white/5 border border-white/10 rounded text-xs text-white p-1">
              <option value="active">Active</option><option value="grace_period">Grace</option><option value="expired">Expired</option><option value="suspended">Suspended</option>
            </select>
            <button type="submit" disabled={statusPending} className="text-[10px] text-emerald-400 hover:text-emerald-300">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[10px] text-white/40 hover:text-white/70">Cancel</button>
          </form>
        ) : <button onClick={() => setEditing(true)} className="text-[10px] text-white/40 hover:text-white/70 underline">Change</button>}
        {statusState.success && <p className="text-emerald-400 text-[10px] mt-0.5">{statusState.success}</p>}
      </td>
    </tr>
  );
}
