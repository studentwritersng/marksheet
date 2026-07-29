"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createLessonNoteAction, aiGenerateNoteAction, getExistingNotesAction, getCurriculumTopicsAction, type ActionState } from "./actions";

const init: ActionState = {};

interface ExistingNote {
  id: string;
  topic: string;
  duration: string | null;
  source: string;
  status: string;
  createdAt: string;
}

export function LessonNotesForm({
  subjects,
  classes,
  terms,
  schoolId,
  classSubjects,
  onSelectionChange,
}: {
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string; level: string }[];
  terms: { id: string; name: string }[];
  schoolId: string;
  classSubjects: { classId: string; subjectId: string }[];
  onSelectionChange?: (sel: { classId?: string; className?: string; subjectId?: string; subjectName?: string }) => void;
}) {
  const [manualState, manualAction, manualPending] = useActionState(createLessonNoteAction, init);
  const [aiPending, startAi] = useTransition();
  const [aiResult, setAiResult] = useState<ActionState>({});
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");

  // AI wizard state
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  // class → subjects FAQ list
  const [openSubjectId, setOpenSubjectId] = useState("");
  const [existingNotes, setExistingNotes] = useState<ExistingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [curriculumTopics, setCurriculumTopics] = useState<{ id: string; topic: string; week: number; weekSuffix: string }[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [filteredSubjects, setFilteredSubjects] = useState<{ id: string; name: string }[]>([]);
  const [, startLoadNotes] = useTransition();

  function handleTermChange(value: string) {
    setTermId(value);
    setClassId("");
    setSubjectId("");
    setOpenSubjectId("");
    setExistingNotes([]);
    setFilteredSubjects([]);
    if (value && classId) handleClassChange(classId);
  }

  function handleClassChange(value: string) {
    setClassId(value);
    setSubjectId("");
    setOpenSubjectId("");
    setExistingNotes([]);
    if (onSelectionChange) {
      const cls = classes.find((c) => c.id === value);
      onSelectionChange(value ? { classId: value, className: cls?.name } : {});
    }
    if (!value) { setFilteredSubjects([]); return; }
    // Show ALL subjects linked to the class — notes filter happens in the list below
    const linkedSubjectIds = classSubjects.filter((cs) => cs.classId === value).map((cs) => cs.subjectId);
    setFilteredSubjects(subjects.filter((s) => linkedSubjectIds.includes(s.id)));
  }

  function handleSubjectSelect(value: string) {
    setSubjectId(value);
    setSelectedTopic("");
    if (onSelectionChange && value) {
      const cls = classes.find((c) => c.id === classId);
      const subj = filteredSubjects.find((s) => s.id === value) || subjects.find((s) => s.id === value);
      onSelectionChange({ classId, className: cls?.name, subjectId: value, subjectName: subj?.name });
    }
    if (!value || !classId || !termId) { setExistingNotes([]); return; }
    setLoadingNotes(true);
    startLoadNotes(async () => {
      const notes = await getExistingNotesAction(classId, value, termId);
      setExistingNotes(notes);
      setLoadingNotes(false);
    });
  }

  async function loadCurriculumTopics(subjectIdToLoad: string) {
    if (!classId || !subjectIdToLoad || !termId) { setCurriculumTopics([]); return; }
    const subject = filteredSubjects.find((s) => s.id === subjectIdToLoad) || subjects.find((s) => s.id === subjectIdToLoad);
    const cls = classes.find((c) => c.id === classId);
    const term = terms.find((t) => t.id === termId);
    if (!subject || !cls || !term) return;
    let topics = await getCurriculumTopicsAction(subject.name, cls.level, term.name.toUpperCase(), schoolId);
    if (topics.length === 0) {
      const altNames: Record<string, string[]> = {
        "English Language": ["English Studies", "English"],
        "Basic Science": ["Basic Science and Technology", "Integrated Science"],
        "Basic Technology": ["Introductory Technology"],
        "Business Studies": ["Business Education"],
        "Civic Education": ["Civics"],
        "Physical and Health Education": ["Physical Education", "PHE"],
        "Social Studies": ["Social Sciences"],
        "Agricultural Science": ["Agriculture"],
        "Computer Science": ["Information Technology", "IT", "Computer Studies"],
        "Home Economics": ["Home Management"],
      };
      const alternatives = altNames[subject.name] ?? [];
      for (const alt of alternatives) {
        topics = await getCurriculumTopicsAction(alt, cls.level, term.name.toUpperCase(), schoolId);
        if (topics.length > 0) break;
      }
    }
    setCurriculumTopics(topics);
  }

  async function handleAiGenerate(fd: FormData) {
    setAiResult({});
    const topicFromSyllabus = fd.get("syllabusTopic") as string;
    const customTopic = fd.get("customTopic") as string;
    const topic = topicFromSyllabus || customTopic;
    if (!topic) {
      setAiResult({ error: "Pick a syllabus topic or type a custom topic." });
      return;
    }
    fd.set("topic", topic);
    startAi(async () => {
      setAiResult(await aiGenerateNoteAction({}, fd));
    });
  }

  const pending = manualPending || aiPending;
  const state = activeTab === "manual" ? manualState : aiResult;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
      <div className="mb-4 flex border-b border-outline-variant font-body-sm text-body-sm">
        <button onClick={() => setActiveTab("manual")}
          className={`pb-2 pr-4 ${activeTab === "manual" ? "border-b-2 border-primary text-on-surface" : "text-on-surface-variant"}`}
        >Manual entry</button>
        <button onClick={() => setActiveTab("ai")}
          className={`pb-2 pr-4 ${activeTab === "ai" ? "border-b-2 border-primary text-on-surface" : "text-on-surface-variant"}`}
        >AI Generator</button>
      </div>

      <form action={activeTab === "manual" ? manualAction : handleAiGenerate} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Term</label>
            <select name="termId" required value={termId}
              onChange={(e) => handleTermChange(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary">
              <option value="">Select term…</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name} Term</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Class</label>
            <select name="classId" required value={classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary">
              <option value="">{termId ? "Select class…" : "Select term first…"}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* hidden subjectId — set by clicking a subject in the accordion below */}
        <input type="hidden" name="subjectId" value={subjectId} />
        {subjectId && (
          <input type="hidden" name="subjectName" value={filteredSubjects.find((s) => s.id === subjectId)?.name ?? ""} />
        )}

        {activeTab === "ai" && (
          <>
            {/* ── Class → Subjects FAQ list ── */}
            {classId && filteredSubjects.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-on-surface-variant">Subjects in {classes.find((c) => c.id === classId)?.name}</p>
                <div className="border border-outline-variant rounded-lg divide-y divide-outline-variant">
                  {filteredSubjects.map((s) => {
                    const isOpen = openSubjectId === s.id;
                    return (
                      <div key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSubjectId(isOpen ? "" : s.id);
                            if (!isOpen) handleSubjectSelect(s.id);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium transition-colors ${isOpen ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container"}`}
                        >
                          <span>{s.name}</span>
                          <span className="material-symbols-outlined text-[16px]">{isOpen ? "expand_less" : "expand_more"}</span>
                        </button>
                        {isOpen && subjectId === s.id && (
                          <div className="px-3 py-3 bg-surface-container-low border-t border-outline-variant space-y-3">
                            {/* Existing notes for this subject */}
                            {loadingNotes && <p className="text-xs text-on-surface-variant">Loading notes…</p>}
                            {!loadingNotes && existingNotes.length === 0 && (
                              <p className="text-xs text-on-surface-variant">No existing notes for {s.name} in this class/term.</p>
                            )}
                            {!loadingNotes && existingNotes.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-on-surface-variant mb-1.5">Existing notes ({existingNotes.length})</p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                  {existingNotes.map((n) => (
                                    <div key={n.id} className="flex items-center justify-between border border-outline-variant rounded-lg px-3 py-2 bg-surface">
                                      <div>
                                        <p className="text-xs font-medium text-on-surface">{n.topic}</p>
                                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                                          {n.duration ? `${n.duration} · ` : ""}{n.source === "ai_generated" ? "AI" : "Manual"} · {n.status}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Curricuulum topic picker */}
                            <div className="pt-2 border-t border-outline-variant/50">
                              <button type="button" onClick={() => loadCurriculumTopics(s.id)}
                                className="text-xs text-primary hover:underline">
                                Load syllabus topics
                              </button>
                              {curriculumTopics.length > 0 && (
                                <div className="max-h-40 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant mt-2">
                                  {curriculumTopics.map((ct) => (
                                    <label key={ct.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs hover:bg-surface-container ${selectedTopic === ct.topic ? "bg-primary-container" : ""}`}>
                                      <input type="radio" name="syllabusTopic" value={ct.topic}
                                        checked={selectedTopic === ct.topic}
                                        onChange={() => setSelectedTopic(ct.topic)}
                                        className="text-primary"
                                      />
                                      Week {ct.week}{ct.weekSuffix || ""}: {ct.topic}
                                    </label>
                                  ))}
                                </div>
                              )}
                              {!selectedTopic && (
                                <div className="mt-2">
                                  <label className="text-xs text-on-surface-variant block mb-1">Or type a custom topic:</label>
                                  <input name="customTopic" placeholder="e.g. Introduction to Cells"
                                    className="w-full border border-outline-variant rounded px-3 py-2 text-xs bg-surface focus:outline-none focus:border-primary"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Manual topic input (if no subjects FAQ and custom topic) ── */}
            {!classId && (
              <div>
                <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Custom topic (no class selected)</label>
                <input name="customTopic" placeholder="e.g. Introduction to Cells"
                  className="w-full border border-outline-variant rounded p-3 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </>
        )}

        {activeTab === "manual" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Topic</label>
              <input name="topic" placeholder="e.g. Introduction to Cells" required
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Previous Knowledge</label>
              <textarea name="previousKnowledge" rows={2} placeholder="What students should already know..."
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Introduction / Set Induction</label>
              <textarea name="introduction" rows={3} placeholder="Opening activity..."
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Content / Students' Note</label>
              <textarea name="content" rows={8} required placeholder="Main lesson content..."
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Evaluation</label>
              <textarea name="evaluation" rows={3} placeholder="Evaluation questions..."
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Summary / Conclusion</label>
              <textarea name="summary" rows={2} placeholder="Brief recap..."
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Assignment / Homework</label>
              <textarea name="assignment" rows={2} placeholder="Homework task..."
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        <button type="submit" disabled={pending}
          className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[003366] disabled:opacity-60"
        >
          {pending ? (activeTab === "manual" ? "Saving…" : "Generating draft…")
            : activeTab === "manual" ? "Save note" : "AI generate note"
          }
        </button>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      </form>
    </div>
  );
}
