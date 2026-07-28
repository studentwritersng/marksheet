"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registerSchoolAction, type SchoolRegistrationActionResult } from "./actions";

type PaymentMethod = {
  id: string;
  type: string;
  label: string;
  details: { bankName?: string; accountNumber?: string; accountName?: string; instructions?: string } | null;
};

const init: SchoolRegistrationActionResult = {};

export function SchoolRegistrationForm({
  defaultReferralCode,
  paymentMethods,
  registrationFee,
}: {
  defaultReferralCode?: string;
  paymentMethods: PaymentMethod[];
  registrationFee: number;
}) {
  const [state, action, pending] = useActionState(registerSchoolAction, init);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [selectedMethod, setSelectedMethod] = useState<string>("");

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

  const selectedMethodData = paymentMethods.find((m) => m.id === selectedMethod);

  return (
    <form action={action} className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Register Your School</h2>
      <p className="text-sm text-gray-500 mb-6">Fill in your school details to get started with Marksheet.</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 text-sm font-medium ${step === "details" ? "text-blue-600" : "text-emerald-600"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step === "details" ? "bg-blue-600" : "bg-emerald-600"}`}>
            {step === "details" ? "1" : "\u2713"}
          </span>
          School Details
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <div className={`flex items-center gap-2 text-sm font-medium ${step === "payment" ? "text-blue-600" : "text-gray-400"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step === "payment" ? "bg-blue-600" : "bg-gray-300"}`}>2</span>
          Registration Fee
        </div>
      </div>

      {step === "details" && (
        <div className="space-y-6">
          {/* School Details */}
          <div>
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

          <hr className="border-gray-200" />

          {/* Principal Details */}
          <div>
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

          <hr className="border-gray-200" />

          {/* Referral Code */}
          <div>
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

          <button
            type="button"
            onClick={() => setStep("payment")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            Continue to Payment
          </button>
        </div>
      )}

      {step === "payment" && (
        <div className="space-y-6">
          {/* Registration Fee */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">Registration Fee</span>
              <span className="text-xl font-bold text-blue-900">₦{registrationFee.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Payment Method</h3>
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedMethod === method.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethodId"
                    value={method.id}
                    checked={selectedMethod === method.id}
                    onChange={() => setSelectedMethod(method.id)}
                    className="text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{method.label}</p>
                    <p className="text-xs text-gray-400 capitalize">{method.type.replace("_", " ")}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Payment Details */}
          {selectedMethodData && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              {selectedMethodData.type === "bank_transfer" && selectedMethodData.details && (
                <>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Transfer to this account</p>
                  <InfoLine label="Bank" value={selectedMethodData.details.bankName || ""} />
                  <InfoLine label="Account Number" value={selectedMethodData.details.accountNumber || ""} />
                  <InfoLine label="Account Name" value={selectedMethodData.details.accountName || ""} />
                  {selectedMethodData.details.instructions && (
                    <p className="text-xs text-gray-500 italic mt-2">{selectedMethodData.details.instructions}</p>
                  )}
                </>
              )}
              {selectedMethodData.type === "online" && (
                <p className="text-sm text-gray-600">You will be redirected to complete payment after submitting.</p>
              )}
              {selectedMethodData.type === "cash" && (
                <p className="text-sm text-gray-600">Contact the platform team to arrange cash payment.</p>
              )}
            </div>
          )}

          {/* Payment Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference / Teller Number</label>
            <input
              name="paymentReference"
              placeholder="e.g. GTB123456789 or teller number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Enter the reference number from your payment receipt.</p>
          </div>

          <input type="hidden" name="registrationFee" value={registrationFee} />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {pending ? "Submitting..." : "Submit Registration"}
            </button>
          </div>
        </div>
      )}

      {state.error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {state.error}
        </div>
      )}
    </form>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
