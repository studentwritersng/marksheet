"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from "react";
import { getStudentQrCards, searchQrCardStudents, type StudentQrCard } from "@/lib/attendance/actions";

interface Props {
  schoolId: string;
  classes: { id: string; name: string }[];
}

interface StudentOption {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  className: string;
}

export function QrCardsClient({ schoolId, classes }: Props) {
  const [scope, setScope] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [cards, setCards] = useState<StudentQrCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const onStudentQueryChange = async (q: string) => {
    setStudentQuery(q);
    setSelectedStudent(null);
    if (q.trim().length < 2) {
      setStudentResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const res = await searchQrCardStudents(schoolId, q);
      setStudentResults(res.students);
      setShowResults(true);
    } finally {
      setSearching(false);
    }
  };

  const loadCards = useCallback(async () => {
    if (scope === "student" && !selectedStudent) {
      setMessage({ type: "error", text: "Search and pick a student first." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const data =
        scope === "class"
          ? await getStudentQrCards(schoolId, { classId: classId || undefined })
          : await getStudentQrCards(schoolId, { studentId: selectedStudent!.studentId });
      setCards(data.cards);
      setMessage({ type: "success", text: `${data.cards.length} ID card${data.cards.length === 1 ? "" : "s"} generated.` });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, scope, classId, selectedStudent]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Scope toggle */}
      <div className="flex items-center gap-2 no-print">
        <button
          type="button"
          onClick={() => setScope("class")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scope === "class"
              ? "bg-primary text-white"
              : "bg-white text-on-surface-variant border border-outline-variant"
          }`}
        >
          By Class
        </button>
        <button
          type="button"
          onClick={() => setScope("student")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scope === "student"
              ? "bg-primary text-white"
              : "bg-white text-on-surface-variant border border-outline-variant"
          }`}
        >
          Single Student
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-end no-print">
        {scope === "class" ? (
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Filter by Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1 relative">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Search Student</label>
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => onStudentQueryChange(e.target.value)}
              onFocus={() => studentResults.length >= 2 && setShowResults(true)}
              placeholder="Name or admission no."
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md w-64"
            />
            {searching && (
              <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">Searching…</p>
            )}
            {showResults && studentResults.length > 0 && (
              <div className="absolute top-full left-0 z-20 mt-1 w-72 bg-white border border-outline-variant rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {studentResults.map((s) => (
                  <button
                    key={s.studentId}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(s);
                      setStudentQuery(`${s.fullName} (${s.admissionNumber})`);
                      setShowResults(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F5F7FB] font-body-sm text-body-sm"
                  >
                    <span className="font-medium">{s.fullName}</span>{" "}
                    <span className="text-on-surface-variant text-xs">
                      {s.admissionNumber} · {s.className}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showResults && !searching && studentResults.length === 0 && (
              <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">No students match.</p>
            )}
          </div>
        )}

        <button
          onClick={loadCards}
          disabled={loading || (scope === "student" && !selectedStudent)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-container disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : "Generate Cards"}
        </button>
        {cards.length > 0 && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white text-[#002046] border border-[#002046] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Print{cards.length > 1 ? " All" : ""}
          </button>
        )}
      </div>

      {/* Selected student chip */}
      {scope === "student" && selectedStudent && (
        <div className="flex items-center gap-2 no-print">
          <span className="px-3 py-1.5 rounded-full bg-[#E8EAF6] text-[#002046] font-body-sm text-body-sm">
            {selectedStudent.fullName} · {selectedStudent.className}
          </span>
          <button
            type="button"
            onClick={() => { setSelectedStudent(null); setStudentQuery(""); }}
            className="text-on-surface-variant hover:text-on-surface"
            aria-label="Clear selected student"
          >
            ✕
          </button>
        </div>
      )}

      {message && (
        <div
          className={`px-4 py-3 rounded-xl font-body-sm text-body-sm no-print ${
            message.type === "success"
              ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
              : "bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]"
          }`}
        >
          {message.text}
        </div>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.studentId}
              className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4 flex flex-col items-center gap-2 print:shadow-none print:border print:break-inside-avoid"
            >
              {card.passportPhoto ? (
                <img
                  src={card.passportPhoto}
                  alt={card.fullName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#E8EAF6] flex items-center justify-center font-headline-sm text-headline-sm text-primary">
                  {card.fullName.charAt(0)}
                </div>
              )}

              <div className="text-center">
                <p className="font-body-sm text-body-sm font-semibold text-on-surface leading-tight">
                  {card.fullName}
                </p>
                <p className="font-body-xs text-body-xs text-on-surface-variant">
                  {card.admissionNumber}
                </p>
                <p className="font-body-xs text-body-xs text-on-surface-variant">
                  {card.className}
                </p>
              </div>

              {/* SVG data URL — crisp at any enlargement/print size. */}
              <img
                src={card.qrDataUrl}
                alt={`QR for ${card.fullName}`}
                className="w-28 h-28"
              />
            </div>
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-12 no-print">
          {scope === "class"
            ? "Select a class (or leave as “All Classes”) and click Generate Cards."
            : "Search for a student, pick from the results, then click Generate Cards."}
        </p>
      )}

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, header, footer, button, select, input, .no-print { display: none !important; }
          @page { margin: 0.5in; }
        }
      `}</style>
    </div>
  );
}
