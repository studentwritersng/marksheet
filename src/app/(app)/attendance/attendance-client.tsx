"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  takeStudentAttendanceAction,
  takeStaffAttendanceAction,
  adminSetStaffAttendanceAction,
  getStudentsWithAttendance,
  getAttendanceStats,
  getStaffForAttendance,
  getAllClassAttendanceSummary,
  scanStudentSignInAction,
  scanStudentSignOutAction,
  type StudentAttendanceRow,
  type AttendanceStats,
  type StaffAttendanceRow,
  type AttendanceStatus,
  type ClassAttendanceSummary,
} from "@/lib/attendance/actions";

interface Props {
  schoolId: string;
  staffId: string | null;
  isAdmin: boolean;
  classes: { id: string; name: string; level: string; section: string }[];
  today: string;
  attendancePeriodEnabled?: boolean;
}

type Tab = "students" | "staff" | "report" | "scanner";

export function AttendanceClient({ schoolId, staffId, isAdmin, classes, today, attendancePeriodEnabled }: Props) {
  const [tab, setTab] = useState<Tab>("students");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [periodId, setPeriodId] = useState("1");
  const [students, setStudents] = useState<StudentAttendanceRow[]>([]);
  const [staffList, setStaffList] = useState<StaffAttendanceRow[]>([]);
  const [myRecord, setMyRecord] = useState<StaffAttendanceRow | null>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [classSummaries, setClassSummaries] = useState<ClassAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const statusColors: Record<string, string> = {
    present: "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]",
    absent: "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]",
    late: "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]",
    excused: "bg-[#E3F2FD] text-[#1565C0] border-[#90CAF9]",
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const pId = attendancePeriodEnabled ? periodId : undefined;
      const [studentData, statsData] = await Promise.all([
        getStudentsWithAttendance(schoolId, classId, date, pId),
        getAttendanceStats(schoolId, date),
      ]);
      setStudents(studentData.students);
      setStats(statsData);
      setDirty(false);
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, date, periodId, attendancePeriodEnabled]);

  const loadStaffData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getStaffForAttendance(schoolId, date);
      setStaffList(data.staff);
      setMyRecord(data.myRecord);
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, date]);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [statsData, summaries] = await Promise.all([
        getAttendanceStats(schoolId, date),
        getAllClassAttendanceSummary(schoolId, date),
      ]);
      setStats(statsData);
      setClassSummaries(summaries);
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, date]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setMessage(null);
    if (t === "students") loadData();
    else if (t === "staff") loadStaffData();
    else if (t === "scanner") setMessage(null);
    else loadReportData();
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s)),
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const entries = students
      .filter((s) => s.status !== null)
      .map((s) => ({ studentId: s.studentId, status: s.status! }));
    const result = await takeStudentAttendanceAction(
      schoolId, classId, date, entries,
      attendancePeriodEnabled ? periodId : undefined,
    );
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.success! });
      setDirty(false);
      loadData();
    }
    setSaving(false);
  };

  const handleStaffCheckin = async (status: AttendanceStatus) => {
    if (!staffId) return;
    setMessage(null);
    const result = await takeStaffAttendanceAction(schoolId, date, status);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.success! });
      loadStaffData();
    }
  };

  const handleAdminStaffStatus = async (staffId: string, status: AttendanceStatus) => {
    setMessage(null);
    const result = await adminSetStaffAttendanceAction(schoolId, date, staffId, status);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.success! });
      loadStaffData();
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "students", label: "Student Attendance" },
    { key: "staff", label: "Staff Check‑in" },
    { key: "scanner", label: "QR Scanner" },
    { key: "report", label: "Reports" },
  ];

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex items-center justify-between no-print">
        <div />
        <a
          href="/attendance/qr-cards"
          className="px-4 py-2 bg-white text-[#002046] border border-[#002046] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          QR ID Cards
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-outline-variant">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`px-4 py-2 font-body-sm text-body-sm border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl font-body-sm text-body-sm ${
            message.type === "success"
              ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
              : "bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]"
          }`}
        >
          {message.text}
        </div>
      )}

      {tab === "students" && (
        <StudentAttendanceTab
          classes={classes}
          classId={classId}
          setClassId={setClassId}
          date={date}
          setDate={setDate}
          periodId={periodId}
          setPeriodId={setPeriodId}
          students={students}
          loading={loading}
          saving={saving}
          dirty={dirty}
          statusColors={statusColors}
          onLoad={loadData}
          onStatusChange={handleStatusChange}
          onSave={handleSave}
          attendancePeriodEnabled={attendancePeriodEnabled}
        />
      )}

      {tab === "staff" && (
        <StaffAttendanceTab
          staffId={staffId}
          isAdmin={isAdmin}
          date={date}
          setDate={setDate}
          staffList={staffList}
          myRecord={myRecord}
          loading={loading}
          statusColors={statusColors}
          onLoad={loadStaffData}
          onCheckin={handleStaffCheckin}
          onAdminSetStatus={handleAdminStaffStatus}
        />
      )}

      {tab === "scanner" && (
        <ScannerTab
          schoolId={schoolId}
          date={date}
          setDate={setDate}
          attendancePeriodEnabled={attendancePeriodEnabled}
          periodId={periodId}
          setPeriodId={setPeriodId}
        />
      )}

      {tab === "report" && (
        <ReportTab
          date={date}
          setDate={setDate}
          stats={stats}
          classSummaries={classSummaries}
          loading={loading}
          onLoad={loadReportData}
        />
      )}
    </div>
  );
}

function StudentAttendanceTab({
  classes, classId, setClassId, date, setDate, students, loading, saving, dirty, statusColors,
  onLoad, onStatusChange, onSave, attendancePeriodEnabled, periodId, setPeriodId,
}: {
  classes: { id: string; name: string }[];
  classId: string; setClassId: (v: string) => void;
  date: string; setDate: (v: string) => void;
  students: (StudentAttendanceRow & { signInAt: string | null; signOutAt: string | null })[];
  loading: boolean; saving: boolean; dirty: boolean;
  statusColors: Record<string, string>;
  onLoad: () => void;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onSave: () => void;
  attendancePeriodEnabled?: boolean;
  periodId?: string;
  setPeriodId?: (v: string) => void;
}) {

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="font-body-sm text-body-sm text-on-surface-variant">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-body-sm text-body-sm text-on-surface-variant">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
          />
        </div>
        {attendancePeriodEnabled && setPeriodId && (
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Period</label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
            >
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i + 1} value={`${i + 1}`}>Period {i + 1}</option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={onLoad}
          disabled={loading}
          className="px-4 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {students.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Admission No.</th>
                  <th className="py-2 pr-4">Student Name</th>
                  <th className="py-2 pr-4">Sign In</th>
                  <th className="py-2 pr-4">Sign Out</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.studentId} className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-body-sm text-body-sm text-on-surface-variant">{i + 1}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{s.admissionNumber}</td>
                    <td className="py-2 pr-4 font-body-md text-body-md">{s.fullName}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm text-on-surface-variant">{formatTime(s.signInAt)}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm text-on-surface-variant">{formatTime(s.signOutAt)}</td>
                    <td className="py-2">
                      <select
                        value={s.status ?? ""}
                        onChange={(e) => onStatusChange(s.studentId, e.target.value as AttendanceStatus)}
                        className={`border rounded-lg px-3 py-1.5 font-body-sm text-body-sm ${
                          s.status ? statusColors[s.status] : "border-outline-variant"
                        }`}
                      >
                        <option value="">— Select —</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="excused">Excused</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onSave}
              disabled={saving || !dirty}
              className="px-6 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : dirty ? "Save Attendance" : "No Changes"}
            </button>
          </div>
        </>
      )}

      {!loading && students.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-8">
          No active students found for this class. Select a class and date, then click Load.
        </p>
      )}
    </div>
  );
}

function StaffAttendanceTab({
  staffId, isAdmin, date, setDate, staffList, myRecord, loading, statusColors,
  onLoad, onCheckin, onAdminSetStatus,
}: {
  staffId: string | null; isAdmin: boolean;
  date: string; setDate: (v: string) => void;
  staffList: StaffAttendanceRow[];
  myRecord: StaffAttendanceRow | null;
  loading: boolean;
  statusColors: Record<string, string>;
  onLoad: () => void;
  onCheckin: (status: AttendanceStatus) => void;
  onAdminSetStatus: (staffId: string, status: AttendanceStatus) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Self check-in card */}
      {staffId && (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">My Check‑in</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
            />
          </div>
          {myRecord ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-body-md text-body-md">Status:</span>
              <span className={`px-3 py-1 rounded-lg font-body-sm text-body-sm border ${statusColors[myRecord.status!]}`}>
                {myRecord.status}
              </span>
              <button
                onClick={onLoad}
                className="text-sm text-primary underline ml-2"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["present", "late", "absent"] as AttendanceStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onCheckin(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    s === "present" ? "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7] hover:bg-[#C8E6C9]" :
                    s === "late" ? "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082] hover:bg-[#FFECB3]" :
                    "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A] hover:bg-[#FFCDD2]"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin view: all staff */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">All Staff</h2>
            <button
              onClick={onLoad}
              disabled={loading}
              className="px-4 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {staffList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant">
                    <th className="py-2 pr-4">Staff Name</th>
                    <th className="py-2 pr-4">Status</th>
                    {isAdmin && <th className="py-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.staffId} className="border-b border-outline-variant/50">
                      <td className="py-2 pr-4 font-body-md text-body-md">{s.fullName}</td>
                      <td className="py-2 pr-4">
                        {s.status ? (
                          <span className={`px-3 py-1 rounded-lg font-body-sm text-body-sm border ${statusColors[s.status]}`}>
                            {s.status}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant font-body-sm text-body-sm">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) onAdminSetStatus(s.staffId, e.target.value as AttendanceStatus);
                          }}
                          className="border border-outline-variant rounded-lg px-2 py-1 text-sm"
                        >
                          <option value="">Set status</option>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant text-center py-4">
              No staff records for this date. Click Refresh.
            </p>
          )}
        </div>
      )}

      {!staffId && !isAdmin && (
        <p className="font-body-md text-body-md text-on-surface-variant">Staff check‑in is available for staff accounts.</p>
      )}
    </div>
  );
}

function ScannerTab({
  schoolId, date, setDate, attendancePeriodEnabled, periodId, setPeriodId,
}: {
  schoolId: string;
  date: string; setDate: (v: string) => void;
  attendancePeriodEnabled?: boolean;
  periodId?: string;
  setPeriodId?: (v: string) => void;
}) {
  const [mode, setMode] = useState<"sign_in" | "sign_out">("sign_in");
  const [scanResult, setScanResult] = useState<{ success?: string; error?: string; studentName?: string } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);

  const startScanner = useCallback(async () => {
    setScanResult(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-scanner-element");
    html5QrCodeRef.current = scanner;
    setScannerActive(true);

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText: string) => {
        scanner.stop().catch(() => {});
        setScannerActive(false);

        const pId = attendancePeriodEnabled ? periodId : undefined;
        const action = mode === "sign_in" ? scanStudentSignInAction : scanStudentSignOutAction;
        const result = await action(schoolId, decodedText.trim(), date, pId);
        if (result.error) {
          setScanResult({ error: result.error, studentName: result.student?.fullName });
        } else {
          setScanResult({ success: result.success, studentName: result.student?.fullName });
        }
      },
      () => {},
    ).catch(() => {
      setScanResult({ error: "Failed to access camera. Ensure camera permissions are granted." });
      setScannerActive(false);
    });
  }, [schoolId, date, periodId, attendancePeriodEnabled, mode]);

  const stopScanner = useCallback(() => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="font-body-sm text-body-sm text-on-surface-variant">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
          />
        </div>
        {attendancePeriodEnabled && setPeriodId && (
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Period</label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
            >
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i + 1} value={`${i + 1}`}>Period {i + 1}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "sign_in"
                ? "bg-primary text-white"
                : "bg-white text-on-surface-variant border border-outline-variant"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("sign_out")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "sign_out"
                ? "bg-primary text-white"
                : "bg-white text-on-surface-variant border border-outline-variant"
            }`}
          >
            Sign Out
          </button>
        </div>
        <button
          onClick={scannerActive ? stopScanner : startScanner}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scannerActive
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-[#002046] text-white hover:bg-[#001a33]"
          }`}
        >
          {scannerActive ? "Stop Scanner" : `Start ${mode === "sign_in" ? "Sign In" : "Sign Out"}`}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <div
          id="qr-scanner-element"
          ref={scannerRef}
          className="w-full max-w-md mx-auto"
          style={{ minHeight: scannerActive ? 300 : 0 }}
        />
        {!scannerActive && !scanResult && (
          <p className="text-center font-body-md text-body-md text-on-surface-variant py-12">
            Click &ldquo;Start Scanner&rdquo; and point the camera at a student&apos;s QR ID card to mark them present.
          </p>
        )}
      </div>

      {scanResult && (
        <div
          className={`px-4 py-3 rounded-xl font-body-sm text-body-sm ${
            scanResult.success
              ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
              : "bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]"
          }`}
        >
          {scanResult.studentName && (
            <span className="font-semibold">{scanResult.studentName}</span>
          )}
          <span> — {scanResult.success ?? scanResult.error}</span>
        </div>
      )}
    </div>
  );
}

function ReportTab({
  date, setDate, stats, classSummaries, loading, onLoad,
}: {
  date: string; setDate: (v: string) => void;
  stats: AttendanceStats | null;
  classSummaries: ClassAttendanceSummary[];
  loading: boolean;
  onLoad: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="font-body-sm text-body-sm text-on-surface-variant">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
          />
        </div>
        <button
          onClick={onLoad}
          disabled={loading}
          className="px-4 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Load Report"}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Present</p>
            <p className="font-headline-lg text-headline-lg text-[#2E7D32]">{stats.present}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Absent</p>
            <p className="font-headline-lg text-headline-lg text-[#C62828]">{stats.absent}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Late</p>
            <p className="font-headline-lg text-headline-lg text-[#F57F17]">{stats.late}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Attendance %</p>
            <p className="font-headline-lg text-headline-lg text-primary">{stats.percentage}%</p>
          </div>
        </div>
      )}

      {classSummaries.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Per‑Class Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant">
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Total Students</th>
                  <th className="py-2 pr-4">Present</th>
                  <th className="py-2 pr-4">%</th>
                </tr>
              </thead>
              <tbody>
                {classSummaries.map((c) => (
                  <tr key={c.classId} className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-body-md text-body-md">{c.className}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{c.totalStudents}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{c.present}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-outline-variant rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${c.percentage}%` }}
                          />
                        </div>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{c.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!stats && !loading && (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-8">
          Select a date and click Load Report to view attendance statistics.
        </p>
      )}
    </div>
  );
}
