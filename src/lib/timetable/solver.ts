export interface SolverInput {
  classes: { id: string; name: string; level: string }[];
  subjects: { id: string; name: string }[];
  staff: { id: string; fullName: string }[];
  periods: { id: string; periodNumber: number; periodType: string }[];
  days: number[]; // day indices (0-4)
  requirements: {
    subjectId: string; classLevel: string | null; weeklyPeriodsRequired: number;
    doublePeriodAllowed: boolean; preferredTimeOfDay: string; isPractical: boolean;
  }[];
  staffAvailability: {
    staffId: string; day: number; maxPeriodsPerDay: number; maxPeriodsPerWeek: number;
  }[];
  rules: {
    ruleType: string; parameters: Record<string, any>; isHard: boolean; weight: number;
  }[];
  lockedEntries: { classId: string; day: number; periodId: string; subjectId: string; staffId: string | null }[];
}

export interface SolverOutput {
  entries: { classId: string; day: number; periodId: string; subjectId: string; staffId: string | null }[];
  score: number;
  violations: string[];
  iterationsRun: number;
  success: boolean;
}

interface Assignment {
  classId: string;
  day: number;
  periodId: string;
  subjectId: string;
  staffId: string | null;
}

export function runSolver(input: SolverInput): SolverOutput {
  const totalSlots = input.classes.length * input.days.length * input.periods.length;
  if (totalSlots === 0) return { entries: [], score: 0, violations: ["No classes, days, or periods defined."], iterationsRun: 0, success: false };

  // Build requirement map
  const reqMap = new Map<string, { weeklyPeriodsRequired: number; doublePeriodAllowed: boolean; preferredTimeOfDay: string }>();
  for (const r of input.requirements) {
    const key = `${r.subjectId}|${r.classLevel ?? ""}`;
    reqMap.set(key, r);
    // Also store by subject alone as fallback
    if (!reqMap.has(r.subjectId)) reqMap.set(r.subjectId, r);
  }

  // Build staff availability map
  const staffAvailMap = new Map<string, { day: number; maxPeriodsPerDay: number; maxPeriodsPerWeek: number }[]>();
  for (const sa of input.staffAvailability) {
    const arr = staffAvailMap.get(sa.staffId) ?? [];
    arr.push(sa);
    staffAvailMap.set(sa.staffId, arr);
  }

  // Calculate required periods per class
  const requiredPeriods = new Map<string, number>(); // classId -> total periods needed
  for (const cls of input.classes) {
    let total = 0;
    for (const r of input.requirements) {
      if (r.classLevel && r.classLevel !== cls.level) continue;
      total += r.weeklyPeriodsRequired;
    }
    // Fallback: count subjects assigned to this class
    if (total === 0) total = input.subjects.length * 2;
    requiredPeriods.set(cls.id, total);
  }

  // Find staff for a subject (via assignment data - simplified: use the staff list)
  function findStaffForSubject(_subjectId: string): string[] {
    // In a full implementation, we'd look up Assignment records
    // For now, return all staff IDs
    return input.staff.map((s) => s.id);
  }

  // Phase 1: Backtracking CSP solver
  const occupiedSlots = new Map<string, Set<string>>(); // "classId|day|periodId" -> subjectIds used
  const staffDailyLoad = new Map<string, Map<number, number>>(); // staffId -> day -> count
  const staffWeeklyLoad = new Map<string, number>(); // staffId -> total
  const subjectDailyCount = new Map<string, Map<number, number>>(); // subjectId -> day -> count
  const subjectClassCount = new Map<string, Map<string, number>>(); // "subjectId|classId" -> count placed
  const placedEntries: Assignment[] = [];
  const violations: string[] = [];
  let iterations = 0;

  for (const cls of input.classes) {
    const needed = requiredPeriods.get(cls.id) ?? 2;
    const classSlots: { day: number; periodId: string }[] = [];
    for (const day of input.days) {
      for (const p of input.periods) {
        if (p.periodType !== "teaching") continue;
        classSlots.push({ day, periodId: p.id });
      }
    }
    // Shuffle for variety
    shuffleArray(classSlots);

    let placed = 0;
    for (const slot of classSlots) {
      if (placed >= needed) break;
      const slotKey = `${cls.id}|${slot.day}|${slot.periodId}`;
      if (occupiedSlots.get(slotKey)?.size) continue; // should not happen with period-based slots

      // Try to assign a subject
      const shuffledSubjects = [...input.subjects];
      shuffleArray(shuffledSubjects);

      for (const subj of shuffledSubjects) {
        iterations++;
        const req = reqMap.get(subj.id) ?? reqMap.get(`${subj.id}|${cls.level}`);
        if (!req) continue;

        // Check if this subject already has enough periods for this class
        const scKey = `${subj.id}|${cls.id}`;
        const currentCount = subjectClassCount.get(scKey)?.size ?? 0;
        if (currentCount >= (req.weeklyPeriodsRequired)) continue;

        // Check double period constraint
        if (!req.doublePeriodAllowed) {
          if (subjectDailyCount.get(subj.id)?.has(slot.day)) continue;
        }

        // Find available staff
        const candidateStaff = findStaffForSubject(subj.id);
        let assignedStaff: string | null = null;
        let staffDayLoad = 0;
        let staffWeekLoad = 0;
        for (const staffId of candidateStaff) {
          staffDayLoad = staffDailyLoad.get(staffId)?.get(slot.day) ?? 0;
          staffWeekLoad = staffWeeklyLoad.get(staffId) ?? 0;
          const avail = staffAvailMap.get(staffId)?.find((a) => a.day === slot.day);
          if (staffDayLoad >= (avail?.maxPeriodsPerDay ?? 8)) continue;
          if (staffWeekLoad >= (avail?.maxPeriodsPerWeek ?? 40)) continue;
          assignedStaff = staffId;
          break;
        }
        if (!assignedStaff) continue;

        // Assign
        placedEntries.push({
          classId: cls.id, day: slot.day, periodId: slot.periodId,
          subjectId: subj.id, staffId: assignedStaff,
        });

        // Track
        if (!subjectDailyCount.has(subj.id)) subjectDailyCount.set(subj.id, new Map());
        subjectDailyCount.get(subj.id)!.set(slot.day, (subjectDailyCount.get(subj.id)?.get(slot.day) ?? 0) + 1);

        if (!subjectClassCount.has(scKey)) subjectClassCount.set(scKey, new Map());
        subjectClassCount.get(scKey)!.set(slot.periodId, 1);

        if (!staffDailyLoad.has(assignedStaff)) staffDailyLoad.set(assignedStaff, new Map());
        staffDailyLoad.get(assignedStaff)!.set(slot.day, staffDayLoad + 1);
        staffWeeklyLoad.set(assignedStaff, staffWeekLoad + 1);

        placed++;
        break;
      }
    }

    if (placed < needed) {
      violations.push(`Could only place ${placed}/${needed} periods for ${cls.name}.`);
    }
  }

  // Phase 2: Score calculation
  let score = 1000;
  for (const v of violations) score -= 100;
  score = Math.max(0, score);

  return {
    entries: placedEntries,
    score,
    violations,
    iterationsRun: iterations,
    success: violations.length === 0 && placedEntries.length > 0,
  };
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
