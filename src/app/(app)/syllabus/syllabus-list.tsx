"use client";

import { useRouter } from "next/navigation";
import { deleteSyllabusAction } from "./actions";

export function SyllabusList({
  syllabi,
  sessionMap,
}: {
  syllabi: {
    id: string;
    classLevel: string;
    sessionId: string;
    file: string | null;
    parsedTopics: unknown;
    createdAt: Date;
    subject: { name: string };
  }[];
  sessionMap: Record<string, string>;
}) {
  const router = useRouter();

  if (syllabi.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">No syllabi uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {syllabi.map((s) => {
        const topics = Array.isArray(s.parsedTopics) ? s.parsedTopics as Record<string, unknown>[] : [];
        return (
          <div key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-label-md text-label-md text-on-surface">{s.subject.name} — {s.classLevel}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {sessionMap[s.sessionId] ?? s.sessionId}
                  {s.file && <span> · <a href={s.file} target="_blank" rel="noopener noreferrer" className="text-primary underline">View document</a></span>}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (confirm("Delete this syllabus?")) {
                    await deleteSyllabusAction(s.id);
                    router.refresh();
                  }
                }}
                className="text-xs text-error hover:underline shrink-0"
              >
                Delete
              </button>
            </div>
            {topics.length > 0 && (
              <div className="mt-3 space-y-2">
                {topics.map((t, i) => (
                  <div key={i} className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-1 rounded">
                    {t.subweek ? <span className="font-medium">{String(t.subweek)}</span> : <span className="font-medium">Wk {String(t.week)}</span>}
                    {" — "}{String(t.topic ?? "")}
                    {Array.isArray(t.subTopics) && (t.subTopics as string[]).length > 0 && (
                      <span className="block mt-0.5 text-on-surface-variant/70">Sub: {(t.subTopics as string[]).join("; ")}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
