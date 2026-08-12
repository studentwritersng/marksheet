export interface PinRow {
  admissionNumber: string;
  studentName: string;
  pin: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]+/g, "").replace(/\s+/g, " ").trim() || "exam";
}

export function downloadPinsTxt(subjectName: string, rows: PinRow[]) {
  const lines = [
    `EXAM PINS — ${subjectName}`,
    `Generated ${new Date().toLocaleString()}`,
    "",
    `Admission Number | Student Name | PIN`,
    "------------------------------------------------",
    ...rows.map((r) => `${r.admissionNumber} | ${r.studentName} | ${r.pin}`),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${sanitizeFilename(subjectName)}-pins.txt`);
}

export function downloadPinsCsv(subjectName: string, rows: PinRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    `Admission Number,Student Name,PIN`,
    ...rows.map((r) => `${esc(r.admissionNumber)},${esc(r.studentName)},${r.pin}`),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${sanitizeFilename(subjectName)}-pins.csv`);
}

async function downloadPinsDocx(subjectName: string, rows: PinRow[]) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = await import("docx");

  const headerCell = (text: string) =>
    new TableCell({
      shading: { fill: "002046" },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
    });
  const bodyCell = (text: string) =>
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text })] })] });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: `EXAM PINS — ${subjectName}`, bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ children: [new TextRun({ text: `Generated ${new Date().toLocaleString()}`, size: 18 })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [headerCell("Admission Number"), headerCell("Student Name"), headerCell("PIN")],
              }),
              ...rows.map(
                (r) =>
                  new TableRow({
                    children: [bodyCell(r.admissionNumber), bodyCell(r.studentName), bodyCell(r.pin)],
                  }),
              ),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${sanitizeFilename(subjectName)}-pins.docx`);
}

export { downloadPinsDocx };