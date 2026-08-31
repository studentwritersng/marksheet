"use client";

import { useActionState, useRef, useState } from "react";
import {
  updateReminderConfigAction,
  sendRemindersAction,
  type ActionState,
} from "./actions";
import { FEE_REMINDER_VARIABLES, DEFAULT_FEE_REMINDER_TEMPLATE } from "@/lib/messages/template";
import { buildFeeReminderContentFromTemplate } from "@/lib/fees/bursary";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface WardPreview {
  name: string;
  className: string;
  balance: number;
}
interface PreviewEntry {
  name?: string;
  email?: string;
  parentUserId?: string;
  wards: WardPreview[];
}

const init: ActionState = {};

const inputCls =
  "rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors";
const btnCls =
  "bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60";

export function RemindersManager({
  activeTermId,
  activeTermName,
  activeTermNameRaw,
  sessionLabel,
  schoolName,
  weeklyEnabled,
  dayOfWeek,
  messageTemplate,
  classes,
  preview,
}: {
  activeTermId: string;
  activeTermName: string;
  activeTermNameRaw?: string;
  sessionLabel?: string;
  schoolName?: string;
  weeklyEnabled: boolean;
  dayOfWeek: number;
  messageTemplate: string | null;
  classes: { id: string; name: string }[];
  preview: PreviewEntry[];
}) {
  const [configState, configAction, configPending] = useActionState(
    updateReminderConfigAction,
    init,
  );
  const [sendState, sendAction, sendPending] = useActionState(
    sendRemindersAction,
    init,
  );

  const initialTemplate = messageTemplate ?? DEFAULT_FEE_REMINDER_TEMPLATE;
  const [templateValue, setTemplateValue] = useState(initialTemplate);
  const [customMessage, setCustomMessage] = useState(initialTemplate);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const customRef = useRef<HTMLTextAreaElement>(null);

  function insertInto(ref: React.RefObject<HTMLTextAreaElement | null>, setter: (v: string) => void, current: string, key: string) {
    const tag = `{{${key}}}`;
    const el = ref.current;
    if (!el) { setter(current + (current.endsWith(" ") || current === "" ? "" : " ") + tag + " "); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + tag + current.slice(end);
    setter(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const samplePreview = (() => {
    if (preview.length === 0) return null;
    const first = preview[0];
    const wards = first.wards.map((w) => ({ name: w.name, className: w.className, expected: 50000, paid: Math.max(0, 50000 - w.balance), balance: w.balance }));
    try {
      return buildFeeReminderContentFromTemplate(templateValue || DEFAULT_FEE_REMINDER_TEMPLATE, {
        guardianName: first.name ?? "Guardian",
        wards: wards.length ? wards : [{ name: "Chiamaka Okafor", className: "JSS2A", expected: 50000, paid: 20000, balance: 30000 }],
        schoolName: schoolName ?? "Your School",
        termName: activeTermNameRaw ?? activeTermName,
        sessionLabel: sessionLabel ?? "",
      });
    } catch { return templateValue; }
  })();

  return (
    <div className="flex flex-col gap-8">
      {/* Weekly schedule + editable template */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Weekly reminder schedule
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Optionally send fee reminders automatically once a week. Customize the message below with variables.
        </p>
        <form action={configAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
              <input
                type="checkbox"
                name="weeklyEnabled"
                defaultChecked={weeklyEnabled}
                className="h-4 w-4"
              />
              Enable weekly reminders
            </label>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">
                Day of week
              </label>
              <select
                name="dayOfWeek"
                defaultValue={String(dayOfWeek)}
                className={inputCls}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface">Auto reminder message template</label>
              <button type="button" onClick={() => setTemplateValue(DEFAULT_FEE_REMINDER_TEMPLATE)} className="font-label-sm text-label-sm text-primary hover:underline">Reset to default</button>
            </div>
            <textarea
              ref={templateRef}
              name="messageTemplate"
              value={templateValue}
              onChange={(e) => setTemplateValue(e.target.value)}
              rows={6}
              className="w-full rounded border border-outline-variant px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
              placeholder={DEFAULT_FEE_REMINDER_TEMPLATE}
            />
            <div className="flex flex-wrap gap-1.5">
              {FEE_REMINDER_VARIABLES.map((v) => (
                <button key={v.key} type="button" onClick={() => insertInto(templateRef, setTemplateValue, templateValue, v.key)} title={`${v.description} — e.g. ${v.example}`} className="rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-on-surface hover:bg-primary-container hover:text-on-primary-container">
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Use {"{{ward_list}}"} for all wards, {"{{total_balance}}"} for sum, plus guardian_name, student_name, class, balance, expected, paid, school_name, term, session, date, time.</p>
            {samplePreview && (
              <div className="rounded bg-surface-container-low border border-outline-variant p-3">
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Preview (first guardian):</p>
                <p className="font-body-sm text-body-sm text-on-surface whitespace-pre-wrap">{samplePreview}</p>
              </div>
            )}
          </div>
          <button type="submit" disabled={configPending} className={btnCls}>
            {configPending ? "Saving…" : "Save schedule & template"}
          </button>
        </form>
        {configState.error && (
          <p className="mt-3 text-sm text-red-600">{configState.error}</p>
        )}
        {configState.success && (
          <p className="mt-3 text-sm text-green-600">{configState.success}</p>
        )}
      </section>

      {/* Send now — with editable per-send override */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Send reminders now
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Notify guardians of every student who owes for{" "}
          <strong>{activeTermName}</strong>. You can edit the message for this send — variables are replaced per guardian.
        </p>
        <form action={sendAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="termId" value={activeTermId} />
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="font-label-md text-label-md text-on-surface">
              Class (optional)
            </label>
            <select name="classId" defaultValue="" className={inputCls}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface">Message to send (editable)</label>
            <textarea
              ref={customRef}
              name="customMessage"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={5}
              className="w-full rounded border border-outline-variant px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
            />
            <div className="flex flex-wrap gap-1.5">
              {FEE_REMINDER_VARIABLES.map((v) => (
                <button key={v.key} type="button" onClick={() => insertInto(customRef, setCustomMessage, customMessage, v.key)} title={`${v.description} — e.g. ${v.example}`} className="rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-on-surface hover:bg-primary-container hover:text-on-primary-container">
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={sendPending} className={btnCls + " self-start"}>
            {sendPending ? "Sending…" : "Send reminders now"}
          </button>
        </form>
        {sendState.error && (
          <p className="mt-3 text-sm text-red-600">{sendState.error}</p>
        )}
        {sendState.success && (
          <p className="mt-3 text-sm text-green-600">{sendState.success}</p>
        )}
      </section>

      {/* Preview of who will be reminded */}
      <section>
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">
          Owing guardians ({preview.length})
        </h2>
        {preview.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No guardians with outstanding balances for {activeTermName}.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {preview.map((g, i) => (
              <li
                key={i}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
              >
                <p className="font-label-md text-label-md text-on-surface">
                  {g.name ?? "Guardian"}
                  {g.email ? ` · ${g.email}` : ""}
                </p>
                <ul className="mt-2 flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">
                  {g.wards.map((w, j) => (
                    <li key={j}>
                      {w.name} ({w.className}) — balance ₦
                      {Math.round(w.balance).toLocaleString("en-NG")}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
