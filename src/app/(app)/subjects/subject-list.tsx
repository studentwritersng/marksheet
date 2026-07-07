"use client";

import { useTransition } from "react";
import { deleteSubjectAction } from "./actions";

export function SubjectList({
  subjects,
}: {
  subjects: { id: string; name: string; code: string | null }[];
}) {
  const [pending, start] = useTransition();

  if (subjects.length === 0) return <p className="font-body-sm text-body-sm text-on-surface-variant">No subjects yet.</p>;

  return (
    <div className="space-y-2">
      {subjects.map((s) => (
        <div key={s.id} className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
          <div>
            <p className="font-label-md text-label-md text-on-surface">{s.name}</p>
            {s.code && <p className="font-label-sm text-label-sm text-on-surface-variant">{s.code}</p>}
          </div>
          <button
            onClick={() => {
              if (confirm(`Delete "${s.name}"? This cannot be undone.`))
                start(async () => {
                  const r = await deleteSubjectAction(s.id);
                  if (r.error) alert(r.error);
                });
            }}
            disabled={pending}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
