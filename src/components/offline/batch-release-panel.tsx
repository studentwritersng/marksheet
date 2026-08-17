"use client";

import { useState } from "react";
import { batchReleaseExamsToHub, type OfflineActionResult } from "@/lib/offline/actions";

type HubRow = { id: string; name: string };
type ExamRow = {
  id: string;
  subjectName: string;
  classNames: string;
  termLabel: string;
  questionCount: number;
  studentCount: number;
};

export function BatchReleasePanel({ hubs, exams }: { hubs: HubRow[]; exams: ExamRow[] }) {
  const [hubId, setHubId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<OfflineActionResult>({});

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === exams.length ? new Set() : new Set(exams.map((e) => e.id))));
  }

  async function submit() {
    if (!hubId || selected.size === 0) return;
    setPending(true);
    const res = await batchReleaseExamsToHub(hubId, [...selected]);
    setState(res);
    setPending(false);
    const releasedCount = res.data?.released?.length ?? 0;
    const skippedCount = res.data?.skipped?.length ?? 0;
    if (releasedCount > 0 && skippedCount === 0) {
      setSelected(new Set());
    }
  }

  const canSubmit = hubId !== "" && selected.size > 0 && !pending;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <h2 className="font-label-lg text-label-lg text-on-surface font-semibold mb-1">Batch release exams</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Release several exams to one hub in a single action. Only published, unreleased exams with questions and enrolled students are listed.
      </p>

      {hubs.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          <a href="/offline-hubs" className="text-primary underline">Register a hub</a> to release exams offline.
        </p>
      ) : exams.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No eligible exams to release.</p>
      ) : (
        <>
          <select
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface mb-3"
          >
            <option value="">Select hub…</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-on-surface mb-2">
            <input type="checkbox" checked={selected.size === exams.length} onChange={toggleAll} className="accent-[#002046]" />
            Select all
          </label>

          <div className="max-h-64 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant">
            {exams.map((e) => (
              <label key={e.id} className="flex items-start gap-3 p-3 cursor-pointer">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="mt-1 accent-[#002046]" />
                <span className="text-sm">
                  <span className="font-medium text-on-surface block">{e.subjectName}</span>
                  <span className="text-on-surface-variant text-xs">
                    {e.classNames} · {e.termLabel} · {e.questionCount} questions · {e.studentCount} students
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="mt-3 rounded-lg bg-primary hover:bg-primary-container text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {pending ? "Releasing…" : `Release ${selected.size} exam${selected.size === 1 ? "" : "s"} to hub`}
          </button>

          {state.error && <p className="mt-2 text-red-600 text-xs">{state.error}</p>}
          {state.success && <p className="mt-2 text-emerald-600 text-xs">{state.success}</p>}
          {state.data?.released && state.data.released.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {state.data.released.map((r) => (
                <li key={r.examId} className="text-emerald-600">Released {r.title}</li>
              ))}
            </ul>
          )}
          {state.data?.skipped && state.data.skipped.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {state.data.skipped.map((s) => (
                <li key={s.examId} className="text-amber-600">Skipped {s.title}: {s.reason}</li>
              ))}
            </ul>
          )}
          {state.data?.failed && state.data.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {state.data.failed.map((f) => (
                <li key={f.examId} className="text-red-600">Failed {f.title}: {f.reason}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}