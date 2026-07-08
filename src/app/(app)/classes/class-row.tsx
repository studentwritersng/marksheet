"use client";

import { useActionState, useState, useTransition } from "react";
import { archiveClassAction, updateClassAction } from "./actions";

interface ClassVM {
  id: string;
  name: string;
  section: string;
  department: string;
  studentCount: number;
  hasTeacher: boolean;
}

const DEPARTMENTS = [
  { value: "", label: "General" },
  { value: "science", label: "Science" },
  { value: "art", label: "Art" },
  { value: "commercial", label: "Commercial" },
];

export function ClassRow({ classItem }: { classItem: ClassVM }) {
  const [editing, setEditing] = useState(false);
  const [editDept, setEditDept] = useState(classItem.department);
  const [editSection, setEditSection] = useState(classItem.section);
  const [state, action, pending] = useActionState(updateClassAction, {});
  const [archivePending, startArchive] = useTransition();

  const isSSS = classItem.name.startsWith("SSS");

  function handleArchive() {
    if (!confirm(`Archive "${classItem.name}"? Cannot undo. Requires no active students.`)) return;
    startArchive(async () => {
      const res = await archiveClassAction(classItem.id);
      if (res.error) alert(res.error);
    });
  }

  if (editing) {
    return (
      <form action={action} className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
        <input type="hidden" name="classId" value={classItem.id} />
        <div className="flex items-center gap-2 flex-1">
          <span className="font-label-md text-label-md text-on-surface min-w-[5rem]">{classItem.name}</span>
          {isSSS && (
            <select name="department" value={editDept} onChange={(e) => setEditDept(e.target.value)}
              className="border border-outline-variant rounded p-1 text-sm"
            >
              {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          )}
          <input name="section" value={editSection} onChange={(e) => setEditSection(e.target.value.toUpperCase())}
            placeholder="Section"
            className="border border-outline-variant rounded p-1 text-sm w-16"
          />
          <span className="font-label-sm text-label-sm text-on-surface-variant">{classItem.studentCount} students</span>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={pending}
            className="text-sm bg-[#002046] text-white px-2 py-1 rounded disabled:opacity-60"
          >Save</button>
          <button type="button" onClick={() => setEditing(false)}
            className="text-sm text-on-surface-variant px-2 py-1"
          >Cancel</button>
        </div>
        {state.success && <p className="text-xs text-green-600">{state.success}</p>}
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <p className="font-label-md text-label-md text-on-surface">
          {classItem.name}
          {classItem.department && (
            <span className="ml-2 font-label-sm text-label-sm text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded capitalize">
              {classItem.department}
            </span>
          )}
        </p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {classItem.studentCount} student{classItem.studentCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setEditing(!editing)}
          className="font-label-sm text-label-sm text-primary hover:underline"
        >{editing ? "Cancel" : "Edit"}</button>
        <button onClick={handleArchive} disabled={archivePending}
          className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600 disabled:opacity-60"
        >Archive</button>
      </div>
    </div>
  );
}