"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getOrCreateWizardAction,
  getWizardInitData,
  startWizardAction,
  validateTeacherAssignmentsAction,
  saveTeacherAvailabilityAction,
  savePeriodsAction,
  saveSubjectFrequencyAction,
  saveTeacherLoadAction,
  completeWizardAction,
  resetWizardAction,
} from "./actions";

type InitData = Awaited<ReturnType<typeof getWizardInitData>>;
type StaffMember = InitData["staff"][number];
type ClassItem = InitData["classes"][number];
type ClassSubjectLink = InitData["classSubjects"][number];

interface PeriodEntry {
  name: string;
  startTime: string;
  endTime: string;
  periodType: "assembly" | "period" | "break" | "closing";
}

interface SubjectFreq {
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  minPerWeek: number;
  maxPerWeek: number;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function WizardClient({
  schoolId,
  schoolName,
}: {
  schoolId: string;
  schoolName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<InitData | null>(null);

  // Step 2 state
  const [missingTeachers, setMissingTeachers] = useState<{ classLevel: string; subjectName: string }[]>([]);

  // Step 3 state
  const [staffState, setStaffState] = useState<StaffMember[]>([]);

  // Step 4 state
  const [periods, setPeriods] = useState<PeriodEntry[]>([
    { name: "Assembly", startTime: "07:30", endTime: "07:45", periodType: "assembly" },
    { name: "Period 1", startTime: "07:45", endTime: "08:25", periodType: "period" },
    { name: "Period 2", startTime: "08:25", endTime: "09:05", periodType: "period" },
    { name: "Break", startTime: "09:05", endTime: "09:20", periodType: "break" },
    { name: "Period 3", startTime: "09:20", endTime: "10:00", periodType: "period" },
    { name: "Period 4", startTime: "10:00", endTime: "10:40", periodType: "period" },
    { name: "Closing", startTime: "10:40", endTime: "10:45", periodType: "closing" },
  ]);

  // Step 5 state
  const [subjectFreq, setSubjectFreq] = useState<SubjectFreq[]>([]);

  // Step 6 state
  const [globalMaxPerDay, setGlobalMaxPerDay] = useState(8);
  const [globalMaxPerWeek, setGlobalMaxPerWeek] = useState(40);
  const [teacherLoadOverrides, setTeacherLoadOverrides] = useState<Record<string, { maxPerDay: number; maxPerWeek: number }>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [wizardRes, initData] = await Promise.all([
      getOrCreateWizardAction(),
      getWizardInitData(),
    ]);
    setData(initData);
    setMissingTeachers(initData.missingTeachers);
    setStaffState(initData.staff);

    // Build subject frequency defaults
    const freq: SubjectFreq[] = [];
    for (const cls of initData.classes) {
      const subjects = initData.classSubjects.filter((cs) => cs.classId === cls.id);
      for (const cs of subjects) {
        freq.push({
          classId: cls.id,
          subjectId: cs.subject.id,
          className: `${cls.level}${cls.section ? cls.section : ""}${cls.department ? ` (${cls.department})` : ""}`,
          subjectName: cs.subject.name,
          minPerWeek: 1,
          maxPerWeek: 3,
        });
      }
    }
    setSubjectFreq(freq);

    // Restore wizard progress
    if (wizardRes.completed) {
      // Wizard already done, go to timetable
      router.push("/timetable");
      return;
    }
    setStep(wizardRes.currentStep);

    // Restore step data if available
    const sd = wizardRes.stepData;
    if (sd?.periods) setPeriods(sd.periods as PeriodEntry[]);
    if (sd?.subjectFrequency) setSubjectFreq(sd.subjectFrequency as SubjectFreq[]);
    if (sd?.teacherLoad) {
      const tl = sd.teacherLoad as { globalMaxPerDay: number; globalMaxPerWeek: number; overrides: { staffId: string; maxPerDay: number; maxPerWeek: number }[] };
      setGlobalMaxPerDay(tl.globalMaxPerDay ?? 8);
      setGlobalMaxPerWeek(tl.globalMaxPerWeek ?? 40);
      const ovMap: Record<string, { maxPerDay: number; maxPerWeek: number }> = {};
      for (const o of tl.overrides ?? []) ovMap[o.staffId] = { maxPerDay: o.maxPerDay, maxPerWeek: o.maxPerWeek };
      setTeacherLoadOverrides(ovMap);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Step handlers ─────────────────────────────────────────────────

  async function handleStart() {
    setLoading(true);
    const res = await startWizardAction();
    if (res.step) setStep(res.step);
    setLoading(false);
  }

  async function handleValidateTeachers() {
    setLoading(true);
    setError("");
    const res = await validateTeacherAssignmentsAction();
    if (res.error && res.missingTeachers) {
      setMissingTeachers(res.missingTeachers);
      setError(res.error);
    } else if (res.step) {
      setStep(res.step);
    }
    setLoading(false);
  }

  async function handleSaveTeachers() {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("teachers", JSON.stringify(staffState.map((s) => ({
      id: s.id,
      partTime: s.partTime,
      workDays: s.workDays,
      dayStartTime: s.dayStartTime ?? "",
      dayEndTime: s.dayEndTime ?? "",
    }))));
    const res = await saveTeacherAvailabilityAction({}, fd);
    if (res.error) setError(res.error);
    else if (res.step) setStep(res.step);
    setLoading(false);
  }

  async function handleSavePeriods() {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("periods", JSON.stringify(periods));
    const res = await savePeriodsAction({}, fd);
    if (res.error) setError(res.error);
    else if (res.step) setStep(res.step);
    setLoading(false);
  }

  async function handleSaveFrequency() {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("frequency", JSON.stringify(subjectFreq));
    const res = await saveSubjectFrequencyAction({}, fd);
    if (res.error) setError(res.error);
    else if (res.step) setStep(res.step);
    setLoading(false);
  }

  async function handleSaveTeacherLoad() {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("globalMaxPerDay", String(globalMaxPerDay));
    fd.set("globalMaxPerWeek", String(globalMaxPerWeek));
    fd.set("overrides", JSON.stringify(
      Object.entries(teacherLoadOverrides).map(([staffId, v]) => ({ staffId, maxPerDay: v.maxPerDay, maxPerWeek: v.maxPerWeek }))
    ));
    const res = await saveTeacherLoadAction({}, fd);
    if (res.error) setError(res.error);
    else if (res.step) setStep(res.step);
    setLoading(false);
  }

  async function handleComplete() {
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await completeWizardAction();
    if (res.error) setError(res.error);
    else {
      setSuccess(res.success ?? "Done!");
      setTimeout(() => router.push("/timetable"), 1500);
    }
    setLoading(false);
  }

  async function handleReset() {
    setLoading(true);
    await resetWizardAction();
    setStep(1);
    setError("");
    setSuccess("");
    setLoading(false);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  function updateStaffField(id: string, field: keyof StaffMember, value: any) {
    setStaffState((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  }

  function toggleWorkDay(id: string, day: number) {
    setStaffState((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const days = s.workDays.includes(day)
          ? s.workDays.filter((d) => d !== day)
          : [...s.workDays, day].sort();
        return { ...s, workDays: days };
      }),
    );
  }

  function updatePeriod(index: number, field: keyof PeriodEntry, value: string) {
    setPeriods((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPeriod(type: PeriodEntry["periodType"]) {
    const names: Record<string, string> = { period: "Period", break: "Break", assembly: "Assembly", closing: "Closing" };
    const count = periods.filter((p) => p.periodType === type).length + 1;
    const label = type === "period" ? `${names[type]} ${count}` : count > 1 ? `${names[type]} ${count}` : names[type];
    setPeriods((prev) => [...prev, { name: label, startTime: "08:00", endTime: "08:40", periodType: type }]);
  }

  function removePeriod(index: number) {
    if (periods.length > 3) setPeriods((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFreq(classId: string, subjectId: string, field: "minPerWeek" | "maxPerWeek", value: number) {
    setSubjectFreq((prev) =>
      prev.map((f) => (f.classId === classId && f.subjectId === subjectId ? { ...f, [field]: value } : f)),
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-3 font-body-md text-body-md text-on-surface-variant">Loading...</span>
      </div>
    );
  }

  // ── Step 1: Intro ──────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="space-y-6 text-center py-16">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Timetable Setup Wizard</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">
          Welcome to the timetable setup for <strong>{schoolName}</strong>.
          This wizard will guide you through setting up your school&apos;s timetable step by step.
        </p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-left max-w-md mx-auto space-y-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Steps</h2>
          <ol className="list-decimal list-inside space-y-2 font-body-md text-body-md text-on-surface-variant">
            <li>Class &amp; teacher assignment validation</li>
            <li>Teacher availability (days &amp; times)</li>
            <li>Define periods (assembly, breaks, classes)</li>
            <li>Subject frequency per class</li>
            <li>Teacher load limits</li>
            <li>Generate timetable</li>
          </ol>
        </div>
        <button onClick={handleStart} disabled={loading}
          className="bg-primary text-on-primary font-label-lg text-label-lg py-3 px-8 rounded-xl hover:bg-primary/90 disabled:opacity-60"
        >Start Setup</button>
      </div>
    );
  }

  // ── Step 2: Validate classes & teacher assignments ─────────────────

  if (step === 2) {
    const hasMissing = missingTeachers.length > 0;
    return (
      <div className="space-y-6">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Step 2: Teacher Assignments</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Checking that every subject linked to a class has a teacher assigned for the current session.
        </p>

        {data && data.classes.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <h3 className="font-label-md text-label-md text-on-surface mb-2">Classes found: {data.classes.length}</h3>
            <div className="flex flex-wrap gap-2">
              {data.classes.map((c) => (
                <span key={c.id} className="bg-surface-container-high px-3 py-1 rounded-lg font-label-sm text-label-sm">
                  {c.level}{c.section || ""}{c.department ? ` (${c.department})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasMissing ? (
          <div className="bg-error-container border border-error/30 rounded-xl p-4 space-y-3">
            <h3 className="font-label-md text-label-md text-error">Subjects without teacher assignments</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              The following subjects are linked to a class but have no teacher assigned for the current session.
              Please go to the <strong>Assignments</strong> page to link them.
            </p>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-on-surface-variant text-xs uppercase">
                  <tr><th className="p-1">Class</th><th className="p-1">Subject</th></tr>
                </thead>
                <tbody>
                  {missingTeachers.map((m, i) => (
                    <tr key={i} className="border-t border-outline-variant/30">
                      <td className="p-1">{m.classLevel}</td>
                      <td className="p-1">{m.subjectName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleValidateTeachers} disabled={loading}
                className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >Re-check</button>
              <a href="/staff" target="_blank"
                className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-surface-container"
              >Go to Staff page</a>
            </div>
          </div>
        ) : (
          <div className="bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl p-4">
            <p className="font-body-md text-body-md text-[#2E7D32]">
              ✓ All subjects have teachers assigned.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleValidateTeachers} disabled={loading || hasMissing}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >{hasMissing ? "Fix issues above first" : "Continue"}</button>
          <button onClick={handleReset} className="text-on-surface-variant font-label-md text-label-md hover:underline">Back to start</button>
        </div>
      </div>
    );
  }

  // ── Step 3: Teacher availability ───────────────────────────────────

  if (step === 3) {
    return (
      <div className="space-y-6">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Step 3: Teacher Availability</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Set each teacher&apos;s work days and hours. Toggle part-time for teachers who work limited days.
        </p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {staffState.map((s) => (
            <div key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface">{s.fullName}</span>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <input type="checkbox" checked={s.partTime} onChange={(e) => updateStaffField(s.id, "partTime", e.target.checked)} className="rounded border-outline-variant" />
                  Part-time
                </label>
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Work Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((dayName, dayIdx) => (
                    <button
                      key={dayIdx}
                      onClick={() => toggleWorkDay(s.id, dayIdx)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        s.workDays.includes(dayIdx)
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container-high text-on-surface-variant border-outline-variant"
                      }`}
                    >
                      {dayName.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {s.workDays.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Start Time</label>
                    <input type="time" value={s.dayStartTime ?? ""} onChange={(e) => updateStaffField(s.id, "dayStartTime", e.target.value)}
                      className="w-full border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
                  </div>
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">End Time</label>
                    <input type="time" value={s.dayEndTime ?? ""} onChange={(e) => updateStaffField(s.id, "dayEndTime", e.target.value)}
                      className="w-full border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSaveTeachers} disabled={loading}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >{loading ? "Saving..." : "Save & Continue"}</button>
        </div>
      </div>
    );
  }

  // ── Step 4: Define periods ─────────────────────────────────────────

  if (step === 4) {
    const periodTypeColors: Record<string, string> = {
      assembly: "border-l-[#1565C0] bg-[#E3F2FD]",
      period: "border-l-[#2E7D32] bg-white",
      break: "border-l-[#F57F17] bg-[#FFF8E1]",
      closing: "border-l-[#6A1B9A] bg-[#F3E5F5]",
    };
    const periodTypeLabels: Record<string, string> = {
      assembly: "Assembly",
      period: "Period",
      break: "Break",
      closing: "Closing",
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Step 4: Daily Periods</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Define the daily schedule — add periods, breaks, assembly, and closing.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => addPeriod("period")} className="border border-[#2E7D32] text-[#2E7D32] font-label-md text-label-md py-1.5 px-3 rounded-lg hover:bg-[#E8F5E9] text-sm">+ Add Period</button>
          <button onClick={() => addPeriod("break")} className="border border-[#F57F17] text-[#F57F17] font-label-md text-label-md py-1.5 px-3 rounded-lg hover:bg-[#FFF8E1] text-sm">+ Add Break</button>
          <button onClick={() => addPeriod("assembly")} className="border border-[#1565C0] text-[#1565C0] font-label-md text-label-md py-1.5 px-3 rounded-lg hover:bg-[#E3F2FD] text-sm">+ Add Assembly</button>
          <button onClick={() => addPeriod("closing")} className="border border-[#6A1B9A] text-[#6A1B9A] font-label-md text-label-md py-1.5 px-3 rounded-lg hover:bg-[#F3E5F5] text-sm">+ Add Closing</button>
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {periods.map((p, i) => (
            <div key={i} className={`border border-outline-variant rounded-xl p-3 flex items-center gap-3 border-l-4 ${periodTypeColors[p.periodType] ?? ""}`}>
              <span className="shrink-0 text-[10px] uppercase font-semibold tracking-wider w-14 text-center px-1.5 py-0.5 rounded bg-white/60 border border-outline-variant/50 text-on-surface-variant">
                {periodTypeLabels[p.periodType]}
              </span>
              <input type="text" value={p.name} onChange={(e) => updatePeriod(i, "name", e.target.value)}
                placeholder="Name"
                className="flex-1 border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest min-w-0" />
              <input type="time" value={p.startTime} onChange={(e) => updatePeriod(i, "startTime", e.target.value)}
                className="w-[110px] border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
              <span className="text-on-surface-variant">→</span>
              <input type="time" value={p.endTime} onChange={(e) => updatePeriod(i, "endTime", e.target.value)}
                className="w-[110px] border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
              {periods.length > 3 && (
                <button onClick={() => removePeriod(i)} className="text-error text-xs hover:underline shrink-0">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSavePeriods} disabled={loading}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >{loading ? "Saving..." : "Save & Continue"}</button>
        </div>
      </div>
    );
  }

  // ── Step 5: Subject frequency per class ────────────────────────────

  if (step === 5) {
    const groupedByClass = new Map<string, SubjectFreq[]>();
    for (const f of subjectFreq) {
      const arr = groupedByClass.get(f.className) ?? [];
      arr.push(f);
      groupedByClass.set(f.className, arr);
    }

    return (
      <div className="space-y-6">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Step 5: Subject Frequency</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          For each class, set how many times per week each subject should appear (minimum and maximum periods).
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {[...groupedByClass.entries()].map(([className, freqs]) => (
            <div key={className} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-2">
              <h3 className="font-label-md text-label-md text-on-surface">{className}</h3>
              {freqs.map((f) => (
                <div key={`${f.classId}-${f.subjectId}`} className="flex items-center gap-3 border-t border-outline-variant/30 pt-2">
                  <span className="font-body-md text-body-md text-on-surface flex-1">{f.subjectName}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-on-surface-variant">Min</label>
                    <input type="number" min={0} max={10} value={f.minPerWeek}
                      onChange={(e) => updateFreq(f.classId, f.subjectId, "minPerWeek", parseInt(e.target.value) || 0)}
                      className="w-14 border border-outline-variant rounded p-1.5 text-center font-body-sm text-body-sm bg-surface-container-lowest" />
                    <label className="text-xs text-on-surface-variant">Max</label>
                    <input type="number" min={1} max={10} value={f.maxPerWeek}
                      onChange={(e) => updateFreq(f.classId, f.subjectId, "maxPerWeek", parseInt(e.target.value) || 1)}
                      className="w-14 border border-outline-variant rounded p-1.5 text-center font-body-sm text-body-sm bg-surface-container-lowest" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSaveFrequency} disabled={loading}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >{loading ? "Saving..." : "Save & Continue"}</button>
        </div>
      </div>
    );
  }

  // ── Step 6: Teacher load limits ────────────────────────────────────

  if (step === 6) {
    return (
      <div className="space-y-6">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Step 6: Teacher Load Limits</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Set global limits for how many periods a teacher can teach per day and per week. Override per teacher as needed.
        </p>

        <div className="grid grid-cols-2 gap-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Max periods per day (global)</label>
            <input type="number" min={1} max={16} value={globalMaxPerDay}
              onChange={(e) => setGlobalMaxPerDay(parseInt(e.target.value) || 1)}
              className="w-full border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Max periods per week (global)</label>
            <input type="number" min={1} max={80} value={globalMaxPerWeek}
              onChange={(e) => setGlobalMaxPerWeek(parseInt(e.target.value) || 1)}
              className="w-full border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
          </div>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {staffState.map((s) => {
            const ov = teacherLoadOverrides[s.id] ?? { maxPerDay: globalMaxPerDay, maxPerWeek: globalMaxPerWeek };
            return (
              <div key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-md text-label-md text-on-surface">{s.fullName}</span>
                  <span className="text-xs text-on-surface-variant">{s.partTime ? "Part-time" : "Full-time"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Max per day</label>
                    <input type="number" min={1} max={16} value={ov.maxPerDay}
                      onChange={(e) => setTeacherLoadOverrides((prev) => ({ ...prev, [s.id]: { ...ov, maxPerDay: parseInt(e.target.value) || 1 } }))}
                      className="w-full border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
                  </div>
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Max per week</label>
                    <input type="number" min={1} max={80} value={ov.maxPerWeek}
                      onChange={(e) => setTeacherLoadOverrides((prev) => ({ ...prev, [s.id]: { ...ov, maxPerWeek: parseInt(e.target.value) || 1 } }))}
                      className="w-full border border-outline-variant rounded-lg p-2 font-body-md text-body-md bg-surface-container-lowest" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSaveTeacherLoad} disabled={loading}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >{loading ? "Saving..." : "Save & Continue"}</button>
        </div>
      </div>
    );
  }

  // ── Step 7: Generate / Complete ────────────────────────────────────

  if (step === 7) {
    return (
      <div className="space-y-6 text-center py-12">
        <div className="text-[#2E7D32] text-6xl mb-4">✓</div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Setup Complete!</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">
          All timetable settings have been saved. You can now view the timetable grid and start making manual adjustments.
        </p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-left max-w-md mx-auto space-y-2">
          <h3 className="font-label-md text-label-md text-on-surface">Summary</h3>
          <ul className="font-body-sm text-body-sm text-on-surface-variant space-y-1">
            <li>✓ {data?.classes.length ?? 0} classes configured</li>
            <li>✓ {staffState.length} teachers with availability</li>
            <li>✓ {periods.length} daily periods defined</li>
            <li>✓ {subjectFreq.length} subject frequencies configured</li>
            <li>✓ Teacher load limits set</li>
          </ul>
        </div>

        {success && <p className="text-sm text-[#2E7D32] bg-[#E8F5E9] px-3 py-2 rounded inline-block">{success}</p>}
        {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{error}</p>}

        <button onClick={handleComplete} disabled={loading}
          className="bg-primary text-on-primary font-label-lg text-label-lg py-3 px-8 rounded-xl hover:bg-primary/90 disabled:opacity-60"
        >{loading ? "Finishing..." : "Go to Timetable"}</button>
      </div>
    );
  }

  // Fallback
  return <p className="text-on-surface-variant">Loading wizard...</p>;
}
