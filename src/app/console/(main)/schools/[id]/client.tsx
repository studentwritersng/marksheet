"use client";

import { useActionState, useState, useTransition } from "react";
import { setMaintenanceModeAction, updateLicenseAction, suspendLicenseAction, reactivateLicenseAction, updateSchoolAction, toggleSuspendSchoolAction, setSchoolStageAction, exportSchoolBackupConsoleAction } from "./actions";

interface SchoolVM {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  shortcode: string | null;
  maintenanceMode: boolean;
  suspended: boolean;
  stage: string;
  createdAt: string;
  _count: { students: number; staff: number; sessions: number; subjects: number };
}

interface LicenseVM {
  id: string;
  planName: string;
  durationType: string;
  startDate: string;
  endDate: string;
  status: string;
  paymentReference: string | null;
  notes: string | null;
  autoRenewIntent: boolean;
  setBy: string | null;
  createdAt: string;
}

interface PlanVM { id: string; name: string; durationType: string; }

export function SchoolDetailClient({
  school, licenses, plans,
}: {
  school: SchoolVM; licenses: LicenseVM[]; plans: PlanVM[];
}) {
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [maintState, maintAction, maintPending] = useActionState(
    async () => setMaintenanceModeAction(school.id, !school.maintenanceMode), {},
  );
  const [licenseState, licenseAction, licensePending] = useActionState(
    async (_prev: any, fd: FormData) => updateLicenseAction(school.id, fd), {},
  );
  const [editState, editAction, editPending] = useActionState(updateSchoolAction, {});
  const [suspendState, suspendAction, suspendPending] = useActionState(
    async () => toggleSuspendSchoolAction(school.id), {},
  );

  const [stageValue, setStageValue] = useState(school.stage);
  const [stageState, stageAction, stagePending] = useActionState(
    async () => setSchoolStageAction(school.id, stageValue), {},
  );

  const now = new Date();
  const currentLicense = licenses[0];
  const daysLeft = currentLicense
    ? Math.ceil((new Date(currentLicense.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  const statusColor: Record<string, string> = {
    active: "text-emerald-400 bg-emerald-900/30 border-emerald-800/30",
    grace_period: "text-amber-400 bg-amber-900/30 border-amber-800/30",
    expired: "text-red-400 bg-red-900/30 border-red-800/30",
    suspended: "text-gray-400 bg-gray-800/30 border-gray-700/30",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white">{school.name}</h1>
            {school.suspended && (
              <span className="rounded-full bg-red-900/50 text-red-300 text-[11px] px-2.5 py-0.5 font-medium border border-red-800/30">Suspended</span>
            )}
            {currentLicense && (
              <span className={`rounded-full text-[11px] px-2.5 py-0.5 font-medium border ${statusColor[currentLicense.status] ?? ""}`}>
                {currentLicense.status.replace("_", " ")}
              </span>
            )}
            {school.maintenanceMode && (
              <span className="rounded-full bg-purple-900/50 text-purple-300 text-[11px] px-2.5 py-0.5 font-medium border border-purple-800/30">Maintenance</span>
            )}
          </div>
          <p className="text-sm text-white/40 mt-1">
            {school.address && <span>{school.address} &middot; </span>}
            {school.phone && <span>{school.phone} &middot; </span>}
            {school.email && <span>{school.email}</span>}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Shortcode: <span className="font-mono">{school.shortcode ?? "—"}</span>
            &middot; Stage: <span className="text-emerald-400 capitalize">{school.stage}</span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <form action={suspendAction}>
            <button type="submit" disabled={suspendPending}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${school.suspended ? "text-emerald-400 border-emerald-800/30 hover:bg-emerald-900/20" : "text-red-400 border-red-800/30 hover:bg-red-900/20"}`}
            >{suspendPending ? "..." : school.suspended ? "Unsuspend School" : "Suspend School"}</button>
          </form>
          <button onClick={() => setEditing(!editing)}
            className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
          >{editing ? "Cancel" : "Edit School"}</button>
          <form action={maintAction}>
            <button type="submit" disabled={maintPending}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${school.maintenanceMode ? "text-emerald-400 border-emerald-800/30 hover:bg-emerald-900/20" : "text-purple-400 border-purple-800/30 hover:bg-purple-900/20"}`}
            >{maintPending ? "..." : school.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}</button>
          </form>
        </div>
      </div>
      {suspendState.error && <p className="text-red-400 text-sm">{suspendState.error}</p>}
      {suspendState.success && <p className="text-emerald-400 text-sm">{suspendState.success}</p>}
      {maintState.error && <p className="text-red-400 text-sm">{maintState.error}</p>}
      {maintState.success && <p className="text-emerald-400 text-sm">{maintState.success}</p>}

      {/* Stage change form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Pricing Stage</h3>
        <div className="flex items-center gap-3">
          <select value={stageValue} onChange={(e) => setStageValue(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 flex-1 max-w-md"
          >
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <form action={stageAction}>
            <button type="submit" disabled={stagePending}
              className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
            >{stagePending ? "Saving..." : "Save Stage"}</button>
          </form>
        </div>
        {stageState.success && <p className="text-emerald-400 text-xs mt-1">{stageState.success}</p>}
        {stageState.error && <p className="text-red-400 text-xs mt-1">{stageState.error}</p>}
      </div>

      {/* Edit form */}
      {editing && (
        <form action={editAction} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Edit School Details</h3>
          <input type="hidden" name="schoolId" value={school.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs text-white/50 block mb-1">Name</label>
              <input name="name" defaultValue={school.name} required className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
            <div><label className="text-xs text-white/50 block mb-1">Shortcode</label>
              <input name="shortcode" defaultValue={school.shortcode ?? ""} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30 font-mono" /></div>
            <div><label className="text-xs text-white/50 block mb-1">Address</label>
              <input name="address" defaultValue={school.address ?? ""} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
            <div><label className="text-xs text-white/50 block mb-1">Phone</label>
              <input name="phone" defaultValue={school.phone ?? ""} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
            <div><label className="text-xs text-white/50 block mb-1">Email</label>
              <input name="email" type="email" defaultValue={school.email ?? ""} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
            <div><label className="text-xs text-white/50 block mb-1">Motto</label>
              <input name="motto" defaultValue={school.motto ?? ""} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
          </div>
          {editState.error && <p className="text-red-400 text-sm">{editState.error}</p>}
          {editState.success && <p className="text-emerald-400 text-sm">{editState.success}</p>}
          <button type="submit" disabled={editPending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60">{editPending ? "Saving..." : "Save Changes"}</button>
        </form>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Students" value={school._count.students} />
        <StatBox label="Staff" value={school._count.staff} />
        <StatBox label="Sessions" value={school._count.sessions} />
        <StatBox label="Subjects" value={school._count.subjects} />
      </div>

      {/* Backup & Restore */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Backup &amp; Restore</h2>
        <p className="text-xs text-white/30 mb-4">Download a JSON backup of this school's data, or restore a previous backup.</p>
        <div className="flex flex-wrap gap-2">
          <BackupButton schoolId={school.id} mode="config" label="Download Config Backup" />
          <BackupButton schoolId={school.id} mode="full" label="Download Full Backup" />
          <a href={`/console/schools/${school.id}/backup`}
            className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
          >Restore Backup</a>
        </div>
      </div>

      {/* Current license card */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Current License</h2>
            {currentLicense ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-white/70">Plan: <strong className="text-white">{currentLicense.planName}</strong></span>
                  <span className="text-white/70">Status: <strong className={statusColor[currentLicense.status]?.split(" ")[0] ?? "text-white"}>{currentLicense.status.replace("_", " ")}</strong></span>
                </div>
                <div className="flex items-center gap-4 text-white/50">
                  <span>{new Date(currentLicense.startDate).toLocaleDateString()} → {new Date(currentLicense.endDate).toLocaleDateString()}</span>
                  {daysLeft !== null && (
                    <span className={daysLeft <= 0 ? "text-red-400" : daysLeft <= 7 ? "text-amber-400" : "text-white/50"}>
                      {daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"}
                    </span>
                  )}
                </div>
                {currentLicense.paymentReference && <p className="text-xs text-white/30">Payment ref: {currentLicense.paymentReference}</p>}
                {currentLicense.notes && <p className="text-xs text-white/30">Notes: {currentLicense.notes}</p>}
              </div>
            ) : <p className="text-white/30 text-sm">No license assigned.</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            {currentLicense?.status === "active" && <SuspendButton licenseId={currentLicense.id} />}
            {currentLicense && (currentLicense.status === "suspended" || currentLicense.status === "expired" || currentLicense.status === "grace_period") && (
              <ReactivateButton licenseId={currentLicense.id} />
            )}
            <button onClick={() => setShowLicenseForm(!showLicenseForm)}
              className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
            >{showLicenseForm ? "Cancel" : currentLicense ? "Renew / Change" : "Assign License"}</button>
          </div>
        </div>
      </div>

      {/* License form */}
      {showLicenseForm && (
        <form action={licenseAction} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">{currentLicense ? "Renew / Change License" : "Assign License"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs text-white/50 block mb-1">Plan</label>
              <select name="planId" required className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30">
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.durationType})</option>)}
              </select></div>
            <div><label className="text-xs text-white/50 block mb-1">Start Date</label>
              <input type="date" name="startDate" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
            <div><label className="text-xs text-white/50 block mb-1">End Date</label>
              <input type="date" name="endDate" required className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30" /></div>
            <div><label className="text-xs text-white/50 block mb-1">Payment Reference (optional)</label>
              <input type="text" name="paymentReference" placeholder="e.g. Bank transfer, ref #1234" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20" /></div>
            <div className="sm:col-span-2"><label className="text-xs text-white/50 block mb-1">Notes (optional)</label>
              <textarea name="notes" rows={2} placeholder="Any internal notes about this license" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20" /></div>
          </div>
          {licenseState.error && <p className="text-red-400 text-sm">{licenseState.error}</p>}
          {licenseState.success && <p className="text-emerald-400 text-sm">{licenseState.success}</p>}
          <button type="submit" disabled={licensePending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60">{licensePending ? "Saving..." : "Save License"}</button>
        </form>
      )}

      {/* License history */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">License History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Assigned</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Start</th>
              <th className="text-left px-4 py-3 font-medium">End</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Payment Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {licenses.map((l) => (
              <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3 text-white/40 text-xs">{new Date(l.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-white">{l.planName}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{new Date(l.startDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{new Date(l.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full text-[11px] px-2.5 py-0.5 font-medium ${l.status === "active" ? "bg-emerald-900/50 text-emerald-300" : l.status === "grace_period" ? "bg-amber-900/50 text-amber-300" : l.status === "expired" ? "bg-red-900/50 text-red-300" : "bg-gray-800 text-gray-400"}`}>{l.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-white/30 text-xs font-mono max-w-[120px] truncate">{l.paymentReference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}

function SuspendButton({ licenseId }: { licenseId: string }) {
  const [state, action, pending] = useActionState(async () => suspendLicenseAction(licenseId), {});
  return (
    <form action={action}>
      <button type="submit" disabled={pending} className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg border border-red-800/30 hover:bg-red-900/20">{pending ? "..." : "Suspend"}</button>
      {state.success && <p className="text-emerald-400 text-xs mt-1">{state.success}</p>}
    </form>
  );
}

function BackupButton({ schoolId, mode, label }: { schoolId: string; mode: "config" | "full"; label: string }) {
  const [pending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const result = await exportSchoolBackupConsoleAction(schoolId, mode);
      if (result.error) { alert(result.error); return; }
      const blob = new Blob([result.data!], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename!;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <button type="button" onClick={handleDownload} disabled={pending}
      className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 disabled:opacity-60"
    >{pending ? "Downloading..." : label}</button>
  );
}

function ReactivateButton({ licenseId }: { licenseId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [endDate, setEndDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; });
  const [state, action, pending] = useActionState(async () => reactivateLicenseAction(licenseId, endDate), {});
  return (
    <div>
      <button onClick={() => setShowForm(!showForm)} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-lg border border-emerald-800/30 hover:bg-emerald-900/20">Reactivate</button>
      {showForm && (
        <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
          <label className="text-xs text-white/50 block">New end date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm text-white" />
          <form action={action}>
            <button type="submit" disabled={pending} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">{pending ? "..." : "Confirm Reactivate"}</button>
          </form>
          {state.success && <p className="text-emerald-400 text-xs">{state.success}</p>}
          {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
        </div>
      )}
    </div>
  );
}
