export function exportToCSV(headers: string[], rows: string[][], filename: string) {
  const bom = "\uFEFF";
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((cell) => {
        const val = String(cell ?? "");
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
