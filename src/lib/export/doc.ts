/**
 * Export content as a Microsoft Word document (.doc).
 * Uses HTML with Word-compatible mso markup — Word opens this natively.
 */
export function exportToDOC(htmlContent: string, filename: string, title?: string) {
  const styledHtml = `\
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; margin: 2cm; }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 12pt; }
  h2 { font-size: 14pt; margin-top: 18pt; margin-bottom: 6pt; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
  td, th { border: 1pt solid black; padding: 4pt 8pt; }
  th { background: #e0e0e0; font-weight: bold; }
  p { margin: 4pt 0; }
  @page { size: A4; margin: 2cm; }
</style>
</head><body>
${title ? `<h1>${title}</h1>` : ""}
${htmlContent}
</body></html>`;

  const blob = new Blob([styledHtml], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\s+/g, "_")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
