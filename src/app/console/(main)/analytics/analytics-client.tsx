"use client";

import { useState } from "react";
import {
  saveAnalyticsConfigAction,
  seedConversionEventsAction,
  upsertConversionEventAction,
  deleteConversionEventAction,
} from "./actions";

interface ConfigVM {
  id: string;
  ga4MeasurementId: string | null;
  consentModeEnabled: boolean;
  isActive: boolean;
}

interface EventVM {
  id: string;
  eventName: string;
  ga4EventMapping: string;
  isActive: boolean;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30";

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-white/20 bg-white/5 text-white accent-white"
      />
      <span className="text-sm text-white/70">{label}</span>
    </label>
  );
}

export function AnalyticsClient({
  config,
  events,
}: {
  config: ConfigVM | null;
  events: EventVM[];
}) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventVM | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function resetEventForm() {
    setShowEventForm(false);
    setEditingEvent(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="text-sm text-white/40 mt-1">
            Platform-wide GA4 configuration and conversion event definitions
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`text-xs px-4 py-2 rounded-lg ${
            message.ok ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">GA4 Configuration</h2>
        <form
          action={async (fd: FormData) => {
            const res = await saveAnalyticsConfigAction(fd);
            setMessage(
              res.ok
                ? { ok: true, text: "Analytics configuration saved." }
                : { ok: false, text: res.error ?? "Failed." }
            );
          }}
          className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
        >
          <label className="block max-w-md">
            <span className="text-xs text-white/50">GA4 Measurement ID</span>
            <input
              name="ga4MeasurementId"
              placeholder="G-XXXXXXXXXX"
              defaultValue={config?.ga4MeasurementId ?? ""}
              className={inputClass}
            />
            <span className="text-[11px] text-white/30 mt-1 block">
              Format: G-XXXXXXXXXX. Leave blank to disable tracking.
            </span>
          </label>

          <div className="flex flex-wrap gap-6">
            <Toggle
              name="consentModeEnabled"
              label="Consent mode enabled"
              defaultChecked={config?.consentModeEnabled ?? true}
            />
            <Toggle
              name="isActive"
              label="Analytics active"
              defaultChecked={config?.isActive ?? false}
            />
          </div>

          <button
            type="submit"
            className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
          >
            Save configuration
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Conversion Events</h2>
          <div className="flex gap-2">
            {events.length === 0 && (
              <button
                onClick={async () => {
                  const res = await seedConversionEventsAction();
                  setMessage(
                    res.ok
                      ? { ok: true, text: "Default conversion events created." }
                      : { ok: false, text: res.error ?? "Failed." }
                  );
                }}
                className="text-xs bg-white/10 text-white font-medium px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                Seed defaults
              </button>
            )}
            <button
              onClick={() => {
                setEditingEvent(null);
                setShowEventForm((v) => !v);
              }}
              className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
            >
              {showEventForm ? "Cancel" : "+ Add event"}
            </button>
          </div>
        </div>

        {showEventForm && (
          <form
            action={async (fd: FormData) => {
              const res = await upsertConversionEventAction(fd);
              if (res.ok) {
                setMessage({ ok: true, text: "Conversion event saved." });
                resetEventForm();
              } else {
                setMessage({ ok: false, text: res.error ?? "Failed." });
              }
            }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
          >
            {editingEvent && <input type="hidden" name="id" defaultValue={editingEvent.id} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-white/50">Event name (unique)</span>
                <input
                  name="eventName"
                  required
                  placeholder="demo_request_submitted"
                  defaultValue={editingEvent?.eventName ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">GA4 event mapping</span>
                <input
                  name="ga4EventMapping"
                  required
                  placeholder="generate_lead"
                  defaultValue={editingEvent?.ga4EventMapping ?? ""}
                  className={inputClass}
                />
              </label>
            </div>
            <Toggle
              name="isActive"
              label="Event active"
              defaultChecked={editingEvent?.isActive ?? true}
            />
            <button
              type="submit"
              className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
            >
              {editingEvent ? "Save changes" : "Create event"}
            </button>
          </form>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Event name</th>
                <th className="px-4 py-3 font-medium">GA4 mapping</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white font-mono text-xs">{e.eventName}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">{e.ga4EventMapping}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full text-[10px] px-2 py-0.5 font-medium ${
                        e.isActive ? "bg-emerald-900/50 text-emerald-300" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {e.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingEvent(e);
                          setShowEventForm(true);
                        }}
                        className="text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/30"
                      >
                        Edit
                      </button>
                      <form
                        action={async (fd: FormData) => {
                          const res = await deleteConversionEventAction(fd);
                          setMessage(
                            res.ok
                              ? { ok: true, text: "Conversion event deleted." }
                              : { ok: false, text: res.error ?? "Failed." }
                          );
                        }}
                      >
                        <input type="hidden" name="id" defaultValue={e.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-300/70 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900/40 hover:border-red-700"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-white/30 text-sm">
                    No conversion events yet. Use &quot;Seed defaults&quot; or add one manually.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
