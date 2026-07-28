"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  updateReferralStatusAction,
  deleteReferralAction,
  updateSchoolRegistrationStatusAction,
  updateCommissionStatusAction,
  type ReferralManageActionResult,
} from "./actions";

type ReferralData = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  whatsappNumber: string;
  referralCode: string;
  status: string;
  createdAt: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  _count: { schools: number; schoolRegistrations: number; commissions: number };
};

type RegistrationData = {
  id: string;
  schoolName: string;
  schoolAddress: string | null;
  schoolPhone: string | null;
  schoolEmail: string | null;
  principalFirstName: string;
  principalLastName: string;
  principalEmail: string;
  principalPhone: string | null;
  referralCode: string | null;
  registrationFee: number | null;
  paymentMethodLabel: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  status: string;
  notes: string | null;
  createdAt: string;
  referral: { fullName: string; referralCode: string } | null;
};

type CommissionData = {
  id: string;
  amount: number;
  status: string;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  referral: { fullName: string; referralCode: string; email: string };
  registration: { schoolName: string } | null;
};

const init: ReferralManageActionResult = {};

export function ReferralsClient({
  referrals,
  registrations,
  commissions,
}: {
  referrals: ReferralData[];
  registrations: RegistrationData[];
  commissions: CommissionData[];
}) {
  const [tab, setTab] = useState<"referrals" | "registrations" | "commissions">("referrals");
  const [editingReferral, setEditingReferral] = useState<ReferralData | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<RegistrationData | null>(null);
  const [editingCommission, setEditingCommission] = useState<CommissionData | null>(null);

  const totalPending = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Referrals & Registrations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage referral agents, school registrations, and commissions.</p>
        </div>
        <a href="/console/referral-settings" className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50">
          Commission Settings
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400">Total Commissions</p>
          <p className="text-xl font-bold text-gray-900">₦{(totalPending + totalPaid).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400">Pending Payout</p>
          <p className="text-xl font-bold text-amber-600">₦{totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600">₦{totalPaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab("referrals")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === "referrals" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Referral Agents ({referrals.length})
        </button>
        <button onClick={() => setTab("registrations")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === "registrations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Registrations ({registrations.length})
        </button>
        <button onClick={() => setTab("commissions")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === "commissions" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Commissions ({commissions.length})
        </button>
      </div>

      {tab === "referrals" && (
        <div className="space-y-4">
          {referrals.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-gray-400 text-sm">No referrals yet.</p></div>
          ) : referrals.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.fullName}</h3>
                  <p className="text-sm text-gray-500">{r.email} · {r.phoneNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">Code: <span className="font-mono font-bold text-gray-700">{r.referralCode}</span> · WhatsApp: {r.whatsappNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">Bank: {r.bankName} · Acct: {r.bankAccountNumber} ({r.bankAccountName})</p>
                  <p className="text-xs text-gray-400 mt-1">Schools: {r._count.schools} · Registrations: {r._count.schoolRegistrations} · Commissions: {r._count.commissions}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                  <button onClick={() => setEditingReferral(r)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Edit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "registrations" && (
        <div className="space-y-4">
          {registrations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-gray-400 text-sm">No registrations yet.</p></div>
          ) : registrations.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.schoolName}</h3>
                  <p className="text-sm text-gray-500">{r.principalFirstName} {r.principalLastName} · {r.principalEmail}</p>
                  <p className="text-xs text-gray-400 mt-1">{r.schoolAddress && `${r.schoolAddress} · `}{r.schoolPhone && `Phone: ${r.schoolPhone} · `}{r.schoolEmail && `Email: ${r.schoolEmail}`}</p>
                  {r.referralCode && <p className="text-xs text-blue-600 mt-1">Referred by: {r.referral?.fullName || "Unknown"} ({r.referralCode})</p>}
                  {r.registrationFee != null && (
                    <p className="text-xs text-gray-400 mt-1">Fee: ₦{r.registrationFee.toLocaleString()} · {r.paymentMethodLabel || "—"} · Ref: {r.paymentReference || "—"} · Payment: <span className={`font-medium ${r.paymentStatus === "verified" ? "text-emerald-600" : r.paymentStatus === "rejected" ? "text-red-600" : "text-amber-600"}`}>{r.paymentStatus}</span></p>
                  )}
                  {r.notes && <p className="text-xs text-gray-400 mt-1 italic">Note: {r.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "reviewed" ? "bg-blue-100 text-blue-700" : r.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                  <button onClick={() => setEditingRegistration(r)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Review</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "commissions" && (
        <div className="space-y-4">
          {commissions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><p className="text-gray-400 text-sm">No commissions yet.</p></div>
          ) : commissions.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">₦{c.amount.toLocaleString()}</h3>
                  <p className="text-sm text-gray-500">Agent: {c.referral.fullName} ({c.referral.email})</p>
                  {c.registration && <p className="text-xs text-gray-400 mt-1">School: {c.registration.schoolName}</p>}
                  <p className="text-xs text-gray-400 mt-1">Created: {new Date(c.createdAt).toLocaleDateString()}{c.paidAt && ` · Paid: ${new Date(c.paidAt).toLocaleDateString()}`}</p>
                  {c.notes && <p className="text-xs text-gray-400 mt-1 italic">Note: {c.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === "pending" ? "bg-amber-100 text-amber-700" : c.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{c.status}</span>
                  <button onClick={() => setEditingCommission(c)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Manage</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingReferral && <EditReferralModal referral={editingReferral} onClose={() => setEditingReferral(null)} />}
      {editingRegistration && <EditRegistrationModal registration={editingRegistration} onClose={() => setEditingRegistration(null)} />}
      {editingCommission && <EditCommissionModal commission={editingCommission} onClose={() => setEditingCommission(null)} />}
    </div>
  );
}

function EditReferralModal({ referral, onClose }: { referral: ReferralData; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateReferralStatusAction, init);
  if (state.success) { onClose(); return null; }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Referral</h3>
        <div className="space-y-2 mb-4 text-sm">
          <p><span className="text-gray-400">Name:</span> {referral.fullName}</p>
          <p><span className="text-gray-400">Email:</span> {referral.email}</p>
          <p><span className="text-gray-400">Code:</span> <span className="font-mono font-bold">{referral.referralCode}</span></p>
          <p><span className="text-gray-400">Schools:</span> {referral._count.schools}</p>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="referralId" value={referral.id} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" defaultValue={referral.status} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {state.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}
          <div className="flex justify-between">
            <button type="button" onClick={async () => { if (!confirm("Delete this referral? This cannot be undone.")) return; const r = await deleteReferralAction(referral.id); if (r.error) alert(r.error); else onClose(); }} className="text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded-lg hover:bg-red-50">Delete</button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={pending} className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50">{pending ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRegistrationModal({ registration, onClose }: { registration: RegistrationData; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateSchoolRegistrationStatusAction, init);
  if (state.success) { onClose(); return null; }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Review School Registration</h3>
        <div className="space-y-2 mb-4 bg-gray-50 rounded-xl p-4 text-sm">
          <p><span className="text-gray-400">School:</span> <span className="font-medium">{registration.schoolName}</span></p>
          <p><span className="text-gray-400">Principal:</span> {registration.principalFirstName} {registration.principalLastName} · {registration.principalEmail}</p>
          <p><span className="text-gray-400">Phone:</span> {registration.principalPhone || "—"}</p>
          {registration.referralCode && <p className="text-blue-600"><span>Referred by:</span> {registration.referral?.fullName || "Unknown"} ({registration.referralCode})</p>}
          {registration.registrationFee != null && <p><span className="text-gray-400">Fee:</span> ₦{registration.registrationFee.toLocaleString()} · {registration.paymentMethodLabel || "—"}</p>}
          <p><span className="text-gray-400">Payment Status:</span> <span className={`font-medium ${registration.paymentStatus === "verified" ? "text-emerald-600" : registration.paymentStatus === "rejected" ? "text-red-600" : "text-amber-600"}`}>{registration.paymentStatus}</span></p>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="registrationId" value={registration.id} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" defaultValue={registration.status} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows={3} defaultValue={registration.notes || ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Internal notes..." />
          </div>
          {state.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={pending} className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50">{pending ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCommissionModal({ commission, onClose }: { commission: CommissionData; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateCommissionStatusAction, init);
  if (state.success) { onClose(); return null; }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Manage Commission</h3>
        <div className="space-y-2 mb-4 bg-gray-50 rounded-xl p-4 text-sm">
          <p><span className="text-gray-400">Amount:</span> <span className="font-bold">₦{commission.amount.toLocaleString()}</span></p>
          <p><span className="text-gray-400">Agent:</span> {commission.referral.fullName}</p>
          {commission.registration && <p><span className="text-gray-400">School:</span> {commission.registration.schoolName}</p>}
          <p><span className="text-gray-400">Created:</span> {new Date(commission.createdAt).toLocaleDateString()}</p>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="commissionId" value={commission.id} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" defaultValue={commission.status} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={commission.notes || ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Notes..." />
          </div>
          {state.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={pending} className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50">{pending ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
