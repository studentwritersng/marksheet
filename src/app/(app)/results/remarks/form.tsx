"use client";

import { useState, useActionState, useRef, useEffect } from "react";
import { ClassTermSelector, type StudentVM } from "../term-data-form";
import { saveRemarksAction } from "../term-actions";

interface Template {
  id: string;
  text: string;
}

function TemplateDropdown({
  templates,
  onSelect,
  align = "left",
}: {
  templates: Template[];
  onSelect: (text: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (templates.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary underline hover:no-underline focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        Use template ▾
      </button>
      {open && (
      <div
        role="listbox"
        className={`absolute top-full z-50 mt-1 w-[420px] max-w-[90vw] rounded-lg border border-outline-variant bg-surface-container shadow-lg overflow-hidden ${align === "right" ? "right-0" : "left-0"}`}
      >
          <p className="px-3 py-2 text-xs font-semibold text-on-surface-variant border-b border-outline-variant bg-surface-container-low">
            Templates — best to worst
          </p>
          <ul className="max-h-64 overflow-y-auto divide-y divide-outline-variant">
            {templates.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-surface-container-highest transition-colors"
                  onClick={() => {
                    onSelect(t.text);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-on-surface-variant mr-2">{i + 1}.</span>
                  {t.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RemarksForm({
  classes,
  terms,
  selectedClassId,
  selectedTermId,
  students,
  existingRemarks,
  teacherTemplates = [],
  principalTemplates = [],
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  selectedClassId: string;
  selectedTermId: string;
  students: StudentVM[];
  existingRemarks: Record<string, { teacherComment: string; principalComment: string }>;
  teacherTemplates?: Template[];
  principalTemplates?: Template[];
}) {
  const [state, action, pending] = useActionState(saveRemarksAction, {});
  const [remarks, setRemarks] = useState<Record<string, { teacherComment: string; principalComment: string }>>(existingRemarks);

  function setField(studentId: string, field: "teacherComment" | "principalComment", value: string) {
    setRemarks((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { teacherComment: "", principalComment: "" }), [field]: value },
    }));
  }

  return (
    <div className="space-y-4">
      <ClassTermSelector classes={classes} terms={terms} selectedClassId={selectedClassId} selectedTermId={selectedTermId} />

      {students.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant py-4">No students found in this class.</p>
      )}

      {students.length > 0 && (
        <form action={action}>
          <input type="hidden" name="termId" value={selectedTermId} />
          <input type="hidden" name="remarks" value={JSON.stringify(remarks)} />

          <div className="space-y-3">
            {students.map((s) => (
              <div key={s.id} className="border border-outline-variant rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-label-md text-label-md text-on-surface font-semibold">{s.name}</p>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{s.admissionNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">Teacher&apos;s Comment</label>
                      <TemplateDropdown
                        templates={teacherTemplates}
                        onSelect={(text) => setField(s.id, "teacherComment", text)}
                      />
                    </div>
                    <textarea
                      value={remarks[s.id]?.teacherComment ?? ""}
                      onChange={(e) => setField(s.id, "teacherComment", e.target.value)}
                      onFocus={() => {
                        /* dropdown is triggered by the button, not focus; kept for future extension */
                      }}
                      rows={3}
                      placeholder="Write teacher's comment or use template above..."
                      className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">Principal&apos;s Comment</label>
                      <TemplateDropdown
                        templates={principalTemplates}
                        align="right"
                        onSelect={(text) => setField(s.id, "principalComment", text)}
                      />
                    </div>
                    <textarea
                      value={remarks[s.id]?.principalComment ?? ""}
                      onChange={(e) => setField(s.id, "principalComment", e.target.value)}
                      rows={3}
                      placeholder="Write principal's comment or use template above..."
                      className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-white font-label-md text-label-md py-2 px-6 rounded hover:bg-primary-container disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save All Remarks"}
            </button>
            {state.success && <p className="text-green-700 font-body-sm text-body-sm">{state.success}</p>}
            {state.error && <p className="text-red-600 font-body-sm text-body-sm">{state.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
