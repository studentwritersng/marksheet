"use client";

import { useActionState } from "react";
import {
  updateReminderConfigAction,
  sendRemindersAction,
  type ActionState,
} from "./actions";

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
  weeklyEnabled,
  dayOfWeek,
  classes,
  preview,
}: {
  activeTermId: string;
  activeTermName: string;
  weeklyEnabled: boolean;
  dayOfWeek: number;
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

  return (
    <div className="flex flex-col gap-8">
      {/* Weekly schedule */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Weekly reminder schedule
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Optionally send fee reminders automatically once a week.
        </p>
        <form action={configAction} className="mt-4 flex flex-wrap items-end gap-4">
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
          <button type="submit" disabled={configPending} className={btnCls}>
            {configPending ? "Saving…" : "Save schedule"}
          </button>
        </form>
        {configState.error && (
          <p className="mt-3 text-sm text-red-600">{configState.error}</p>
        )}
        {configState.success && (
          <p className="mt-3 text-sm text-green-600">{configState.success}</p>
        )}
      </section>

      {/* Send now */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Send reminders now
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Notify guardians of every student who owes for{" "}
          <strong>{activeTermName}</strong>.
        </p>
        <form action={sendAction} className="mt-4 flex flex-wrap items-end gap-4">
          <input type="hidden" name="termId" value={activeTermId} />
          <div className="flex flex-col gap-1">
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
          <button type="submit" disabled={sendPending} className={btnCls}>
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
