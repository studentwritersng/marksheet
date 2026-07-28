"use client";

import { useActionState } from "react";
import { updateReferralSettingsAction, type SettingsActionResult } from "./actions";

const init: SettingsActionResult = {};

export function ReferralSettingsClient({
  registrationFee,
  commissionPercent,
}: {
  registrationFee: number;
  commissionPercent: number;
}) {
  const [state, action, pending] = useActionState(updateReferralSettingsAction, init);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Referral Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure registration fees and referral commission rates.</p>
      </div>

      <form action={action} className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee (NGN)</label>
          <input
            name="registrationFee"
            type="number"
            min={0}
            defaultValue={registrationFee}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Amount schools pay to register on the platform.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Commission Percentage (%)</label>
          <input
            name="commissionPercent"
            type="number"
            min={0}
            max={100}
            step={0.5}
            defaultValue={commissionPercent}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Percentage of registration fee paid to the referring agent.</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Commission Preview</p>
          <p className="text-sm text-gray-700">
            For a ₦{registrationFee.toLocaleString()} registration fee with {commissionPercent}% commission:
          </p>
          <p className="text-lg font-bold text-emerald-600 mt-1">
            ₦{((registrationFee * commissionPercent) / 100).toLocaleString()} per referral
          </p>
        </div>

        {state.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-2">
            {state.success}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 text-sm"
        >
          {pending ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
