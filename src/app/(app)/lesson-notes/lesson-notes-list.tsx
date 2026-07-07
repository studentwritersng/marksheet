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
                    className="rounded bg-primary px-2 py-1 font-label-sm text-label-sm text-on-primary hover:bg-primary-container disabled:opacity-60"
                  >
                    Publish
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 border-t border-outline-variant pt-4" onClick={(e) => e.stopPropagation()}>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Created: {new Date(n.createdAt).toLocaleDateString()}</p>
                {/* Simulated content preview */}
                <div className="prose prose-sm mt-3 max-w-none font-body-sm text-body-sm leading-relaxed text-on-surface">
                  <p>Objectives: The students should understand the core concepts of {n.topic}.</p>
                  <p>Content development is fully managed under the lesson notes entity.</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}