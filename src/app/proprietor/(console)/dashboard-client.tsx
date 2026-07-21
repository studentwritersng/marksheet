"use client";

import { useState } from "react";
import type { GroupDashboardData } from "@/lib/addons/group-dashboard";

const STAGE_LABELS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

const LICENSE_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  grace_period: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  none: "bg-gray-100 text-gray-600",
};

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-5">
      <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-2xl font-bold text-on-surface mt-1">{value}</p>
      {sublabel && <p className="text-xs text-on-surface-variant mt-1">{sublabel}</p>}
    </div>
  );
}

export function ProprietorDashboardClient({
  data,
  permissionLevel,
}: {
  data: GroupDashboardData;
  permissionLevel: "full" | "view_only";
}) {
  const [tab, setTab] = useState<"overview" | "comparison" | "transfers">("overview");

  const totalEnrollment = data.branches.reduce((s, b) => s + b.enrollment, 0);
  const branchesWithAvg = data.branches.filter((b) => b.latestTermAverage !== null);
  const groupAvg = branchesWithAvg.length > 0
    ? Math.round((branchesWithAvg.reduce((s, b) => s + (b.latestTermAverage ?? 0), 0) / branchesWithAvg.length) * 100) / 100
    : null;
  const staleBranches = data.branches.filter((b) => b.isStale);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{data.groupName}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Proprietor Console
            {permissionLevel === "view_only" && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wider">View Only</span>
            )}
          </p>
        </div>
        {data.feeGroupStage && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs uppercase tracking-wider font-semibold">
            <span className="material-symbols-outlined text-[14px]">payments</span>
            Pricing tier: {STAGE_LABELS[data.feeGroupStage] ?? data.feeGroupStage}
          </div>
        )}
      </div>

      {/* Stale data warning */}
      {staleBranches.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] mt-0.5">warning</span>
          <div>
            <p className="font-semibold">License expired — data may be stale</p>
            <p className="text-xs mt-0.5">
              The following branches have expired or lapsed licenses. Their data is still shown but may not be current:{" "}
              {staleBranches.map((b) => b.schoolName).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Branches" value={data.branches.length} />
        <StatCard label="Total Students" value={totalEnrollment} />
        <StatCard
          label="Group Average"
          value={groupAvg !== null ? `${groupAvg}%` : "—"}
          sublabel={branchesWithAvg.length > 0 ? `${branchesWithAvg.length} branch(es) with data` : "No term results yet"}
        />
        <StatCard label="Transfers" value={data.transfers.length} sublabel="Cross-branch student transfers" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-outline-variant">
        {(["overview", "comparison", "transfers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[#002046] text-[#002046]"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t === "overview" ? "Branch Overview" : t === "comparison" ? "Subject Comparison" : "Transfer Records"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-semibold">School</th>
                <th className="text-left px-4 py-3 font-semibold">Stage</th>
                <th className="text-left px-4 py-3 font-semibold">Students</th>
                <th className="text-left px-4 py-3 font-semibold">Avg Score</th>
                <th className="text-left px-4 py-3 font-semibold">License</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {data.branches.map((b) => (
                <tr key={b.schoolId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-on-surface">{b.schoolName}</td>
                  <td className="px-4 py-3 text-on-surface-variant capitalize">{b.stage}</td>
                  <td className="px-4 py-3 text-on-surface">{b.enrollment}</td>
                  <td className="px-4 py-3 text-on-surface">
                    {b.latestTermAverage !== null ? `${b.latestTermAverage}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {b.licenseEndDate && (
                      <span className="text-xs text-on-surface-variant">
                        {new Date(b.licenseEndDate).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-block w-fit ${LICENSE_COLORS[b.licenseStatus ?? "none"]}`}>
                        {b.licenseStatus ?? "No license"}
                      </span>
                      {b.isStale && (
                        <span className="text-[10px] text-amber-600 font-semibold">⚠ Stale</span>
                      )}
                      {b.suspended && (
                        <span className="text-[10px] text-red-600 font-semibold">Suspended</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.branches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-on-surface-variant">
                    No schools in this group yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "comparison" && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden">
          {data.subjectComparisons.length === 0 ? (
            <div className="px-5 py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">analytics</span>
              <p className="mt-2 text-sm">No subject comparison data available yet. This appears when branches have term results.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-semibold sticky left-0 bg-white">Subject</th>
                    {data.branches.map((b) => (
                      <th key={b.schoolId} className="text-center px-4 py-3 font-semibold min-w-[120px]">{b.schoolName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {data.subjectComparisons.map((sc) => {
                    const values = sc.branchAverages.map((b) => b.average).filter((v) => v !== null) as number[];
                    const max = values.length > 0 ? Math.max(...values) : null;
                    return (
                      <tr key={sc.subjectName} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-on-surface sticky left-0 bg-white">{sc.subjectName}</td>
                        {sc.branchAverages.map((b) => (
                          <td key={b.schoolId} className="px-4 py-3 text-center">
                            {b.average !== null ? (
                              <span className={`font-semibold ${max !== null && b.average === max ? "text-green-700" : "text-on-surface"}`}>
                                {b.average}%
                              </span>
                            ) : (
                              <span className="text-on-surface-variant/40">—</span>
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
      )}

      {tab === "transfers" && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden">
          {data.transfers.length === 0 ? (
            <div className="px-5 py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">swap_horiz</span>
              <p className="mt-2 text-sm">No cross-branch student transfers recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Origin School</th>
                    <th className="text-left px-4 py-3 font-semibold">Origin Student</th>
                    <th className="text-left px-4 py-3 font-semibold">→</th>
                    <th className="text-left px-4 py-3 font-semibold">Destination School</th>
                    <th className="text-left px-4 py-3 font-semibold">Destination Student</th>
                    <th className="text-left px-4 py-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {data.transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                        {new Date(t.transferredAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-on-surface">{t.originSchoolName}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {t.originStudentName}
                        <span className="block text-[10px] text-on-surface-variant/60">#{t.originAdmissionNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">→</td>
                      <td className="px-4 py-3 text-on-surface">{t.destinationSchoolName}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {t.destinationStudentName}
                        <span className="block text-[10px] text-on-surface-variant/60">#{t.destinationAdmissionNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs">{t.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
