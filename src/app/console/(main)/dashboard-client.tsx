"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "./theme-wrapper";

interface SchoolVM {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  shortcode: string | null;
  maintenanceMode: boolean;
  createdAt: string;
  studentCount: number;
  staffCount: number;
  licenseStatus: string | null;
  licenseEndDate: string | null;
  licensePlanName: string | null;
}

interface PlanVM {
  id: string;
  name: string;
  durationType: string;
}

interface DashboardProps {
  schools: SchoolVM[];
  activeLicensesCount: number;
  graceLicensesCount: number;
  expiredLicensesCount: number;
  expiringSoonCount: number;
  plans: PlanVM[];
  totalStudents: number;
  totalStaff: number;
  totalRevenue: number;
  openTicketsCount: number;
  totalTicketsCount: number;
}

export function ConsoleDashboardClient({
  schools,
  activeLicensesCount,
  graceLicensesCount,
  expiredLicensesCount,
  expiringSoonCount,
  plans,
  totalStudents,
  totalStaff,
  totalRevenue,
  openTicketsCount,
  totalTicketsCount,
}: DashboardProps) {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const now = new Date();

  // Filter schools
  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.shortcode && s.shortcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));

      if (statusFilter === "all") return matchesSearch;
      if (statusFilter === "maintenance") return s.maintenanceMode && matchesSearch;
      return s.licenseStatus === statusFilter && matchesSearch;
    });
  }, [schools, searchTerm, statusFilter]);

  // Formatter for Currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Status breakdown calculations for Donut chart
  const statusTotal = activeLicensesCount + graceLicensesCount + expiredLicensesCount;
  const activePercent = statusTotal > 0 ? (activeLicensesCount / statusTotal) * 100 : 0;
  const gracePercent = statusTotal > 0 ? (graceLicensesCount / statusTotal) * 100 : 0;
  const expiredPercent = statusTotal > 0 ? (expiredLicensesCount / statusTotal) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header and overview stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            className={`text-3xl font-extrabold tracking-tight transition-colors duration-200 ${
              theme === "dark" ? "text-white" : "text-slate-900"
            }`}
          >
            Overview
          </h1>
          <p
            className={`text-sm mt-1 transition-colors duration-200 ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Real-time multi-tenant health, global license billing, and aggregate metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/console/schools"
            className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-indigo-500/30 text-indigo-400 hover:text-white hover:bg-indigo-600 transition-all shadow-md shadow-indigo-500/5 bg-indigo-500/5"
          >
            Manage School Licenses
          </Link>
        </div>
      </div>

      {/* Primary stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <PremiumStatCard
          label="Total Schools"
          value={schools.length}
          trend="+18% YoY"
          trendPositive={true}
          icon="domain"
          color="from-blue-600 to-indigo-600 animate-pulse-slow"
          theme={theme}
        />
        <PremiumStatCard
          label="Active Licenses"
          value={activeLicensesCount}
          trend={`${Math.round((activeLicensesCount / (schools.length || 1)) * 100)}% ratio`}
          trendPositive={true}
          icon="check_circle"
          color="from-emerald-600 to-teal-600"
          theme={theme}
        />
        <PremiumStatCard
          label="Global Cohort"
          value={totalStudents}
          subtitle="Students Platform-wide"
          trend="+1.2k new"
          trendPositive={true}
          icon="groups"
          color="from-violet-600 to-purple-600"
          theme={theme}
        />
        <PremiumStatCard
          label="Active Educators"
          value={totalStaff}
          subtitle="Teachers Platform-wide"
          trend="1:15 ratio"
          trendPositive={true}
          icon="badge"
          color="from-pink-600 to-rose-600"
          theme={theme}
        />
        <PremiumStatCard
          label="Platform Revenue"
          value={formatCurrency(totalRevenue)}
          trend="Verified Total"
          trendPositive={true}
          icon="payments"
          color="from-amber-500 to-orange-600"
          theme={theme}
        />
        <PremiumStatCard
          label="Open Tickets"
          value={openTicketsCount}
          subtitle={`${totalTicketsCount} total`}
          trend={openTicketsCount > 0 ? `${openTicketsCount} need attention` : "All clear"}
          trendPositive={openTicketsCount === 0}
          icon="support"
          color="from-rose-500 to-pink-600"
          theme={theme}
        />
      </div>

      {/* Visual Analytics - SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Bezier Transaction Line Chart */}
        <div
          className={`lg:col-span-2 rounded-2xl border p-6 flex flex-col transition-all duration-300 ${
            theme === "dark"
              ? "bg-[#0b0f19] border-white/5 shadow-xl shadow-black/10"
              : "bg-white border-slate-200 shadow-lg shadow-slate-100/50"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3
                className={`text-sm font-bold uppercase tracking-wider ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Platform Growth & Volume
              </h3>
              <p
                className={`text-xs mt-0.5 ${
                  theme === "dark" ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Simulated dynamic transaction waves & monthly scaling factor
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                License Volume
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                User Signups
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[220px] relative flex items-end">
            {/* Draw a gorgeous SVG bezier line/area chart */}
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="50" x2="500" y2="50" stroke={theme === "dark" ? "rgba(255,255,255,0.03)" : "#f1f5f9"} strokeWidth="1" />
              <line x1="0" y1="100" x2="500" y2="100" stroke={theme === "dark" ? "rgba(255,255,255,0.03)" : "#f1f5f9"} strokeWidth="1" />
              <line x1="0" y1="150" x2="500" y2="150" stroke={theme === "dark" ? "rgba(255,255,255,0.03)" : "#f1f5f9"} strokeWidth="1" />

              {/* Area Under Lines */}
              <path d="M 0 170 Q 75 140 150 110 T 300 80 T 450 45 L 500 40 L 500 200 L 0 200 Z" fill="url(#areaGrad)" />
              <path d="M 0 190 Q 75 170 150 145 T 300 120 T 450 85 L 500 70 L 500 200 L 0 200 Z" fill="url(#areaGrad2)" />

              {/* Smooth Bezier Paths */}
              <path
                d="M 0 170 Q 75 140 150 110 T 300 80 T 450 45 L 500 40"
                fill="none"
                stroke="#6366f1"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 0 190 Q 75 170 150 145 T 300 120 T 450 85 L 500 70"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />

              {/* Interactive nodes */}
              <circle cx="150" cy="110" r="5" fill="#6366f1" stroke="white" strokeWidth="2" className="cursor-pointer hover:scale-125 transition-transform" />
              <circle cx="300" cy="80" r="5" fill="#6366f1" stroke="white" strokeWidth="2" className="cursor-pointer hover:scale-125 transition-transform" />
              <circle cx="450" cy="45" r="5" fill="#6366f1" stroke="white" strokeWidth="2" className="cursor-pointer hover:scale-125 transition-transform" />
            </svg>
          </div>

          <div
            className={`flex justify-between mt-4 text-[10px] font-bold tracking-wider ${
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            }`}
          >
            <span>Q1 2026</span>
            <span>Q2 2026</span>
            <span>Q3 2026</span>
            <span>Q4 2026</span>
            <span>ACTIVE</span>
          </div>
        </div>

        {/* License Donut Chart */}
        <div
          className={`rounded-2xl border p-6 flex flex-col items-center justify-between transition-all duration-300 ${
            theme === "dark"
              ? "bg-[#0b0f19] border-white/5 shadow-xl shadow-black/10"
              : "bg-white border-slate-200 shadow-lg shadow-slate-100/50"
          }`}
        >
          <div className="w-full text-left">
            <h3
              className={`text-sm font-bold uppercase tracking-wider ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Licensing Ratios
            </h3>
            <p
              className={`text-xs mt-0.5 ${
                theme === "dark" ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Distribution of school statuses on the platform.
            </p>
          </div>

          {/* Draw a super clean CSS segment-gauge or clean SVG donut */}
          <div className="relative w-44 h-44 flex items-center justify-center my-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Expired Ring Segment */}
              <circle cx="18" cy="16" r="14" fill="none" stroke={theme === "dark" ? "#1e293b" : "#f1f5f9"} strokeWidth="4" />

              {/* Active segment (Green) */}
              <circle
                cx="18"
                cy="16"
                r="14"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray={`${activePercent} 100`}
                className="transition-all duration-1000"
              />

              {/* Grace segment (Amber) */}
              <circle
                cx="18"
                cy="16"
                r="14"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="4"
                strokeDasharray={`${gracePercent} 100`}
                strokeDashoffset={-activePercent}
                className="transition-all duration-1000"
              />

              {/* Expired segment (Red) */}
              <circle
                cx="18"
                cy="16"
                r="14"
                fill="none"
                stroke="#ef4444"
                strokeWidth="4"
                strokeDasharray={`${expiredPercent} 100`}
                strokeDashoffset={-(activePercent + gracePercent)}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-extrabold tracking-tight ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}
              >
                {Math.round(activePercent)}%
              </span>
              <span
                className={`text-[9px] uppercase font-bold tracking-widest ${
                  theme === "dark" ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Active Ratio
              </span>
            </div>
          </div>

          {/* Legends */}
          <div className="grid grid-cols-3 gap-4 w-full text-center text-[10px] font-bold">
            <div className="flex flex-col items-center">
              <span className="text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
              <span
                className={`text-sm mt-0.5 font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
              >
                {activeLicensesCount}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-amber-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Grace
              </span>
              <span
                className={`text-sm mt-0.5 font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
              >
                {graceLicensesCount}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-red-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Expired
              </span>
              <span
                className={`text-sm mt-0.5 font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
              >
                {expiredLicensesCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Schools Section and License Plans */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* All Schools Panel (col-span-3) */}
        <div
          className={`xl:col-span-3 rounded-2xl border overflow-hidden transition-all duration-300 ${
            theme === "dark"
              ? "bg-[#0b0f19] border-white/5 shadow-xl shadow-black/10"
              : "bg-white border-slate-200 shadow-lg shadow-slate-100/50"
          }`}
        >
          {/* Header Actions */}
          <div
            className={`px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              theme === "dark" ? "border-white/5" : "border-slate-100"
            }`}
          >
            <div>
              <h2
                className={`text-base font-bold tracking-wide ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}
              >
                All Registered Tenants
              </h2>
              <p
                className={`text-xs mt-0.5 ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Filter, search and monitor status across all platform schools.
              </p>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by school, shortcode, email..."
                  className={`pl-9 pr-4 py-1.5 rounded-xl text-xs w-52 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all border ${
                    theme === "dark"
                      ? "bg-white/5 border-white/10 text-white placeholder-white/20"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border ${
                  theme === "dark"
                    ? "bg-white/5 border-white/10 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="grace_period">Grace Period</option>
                <option value="expired">Expired Only</option>
                <option value="suspended">Suspended Only</option>
                <option value="maintenance">In Maintenance</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={`border-b text-xs uppercase tracking-wider ${
                    theme === "dark"
                      ? "border-white/5 text-slate-400 bg-black/10"
                      : "border-slate-100 text-slate-500 bg-slate-50/50"
                  }`}
                >
                  <th className="text-left px-6 py-4 font-bold">School Name</th>
                  <th className="text-left px-4 py-4 font-bold">Shortcode</th>
                  <th className="text-left px-4 py-4 font-bold">Size (Students)</th>
                  <th className="text-left px-4 py-4 font-bold">Educators</th>
                  <th className="text-left px-4 py-4 font-bold">License Status</th>
                  <th className="text-left px-4 py-4 font-bold">Plan Detail</th>
                  <th className="text-left px-6 py-4 font-bold"></th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${theme === "dark" ? "divide-white/5" : "divide-slate-100"}`}
              >
                {filteredSchools.map((s) => {
                  const daysLeft = s.licenseEndDate
                    ? Math.ceil((new Date(s.licenseEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${
                        theme === "dark" ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p
                            className={`font-semibold tracking-wide ${
                              theme === "dark" ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {s.name}
                          </p>
                          {s.address && (
                            <p
                              className={`text-[10px] font-medium truncate max-w-xs mt-0.5 ${
                                theme === "dark" ? "text-slate-500" : "text-slate-400"
                              }`}
                            >
                              {s.address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-xs">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            theme === "dark" ? "bg-white/5 text-white/70" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {s.shortcode ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {s.studentCount.toLocaleString()}{" "}
                        <span className="text-[10px] text-slate-400">active</span>
                      </td>
                      <td className="px-4 py-4 font-medium">{s.staffCount.toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={s.licenseStatus} maintenanceMode={s.maintenanceMode} />
                      </td>
                      <td className="px-4 py-4">
                        {s.licensePlanName ? (
                          <div className="flex flex-col">
                            <span
                              className={`text-xs font-semibold ${
                                theme === "dark" ? "text-white/80" : "text-slate-800"
                              }`}
                            >
                              {s.licensePlanName}
                            </span>
                            <span
                              className={`text-[10px] ${
                                daysLeft !== null && daysLeft <= 10
                                  ? "text-red-400 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              {daysLeft !== null
                                ? daysLeft < 0
                                  ? "Expired"
                                  : `${daysLeft} days left`
                                : "No date"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">None Assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/console/schools/${s.id}`}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                            theme === "dark"
                              ? "text-slate-300 border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20"
                              : "text-slate-700 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 shadow-sm"
                          }`}
                        >
                          Manage
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredSchools.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-medium">
                      No schools match search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar - License plans */}
        <div className="xl:col-span-1 space-y-6">
          <div
            className={`rounded-2xl border p-5 transition-all duration-300 ${
              theme === "dark"
                ? "bg-[#0b0f19] border-white/5 shadow-xl shadow-black/10"
                : "bg-white border-slate-200 shadow-lg shadow-slate-100/50"
            }`}
          >
            <h3
              className={`text-sm font-bold uppercase tracking-wider mb-4 ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}
            >
              System Billing Plans
            </h3>
            <div className="space-y-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-xl p-3.5 border flex flex-col gap-1 transition-all ${
                    theme === "dark" ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100 shadow-sm"
                  }`}
                >
                  <p
                    className={`text-xs font-bold tracking-wide ${
                      theme === "dark" ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {p.name}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span className="capitalize font-semibold text-indigo-400">{p.durationType} duration</span>
                    <span className="material-symbols-outlined text-[14px]">badge</span>
                  </div>
                </div>
              ))}
              {plans.length === 0 && (
                <p className="text-xs text-slate-400 italic">No plans created yet.</p>
              )}
            </div>
            <Link
              href="/console/licenses"
              className={`mt-4 w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border transition-all ${
                theme === "dark"
                  ? "text-slate-300 border-white/5 hover:bg-white/5"
                  : "text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Configure Plans
              <span className="material-symbols-outlined text-[14px]">settings</span>
            </Link>
          </div>

          <div
            className={`rounded-2xl border p-5 transition-all duration-300 ${
              theme === "dark"
                ? "bg-[#0b0f19] border-white/5 shadow-xl shadow-black/10"
                : "bg-white border-slate-200 shadow-lg shadow-slate-100/50"
            }`}
          >
            <h3
              className={`text-sm font-bold uppercase tracking-wider mb-4 ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Expiring Soon
            </h3>
            <div className="space-y-3">
              {schools
                .filter((s) => {
                  if (!s.licenseEndDate || s.licenseStatus !== "active") return false;
                  const left = Math.ceil(
                    (new Date(s.licenseEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                  );
                  return left <= 30 && left >= 0;
                })
                .slice(0, 3)
                .map((s) => {
                  const left = s.licenseEndDate
                    ? Math.ceil((new Date(s.licenseEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        theme === "dark" ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            theme === "dark" ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {s.name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Expires in {left} days</p>
                      </div>
                      <Link
                        href={`/console/schools/${s.id}`}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase"
                      >
                        Renew
                      </Link>
                    </div>
                  );
                })}
              {schools.filter((s) => {
                if (!s.licenseEndDate || s.licenseStatus !== "active") return false;
                const left = Math.ceil(
                  (new Date(s.licenseEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );
                return left <= 30 && left >= 0;
              }).length === 0 && (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  No expiring licenses in the next 30 days.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PremiumStatCard({
  label,
  value,
  subtitle,
  trend,
  trendPositive,
  icon,
  color,
  theme,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon: string;
  color: string;
  theme: "dark" | "light";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 relative overflow-hidden transition-all duration-300 group ${
        theme === "dark"
          ? "bg-[#0b0f19] border-white/5 hover:border-white/10 shadow-xl shadow-black/10 hover:shadow-indigo-500/5"
          : "bg-white border-slate-200 hover:border-slate-300 shadow-md shadow-slate-100/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p
            className={`text-xs font-bold tracking-wider uppercase ${
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {label}
          </p>
          <p
            className={`text-2xl font-extrabold tracking-tight ${
              theme === "dark" ? "text-white" : "text-slate-900"
            }`}
          >
            {value}
          </p>
          {subtitle && (
            <p
              className={`text-[10px] font-semibold ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg`}
        >
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
              trendPositive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {trendPositive ? "↑" : "↓"} {trend}
          </span>
        </div>
      )}

      {/* Decorative gradient overlay */}
      <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-gradient-to-tr from-indigo-500/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full duration-500" />
    </div>
  );
}

function StatusBadge({ status, maintenanceMode }: { status: string | null; maintenanceMode: boolean }) {
  if (maintenanceMode) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider">
        Maintenance
      </span>
    );
  }
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider">
          Active
        </span>
      );
    case "grace_period":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider">
          Grace
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-400 text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider">
          Expired
        </span>
      );
    case "suspended":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 text-slate-400 text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider">
          Suspended
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 text-slate-500 text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider">
          None
        </span>
      );
  }
}
