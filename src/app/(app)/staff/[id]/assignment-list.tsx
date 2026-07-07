"use client";

import { useTransition } from "react";
import { removeAssignmentAction } from "./actions";

export function AssignmentList({
  assignments,
}: {
  assignments: {
    id: string;
    type: string;
    subject: string | null;
    class: string | null;
    session: string | null;
    term: string | null;
  }[];
}) {
  const [pending, start] = useTransition();

  if (assignments.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No assignments yet.</p>;
  }

  return (
    <div className="space-y-2">
      {assignments.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3"
        >
          <div>
            <p className="font-label-md text-label-md text-on-surface">
              {a.type.replace("_", " ")}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {[a.subject, a.class, a.session, a.term]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            onClick={() =>
              start(async () => {
                const res = await removeAssignmentAction(a.id);
                if (res.error) alert(res.error);
              })
            }
            disabled={pending}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
