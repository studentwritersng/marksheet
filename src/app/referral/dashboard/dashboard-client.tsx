"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Copy,
  LogOut,
  Share2,
} from "lucide-react";
import Link from "next/link";

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

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "registrations", label: "Registrations" },
  { id: "commissions", label: "Commissions" },
  { id: "profile", label: "Profile" },
] as const;

type Tab = (typeof tabs)[number]["id"];

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
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referral.referralCode}`;

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="marketing-root min-h-screen bg-mk-bg text-mk-fg">
      {/* Header */}
      <header className="bg-mk-ink text-mk-ink-fg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mk-warm text-mk-ink">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-mk-display text-xl font-bold">
                Welcome, {referral.fullName}
              </h1>
              <p className="text-sm text-mk-ink-fg/70">
                Referral code:{" "}
                <span className="font-mono font-bold text-mk-amber">{referral.referralCode}</span>
              </p>
            </div>
          </div>
          <Link
            href="/referral/logout"
            className="inline-flex items-center gap-2 rounded-full border border-mk-ink-fg/25 px-4 py-2 text-sm font-semibold text-mk-ink-fg/85 transition-colors hover:border-mk-ink-fg/60 hover:text-mk-ink-fg"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1 rounded-full border border-mk-border bg-mk-card p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-mk-ink text-mk-ink-fg"
                    : "text-mk-muted-fg hover:text-mk-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <a
            href="/referral"
            className="hidden items-center gap-1.5 rounded-full border border-mk-border px-4 py-2 text-sm font-semibold text-mk-muted-fg transition-colors hover:border-mk-primary/40 hover:text-mk-fg sm:inline-flex"
          >
            Referral program
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-8">
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Schools referred" value={stats.totalReferrals} tone="teal" />
                <StatCard label="Pending registrations" value={stats.pendingRegistrations} tone="amber" />
                <StatCard label="Total earned" value={`₦${stats.totalCommissions.toLocaleString()}`} tone="primary" />
                <StatCard label="Paid out" value={`₦${stats.paidCommissions.toLocaleString()}`} tone="ink" />
              </div>

              {/* Referral link */}
              <div className="rounded-3xl border border-mk-border bg-mk-card p-6 shadow-mk-soft sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-mk-display text-lg font-bold">Your referral link</h3>
                  <p className="flex items-center gap-1.5 text-xs text-mk-muted-fg">
                    <BadgeCheck className="h-4 w-4 text-mk-teal" />
                    Schools that register through this link are credited to you
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    readOnly
                    value={referralLink}
                    className="min-w-0 flex-1 rounded-xl border border-mk-input bg-mk-bg px-4 py-3 font-mono text-sm text-mk-muted-fg outline-none"
                  />
                  <button
                    onClick={copyLink}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-mk-ink px-5 py-3 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </div>

              {/* Recent registrations */}
              <div className="rounded-3xl border border-mk-border bg-mk-card p-6 shadow-mk-soft sm:p-7">
                <h3 className="font-mk-display text-lg font-bold">Recent registrations</h3>
                {registrations.length === 0 ? (
                  <EmptyState
                    title="No registrations yet"
                    body="Share your link to get started. Every paid registration earns you a commission."
                  />
                ) : (
                  <ul className="mt-4 space-y-2">
                    {registrations.slice(0, 5).map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mk-border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{r.schoolName}</p>
                          <p className="text-xs text-mk-muted-fg">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <StatusBadge status={r.status} />
                          <StatusBadge status={r.paymentStatus} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === "registrations" && (
            <div className="rounded-3xl border border-mk-border bg-mk-card p-6 shadow-mk-soft sm:p-7">
              <h3 className="font-mk-display text-lg font-bold">All registrations</h3>
              {registrations.length === 0 ? (
                <EmptyState
                  title="No registrations yet"
                  body="When a school registers through your link, it appears here with its status."
                />
              ) : (
                <ul className="mt-4 space-y-2">
                  {registrations.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mk-border px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{r.schoolName}</p>
                        <p className="text-xs text-mk-muted-fg">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge status={r.status} />
                        <StatusBadge status={r.paymentStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "commissions" && (
            <div className="rounded-3xl border border-mk-border bg-mk-card p-6 shadow-mk-soft sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mk-display text-lg font-bold">Commission history</h3>
                <p className="text-sm text-mk-muted-fg">
                  Pending:{" "}
                  <span className="font-bold text-mk-amber">
                    ₦{stats.pendingCommissions.toLocaleString()}
                  </span>
                </p>
              </div>
              {commissions.length === 0 ? (
                <EmptyState
                  title="No commissions yet"
                  body="Earn your first commission when a school registers and pays through your link."
                />
              ) : (
                <ul className="mt-4 space-y-2">
                  {commissions.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mk-border px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mk-display text-lg font-bold text-mk-ink">
                          ₦{c.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-mk-muted-fg">
                          {new Date(c.createdAt).toLocaleDateString()}
                          {c.paidAt && ` · Paid ${new Date(c.paidAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className="rounded-3xl border border-mk-border bg-mk-card p-6 shadow-mk-soft sm:p-7">
              <h3 className="font-mk-display text-lg font-bold">Your profile</h3>
              <div className="mt-5 grid gap-x-10 gap-y-1 sm:grid-cols-2">
                <InfoRow label="Full name" value={referral.fullName} />
                <InfoRow label="Referral code" value={referral.referralCode} mono />
                <InfoRow label="Email" value={referral.email} />
                <InfoRow label="Phone" value={referral.phoneNumber} />
                <InfoRow label="WhatsApp" value={referral.whatsappNumber} />
                <InfoRow label="Bank" value={referral.bankName} />
                <InfoRow label="Account number" value={referral.bankAccountNumber} />
                <InfoRow label="Account name" value={referral.bankAccountName} />
              </div>
              <div className="mt-8 border-t border-mk-border pt-6">
                <p className="text-xs text-mk-muted-fg">
                  Referred schools: <span className="font-bold text-mk-fg">{schools.length}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "teal" | "amber" | "primary" | "ink";
}) {
  const tones: Record<string, { value: string; chip: string }> = {
    teal: { value: "text-mk-teal", chip: "bg-mk-secondary" },
    amber: { value: "text-mk-amber", chip: "bg-mk-secondary" },
    primary: { value: "text-mk-primary", chip: "bg-mk-secondary" },
    ink: { value: "text-mk-ink", chip: "bg-mk-secondary" },
  };
  const t = tones[tone];
  return (
    <div className="rounded-3xl border border-mk-border bg-mk-card p-5 shadow-mk-soft">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${t.chip}`} />
        <p className="text-xs text-mk-muted-fg">{label}</p>
      </div>
      <p className={`mt-3 font-mk-display text-2xl font-bold ${t.value}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-mk-secondary text-mk-secondary-fg",
    active: "bg-mk-secondary text-mk-secondary-fg",
    verified: "bg-mk-secondary text-mk-secondary-fg",
    paid: "bg-mk-secondary text-mk-secondary-fg",
    approved: "bg-mk-secondary text-mk-secondary-fg",
    reviewed: "bg-mk-secondary text-mk-secondary-fg",
    rejected: "bg-red-100 text-red-700",
    inactive: "bg-mk-muted text-mk-muted-fg",
    unpaid: "bg-mk-muted text-mk-muted-fg",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        colors[status] || "bg-mk-muted text-mk-muted-fg"
      }`}
    >
      {status === "paid" || status === "verified" || status === "approved" ? (
        <BadgeCheck className="h-3 w-3" />
      ) : null}
      {status}
    </span>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-baseline gap-4 border-b border-mk-border py-2.5 last:border-0">
      <span className="text-sm text-mk-muted-fg">{label}</span>
      <span
        className={`truncate text-right text-sm font-bold text-mk-fg ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-mk-border bg-mk-muted px-6 py-10 text-center">
      <p className="font-mk-display text-base font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-mk-muted-fg">{body}</p>
    </div>
  );
}
