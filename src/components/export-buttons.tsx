"use client";

import { useRef, useState } from "react";
import { exportToCSV } from "@/lib/export/csv";
import { exportToPDF } from "@/lib/export/pdf";
import { exportToDOC } from "@/lib/export/doc";

interface ExportButtonsProps {
  /** Unique id for the printable element (uses document.getElementById) */
  contentId: string;
  /** Filename without extension */
  filename: string;
  pdfTitle?: string;
  /** CSV data (only shown when provided) */
  csvData?: { headers: string[]; rows: string[][]; csvTitle?: string };
  /** Additional buttons to right of export group */
  children?: React.ReactNode;
  /** Classes for the wrapper */
  className?: string;
}

export function ExportButtons({
  contentId,
  filename,
  pdfTitle,
  csvData,
  children,
  className = "",
}: ExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handlePrint = () => {
    setExporting("print");
    setTimeout(() => {
      window.print();
      setExporting(null);
    }, 100);
  };

  const handlePDF = async () => {
    setExporting("pdf");
    try {
      const el = document.getElementById(contentId);
      if (!el) return;
      await exportToPDF(el, filename, { title: pdfTitle });
    } finally {
      setExporting(null);
    }
  };

  const handleCSV = () => {
    if (!csvData) return;
    setExporting("csv");
    try {
      exportToCSV(csvData.headers, csvData.rows, filename);
    } finally {
      setExporting(null);
    }
  };

  const handleDOC = () => {
    setExporting("doc");
    try {
      const el = document.getElementById(contentId);
      if (!el) return;
      // If the element has a special data-doc-content, use that; else clone the innerHTML
      let docContent = el.dataset.docContent;
      if (!docContent) {
        const clone = el.cloneNode(true) as HTMLElement;
        // Remove any export button groups from the clone
        clone.querySelectorAll('[data-export-ignore]').forEach((n) => n.remove());
        docContent = clone.innerHTML;
      }
      exportToDOC(docContent, filename, pdfTitle);
    } finally {
      setExporting(null);
    }
  };

  const btnClass =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} data-export-ignore>
      {/* Print */}
      <button onClick={handlePrint} disabled={exporting === "print"} className={btnClass}>
        {exporting === "print" ? "..." : null}
        <span className="material-symbols-outlined text-base leading-none">print</span>
        Print
      </button>

      {/* PDF */}
      <button onClick={handlePDF} disabled={exporting === "pdf"} className={btnClass}>
        {exporting === "pdf" ? "..." : null}
        <span className="material-symbols-outlined text-base leading-none">picture_as_pdf</span>
        PDF
      </button>

      {/* DOC */}
      <button onClick={handleDOC} disabled={exporting === "doc"} className={btnClass}>
        {exporting === "doc" ? "..." : null}
        <span className="material-symbols-outlined text-base leading-none">description</span>
        DOC
      </button>

      {/* CSV (only when data provided) */}
      {csvData && (
        <button onClick={handleCSV} disabled={exporting === "csv"} className={btnClass}>
          {exporting === "csv" ? "..." : null}
          <span className="material-symbols-outlined text-base leading-none">table_chart</span>
          CSV
        </button>
      )}

      {children}
    </div>
  );
}
