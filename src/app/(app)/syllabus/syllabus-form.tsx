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
const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

const blank: ActionState = {};

interface TopicEntry {
  subweek: string;
  topic: string;
  subTopics: string;
  objectives: string;
}

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

  // Manual form selections
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedClassLevel, setSelectedClassLevel] = useState("");

  // CSV section selections (independent controlled state)
  const [csvSession, setCsvSession] = useState("");
  const [csvTerm, setCsvTerm] = useState("");
  const [csvClassLevel, setCsvClassLevel] = useState("");
  const [csvSubjectId, setCsvSubjectId] = useState("");

  // Manual topic rows
  const [topicRows, setTopicRows] = useState<TopicEntry[]>([
    { subweek: "", topic: "", subTopics: "", objectives: "" },
  ]);

  function filterSubjectsByLevel(level: string) {
    const ids = classes.filter((c) => c.level === level).map((c) => c.id);
    const linked = new Set(
      classSubjectLinks.filter((l) => ids.includes(l.classId)).map((l) => l.subjectId),
    );
    return level ? subjects.filter((s) => linked.has(s.id)) : [];
  }

  const filteredSubjects = filterSubjectsByLevel(selectedClassLevel);
  const csvFilteredSubjects = filterSubjectsByLevel(csvClassLevel);

  const csvRows = csvPreview.preview?.rows ?? [];

  function addTopicRow() {
    setTopicRows([...topicRows, { subweek: "", topic: "", subTopics: "", objectives: "" }]);
  }

  function removeTopicRow(i: number) {
    if (topicRows.length > 1) setTopicRows(topicRows.filter((_, idx) => idx !== i));
  }

  function updateTopicRow(i: number, field: keyof TopicEntry, value: string) {
    const next = [...topicRows];
    next[i] = { ...next[i], [field]: value };
    setTopicRows(next);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    fd.delete("topicRows");
    fd.set("topicRows", JSON.stringify(topicRows.filter((r) => r.topic.trim())));
    formAction(fd);
  }

  async function handleCommitCsv() {
    if (csvRows.length === 0) return;
    const fd = new FormData();
    fd.set("subjectId", csvSubjectId);
    fd.set("classLevel", csvClassLevel);
    fd.set("sessionId", csvSession);
    fd.set("term", csvTerm);
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
      <form onSubmit={handleManualSubmit} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
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

        {/* Topic entries table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant">Topic Entries</label>
            <button type="button" onClick={addTopicRow}
              className="text-xs text-primary font-medium hover:underline">+ Add Row</button>
          </div>
          <div className="overflow-x-auto border border-outline-variant rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-container-high text-on-surface-variant">
                <tr>
                  <th className="p-2 w-[80px]">Subweek</th>
                  <th className="p-2">Topic</th>
                  <th className="p-2">Subtopics (; separated)</th>
                  <th className="p-2">Objectives (; separated)</th>
                  <th className="p-2 w-[50px]"></th>
                </tr>
              </thead>
              <tbody>
                {topicRows.map((r, i) => (
                  <tr key={i} className="border-t border-outline-variant/50">
                    <td className="p-1">
                      <input type="text" value={r.subweek} onChange={(e) => updateTopicRow(i, "subweek", e.target.value)}
                        placeholder="e.g. 1.1"
                        className="w-full border border-outline-variant rounded p-1.5 font-body-sm text-body-sm bg-surface-container-lowest" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={r.topic} onChange={(e) => updateTopicRow(i, "topic", e.target.value)}
                        placeholder="Topic name"
                        className="w-full border border-outline-variant rounded p-1.5 font-body-sm text-body-sm bg-surface-container-lowest" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={r.subTopics} onChange={(e) => updateTopicRow(i, "subTopics", e.target.value)}
                        placeholder="Subtopics separated by ;"
                        className="w-full border border-outline-variant rounded p-1.5 font-body-sm text-body-sm bg-surface-container-lowest" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={r.objectives} onChange={(e) => updateTopicRow(i, "objectives", e.target.value)}
                        placeholder="Objectives separated by ;"
                        className="w-full border border-outline-variant rounded p-1.5 font-body-sm text-body-sm bg-surface-container-lowest" />
                    </td>
                    <td className="p-1">
                      {topicRows.length > 1 && (
                        <button type="button" onClick={() => removeTopicRow(i)}
                          className="text-error text-xs hover:underline">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div><strong className="text-on-surface">subweek</strong> — e.g. 1, 1.1, 1.2, 2, 2.1</div>
          <div><strong className="text-on-surface">topic</strong> — Main topic name</div>
          <div><strong className="text-on-surface">subTopics</strong> — Semicolon-separated subtopics</div>
          <div><strong className="text-on-surface">objectives</strong> — Semicolon-separated behavioural objectives</div>
        </div>

        <form id="csv-form" action={csvPreviewAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select name="sessionId" required value={csvSession} onChange={(e) => setCsvSession(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? " (current)" : ""}</option>)}
            </select>
            <select name="term" required value={csvTerm} onChange={(e) => setCsvTerm(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Term</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select name="classLevel" required value={csvClassLevel} onChange={(e) => setCsvClassLevel(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Class Level</option>
              {CLASS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select name="subjectId" required value={csvSubjectId} onChange={(e) => setCsvSubjectId(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
              <option value="">Subject</option>
              {csvFilteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            {csvPreview.existing && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded-xl font-body-sm text-body-sm">
                ⚠ A syllabus and/or curriculum already exists for this subject/class/session/term.
                Importing will <strong>overwrite</strong> the existing data.
              </div>
            )}
            <p className="font-label-sm text-label-sm text-on-surface-variant">{csvRows.length} topics found.</p>
            <div className="max-h-48 overflow-y-auto border border-outline-variant rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container-high text-on-surface-variant sticky top-0">
                  <tr>
                    <th className="p-2">Subweek</th>
                    <th className="p-2">Topic</th>
                    <th className="p-2">Subtopics</th>
                    <th className="p-2">Objectives</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((r, i) => (
                    <tr key={i} className="border-t border-outline-variant/50">
                      <td className="p-2">{r.subweek}</td>
                      <td className="p-2">{r.topic}</td>
                      <td className="p-2 text-on-surface-variant">{(r.subTopics || []).join("; ")}</td>
                      <td className="p-2 text-on-surface-variant">{(r.objectives || []).join("; ")}</td>
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
