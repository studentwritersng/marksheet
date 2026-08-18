/**
 * Scale an obtained score (out of `maximum`) to `allocation` marks.
 * Used so a sub-exam graded on its own question-bank total counts toward the
 * parent assessment type by its shared (allocated) marks, independent of the
 * main examination's total.
 */
export function scaleToAllocation(obtained: number, maximum: number, allocation: number): number {
  if (maximum <= 0) return 0;
  return (obtained / maximum) * allocation;
}

/** Scale a manually entered raw/max score to `allocation` marks (PRC practical sheet). */
export function scaleManual(raw: number, max: number, allocation: number): number {
  if (max <= 0) return 0;
  return (raw / max) * allocation;
}
