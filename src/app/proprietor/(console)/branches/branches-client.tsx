"use client";

import Link from "next/link";

interface BranchDetail {
  schoolId: string;
  schoolName: string;
  stage: string;
  suspended: boolean;
  enrollment: number;
  staffCount: number;
  subjectCount: number;
  classCount: number;
  latestTermAverage: number | null;
  licenseStatus: string;
  licenseEndDate: string | null;
  isStale: boolean;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  motto: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  basic: "bg-slate-100 text-slate-600",
  standard: "bg-indigo-100 text-indigo-600",
  premium: "bg-amber-100 text-amber-600",
};

const LICENSE_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  grace_period: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  none: "bg-gray-100 text-gray-500",
};

export function BranchesClient({ branches }: { branches: BranchDetail[] }) {
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Branches</h1>
        <p className="text-sm text-white/40 mt-1">
          {branches.length} school{branches.length !== 1 ? "s" : ""} in your group · click any branch for deep analytics
        </p>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-white/20">domain</span>
          <p className="text-sm text-white/40 mt-3">No schools in this group yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((b) => (
            <Link
              key={b.schoolId}
              href={`/proprietor/branches/${b.schoolId}`}
              className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md overflow-hidden">
                    {b.logo ? (
                      <img src={b.logo} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-white">school</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{b.schoolName}</h3>
                    {b.motto && <p className="text-[10px] text-white/30 truncate">{b.motto}</p>}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-white/20 group-hover:text-indigo-400 transition-colors">arrow_forward</span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <Stat label="Students" value={b.enrollment} />
                <Stat label="Staff" value={b.staffCount} />
                <Stat label="Subjects" value={b.subjectCount} />
                <Stat label="Classes" value={b.classCount} />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${STAGE_COLORS[b.stage] ?? "bg-gray-100 text-gray-500"}`}>
                    {b.stage}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${LICENSE_COLORS[b.licenseStatus] ?? "bg-gray-100 text-gray-500"}`}>
                    {b.licenseStatus}
                  </span>
                  {b.isStale && <span className="text-[10px] text-amber-600 font-semibold">⚠ Stale</span>}
                  {b.suspended && <span className="text-[10px] text-red-600 font-semibold">Suspended</span>}
                </div>
                {b.latestTermAverage !== null && (
                  <span className="text-white font-semibold">{b.latestTermAverage}%</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center bg-white/5 rounded-lg p-2">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
    </div>
  );
}
