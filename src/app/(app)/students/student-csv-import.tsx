"use client";

import { useState, useActionState, useTransition } from "react";
import {
  previewStudentCsvAction,
  commitStudentCsvAction,
  type CsvActionState,
} from "./csv-actions";
import { downloadStudentCsvAction } from "./csv-download";

const blank: CsvActionState = {};

interface ClassVM {
  id: string;
  name: string;
  department: string;
}

export function StudentCsvImport({ classes }: { classes: ClassVM[] }) {
  const [preview, previewAction, previewPending] = useActionState(
    previewStudentCsvAction,
    blank,
  );
  const [committing, startCommit] = useTransition();
  const [commitMsg, setCommitMsg] = useState("");
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [targetClassId, setTargetClassId] = useState("");

  const rows = preview.preview?.rows ?? [];

  async function handleCommit() {
    if (!targetClassId) {
      setCommitMsg("Please select the class to import into before committing.");
      return;
    }
    const fd = new FormData();
    fd.set("rows", JSON.stringify(rows));
    if (targetClassId) fd.set("defaultClassId", targetClassId);
    startCommit(async () => {
      const res = await commitStudentCsvAction(blank, fd);
      setCommitMsg(res.success ?? res.error ?? "Done.");
    });
  }

  async function handleDownloadTemplate() {
    setTemplateDownloading(true);
    const { csv, filename } = await downloadStudentCsvAction();
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
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <h2 className="mb-3 font-headline-sm text-headline-sm text-on-surface font-semibold">
        Import Students (CSV)
      </h2>

      {/* Target class — lets the admin decide where these students go */}
      <div className="mb-3">
        <label htmlFor="defaultClass" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
          Import into class
        </label>
        <select
          id="defaultClass"
          value={targetClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          className="w-full border border-outline-variant rounded p-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        >
          <option value="">— Select class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.department ? ` (${c.department})` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-on-surface-variant">
          All rows in the CSV are imported into this class. The template no longer includes a class column.
          The <code>department</code> column is only used for classes that have departments (e.g. SSS), and is ignored for other classes.
        </p>
      </div>

      <form action={previewAction} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".csv"
          required
          className="block w-full font-body-sm text-body-sm text-on-surface-variant file:mr-3 file:rounded file:border-0 file:bg-surface-container file:px-3 file:py-1.5 file:font-body-sm file:text-body-sm file:font-medium file:text-on-surface"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={previewPending}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {previewPending ? "Parsing…" : "Preview"}
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={templateDownloading}
            className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded hover:bg-surface-container disabled:opacity-60"
          >
            {templateDownloading ? "…" : "Download Template"}
          </button>
        </div>
        {preview.error && <p className="text-sm text-red-600">{preview.error}</p>}
      </form>

      {preview.preview && (
        <div className="mt-4">
          <p className="mb-2 font-label-sm text-label-sm text-on-surface-variant">
            {preview.preview.summary.valid} valid ·{" "}
            {preview.preview.summary.invalid} invalid ·{" "}
            {preview.preview.summary.total} total
          </p>

          <div className="max-h-60 overflow-y-auto rounded border border-outline-variant">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-container">
                <tr>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">#</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Name</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">DOB</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Gender</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Dept</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Guardian</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.row}
                    className={
                      r.valid ? "border-t border-outline-variant" : "border-t border-red-100 bg-error-container"
                    }
                  >
                    <td className="px-2 py-1 text-on-surface-variant">{r.row}</td>
                    <td className="px-2 py-1">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-2 py-1 text-on-surface-variant text-[10px]">{r.dateOfBirth || "—"}</td>
                    <td className="px-2 py-1 text-on-surface-variant text-[10px]">{r.gender || "—"}</td>
                    <td className="px-2 py-1 text-on-surface-variant text-[10px]">{r.department || "—"}</td>
                    <td className="px-2 py-1 text-on-surface-variant text-[10px]">{r.guardianName || "—"}</td>
                    <td className="px-2 py-1">
                      {r.valid ? (
                        <span className="text-green-600">OK</span>
                      ) : (
                        <span className="text-red-600" title={r.errors.join("; ")}>
                          {r.errors.length} error(s)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.preview.summary.valid > 0 && (
            <button
              onClick={handleCommit}
              disabled={committing}
              className="mt-3 bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
            >
              {committing ? "Committing…" : `Commit ${preview.preview.summary.valid} valid row(s)`}
            </button>
          )}
          {commitMsg && <p className="mt-2 font-body-sm text-body-sm text-on-surface">{commitMsg}</p>}
        </div>
      )}
    </div>
  );
}
