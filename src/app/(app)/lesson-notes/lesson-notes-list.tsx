"use client";

import { useState, useTransition } from "react";
import { publishNoteAction, updateLessonNoteAction, deleteLessonNoteAction } from "./actions";
import { ExportButtons } from "@/components/export-buttons";

interface NoteVM {
  id: string;
  topic: string;
  subject: string;
  class: string;
  term: string;
  source: string;
  status: string;
  createdAt: string;
  previousKnowledge: string | null;
  introduction: string | null;
  content: string | null;
  evaluation: string | null;
  summary: string | null;
  assignment: string | null;
  behaviouralObjectives: string[] | null;
}

export function LessonNotesList({ notes }: { notes: NoteVM[] }) {
  const [pending, start] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (notes.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No lesson notes yet.</p>;
  }

  function handlePublish(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Publish this lesson note? Once published, it can be used for AI essay grading and questions.")) return;
    start(async () => {
      const res = await publishNoteAction(id);
      if (res.error) alert(res.error);
    });
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Permanently delete this lesson note?")) return;
    start(async () => {
      const res = await deleteLessonNoteAction(id);
      if (res.error) alert(res.error);
    });
  }

  async function handleSaveEdit(fd: FormData) {
    start(async () => {
      const res = await updateLessonNoteAction({}, fd);
      if (res.error) { alert(res.error); return; }
      setEditingId(null);
    });
  }

  return (
    <div className="space-y-3">
      {notes.map((n) => {
        const isExpanded = expandedId === n.id;
        const isEditing = editingId === n.id;
        const contentId = `lesson-note-${n.id}`;

        return (
          <div
            key={n.id}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
          >
            {/* Collapsed header — always visible */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : n.id)}
              className="cursor-pointer flex items-center justify-between px-4 py-3 transition hover:bg-surface-container-low"
            >
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{n.topic}</h3>
                <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                  {n.subject} · {n.class} · {n.term} Term
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  n.source === "ai_generated" ? "bg-purple-100 text-purple-700" : "bg-surface-variant text-on-surface-variant"
                }`}>
                  {n.source === "ai_generated" ? "AI Generated" : "Manual"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  n.status === "published" ? "bg-secondary-container text-on-secondary-container" : "bg-amber-100 text-amber-700"
                }`}>
                  {n.status}
                </span>
                {n.status === "draft" && (
                  <button
                    onClick={(e) => handlePublish(n.id, e)}
                    disabled={pending}
                    className="rounded bg-[#002046] px-2 py-1 font-label-sm text-label-sm text-white hover:bg-[#003366] disabled:opacity-60"
                  >
                    Publish
                  </button>
                )}
                <span className="text-on-surface-variant ml-1">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-outline-variant">
                <div id={contentId} className="px-4 py-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Created: {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(isEditing ? null : n.id)}
                        className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-low"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        onClick={(e) => handleDelete(n.id, e)}
                        disabled={pending}
                        className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                      <ExportButtons
                        contentId={contentId}
                        filename={`LessonNote_${n.topic.replace(/\s+/g, "_")}`}
                        pdfTitle={n.topic}
                      />
                    </div>
                  </div>

                  {isEditing ? (
                    <EditForm note={n} onSave={handleSaveEdit} />
                  ) : (
                    <>
                      {n.behaviouralObjectives && n.behaviouralObjectives.length > 0 && (
                        <Section title="Behavioural Objectives">
                          <ul className="list-disc pl-5 space-y-1">
                            {n.behaviouralObjectives.map((obj, i) => <li key={i}>{obj}</li>)}
                          </ul>
                        </Section>
                      )}
                      {n.previousKnowledge && <Section title="Previous Knowledge"><p>{n.previousKnowledge}</p></Section>}
                      {n.introduction && <Section title="Introduction / Set Induction"><p>{n.introduction}</p></Section>}
                      {n.content && <Section title="Content / Students' Note"><p className="whitespace-pre-wrap">{n.content}</p></Section>}
                      {n.evaluation && <Section title="Evaluation"><p className="whitespace-pre-wrap">{n.evaluation}</p></Section>}
                      {n.summary && <Section title="Summary / Conclusion"><p>{n.summary}</p></Section>}
                      {n.assignment && <Section title="Assignment / Homework"><p className="whitespace-pre-wrap">{n.assignment}</p></Section>}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditForm({ note, onSave }: { note: NoteVM; onSave: (fd: FormData) => void }) {
  const [topic, setTopic] = useState(note.topic);
  const [previousKnowledge, setPreviousKnowledge] = useState(note.previousKnowledge ?? "");
  const [introduction, setIntroduction] = useState(note.introduction ?? "");
  const [content, setContent] = useState(note.content ?? "");
  const [evaluation, setEvaluation] = useState(note.evaluation ?? "");
  const [summary, setSummary] = useState(note.summary ?? "");
  const [assignment, setAssignment] = useState(note.assignment ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("noteId", note.id);
    fd.set("topic", topic);
    fd.set("previousKnowledge", previousKnowledge);
    fd.set("introduction", introduction);
    fd.set("content", content);
    fd.set("evaluation", evaluation);
    fd.set("summary", summary);
    fd.set("assignment", assignment);
    onSave(fd);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="font-label-sm text-label-sm text-on-surface">Topic</label>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} required
          className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary" />
      </div>
      <Textarea label="Previous Knowledge" value={previousKnowledge} onChange={setPreviousKnowledge} />
      <Textarea label="Introduction / Set Induction" value={introduction} onChange={setIntroduction} />
      <Textarea label="Content / Students' Note" value={content} onChange={setContent} />
      <Textarea label="Evaluation" value={evaluation} onChange={setEvaluation} />
      <Textarea label="Summary / Conclusion" value={summary} onChange={setSummary} />
      <Textarea label="Assignment / Homework" value={assignment} onChange={setAssignment} />
      <button type="submit"
        className="rounded bg-[#002046] px-3 py-1.5 font-label-sm text-label-sm text-white hover:bg-[#003366]">
        Save Changes
      </button>
    </form>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="font-label-sm text-label-sm text-on-surface">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
        className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-1">{title}</h4>
      <div className="font-body-sm text-body-sm text-on-surface leading-relaxed">{children}</div>
    </div>
  );
}
