export interface RawCurriculumTopic {
  week: number;
  weekSuffix?: unknown;
  topic: string;
  subTopics?: string[];
  objectives?: string[];
}

export interface CurriculumTopicWithSuffix extends RawCurriculumTopic {
  weekSuffix: string;
}

function normalizeSuffix(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

/**
 * CurriculumTopic is unique on (classLevel, term, subject, week, weekSuffix, schoolId),
 * so a week may only hold multiple topics if each gets a distinct weekSuffix.
 * Within a week the first topic keeps its parsed suffix (usually "") and any
 * additional topics get "A", "B", "C"… so every topic becomes its own row.
 */
export function assignWeekSuffixes(topics: RawCurriculumTopic[]): CurriculumTopicWithSuffix[] {
  const weekCounts = new Map<number, number>();
  for (const t of topics) {
    weekCounts.set(t.week, (weekCounts.get(t.week) ?? 0) + 1);
  }

  const weekSeen = new Map<number, number>();
  return topics.map((t) => {
    const count = weekCounts.get(t.week) ?? 1;
    const idx = weekSeen.get(t.week) ?? 0;
    weekSeen.set(t.week, idx + 1);

    let weekSuffix: string;
    if (count > 1) {
      weekSuffix = idx === 0 ? "" : String.fromCharCode(65 + idx - 1);
    } else {
      weekSuffix = normalizeSuffix(t.weekSuffix);
    }

    return { ...t, weekSuffix };
  });
}
