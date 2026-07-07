"use client";

import { useState, useActionState, useTransition } from "react";
import {
  previewStudentCsvAction,
  commitStudentCsvAction,
  type CsvActionState,
} from "./csv-actions";

const blank: CsvActionState = {};

export function StudentCsvImport() {
  const [preview, previewAction, previewPending] = useActionState(
    previewStudentCsvAction,
    blank,
  );
  const [committing, startCommit] = useTransition();
  const [commitMsg, setCommitMsg] = useState("");

  const rows = preview.preview?.rows ?? [];

  async function handleCommit() {
    const fd = new FormData();
    fd.set("rows", JSON.stringify(rows));
    startCommit(async () => {
      const res = await commitStudentCsvAction(blank, fd);
      setCommitMsg(res.success ?? res.error ?? "Done.");
    });
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <h2 className="mb-3 font-headline-sm text-headline-sm text-on-surface font-semibold">
        Import Students (CSV)
      </h2>

      <form action={previewAction} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".csv"
          required
          className="block w-full font-body-sm text-body-sm text-on-surface-variant file:mr-3 file:rounded file:border-0 file:bg-surface-container file:px-3 file:py-1.5 file:font-body-sm file:text-body-sm file:font-medium file:text-on-surface"
        />
        <button
          type="submit"
          disabled={previewPending}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
        >
          {previewPending ? "Parsing…" : "Preview"}
        </button>
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
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Adm No.</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Name</th>
                  <th className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Class</th>
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
                    <td className="px-2 py-1">{r.admissionNumber}</td>
                    <td className="px-2 py-1">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-2 py-1">{r.className || "—"}</td>
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
