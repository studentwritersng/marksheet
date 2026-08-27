"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AcademicHubData, HubWard } from "./shape";

export default function HubClient({ data }: { data: AcademicHubData }) {
  const [wardId, setWardId] = useState<string>("all");
  const [termId, setTermId] = useState<string>("all");

  const wards = useMemo<HubWard[]>(() => {
    const list = wardId === "all" ? data.wards : data.wards.filter((w) => w.studentId === wardId);
    if (termId === "all") return list;
    return list.map((w) => ({
      ...w,
      terms: w.terms.filter((t) => t.termId === termId),
      homework: w.homework.filter((h) => h.termId === termId),
      exams: w.exams.filter((e) => e.termId === termId),
    }));
  }, [data, wardId, termId]);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex flex-wrap gap-3">
        <select value={wardId} onChange={(e) => setWardId(e.target.value)} className="border border-outline-variant rounded px-3 py-2 bg-surface-container-lowest">
          <option value="all">All wards</option>
          {data.wards.map((w) => (
            <option key={w.studentId} value={w.studentId}>{w.name}</option>
          ))}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className="border border-outline-variant rounded px-3 py-2 bg-surface-container-lowest">
          <option value="all">All terms</option>
          {data.termOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {wards.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant py-8 text-center">No academic data available yet.</p>
      )}

      {wards.map((w) => (
        <section key={w.studentId} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{w.name}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{w.className} · {w.admissionNumber}</p>

          {/* Results */}
          <h4 className="mt-4 font-label-md text-label-md text-on-surface">Published Results</h4>
          {w.terms.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No published results.</p>}
          {w.terms.map((t) => (
            <div key={t.termId} className="mt-2 border border-outline-variant rounded p-3">
              <div className="flex items-center gap-3">
                <span className="font-label-md text-label-md text-on-surface">{t.termName} ({t.sessionLabel})</span>
                <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded font-label-sm text-label-sm">Avg: {t.overallAverage != null ? Math.round(t.overallAverage) : "—"}%</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Pos: #{t.overallPosition ?? "—"}</span>
                <Link href={t.reportCardHref} className="font-label-sm text-label-sm text-primary hover:underline ml-auto">View Report Card</Link>
              </div>
              <table className="w-full text-left mt-2">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Subject</th>
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Score</th>
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Grade</th>
                    <th className="py-2 font-label-sm text-label-sm text-on-surface-variant">Components</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {t.subjects.map((s) => (
                    <tr key={s.subjectId}>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.subjectName}</td>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.totalScore != null ? Math.round(s.totalScore) : "—"}</td>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.grade ?? "—"}</td>
                      <td className="py-2 font-body-sm text-body-sm text-on-surface-variant">
                        {s.components.map((c) => `${c.label}: ${c.raw}`).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Homework */}
          <h4 className="mt-4 font-label-md text-label-md text-on-surface">Homework</h4>
          {w.homework.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No published homework.</p>}
          {w.homework.map((h) => (
            <div key={h.id} className="mt-2 border border-outline-variant rounded p-3 flex items-center gap-3">
              <Link href={h.href} className="font-body-md text-body-md text-on-surface hover:underline">{h.title}</Link>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{h.subjectName}</span>
              {h.dueDate && <span className="font-body-sm text-body-sm text-on-surface-variant">Due: {new Date(h.dueDate).toLocaleDateString()}</span>}
              <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                {h.published && h.percentage != null ? `Score: ${Math.round(h.percentage)}%` : (h.attemptStatus ? h.attemptStatus : "Not submitted")}
              </span>
            </div>
          ))}

          {/* Exams */}
          <h4 className="mt-4 font-label-md text-label-md text-on-surface">Exams</h4>
          {w.exams.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No published exams.</p>}
          {w.exams.map((e) => (
            <div key={e.id} className="mt-2 border border-outline-variant rounded p-3 flex items-center gap-3">
              <Link href={e.href} className="font-body-md text-body-md text-on-surface hover:underline">{e.subjectName} — {e.assessmentTypeLabel}</Link>
              <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                {e.examMark != null ? `Mark: ${e.examMark}` : "No mark yet"}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
