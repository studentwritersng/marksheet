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
      setMessage({
        type: "success",
        text: `${data.cards.length} ID card${data.cards.length === 1 ? "" : "s"} generated.`,
      });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, scope, classId, selectedStudent]);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 no-print">
        <button type="button" onClick={() => setScope("class")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scope === "class" ? "bg-primary text-white" : "bg-white text-on-surface-variant border border-outline-variant"
          }`}>
          By Class
        </button>
        <button type="button" onClick={() => setScope("student")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            scope === "student" ? "bg-primary text-white" : "bg-white text-on-surface-variant border border-outline-variant"
          }`}>
          Single Student
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-end no-print">
        {scope === "class" ? (
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Filter by Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md">
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
            {searching && <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">Searching…</p>}
            {showResults && studentResults.length > 0 && (
              <div className="absolute top-full left-0 z-20 mt-1 w-72 bg-white border border-outline-variant rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {studentResults.map((s) => (
                  <button key={s.studentId} type="button"
                    onClick={() => { setSelectedStudent(s); setStudentQuery(`${s.fullName} (${s.admissionNumber})`); setShowResults(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F5F7FB] font-body-sm text-body-sm">
                    <span className="font-medium">{s.fullName}</span>{" "}
                    <span className="text-on-surface-variant text-xs">{s.admissionNumber} · {s.className}</span>
                  </button>
                ))}
              </div>
            )}
            {showResults && !searching && studentResults.length === 0 && (
              <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">No students match.</p>
            )}
          </div>
        )}

        <button onClick={loadCards}
          disabled={loading || (scope === "student" && !selectedStudent)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-container disabled:opacity-50 transition-colors">
          {loading ? "Generating…" : "Generate Cards"}
        </button>

        {cards.length > 0 && (
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-white text-[#002046] border border-[#002046] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
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
          <button type="button"
            onClick={() => { setSelectedStudent(null); setStudentQuery(""); }}
            className="text-on-surface-variant hover:text-on-surface" aria-label="Clear">✕</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl font-body-sm text-body-sm no-print ${
          message.type === "success"
            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
            : "bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]"
        }`}>
          {message.text}
        </div>
      )}

      {/* ── Card grid ── */}
      {cards.length > 0 && (
        <div className="cards-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 print:gap-0">
          {cards.map((card) => (
            <IdCard key={card.studentId} card={card} />
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-12 no-print">
          {scope === "class"
            ? "Select a class (or leave as \u201cAll Classes\u201d) and click Generate Cards."
            : "Search for a student, pick from the results, then click Generate Cards."}
        </p>
      )}

      <style jsx global>{`
        /* ── Screen card sizing ── */
        .id-card { width: 100%; aspect-ratio: 54 / 86; }

        /* ── Print layout ── */
        @media print {
          html, body { margin: 0; padding: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, header, footer, aside, button, select, input, label,
          .no-print { display: none !important; }

          /*
           * A4 portrait, 10 mm margins all round.
           * Printable area: 190 mm wide × 277 mm tall.
           * 3 × 3 grid → each cell ≈ 60 mm wide × 88 mm tall (gap eats the rest).
           */
          @page { size: A4 portrait; margin: 10mm; }

          /* 3-column grid, 3 rows per page */
          .cards-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5mm !important;
            width: 100% !important;
          }

          .id-card {
            width: 100% !important;
            /* ~88 mm tall fits 3 rows with 5 mm gaps in 277 mm printable height */
            height: 88mm !important;
            break-inside: avoid;
            page-break-inside: avoid;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }

          /* Header: fixed 14 mm */
          .id-card .card-header  { height: 14mm !important; min-height: 14mm !important; flex-shrink: 0 !important; }
          /* Photo (optional): fixed 13 mm when visible */
          .id-card .card-photo   { height: 13mm !important; min-height: 13mm !important; flex-shrink: 0 !important; }
          /* Info strip: fixed 12 mm */
          .id-card .card-info    { height: 12mm !important; min-height: 12mm !important; flex-shrink: 0 !important; }
          /* Footer: fixed 7 mm */
          .id-card .card-footer  { height: 7mm  !important; min-height: 7mm  !important; flex-shrink: 0 !important; }
          /* QR: takes whatever remains — capped so it never bleeds into footer */
          .id-card .card-qr      {
            flex: 1 1 0 !important;
            min-height: 0 !important;
            max-height: 42mm !important;   /* ~48% of 88mm card */
            overflow: hidden !important;
          }
          .id-card .card-qr img  { max-height: 100% !important; width: auto !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   IdCard — the actual printed card
   Layout (portrait, CR80-inspired):
     ┌─────────────────────┐
     │   SCHOOL HEADER     │  ~15% — logo + school name on navy bar
     ├─────────────────────┤
     │   STUDENT INFO      │  ~10% — name, class, reg. no.
     ├─────────────────────┤
     │                     │
     │      QR CODE        │  ~50% — fills the middle section
     │                     │
     ├─────────────────────┤
     │  SCAN TO ATTEND     │  ~5%  — small footer label
     └─────────────────────┘
   The remaining ~20% of vertical space is taken up by padding and the
   optional passport photo row (shown only when a photo is present).
───────────────────────────────────────────────────────────────────────────── */
function IdCard({ card }: { card: StudentQrCard }) {
  const initials = card.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div
      className="id-card flex flex-col rounded-xl overflow-hidden border border-gray-300 shadow-md print:shadow-none print:rounded-lg bg-white"
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      {/* ── School header bar ── */}
      <div
        className="card-header flex items-center gap-2 px-2 py-2"
        style={{ background: "#002046", minHeight: "15%" }}
      >
        {card.schoolLogo ? (
          <img
            src={card.schoolLogo}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 rounded-full object-cover shrink-0 bg-white p-0.5"
          />
        ) : (
          /* Placeholder shield icon when no logo is uploaded */
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5" aria-hidden="true">
              <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z" />
            </svg>
          </div>
        )}
        <p
          className="text-white font-bold leading-tight"
          style={{ fontSize: "clamp(6px, 1.8vw, 10px)", wordBreak: "break-word" }}
        >
          {card.schoolName || "School Name"}
        </p>
      </div>

      {/* ── Optional passport photo ── */}
      {card.passportPhoto && (
        <div className="card-photo flex justify-center pt-2 px-2">
          <img
            src={card.passportPhoto}
            alt={card.fullName}
            className="h-12 w-12 rounded-full object-cover border-2 border-[#002046]"
          />
        </div>
      )}

      {/* ── Student info ── */}
      <div
        className="card-info px-2 pt-1.5 pb-0 text-center"
        style={{ background: "#f0f4ff" }}
      >
        <p
          className="font-bold text-[#002046] leading-tight truncate"
          style={{ fontSize: "clamp(7px, 2vw, 11px)" }}
          title={card.fullName}
        >
          {card.fullName}
        </p>
        <p
          className="text-[#334155] leading-tight"
          style={{ fontSize: "clamp(6px, 1.6vw, 9px)" }}
        >
          {card.className}
        </p>
        <p
          className="text-[#64748b] leading-tight tracking-wide font-mono"
          style={{ fontSize: "clamp(5px, 1.5vw, 8px)" }}
        >
          {card.admissionNumber}
        </p>
      </div>

      {/* ── QR code — takes ~50% of card height ── */}
      <div
        className="card-qr flex items-center justify-center px-2 py-1 flex-1"
        style={{ background: "#f0f4ff" }}
      >
        <img
          src={card.qrDataUrl}
          alt={`QR attendance code for ${card.fullName}`}
          /*
           * The SVG scales perfectly — no blurriness at any size.
           * w-full + max-w constrained by the card width ensures the QR
           * fills the available space without overflowing.
           */
          className="w-full h-auto"
          style={{ maxWidth: "90%", imageRendering: "crisp-edges" }}
        />
      </div>

      {/* ── Footer label ── */}
      <div
        className="card-footer text-center py-1"
        style={{ background: "#002046" }}
      >
        <p
          className="text-white uppercase tracking-widest"
          style={{ fontSize: "clamp(4px, 1.2vw, 7px)" }}
        >
          Scan to mark attendance
        </p>
      </div>
    </div>
  );
}
