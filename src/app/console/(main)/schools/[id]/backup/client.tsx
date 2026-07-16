"use client";

import { useState, useTransition } from "react";
import { importSchoolBackupAction } from "./actions";

export function BackupClient({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  const handleImport = () => {
    if (!file) return;
    startTransition(async () => {
      const text = await file.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { setResult({ error: "Invalid JSON file." }); return; }
      if (!parsed.version || !parsed.data) { setResult({ error: "Not a valid school backup file." }); return; }

      const res = await importSchoolBackupAction(schoolId, parsed);
      setResult(res);
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Backup & Restore</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Restore a backup file for <strong>{schoolName}</strong>
      </p>

      {/* Export Section */}
      <div className="bg-white border border-outline-variant rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-on-surface mb-2">Download Backup</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          To create a backup, go to the school&apos;s Settings page and use the Backup & Restore section there.
          This page is for restoring backups into this school.
        </p>
        <a
          href={`/console/schools/${schoolId}`}
          className="inline-block border border-outline-variant text-on-surface text-sm py-2 px-4 rounded-lg hover:bg-surface-container-high transition-colors"
        >
          Back to School Details
        </a>
      </div>

      {/* Import Section */}
      <div className="bg-white border border-outline-variant rounded-xl p-6">
        <h2 className="text-lg font-semibold text-on-surface mb-2">Restore Backup</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Upload a previously downloaded backup JSON file. Existing data (e.g. students with matching admission numbers,
          users with matching emails) will be skipped rather than duplicated.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Backup File (.json)</label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[#002046] file:text-white file:text-sm hover:file:bg-[#003366]"
            />
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={!file || pending}
            className="bg-[#002046] text-white text-sm py-2.5 px-6 rounded-lg hover:bg-[#003366] disabled:opacity-60 transition-colors"
          >
            {pending ? "Restoring…" : "Restore Backup"}
          </button>
        </div>

        {result?.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{result.error}</p>
          </div>
        )}
        {result?.success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-medium">Success</p>
            <p className="text-sm text-green-600 mt-1">{result.success}</p>
          </div>
        )}
      </div>
    </div>
  );
}
