"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  updateReferralStatusAction,
  deleteReferralAction,
  updateSchoolRegistrationStatusAction,
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
  _count: { schools: number; schoolRegistrations: number };
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
  status: string;
  notes: string | null;
  createdAt: string;
  referral: { fullName: string; referralCode: string } | null;
};

const init: ReferralManageActionResult = {};

export function ReferralsClient({
  referrals,
  registrations,
}: {
  referrals: ReferralData[];
  registrations: RegistrationData[];
}) {
  const [tab, setTab] = useState<"referrals" | "registrations">("referrals");
  const [editingReferral, setEditingReferral] = useState<ReferralData | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<RegistrationData | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Referrals & Registrations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage referral agents and school registrations.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("referrals")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "referrals" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Referral Agents ({referrals.length})
        </button>
        <button
          onClick={() => setTab("registrations")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "registrations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          School Registrations ({registrations.length})
        </button>
      </div>

      {tab === "referrals" && (
        <div className="space-y-4">
          {referrals.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm">No referrals yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {referrals.map((r) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{r.fullName}</h3>
                      <p className="text-sm text-gray-500">{r.email} · {r.phoneNumber}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Code: <span className="font-mono font-bold text-gray-700">{r.referralCode}</span>
                        {" · "}WhatsApp: {r.whatsappNumber}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Bank: {r.bankName} · Acct: {r.bankAccountNumber} ({r.bankAccountName})
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Schools: {r._count.schools} · Registrations: {r._count.schoolRegistrations}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        r.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {r.status}
                      </span>
                      <button
                        onClick={() => setEditingReferral(r)}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "registrations" && (
        <div className="space-y-4">
          {registrations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm">No school registrations yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {registrations.map((r) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{r.schoolName}</h3>
                      <p className="text-sm text-gray-500">
                        {r.principalFirstName} {r.principalLastName} · {r.principalEmail}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {r.schoolAddress && `${r.schoolAddress} · `}
                        {r.schoolPhone && `Phone: ${r.schoolPhone} · `}
                        {r.schoolEmail && `Email: ${r.schoolEmail}`}
                      </p>
                      {r.referralCode && (
                        <p className="text-xs text-blue-600 mt-1">
                          Referred by: {r.referral?.fullName || "Unknown"} ({r.referralCode})
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-xs text-gray-400 mt-1 italic">Note: {r.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        r.status === "pending" ? "bg-amber-100 text-amber-700" :
                        r.status === "reviewed" ? "bg-blue-100 text-blue-700" :
                        r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {r.status}
                      </span>
                      <button
                        onClick={() => setEditingRegistration(r)}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Referral Modal */}
      {editingReferral && (
        <EditReferralModal
          referral={editingReferral}
          onClose={() => setEditingReferral(null)}
        />
      )}

      {/* Edit Registration Modal */}
      {editingRegistration && (
        <EditRegistrationModal
          registration={editingRegistration}
          onClose={() => setEditingRegistration(null)}
        />
      )}
    </div>
  );
}

function EditReferralModal({
  referral,
  onClose,
}: {
  referral: ReferralData;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateReferralStatusAction, init);
  const [deleting, setDeleting] = useState(false);

  if (state.success) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Referral</h3>
        <div className="space-y-3 mb-4">
          <div>
            <p className="text-xs text-gray-400">Name</p>
            <p className="text-sm font-medium text-gray-900">{referral.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            <p className="text-sm font-medium text-gray-900">{referral.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Referral Code</p>
            <p className="text-sm font-mono font-bold text-gray-900">{referral.referralCode}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Schools Referred</p>
            <p className="text-sm font-medium text-gray-900">{referral._count.schools}</p>
          </div>
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

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Delete this referral? This cannot be undone.")) return;
                const result = await deleteReferralAction(referral.id);
                if (result.error) alert(result.error);
                else onClose();
              }}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRegistrationModal({
  registration,
  onClose,
}: {
  registration: RegistrationData;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateSchoolRegistrationStatusAction, init);

  if (state.success) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Review School Registration</h3>
        <div className="space-y-3 mb-4 bg-gray-50 rounded-xl p-4">
          <div>
            <p className="text-xs text-gray-400">School</p>
            <p className="text-sm font-medium text-gray-900">{registration.schoolName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400">Address</p>
              <p className="text-sm text-gray-700">{registration.schoolAddress || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Phone</p>
              <p className="text-sm text-gray-700">{registration.schoolPhone || "—"}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">School Email</p>
            <p className="text-sm text-gray-700">{registration.schoolEmail || "—"}</p>
          </div>
          <hr className="border-gray-200" />
          <div>
            <p className="text-xs text-gray-400">Principal</p>
            <p className="text-sm font-medium text-gray-900">{registration.principalFirstName} {registration.principalLastName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400">Principal Email</p>
              <p className="text-sm text-gray-700">{registration.principalEmail}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Principal Phone</p>
              <p className="text-sm text-gray-700">{registration.principalPhone || "—"}</p>
            </div>
          </div>
          {registration.referralCode && (
            <div>
              <p className="text-xs text-gray-400">Referral</p>
              <p className="text-sm text-blue-600">{registration.referral?.fullName || "Unknown"} ({registration.referralCode})</p>
            </div>
          )}
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

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
