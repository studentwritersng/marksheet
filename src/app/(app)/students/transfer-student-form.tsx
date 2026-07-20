"use client";

import { useActionState, useState, useTransition } from "react";
import { transferStudentFromBranchAction, searchGroupStudentsAction, type TransferState } from "./actions";

const init: TransferState = {};

interface ClassOption {
  id: string;
  name: string;
  level: string;
  section: string;
  department: string;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  schoolName: string;
  schoolId: string;
}

const LEVEL_ORDER = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

export function TransferStudentForm({ classes }: { classes: ClassOption[] }) {
  const [state, action, pending] = useActionState(transferStudentFromBranchAction, init);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SearchResult | null>(null);
  const [searching, startSearch] = useTransition();

  // Group classes by level
  const grouped = LEVEL_ORDER.reduce<Record<string, ClassOption[]>>((acc, lvl) => {
    const items = classes.filter((c) => c.level === lvl);
    if (items.length > 0) acc[lvl] = items;
    return acc;
  }, {});

  async function handleSearch(q: string) {
    setQuery(q);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const res = await searchGroupStudentsAction(trimmed);
      setResults(res.results ?? []);
    });
  }

  return (
    <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <h2 className="mb-2 font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">swap_horiz</span>
        Transfer from Branch
      </h2>
      <p className="mb-3 font-label-sm text-label-sm text-on-surface-variant">
        Register a student transferring from another branch in your school group. The origin record is preserved; a new record is created here.
      </p>

      {/* Search for origin student */}
      <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
        Search origin student (name or admission number)
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="e.g. John or TDC00123"
        className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors mb-2"
      />

      {searching && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && !selectedStudent && (
        <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedStudent(r)}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors text-left"
            >
              <div>
                <p className="text-sm text-on-surface font-medium">{r.firstName} {r.lastName}</p>
                <p className="text-xs text-on-surface-variant">{r.schoolName} · #{r.admissionNumber}</p>
              </div>
              <span className="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected student */}
      {selectedStudent && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-on-surface font-medium">{selectedStudent.firstName} {selectedStudent.lastName}</p>
            <p className="text-xs text-on-surface-variant">{selectedStudent.schoolName} · #{selectedStudent.admissionNumber}</p>
          </div>
          <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-on-surface-variant hover:text-error underline">
            Change
          </button>
        </div>
      )}

      <input type="hidden" name="originStudentId" value={selectedStudent?.id ?? ""} />

      {/* Class assignment */}
      <select name="classId" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors mb-2">
        <option value="">— Assign to class (optional) —</option>
        {Object.entries(grouped).map(([level, cls]) => (
          <optgroup key={level} label={level}>
            {cls.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Notes */}
      <input
        name="notes"
        placeholder="Transfer notes (optional)"
        className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors mb-3"
      />

      <button
        type="submit"
        disabled={pending || !selectedStudent}
        className="w-full bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60 transition-colors"
      >
        {pending ? "Transferring..." : "Transfer Student"}
      </button>

      {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600 mt-2">{state.success}</p>}
    </form>
  );
}
