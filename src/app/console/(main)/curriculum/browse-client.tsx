"use client";

import { useState, useTransition } from "react";
import { deleteCurriculumEntryAction, deleteAllSubjectEntriesAction } from "./actions";
import type { SubjectGroup } from "./actions";

function weekLabel(w: number, s?: string) {
  return s ? `${w}${s}` : `${w}`;
}

export function BrowseCurriculumClient({
  classLevels, initialClass, groups: initialGroups,
}: {
  classLevels: string[];
  initialClass: string;
  groups: SubjectGroup[];
}) {
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [groups, setGroups] = useState(initialGroups);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setError(null);
    setSuccess(null);
    const { getEntriesByClass } = await import("./actions");
    const g = await getEntriesByClass(selectedClass);
    setGroups(g);
    setExpanded(new Set());
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    setError(null);
    setSuccess(null);
    const res = await deleteCurriculumEntryAction(id);
    if (res.error) setError(res.error);
    if (res.success) { setSuccess(res.success); load(); }
  }

  async function handleDeleteAll(subject: string) {
    if (!confirm(`Delete ALL "${subject}" entries for ${selectedClass}?`)) return;
    setError(null);
    setSuccess(null);
    const res = await deleteAllSubjectEntriesAction(selectedClass, subject);
    if (res.error) setError(res.error);
    if (res.success) { setSuccess(res.success); load(); }
  }

  function toggle(subject: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject); else next.add(subject);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-white">Browse Curriculum</h1>
        <p className="font-body-sm text-body-sm text-white/40 mt-1">
          View all NERDC curriculum entries by class. Expand a subject to see details and delete individual entries.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 bg-white/5 border border-white/10 rounded-xl p-5">
        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Class</label>
          <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); }}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm"
          >
            {classLevels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={load}
          className="bg-[#002046] hover:bg-[#003366] text-white px-4 py-2 rounded-lg text-sm"
        >Load</button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-900/20 text-red-400 border border-red-500/30">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg text-sm bg-emerald-900/20 text-emerald-400 border border-emerald-500/30">{success}</div>
      )}

      {groups.length === 0 && (
        <div className="text-center text-white/30 py-12 text-sm">
          No curriculum entries for {selectedClass}. Import or add entries first.
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/40 text-xs">{groups.reduce((s, g) => s + g.entries.length, 0)} entries across {groups.length} subject(s)</p>
          {groups.map((group) => {
            const isOpen = expanded.has(group.subject);
            return (
              <div key={group.subject} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggle(group.subject)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-white/40 text-[20px] transition-transform ${isOpen ? "rotate-90" : ""}`}>
                      chevron_right
                    </span>
                    <span className="font-label-md text-label-md text-white">{group.subject}</span>
                    <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{group.entries.length}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAll(group.subject); }}
                    className="text-xs text-red-400 hover:text-red-300 font-medium"
                  >Delete All</button>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10">
                    <table className="w-full text-left">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="py-2 px-5 text-xs text-white/40 uppercase w-20">Week</th>
                          <th className="py-2 px-5 text-xs text-white/40 uppercase w-20">Term</th>
                          <th className="py-2 px-5 text-xs text-white/40 uppercase">Topic</th>
                          <th className="py-2 px-5 text-xs text-white/40 uppercase">Sub-topics</th>
                          <th className="py-2 px-5 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {group.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 px-5 text-white font-semibold text-sm">Wk {weekLabel(entry.week, entry.weekSuffix)}</td>
                            <td className="py-2 px-5 text-white/60 text-sm">{entry.term}</td>
                            <td className="py-2 px-5 text-white text-sm">{entry.topic}</td>
                            <td className="py-2 px-5">
                              {entry.subTopics.length > 0 ? (
                                <ul className="list-disc list-inside text-xs text-white/60 space-y-0.5">
                                  {entry.subTopics.slice(0, 2).map((st, i) => <li key={i}>{st}{i === 1 && entry.subTopics.length > 2 ? ` +${entry.subTopics.length - 2} more` : ""}</li>)}
                                </ul>
                              ) : (
                                <span className="text-white/20 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2 px-5">
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
