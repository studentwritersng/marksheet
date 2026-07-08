import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportToPDF(
  element: HTMLElement,
  filename: string,
  options?: { title?: string; landscape?: boolean }
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const aspectRatio = imgWidth / imgHeight;

  const orientation = options?.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdfWidth / aspectRatio;

  let heightLeft = pdfHeight;
  let position = 0;

  if (options?.title) {
    pdf.setFontSize(14);
    pdf.text(options.title, pdfWidth / 2, 15, { align: "center" });
    position = 10;
    heightLeft = pdfHeight - 10;
  }

  pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
  heightLeft -= pdf.internal.pageSize.getHeight();

  while (heightLeft > 0) {
    position = heightLeft - pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();
  }

  pdf.save(`${filename.replace(/\s+/g, "_")}.pdf`);
}
