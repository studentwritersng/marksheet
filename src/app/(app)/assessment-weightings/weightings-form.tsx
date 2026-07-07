"use client";

import { useActionState, useState, useTransition } from "react";
import {
  upsertWeightingAction, deleteWeightingAction,
  createAssessmentTypeAction, deleteAssessmentTypeAction, renameAssessmentTypeAction,
  type ActionState,
} from "./actions";

export function WeightingsPage({
  schoolId,
  subjects,
  weightings,
  assessmentTypes,
}: {
  schoolId: string;
  subjects: { id: string; name: string }[];
  weightings: { subjectId: string | null; assessmentTypeId: string; weightPercentage: number }[];
  assessmentTypes: { id: string; name: string; sortOrder: number }[];
}) {
  const [tab, setTab] = useState<"types" | "weights">("types");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
        <button onClick={() => setTab("types")}
          className={`px-4 py-2 rounded-md font-label-md text-label-md ${tab === "types" ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant"}`}
        >Assessment Types</button>
        <button onClick={() => setTab("weights")}
          className={`px-4 py-2 rounded-md font-label-md text-label-md ${tab === "weights" ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant"}`}
        >Weightings</button>
      </div>

      {/* Assessment Types Tab */}
      {tab === "types" && (
        <AssessmentTypesSection types={assessmentTypes} />
      )}

      {/* Weightings Tab */}
      {tab === "weights" && (
        <WeightingsSection
          schoolId={schoolId}
          subjects={subjects}
          weightings={weightings}
          assessmentTypeNames={assessmentTypes.map((t) => t.name)}
        />
      )}
    </div>
  );
}

function AssessmentTypesSection({ types }: { types: { id: string; name: string; sortOrder: number }[] }) {
  const [state, action, pending] = useActionState(createAssessmentTypeAction, {});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  return (
    <div className="bg-white border border-outline-variant rounded-xl p-6">
      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">Assessment Types</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
        Define the assessment types for your school (e.g. CA1, CA2, CA3, Exam, Project, etc.). These will be available when setting weightings.
      </p>

      {types.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">No assessment types defined yet.</p>
      )}

      <div className="space-y-2 mb-6">
        {types.map((t) => (
          <div key={t.id} className="flex items-center justify-between bg-surface-container-low rounded-lg px-4 py-3">
            {editingId === t.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                  className="border border-outline-variant rounded px-2 py-1 font-body-md text-body-md flex-1" />
                <button onClick={async () => {
                  await renameAssessmentTypeAction(t.id, renameVal);
                  setEditingId(null);
                }} className="text-primary font-label-sm text-label-sm">Save</button>
                <button onClick={() => setEditingId(null)} className="text-on-surface-variant font-label-sm text-label-sm">Cancel</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-label-md text-label-md text-on-surface">{t.name}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Order: {t.sortOrder}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(t.id); setRenameVal(t.name); }}
                    className="font-label-sm text-label-sm text-primary hover:underline">Rename</button>
                  <form action={async () => { await deleteAssessmentTypeAction(t.id); }}>
                    <button type="submit" className="font-label-sm text-label-sm text-red-600 hover:underline">Delete</button>
                  </form>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <form action={action} className="flex items-end gap-3 border-t border-outline-variant pt-4">
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">New type name</label>
          <input name="name" placeholder="e.g. CA1" required
            className="border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md" />
        </div>
        <button type="submit" disabled={pending}
          className="bg-[#002046] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg hover:bg-[#003366] disabled:opacity-60"
        >Add Type</button>
      </form>
      {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600 mt-2">{state.success}</p>}
    </div>
  );
}

function WeightingsSection({
  schoolId, subjects, weightings, assessmentTypeNames,
}: {
  schoolId: string;
  subjects: { id: string; name: string }[];
  weightings: { subjectId: string | null; assessmentTypeId: string; weightPercentage: number }[];
  assessmentTypeNames: string[];
}) {
  const [state, action, pending] = useActionState(upsertWeightingAction, {});
  const [mode, setMode] = useState<"default" | "per-subject">("default");

  const defaults = weightings.filter((w) => w.subjectId === null);
  const perSubject = weightings.filter((w) => w.subjectId !== null);
  const grouped = perSubject.reduce<Record<string, typeof perSubject>>((acc, w) => {
    (acc[w.subjectId!] ??= []).push(w);
    return acc;
  }, {});

  if (assessmentTypeNames.length === 0) {
    return (
      <div className="bg-white border border-outline-variant rounded-xl p-6">
        <p className="font-body-md text-body-md text-on-surface-variant">No assessment types defined. Go to the <strong>Assessment Types</strong> tab to create some first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode("default")}
          className={`rounded-full px-3 py-1 text-sm ${mode === "default" ? "bg-[#002046] text-white" : "bg-surface-container text-on-surface-variant"}`}
        >School-wide defaults</button>
        <button onClick={() => setMode("per-subject")}
          className={`rounded-full px-3 py-1 text-sm ${mode === "per-subject" ? "bg-[#002046] text-white" : "bg-surface-container text-on-surface-variant"}`}
        >Per subject</button>
      </div>

      {mode === "default" && (
        <div className="bg-white border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-4">School-wide defaults</h3>
          {defaults.length === 0 && <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">No defaults set.</p>}
          <div className="mb-6 space-y-2">
            {defaults.map((d) => (
              <WeightRow key={d.assessmentTypeId} schoolId={schoolId} subjectId={null}
                assessmentTypeId={d.assessmentTypeId} weightPercentage={d.weightPercentage} />
            ))}
          </div>
          <WeightForm action={action} pending={pending} subjectId="" types={assessmentTypeNames} />
        </div>
      )}

      {mode === "per-subject" && (
        <div className="space-y-4">
          {subjects.map((subj) => {
            const rows = grouped[subj.id] ?? [];
            return (
              <div key={subj.id} className="bg-white border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-3">{subj.name}</h3>
                {rows.length === 0 && <p className="mb-3 font-body-sm text-body-sm text-on-surface-variant">Using school-wide defaults.</p>}
                <div className="mb-4 space-y-2">
                  {rows.map((r) => (
                    <WeightRow key={r.assessmentTypeId} schoolId={schoolId} subjectId={subj.id}
                      assessmentTypeId={r.assessmentTypeId} weightPercentage={r.weightPercentage} />
                  ))}
                </div>
                <WeightForm action={action} pending={pending} subjectId={subj.id} types={assessmentTypeNames} compact />
              </div>
            );
          })}
        </div>
      )}

      {state.error && <p className="text-sm text-red-600 mt-4">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600 mt-4">{state.success}</p>}
    </div>
  );
}

function WeightForm({ action, pending, subjectId, types, compact }: {
  action: (fd: FormData) => void; pending: boolean;
  subjectId: string; types: string[]; compact?: boolean;
}) {
  return (
    <form action={action} className={`flex items-end gap-3 border-t border-outline-variant ${compact ? "pt-3" : "pt-4"}`}>
      <input type="hidden" name="subjectId" value={subjectId} />
      <div>
        {!compact && <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Type</label>}
        <select name="assessmentTypeId" required
          className={`border border-outline-variant rounded ${compact ? "p-2 text-sm" : "p-2.5"} font-body-md text-body-md`}
        >
          <option value="">Select…</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        {!compact && <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Weight %</label>}
        <input name="weightPercentage" type="number" min={1} max={100} required placeholder="%"
          className={`border border-outline-variant rounded ${compact ? "p-2 w-16" : "p-2.5 w-20"} font-body-md text-body-md`}
        />
      </div>
      <button type="submit" disabled={pending}
        className={`bg-[#002046] text-white rounded hover:bg-[#003366] disabled:opacity-60 ${compact ? "px-3 py-2 text-sm" : "px-4 py-2.5"} font-label-md text-label-md`}
      >Add</button>
    </form>
  );
}

function WeightRow({ schoolId, subjectId, assessmentTypeId, weightPercentage }: {
  schoolId: string; subjectId: string | null; assessmentTypeId: string; weightPercentage: number;
}) {
  return (
    <div className="flex items-center justify-between rounded bg-surface-container-low px-3 py-2 font-body-sm text-body-sm">
      <span className="font-label-md text-label-md text-on-surface">{assessmentTypeId}</span>
      <div className="flex items-center gap-4">
        <span className="text-on-surface-variant">{weightPercentage}%</span>
        <form action={async () => { await deleteWeightingAction(schoolId, subjectId, assessmentTypeId); }}>
          <button type="submit" className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600">Remove</button>
        </form>
      </div>
    </div>
  );
}
