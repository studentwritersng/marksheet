"use client";

import { useActionState, useState, useMemo } from "react";
import { parseCurriculumAction, saveCurriculumAction } from "./actions";
import type { ParseResult } from "./actions";

const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];
const TERMS = ["FIRST", "SECOND", "THIRD"];

/** Split sub-topics across sub-week suffixes (A, B, C...) */
function applyMultiWeek(entries: ParseResult[]): ParseResult[] {
  const result: ParseResult[] = [];
  for (const entry of entries) {
    const st = entry.subTopics ?? [];
    if (st.length <= 1) {
      result.push({ ...entry, weekSuffix: "" });
    } else {
      st.forEach((stItem, idx) => {
        const suffix = String.fromCharCode(65 + idx); // A, B, C...
        result.push({
          ...entry,
          weekSuffix: suffix,
          topic: `${entry.topic} (${suffix})`,
          subTopics: [stItem],
        });
      });
    }
  }
  return result;
}

/** Format week display — append suffix if present */
function weekLabel(w: number, s?: string) {
  return s ? `Week ${w}${s}` : `Week ${w}`;
}

export function ImportCurriculumClient({ subjectsByClass }: { subjectsByClass: Record<string, string[]> }) {
  const [classLevel, setClassLevel] = useState("JSS1");
  const [term, setTerm] = useState("FIRST");
  const [subject, setSubject] = useState(subjectsByClass["JSS1"]?.[0] ?? "");
  const [customSubject, setCustomSubject] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [parsed, setParsed] = useState<ParseResult[] | null>(null);
  const [multiWeek, setMultiWeek] = useState(false);
  const [parseState, parseAction, parsePending] = useActionState(parseCurriculumAction, {});
  const [saveState, saveAction, savePending] = useActionState(saveCurriculumAction, {});

  const subjects = subjectsByClass[classLevel] ?? [];
  const effectiveSubject = useCustom ? customSubject : subject;

  const displayEntries = useMemo(() => {
    const source = parseState.parsed ?? parsed ?? [];
    return multiWeek ? applyMultiWeek(source) : source;
  }, [parseState.parsed, parsed, multiWeek]);

  function handleClassChange(val: string) {
    setClassLevel(val);
    setSubject(subjectsByClass[val]?.[0] ?? "");
    setCustomSubject("");
    setUseCustom(false);
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

        <div>
          <label className="font-label-sm text-label-sm text-white/60 block mb-1">Subject</label>
          {useCustom ? (
            <div className="flex gap-2">
              <input type="text" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Type subject name..."
                className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm w-56"
              />
              <button type="button" onClick={() => { setUseCustom(false); setParsed(null); }}
                className="text-xs text-white/40 hover:text-white self-end pb-2"
              >Use list</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={subject} onChange={(e) => { setSubject(e.target.value); setParsed(null); }}
                className="border border-white/10 rounded-lg px-3 py-2 bg-[#0a0e1a] text-white font-body-sm text-body-sm w-56">
                {subjects.length === 0 && <option value="">No subjects available</option>}
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" onClick={() => { setUseCustom(true); setCustomSubject(subject || ""); setParsed(null); }}
                className="text-xs text-white/40 hover:text-white self-end pb-2"
              >Custom</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <form action={parseAction} key={`${classLevel}-${term}-${effectiveSubject}-${useCustom ? "c" : "l"}-parse`}>
            <input type="hidden" name="classLevel" value={classLevel} />
            <input type="hidden" name="term" value={term} />
            <input type="hidden" name="subject" value={effectiveSubject} />
            <button type="submit" disabled={parsePending || !effectiveSubject}
              className="bg-[#002046] hover:bg-[#003366] text-white px-5 py-2 rounded-lg font-label-md text-label-md disabled:opacity-60"
            >{parsePending ? "Parsing..." : "Parse from NERDC"}</button>
          </form>

          <label className="flex items-center gap-2 cursor-pointer text-white/60 hover:text-white text-sm">
            <input type="checkbox" checked={multiWeek} onChange={(e) => setMultiWeek(e.target.checked)}
              className="rounded border-white/20 bg-white/5" />
            Multi-week
          </label>
        </div>
      </div>

      {parseState.error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-lg font-body-sm text-body-sm">
          {parseState.error}
        </div>
      )}

      {parseState.success && !parsed && !parseState.parsed && (
        <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg font-body-sm text-body-sm">
          {parseState.success}
        </div>
      )}

      {(parseState.parsed || parsed) && (
        <>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-label-sm text-label-sm text-white/60 uppercase tracking-wider">
                Preview — {classLevel} {effectiveSubject} {term}
                {multiWeek && <span className="text-amber-400 ml-2">(multi-week split)</span>}
              </h2>
              <span className="text-white/40 text-xs">{displayEntries.length} entr{displayEntries.length === 1 ? "y" : "ies"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase w-24">Week</th>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase">Topic</th>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase">Sub-topics</th>
                    <th className="py-3 px-4 font-label-sm text-label-sm text-white/40 uppercase">Objectives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {displayEntries.map((entry, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-semibold whitespace-nowrap">{weekLabel(entry.week, entry.weekSuffix)}</td>
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

          <div className="flex items-center gap-3">
            <form action={saveAction} key={`${classLevel}-${term}-${effectiveSubject}-${useCustom ? "c" : "l"}-${multiWeek ? "mw" : "sw"}-save`}>
              <input type="hidden" name="classLevel" value={classLevel} />
              <input type="hidden" name="term" value={term} />
              <input type="hidden" name="subject" value={effectiveSubject} />
              <input type="hidden" name="entries" value={JSON.stringify(displayEntries)} />
              <button type="submit" disabled={savePending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-label-md text-label-md disabled:opacity-60"
              >{savePending ? "Saving..." : `Save ${displayEntries.length} Entr${displayEntries.length === 1 ? "y" : "ies"}`}</button>
            </form>
            <button onClick={() => { setParsed(parseState.parsed ?? null); setMultiWeek(false); }}
              className="text-white/50 hover:text-white text-sm">Discard & re-parse</button>
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
