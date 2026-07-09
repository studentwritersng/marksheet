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
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [department, setDepartment] = useState("general");

  const filteredLinks = classFilter ? links.filter((l) => l.classId === classFilter) : links;

  const linkedPair = new Set(links.map((l) => `${l.classId}:${l.subjectId}`));

  function toggle(set: Set<string>, id: string, upd: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    upd(next);
  }

  function toggleAll(set: Set<string>, ids: string[], upd: (s: Set<string>) => void) {
    if (set.size === ids.length) { upd(new Set()); return; }
    upd(new Set(ids));
  }

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

      {/* Bulk link form */}
      <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Link Subjects to Classes (Bulk)</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Select multiple classes and subjects, then link them all at once.</p>

        <div className="grid grid-cols-2 gap-6">
          {/* Classes */}
          <fieldset>
            <legend className="font-label-sm text-label-sm text-on-surface-variant mb-2 flex items-center gap-2">
              <span>Classes</span>
              <button type="button" onClick={() => toggleAll(selectedClasses, classes.map((c) => c.id), setSelectedClasses)}
                className="text-xs text-primary hover:underline">
                {selectedClasses.size === classes.length ? "Clear all" : "Select all"}
              </button>
            </legend>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-outline-variant rounded p-2">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-surface-container-low rounded px-2 py-1">
                  <input type="checkbox" name="classIds" value={c.id} checked={selectedClasses.has(c.id)}
                    onChange={() => toggle(selectedClasses, c.id, setSelectedClasses)}
                    className="accent-[#002046]" />
                  <span className="font-body-sm text-body-sm text-on-surface">{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Subjects */}
          <fieldset>
            <legend className="font-label-sm text-label-sm text-on-surface-variant mb-2 flex items-center gap-2">
              <span>Subjects</span>
              <button type="button" onClick={() => toggleAll(selectedSubjects, subjects.map((s) => s.id), setSelectedSubjects)}
                className="text-xs text-primary hover:underline">
                {selectedSubjects.size === subjects.length ? "Clear all" : "Select all"}
              </button>
            </legend>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-outline-variant rounded p-2">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-surface-container-low rounded px-2 py-1">
                  <input type="checkbox" name="subjectIds" value={s.id} checked={selectedSubjects.has(s.id)}
                    onChange={() => toggle(selectedSubjects, s.id, setSelectedSubjects)}
                    className="accent-[#002046]" />
                  <span className="font-body-sm text-body-sm text-on-surface">{s.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Department */}
        <div className="max-w-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Department</label>
          <select name="department" value={department} onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="general">General</option>
            <option value="science">Science</option>
            <option value="art">Art</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        {state.error && <p className="bg-error-container text-on-error-container font-body-sm text-body-sm px-3 py-2 rounded">{state.error}</p>}
        {state.success && <p className="bg-secondary-container text-on-secondary-container font-body-sm text-body-sm px-3 py-2 rounded">{state.success}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending || selectedClasses.size === 0 || selectedSubjects.size === 0}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded disabled:opacity-60">
            {pending ? "Linking..." : `Link ${selectedClasses.size * selectedSubjects.size} pair(s)`}
          </button>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {selectedClasses.size} class(s) &times; {selectedSubjects.size} subject(s) = {selectedClasses.size * selectedSubjects.size} link(s)
          </span>
        </div>
      </form>
    </div>
  );
}
