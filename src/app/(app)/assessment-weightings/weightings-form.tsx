"use client";

import { useActionState, useState } from "react";
import { upsertWeightingAction, deleteWeightingAction, type ActionState } from "./actions";

const init: ActionState = {};

export function WeightingsForm({
  schoolId,
  subjects,
  weightings,
  assessmentTypes,
}: {
  schoolId: string;
  subjects: { id: string; name: string }[];
  weightings: { subjectId: string | null; assessmentTypeId: string; weightPercentage: number }[];
  assessmentTypes: string[];
}) {
  const [state, action, pending] = useActionState(upsertWeightingAction, init);
  const [mode, setMode] = useState<"default" | "per-subject">("default");
  const [newType, setNewType] = useState("");

  const defaults = weightings.filter((w) => w.subjectId === null);
  const perSubject = weightings.filter((w) => w.subjectId !== null);
  const grouped = perSubject.reduce<Record<string, typeof perSubject>>((acc, w) => {
    (acc[w.subjectId!] ??= []).push(w);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setMode("default")}
          className={`rounded-full px-3 py-1 ${
            mode === "default" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          School-wide defaults
        </button>
        <button
          onClick={() => setMode("per-subject")}
          className={`rounded-full px-3 py-1 ${
            mode === "per-subject" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          Per subject
        </button>
      </div>

      {/* Defaults */}
      {mode === "default" && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
          <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface font-semibold">School-wide defaults</h2>
          {defaults.length === 0 && (
            <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">No defaults set. Add one below.</p>
          )}
          <div className="mb-6 space-y-2">
            {defaults.map((d) => (
              <WeightRow
                key={d.assessmentTypeId}
                subjectId={null}
                assessmentTypeId={d.assessmentTypeId}
                weightPercentage={d.weightPercentage}
                schoolId={schoolId}
              />
            ))}
          </div>

          <form action={action} className="flex items-end gap-3 border-t border-outline-variant pt-4">
            <input type="hidden" name="subjectId" value="" />
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Assessment type</label>
              <input
                name="assessmentTypeId"
                placeholder="e.g. CA1"
                required
                className="w-32 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Weight %</label>
              <input
                name="weightPercentage"
                type="number"
                min={1}
                max={100}
                required
                className="w-20 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded disabled:opacity-60"
            >
              Add default
            </button>
          </form>
        </div>
      )}

      {/* Per-subject */}
      {mode === "per-subject" && (
        <div className="space-y-4">
          {subjects.map((subj) => {
            const rows = grouped[subj.id] ?? [];
            return (
              <div key={subj.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
                <h3 className="mb-3 font-headline-sm text-headline-sm text-on-surface font-semibold">{subj.name}</h3>
                {rows.length === 0 && (
                  <p className="mb-3 font-label-sm text-label-sm text-on-surface-variant">Using school-wide defaults.</p>
                )}
                <div className="mb-4 space-y-2">
                  {rows.map((r) => (
                    <WeightRow
                      key={r.assessmentTypeId}
                      subjectId={subj.id}
                      assessmentTypeId={r.assessmentTypeId}
                      weightPercentage={r.weightPercentage}
                      schoolId={schoolId}
                    />
                  ))}
                </div>
                <form action={action} className="flex items-end gap-3 border-t border-outline-variant pt-3">
                  <input type="hidden" name="subjectId" value={subj.id} />
                  <div>
                    <input
                      name="assessmentTypeId"
                      placeholder="Type (e.g. CA1)"
                      required
                      className="w-28 rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div>
                    <input
                      name="weightPercentage"
                      type="number"
                      min={1}
                      max={100}
                      required
                      className="w-16 rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-primary px-3 py-1 font-label-sm text-label-sm text-on-primary disabled:opacity-60"
                  >
                    Add
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </div>
  );
}

function WeightRow({
  subjectId,
  assessmentTypeId,
  weightPercentage,
  schoolId,
}: {
  subjectId: string | null;
  assessmentTypeId: string;
  weightPercentage: number;
  schoolId: string;
}) {
  return (
    <div className="flex items-center justify-between rounded bg-surface-container-low px-3 py-2 font-body-sm text-body-sm">
      <span className="font-label-md text-label-md text-on-surface">{assessmentTypeId}</span>
      <div className="flex items-center gap-4">
        <span className="text-on-surface-variant">{weightPercentage}%</span>
        <form
          action={async () => {
            await deleteWeightingAction(schoolId, subjectId, assessmentTypeId);
          }}
        >
          <button
            type="submit"
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600"
          >
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}
