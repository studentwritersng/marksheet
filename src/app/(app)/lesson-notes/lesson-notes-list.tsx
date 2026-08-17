"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

export interface ListFilter {
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
}

export function LessonNotesList({ notes, filter }: { notes: NoteVM[]; filter?: ListFilter }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [, start] = useTransition();

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

  const hasClassFilter = !!(filter?.classId);
  const hasSubjectFilter = !!(filter?.subjectId);

  // ── When subject is selected: show flat list sorted by week ──
  if (hasClassFilter && hasSubjectFilter) {
    const subjectNotes = notes
      .filter((n) => n.subject === filter!.subjectName)
      .sort((a, b) => extractWeek(a.topic) - extractWeek(b.topic));

    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-surface-container-low border border-outline-variant px-4 py-2.5 text-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">{filter!.subjectName}</span> · {filter!.className} · {subjectNotes.length} note{subjectNotes.length !== 1 ? "s" : ""}
        </div>
        {subjectNotes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            isExpanded={expandedId === n.id}
            isEditing={editingId === n.id}
            onToggleExpand={() => setExpandedId(expandedId === n.id ? null : n.id)}
            onToggleEdit={() => setEditingId(editingId === n.id ? null : n.id)}
            onPublish={handlePublish}
            onDelete={handleDelete}
            onSaveEdit={handleSaveEdit}
          />
        ))}
      </div>
    );
  }

  // ── When class is selected: group by subject (FAQ-style) ──
  if (hasClassFilter) {
    const classNotes = notes.filter((n) => n.class === filter!.className);
    const groupedBySubject = new Map<string, NoteVM[]>();
    for (const note of classNotes) {
      const arr = groupedBySubject.get(note.subject) ?? [];
      arr.push(note);
      groupedBySubject.set(note.subject, arr);
    }

    const subjectsWithNotes = [...groupedBySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <div className="space-y-2">
        <div className="rounded-lg bg-surface-container-low border border-outline-variant px-4 py-2.5 text-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">{filter!.className}</span> · {subjectsWithNotes.length} subject{subjectsWithNotes.length !== 1 ? "s" : ""}
        </div>
        {subjectsWithNotes.map(([subjectName, subjectNotes]) => {
          const isOpen = openGroupId === subjectName;
          return (
            <div key={subjectName} className="border border-outline-variant rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenGroupId(isOpen ? null : subjectName)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isOpen ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-label-md font-medium">{subjectName}</span>
                  <span className="text-xs bg-surface-variant border border-outline-variant/50 rounded-full px-2 py-0.5">{subjectNotes.length}</span>
                </div>
                <span className="material-symbols-outlined text-[18px]">{isOpen ? "expand_less" : "expand_more"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-outline-variant">
                  {subjectNotes
                    .sort((a, b) => extractWeek(a.topic) - extractWeek(b.topic))
                    .map((n) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        isExpanded={expandedId === n.id}
                        isEditing={editingId === n.id}
                        onToggleExpand={() => setExpandedId(expandedId === n.id ? null : n.id)}
                        onToggleEdit={() => setEditingId(editingId === n.id ? null : n.id)}
                        onPublish={handlePublish}
                        onDelete={handleDelete}
                        onSaveEdit={handleSaveEdit}
                      />
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── No filters: show everything ──
  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          isExpanded={expandedId === n.id}
          isEditing={editingId === n.id}
          onToggleExpand={() => setExpandedId(expandedId === n.id ? null : n.id)}
          onToggleEdit={() => setEditingId(editingId === n.id ? null : n.id)}
          onPublish={handlePublish}
          onDelete={handleDelete}
          onSaveEdit={handleSaveEdit}
        />
      ))}
    </div>
  );
}

function NoteCard({
  note: n,
  isExpanded,
  isEditing,
  onToggleExpand,
  onToggleEdit,
  onPublish,
  onDelete,
  onSaveEdit,
}: {
  note: NoteVM;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onToggleEdit: () => void;
  onPublish: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onSaveEdit: (fd: FormData) => Promise<void>;
}) {
  const contentId = `lesson-note-${n.id}`;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      {/* Collapsed header — always visible */}
      <div
        onClick={onToggleExpand}
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
            {n.source === "ai_generated" ? "AI" : "Manual"}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            n.status === "published" ? "bg-secondary-container text-on-secondary-container" : "bg-amber-100 text-amber-700"
          }`}>
            {n.status}
          </span>
          {n.status === "draft" && (
            <button
              onClick={(e) => onPublish(n.id, e)}
              className="rounded bg-primary px-2 py-1 font-label-sm text-label-sm text-white hover:bg-primary-container"
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
                  onClick={onToggleEdit}
                  className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-low"
                >
                  {isEditing ? "Cancel" : "Edit"}
                </button>
                <button
                  onClick={(e) => onDelete(n.id, e)}
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
              <EditForm note={n} onSave={onSaveEdit} />
            ) : (
              <>
                {n.behaviouralObjectives && n.behaviouralObjectives.length > 0 && (
                  <Section title="Behavioural Objectives">
                    <ul className="list-disc pl-5 space-y-1">
                      {n.behaviouralObjectives.map((obj, i) => <li key={i}>{obj}</li>)}
                    </ul>
                  </Section>
                )}
                {n.previousKnowledge && <Section title="Previous Knowledge"><MdSection text={n.previousKnowledge} /></Section>}
                {n.introduction && <Section title="Introduction / Set Induction"><MdSection text={n.introduction} /></Section>}
                {n.content && <Section title="Content / Students' Note"><MdSection text={n.content} /></Section>}
                {n.evaluation && <Section title="Evaluation"><MdSection text={n.evaluation} /></Section>}
                {n.summary && <Section title="Summary / Conclusion"><MdSection text={n.summary} /></Section>}
                {n.assignment && <Section title="Assignment / Homework"><MdSection text={n.assignment} /></Section>}
              </>
            )}
          </div>
        </div>
      )}
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
        className="rounded bg-primary px-3 py-1.5 font-label-sm text-label-sm text-white hover:bg-primary-container">
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

function MdSection({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {text}
    </ReactMarkdown>
  );
}

const mdComponents = {
  p: ({ children }: any) => <p className="mb-2 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-on-surface">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="text-on-surface text-sm leading-relaxed">{children}</li>,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3 border border-outline-variant rounded-lg"><table className="w-full border-collapse text-sm">{children}</table></div>
  ),
  thead: ({ children }: any) => <thead className="bg-surface-container-low">{children}</thead>,
  tbody: ({ children }: any) => <tbody className="divide-y divide-outline-variant">{children}</tbody>,
  tr: ({ children }: any) => <tr className="hover:bg-surface-container-low/50 transition-colors">{children}</tr>,
  th: ({ children }: any) => (
    <th className="border border-outline-variant px-3 py-2 text-left font-semibold text-on-surface text-xs uppercase tracking-wide whitespace-nowrap bg-surface-container-low">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border border-outline-variant px-3 py-2 text-on-surface text-sm align-top">{children}</td>
  ),
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-1">{title}</h4>
      <div className="font-body-sm text-body-sm text-on-surface leading-relaxed">{children}</div>
    </div>
  );
}

// Try to extract week number from a topic title (e.g., "Week 3: Photosynthesis" → 3)
function extractWeek(topic: string): number {
  const match = topic.match(/(?:week\s*)(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return 999;
}
