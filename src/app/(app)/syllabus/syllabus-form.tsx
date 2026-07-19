"use client";

import { useState, useActionState, useTransition } from "react";
import {
  createSyllabusAction,
  previewSyllabusCsvAction,
  commitSyllabusCsvAction,
  downloadSyllabusCsvTemplateAction,
  type ActionState,
  type CsvRow,
} from "./actions";

const TERMS = ["FIRST", "SECOND", "THIRD"];
const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

const blank: ActionState = {};

export function SyllabusForm({
  subjects,
  sessions,
  classes,
  classSubjectLinks,
}: {
  subjects: { id: string; name: string }[];
  sessions: { id: string; label: string; isCurrent: boolean }[];
  classes: { id: string; level: string; section: string; department: string }[];
  classSubjectLinks: { classId: string; subjectId: string }[];
}) {
  const [state, formAction, pending] = useActionState(createSyllabusAction, blank);

  // CSV import state
  const [csvPreview, csvPreviewAction, csvPreviewPending] = useActionState(previewSyllabusCsvAction, blank);
  const [committing, startCommit] = useTransition();
  const [commitMsg, setCommitMsg] = useState("");
  const [templateDownloading, setTemplateDownloading] = useState(false);

  // Manual form selections for filtering
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedClassLevel, setSelectedClassLevel] = useState("");

  // Filter subjects by class level
  const classIdsForLevel = classes
    .filter((c) => c.level === selectedClassLevel)
    .map((c) => c.id);
  const linkedSubjectIds = new Set(
    classSubjectLinks
      .filter((l) => classIdsForLevel.includes(l.classId))
      .map((l) => l.subjectId),
  );
  const filteredSubjects = selectedClassLevel
    ? subjects.filter((s) => linkedSubjectIds.has(s.id))
    : [];

  const csvRows = csvPreview.preview?.rows ?? [];

  async function handleCommitCsv() {
    if (csvRows.length === 0) return;
    const fd = new FormData();
    fd.set("subjectId", (document.getElementById("csv-subjectId") as HTMLSelectElement)?.value ?? "");
    fd.set("classLevel", (document.getElementById("csv-classLevel") as HTMLSelectElement)?.value ?? "");
    fd.set("sessionId", (document.getElementById("csv-sessionId") as HTMLSelectElement)?.value ?? "");
    fd.set("term", (document.getElementById("csv-term") as HTMLSelectElement)?.value ?? "");
    fd.set("rows", JSON.stringify(csvRows));
    startCommit(async () => {
      const res = await commitSyllabusCsvAction(blank, fd);
      setCommitMsg(res.success ?? res.error ?? "Done.");
    });
  }

  async function handleDownloadTemplate() {
    setTemplateDownloading(true);
    const { csv, filename } = await downloadSyllabusCsvTemplateAction();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setTemplateDownloading(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Manual Syllabus Form ── */}
      <form action={formAction} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Add / Edit Syllabus</h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="sessionId" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Session</label>
            <select id="sessionId" name="sessionId" required value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Select session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? " (current)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="term" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Term</label>
            <select id="term" name="term" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Select term</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="classLevel" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class Level</label>
            <select id="classLevel" name="classLevel" required value={selectedClassLevel} onChange={(e) => setSelectedClassLevel(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Select level</option>
              {CLASS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="subjectId" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
            <select id="subjectId" name="subjectId" required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Select subject</option>
              {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="file" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Document URL (optional)</label>
          <input id="file" name="file" type="text" placeholder="https://example.com/syllabus.pdf" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest" />
        </div>

        <div>
          <label htmlFor="topics" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Topics (one per line)</label>
          <textarea id="topics" name="topics" rows={6} placeholder="Enter syllabus topics, one per line..." className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest" />
        </div>

        {state.error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700 bg-green-100 px-3 py-2 rounded">{state.success}</p>}

        <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors disabled:opacity-60">
          {pending ? "Saving..." : "Save Syllabus"}
        </button>
      </form>

      {/* ── CSV Import Section ── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Import Syllabus from CSV</h2>

        <p className="font-body-sm text-body-sm text-on-surface-variant">
          The CSV file should have the following columns:
        </p>
        <div className="bg-surface-container-high rounded-lg p-3 font-mono text-xs text-on-surface-variant space-y-1">
          <div><strong className="text-on-surface">term</strong> — FIRST / SECOND / THIRD</div>
          <div><strong className="text-on-surface">week</strong> — Week number (1-13)</div>
          <div><strong className="text-on-surface">weekSuffix</strong> — Optional, e.g. A, B, C for multi-week topics</div>
          <div><strong className="text-on-surface">topic</strong> — Main topic name</div>
          <div><strong className="text-on-surface">subTopics</strong> — Semicolon or comma-separated subtopics</div>
          <div><strong className="text-on-surface">objectives</strong> — Semicolon or comma-separated behavioural objectives</div>
        </div>

        <form action={csvPreviewAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select id="csv-sessionId" name="sessionId" required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? " (current)" : ""}</option>)}
            </select>
            <select id="csv-term" name="term" required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Term</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select id="csv-classLevel" name="classLevel" required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Class Level</option>
              {CLASS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select id="csv-subjectId" name="subjectId" required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Subject</option>
              {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="file" name="file" accept=".csv" required
              className="block w-full font-body-sm text-body-sm text-on-surface-variant file:mr-3 file:rounded file:border-0 file:bg-surface-container file:px-3 file:py-1.5 file:font-body-sm file:text-body-sm file:font-medium file:text-on-surface" />
            <button type="submit" disabled={csvPreviewPending}
              className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60 shrink-0">
              {csvPreviewPending ? "Parsing…" : "Preview"}
            </button>
            <button type="button" onClick={handleDownloadTemplate} disabled={templateDownloading}
              className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded hover:bg-surface-container disabled:opacity-60 shrink-0">
              {templateDownloading ? "…" : "Template"}
            </button>
          </div>
          {csvPreview.error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{csvPreview.error}</p>}
        </form>

        {csvRows.length > 0 && !committing && !commitMsg && (
          <div className="space-y-3">
            <p className="font-label-sm text-label-sm text-on-surface-variant">{csvRows.length} topics found.</p>
            <div className="max-h-48 overflow-y-auto border border-outline-variant rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container-high text-on-surface-variant sticky top-0">
                  <tr>
                    <th className="p-2">Week</th>
                    <th className="p-2">Topic</th>
                    <th className="p-2">Subtopics</th>
                    <th className="p-2">Objectives</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((r, i) => (
                    <tr key={i} className="border-t border-outline-variant/50">
                      <td className="p-2">{r.week}{r.weekSuffix ? ` (${r.weekSuffix})` : ""}</td>
                      <td className="p-2">{r.topic}</td>
                      <td className="p-2 text-on-surface-variant">{(r.subTopics || []).join(", ")}</td>
                      <td className="p-2 text-on-surface-variant">{(r.objectives || []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleCommitCsv}
              className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors">
              Import {csvRows.length} Topics
            </button>
          </div>
        )}

        {committing && <p className="text-sm text-on-surface-variant">Importing...</p>}
        {commitMsg && <p className="text-sm text-green-700 bg-green-100 px-3 py-2 rounded">{commitMsg}</p>}
      </div>
    </div>
  );
}
