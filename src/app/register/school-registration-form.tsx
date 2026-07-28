"use client";

import { useActionState } from "react";
import { registerSchoolAction, type SchoolRegistrationActionResult } from "./actions";

const init: SchoolRegistrationActionResult = {};

export function SchoolRegistrationForm({ defaultReferralCode }: { defaultReferralCode?: string }) {
  const [state, action, pending] = useActionState(registerSchoolAction, init);

  if (state.success) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
        <p className="text-sm text-gray-500 mb-4">Your school registration has been received. Our team will review it and contact you shortly.</p>
        <a href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm">
          Back to Home
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Register Your School</h2>
      <p className="text-sm text-gray-500 mb-6">Fill in your school details to get started with Marksheet.</p>

      {/* ── School Details ── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">School Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
            <input name="schoolName" required placeholder="e.g. Unity Model Secondary School" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Address</label>
            <input name="schoolAddress" placeholder="123 Education Road, Lagos" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Phone</label>
              <input name="schoolPhone" placeholder="08012345678" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Email</label>
              <input name="schoolEmail" type="email" placeholder="info@school.edu.ng" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-200 mb-6" />

      {/* ── Principal / Owner Details ── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Principal / Owner Details</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input name="principalFirstName" required placeholder="John" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input name="principalLastName" required placeholder="Doe" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input name="principalEmail" type="email" required placeholder="john@school.edu.ng" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="principalPhone" placeholder="08012345678" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-200 mb-6" />

      {/* ── Referral Code ── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Referral Code</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code (optional)</label>
          <input
            name="referralCode"
            defaultValue={defaultReferralCode || ""}
            placeholder="Enter referral code"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {defaultReferralCode && (
            <p className="text-xs text-emerald-600 mt-1">Referral code auto-filled from your link.</p>
          )}
        </div>
      </div>

      {state.error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
      >
        {pending ? "Submitting..." : "Submit Registration"}
      </button>
    </form>
  );
}
