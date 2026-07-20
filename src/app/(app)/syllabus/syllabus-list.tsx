"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSyllabiByClassAction,
  deleteSyllabusAction,
  deleteSyllabusBulkAction,
  type ActionState,
} from "./actions";

export function SyllabusList({
  classLevels,
  schoolId,
}: {
  classLevels: string[];
  schoolId: string;
}) {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState("");
  const [syllabi, setSyllabi] = useState<{ id: string; subjectId: string; subjectName: string; sessionLabel: string; createdAt: Date; parsedTopics: Record<string, unknown>[] | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Bulk delete state
  const [bulkSessionId, setBulkSessionId] = useState("");
  const [bulkClassLevel, setBulkClassLevel] = useState("");
  const [bulkSubjectId, setBulkSubjectId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  async function handleClassChange(level: string) {
    setSelectedClass(level);
    setSelectedSubjectId(null);
    setBulkClassLevel(level);
    setMessage(null);
    if (!level) { setSyllabi([]); return; }
    setLoading(true);
    const data = await getSyllabiByClassAction(level, schoolId);
    setSyllabi(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this syllabus?")) return;
    const res = await deleteSyllabusAction(id);
    if (res.error) setMessage({ type: "error", text: res.error });
    else {
      setMessage({ type: "success", text: res.success! });
      setSyllabi(syllabi.filter((s) => s.id !== id));
      setSelectedSubjectId(null);
      router.refresh();
    }
  }

  async function handleBulkDelete() {
    if (!confirm("Delete all matching syllabi? This cannot be undone.")) return;
    setBulkLoading(true);
    const fd = new FormData();
    fd.set("sessionId", bulkSessionId);
    fd.set("classLevel", bulkClassLevel);
    fd.set("subjectId", bulkSubjectId);
    const res = await deleteSyllabusBulkAction({}, fd);
    if (res.error) setMessage({ type: "error", text: res.error });
    else {
      setMessage({ type: "success", text: res.success! });
      setSyllabi([]);
      setSelectedSubjectId(null);
      router.refresh();
    }
    setBulkLoading(false);
  }

  const selectedSyllabus = selectedSubjectId
    ? syllabi.find((s) => s.subjectId === selectedSubjectId)
    : null;

  return (
    <>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Saved Syllabi</h2>
          <select
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            className="border border-outline-variant rounded p-2 font-body-md text-body-md text-on-surface bg-surface-container-lowest max-w-xs"
          >
            <option value="">Select class level</option>
            {classLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-xl font-body-sm text-body-sm ${
            message.type === "success"
              ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
              : "bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]"
          }`}>
            {message.text}
          </div>
        )}

        {loading && <p className="font-body-md text-body-md text-on-surface-variant">Loading...</p>}

        {!selectedClass && !loading && (
          <p className="font-body-md text-body-md text-on-surface-variant text-center py-8">
            Select a class level to view saved syllabi.
          </p>
        )}

        {selectedClass && !loading && syllabi.length === 0 && (
          <p className="font-body-md text-body-md text-on-surface-variant text-center py-8">
            No syllabi found for {selectedClass}. Use the form above to upload one.
          </p>
        )}

        {selectedClass && !loading && syllabi.length > 0 && (
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">
              {syllabi.length} subject{syllabi.length !== 1 ? "s" : ""} with syllabi
            </p>
            <div className="space-y-1">
              {syllabi.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedSubjectId === s.subjectId
                      ? "bg-primary-container text-primary"
                      : "hover:bg-surface-container-high"
                  }`}
                  onClick={() => setSelectedSubjectId(
                    selectedSubjectId === s.subjectId ? null : s.subjectId,
                  )}
                >
                  <div>
                    <span className="font-label-md text-label-md">{s.subjectName}</span>
                    <span className="text-xs text-on-surface-variant ml-2">{s.sessionLabel}</span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    {selectedSubjectId === s.subjectId ? "expand_less" : "chevron_right"}
                  </span>
                </div>
              ))}
            </div>

            {selectedSyllabus && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-lg">
                  <div>
                    <h3 className="font-label-md text-label-md text-on-surface">{selectedSyllabus.subjectName}</h3>
                    <p className="text-xs text-on-surface-variant">{selectedSyllabus.sessionLabel} — uploaded {new Date(selectedSyllabus.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(selectedSyllabus.id)}
                    className="text-xs text-error font-medium hover:underline"
                  >
                    Delete
                  </button>
                </div>

                {selectedSyllabus.parsedTopics && selectedSyllabus.parsedTopics.length > 0 && (
                  <div className="border border-outline-variant rounded-lg overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-surface-container-high text-on-surface-variant">
                        <tr>
                          <th className="p-2">Term</th>
                          <th className="p-2">Subweek</th>
                          <th className="p-2">Topic</th>
                          <th className="p-2">Subtopics</th>
                          <th className="p-2">Objectives</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSyllabus.parsedTopics.map((row, i) => (
                          <tr key={i} className="border-t border-outline-variant/50">
                            <td className="p-2">{(row as any).term ?? ""}</td>
                            <td className="p-2">{(row as any).subweek ?? ""}</td>
                            <td className="p-2 font-medium">{(row as any).topic ?? ""}</td>
                            <td className="p-2 text-on-surface-variant">{((row as any).subTopics ?? []).join("; ")}</td>
                            <td className="p-2 text-on-surface-variant">{((row as any).objectives ?? []).join("; ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(!selectedSyllabus.parsedTopics || selectedSyllabus.parsedTopics.length === 0) && (
                  <p className="text-xs text-on-surface-variant italic">No topic entries for this syllabus.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bulk Delete ── */}
      <div className="bg-surface-container-lowest border border-error/30 rounded-xl p-5 space-y-3">
        <h2 className="font-headline-sm text-headline-sm text-error">Bulk Delete</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Delete all syllabi matching the filters below. This action cannot be undone.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={bulkSessionId} onChange={(e) => setBulkSessionId(e.target.value)}
            className="border border-outline-variant rounded p-2 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="">All sessions</option>
            {/* Sessions will be fetched but we don't have them here; user can select class filter instead */}
          </select>
          <select value={bulkClassLevel} onChange={(e) => setBulkClassLevel(e.target.value)}
            className="border border-outline-variant rounded p-2 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="">All class levels</option>
            {classLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={handleBulkDelete} disabled={bulkLoading}
            className="bg-error text-on-error font-label-md text-label-md py-2 px-4 rounded hover:bg-error/90 disabled:opacity-60">
            {bulkLoading ? "Deleting..." : "Delete Matching"}
          </button>
        </div>
      </div>
    </>
  );
}
