"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from "react";
import { getStudentQrCards, type StudentQrCard } from "@/lib/attendance/actions";

interface Props {
  schoolId: string;
  classes: { id: string; name: string }[];
}

export function QrCardsClient({ schoolId, classes }: Props) {
  const [classId, setClassId] = useState("");
  const [cards, setCards] = useState<StudentQrCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getStudentQrCards(schoolId, classId || undefined);
      setCards(data.cards);
      setMessage({ type: "success", text: `${data.cards.length} ID cards loaded.` });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end">
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
        <button
          onClick={loadCards}
          disabled={loading}
          className="px-4 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : "Generate Cards"}
        </button>
        {cards.length > 0 && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white text-[#002046] border border-[#002046] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Print All
          </button>
        )}
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl font-body-sm text-body-sm ${
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

              <img
                src={card.qrDataUrl}
                alt={`QR for ${card.fullName}`}
                className="w-24 h-24"
              />
            </div>
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-12">
          Select a class (or leave as &ldquo;All Classes&rdquo;) and click Generate Cards.
        </p>
      )}

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, header, footer, button, select, .no-print { display: none !important; }
          @page { margin: 0.5in; }
        }
      `}</style>
    </div>
  );
}
