"use client";

import { useActionState, useState, useTransition } from "react";
import { createLessonNoteAction, aiGenerateNoteAction, getCurriculumTopicsAction, type ActionState } from "./actions";

const init: ActionState = {};

export function LessonNotesForm({
  subjects,
  classes,
  terms,
}: {
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string; level: string }[];
  terms: { id: string; name: string }[];
}) {
  const [manualState, manualAction, manualPending] = useActionState(createLessonNoteAction, init);
  const [aiPending, startAi] = useTransition();
  const [aiResult, setAiResult] = useState<ActionState>({});

  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");

  // Syllabus-based AI generation state
  const [aiSubjectId, setAiSubjectId] = useState("");
  const [aiClassId, setAiClassId] = useState("");
  const [aiTermId, setAiTermId] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [curriculumTopics, setCurriculumTopics] = useState<{ id: string; topic: string; week: number; weekSuffix: string }[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  async function loadCurriculumTopics(subjectId: string, classId: string, termId: string) {
    if (!subjectId || !classId || !termId) {
      setCurriculumTopics([]);
      return;
    }
    setLoadingTopics(true);
    try {
      const subject = subjects.find((s) => s.id === subjectId);
      const cls = classes.find((c) => c.id === classId);
      const term = terms.find((t) => t.id === termId);
      if (!subject || !cls || !term) return;
      const classLevel = cls.level;
      const termName = term.name.toUpperCase();

      let topics = await getCurriculumTopicsAction(subject.name, classLevel, termName);
      // If no topics found, try common NERDC name variations
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
          topics = await getCurriculumTopicsAction(alt, classLevel, termName);
          if (topics.length > 0) break;
        }
      }
      setCurriculumTopics(topics);
    } finally {
      setLoadingTopics(false);
    }
  }

  async function handleAiGenerate(fd: FormData) {
    setAiResult({});
    const topicFromSyllabus = fd.get("syllabusTopic") as string;
    const customTopic = fd.get("customTopic") as string;
    const topic = topicFromSyllabus || customTopic;
    if (!topic) {
      setAiResult({ error: "Select a syllabus topic or type a custom topic." });
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
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Subject</label>
            <select name="subjectId" required
              value={aiSubjectId}
              onChange={(e) => {
                const v = e.target.value;
                setAiSubjectId(v);
                loadCurriculumTopics(v, aiClassId, aiTermId);
              }}
              className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Class</label>
            <select name="classId" required
              value={aiClassId}
              onChange={(e) => {
                const v = e.target.value;
                setAiClassId(v);
                loadCurriculumTopics(aiSubjectId, v, aiTermId);
              }}
              className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
            >
              <option value="">Select class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Term</label>
            <select name="termId" required
              value={aiTermId}
              onChange={(e) => {
                const v = e.target.value;
                setAiTermId(v);
                loadCurriculumTopics(aiSubjectId, aiClassId, v);
              }}
              className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
            >
              <option value="">Select term…</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name} Term</option>)}
            </select>
          </div>
        </div>

        {/* Curriculum topic picker for AI tab */}
        {activeTab === "ai" && (
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Syllabus Topic</label>
            {loadingTopics && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading syllabus…</p>}
            {!loadingTopics && curriculumTopics.length === 0 && aiSubjectId && aiClassId && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No syllabus topics found for this subject, class, and term.</p>
            )}
            {curriculumTopics.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant">
                {curriculumTopics.map((ct) => (
                  <label key={ct.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-container ${
                    selectedTopic === ct.topic ? "bg-primary-container text-on-primary-container" : ""
                  }`}>
                    <input type="radio" name="syllabusTopic" value={ct.topic}
                      checked={selectedTopic === ct.topic}
                      onChange={() => setSelectedTopic(ct.topic)}
                      className="text-primary"
                    />
                    <span className="font-body-sm text-body-sm">Week {ct.week}{ct.weekSuffix || ""}: {ct.topic}</span>
                  </label>
                ))}
              </div>
            )}
            {!selectedTopic && (
              <div className="mt-2">
                <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Or type a custom topic:</label>
                <input name="customTopic" placeholder="e.g. Introduction to Cells"
                  className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "manual" && (
          <div>
            <label className="mb-1 block font-label-md text-label-md text-on-surface">Topic</label>
            <input name="topic" placeholder="e.g. Introduction to Cells" required
              className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
            />
          </div>
        )}

        {activeTab === "manual" && (
          <div className="space-y-4">
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
          className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366] disabled:opacity-60"
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
