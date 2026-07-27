import * as XLSX from "xlsx";

/**
 * Export an HTML table element to an XLSX file.
 * Extracts headers and rows from <thead> and <tbody>, preserving structure.
 */
export function exportTableToXLSX(
  tableEl: HTMLElement,
  filename: string,
  sheetName = "Broadsheet",
): void {
  const wb = XLSX.utils.book_new();

  // Extract data from the table
  const rows: string[][] = [];

  // Header rows (thead)
  const thead = tableEl.querySelector("thead");
  if (thead) {
    const headerRows = thead.querySelectorAll("tr");
    headerRows.forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll("th, td").forEach((cell) => {
        const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
        const text = (cell.textContent || "").trim().replace(/\s+/g, " ");
        cells.push(text);
        // Fill merged cells with empty strings
        for (let i = 1; i < colspan; i++) cells.push("");
      });
      rows.push(cells);
    });
  }

  // Body rows (tbody)
  const tbody = tableEl.querySelector("tbody");
  if (tbody) {
    tbody.querySelectorAll("tr").forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll("td, th").forEach((cell) => {
        const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
        const text = (cell.textContent || "").trim().replace(/\s+/g, " ");
        cells.push(text);
        for (let i = 1; i < colspan; i++) cells.push("");
      });
      rows.push(cells);
    });
  }

  // Footer rows (tfoot)
  const tfoot = tableEl.querySelector("tfoot");
  if (tfoot) {
    tfoot.querySelectorAll("tr").forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll("td, th").forEach((cell) => {
        const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
        const text = (cell.textContent || "").trim().replace(/\s+/g, " ");
        cells.push(text);
        for (let i = 1; i < colspan; i++) cells.push("");
      });
      rows.push(cells);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto-size columns
  const colWidths = rows.reduce<{ wch: number }[]>((acc, row) => {
    row.forEach((cell, i) => {
      const len = cell.length;
      if (!acc[i] || len > acc[i].wch) {
        acc[i] = { wch: len + 2 };
      }
    });
    return acc;
  }, []);
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
