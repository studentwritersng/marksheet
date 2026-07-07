"use client";

import { useTransition } from "react";
import { archiveStudentAction } from "./actions";

interface StudentVM {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  status: string;
  className: string | null;
}

export function StudentList({
  students,
}: {
  students: StudentVM[];
}) {
  const [pending, start] = useTransition();

  if (students.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No students yet.</p>;
  }

  return (
    <div className="space-y-2">
      {students.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3"
        >
          <div>
            <p className="font-label-md text-label-md text-on-surface">
              {s.firstName} {s.lastName}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {s.admissionNumber}
              {s.className ? ` · ${s.className}` : ""}
              {s.gender ? ` · ${s.gender}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={s.status} />
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
                className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600 disabled:opacity-60"
              >
                Withdraw
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-secondary-container text-on-secondary-container"
      : "bg-surface-variant text-on-surface-variant";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
