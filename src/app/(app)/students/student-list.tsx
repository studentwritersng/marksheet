"use client";

import { useTransition } from "react";
import { archiveStudentAction } from "./actions";

interface StudentVM {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  gender: string | null;
  status: string;
  className: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
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
    <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
      <table className="w-full text-left">
        <thead className="bg-surface-container border-b border-outline-variant">
          <tr>
            <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Adm No.</th>
            <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Name</th>
            <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Email</th>
            <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Class</th>
            <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Guardian</th>
            <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Status</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
              <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{s.admissionNumber}</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface font-medium">{s.firstName} {s.lastName}</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{s.email || "—"}</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{s.className || "—"}</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{s.guardianName || "—"}{s.guardianEmail ? ` (${s.guardianEmail})` : ""}</td>
              <td className="py-3 px-4">
                <StatusBadge status={s.status} />
              </td>
              <td className="py-3 px-4">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
