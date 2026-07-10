"use client";

import { useState } from "react";

export interface StudentVM {
  id: string;
  name: string;
  admissionNumber: string;
}

export function ClassTermSelector({
  classes, terms, selectedClassId, selectedTermId,
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  selectedClassId: string;
  selectedTermId: string;
}) {
  return (
    <form method="GET" className="flex flex-wrap gap-4">
      <div>
        <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Class</label>
        <select name="classId" defaultValue={selectedClassId}
          onChange={(e) => { const p = new URLSearchParams(window.location.search); p.set("classId", e.target.value); window.location.search = p.toString(); }}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
        >{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div>
        <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Term</label>
        <select name="termId" defaultValue={selectedTermId}
          onChange={(e) => { const p = new URLSearchParams(window.location.search); p.set("termId", e.target.value); window.location.search = p.toString(); }}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
        >{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
    </form>
  );
}

export function useTermForm(action: (prev: any, fd: FormData) => any, pending: boolean, state: any) {
  const [dirty, setDirty] = useState(false);
  return { dirty, setDirty, action, pending, state };
}
