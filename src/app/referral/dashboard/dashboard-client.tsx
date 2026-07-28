"use client";

import { useState } from "react";

type ReferralInfo = {
  id: string;
  fullName: string;
  email: string;
  referralCode: string;
  phoneNumber: string;
  whatsappNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
};

type Stats = {
  totalReferrals: number;
  pendingRegistrations: number;
  totalCommissions: number;
  paidCommissions: number;
  pendingCommissions: number;
};

type School = { id: string; name: string; createdAt: string };
type Registration = { id: string; schoolName: string; status: string; createdAt: string; paymentStatus: string };
type Commission = { id: string; amount: number; status: string; createdAt: string; paidAt: string | null; registrationId: string | null };

export function ReferralDashboardClient({
  referral,
  stats,
  schools,
  registrations,
  commissions,
}: {
  referral: ReferralInfo;
  stats: Stats;
  schools: School[];
  registrations: Registration[];
  commissions: Commission[];
}) {
  const [tab, setTab] = useState<"overview" | "registrations" | "commissions" | "profile">("overview");

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referral.referralCode}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Welcome, {referral.fullName}</h1>
              <p className="text-blue-200 text-sm">Referral Code: <span className="font-mono font-bold text-white">{referral.referralCode}</span></p>
            </div>
            <a href="/referral/logout" className="text-sm text-blue-200 hover:text-white px-3 py-1.5 rounded-lg border border-blue-400/30 hover:border-white/50 transition-colors">
              Sign Out
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 p-1 rounded-lg w-fit mb-6">
          {(["overview", "registrations", "commissions", "profile"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Referrals" value={stats.totalReferrals} icon="group" />
              <StatCard label="Pending Registrations" value={stats.pendingRegistrations} icon="pending" />
              <StatCard label="Total Earned" value={`₦${stats.totalCommissions.toLocaleString()}`} icon="payments" />
              <StatCard label="Paid Out" value={`₦${stats.paidCommissions.toLocaleString()}`} icon="check_circle" />
            </div>

            {/* Referral Link */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Referral Link</h3>
              <div className="flex items-center gap-3">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(referralLink)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Registrations</h3>
              {registrations.length === 0 ? (
                <p className="text-sm text-gray-400">No registrations yet. Share your link to get started!</p>
              ) : (
                <div className="space-y-2">
                  {registrations.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.schoolName}</p>
                        <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge status={r.status} />
                        <StatusBadge status={r.paymentStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "registrations" && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">All Registrations</h3>
            {registrations.length === 0 ? (
              <p className="text-sm text-gray-400">No registrations yet.</p>
            ) : (
              <div className="space-y-3">
                {registrations.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.schoolName}</p>
                      <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={r.status} />
                      <StatusBadge status={r.paymentStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "commissions" && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Commission History</h3>
            {commissions.length === 0 ? (
              <p className="text-sm text-gray-400">No commissions earned yet.</p>
            ) : (
              <div className="space-y-3">
                {commissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">₦{c.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.status} />
                      {c.paidAt && (
                        <span className="text-xs text-gray-400">Paid {new Date(c.paidAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm">
              <span className="text-gray-500">Pending:</span>
              <span className="font-medium text-amber-600">₦{stats.pendingCommissions.toLocaleString()}</span>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Profile</h3>
            <InfoRow label="Full Name" value={referral.fullName} />
            <InfoRow label="Email" value={referral.email} />
            <InfoRow label="Phone" value={referral.phoneNumber} />
            <InfoRow label="WhatsApp" value={referral.whatsappNumber} />
            <InfoRow label="Bank" value={referral.bankName} />
            <InfoRow label="Account Number" value={referral.bankAccountNumber} />
            <InfoRow label="Account Name" value={referral.bankAccountName} />
            <InfoRow label="Referral Code" value={referral.referralCode} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    active: "bg-emerald-100 text-emerald-700",
    verified: "bg-emerald-100 text-emerald-700",
    paid: "bg-emerald-100 text-emerald-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    inactive: "bg-gray-100 text-gray-500",
    unpaid: "bg-gray-100 text-gray-500",
    reviewed: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
