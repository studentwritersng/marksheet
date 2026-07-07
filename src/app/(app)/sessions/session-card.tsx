"use client";

import { useState, useTransition } from "react";
import {
  setCurrentSessionAction,
  setCurrentTermAction,
  updateTermDatesAction,
  type ActionState,
} from "./actions";

interface TermVM {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
}
interface SessionVM {
  id: string;
  label: string;
  status: string;
  isCurrent: boolean;
  terms: TermVM[];
}

export function SessionCard({ session }: { session: SessionVM }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<ActionState>({});

  function makeCurrent() {
    if (
      !confirm(
        `Make ${session.label} the current session? This will close the previously current session.`,
      )
    )
      return;
    startTransition(async () => setMsg(await setCurrentSessionAction(session.id)));
  }

  function makeTermCurrent(termId: string) {
    startTransition(async () => setMsg(await setCurrentTermAction(termId)));
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {session.label}
          </h2>
          <StatusBadge status={session.status} isCurrent={session.isCurrent} />
        </div>
        {!session.isCurrent && (
          <button
            onClick={makeCurrent}
            disabled={pending}
            className="border border-outline-variant text-primary font-label-md text-label-md py-2 px-4 rounded bg-surface-container-lowest hover:bg-surface-container-low transition-colors disabled:opacity-60"
          >
            Set as current
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {session.terms.map((t) => (
          <TermEditor
            key={t.id}
            term={t}
            pending={pending}
            onMakeCurrent={() => makeTermCurrent(t.id)}
            onSaved={setMsg}
          />
        ))}
      </div>

      {msg.error && <p className="mt-3 text-sm text-red-600">{msg.error}</p>}
      {msg.success && (
        <p className="mt-3 text-sm text-green-600">{msg.success}</p>
      )}
    </div>
  );
}

function TermEditor({
  term,
  pending,
  onMakeCurrent,
  onSaved,
}: {
  term: TermVM;
  pending: boolean;
  onMakeCurrent: () => void;
  onSaved: (s: ActionState) => void;
}) {
  const [saving, startSave] = useTransition();

  return (
    <div
      className={`rounded-lg border p-3 ${
        term.isCurrent
          ? "bg-surface-container-low"
          : "border-outline-variant"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-label-md text-label-md text-on-surface">
          {term.name} Term
        </span>
        {term.isCurrent ? (
          <span className="font-label-sm text-label-sm text-on-surface">Current</span>
        ) : (
          <button
            onClick={onMakeCurrent}
            disabled={pending}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            Set current
          </button>
        )}
      </div>
      <form
        action={(fd) => {
          fd.set("termId", term.id);
          startSave(async () => onSaved(await updateTermDatesAction({}, fd)));
        }}
        className="space-y-2"
      >
        <input
          type="date"
          name="startDate"
          defaultValue={term.startDate}
          className="w-full rounded border border-outline-variant px-2 py-1 text-xs"
        />
        <input
          type="date"
          name="endDate"
          defaultValue={term.endDate}
          className="w-full rounded border border-outline-variant px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-surface-container px-2 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save dates"}
        </button>
      </form>
    </div>
  );
}

function StatusBadge({
  status,
  isCurrent,
}: {
  status: string;
  isCurrent: boolean;
}) {
  const cls = isCurrent
    ? "bg-secondary-container text-on-secondary-container"
    : status === "closed"
      ? "bg-surface-variant text-on-surface-variant"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {isCurrent ? "Current" : status}
    </span>
  );
}
