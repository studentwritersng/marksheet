import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportToPDF(
  originalElement: HTMLElement,
  filename: string,
  options?: { title?: string; landscape?: boolean },
) {
  try {
    await html2canvasPdf(originalElement, filename, options);
  } catch {
    try {
      await sandboxedPdf(originalElement, filename, options);
    } catch {
      await textFallbackPdf(originalElement, filename, options);
    }
  }
}

async function html2canvasPdf(
  element: HTMLElement,
  filename: string,
  options?: { title?: string; landscape?: boolean },
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });
  buildPdfFromImage(canvas.toDataURL("image/png"), canvas.width, canvas.height, filename, options);
}

async function sandboxedPdf(
  originalElement: HTMLElement,
  filename: string,
  options?: { title?: string; landscape?: boolean },
) {
  const clone = originalElement.cloneNode(true) as HTMLElement;

  // Strip all CSS classes from every element to prevent html2canvas from
  // encountering modern color functions (lab, oklch) used by Tailwind v4.
  const all = clone.querySelectorAll("*");
  all.forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.className = "";
    // Remove any inline style attributes too
    htmlEl.removeAttribute("style");
  });

  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "background:#fff",
    "color:#000",
    "font-family:'IBM Plex Sans','Segoe UI',Arial,sans-serif",
    "font-size:14px",
    "line-height:1.5",
    "padding:24px",
    `width:${originalElement.offsetWidth || 800}px`,
    "position:fixed",
    "left:-9999px",
    "top:0",
  ].join(";");

  // Apply table-reset style to all tables inside the clone
  const tables = clone.querySelectorAll("table");
  tables.forEach((t) => {
    const tbl = t as HTMLElement;
    tbl.style.cssText = "border-collapse:collapse;width:100%;margin:8px 0";
  });
  const cells = clone.querySelectorAll("td, th");
  cells.forEach((c) => {
    const cel = c as HTMLElement;
    cel.style.cssText = "border:1px solid #999;padding:4px 8px;text-align:left";
  });
  // Keep heading font sizes
  const headings = clone.querySelectorAll("h1, h2, h3, h4");
  headings.forEach((h) => {
    const hd = h as HTMLElement;
    const tag = hd.tagName.toLowerCase();
    const sizes: Record<string, string> = { h1: "20px", h2: "16px", h3: "14px", h4: "12px" };
    hd.style.cssText = `font-weight:700;font-size:${sizes[tag] || "14px"};margin:12px 0 4px`;
  });
  // Keep paragraph spacing and preserve newlines
  const paras = clone.querySelectorAll("p");
  paras.forEach((p) => {
    const pp = p as HTMLElement;
    pp.style.cssText = "margin:6px 0;white-space:pre-wrap";
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });
    buildPdfFromImage(canvas.toDataURL("image/png"), canvas.width, canvas.height, filename, options);
  } finally {
    document.body.removeChild(wrapper);
  }
}

async function textFallbackPdf(
  originalElement: HTMLElement,
  filename: string,
  options?: { title?: string; landscape?: boolean },
) {
  const orientation = options?.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let y = margin;

  if (options?.title) {
    pdf.setFontSize(16);
    pdf.text(options.title, pageWidth / 2, y, { align: "center" });
    y += 12;
  }

  // Use innerText to get preserved line breaks from block elements
  const rawText = originalElement.innerText || originalElement.textContent || "";
  const blocks = rawText.split(/\n{2,}/).filter((b) => b.trim());

  pdf.setFontSize(11);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const wrapped = pdf.splitTextToSize(line.trim(), maxWidth);
      for (const w of wrapped) {
        if (y + 6 > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(w, margin, y);
        y += 5;
      }
    }
    y += 4; // paragraph spacing
  }

  pdf.save(`${filename.replace(/\s+/g, "_")}.pdf`);
}

function buildPdfFromImage(
  imgData: string,
  imgWidth: number,
  imgHeight: number,
  filename: string,
  options?: { title?: string; landscape?: boolean },
) {
  const orientation = options?.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  const leftMargin = 10;
  const rightMargin = 10;
  const topMargin = 15;
  const usableWidth = pdfWidth - leftMargin - rightMargin;

  const titleOffset = options?.title ? 10 : 0;
  if (options?.title) {
    pdf.setFontSize(14);
    pdf.text(options.title, pdfWidth / 2, topMargin, { align: "center" });
  }

  const ratio = imgHeight / imgWidth;
  let renderWidth = usableWidth;
  let renderHeight = renderWidth * ratio;

  let position = topMargin + titleOffset + 5;

  if (renderHeight + position > pdfPageHeight - 10) {
    renderHeight = pdfPageHeight - 10 - position;
    renderWidth = renderHeight / ratio;
  }

  pdf.addImage(imgData, "PNG", leftMargin, position, renderWidth, renderHeight);
  pdf.save(`${filename.replace(/\s+/g, "_")}.pdf`);
}
