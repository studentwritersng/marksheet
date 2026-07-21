"use client";

import { useState, useTransition } from "react";
import { getClassStudentsAction, setClassCaptainAction } from "./actions";

interface StudentVM {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  isClassCaptain: boolean;
  isViceClassCaptain: boolean;
}

export function CaptainManager({ classId, className }: { classId: string; className: string }) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});

  async function load() {
    setLoading(true);
    const res = await getClassStudentsAction(classId);
    setStudents(res.students ?? []);
    setLoading(false);
  }

  function handleToggle() {
    if (!open) {
      load();
    }
    setOpen(!open);
  }

  function handleAssign(studentId: string, role: "captain" | "vice" | "none") {
    startTransition(async () => {
      const res = await setClassCaptainAction(studentId, role);
      setMessage(res);
      if (!res.error) {
        // Refresh student list
        const fresh = await getClassStudentsAction(classId);
        setStudents(fresh.students ?? []);
      }
    });
  }

  const captain = students.find((s) => s.isClassCaptain);
  const viceCaptain = students.find((s) => s.isViceClassCaptain);

  return (
    <div className="border-t border-outline-variant mt-2 pt-3">
      <button onClick={handleToggle} className="flex items-center gap-1 text-sm text-primary hover:underline">
        <span className="material-symbols-outlined text-[16px]">{open ? "expand_less" : "expand_more"}</span>
        {open ? "Close" : "Manage Captains"}
        {(captain || viceCaptain) && (
          <span className="ml-2 flex items-center gap-1 text-xs text-on-surface-variant">
            {captain && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">Captain: {captain.firstName} {captain.lastName[0]}.</span>}
            {viceCaptain && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Vice: {viceCaptain.firstName} {viceCaptain.lastName[0]}.</span>}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic py-2">No students in this class yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-surface-container-low rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-on-surface">{s.firstName} {s.lastName}</span>
                    <span className="text-xs text-on-surface-variant font-mono">#{s.admissionNumber}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.isClassCaptain ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">Captain</span>
                    ) : (
                      <button
                        onClick={() => handleAssign(s.id, "captain")}
                        disabled={pending}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Make Captain
                      </button>
                    )}
                    {s.isViceClassCaptain ? (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">Vice</span>
                    ) : (
                      <button
                        onClick={() => handleAssign(s.id, "vice")}
                        disabled={pending}
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 border border-indigo-300 px-2 py-0.5 rounded hover:bg-indigo-50 disabled:opacity-50"
                      >
                        Make Vice
                      </button>
                    )}
                    {(s.isClassCaptain || s.isViceClassCaptain) && (
                      <button
                        onClick={() => handleAssign(s.id, "none")}
                        disabled={pending}
                        className="text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 px-1 py-0.5 rounded disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {message.success && <p className="text-xs text-green-600 mt-2">{message.success}</p>}
          {message.error && <p className="text-xs text-red-600 mt-2">{message.error}</p>}
          <p className="text-[10px] text-on-surface-variant mt-2">
            Each class can have one Captain and one Vice Captain. Assigning a role replaces the previous one.
          </p>
        </div>
      )}
    </div>
  );
}
