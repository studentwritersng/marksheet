"use client";

import type { GroupDashboardData } from "@/lib/addons/group-dashboard";

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export function AnalyticsClient({ data }: { data: GroupDashboardData }) {
  const totalEnrollment = data.branches.reduce((s, b) => s + b.enrollment, 0);
  const branchesWithAvg = data.branches.filter((b) => b.latestTermAverage !== null);
  const groupAvg = branchesWithAvg.length > 0
    ? Math.round((branchesWithAvg.reduce((s, b) => s + (b.latestTermAverage ?? 0), 0) / branchesWithAvg.length) * 100) / 100
    : null;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-white/40 mt-1">Cross-branch performance comparison</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <span className="material-symbols-outlined text-[20px] text-white/30">domain</span>
          <p className="text-xl font-bold text-white mt-1">{data.branches.length}</p>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Branches</p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <span className="material-symbols-outlined text-[20px] text-white/30">groups</span>
          <p className="text-xl font-bold text-white mt-1">{totalEnrollment}</p>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Total Students</p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <span className="material-symbols-outlined text-[20px] text-white/30">trending_up</span>
          <p className="text-xl font-bold text-white mt-1">{groupAvg !== null ? `${groupAvg}%` : "—"}</p>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Group Average</p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <span className="material-symbols-outlined text-[20px] text-white/30">swap_horiz</span>
          <p className="text-xl font-bold text-white mt-1">{data.transfers.length}</p>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Transfers</p>
        </div>
      </div>

      {/* Subject comparison matrix */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Subject Comparison Across Branches</h2>
        {data.subjectComparisons.length === 0 ? (
          <div className="py-8 text-center">
            <span className="material-symbols-outlined text-[40px] text-white/20">analytics</span>
            <p className="text-sm text-white/30 mt-2">No comparison data available yet. This appears when branches have term results.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold sticky left-0 bg-[#0b0f19]">Subject</th>
                  {data.branches.map((b) => (
                    <th key={b.schoolId} className="text-center py-3 px-3 font-semibold min-w-[100px]">{b.schoolName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.subjectComparisons.map((sc) => {
                  const values = sc.branchAverages.map((b) => b.average).filter((v) => v !== null) as number[];
                  const max = values.length > 0 ? Math.max(...values) : null;
                  const min = values.length > 0 ? Math.min(...values) : null;
                  return (
                    <tr key={sc.subjectName} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white font-medium sticky left-0 bg-[#0b0f19]">{sc.subjectName}</td>
                      {sc.branchAverages.map((b) => (
                        <td key={b.schoolId} className="py-3 px-3 text-center">
                          {b.average !== null ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${b.average === max ? "bg-emerald-500" : b.average === min ? "bg-red-500" : "bg-indigo-500"}`}
                                  style={{ width: `${Math.min(b.average, 100)}%` }}
                                />
                              </div>
                              <span className={`font-semibold text-xs ${b.average === max ? "text-emerald-400" : b.average === min ? "text-red-400" : "text-white"}`}>
                                {b.average}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enrollment comparison */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Enrollment by Branch</h2>
        <div className="space-y-3">
          {data.branches.map((b) => {
            const maxEnrollment = Math.max(...data.branches.map((x) => x.enrollment), 1);
            const width = (b.enrollment / maxEnrollment) * 100;
            return (
              <div key={b.schoolId} className="flex items-center gap-3">
                <span className="text-sm text-white w-32 shrink-0 truncate">{b.schoolName}</span>
                <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${width}%` }}
                  >
                    <span className="text-[10px] text-white font-bold">{b.enrollment}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {data.branches.length === 0 && (
            <p className="text-sm text-white/30 italic">No branches to compare.</p>
          )}
        </div>
      </div>

      {/* Performance ranking */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Performance Ranking</h2>
        <div className="space-y-2">
          {[...data.branches]
            .sort((a, b) => (b.latestTermAverage ?? 0) - (a.latestTermAverage ?? 0))
            .map((b, index) => (
              <div key={b.schoolId} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? "bg-amber-400 text-amber-900" : index === 1 ? "bg-gray-300 text-gray-700" : index === 2 ? "bg-amber-700 text-amber-200" : "bg-white/10 text-white/40"
                }`}>
                  {index + 1}
                </span>
                <span className="text-sm text-white flex-1">{b.schoolName}</span>
                <span className={`text-sm font-bold ${b.latestTermAverage !== null ? "text-white" : "text-white/20"}`}>
                  {b.latestTermAverage !== null ? `${b.latestTermAverage}%` : "No data"}
                </span>
              </div>
            ))}
          {data.branches.length === 0 && (
            <p className="text-sm text-white/30 italic">No branches to rank.</p>
          )}
        </div>
      </div>

      {/* Transfer flow */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Transfer Flow</h2>
        {data.transfers.length === 0 ? (
          <p className="text-sm text-white/30 italic">No transfers recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {data.transfers.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg p-2">
                <span className="text-white/60 truncate flex-1">{t.originSchoolName}</span>
                <span className="text-white/30">→</span>
                <span className="text-white/60 truncate flex-1">{t.destinationSchoolName}</span>
                <span className="text-white/40 text-[10px] whitespace-nowrap">{new Date(t.transferredAt).toLocaleDateString()}</span>
              </div>
            ))}
            {data.transfers.length > 10 && (
              <p className="text-[10px] text-white/30 text-center pt-1">+ {data.transfers.length - 10} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
