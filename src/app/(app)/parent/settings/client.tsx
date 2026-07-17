"use client";

import { useState } from "react";
import { updateParentNotificationPrefsAction, EVENT_TYPE_LABELS } from "./actions";

interface Props {
  parentAccountId: string;
  initialPrefs: Record<string, unknown>;
  phone: string | null;
}

export function ParentSettingsClient({ parentAccountId, initialPrefs, phone }: Props) {
  const [prefs, setPrefs] = useState({
    smsActive: (initialPrefs.smsActive as boolean) ?? false,
    whatsappActive: (initialPrefs.whatsappActive as boolean) ?? false,
    enabledEvents: (initialPrefs.enabledEvents as string[]) ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const toggleEvent = (event: string) => {
    setPrefs((prev) => ({
      ...prev,
      enabledEvents: prev.enabledEvents.includes(event)
        ? prev.enabledEvents.filter((e) => e !== event)
        : [...prev.enabledEvents, event],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await updateParentNotificationPrefsAction(parentAccountId, prefs);
    if (result.error) setMessage({ type: "error", text: result.error });
    else setMessage({ type: "success", text: result.success! });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {message && (
        <div className={`px-4 py-3 rounded-xl font-body-sm text-body-sm ${
          message.type === "success"
            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
            : "bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]"
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Contact Info</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Phone: {phone ?? "Not set"}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Notification Channels</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.smsActive}
              onChange={(e) => setPrefs((p) => ({ ...p, smsActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-body-md text-body-md">SMS</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.whatsappActive}
              onChange={(e) => setPrefs((p) => ({ ...p, whatsappActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-body-md text-body-md">WhatsApp</span>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Notify Me About</h2>
        <div className="flex flex-col gap-3">
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.enabledEvents.includes(key)}
                onChange={() => toggleEvent(key)}
                className="w-4 h-4"
              />
              <span className="font-body-md text-body-md">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving&hellip;" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
