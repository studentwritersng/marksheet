"use client";

import { useTransition } from "react";
import { archiveClassAction } from "./actions";

interface ClassVM {
  id: string;
  name: string;
  studentCount: number;
  hasTeacher: boolean;
}

export function ClassRow({ classItem }: { classItem: ClassVM }) {
  const [pending, start] = useTransition();

  function handleArchive() {
    if (
      !confirm(
        `Archive "${classItem.name}"? Cannot undo. Requires no active students.`,
      )
    )
      return;
    start(async () => {
      const res = await archiveClassAction(classItem.id);
      if (res.error) alert(res.error);
    });
  }

  return (
    <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
      <div>
        <p className="font-label-md text-label-md text-on-surface">{classItem.name}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {classItem.studentCount} student{classItem.studentCount !== 1 ? "s" : ""}
        </p>
      </div>
      <button
        onClick={handleArchive}
        disabled={pending}
        className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600 disabled:opacity-60"
      >
        Archive
      </button>
    </div>
  );
}
