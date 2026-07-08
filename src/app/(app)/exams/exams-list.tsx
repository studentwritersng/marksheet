"use client";

import { useState, useActionState } from "react";
import {
  createExamAction, updateExamAction, deleteExamAction,
  addQuestionsToExamAction, removeQuestionFromExamAction,
} from "@/lib/exams/actions";
import type { ActionState } from "@/lib/exams/actions";

interface ExamVM {
  id: string; subjectName: string; className: string; classNames: string;
  termName: string; assessmentTypeId: string; durationMinutes: number;
  questionCount: number; attemptCount: number; submittedCount: number;
  questionIds: string[];
}
interface SubjectVM { id: string; name: string }
interface ClassVM { id: string; name: string; level: string; department: string }
interface TermVM { id: string; name: string }
interface QuestionVM { id: string; text: string; type: string; marks: number; mcqOptions: { id: string; optionText: string; isCorrect: boolean }[] }
interface AssessmentTypeVM { id: string; name: string; code: string; defaultWeight: number | null; children: { id: string; name: string; code: string }[] }
interface WeightingVM { assessmentTypeId: string; weightPercentage: number; subjectId: string | null }

export function ExamsList({
  exams, subjects, classes, terms, questions, classSubjects, assessmentTypes, weightings,
}: {
  exams: ExamVM[]; subjects: SubjectVM[]; classes: ClassVM[]; terms: TermVM[];
  questions: QuestionVM[]; classSubjects?: { classId: string; subjectId: string; subjectName: string }[];
  assessmentTypes: AssessmentTypeVM[]; weightings?: WeightingVM[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createState, createAction, createPending] = useActionState(createExamAction, {});
  const [editState, editAction, editPending] = useActionState(updateExamAction, {});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingQuestionsTo, setAddingQuestionsTo] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const subjectsForClass = classSubjects && selectedClass
    ? classSubjects.filter((cs) => cs.classId === selectedClass).map((cs) => ({ id: cs.subjectId, name: cs.subjectName }))
    : [];
  const availableSubjects = selectedClass && subjectsForClass.length > 0 ? subjectsForClass : subjects;

  const filteredExams = exams.filter((e) => {
    if (subjectFilter && e.subjectName !== subjects.find((s) => s.id === subjectFilter)?.name) return false;
    if (classFilter && !e.classNames.includes(classes.find((c) => c.id === classFilter)?.name ?? "")) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters & Create */}
      <div className="flex flex-wrap items-center gap-4">
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        ><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        ><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button onClick={() => setShowCreate(!showCreate)}
          className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366]"
        >{showCreate ? "Cancel" : "Create Exam"}</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateExamForm
          action={createAction} pending={createPending} state={createState}
          subjects={subjects} classes={classes} terms={terms}
          questions={questions} classSubjects={classSubjects}
          assessmentTypes={assessmentTypes} weightings={weightings}
          selectedClass={selectedClass} setSelectedClass={setSelectedClass}
          availableSubjects={availableSubjects}
        />
      )}

      {/* Exam table */}
      <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-surface-container border-b border-outline-variant">
            <tr>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Subject</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Classes</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Type</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Duration</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Questions</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Submitted</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filteredExams.map((exam) => (
              <tr key={exam.id} className="hover:bg-surface-container-low transition-colors">
                {editingId === exam.id ? (
                  <td colSpan={7} className="p-4">
                    <EditExamForm
                      exam={exam} action={editAction} pending={editPending} state={editState}
                      subjects={subjects} classes={classes} terms={terms}
                      assessmentTypes={assessmentTypes} weightings={weightings}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                ) : (
                  <>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{exam.subjectName}</td>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{exam.classNames || exam.className}</td>
                    <td className="py-3 px-4">
                      <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm">{exam.assessmentTypeId}</span>
                    </td>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{exam.durationMinutes} min</td>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{exam.questionCount}</td>
                    <td className="py-3 px-4">
                      <span className="font-label-sm text-label-sm text-on-surface">{exam.submittedCount}/{exam.attemptCount}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingId(exam.id)}
                          className="text-primary font-label-sm text-label-sm hover:underline">Edit</button>
                        <button onClick={() => setAddingQuestionsTo(exam.id)}
                          className="text-primary font-label-sm text-label-sm hover:underline">Questions</button>
                        <button onClick={() => setShowDeleteConfirm(exam.id)}
                          className="text-red-600 font-label-sm text-label-sm hover:underline">Delete</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filteredExams.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">No exams found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          examId={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onDeleted={() => setShowDeleteConfirm(null)}
        />
      )}

      {/* Questions modal */}
      {addingQuestionsTo && (
        <QuestionsModal
          examId={addingQuestionsTo}
          exam={exams.find((e) => e.id === addingQuestionsTo)!}
          allQuestions={questions}
          onClose={() => setAddingQuestionsTo(null)}
        />
      )}
    </div>
  );
}

function CreateExamForm({
  action, pending, state, subjects, classes, terms, questions, classSubjects,
  assessmentTypes, weightings, selectedClass, setSelectedClass, availableSubjects,
}: {
  action: (fd: FormData) => void; pending: boolean; state: ActionState;
  subjects: SubjectVM[]; classes: ClassVM[]; terms: TermVM[]; questions: QuestionVM[];
  classSubjects?: { classId: string; subjectId: string; subjectName: string }[];
  assessmentTypes: AssessmentTypeVM[]; weightings?: WeightingVM[];
  selectedClass: string; setSelectedClass: (v: string) => void;
  availableSubjects: SubjectVM[];
}) {
  const [selSubject, setSelSubject] = useState("");
  const [selAssessType, setSelAssessType] = useState("");
  const [subWeights, setSubWeights] = useState<Record<string, string>>({});

  const selectedType = assessmentTypes.find((t) => t.code === selAssessType);
  const hasSubAssessments = selectedType && selectedType.children.length > 0;
  const parentWeight = selectedType?.defaultWeight ?? 0;
  const subTotal = hasSubAssessments
    ? Object.values(subWeights).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    : 0;
  const weightValid = !hasSubAssessments || Math.abs(subTotal - parentWeight) < 0.01;

  const filteredQuestions = selSubject
    ? questions.filter((q) => q.id)
    : questions;

  return (
    <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
      <input type="hidden" name="subAssessmentWeights" value={JSON.stringify(
        hasSubAssessments
          ? selectedType.children
              .filter((c) => parseFloat(subWeights[c.id] || "0") > 0)
              .map((c) => ({ subAssessmentTypeId: c.id, weightPercentage: parseFloat(subWeights[c.id] || "0") }))
          : []
      )} />
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">New Exam</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
          <select name="subjectId" required value={selSubject} onChange={(e) => setSelSubject(e.target.value)}
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          ><option value="">Select subject</option>{availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Classes</label>
          <div className="max-h-32 overflow-y-auto border border-outline-variant rounded p-2 space-y-2">
            {(() => {
              const grouped = new Map<string, ClassVM[]>();
              classes.forEach((c) => {
                const existing = grouped.get(c.level) ?? [];
                existing.push(c);
                grouped.set(c.level, existing);
              });
              return [...grouped.entries()].map(([level, items]) => (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="checkbox" onChange={(e) => {
                      items.forEach((item) => {
                        const cb = document.getElementById(`class-${item.id}`) as HTMLInputElement | null;
                        if (cb) cb.checked = e.target.checked;
                      });
                    }} className="rounded border-outline-variant text-[#002046]" />
                    <span className="font-label-sm text-label-sm text-on-surface font-semibold">{level}</span>
                  </div>
                  <div className="ml-5 flex flex-wrap gap-1">
                    {items.map((c) => (
                      <label key={c.id} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input id={`class-${c.id}`} type="checkbox" name="classIds[]" value={c.id}
                          className="rounded border-outline-variant text-[#002046]" />
                        {c.name}
                        {c.department && <span className="bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold">{c.department}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Term</label>
          <select name="termId" required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          ><option value="">Select term</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Assessment type</label>
          <select name="assessmentTypeId" required value={selAssessType}
            onChange={(e) => { setSelAssessType(e.target.value); setSubWeights({}); }}
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          ><option value="">Select type</option>{assessmentTypes.map((t) => <option key={t.code} value={t.code}>{t.name} ({t.code}){t.defaultWeight ? ` — ${t.defaultWeight}%` : ""}</option>)}</select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Duration (minutes)</label>
          <input type="number" name="durationMinutes" min={1} required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
        </div>
      </div>

      {/* Sub-assessment weight distribution */}
      {hasSubAssessments && (
        <div className="border border-outline-variant rounded-lg p-4 space-y-3 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h4 className="font-label-lg text-label-lg text-on-surface font-semibold">{selectedType.name} Sub-Assessment Weights</h4>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Total: {parentWeight}%</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Distribute the {parentWeight}% among the sub-assessments. Leave unused sub-assessments at 0.
          </p>
          <div className="space-y-2">
            {selectedType.children.map((child) => (
              <div key={child.id} className="flex items-center gap-3">
                <label className="flex-1 font-body-md text-body-md text-on-surface">{child.name}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={parentWeight} step={0.5}
                    value={subWeights[child.id] ?? ""}
                    onChange={(e) => setSubWeights((prev) => ({ ...prev, [child.id]: e.target.value }))}
                    placeholder="0"
                    className="w-24 border border-outline-variant rounded p-2 text-sm text-right"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface-variant w-4">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className={`flex items-center justify-between pt-2 border-t border-outline-variant ${weightValid ? "text-green-700" : "text-red-600"}`}>
            <span className="font-label-sm text-label-sm">Sub-total</span>
            <span className="font-label-md text-label-md font-semibold">{subTotal.toFixed(1)}% {weightValid ? "✓" : `(must equal ${parentWeight}%)`}</span>
          </div>
        </div>
      )}

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Questions</label>
        <div className="max-h-60 overflow-y-auto border border-outline-variant rounded divide-y divide-outline-variant">
          {filteredQuestions.length === 0 && (
            <p className="p-3 font-body-sm text-body-sm text-on-surface-variant">No approved questions found.</p>
          )}
          {filteredQuestions.map((q) => (
            <label key={q.id} className="flex items-start gap-3 p-3 hover:bg-surface-container-low cursor-pointer">
              <input type="checkbox" name="questionIds[]" value={q.id} className="mt-0.5 rounded border-outline-variant text-[#002046] focus:ring-[#002046]" />
              <div className="flex-1 min-w-0">
                <p className="font-body-sm text-body-sm text-on-surface line-clamp-2">{q.text}</p>
                <div className="flex gap-2 mt-1">
                  <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm">{q.type === "mcq" ? "MCQ" : "Essay"}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{q.marks} marks</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state.error && <p className="bg-red-50 text-red-700 font-body-sm text-body-sm px-3 py-2 rounded">{state.error}</p>}
      {state.success && <p className="bg-green-50 text-green-700 font-body-sm text-body-sm px-3 py-2 rounded">{state.success}</p>}
      <button type="submit" disabled={pending || (hasSubAssessments && !weightValid)}
        className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366] disabled:opacity-60"
      >{pending ? "Creating..." : "Create Exam"}</button>
    </form>
  );
}

function EditExamForm({ exam, action, pending, state, subjects, classes, terms, assessmentTypes, weightings, onCancel }: {
  exam: ExamVM; action: (fd: FormData) => void; pending: boolean; state: ActionState;
  subjects: SubjectVM[]; classes: ClassVM[]; terms: TermVM[];
  assessmentTypes: AssessmentTypeVM[]; weightings?: WeightingVM[]; onCancel: () => void;
}) {
  const [editAssessType, setEditAssessType] = useState(exam.assessmentTypeId);
  const [editSubWeights, setEditSubWeights] = useState<Record<string, string>>({});

  const editSelectedType = assessmentTypes.find((t) => t.code === editAssessType);
  const editHasSub = editSelectedType && editSelectedType.children.length > 0;
  const editParentWeight = editSelectedType?.defaultWeight ?? 0;
  const editSubTotal = editHasSub
    ? Object.values(editSubWeights).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    : 0;
  const editWeightValid = !editHasSub || Math.abs(editSubTotal - editParentWeight) < 0.01;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="examId" value={exam.id} />
      <input type="hidden" name="subAssessmentWeights" value={JSON.stringify(
        editHasSub
          ? editSelectedType.children
              .filter((c) => parseFloat(editSubWeights[c.id] || "0") > 0)
              .map((c) => ({ subAssessmentTypeId: c.id, weightPercentage: parseFloat(editSubWeights[c.id] || "0") }))
          : []
      )} />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
          <select name="subjectId" defaultValue={subjects.find((s) => s.name === exam.subjectName)?.id ?? ""} required
            className="w-full border border-outline-variant rounded p-2 text-sm"
          >{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Classes</label>
          <div className="max-h-24 overflow-y-auto border border-outline-variant rounded p-1 text-xs space-y-2">
            {(() => {
              const grouped = new Map<string, ClassVM[]>();
              classes.forEach((c) => {
                const existing = grouped.get(c.level) ?? [];
                existing.push(c);
                grouped.set(c.level, existing);
              });
              return [...grouped.entries()].map(([level, items]) => (
                <div key={level}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="font-semibold text-[11px]">{level}</span>
                  </div>
                  <div className="ml-4 flex flex-wrap gap-1">
                    {items.map((c) => (
                      <label key={c.id} className="flex items-center gap-1">
                        <input type="checkbox" name="classIds[]" value={c.id} defaultChecked={exam.classNames.includes(c.name)}
                          className="rounded border-outline-variant text-[#002046]" />
                        <span className="text-[11px]">{c.department ? c.department.charAt(0).toUpperCase() + c.department.slice(1) : c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Term</label>
          <select name="termId" defaultValue={terms.find((t) => exam.termName.startsWith(t.name))?.id ?? ""} required
            className="w-full border border-outline-variant rounded p-2 text-sm"
          >{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Type</label>
          <select name="assessmentTypeId" value={editAssessType}
            onChange={(e) => { setEditAssessType(e.target.value); setEditSubWeights({}); }}
            required
            className="w-full border border-outline-variant rounded p-2 text-sm"
          >{assessmentTypes.map((t) => <option key={t.code} value={t.code}>{t.name}{t.defaultWeight ? ` (${t.defaultWeight}%)` : ""}</option>)}</select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Duration</label>
          <input type="number" name="durationMinutes" defaultValue={exam.durationMinutes} min={1} required
            className="w-full border border-outline-variant rounded p-2 text-sm" />
        </div>
      </div>

      {/* Sub-assessment weight distribution */}
      {editHasSub && (
        <div className="border border-outline-variant rounded p-3 space-y-2 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h4 className="font-label-sm text-label-sm text-on-surface font-semibold">{editSelectedType.name} Sub-Assessment Weights</h4>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Total: {editParentWeight}%</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
            Distribute the {editParentWeight}% among sub-assessments.
          </p>
          <div className="space-y-1.5">
            {editSelectedType.children.map((child) => (
              <div key={child.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{child.name}</span>
                <input
                  type="number" min={0} max={editParentWeight} step={0.5}
                  value={editSubWeights[child.id] ?? ""}
                  onChange={(e) => setEditSubWeights((prev) => ({ ...prev, [child.id]: e.target.value }))}
                  placeholder="0"
                  className="w-20 border border-outline-variant rounded p-1 text-sm text-right"
                />
                <span className="text-xs text-on-surface-variant">%</span>
              </div>
            ))}
          </div>
          <div className={`flex items-center justify-between pt-1.5 border-t border-outline-variant text-xs ${editWeightValid ? "text-green-700" : "text-red-600"}`}>
            <span>Sub-total</span>
            <span className="font-semibold">{editSubTotal.toFixed(1)}% {editWeightValid ? "✓" : `(must equal ${editParentWeight}%)`}</span>
          </div>
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || (editHasSub && !editWeightValid)}
          className="bg-[#002046] text-white text-sm px-3 py-1.5 rounded hover:bg-[#003366] disabled:opacity-60"
        >{pending ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onCancel}
          className="text-sm text-on-surface-variant px-3 py-1.5">Cancel</button>
      </div>
    </form>
  );
}

function DeleteConfirmModal({ examId, onClose, onDeleted }: { examId: string; onClose: () => void; onDeleted: () => void }) {
  const [state, delAction, delPending] = useActionState(async (_prev: ActionState) => {
    const res = await deleteExamAction(examId);
    if (!res.error) onDeleted();
    return res;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-2">Delete exam?</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">This action cannot be undone. All attempts and answers will be removed.</p>
        <form action={delAction} className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-outline-variant rounded hover:bg-surface-container-low">Cancel</button>
          <button type="submit" disabled={delPending}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60">{delPending ? "Deleting..." : "Delete"}</button>
        </form>
        {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
      </div>
    </div>
  );
}

function QuestionsModal({ examId, exam, allQuestions, onClose }: {
  examId: string; exam: ExamVM; allQuestions: QuestionVM[]; onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const availableQuestions = allQuestions.filter((q) => !exam.questionIds.includes(q.id));

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    const res = await addQuestionsToExamAction(examId, selectedIds);
    setMsg(res.success ?? res.error ?? "");
    if (res.success) setSelectedIds([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Manage Questions</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-lg">&times;</button>
        </div>

        <div className="mb-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">
            Currently {exam.questionCount} question(s). Add more:
          </p>
          {availableQuestions.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">No more questions available.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-outline-variant rounded divide-y text-sm">
              {availableQuestions.map((q) => (
                <label key={q.id} className="flex items-start gap-2 p-2 hover:bg-surface-container-low cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(q.id)}
                    onChange={() => setSelectedIds((prev) => prev.includes(q.id) ? prev.filter((id) => id !== q.id) : [...prev, q.id])}
                    className="mt-0.5 rounded border-outline-variant text-[#002046]" />
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1">{q.text}</p>
                    <span className="text-xs text-on-surface-variant">{q.type === "mcq" ? "MCQ" : "Essay"} · {q.marks} marks</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Remove questions:</p>
          <div className="max-h-32 overflow-y-auto border border-outline-variant rounded divide-y text-sm">
            {exam.questionIds.length === 0 && <p className="p-2 text-xs text-on-surface-variant">No questions in exam.</p>}
            {exam.questionIds.map((qId) => {
              const q = allQuestions.find((q) => q.id === qId);
              if (!q) return null;
              return (
                <div key={qId} className="flex items-center justify-between p-2">
                  <span className="line-clamp-1 flex-1">{q.text}</span>
                  <button onClick={async () => {
                    await removeQuestionFromExamAction(examId, qId);
                    setMsg("Question removed.");
                  }} className="text-red-600 text-xs hover:underline ml-2">Remove</button>
                </div>
              );
            })}
          </div>
        </div>

        {msg && <p className="text-sm text-green-600 mb-2">{msg}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-outline-variant rounded">Close</button>
          <button type="button" onClick={handleAdd} disabled={selectedIds.length === 0}
            className="px-4 py-2 text-sm bg-[#002046] text-white rounded hover:bg-[#003366] disabled:opacity-60"
          >Add Selected ({selectedIds.length})</button>
        </div>
      </div>
    </div>
  );
}
