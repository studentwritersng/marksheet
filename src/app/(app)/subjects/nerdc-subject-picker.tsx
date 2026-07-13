"use client";

import { useState, useEffect, useActionState } from "react";
import { getNerdcSubjectsAction, bulkCreateSubjectsAction, type ActionState } from "./actions";

const init: ActionState = {};

export function NerdcSubjectPicker() {
  const [open, setOpen] = useState(false);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [state, action, pending] = useActionState(bulkCreateSubjectsAction, init);

  useEffect(() => {
    if (open && allSubjects.length === 0) {
      getNerdcSubjectsAction().then(setAllSubjects);
    }
  }, [open, allSubjects.length]);

  const filtered = allSubjects.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(subject: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function handleSubmit(fd: FormData) {
    fd.set("subjectNames", JSON.stringify([...selected]));
    action(fd);
    if (!state.error) {
      setOpen(false);
      setSelected(new Set());
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-outline-variant rounded p-3 font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
      >
        Import from NERDC
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Import Subjects from NERDC</h2>
              <button onClick={() => { setOpen(false); setSelected(new Set()); }}
                className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 border-b border-outline-variant">
              <input
                type="text"
                placeholder="Search subjects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-outline-variant rounded p-2 font-body-md text-body-md"
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant">
              <button onClick={selectAll} className="text-sm text-primary hover:underline">Select All</button>
              <button onClick={deselectAll} className="text-sm text-on-surface-variant hover:underline">Deselect All</button>
              <span className="text-sm text-on-surface-variant ml-auto">{selected.size} selected</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filtered.map((subject) => (
                <label
                  key={subject}
                  className="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container-low cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(subject)}
                    onChange={() => toggle(subject)}
                    className="rounded border-outline-variant text-primary"
                  />
                  <span className="font-body-md text-body-md text-on-surface">{subject}</span>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">No subjects found.</p>
              )}
            </div>

            <form action={handleSubmit} className="p-4 border-t border-outline-variant flex items-center gap-3">
              <button
                type="submit"
                disabled={pending || selected.size === 0}
                className="bg-primary text-on-primary font-label-md text-label-md py-2 px-6 rounded hover:bg-primary-container disabled:opacity-60"
              >
                {pending ? "Importing..." : `Import ${selected.size} subject(s)`}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setSelected(new Set()); }}
                className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
              >
                Cancel
              </button>
              {state.error && <p className="text-sm text-red-600">{state.error}</p>}
              {state.success && <p className="text-sm text-green-600">{state.success}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
