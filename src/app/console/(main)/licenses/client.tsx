"use client";

import { useActionState, useState } from "react";
import {
  createPlanAction,
  togglePlanActiveAction,
  deletePlanAction,
  setLicenseStatusAction,
} from "./actions";

interface PlanVM { id: string; name: string; durationType: string; isActive: boolean; }
interface LicenseVM {
  id: string; schoolName: string; planName: string; durationType: string;
  startDate: string; endDate: string; status: string;
  autoRenewIntent: boolean; paymentReference: string | null; setBy: string | null;
}

export function LicensesClient({ plans, licenses }: { plans: PlanVM[]; licenses: LicenseVM[] }) {
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planState, planAction, planPending] = useActionState(createPlanAction, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Licenses</h1>
          <p className="text-sm text-white/40 mt-1">
            {licenses.length} license record{licenses.length !== 1 ? "s" : ""} across {plans.length} plan type{plans.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Plans */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Plan Definitions</h2>
          <button onClick={() => setShowPlanForm(!showPlanForm)}
            className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
          >{showPlanForm ? "Cancel" : "New Plan"}</button>
        </div>

        {showPlanForm && (
          <form action={planAction} className="mb-4 p-4 bg-white/[0.03] rounded-lg border border-white/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">Name</label>
                <input name="name" required placeholder="e.g. Monthly"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Duration Type</label>
                <select name="durationType" required
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">
                  <option value="monthly">Monthly</option>
                  <option value="termly">Termly</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={planPending}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60"
                >{planPending ? "..." : "Create"}</button>
              </div>
            </div>
            {planState.error && <p className="text-red-400 text-xs">{planState.error}</p>}
            {planState.success && <p className="text-emerald-400 text-xs">{planState.success}</p>}
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
          {plans.length === 0 && <p className="text-white/30 text-sm col-span-full py-4 text-center">No plans defined.</p>}
        </div>
      </div>

      {/* License records */}
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
                <th className="text-left px-4 py-3 font-medium">Start</th>
                <th className="text-left px-4 py-3 font-medium">End</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Auto Renew</th>
                <th className="text-left px-4 py-3 font-medium">Payment Ref</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {licenses.map((l) => (
                <LicenseRow key={l.id} license={l} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanVM }) {
  const [togState, togAction, togPending] = useActionState(
    async () => togglePlanActiveAction(plan.id, !plan.isActive),
    {},
  );
  const [delState, delAction, delPending] = useActionState(
    async () => deletePlanAction(plan.id),
    {},
  );

  return (
    <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white font-medium text-sm">{plan.name}</p>
        {plan.isActive
          ? <span className="text-[10px] text-emerald-400 bg-emerald-900/30 rounded-full px-2 py-0.5">Active</span>
          : <span className="text-[10px] text-gray-400 bg-gray-800/30 rounded-full px-2 py-0.5">Inactive</span>
        }
      </div>
      <p className="text-white/40 text-xs capitalize mb-2">{plan.durationType}</p>
      <div className="flex gap-2">
        <form action={togAction}>
          <button type="submit" disabled={togPending}
            className="text-[10px] text-white/40 hover:text-white/70 transition-colors underline"
          >{plan.isActive ? "Deactivate" : "Activate"}</button>
        </form>
        {!plan.isActive && (
          <form action={delAction}>
            <button type="submit" disabled={delPending}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors underline"
            >Delete</button>
          </form>
        )}
      </div>
      {togState.success && <p className="text-emerald-400 text-[10px] mt-1">{togState.success}</p>}
      {togState.error && <p className="text-red-400 text-[10px] mt-1">{togState.error}</p>}
      {delState.success && <p className="text-emerald-400 text-[10px] mt-1">{delState.success}</p>}
      {delState.error && <p className="text-red-400 text-[10px] mt-1">{delState.error}</p>}
    </div>
  );
}

function LicenseRow({ license }: { license: LicenseVM }) {
  const [newStatus, setNewStatus] = useState(license.status);
  const [statusState, statusAction, statusPending] = useActionState(
    async () => setLicenseStatusAction(license.id, newStatus),
    {},
  );
  const [editing, setEditing] = useState(false);

  const statusColors: Record<string, string> = {
    active: "bg-emerald-900/50 text-emerald-300",
    grace_period: "bg-amber-900/50 text-amber-300",
    expired: "bg-red-900/50 text-red-300",
    suspended: "bg-gray-800 text-gray-400",
  };

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-5 py-3 text-white font-medium">{license.schoolName}</td>
      <td className="px-4 py-3 text-white/70">{license.planName}</td>
      <td className="px-4 py-3 text-white/50 text-xs">{new Date(license.startDate).toLocaleDateString()}</td>
      <td className="px-4 py-3 text-white/50 text-xs">{new Date(license.endDate).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full text-[11px] px-2.5 py-0.5 font-medium ${statusColors[license.status] ?? "bg-gray-800 text-gray-400"}`}>
          {license.status.replace("_", " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-white/50 text-xs">{license.autoRenewIntent ? "Yes" : "No"}</td>
      <td className="px-4 py-3 text-white/30 text-xs font-mono max-w-[120px] truncate">{license.paymentReference ?? "—"}</td>
      <td className="px-4 py-3">
        {editing ? (
          <form action={statusAction} className="flex items-center gap-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded text-xs text-white p-1">
              <option value="active">Active</option>
              <option value="grace_period">Grace</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
            <button type="submit" disabled={statusPending}
              className="text-[10px] text-emerald-400 hover:text-emerald-300"
            >Save</button>
            <button type="button" onClick={() => setEditing(false)}
              className="text-[10px] text-white/40 hover:text-white/70"
            >Cancel</button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)}
            className="text-[10px] text-white/40 hover:text-white/70 underline"
          >Change</button>
        )}
        {statusState.success && <p className="text-emerald-400 text-[10px] mt-0.5">{statusState.success}</p>}
      </td>
    </tr>
  );
}
