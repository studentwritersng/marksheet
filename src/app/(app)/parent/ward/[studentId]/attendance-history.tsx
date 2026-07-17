"use client";

import { useState } from "react";
import { getStudentAttendanceTimeline, type AttendanceTimelineRow } from "@/lib/attendance/actions";

interface Props {
  schoolId: string;
  studentId: string;
}

export function AttendanceHistory({ schoolId, studentId }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [records, setRecords] = useState<AttendanceTimelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getStudentAttendanceTimeline(schoolId, studentId, from || undefined, to || undefined);
      setRecords(data.records);
      setLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      present: "bg-[#E8F5E9] text-[#2E7D32]",
      absent: "bg-[#FFEBEE] text-[#C62828]",
      late: "bg-[#FFF8E1] text-[#F57F17]",
      excused: "bg-[#E3F2FD] text-[#1565C0]",
    };
    return `px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`;
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4">
      <h3 className="font-label-md text-label-md text-on-surface font-semibold">Attendance History</h3>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="font-body-xs text-body-xs text-on-surface-variant">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-outline-variant rounded px-3 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-body-xs text-body-xs text-on-surface-variant">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-outline-variant rounded px-3 py-1.5 text-sm" />
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-1.5 bg-primary text-on-primary rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {loaded && records.length === 0 && (
        <p className="text-sm text-on-surface-variant text-center py-6">No attendance records found for this period.</p>
      )}

      {records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-xs text-on-surface-variant uppercase tracking-wider">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Sign In</th>
                <th className="py-2 pr-4">Sign Out</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {records.map((r) => (
                <tr key={r.date} className="text-sm">
                  <td className="py-2 pr-4 font-medium">{r.date}</td>
                  <td className="py-2 pr-4">{formatTime(r.signInAt)}</td>
                  <td className="py-2 pr-4">{formatTime(r.signOutAt)}</td>
                  <td className="py-2"><span className={statusBadge(r.status)}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loaded && (
        <p className="text-sm text-on-surface-variant text-center py-6">Select a date range and click Search to view attendance history.</p>
      )}
    </div>
  );
}
