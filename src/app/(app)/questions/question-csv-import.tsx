"use client";

import { useState, useRef } from "react";
import { useActionState } from "react";
import { csvImportQuestionsAction } from "./actions";
import { getMcqCsvTemplate, getEssayCsvTemplate } from "@/lib/csv/question-template";

export function QuestionCsvImport({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<{ rows: any[]; summary: any } | null>(null);
  const [state, formAction, pending] = useActionState(csvImportQuestionsAction, {});
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
      // Show preview
      import("@/lib/csv/question-import").then((mod) => {
        const result = mod.parseQuestionCsv(text);
        setPreview(result);
      });
    };
    reader.readAsText(file);
  }

  const previewRows = preview?.rows ?? [];
  const previewSummary = preview?.summary;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Import Questions from CSV</h2>

      <div className="flex flex-wrap gap-2">
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(getMcqCsvTemplate())}`}
          download="mcq-template.csv"
          className="text-xs bg-primary-container text-on-primary-container px-3 py-1.5 rounded font-semibold hover:opacity-80"
        >
          Download MCQ Template
        </a>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(getEssayCsvTemplate())}`}
          download="essay-template.csv"
          className="text-xs bg-primary-container text-on-primary-container px-3 py-1.5 rounded font-semibold hover:opacity-80"
        >
          Download Essay Template
        </a>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="csv-subject" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Target Subject</label>
          <select id="csv-subject" name="subjectId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="">Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Upload CSV File</label>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-on-surface file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-on-primary hover:file:bg-primary-container" />
        </div>

        {csvContent && (
          <>
            <input type="hidden" name="csvContent" value={csvContent} />

            {previewSummary && (
              <div className="text-xs text-on-surface-variant">
                Preview: {previewSummary.total} rows · {previewSummary.valid} valid · {previewSummary.invalid} invalid
              </div>
            )}

            {previewRows.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-outline-variant rounded text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-container-high text-left">
                      <th className="p-2">Row</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Text</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-outline-variant">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2">{r.type}</td>
                        <td className="p-2 truncate max-w-xs">{r.text}</td>
                        <td className={`p-2 font-semibold ${r.valid ? "text-green-600" : "text-error"}`}>
                          {r.valid ? "OK" : r.errors.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {state.error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700 bg-green-100 px-3 py-2 rounded">{state.success}</p>}

        {csvContent && (
          <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors disabled:opacity-60">
            {pending ? "Importing..." : "Import Questions"}
          </button>
        )}
      </form>
    </div>
  );
}
