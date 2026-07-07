"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertCurriculumTopicAction, deleteCurriculumOverrideAction } from "./actions";

interface TopicVM {
  id: string;
  week: number;
  topic: string;
  subTopics: string[];
  behaviouralObjectives: string[];
  isOverride: boolean;
  isEditable: boolean;
}

export function CurriculumView({
  classLevels, terms, subjects, allSubjects,
  selectedClass, selectedTerm, selectedSubject, topics,
}: {
  classLevels: string[]; terms: string[]; subjects: string[];
  allSubjects: string[];
  selectedClass: string; selectedTerm: string; selectedSubject: string;
  topics: TopicVM[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(upsertCurriculumTopicAction, {});
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(window.location.search);
    if (val) p.set(key, val); else p.delete(key);
    router.push(`/curriculum?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Filters + Add New */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class</label>
          <select value={selectedClass} onChange={(e) => setParam("classLevel", e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm bg-white">
            {classLevels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Term</label>
          <select value={selectedTerm} onChange={(e) => setParam("term", e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm bg-white">
            {terms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
          <select value={selectedSubject} onChange={(e) => setParam("subject", e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm bg-white">
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            {subjects.length === 0 && <option value="">No subjects</option>}
          </select>
        </div>
        <button onClick={() => setShowAddNew(true)}
          className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-[#003366] flex items-center gap-1"
        >+ Add New</button>
      </div>

      {/* Add New Modal */}
      {showAddNew && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAddNew(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-4">Add New Curriculum Topic</h3>
            <EditTopicForm
              week={0}
              initialTopic=""
              initialSubTopics={[]}
              initialObjectives={[]}
              selectedClass={selectedClass}
              selectedTerm={selectedTerm}
              selectedSubject={selectedSubject}
              allSubjects={allSubjects}
              allClassLevels={classLevels}
              allTerms={terms}
              onCancel={() => setShowAddNew(false)}
              onSaved={() => setShowAddNew(false)}
              isNew
            />
          </div>
        </div>
      )}

      {/* Topics table */}
      <div className="overflow-x-auto bg-white border border-outline-variant rounded-xl">
        <table className="w-full text-left">
          <thead className="bg-surface-container border-b border-outline-variant">
            <tr>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase w-16">Week</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Topic</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Sub-topics</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase">Objectives</th>
              <th className="py-3 px-4 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {topics.map((t) => (
              <tr key={`${t.week}-${t.isOverride}`} className="hover:bg-surface-container-low transition-colors">
                {editingWeek === t.week ? (
                  <td colSpan={5} className="p-4">
                    <EditTopicForm
                      week={t.week}
                      initialTopic={t.topic}
                      initialSubTopics={t.subTopics}
                      initialObjectives={t.behaviouralObjectives}
                      selectedClass={selectedClass}
                      selectedTerm={selectedTerm}
                      selectedSubject={selectedSubject}
                      allSubjects={allSubjects}
                      allClassLevels={classLevels}
                      allTerms={terms}
                      onCancel={() => setEditingWeek(null)}
                    />
                  </td>
                ) : (
                  <>
                    <td className="py-3 px-4 font-body-md text-body-md text-on-surface font-semibold">Week {t.week}</td>
                    <td className="py-3 px-4">
                      <span className={`font-body-md text-body-md ${t.isOverride ? "text-primary font-semibold" : "text-on-surface"}`}>
                        {t.topic}
                      </span>
                      {t.isOverride && <span className="ml-2 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">Override</span>}
                    </td>
                    <td className="py-3 px-4">
                      {t.subTopics.length > 0 ? (
                        <ul className="list-disc list-inside font-body-sm text-body-sm text-on-surface-variant space-y-0.5">
                          {t.subTopics.map((st, i) => <li key={i}>{st}</li>)}
                        </ul>
                      ) : (
                        <span className="font-body-sm text-body-sm text-on-surface-variant/60">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.behaviouralObjectives.length > 0 ? (
                        <ul className="list-disc list-inside font-body-sm text-body-sm text-on-surface-variant space-y-0.5">
                          {t.behaviouralObjectives.map((o, i) => <li key={i}>{o}</li>)}
                        </ul>
                      ) : (
                        <span className="font-body-sm text-body-sm text-on-surface-variant/60">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => setEditingWeek(t.week)} className="font-label-sm text-label-sm text-primary hover:underline">
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {topics.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">
                  No curriculum data for this selection. Click <strong>+ Add New</strong> to add topics.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditTopicForm({
  week, initialTopic, initialSubTopics, initialObjectives,
  selectedClass, selectedTerm, selectedSubject,
  allSubjects, allClassLevels, allTerms,
  onCancel, onSaved, isNew,
}: {
  week: number;
  initialTopic: string;
  initialSubTopics: string[];
  initialObjectives: string[];
  selectedClass: string; selectedTerm: string; selectedSubject: string;
  allSubjects: string[]; allClassLevels: string[]; allTerms: string[];
  onCancel: () => void;
  onSaved?: () => void;
  isNew?: boolean;
}) {
  const [state, action, pending] = useActionState(async (prev: any, fd: FormData) => {
    const r = await upsertCurriculumTopicAction(prev, fd);
    if (r.success && onSaved) onSaved();
    return r;
  }, {});

  return (
    <form action={action} className="space-y-3">
      {isNew ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class</label>
            <select name="classLevel" defaultValue={selectedClass} className="w-full border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md bg-white">
              {allClassLevels.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Term</label>
            <select name="term" defaultValue={selectedTerm} className="w-full border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md bg-white">
              {allTerms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
            <select name="subject" defaultValue={selectedSubject || allSubjects[0] || ""} className="w-full border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md bg-white">
              {allSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="classLevel" value={selectedClass} />
          <input type="hidden" name="term" value={selectedTerm} />
          <input type="hidden" name="subject" value={selectedSubject} />
        </>
      )}
      {!isNew && <input type="hidden" name="week" value={week} />}

      {isNew && (
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Week number</label>
          <input name="week" type="number" min={1} max={16} required className="w-24 border border-outline-variant rounded-lg p-2 font-body-md text-body-md" />
        </div>
      )}

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Topic</label>
        <input name="topic" defaultValue={initialTopic} required className="w-full border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md" />
      </div>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Sub-topics (one per line)</label>
        <textarea name="subTopics" defaultValue={initialSubTopics.join("\n")} rows={3} className="w-full border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md" />
      </div>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Behavioural Objectives (one per line)</label>
        <textarea name="behaviouralObjectives" defaultValue={initialObjectives.join("\n")} rows={3} placeholder="e.g. By the end of the lesson, students should be able to..." className="w-full border border-outline-variant rounded-lg p-2.5 font-body-md text-body-md" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-[#003366] disabled:opacity-60">
          {pending ? "Saving…" : isNew ? "Add Topic" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-on-surface-variant font-label-md text-label-md py-2 px-4 hover:bg-surface-container-low rounded-lg">
          Cancel
        </button>
      </div>
    </form>
  );
}
