"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { archiveStudentAction } from "./actions";
import { ExportButtons } from "@/components/export-buttons";

interface StudentVM {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  gender: string | null;
  status: string;
  className: string | null;
  classLevel: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  isClassCaptain: boolean;
  isViceClassCaptain: boolean;
}
interface ClassOption { id: string; name: string; level: string; section: string; department: string; }
interface SessionOption { id: string; label: string; isCurrent: boolean; }
interface TermOption { id: string; name: string; sessionId: string; isCurrent: boolean; }

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  withdrawn: "bg-red-100 text-red-600",
  graduated: "bg-indigo-100 text-indigo-600",
};
const GENDER_COLORS: Record<string, string> = {
  Male: "from-blue-500 to-cyan-500",
  Female: "from-pink-500 to-rose-500",
};
const DEFAULT_GRADIENT = "from-indigo-500 to-purple-500";

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function StudentsPageClient({
  students,
  classes,
  sessions,
  terms,
  canTransferFromBranch,
}: {
  students: StudentVM[];
  classes: ClassOption[];
  sessions: SessionOption[];
  terms: TermOption[];
  canTransferFromBranch: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [pending, start] = useTransition();

  const filtered = students.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterClass && s.className !== classes.find((c) => c.id === filterClass)?.name) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const match = `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const activeCount = students.filter((s) => s.status === "active").length;
  const maleCount = students.filter((s) => s.gender === "Male").length;
  const femaleCount = students.filter((s) => s.gender === "Female").length;

  const csvHeaders = ["Student ID", "First Name", "Last Name", "Email", "Gender", "Status", "Class", "Guardian", "Guardian Phone"];
  const csvRows = filtered.map((s) => [
    s.admissionNumber, s.firstName, s.lastName, s.email ?? "", s.gender ?? "", s.status,
    s.className ?? "", s.guardianName ?? "", s.guardianPhone ?? "",
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Students</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {activeCount} active · {maleCount} male · {femaleCount} female · {students.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/students/register"
            className="inline-flex items-center gap-1.5 bg-[#002046] hover:bg-[#003366] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Register Student
          </Link>
          {canTransferFromBranch && (
            <Link
              href="/students/transfer"
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              Transfer from Branch
            </Link>
          )}
          <Link
            href="/students/import"
            className="inline-flex items-center gap-1.5 border border-outline-variant hover:bg-surface-container-low text-on-surface text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Import CSV
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 text-center">
          <span className="material-symbols-outlined text-[24px] text-emerald-500">groups</span>
          <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
          <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Active</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4 text-center">
          <span className="material-symbols-outlined text-[24px] text-blue-500">male</span>
          <p className="text-2xl font-bold text-blue-700">{maleCount}</p>
          <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Male</p>
        </div>
        <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-xl p-4 text-center">
          <span className="material-symbols-outlined text-[24px] text-pink-500">female</span>
          <p className="text-2xl font-bold text-pink-700">{femaleCount}</p>
          <p className="text-[10px] text-pink-600 uppercase tracking-wider font-semibold">Female</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
          <span className="material-symbols-outlined text-[24px] text-amber-500">school</span>
          <p className="text-2xl font-bold text-amber-700">{classes.length}</p>
          <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Classes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or admission number..."
              className="w-full pl-10 pr-3 py-2 border border-outline-variant rounded-lg text-sm text-on-surface bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface bg-surface focus:outline-none focus:border-primary"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="graduated">Graduated</option>
          </select>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface bg-surface focus:outline-none focus:border-primary"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterSession}
            onChange={(e) => { setFilterSession(e.target.value); setFilterTerm(""); }}
            className="border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface bg-surface focus:outline-none focus:border-primary"
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? " (current)" : ""}</option>
            ))}
          </select>
          {filterSession && (
            <select
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface bg-surface focus:outline-none focus:border-primary"
            >
              <option value="">All terms</option>
              {terms.filter((t) => t.sessionId === filterSession).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">
            Showing {filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}
          </p>
          {(search || filterClass || filterStatus) && (
            <button
              onClick={() => { setSearch(""); setFilterClass(""); setFilterStatus(""); }}
              className="text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">person_off</span>
          <p className="text-sm text-on-surface-variant mt-2">
            {students.length === 0 ? "No students registered yet." : "No students match your filters."}
          </p>
          <Link href="/students/register" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Register a student
          </Link>
        </div>
      ) : (
        <div id="students-content" className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-3 border-b border-outline-variant flex justify-end bg-surface-container-low">
            <ExportButtons
              contentId="students-content"
              filename={`Students_${new Date().toISOString().slice(0, 10)}`}
              pdfTitle="Student List"
              csvData={{ headers: csvHeaders, rows: csvRows }}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant">
                  <th className="text-left py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Student</th>
                  <th className="text-left py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Class</th>
                  <th className="text-left py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Guardian</th>
                  <th className="text-left py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((s) => {
                  const gradient = s.gender ? (GENDER_COLORS[s.gender] ?? DEFAULT_GRADIENT) : DEFAULT_GRADIENT;
                  return (
                    <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {getInitials(s.firstName, s.lastName)}
                          </div>
                          <div>
                            <Link href={`/students/${s.id}`} className="text-on-surface font-medium hover:text-primary hover:underline">
                              {s.firstName} {s.lastName}
                            </Link>
                            <p className="text-xs text-on-surface-variant font-mono">{s.admissionNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {s.className ? (
                          <span className="text-xs bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full">{s.className}</span>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {s.guardianName ? (
                          <div>
                            <p className="text-sm">{s.guardianName}</p>
                            {s.guardianPhone && <p className="text-[10px] text-on-surface-variant/70">{s.guardianPhone}</p>}
                          </div>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.status === "active" && (
                          <button
                            onClick={() => {
                              if (confirm(`Withdraw ${s.firstName} ${s.lastName}?`))
                                start(async () => {
                                  const r = await archiveStudentAction(s.id);
                                  if (r.error) alert(r.error);
                                });
                            }}
                            disabled={pending}
                            className="text-xs text-on-surface-variant hover:text-red-600 disabled:opacity-50"
                          >
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
