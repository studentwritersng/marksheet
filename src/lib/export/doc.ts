/**
 * Export content as a Microsoft Word document (.doc).
 * Uses HTML with Word-compatible mso markup — Word opens this natively.
 * Pre-processes the HTML to ensure newlines become proper paragraph breaks.
 */
export function exportToDOC(htmlContent: string, filename: string, title?: string) {
  const processed = preProcessDocContent(htmlContent);

  const styledHtml = `\
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; margin: 0; padding: 0; }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 12pt; }
  h2 { font-size: 14pt; margin-top: 18pt; margin-bottom: 6pt; }
  h3 { font-size: 13pt; margin-top: 14pt; margin-bottom: 4pt; }
  h4 { font-size: 12pt; font-weight: bold; margin-top: 10pt; margin-bottom: 3pt; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
  td, th { border: 1pt solid black; padding: 4pt 8pt; vertical-align: top; }
  th { background: #e0e0e0; font-weight: bold; }
  p { margin: 6pt 0; }
  br { display: block; margin: 2pt 0; }
  ul, ol { margin: 6pt 0; padding-left: 24pt; }
  li { margin: 2pt 0; }
  @page { size: A4; margin: 1.5cm; }
</style>
</head><body>
${title ? `<h1>${title}</h1>` : ""}
${processed}
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

function preProcessDocContent(html: string): string {
  // 1. Strip whitespace-pre-wrap and any problematic classes that won't work in Word
  let result = html.replace(/\s*whitespace-pre-wrap\s*/g, "");

  // 2. Replace double or more newlines with paragraph breaks
  result = result.replace(/\n\s*\n/g, "</p><p>");

  // 3. Replace remaining single newlines with <br>
  result = result.replace(/\n/g, "<br>");

  // 4. Wrap bare text content in <p> tags if not already wrapped
  //    (ensures everything is inside block elements for Word)
  if (!result.startsWith("<")) {
    result = `<p>${result}</p>`;
  }

  // 5. Fix </p><p> sequences that may have been created
  result = result.replace(/<\/p>\s*<p>/g, '</p>\n<p>');

  return result;
}
