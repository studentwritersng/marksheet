"use client";

import { useActionState, useState } from "react";
import {
  createTemplateAction, deleteTemplateAction,
  upsertDayAction, upsertPeriodAction, deletePeriodAction,
  upsertSubjectRequirementAction, deleteSubjectRequirementAction,
  upsertStaffAvailabilityAction,
  upsertRuleAction, deleteRuleAction,
  createRoomTypeAction, createRoomAction, deleteRoomAction,
  publishTimetableAction,
} from "./generator-actions";

interface TemplateVM { id: string; name: string; appliesTo: string[]; }
interface DayVM { id: string; dayName: string; dayIndex: number; isTeachingDay: boolean; }
interface PeriodVM { id: string; periodNumber: number; startTime: string; endTime: string; periodType: string; }
interface RequirementVM { id: string; subjectId: string; subjectName: string; classId: string | null; className: string | null; classLevel: string | null; weeklyPeriodsRequired: number; doublePeriodAllowed: boolean; preferredTimeOfDay: string; isPractical: boolean; }
interface StaffAvailVM { id: string; staffId: string; staffName: string; day: number; maxPeriodsPerDay: number; maxPeriodsPerWeek: number; }
interface RuleVM { id: string; ruleType: string; parameters: Record<string, any>; isHard: boolean; weight: number; }
interface RoomTypeVM { id: string; name: string; }
interface RoomVM { id: string; name: string; roomTypeId: string; capacity: number; }
interface SubjectVM { id: string; name: string; }
interface StaffVM { id: string; fullName: string; }
interface ClassVM { id: string; name: string; level: string; }
interface ClassSubjectLinkVM { classId: string; subjectId: string; }
interface TimetableVM { id: string; status: string; generatedAt: string; generationScore: number; }
interface TimetableEntryVM { id: string; timetableId: string; classId: string; className: string; day: number; periodId: string; subjectName: string; staffName: string | null; isLocked: boolean; }

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function TimetableGeneratorClient({
  templates, subjects, staff, classes, requirements, staffAvail, rules, roomTypes, rooms, timetables, entries, classSubjects,
}: {
  templates: TemplateVM[]; subjects: SubjectVM[]; staff: StaffVM[]; classes: ClassVM[];
  requirements: RequirementVM[]; staffAvail: StaffAvailVM[]; rules: RuleVM[];
  roomTypes: RoomTypeVM[]; rooms: RoomVM[]; timetables: TimetableVM[]; entries: TimetableEntryVM[];
  classSubjects: ClassSubjectLinkVM[];
}) {
  const [tab, setTab] = useState<"template" | "requirements" | "staff" | "rules" | "rooms" | "generate">("template");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-on-surface">Timetable Generator</h2>
        <p className="text-sm text-on-surface-variant mt-1">Configure, generate, and publish collision-free timetables.</p>
      </div>

      <div className="flex gap-1 border-b border-outline-variant pb-0 flex-wrap">
        {(["template", "requirements", "staff", "rules", "rooms", "generate"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t ? "border-primary text-on-surface font-medium" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >{t === "template" ? "Template" : t === "requirements" ? "Requirements" : t === "staff" ? "Staff Avail." : t === "rules" ? "Rules" : t === "rooms" ? "Rooms" : "Generate"}</button>
        ))}
      </div>

      {tab === "template" && (
        <TemplateTab templates={templates} />
      )}
      {tab === "requirements" && (
        <RequirementsTab subjects={subjects} classes={classes} requirements={requirements} classSubjects={classSubjects} />
      )}
      {tab === "staff" && (
        <StaffTab staff={staff} staffAvail={staffAvail} />
      )}
      {tab === "rules" && (
        <RulesTab rules={rules} />
      )}
      {tab === "rooms" && (
        <RoomsTab roomTypes={roomTypes} rooms={rooms} />
      )}
      {tab === "generate" && (
        <GenerateTab
          templates={templates} subjects={subjects} staff={staff} classes={classes}
          requirements={requirements} staffAvail={staffAvail} rules={rules}
          timetables={timetables} entries={entries}
        />
      )}
    </div>
  );
}

function TemplateTab({ templates }: { templates: TemplateVM[] }) {
  const [tState, tAction, tPending] = useActionState(createTemplateAction, {});
  const [dState, dAction] = useActionState(deleteTemplateAction, {});
  const [dayState, dayAction] = useActionState(upsertDayAction, {});
  const [pState, pAction, pPending] = useActionState(upsertPeriodAction, {});
  const [delPState, delPAction] = useActionState(deletePeriodAction, {});
  const [selTemplate, setSelTemplate] = useState(templates[0]?.id ?? "");
  const [days, setDays] = useState<DayVM[]>([]);
  const [periods, setPeriods] = useState<PeriodVM[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadTemplate(id: string) {
    setSelTemplate(id);
    if (!id) { setDays([]); setPeriods([]); return; }
    setLoading(true);
    const res = await fetch(`/api/timetable-template?id=${id}`);
    const data = await res.json();
    setDays(data.days ?? []);
    setPeriods(data.periods ?? []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <form action={tAction} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant block mb-1">New Template Name</label>
          <input name="name" required placeholder="e.g. Default Timetable" className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant block mb-1">Applies To (levels, comma-separated)</label>
          <input name="appliesTo" placeholder="JSS1,JSS2 (leave empty = all)" className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
        </div>
        <button type="submit" disabled={tPending} className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">Create</button>
      </form>

      {templates.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <select value={selTemplate} onChange={(e) => loadTemplate(e.target.value)} className="border border-outline-variant rounded-lg p-2 text-sm bg-surface flex-1">
              <option value="">Select template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <form action={dAction}>
              <input type="hidden" name="templateId" value={selTemplate} />
              <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
            </form>
          </div>

          {selTemplate && !loading && (
            <>
              {/* Days */}
              <div>
                <h3 className="text-sm font-semibold text-on-surface mb-2">Teaching Days</h3>
                <div className="grid grid-cols-5 gap-2">
                  {DAY_NAMES.map((name, idx) => {
                    const day = days.find((d) => d.dayIndex === idx);
                    return (
                      <form key={idx} action={dayAction}>
                        <input type="hidden" name="templateId" value={selTemplate} />
                        <input type="hidden" name="dayIndex" value={idx} />
                        <input type="hidden" name="dayName" value={name} />
                        <label className="flex items-center gap-2 p-2 border border-outline-variant rounded-lg cursor-pointer text-sm">
                          <input type="checkbox" name="isTeachingDay" value="true" defaultChecked={day?.isTeachingDay ?? true} />
                          {name}
                        </label>
                        <button type="submit" className="text-[10px] text-primary mt-1 hover:underline">Save</button>
                      </form>
                    );
                  })}
                </div>
              </div>

              {/* Periods */}
              <div>
                <h3 className="text-sm font-semibold text-on-surface mb-2">Periods</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {periods.sort((a, b) => a.periodNumber - b.periodNumber).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="w-20 text-on-surface-variant">Period {p.periodNumber}</span>
                      <span className="text-on-surface">{p.startTime}–{p.endTime}</span>
                      <span className="text-xs text-on-surface-variant capitalize">({p.periodType})</span>
                      <form action={delPAction}>
                        <input type="hidden" name="periodId" value={p.id} />
                        <button type="submit" className="text-[10px] text-red-600 hover:underline">Remove</button>
                      </form>
                    </div>
                  ))}
                </div>
                <form action={pAction} className="flex items-end gap-2 mt-3 pt-3 border-t border-outline-variant">
                  <input type="hidden" name="templateId" value={selTemplate} />
                  <div>
                    <label className="text-[10px] text-on-surface-variant">#</label>
                    <input name="periodNumber" type="number" min={1} required className="w-16 border border-outline-variant rounded p-1.5 text-sm bg-surface" />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant">Start</label>
                    <input name="startTime" type="time" required className="w-24 border border-outline-variant rounded p-1.5 text-sm bg-surface" />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant">End</label>
                    <input name="endTime" type="time" required className="w-24 border border-outline-variant rounded p-1.5 text-sm bg-surface" />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant">Type</label>
                    <select name="periodType" className="border border-outline-variant rounded p-1.5 text-sm bg-surface">
                      <option value="teaching">Teaching</option>
                      <option value="break">Break</option>
                      <option value="assembly">Assembly</option>
                      <option value="fixed_other">Fixed</option>
                    </select>
                  </div>
                  <button type="submit" disabled={pPending} className="bg-[#002046] text-white text-xs px-3 py-1.5 rounded disabled:opacity-60">Add</button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RequirementsTab({ subjects, classes, requirements, classSubjects }: { subjects: SubjectVM[]; classes: ClassVM[]; requirements: RequirementVM[]; classSubjects: ClassSubjectLinkVM[] }) {
  const [state, action, pending] = useActionState(upsertSubjectRequirementAction, {});
  const [delState, delAction] = useActionState(deleteSubjectRequirementAction, {});
  const [selClass, setSelClass] = useState("");

  const linkedSubjectIds = new Set(
    classSubjects.filter((cs) => cs.classId === selClass).map((cs) => cs.subjectId)
  );
  const availableSubjects = selClass
    ? subjects.filter((s) => linkedSubjectIds.has(s.id))
    : [];
  const selectedClass = classes.find((c) => c.id === selClass);

  return (
    <div className="space-y-4">
      <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Class</label>
            <select name="classId" value={selClass} onChange={(e) => setSelClass(e.target.value)} required className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface">
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Subject</label>
            <select name="subjectId" required disabled={!selClass} className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface">
              <option value="">{selClass ? "Select subject" : "Select a class first"}</option>
              {availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Weekly Periods</label>
            <input name="weeklyPeriodsRequired" type="number" min={1} required className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Time Preference</label>
            <select name="preferredTimeOfDay" className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface">
              <option value="none">Any</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
            </select>
          </div>
        </div>
        <input type="hidden" name="classLevel" value={selectedClass?.level ?? ""} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="doublePeriodAllowed" value="true" defaultChecked /> Allow double periods
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="isPractical" value="true" /> Is practical
          </label>
        </div>
        <button type="submit" disabled={pending} className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">Save</button>
      </form>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high">
            <tr className="text-left text-on-surface-variant text-xs uppercase">
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">Periods/Week</th>
              <th className="px-4 py-2">Double</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {requirements.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.subjectName}</td>
                <td className="px-4 py-2 text-on-surface-variant">{r.className ?? r.classLevel ?? "All"}</td>
                <td className="px-4 py-2">{r.weeklyPeriodsRequired}</td>
                <td className="px-4 py-2">{r.doublePeriodAllowed ? "Yes" : "No"}</td>
                <td className="px-4 py-2 capitalize">{r.preferredTimeOfDay}</td>
                <td className="px-4 py-2">
                  <form action={delAction}>
                    <input type="hidden" name="reqId" value={r.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {requirements.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant text-sm">No requirements set.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffTab({ staff, staffAvail }: { staff: StaffVM[]; staffAvail: StaffAvailVM[] }) {
  const [state, action, pending] = useActionState(upsertStaffAvailabilityAction, {});
  const [selStaff, setSelStaff] = useState(staff[0]?.id ?? "");
  const [selDays, setSelDays] = useState<number[]>([]);

  const toggleDay = (day: number) => {
    setSelDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  return (
    <div className="space-y-4">
      <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Staff</label>
            <select name="staffId" value={selStaff} onChange={(e) => setSelStaff(e.target.value)} required className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface">
              <option value="">Select</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Days</label>
            <div className="flex flex-wrap gap-2 pt-1">
              <input type="hidden" name="days" value={JSON.stringify(selDays)} />
              {DAY_NAMES.map((name, idx) => (
                <label key={idx} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={selDays.includes(idx)} onChange={() => toggleDay(idx)} className="accent-[#002046]" />
                  {name}
                </label>
              ))}
            </div>
            {selDays.length === 0 && <p className="text-[10px] text-red-600 mt-1">Select at least one day.</p>}
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Max Periods/Day</label>
            <input name="maxPeriodsPerDay" type="number" min={1} defaultValue={8} className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Max Periods/Week</label>
            <input name="maxPeriodsPerWeek" type="number" min={1} defaultValue={40} className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
          </div>
        </div>
        <button type="submit" disabled={pending || selDays.length === 0} className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">Save</button>
      </form>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high">
            <tr className="text-left text-on-surface-variant text-xs uppercase">
              <th className="px-4 py-2">Staff</th>
              {DAY_NAMES.map((n) => <th key={n} className="px-4 py-2">{n}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium">{s.fullName}</td>
                {DAY_NAMES.map((_, di) => {
                  const a = staffAvail.find((sa) => sa.staffId === s.id && sa.day === di);
                  return (
                    <td key={di} className="px-4 py-2 text-xs text-on-surface-variant">
                      {a ? `${a.maxPeriodsPerDay}/day` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RulesTab({ rules }: { rules: RuleVM[] }) {
  const [state, action, pending] = useActionState(upsertRuleAction, {});
  const [delState, delAction] = useActionState(deleteRuleAction, {});

  return (
    <div className="space-y-4">
      <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Rule Type</label>
            <select name="ruleType" className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface">
              <option value="max_consecutive_periods">Max Consecutive Periods</option>
              <option value="max_subject_periods_per_day">Max Subject Periods/Day</option>
              <option value="fixed_period_assignment">Fixed Period Assignment</option>
              <option value="subject_time_preference">Subject Time Preference</option>
              <option value="max_teacher_subjects">Max Teacher Subjects</option>
              <option value="practical_double_period">Practical Double Period</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Parameters (JSON)</label>
            <input name="parameters" placeholder='{"max": 3}' className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
          </div>
          <div className="flex items-center gap-4 pt-5">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="isHard" value="true" defaultChecked /> Hard constraint
            </label>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Weight (for soft rules)</label>
            <input name="weight" type="number" min={1} defaultValue={100} className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
          </div>
        </div>
        <button type="submit" disabled={pending} className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">Add Rule</button>
      </form>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high">
            <tr className="text-left text-on-surface-variant text-xs uppercase">
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Hard/Soft</th>
              <th className="px-4 py-2">Weight</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 capitalize">{r.ruleType.replace(/_/g, " ")}</td>
                <td className="px-4 py-2">{r.isHard ? "Hard" : "Soft"}</td>
                <td className="px-4 py-2">{r.weight}</td>
                <td className="px-4 py-2">
                  <form action={delAction}>
                    <input type="hidden" name="ruleId" value={r.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant text-sm">No rules configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomsTab({ roomTypes, rooms }: { roomTypes: RoomTypeVM[]; rooms: RoomVM[] }) {
  const [rtState, rtAction, rtPending] = useActionState(createRoomTypeAction, {});
  const [rState, rAction, rPending] = useActionState(createRoomAction, {});
  const [delRState, delRAction] = useActionState(deleteRoomAction, {});

  return (
    <div className="space-y-4">
      <form action={rtAction} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant block mb-1">Room Type Name</label>
          <input name="name" required placeholder="e.g. Physics Lab" className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
        </div>
        <button type="submit" disabled={rtPending} className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">Add Type</button>
      </form>

      <form action={rAction} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant block mb-1">Room Name</label>
          <input name="name" required placeholder="e.g. Lab 101" className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant block mb-1">Type</label>
          <select name="roomTypeId" required className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface">
            <option value="">Select</option>
            {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
          </select>
        </div>
        <div className="w-24">
          <label className="text-xs text-on-surface-variant block mb-1">Capacity</label>
          <input name="capacity" type="number" min={1} defaultValue={40} className="w-full border border-outline-variant rounded-lg p-2 text-sm bg-surface" />
        </div>
        <button type="submit" disabled={rPending} className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">Add Room</button>
      </form>

      {rooms.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high">
              <tr className="text-left text-on-surface-variant text-xs uppercase">
                <th className="px-4 py-2">Room</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Capacity</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rooms.map((r) => {
                const rt = roomTypes.find((t) => t.id === r.roomTypeId);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-on-surface-variant">{rt?.name ?? "—"}</td>
                    <td className="px-4 py-2">{r.capacity}</td>
                    <td className="px-4 py-2">
                      <form action={delRAction}>
                        <input type="hidden" name="roomId" value={r.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GenerateTab({
  templates, subjects, staff, classes, requirements, staffAvail, rules, timetables: initialTTs, entries: initialEntries,
}: {
  templates: TemplateVM[]; subjects: SubjectVM[]; staff: StaffVM[]; classes: ClassVM[];
  requirements: RequirementVM[]; staffAvail: StaffAvailVM[]; rules: RuleVM[];
  timetables: TimetableVM[]; entries: TimetableEntryVM[];
}) {
  const [generating, setGenerating] = useState(false);
  const [timetables, setTimetables] = useState(initialTTs);
  const [entries, setEntries] = useState(initialEntries);
  const [genResult, setGenResult] = useState<{ entries: any[]; score: number; violations: string[]; success: boolean; timetableId?: string } | null>(null);
  const [viewTT, setViewTT] = useState(timetables[0]?.id ?? "");
  const [pubState, setPubState] = useState<{ success?: string; error?: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(classes.map((c) => c.id));

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) => prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]);
  };

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/timetable-generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classIds: selectedClasses }),
      });
      const data = await res.json();
      setGenResult({
        entries: data.entries ?? [],
        score: data.score ?? 0,
        violations: data.violations ?? [],
        success: data.success ?? false,
        timetableId: data.timetableId,
      });
      if (data.timetableId) {
        const tt: TimetableVM = { id: data.timetableId, status: "draft", generatedAt: new Date().toISOString(), generationScore: data.score ?? 0 };
        setTimetables((prev) => [tt, ...prev]);
        setEntries((prev) => [
          ...prev,
          ...(data.entries ?? []).map((e: any) => ({
            id: e.id, timetableId: data.timetableId, classId: e.classId, className: "",
            day: e.day, periodId: e.periodId, subjectName: "", staffName: e.staffId ?? null, isLocked: false,
          })),
        ]);
        setViewTT(data.timetableId);
      }
    } catch { setGenResult({ entries: [], score: 0, violations: ["Generation request failed."], success: false }); }
    setGenerating(false);
  }

  const viewEntries = viewTT ? entries.filter((e) => e.timetableId === viewTT) : [];

  return (
    <div className="space-y-4">
      {/* Class selection */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
        <h3 className="text-sm font-semibold text-on-surface mb-3">Generate For Classes</h3>
        <div className="flex flex-wrap gap-3">
          {classes.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={selectedClasses.includes(c.id)}
                onChange={() => toggleClass(c.id)} className="accent-[#002046]" />
              {c.name}
            </label>
          ))}
        </div>
        {selectedClasses.length === 0 && <p className="text-xs text-red-600 mt-2">Select at least one class to generate.</p>}
      </div>

      <button onClick={handleGenerate} disabled={generating || selectedClasses.length === 0}
        className="bg-[#002046] hover:bg-[#003366] text-white text-sm px-6 py-3 rounded-lg disabled:opacity-60 font-semibold">
        {generating ? "Generating..." : "Generate Timetable"}
      </button>

      {genResult && (
        <div className={`rounded-xl p-4 border ${genResult.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <p className="font-semibold">{genResult.success ? "Generation completed!" : "Generation had issues"}</p>
          <p className="text-sm mt-1">Score: {genResult.score} | Entries: {genResult.entries.length}</p>
          {genResult.violations.length > 0 && (
            <ul className="mt-2 text-sm text-red-700 list-disc pl-4">
              {genResult.violations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          )}
        </div>
      )}

      {timetables.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Generated Timetables</h3>
          <div className="flex items-center gap-3 mb-4">
            <select value={viewTT} onChange={(e) => setViewTT(e.target.value)} className="border border-outline-variant rounded-lg p-2 text-sm bg-surface flex-1">
              <option value="">Select timetable</option>
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>{new Date(t.generatedAt).toLocaleDateString()} (score: {t.generationScore})</option>
              ))}
            </select>
            {viewTT && (
              <button onClick={async () => {
                setPublishing(true); setPubState(null);
                const res = await publishTimetableAction(viewTT);
                setPubState(res); setPublishing(false);
              }} disabled={publishing}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap">
                {publishing ? "Publishing..." : "Publish to Timetable"}
              </button>
            )}
          </div>
          {pubState?.success && <p className="text-emerald-600 text-sm mb-3">{pubState.success}</p>}
          {pubState?.error && <p className="text-red-600 text-sm mb-3">{pubState.error}</p>}
          {viewEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-on-surface-variant text-xs uppercase border-b border-outline-variant">
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Teacher</th>
                    <th className="px-3 py-2">Locked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {viewEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2">{e.className}</td>
                      <td className="px-3 py-2">{DAY_NAMES[e.day]}</td>
                      <td className="px-3 py-2">{e.subjectName}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{e.staffName ?? "—"}</td>
                      <td className="px-3 py-2">{e.isLocked ? "🔒" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">No entries to display.</p>
          )}
        </div>
      )}
    </div>
  );
}
