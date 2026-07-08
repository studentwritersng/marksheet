"use client";

import { useActionState, useState } from "react";
import { createAssessmentTypeAction, upsertWeightingAction } from "./actions";
import type { ActionState } from "./actions";

export function WeightingsPage({
  schoolId,
  subjects,
  weightings,
  assessmentTypes,
}: {
  schoolId: string;
  subjects: { id: string; name: string }[];
  weightings: { id: string; subjectId: string | null; assessmentTypeId: string; weightPercentage: number }[];
  assessmentTypes: { id: string; name: string; code: string; sortOrder: number }[];
}) {
  const [tab, setTab] = useState<"types" | "weights">("types");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
        <button onClick={() => setTab("types")}
          className={`px-4 py-2 rounded-md font-label-md text-label-md ${tab === "types" ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant"}`}
        >Assessment Types</button>
        <button onClick={() => setTab("weights")}
          className={`px-4 py-2 rounded-md font-label-md text-label-md ${tab === "weights" ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant"}`}
        >Weightings</button>
      </div>

      {tab === "types" && (
        <AssessmentTypesSection types={assessmentTypes} />
      )}

      {tab === "weights" && (
        <WeightingsSection
          schoolId={schoolId}
          subjects={subjects}
          weightings={weightings}
          assessmentTypes={assessmentTypes}
        />
      )}
    </div>
  );
}

function AssessmentTypesSection({ types }: { types: { id: string; name: string; code: string; sortOrder: number; parentId?: string | null; children?: { id: string; name: string; code: string; sortOrder: number }[] }[] }) {
  const [state, action, pending] = useActionState(createAssessmentTypeAction, {});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const parents = types.filter((t) => !t.parentId);
  const children = types.filter((t) => t.parentId);
  const childMap = new Map<string, typeof children>();
  for (const c of children) {
    const arr = childMap.get(c.parentId!) ?? [];
    arr.push(c);
    childMap.set(c.parentId!, arr);
  }

  return (
    <div className="bg-white border border-outline-variant rounded-xl p-6">
      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">Assessment Types</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
        Define assessment types with a full name and a short code (e.g. "Mid Term Test" / "MDT"). Add sub-assessments for exams with multiple papers (e.g. MCQ, Essay, Practical).
      </p>

      {types.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">No assessment types defined yet.</p>
      )}

      <div className="space-y-2 mb-6">
        {parents.map((t) => (
          <div key={t.id}>
            <div className="flex items-center justify-between bg-surface-container-low rounded-lg px-4 py-3">
              {editingId === t.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="border border-outline-variant rounded px-2 py-1 font-body-md text-body-md w-40" />
                  <input value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="border border-outline-variant rounded px-2 py-1 font-body-md text-body-md w-20" />
                  <button onClick={async () => {
                    const { updateAssessmentTypeAction } = await import("./actions");
                    await updateAssessmentTypeAction(t.id, editName, editCode);
                    setEditingId(null);
                  }} className="text-primary font-label-sm text-label-sm">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-on-surface-variant font-label-sm text-label-sm">Cancel</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-label-md text-label-md text-on-surface">{t.name}</span>
                    <span className="font-label-sm text-label-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{t.code}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Order: {t.sortOrder}</span>
                    <span className="font-label-sm text-label-sm bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded">Parent</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(t.id); setEditName(t.name); setEditCode(t.code); }}
                      className="font-label-sm text-label-sm text-primary hover:underline">Edit</button>
                    <button onClick={() => setEditingId(`sub-${t.id}`)}
                      className="font-label-sm text-label-sm text-primary hover:underline">+ Sub</button>
                    <form action={async () => {
                      const { deleteAssessmentTypeAction } = await import("./actions");
                      await deleteAssessmentTypeAction(t.id);
                    }}>
                      <button type="submit" className="font-label-sm text-label-sm text-red-600 hover:underline">Delete</button>
                    </form>
                  </div>
                </>
              )}
            </div>
            {/* Sub-assessment inline create */}
            {editingId === `sub-${t.id}` && (
              <SubAssessmentForm parentId={t.id} parentCode={t.code} onClose={() => setEditingId(null)} />
            )}
            {/* Children list */}
            {(childMap.get(t.id) ?? []).map((child) => (
              <div key={child.id} className="flex items-center justify-between bg-surface-container-low rounded-lg px-4 py-2.5 ml-6 mt-1 border-l-2 border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">subdirectory_arrow_right</span>
                  <span className="font-label-md text-label-md text-on-surface">{child.name}</span>
                  <span className="font-label-sm text-label-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{child.code}</span>
                </div>
                <div className="flex gap-2">
                  <form action={async () => {
                    const { deleteAssessmentTypeAction } = await import("./actions");
                    await deleteAssessmentTypeAction(child.id);
                  }}>
                    <button type="submit" className="font-label-sm text-label-sm text-red-600 hover:underline">Remove</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <form action={action} className="flex items-end gap-3 border-t border-outline-variant pt-4">
        <input type="hidden" name="parentId" value="" />
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Name</label>
          <input name="name" placeholder="e.g. Mid Term Test" required
            className="border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md w-48" />
        </div>
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Code</label>
          <input name="code" placeholder="e.g. MDT" required
            className="border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md w-24 uppercase" />
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

function SubAssessmentForm({ parentId, parentCode, onClose }: { parentId: string; parentCode: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(createAssessmentTypeAction, {});
  return (
    <form action={action} className="flex items-end gap-2 ml-6 mt-1 p-3 bg-surface-container-low rounded-lg border border-outline-variant">
      <input type="hidden" name="parentId" value={parentId} />
      <div>
        <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Sub-assessment name</label>
        <input name="name" placeholder="e.g. MCQ Paper" required
          className="border border-outline-variant rounded p-2 font-body-md text-body-md w-36 text-sm" />
      </div>
      <div>
        <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Code</label>
        <input name="code" placeholder={`${parentCode}-MCQ`} required
          className="border border-outline-variant rounded p-2 font-body-md text-body-md w-24 text-sm uppercase" />
      </div>
      <button type="submit" disabled={pending}
        className="bg-[#002046] text-white text-sm px-3 py-2 rounded hover:bg-[#003366] disabled:opacity-60"
      >{pending ? "..." : "Add"}</button>
      <button type="button" onClick={onClose}
        className="text-sm text-on-surface-variant px-2 py-2">Cancel</button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function WeightingsSection({
  schoolId, subjects, weightings, assessmentTypes,
}: {
  schoolId: string;
  subjects: { id: string; name: string }[];
  weightings: { id: string; subjectId: string | null; assessmentTypeId: string; weightPercentage: number }[];
  assessmentTypes: { id: string; name: string; code: string; sortOrder: number }[];
}) {
  const [state, action, pending] = useActionState(upsertWeightingAction, {});
  const [mode, setMode] = useState<"default" | "per-subject">("default");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("");

  const defaultWeightings = weightings.filter((w) => w.subjectId === null);
  const perSubject = weightings.filter((w) => w.subjectId !== null);
  const grouped = perSubject.reduce<Record<string, typeof perSubject>>((acc, w) => {
    (acc[w.subjectId!] ??= []).push(w);
    return acc;
  }, {});

  const codeToName = Object.fromEntries(assessmentTypes.map((t) => [t.code, t.name]));

  if (assessmentTypes.length === 0) {
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
          {defaultWeightings.length === 0 && <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">No defaults set.</p>}
          <div className="mb-6 space-y-2">
            {defaultWeightings.map((d) => (
              <WeightRow key={d.id} id={d.id} schoolId={schoolId} subjectId={null}
                assessmentTypeId={d.assessmentTypeId} weightPercentage={d.weightPercentage}
                codeToName={codeToName}
                editingId={editingId} setEditingId={setEditingId}
                editPct={editPct} setEditPct={setEditPct}
              />
            ))}
          </div>
          <form action={action} className="flex items-end gap-3 border-t border-outline-variant pt-4">
            <input type="hidden" name="subjectId" value="" />
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Type</label>
              <select name="assessmentTypeId" required
                className="border border-outline-variant rounded p-2.5 font-body-md text-body-md"
              >
                <option value="">Select…</option>
                {assessmentTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Weight %</label>
              <input name="weightPercentage" type="number" min={1} max={100} required placeholder="%"
                className="border border-outline-variant rounded p-2.5 w-20 font-body-md text-body-md"
              />
            </div>
            <button type="submit" disabled={pending}
              className="bg-[#002046] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg hover:bg-[#003366] disabled:opacity-60"
            >Add</button>
          </form>
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
                    <WeightRow key={r.id} id={r.id} schoolId={schoolId} subjectId={subj.id}
                      assessmentTypeId={r.assessmentTypeId} weightPercentage={r.weightPercentage}
                      codeToName={codeToName}
                      editingId={editingId} setEditingId={setEditingId}
                      editPct={editPct} setEditPct={setEditPct}
                    />
                  ))}
                </div>
                <form action={action} className="flex items-end gap-3 border-t border-outline-variant pt-3">
                  <input type="hidden" name="subjectId" value={subj.id} />
                  <div>
                    <select name="assessmentTypeId" required
                      className="rounded border border-outline-variant p-2 text-sm font-body-md text-body-md"
                    >
                      <option value="">Select…</option>
                      {assessmentTypes.map((t) => (
                        <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input name="weightPercentage" type="number" min={1} max={100} required placeholder="%"
                      className="rounded border border-outline-variant p-2 w-16 font-body-sm text-body-sm"
                    />
                  </div>
                  <button type="submit" disabled={pending}
                    className="bg-[#002046] text-white rounded hover:bg-[#003366] disabled:opacity-60 px-3 py-2 text-sm font-label-md text-label-md"
                  >Add</button>
                </form>
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

function WeightRow({ id, schoolId, subjectId, assessmentTypeId, weightPercentage, codeToName, editingId, setEditingId, editPct, setEditPct }: {
  id: string;
  schoolId: string; subjectId: string | null; assessmentTypeId: string; weightPercentage: number;
  codeToName: Record<string, string>;
  editingId: string | null; setEditingId: (id: string | null) => void;
  editPct: string; setEditPct: (v: string) => void;
}) {
  const [deleteState, setDeleteState] = useState<ActionState>({});
  const [editState, setEditState] = useState<ActionState>({});
  const displayName = codeToName[assessmentTypeId] || assessmentTypeId;

  if (editingId === id) {
    return (
      <div className="flex items-center justify-between rounded bg-surface-container-low px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-label-md text-label-md text-on-surface">{displayName}</span>
          <span className="font-label-sm text-label-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded">{assessmentTypeId}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={editPct} onChange={(e) => setEditPct(e.target.value)}
            min={1} max={100} className="w-16 rounded border border-outline-variant p-1 text-sm text-center" />
          <button onClick={async () => {
            const { upsertWeightingAction } = await import("./actions");
            const form = new FormData();
            form.set("subjectId", subjectId ?? "");
            form.set("assessmentTypeId", assessmentTypeId);
            form.set("weightPercentage", editPct);
            const res = await upsertWeightingAction({}, form);
            setEditState(res);
            if (!res.error) setEditingId(null);
          }} className="text-sm text-primary font-label-sm">Save</button>
          <button onClick={() => setEditingId(null)} className="text-sm text-on-surface-variant font-label-sm">Cancel</button>
          {editState.error && <span className="text-xs text-red-600">{editState.error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded bg-surface-container-low px-3 py-2 font-body-sm text-body-sm">
      <div className="flex items-center gap-2">
        <span className="font-label-md text-label-md text-on-surface">{displayName}</span>
        <span className="font-label-sm text-label-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded">{assessmentTypeId}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-on-surface-variant">{weightPercentage}%</span>
        <button onClick={() => { setEditingId(id); setEditPct(String(weightPercentage)); }}
          className="font-label-sm text-label-sm text-primary hover:underline">Edit</button>
        <form action={async () => {
          const { deleteWeightingAction } = await import("./actions");
          const res = await deleteWeightingAction(schoolId, subjectId, assessmentTypeId);
          setDeleteState(res);
        }}>
          <button type="submit" className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600">Remove</button>
        </form>
      </div>
    </div>
  );
}
