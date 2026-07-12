"use client";

import { useActionState, useState, useRef } from "react";
import { uploadNerdcAction, getNerdcContentAction } from "./actions";

export function NerdcUploadClient({ hasExisting }: { hasExisting: boolean }) {
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [state, action, pending] = useActionState(uploadNerdcAction, {});
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setFileContent(reader.result as string);
    reader.readAsText(file);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-white">Upload NERDC Syllabus</h1>
        <p className="font-body-sm text-body-sm text-white/40 mt-1">
          Upload the <code className="text-white/70">nerdc.md</code> file. Its content is stored in the database and used by the Curriculum import parser.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        {hasExisting && (
          <div className="bg-amber-900/20 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-lg text-sm">
            A NERDC file is already stored. Uploading again will replace it.
          </div>
        )}

        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-2">
            Select <code>nerdc.md</code> file
          </label>
          <input ref={fileRef} type="file" accept=".md,.txt" onChange={handleFile}
            className="w-full text-sm text-white/50 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-[#002046] file:text-white hover:file:bg-[#003366]" />
          {fileName && (
            <p className="text-xs text-emerald-400 mt-1">Selected: {fileName} ({(fileContent.length / 1024).toFixed(0)} KB)</p>
          )}
        </div>

        {fileContent && (
          <div className="bg-[#0a0e1a] border border-white/10 rounded-lg p-3 max-h-60 overflow-y-auto">
            <pre className="text-xs text-white/50 whitespace-pre-wrap">{fileContent.slice(0, 2000)}{fileContent.length > 2000 ? "\n..." : ""}</pre>
          </div>
        )}

        <form action={action}>
          <input type="hidden" name="content" value={fileContent} />
          <button type="submit" disabled={pending || !fileContent}
            className="bg-[#002046] hover:bg-[#003366] text-white px-6 py-2 rounded-lg font-label-md text-label-md disabled:opacity-60"
          >{pending ? "Uploading..." : "Upload to Database"}</button>
        </form>

        {state.error && <p className="text-red-400 text-sm">{state.error}</p>}
        {state.success && (
          <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg text-sm">
            {state.success} ({state.lineCount} lines)
          </div>
        )}
      </div>
    </div>
  );
}
