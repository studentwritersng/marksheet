"use client";

import { useState, useTransition } from "react";
import { publishNoteAction } from "./actions";

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

  return (
    <div className="space-y-3">
      {notes.map((n) => {
        const isExpanded = expandedId === n.id;
        return (
          <div
            key={n.id}
            onClick={() => setExpandedId(isExpanded ? null : n.id)}
            className="cursor-pointer bg-surface-container-lowest border border-outline-variant rounded-lg p-4 transition hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
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
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 border-t border-outline-variant pt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Created: {new Date(n.createdAt).toLocaleDateString()}</p>

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
              </div>
            )}
          </div>
        );
      })}
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
