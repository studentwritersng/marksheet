"use client";

import { useState, useTransition } from "react";
import { promoteStudentsAction, type ActionState } from "./actions";

interface ClassVM {
  id: string;
  name: string;
  level: string;
  sessionId: string;
  students: { id: string; admissionNumber: string; firstName: string; lastName: string }[];
}

export function PromotionForm({
  classes,
}: {
  classes: ClassVM[];
}) {
  const [sourceId, setSourceId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destId, setDestId] = useState("withdraw");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});

  const source = classes.find((c) => c.id === sourceId);
  const destOptions = classes.filter((c) => c.id !== sourceId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!source) return;
    setSelected(
      selected.size === source.students.length
        ? new Set()
        : new Set(source.students.map((s) => s.id)),
    );
  }

  async function handleSubmit() {
    const fd = new FormData();
    fd.set("sourceClassId", sourceId);
    fd.set("destClassId", destId === "withdraw" ? "" : destId);
    fd.set("studentIds", Array.from(selected).join(","));
    start(async () => setResult(await promoteStudentsAction(fd)));
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Source class */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
        <label className="font-label-md text-label-md text-on-surface">
          Source class
        </label>
        <select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            setSelected(new Set());
            setResult({});
          }}
          className="mt-1 block w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        >
          <option value="">Select source class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length} students)
            </option>
          ))}
        </select>
      </div>

      {source && (
        <>
          {/* Step 2: Select students */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
            <div className="flex items-center justify-between">
              <p className="font-label-md text-label-md text-on-surface">
                Students in {source.name}
              </p>
              <button
                onClick={selectAll}
                className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
              >
                {selected.size === source.students.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>
            <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
              {selected.size} of {source.students.length} selected. Unselected
              students stay in {source.name} (repeat).
            </p>
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {source.students.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface-container-low"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded border-outline-variant text-on-surface"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface">
                    {s.firstName} {s.lastName}{" "}
                     <span className="text-on-surface-variant">({s.admissionNumber})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 3: Destination */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
            <label className="font-label-md text-label-md text-on-surface">
              Destination
            </label>
            <select
              value={destId}
              onChange={(e) => {
                setDestId(e.target.value);
                setResult({});
              }}
          className="mt-1 block w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            >
              <option value="withdraw">Withdraw (leave school)</option>
              {destOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending || selected.size === 0}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {pending
              ? "Promoting…"
              : `Promote ${selected.size} student(s)` +
                (destId === "withdraw" ? " (withdraw)" : "")}
          </button>

          {result.error && (
            <p className="text-sm text-red-600">{result.error}</p>
          )}
          {result.success && (
            <p className="text-sm text-green-600">{result.success}</p>
          )}
        </>
      )}
    </div>
  );
}
