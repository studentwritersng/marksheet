"use client";

import { useState } from "react";
import Link from "next/link";

interface TrackerRow {
  className: string;
  subjectName: string;
  total: number;
  taught: number;
  pct: number;
  topics: { topic: string; week: number; taught: boolean }[];
}

interface ChildOption {
  id: string;
  name: string;
  className: string;
}

interface Props {
  data: TrackerRow[];
  overallPct: number;
  overallTaught: number;
  overallTotal: number;
  termName: string;
  isAdmin: boolean;
  teacherSubjects: { subjectId: string; subjectName: string; classNames: string[] }[];
  studentClassId: string | null;
  childrenList?: ChildOption[];
  selectedChildId?: string | null;
}

export function CurriculumTrackerView({
  data,
  overallPct,
  overallTaught,
  overallTotal,
  termName,
  isAdmin,
  teacherSubjects,
  studentClassId,
  childrenList = [],
  selectedChildId = null,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Filter data based on role
  const filteredData = studentClassId
    ? data.filter((r) => {
        // Find the class ID that matches this className
        return true; // student sees all their class subjects
      })
    : data;

  // Group by class
  const byClass = new Map<string, TrackerRow[]>();
  for (const row of filteredData) {
    const existing = byClass.get(row.className) ?? [];
    existing.push(row);
    byClass.set(row.className, existing);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Curriculum Tracker</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {termName} Term — {overallTaught} of {overallTotal} topics covered ({overallPct}%)
        </p>
      </div>

      {childrenList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4 mb-6">
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Viewing ward</p>
          <div className="flex flex-wrap gap-2">
            {childrenList.map((c) => {
              const active = c.id === selectedChildId;
              return (
                <Link
                  key={c.id}
                  href={`/curriculum-tracker?childId=${c.id}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary"
                  }`}
                >
                  {c.name}
                  <span className="ml-1 text-xs opacity-80">{c.className}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-label-md text-label-md text-on-surface-variant">Overall Progress</h3>
          <span className="font-headline-sm text-headline-sm font-bold" style={{ color: overallPct >= 75 ? "#15803d" : overallPct >= 50 ? "#d97706" : "#dc2626" }}>
            {overallPct}%
          </span>
        </div>
        <div className="h-3 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${overallPct}%`,
              backgroundColor: overallPct >= 75 ? "#15803d" : overallPct >= 50 ? "#d97706" : "#dc2626",
            }}
          />
        </div>
      </div>

      {/* Per-class breakdown */}
      {Array.from(byClass.entries()).map(([className, rows]) => {
        const classTaught = rows.reduce((a, r) => a + r.taught, 0);
        const classTotal = rows.reduce((a, r) => a + r.total, 0);
        const classPct = classTotal > 0 ? Math.round((classTaught / classTotal) * 100) : 0;

        return (
          <div key={className} className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-label-md text-label-md text-on-surface">{className}</h3>
              <span className="font-label-sm text-label-sm font-semibold" style={{ color: classPct >= 75 ? "#15803d" : classPct >= 50 ? "#d97706" : "#dc2626" }}>
                {classTaught}/{classTotal} ({classPct}%)
              </span>
            </div>
            <div className="h-2 bg-surface-container rounded-full mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${classPct}%`,
                  backgroundColor: classPct >= 75 ? "#15803d" : classPct >= 50 ? "#d97706" : "#dc2626",
                }}
              />
            </div>

            <div className="space-y-2">
              {rows.map((row) => {
                const key = `${row.className}-${row.subjectName}`;
                const isExpanded = expandedKey === key;

                return (
                  <div key={key} className="border border-outline-variant/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface">{row.subjectName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-sm text-label-sm font-semibold" style={{ color: row.pct >= 75 ? "#15803d" : row.pct >= 50 ? "#d97706" : "#dc2626" }}>
                          {row.pct}%
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{row.taught}/{row.total}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-outline-variant/50 px-4 py-3 bg-surface-container-lowest">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-outline-variant/50">
                              <th className="py-1.5 pr-2 text-left font-label-sm text-label-sm text-on-surface-variant">Week</th>
                              <th className="py-1.5 pr-2 text-left font-label-sm text-label-sm text-on-surface-variant">Topic</th>
                              <th className="py-1.5 text-right font-label-sm text-label-sm text-on-surface-variant">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.topics.map((t, i) => (
                              <tr key={i} className="border-b border-outline-variant/30">
                                <td className="py-1.5 pr-2 text-on-surface-variant">{t.week}</td>
                                <td className="py-1.5 pr-2 text-on-surface">{t.topic}</td>
                                <td className="py-1.5 text-right">
                                  {t.taught ? (
                                    <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                      Done
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-on-surface-variant">
                                      <span className="material-symbols-outlined text-[14px]">radio_button_unchecked</span>
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredData.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-outline-variant">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-2">checklist</span>
          <p className="font-body-md text-body-md text-on-surface-variant">No curriculum topics found for your classes.</p>
        </div>
      )}
    </div>
  );
}
