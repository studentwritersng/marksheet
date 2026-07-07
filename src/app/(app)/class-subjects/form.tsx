"use client";

import { useActionState, useState } from "react";
import { linkSubjectToClassAction, unlinkSubjectAction } from "@/lib/class-subjects/actions";

interface Link { classId: string; className: string; subjectId: string; subjectName: string; department: string }

export function ClassSubjectsForm({
  classes, subjects, links,
}: {
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  links: Link[];
}) {
  const [state, action, pending] = useActionState(linkSubjectToClassAction, {});
  const [classFilter, setClassFilter] = useState("");

  const filteredLinks = classFilter ? links.filter((l) => l.classId === classFilter) : links;

  const linkedClassSubject = new Set(links.map((l) => `${l.classId}:${l.subjectId}`));
  const availableSubjects = (classId: string) => subjects.filter((s) => !linkedClassSubject.has(`${classId}:${s.id}`));

  return (
    <div className="space-y-6">
      {/* Filter */}
      <select
        value={classFilter}
        onChange={(e) => setClassFilter(e.target.value)}
        className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest"
      >
        <option value="">All classes</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Existing links */}
      <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-surface-container border-b border-outline-variant">
            <tr>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Class</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Subject</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Department</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filteredLinks.map((l) => (
              <tr key={`${l.classId}:${l.subjectId}`} className="hover:bg-surface-container-low">
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{l.className}</td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{l.subjectName}</td>
                <td className="py-3 px-4">
                  <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm capitalize">{l.department}</span>
                </td>
                <td className="py-3 px-4">
                  <form action={async () => { await unlinkSubjectAction(l.classId, l.subjectId); }}>
                    <button type="submit" className="font-label-sm text-label-sm text-red-600 hover:underline">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {filteredLinks.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">No links yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add new link */}
      <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Link Subject to Class</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class</label>
            <select name="classId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest" onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
            <select name="subjectId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Department</label>
            <select name="department" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="general">General</option>
              <option value="science">Science</option>
              <option value="art">Art</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
        </div>
        {state.error && <p className="bg-error-container text-on-error-container font-body-sm text-body-sm px-3 py-2 rounded">{state.error}</p>}
        {state.success && <p className="bg-secondary-container text-on-secondary-container font-body-sm text-body-sm px-3 py-2 rounded">{state.success}</p>}
        <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded disabled:opacity-60">
          {pending ? "Linking…" : "Link"}
        </button>
      </form>
    </div>
  );
}
