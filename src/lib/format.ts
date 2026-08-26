export function formatNaira(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
