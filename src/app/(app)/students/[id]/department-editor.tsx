"use client";

import { useState, useTransition } from "react";
import { updateStudentDepartmentAction } from "../actions";

const DEPT_OPTIONS = [
  { value: "", label: "—" },
  { value: "science", label: "Science" },
  { value: "art", label: "Art" },
  { value: "commercial", label: "Commercial" },
];

export function DepartmentEditor({
  studentId,
  currentDepartment,
  classLevel,
}: {
  studentId: string;
  currentDepartment: string;
  classLevel: string;
}) {
  const [dept, setDept] = useState(currentDepartment);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isSSS = classLevel?.startsWith("SSS");

  if (!isSSS) return null;

  const handleSave = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateStudentDepartmentAction(studentId, dept);
      if (res.error) setError(res.error);
      if (res.success) setSuccess(res.success);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={dept}
        onChange={(e) => setDept(e.target.value)}
        className="border border-outline-variant rounded p-1.5 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
      >
        {DEPT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending || dept === currentDepartment}
        className="bg-primary text-on-primary font-label-sm text-label-sm py-1.5 px-3 rounded hover:bg-primary-container disabled:opacity-60 transition-colors"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {success && <span className="font-body-sm text-body-sm text-green-600">{success}</span>}
      {error && <span className="font-body-sm text-body-sm text-red-600">{error}</span>}
    </div>
  );
}
