"use client";

import { useActionState, useState, useMemo } from "react";
import { createAssignmentAction, type ActionState } from "./actions";

const init: ActionState = {};

export function AssignmentForm({
  staffId,
  classes,
  classSubjects,
  alreadyAssigned,
  sessions,
}: {
  staffId: string;
  classes: { id: string; name: string }[];
  classSubjects: { classId: string; subjectId: string; subjectName: string }[];
  alreadyAssigned: { subjectId: string; classId: string | null }[];
  sessions: { id: string; label: string; terms: { id: string; name: string }[] }[];
}) {
  const [state, action, pending] = useActionState(createAssignmentAction, init);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assignmentType, setAssignmentType] = useState("subject_teacher");

  const showSubject = assignmentType === "subject_teacher" || assignmentType === "hod";

  const availableSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    const assignedIds = new Set(
      alreadyAssigned
        .filter((a) => a.classId === selectedClassId)
        .map((a) => a.subjectId),
    );
    return classSubjects
      .filter((cs) => cs.classId === selectedClassId && !assignedIds.has(cs.subjectId))
      .map((cs) => ({ id: cs.subjectId, name: cs.subjectName }))
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  }, [selectedClassId, classSubjects, alreadyAssigned]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <input type="hidden" name="staffId" value={staffId} />

      <div>
        <label htmlFor="assignmentType" className="mb-1 block font-label-md text-label-md text-on-surface">Type</label>
        <select id="assignmentType" name="assignmentType" value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} required className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
          <option value="subject_teacher">Subject Teacher</option>
          <option value="class_teacher">Class Teacher</option>
          <option value="hod">HOD</option>
          <option value="exam_officer">Exam Officer</option>
          <option value="school_admin">School Admin</option>
          <option value="fee_status_manager">Fee Status Manager</option>
        </select>
      </div>

      <div>
        <label htmlFor="classId" className="mb-1 block font-label-md text-label-md text-on-surface">Class</label>
        <select id="classId" name="classId" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
          <option value="">— Select class —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {showSubject && (
        <div>
          <label htmlFor="subjectId" className="mb-1 block font-label-md text-label-md text-on-surface">Subject</label>
          <select id="subjectId" name="subjectId" className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
            <option value="">— None —</option>
            {availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
            }
          </select>
          {selectedClassId && availableSubjects.length === 0 && (
            <p className="mt-1 font-label-sm text-label-sm text-amber-600">All linked subjects already assigned for this class.</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="sessionId" className="mb-1 block font-label-md text-label-md text-on-surface">Session</label>
        <select id="sessionId" name="sessionId" className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
          <option value="">— Any —</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
        {pending ? "Adding…" : "Add"}
      </button>

      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
