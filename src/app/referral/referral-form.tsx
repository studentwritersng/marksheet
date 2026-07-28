"use client";

import { useActionState } from "react";
import { registerReferralAction, type ReferralActionResult } from "./actions";

const init: ReferralActionResult = {};

export function ReferralForm() {
  const [state, action, pending] = useActionState(registerReferralAction, init);

  if (state.success && state.referralCode) {
    const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${state.referralCode}`;
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
        <p className="text-sm text-gray-500 mb-6">Share your referral code or link with schools to earn referrals.</p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Your Referral Code</p>
          <p className="text-2xl font-mono font-bold text-gray-900 tracking-widest">{state.referralCode}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Your Referral Link</p>
          <p className="text-sm text-blue-700 font-mono break-all">{referralLink}</p>
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(referralLink);
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          Copy Link
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Become a Referral Agent</h2>
      <p className="text-sm text-gray-500 mb-6">Register below to get your unique referral code and link.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input name="fullName" required placeholder="John Doe" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
          <input name="address" required placeholder="123 Street, Lagos" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
            <input name="dateOfBirth" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input name="phoneNumber" required placeholder="08012345678" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input name="email" type="email" required placeholder="john@example.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number *</label>
          <input name="whatsappNumber" required placeholder="08012345678" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <hr className="border-gray-200" />
        <p className="text-xs text-gray-400 uppercase tracking-wide">Bank Details</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name *</label>
          <input name="bankName" required placeholder="e.g. GTBank, First Bank" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
            <input name="bankAccountNumber" required placeholder="1234567890" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
            <input name="bankAccountName" required placeholder="John Doe" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {state.error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
      >
        {pending ? "Registering..." : "Register"}
      </button>
    </form>
  );
}
