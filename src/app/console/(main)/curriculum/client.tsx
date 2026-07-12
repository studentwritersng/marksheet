"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { parseCurriculumAction, saveCurriculumAction } from "./actions";
import type { ParseResult } from "./actions";

const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];
const TERMS = ["FIRST", "SECOND", "THIRD"];

// Comprehensive NERDC subject list
const ALL_SUBJECTS = [
  "English Studies", "English Language", "General Mathematics", "Mathematics",
  "Physical and Health Education", "Christian Religious Studies", "Islamic Studies",
  "Nigerian History", "History", "Social and Citizenship Studies", "Citizenship and Heritage Studies",
  "Cultural and Creative Arts", "French", "Intermediate Science", "Basic Science",
  "Biology", "Chemistry", "Physics", "Digital Technologies", "Computer Studies",
  "Business Studies", "Agriculture", "Agricultural Science", "Economics",
  "Government", "Geography", "Literature in English", "Commerce", "Accounting",
  "Further Mathematics", "Foods & Nutrition", "Technical Drawing", "Visual Arts",
  "Marketing", "Catering Craft", "Civic Education",
];

export function ImportCurriculumClient() {
  const [classLevel, setClassLevel] = useState("JSS1");
  const [term, setTerm] = useState("FIRST");
  const [subject, setSubject] = useState(ALL_SUBJECTS[0]);
  const [subjectInput, setSubjectInput] = useState(ALL_SUBJECTS[0]);
  const [showSubjectList, setShowSubjectList] = useState(false);
  const [parsed, setParsed] = useState<ParseResult[] | null>(null);
  const [parseState, parseAction, parsePending] = useActionState(parseCurriculumAction, {});
  const [saveState, saveAction, savePending] = useActionState(saveCurriculumAction, {});
  const subjectRef = useRef<HTMLDivElement>(null);

  const filteredSubjects = ALL_SUBJECTS.filter((s) =>
    s.toLowerCase().includes(subjectInput.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (subjectRef.current && !subjectRef.current.contains(e.target as Node)) {
        setShowSubjectList(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleClassChange(val: string) {
    setClassLevel(val);
    setParsed(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-white">Import NERDC Curriculum</h1>
        <p className="font-body-sm text-body-sm text-white/40 mt-1">
          Parse the NERDC syllabus for a class, term, and subject. AI extracts structured topics with behavioural objectives.
        </p>
      </div>

      {/* Selector + Parse button */}
      <div className="flex flex-wrap items-end gap-4 bg-white/5 border border-white/10 rounded-xl p-5">
        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Class</label>
          <select value={classLevel} onChange={(e) => handleClassChange(e.target.value)}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm">
            {CLASS_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Term</label>
          <select value={term} onChange={(e) => { setTerm(e.target.value); setParsed(null); }}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm">
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="relative" ref={subjectRef}>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Subject</label>
          <input type="text" value={subjectInput}
            onChange={(e) => { setSubjectInput(e.target.value); setShowSubjectList(true); setParsed(null); }}
            onFocus={() => setShowSubjectList(true)}
            className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm w-64"
          />
          {showSubjectList && filteredSubjects.length > 0 && (
            <div className="absolute z-50 mt-1 w-64 max-h-48 overflow-y-auto bg-[#0a0e1a] border border-white/10 rounded-lg shadow-xl">
              {filteredSubjects.slice(0, 10).map((s) => (
                <button key={s} type="button" onClick={() => { setSubject(s); setSubjectInput(s); setShowSubjectList(false); setParsed(null); }}
                  className={`block w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 ${s === subject ? "bg-white/10" : ""}`}
                >{s}</button>
              ))}
            </div>
          )}
        </div>
        <form action={parseAction} key={`${classLevel}-${term}-${subject}-parse`}>
          <input type="hidden" name="classLevel" value={classLevel} />
          <input type="hidden" name="term" value={term} />
          <input type="hidden" name="subject" value={subject} />
          <button type="submit" disabled={parsePending}
            className="bg-[#002046] hover:bg-[#003366] text-white px-5 py-2 rounded-lg font-label-md text-label-md disabled:opacity-60"
          >{parsePending ? "Parsing..." : "Parse with AI"}</button>
        </form>
      </div>

      {parseState.error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-lg font-body-sm text-body-sm">
          {parseState.error}
        </div>
      )}

      {parseState.success && parseState.parsed && !parsed && (
        <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg font-body-sm text-body-sm">
          {parseState.success}
        </div>
      )}

      {/* Preview / Re-parse */}
      {(parseState.parsed || parsed) && (
        <>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-label-sm text-label-sm text-white/60 uppercase tracking-wider">
                Preview — {classLevel} {subject} {term}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setParsed(parseState.parsed ?? null)}
                  className="text-white/50 hover:text-white text-xs"
                >Refresh preview</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase w-16">Week</th>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase">Topic</th>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase">Sub-topics</th>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase">Objectives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(parseState.parsed ?? parsed ?? []).map((entry, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-semibold">Week {entry.week}</td>
                      <td className="py-3 px-4 text-white">{entry.topic}</td>
                      <td className="py-3 px-4">
                        <ul className="list-disc list-inside text-sm text-white/70 space-y-0.5">
                          {(entry.subTopics ?? []).map((st, j) => <li key={j}>{st}</li>)}
                        </ul>
                      </td>
                      <td className="py-3 px-4">
                        <ul className="list-disc list-inside text-sm text-white/70 space-y-0.5">
                          {(entry.behaviouralObjectives ?? []).map((o, j) => <li key={j}>{o}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save / Re-parse */}
          <div className="flex items-center gap-3">
            <form action={saveAction} key={`${classLevel}-${term}-${subject}-save`}>
              <input type="hidden" name="classLevel" value={classLevel} />
              <input type="hidden" name="term" value={term} />
              <input type="hidden" name="subject" value={subject} />
              <input type="hidden" name="entries" value={JSON.stringify(parseState.parsed ?? parsed ?? [])} />
              <button type="submit" disabled={savePending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-label-md text-label-md disabled:opacity-60"
              >{savePending ? "Saving..." : `Save ${(parseState.parsed ?? parsed ?? []).length} Entries`}</button>
            </form>
            <button onClick={() => setParsed(null)}
              className="text-white/50 hover:text-white text-sm">Discard &amp; re-parse</button>
          </div>

          {saveState.error && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-lg font-body-sm text-body-sm">
              {saveState.error}
            </div>
          )}
          {saveState.success && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg font-body-sm text-body-sm">
              {saveState.success}
            </div>
          )}
        </>
      )}
    </div>
  );
}
