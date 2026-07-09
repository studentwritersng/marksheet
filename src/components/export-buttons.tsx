"use client";

import { useState } from "react";
import { exportToCSV } from "@/lib/export/csv";
import { exportToPDF } from "@/lib/export/pdf";
import { exportToDOC } from "@/lib/export/doc";

interface ExportButtonsProps {
  contentId: string;
  filename: string;
  pdfTitle?: string;
  csvData?: { headers: string[]; rows: string[][]; csvTitle?: string };
  children?: React.ReactNode;
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
      const el = document.getElementById(contentId);
      if (!el) return;
      printElement(el);
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
      let docContent = el.dataset.docContent;
      if (!docContent) {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("[data-export-ignore]").forEach((n) => n.remove());
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
      <button onClick={handlePrint} disabled={exporting === "print"} className={btnClass}>
        {exporting === "print" ? "..." : null}
        <span className="material-symbols-outlined text-base leading-none">print</span>
        Print
      </button>

      <button onClick={handlePDF} disabled={exporting === "pdf"} className={btnClass}>
        {exporting === "pdf" ? "..." : null}
        <span className="material-symbols-outlined text-base leading-none">picture_as_pdf</span>
        PDF
      </button>

      <button onClick={handleDOC} disabled={exporting === "doc"} className={btnClass}>
        {exporting === "doc" ? "..." : null}
        <span className="material-symbols-outlined text-base leading-none">description</span>
        DOC
      </button>

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

/** Open a new window with only the content element, styled for print. */
function printElement(element: HTMLElement) {
  const styles = document.querySelectorAll("style, link[rel='stylesheet']");
  let styleHTML = "";
  styles.forEach((s) => {
    if (s.tagName === "STYLE") {
      styleHTML += s.innerHTML;
    } else if (s.tagName === "LINK") {
      styleHTML += `<link rel="stylesheet" href="${(s as HTMLLinkElement).href}">`;
    }
  });

  const printWindow = window.open("", "_blank", "width=1024,height=768");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups for this site to use Print.");
    return;
  }

  const contentHTML = element.outerHTML;
  printWindow.document.open();
  printWindow.document.write(`\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${document.title}</title>
  ${styleHTML}
  <style>
    body {
      background: white !important;
      color: #000 !important;
      margin: 1.5cm;
      font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { margin: 1.5cm; }
    [data-export-ignore] { display: none !important; }
    aside, header, nav, footer { display: none !important; }
  </style>
</head>
<body>
  ${contentHTML}
  <script>
    window.onload = function() { window.print(); window.close(); };
  <\/script>
</body>
</html>`);
  printWindow.document.close();
}
