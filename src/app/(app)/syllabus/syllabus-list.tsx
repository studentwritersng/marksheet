"use client";

import { useRouter } from "next/navigation";
import { deleteSyllabusAction } from "./actions";

export function SyllabusList({
  syllabi,
}: {
  syllabi: {
    id: string;
    classLevel: string;
    file: string | null;
    parsedTopics: unknown;
    createdAt: Date;
    subject: { name: string };
  }[];
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
        const topics = Array.isArray(s.parsedTopics) ? s.parsedTopics as string[] : [];
        return (
          <div key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-label-md text-label-md text-on-surface">{s.subject.name} — {s.classLevel}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString()}
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topics.map((t, i) => (
                  <span key={i} className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
