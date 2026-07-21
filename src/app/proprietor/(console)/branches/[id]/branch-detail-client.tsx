"use client";

import Link from "next/link";
import type { DeepBranchData } from "@/lib/addons/branch-data";

const LICENSE_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  grace_period: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  none: "bg-gray-100 text-gray-500",
};

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export function BranchDetailClient({ data }: { data: DeepBranchData }) {
  const { branch, subjectPerformance, classPerformance, transfers, licenseHistory, recentTransfers } = data;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/proprietor/branches" className="text-xs text-white/40 hover:text-white/70 inline-flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        All branches
      </Link>

      {/* School header */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
            {branch.logo ? (
              <img src={branch.logo} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="material-symbols-outlined text-[28px] text-white">school</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{branch.schoolName}</h1>
            {branch.motto && <p className="text-sm text-white/40 mt-0.5">{branch.motto}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 capitalize">{branch.stage}</span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${LICENSE_COLORS[branch.licenseStatus] ?? "bg-gray-100 text-gray-500"}`}>
                {branch.licenseStatus}
              </span>
              {branch.isStale && <span className="text-[10px] text-amber-600 font-semibold">⚠ License expired — data may be stale</span>}
              {branch.suspended && <span className="text-[10px] text-red-600 font-semibold">Suspended</span>}
            </div>
            {(branch.address || branch.phone || branch.email) && (
              <div className="mt-2 text-xs text-white/40 space-y-0.5">
                {branch.address && <p>{branch.address}</p>}
                {branch.phone && <p>{branch.phone}</p>}
                {branch.email && <p>{branch.email}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Students" value={branch.enrollment} icon="groups" />
        <StatCard label="Staff" value={branch.staffCount} icon="badge" />
        <StatCard label="Subjects" value={branch.subjectCount} icon="book" />
        <StatCard label="Classes" value={branch.classCount} icon="class" />
        <StatCard label="Avg Score" value={branch.latestTermAverage !== null ? `${branch.latestTermAverage}%` : "—"} icon="trending_up" />
      </div>

      {/* Transfer summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-900/10 border border-emerald-700/20 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-emerald-400">login</span>
          <div>
            <p className="text-2xl font-bold text-white">{transfers.incoming}</p>
            <p className="text-xs text-white/40">Incoming transfers</p>
          </div>
        </div>
        <div className="bg-amber-900/10 border border-amber-700/20 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-amber-400">logout</span>
          <div>
            <p className="text-2xl font-bold text-white">{transfers.outgoing}</p>
            <p className="text-xs text-white/40">Outgoing transfers</p>
          </div>
        </div>
      </div>

      {/* Subject performance */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Subject Performance (Current Term)</h2>
        {subjectPerformance.length === 0 ? (
          <p className="text-sm text-white/30 italic">No subject results for the current term.</p>
        ) : (
          <div className="space-y-2">
            {subjectPerformance.map((s) => (
              <div key={s.subjectName} className="flex items-center gap-3">
                <span className="text-sm text-white w-32 shrink-0 truncate">{s.subjectName}</span>
                <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.min(s.averageScore ?? 0, 100)}%` }}
                  >
                    <span className="text-[10px] text-white font-bold">{s.averageScore}%</span>
                  </div>
                </div>
                <span className="text-[10px] text-white/30 w-16 text-right">{s.studentCount} students</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Class performance */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Class Performance (Current Term)</h2>
        {classPerformance.length === 0 ? (
          <p className="text-sm text-white/30 italic">No class data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left py-2 px-3 font-semibold">Class</th>
                  <th className="text-left py-2 px-3 font-semibold">Level</th>
                  <th className="text-left py-2 px-3 font-semibold">Students</th>
                  <th className="text-left py-2 px-3 font-semibold">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {classPerformance.map((c) => (
                  <tr key={c.className} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-white">{c.className}</td>
                    <td className="py-2 px-3 text-white/60 text-xs">{c.level}</td>
                    <td className="py-2 px-3 text-white/60">{c.studentCount}</td>
                    <td className="py-2 px-3">
                      {c.averageScore !== null ? (
                        <span className={`font-semibold ${c.averageScore >= 60 ? "text-emerald-400" : c.averageScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {c.averageScore}%
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent transfers */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Recent Transfers</h2>
        {recentTransfers.length === 0 ? (
          <p className="text-sm text-white/30 italic">No transfers involving this school.</p>
        ) : (
          <div className="space-y-2">
            {recentTransfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3 text-xs">
                <span className={`material-symbols-outlined text-[18px] ${t.direction === "in" ? "text-emerald-400" : "text-amber-400"}`}>
                  {t.direction === "in" ? "login" : "logout"}
                </span>
                <div className="flex-1">
                  <p className="text-white">{t.studentName} <span className="text-white/40">#{t.admissionNumber}</span></p>
                  <p className="text-white/40 text-[10px]">
                    {t.direction === "in" ? `From ${t.otherSchoolName}` : `To ${t.otherSchoolName}`}
                    {" · "}{new Date(t.transferredAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${t.direction === "in" ? "bg-emerald-900/30 text-emerald-300" : "bg-amber-900/30 text-amber-300"}`}>
                  {t.direction === "in" ? "Incoming" : "Outgoing"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* License history */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">License History</h2>
        {licenseHistory.length === 0 ? (
          <p className="text-sm text-white/30 italic">No license records.</p>
        ) : (
          <div className="space-y-2">
            {licenseHistory.map((l) => (
              <div key={l.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3 text-xs">
                <div>
                  <p className="text-white">{l.planName}</p>
                  <p className="text-white/40 text-[10px]">{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${LICENSE_COLORS[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
      <span className="material-symbols-outlined text-[20px] text-white/30">{icon}</span>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
      <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
