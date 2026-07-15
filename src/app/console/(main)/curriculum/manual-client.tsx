"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createCurriculumEntryAction, updateCurriculumEntryAction, deleteCurriculumEntryAction } from "./actions";
import type { EntryVM } from "./actions";

const TERMS = ["FIRST", "SECOND", "THIRD"];

export function ManualCurriculumClient({
  subjectsByClass, classLevels, initialClass, initialTerm, initialSubject, initialEntries,
}: {
  subjectsByClass: Record<string, string[]>;
  classLevels: string[];
  initialClass: string;
  initialTerm: string;
  initialSubject: string;
  initialEntries: EntryVM[];
}) {
  const router = useRouter();
  const [classLevel, setClassLevel] = useState(initialClass);
  const [term, setTerm] = useState(initialTerm);
  const [subject, setSubject] = useState(initialSubject);
  const [entries, setEntries] = useState(initialEntries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [createState, createAction, createPending] = useActionState(createCurriculumEntryAction, {});
  const [updateState, updateAction, updatePending] = useActionState(updateCurriculumEntryAction, {});

  const subjects = subjectsByClass[classLevel] ?? [];

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await deleteCurriculumEntryAction(id);
    if (!res.error) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function refresh() {
    const p = new URLSearchParams();
    p.set("tab", "manual");
    p.set("class", classLevel);
    p.set("term", term);
    p.set("subject", subject);
    router.push(`/console/curriculum?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-white">Manual Curriculum Entry</h1>
          <p className="font-body-sm text-body-sm text-white/40 mt-1">
            Add, edit, or remove system-wide curriculum entries directly.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 bg-white/5 border border-white/10 rounded-xl p-5">
        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Class</label>
          <select value={classLevel} onChange={(e) => { setClassLevel(e.target.value); setSubject(subjectsByClass[e.target.value]?.[0] ?? ""); }}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm">
            {classLevels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Term</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm">
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Subject</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm">
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm"
          >Load</button>
          <button onClick={() => setShowAdd(true)}
            className="bg-[#002046] hover:bg-[#003366] text-white px-4 py-2 rounded-lg text-sm"
          >+ Add New</button>
        </div>
      </div>

      {/* Add new form */}
      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="font-label-sm text-label-sm text-white/60 uppercase tracking-wider mb-4">Add New Entry</h3>
          <form action={createAction} className="space-y-3" onSubmit={() => setTimeout(refresh, 500)}>
            <input type="hidden" name="classLevel" value={classLevel} />
            <input type="hidden" name="term" value={term} />
            <input type="hidden" name="subject" value={subject} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">Week</label>
                <input name="week" type="number" min={1} required
                  className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Suffix</label>
                <input name="weekSuffix" placeholder="A, B, C…"
                  className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/50 block mb-1">Topic</label>
                <input name="topic" required
                  className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Sub-topics (one per line)</label>
              <textarea name="subTopics" rows={3}
                className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Behavioural Objectives (one per line)</label>
              <textarea name="behaviouralObjectives" rows={3}
                className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
            </div>
            {createState.error && <p className="text-red-400 text-xs">{createState.error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={createPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >{createPending ? "Adding..." : "Add Entry"}</button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="text-white/50 hover:text-white text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Entries table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="py-3 px-4 text-xs text-white/40 uppercase w-16">Week</th>
              <th className="py-3 px-4 text-xs text-white/40 uppercase">Topic</th>
              <th className="py-3 px-4 text-xs text-white/40 uppercase">Sub-topics</th>
              <th className="py-3 px-4 text-xs text-white/40 uppercase">Objectives</th>
              <th className="py-3 px-4 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                {editingId === entry.id ? (
                  <td colSpan={5} className="p-4">
                    <EditForm
                      entry={entry}
                      onSaved={() => { setEditingId(null); refresh(); }}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                ) : (
                  <>
                    <td className="py-3 px-4 text-white font-semibold">Week {entry.week}{entry.weekSuffix || ""}</td>
                    <td className="py-3 px-4 text-white">{entry.topic}</td>
                    <td className="py-3 px-4">
                      {entry.subTopics.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-white/70 space-y-0.5">
                          {entry.subTopics.map((st, i) => <li key={i}>{st}</li>)}
                        </ul>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {entry.behaviouralObjectives.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-white/70 space-y-0.5">
                          {entry.behaviouralObjectives.map((o, i) => <li key={i}>{o}</li>)}
                        </ul>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(entry.id)}
                          className="text-xs text-white/50 hover:text-white">Edit</button>
                        <button onClick={() => handleDelete(entry.id)}
                          className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-white/30">
                  No entries. Use <strong>+ Add New</strong> to create one, or switch to the Import tab to parse from NERDC.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditForm({ entry, onSaved, onCancel }: {
  entry: EntryVM; onSaved: () => void; onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: any, fd: FormData) => {
    const r = await updateCurriculumEntryAction(prev, fd);
    if (r.success) onSaved();
    return r;
  }, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={entry.id} />
      <div>
        <label className="text-xs text-white/50 block mb-1">Topic</label>
        <input name="topic" defaultValue={entry.topic} required
          className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
      </div>
      <div>
        <label className="text-xs text-white/50 block mb-1">Sub-topics (one per line)</label>
        <textarea name="subTopics" rows={3} defaultValue={entry.subTopics.join("\n")}
          className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
      </div>
      <div>
        <label className="text-xs text-white/50 block mb-1">Behavioural Objectives (one per line)</label>
        <textarea name="behaviouralObjectives" rows={3} defaultValue={entry.behaviouralObjectives.join("\n")}
          className="w-full border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white text-sm" />
      </div>
      {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
        >{pending ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onCancel}
          className="text-white/50 hover:text-white text-sm">Cancel</button>
      </div>
    </form>
  );
}
