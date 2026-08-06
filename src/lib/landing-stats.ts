import { prisma } from "@/lib/prisma";

/**
 * Auto-computed values come from live platform counts, keyed by stat key.
 * Anything not listed here falls back to its manual value.
 */
const AUTO_VALUE_KEYS: Record<string, () => Promise<number>> = {
  schools_registered: () => prisma.school.count(),
  total_students: () => prisma.student.count(),
  verification_codes: () => prisma.verificationCode.count(),
};

export interface LandingStatConfig {
  id: string;
  key: string;
  label: string;
  /** "auto": value is derived from live platform counts. "manual": value comes from manualValue. */
  valueSource: "auto" | "manual";
  manualValue: string;
  enabled: boolean;
  displayOrder: number;
}

/** A stored landing_stats row as surfaced by ensureLandingStats. */
export type LandingStatRow = LandingStatConfig;

/** The subset of fields that define the seed defaults (no id yet). */
export type LandingStatSeed = Pick<
  LandingStatConfig,
  "key" | "label" | "valueSource" | "manualValue" | "enabled" | "displayOrder"
>;

export interface ResolvedLandingStat {
  key: string;
  label: string;
  value: string;
  valueSource: "auto" | "manual";
}

export const LANDING_STAT_DEFAULTS: Array<LandingStatSeed> = [
  {
    key: "schools_registered",
    label: "schools registered",
    valueSource: "auto",
    manualValue: "",
    enabled: true,
    displayOrder: 1,
  },
  {
    key: "total_students",
    label: "records managed",
    valueSource: "auto",
    manualValue: "",
    enabled: true,
    displayOrder: 2,
  },
  {
    key: "verification_codes",
    label: "report card verifications",
    valueSource: "auto",
    manualValue: "",
    enabled: true,
    displayOrder: 3,
  },
  {
    key: "uptime",
    label: "uptime",
    valueSource: "manual",
    manualValue: "99.9%",
    enabled: true,
    displayOrder: 4,
  },
];

/**
 * Ensures the four landing stats exist in the database, creating any that are
 * missing (and ignoring any stale rows not in the known set). Safe to call on
 * every request; full list kept small (here: only the known defaults).
 */
export async function ensureLandingStats(): Promise<LandingStatRow[]> {
  const rows = await prisma.landingStat.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const knownKeys = new Set(LANDING_STAT_DEFAULTS.map((d) => d.key));
  const stale = rows.filter((r) => !knownKeys.has(r.key));
  if (stale.length) {
    await prisma.landingStat.deleteMany({ where: { key: { in: stale.map((r) => r.key) } } });
  }

  const present = new Set(rows.map((r) => r.key));
  const missing = LANDING_STAT_DEFAULTS.filter((d) => !present.has(d.key));
  if (missing.length) {
    await prisma.landingStat.createMany({ data: missing });
    return (await prisma.landingStat.findMany({ orderBy: { displayOrder: "asc" } })).map(
      (r) => ({ ...r, valueSource: r.valueSource as "auto" | "manual" }) as LandingStatRow,
    );
  }

  return (rows as LandingStatRow[]).map((r) => ({
    ...r,
    valueSource: r.valueSource as "auto" | "manual",
  }));
}

/**
 * Fetches the landing stats and resolves every enabled stat to a concrete
 * display value (live count for auto, or the manual value stored).
 */
export async function resolveLandingStats(): Promise<ResolvedLandingStat[]> {
  const stats = await ensureLandingStats();
  const enabled = stats.filter((s) => s.enabled);

  // Resolve auto sources in parallel for the keys that support it.
  const resolved = new Map<string, string>();
  const autoRequests: Array<Promise<[string, number]>> = [];
  for (const key of Object.keys(AUTO_VALUE_KEYS)) {
    autoRequests.push(AUTO_VALUE_KEYS[key]().then((n) => [key, n] as [string, number]));
  }
  const autoResults = await Promise.all(autoRequests);
  for (const [key, n] of autoResults) {
    resolved.set(key, n.toLocaleString());
  }

  return enabled.map((s) => ({
    key: s.key,
    label: s.label,
    valueSource: s.valueSource as "auto" | "manual",
    value: s.valueSource === "auto" && resolved.has(s.key) ? resolved.get(s.key)! : s.manualValue || "0",
  }));
}