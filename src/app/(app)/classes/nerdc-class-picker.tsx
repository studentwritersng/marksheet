"use client";

import { useState, useEffect, useActionState } from "react";
import { getNerdcLevelsAction, bulkCreateClassesAction, type ActionState } from "./actions";

const init: ActionState = {};

export function NerdcClassPicker({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [allLevels, setAllLevels] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(bulkCreateClassesAction, init);

  useEffect(() => {
    if (open && allLevels.length === 0) {
      getNerdcLevelsAction().then(setAllLevels);
    }
  }, [open, allLevels.length]);

  function toggle(level: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function handleSubmit(fd: FormData) {
    fd.set("levels", JSON.stringify([...selected]));
    fd.set("sessionId", sessionId);
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
        Create from NERDC
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Create Classes from NERDC</h2>
              <button onClick={() => { setOpen(false); setSelected(new Set()); }}
                className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-2 space-y-1">
              {allLevels.map((level) => (
                <label
                  key={level}
                  className="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container-low cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(level)}
                    onChange={() => toggle(level)}
                    className="rounded border-outline-variant text-primary"
                  />
                  <span className="font-body-md text-body-md text-on-surface">{level}</span>
                </label>
              ))}
              {allLevels.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">No class levels found.</p>
              )}
            </div>

            <form action={handleSubmit} className="p-4 border-t border-outline-variant flex items-center gap-3">
              <button
                type="submit"
                disabled={pending || selected.size === 0}
                className="bg-primary text-on-primary font-label-md text-label-md py-2 px-6 rounded hover:bg-primary-container disabled:opacity-60"
              >
                {pending ? "Creating..." : `Create ${selected.size} class level(s)`}
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
