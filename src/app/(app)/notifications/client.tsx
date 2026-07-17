"use client";

import { useState, useEffect } from "react";
import {
  getProviderConfigs,
  saveProviderConfigAction,
  deleteProviderConfigAction,
  getTemplates,
  saveTemplateAction,
  deleteTemplateAction,
  getSchoolNotificationConfig,
  updateSchoolNotificationConfigAction,
  sendTestNotificationAction,
  getNotificationLogs,
  getQueueItems,
  processNotificationQueueAction,
} from "@/lib/notifications/provider-actions";
import {
  EVENT_TYPE_LABELS,
  type ProviderConfigVM,
  type TemplateVM,
  type SchoolNotifConfigVM,
  type LogEntryVM,
  type QueueItemVM,
} from "@/lib/notifications/types";

interface Props {
  schoolId: string;
  isPlatformOwner: boolean;
}

type Tab = "settings" | "templates" | "providers" | "logs" | "queue";

export function NotificationsClient({ schoolId, isPlatformOwner }: Props) {
  const [tab, setTab] = useState<Tab>("settings");

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: "School Settings" },
    { key: "templates", label: "Templates" },
    { key: "logs", label: "Logs" },
  ];
  if (isPlatformOwner) {
    tabs.splice(1, 0, { key: "providers", label: "Providers" });
    tabs.push({ key: "queue", label: "Queue" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b border-outline-variant overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-body-sm text-body-sm border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SchoolSettingsTab schoolId={schoolId} />}
      {tab === "providers" && <ProvidersTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "logs" && <LogsTab schoolId={schoolId} isPlatformOwner={isPlatformOwner} />}
      {tab === "queue" && <QueueTab />}
    </div>
  );
}

// ── School Settings Tab ───────────────────────────────────────────────────

function SchoolSettingsTab({ schoolId }: { schoolId: string }) {
  const [config, setConfig] = useState<SchoolNotifConfigVM>({ smsActive: false, whatsappActive: false, enabledEvents: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testChannel, setTestChannel] = useState("sms");
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("This is a test message from Marksheet.");

  useEffect(() => {
    getSchoolNotificationConfig(schoolId).then((c) => {
      if (c) setConfig(c);
      setLoading(false);
    });
  }, [schoolId]);

  const toggleEvent = (event: string) => {
    setConfig((prev) => ({
      ...prev,
      enabledEvents: prev.enabledEvents.includes(event)
        ? prev.enabledEvents.filter((e) => e !== event)
        : [...prev.enabledEvents, event],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await updateSchoolNotificationConfigAction(schoolId, config);
    if (result.error) setMessage({ type: "error", text: result.error });
    else setMessage({ type: "success", text: result.success! });
    setSaving(false);
  };

  const handleTestSend = async () => {
    if (!testRecipient) return;
    setMessage(null);
    const result = await sendTestNotificationAction(schoolId, testChannel, testRecipient, testMessage);
    if (result.error) setMessage({ type: "error", text: result.error });
    else setMessage({ type: "success", text: result.success! });
  };

  if (loading) return <p className="font-body-md text-body-md text-on-surface-variant">Loading&hellip;</p>;

  return (
    <div className="flex flex-col gap-4">
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
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Channel Settings</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.smsActive}
              onChange={(e) => setConfig((p) => ({ ...p, smsActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-body-md text-body-md">SMS Notifications</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.whatsappActive}
              onChange={(e) => setConfig((p) => ({ ...p, whatsappActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-body-md text-body-md">WhatsApp Notifications</span>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Enable Events</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabledEvents.includes(key)}
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
          {saving ? "Saving&hellip;" : "Save Settings"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Send Test Message</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <select
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input
              type="text"
              placeholder="Recipient phone (e.g. +2348012345678)"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md flex-1 min-w-[200px]"
            />
          </div>
          <textarea
            placeholder="Message content"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            rows={3}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
          />
          <div className="flex justify-end">
            <button
              onClick={handleTestSend}
              disabled={!testRecipient}
              className="px-4 py-2 bg-white text-[#002046] border border-[#002046] rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Send Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Providers Tab (Platform Owner Only) ───────────────────────────────────

function ProvidersTab() {
  const [configs, setConfigs] = useState<ProviderConfigVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const [formChannel, setFormChannel] = useState("sms");
  const [formProvider, setFormProvider] = useState("twilio");
  const [formLabel, setFormLabel] = useState("");
  const [formCredentials, setFormCredentials] = useState("{\n  \n}");
  const [formSortOrder, setFormSortOrder] = useState(0);

  useEffect(() => {
    getProviderConfigs().then((data) => {
      setConfigs(data);
      setLoading(false);
    });
  }, []);

  const reload = () => {
    getProviderConfigs().then((data) => setConfigs(data));
  };

  const resetForm = () => {
    setEditing(null);
    setFormChannel("sms");
    setFormProvider("twilio");
    setFormLabel("");
    setFormCredentials("{\n  \n}");
    setFormSortOrder(0);
  };

  const editConfig = (cfg: ProviderConfigVM) => {
    setEditing(cfg.id);
    setFormChannel(cfg.channel);
    setFormProvider(cfg.provider);
    setFormLabel(cfg.label ?? "");
    setFormCredentials("{\n  \n}");
    setFormSortOrder(cfg.sortOrder);
  };

  const handleSave = async () => {
    setMessage(null);
    const result = await saveProviderConfigAction({
      id: editing ?? undefined,
      channel: formChannel,
      provider: formProvider,
      label: formLabel || undefined,
      credentials: formCredentials,
      sortOrder: formSortOrder,
    });
    if (result.error) setMessage({ type: "error", text: result.error });
    else { setMessage({ type: "success", text: result.success! }); resetForm(); reload(); }
  };

  const handleDelete = async (id: string) => {
    setMessage(null);
    const result = await deleteProviderConfigAction(id);
    if (result.error) setMessage({ type: "error", text: result.error });
    else { setMessage({ type: "success", text: result.success! }); reload(); }
  };

  if (loading) return <p className="font-body-md text-body-md text-on-surface-variant">Loading&hellip;</p>;

  return (
    <div className="flex flex-col gap-4">
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
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Provider Configurations</h2>
        {configs.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No providers configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant">
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Label</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.id} className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-body-sm text-body-sm uppercase">{c.channel}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{c.provider}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{c.label ?? "&mdash;"}</td>
                    <td className="py-2 pr-4">{c.isActive ? <span className="text-[#2E7D32] font-semibold">Yes</span> : "No"}</td>
                    <td className="py-2 flex gap-2">
                      <button onClick={() => editConfig(c)} className="text-sm text-primary underline">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-sm text-[#C62828] underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">
          {editing ? "Edit Provider" : "Add Provider"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Channel</label>
            <select value={formChannel} onChange={(e) => setFormChannel(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md">
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Provider</label>
            <select value={formProvider} onChange={(e) => setFormProvider(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md">
              <option value="twilio">Twilio</option>
              <option value="africastalking">Africa&apos;s Talking</option>
              <option value="whatsapp_business">WhatsApp Business API</option>
              <option value="waha">WAHA (WhatsApp HTTP API)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Label</label>
            <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Sort Order</label>
            <input type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          <label className="font-body-sm text-body-sm text-on-surface-variant">Credentials (JSON)</label>
          <textarea
            value={formCredentials}
            onChange={(e) => setFormCredentials(e.target.value)}
            rows={5}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md font-mono text-sm"
          />
          <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">
            Twilio: {`{ "accountSid": "...", "authToken": "...", "from": "+1..." }`}
            <br />
            Africa&apos;s Talking: {`{ "apiKey": "...", "username": "...", "from": "..." }`}
            <br />
            WhatsApp: {`{ "accessToken": "...", "phoneNumberId": "..." }`}
            <br />
            WAHA: {`{ "baseUrl": "http://host:3001", "apiKey": "...", "session": "default" }`}
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          {editing && <button onClick={resetForm} className="px-4 py-2 border border-outline-variant rounded-lg text-sm">Cancel</button>}
          <button onClick={handleSave}
            className="px-6 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] transition-colors">
            {editing ? "Update" : "Add Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const [formEventType, setFormEventType] = useState("attendance_marked_absent");
  const [formChannel, setFormChannel] = useState("sms");
  const [formLabel, setFormLabel] = useState("");
  const [formBody, setFormBody] = useState("");

  useEffect(() => {
    getTemplates().then((data) => {
      setTemplates(data);
      setLoading(false);
    });
  }, []);

  const reload = () => {
    getTemplates().then((data) => setTemplates(data));
  };

  const resetForm = () => {
    setEditing(null);
    setFormEventType("attendance_marked_absent");
    setFormChannel("sms");
    setFormLabel("");
    setFormBody("");
  };

  const editTemplate = (t: TemplateVM) => {
    setEditing(t.id);
    setFormEventType(t.eventType);
    setFormChannel(t.channel);
    setFormLabel(t.label ?? "");
    setFormBody(t.body);
  };

  const handleSave = async () => {
    setMessage(null);
    const result = await saveTemplateAction({
      id: editing ?? undefined,
      eventType: formEventType,
      channel: formChannel,
      label: formLabel || undefined,
      body: formBody,
    });
    if (result.error) setMessage({ type: "error", text: result.error });
    else { setMessage({ type: "success", text: result.success! }); resetForm(); reload(); }
  };

  const handleDelete = async (id: string) => {
    setMessage(null);
    const result = await deleteTemplateAction(id);
    if (result.error) setMessage({ type: "error", text: result.error });
    else { setMessage({ type: "success", text: result.success! }); reload(); }
  };

  if (loading) return <p className="font-body-md text-body-md text-on-surface-variant">Loading&hellip;</p>;

  return (
    <div className="flex flex-col gap-4">
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
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Message Templates</h2>
        {templates.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No templates defined yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant">
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2 pr-4">Label</th>
                  <th className="py-2 pr-4">Body</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{EVENT_TYPE_LABELS[t.eventType] ?? t.eventType}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm uppercase">{t.channel}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm">{t.label ?? "&mdash;"}</td>
                    <td className="py-2 pr-4 font-body-sm text-body-sm max-w-[200px] truncate">{t.body}</td>
                    <td className="py-2 pr-4">{t.isActive ? <span className="text-[#2E7D32] font-semibold">Yes</span> : "No"}</td>
                    <td className="py-2 flex gap-2">
                      <button onClick={() => editTemplate(t)} className="text-sm text-primary underline">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-sm text-[#C62828] underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">
          {editing ? "Edit Template" : "New Template"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Event Type</label>
            <select value={formEventType} onChange={(e) => setFormEventType(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md">
              {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Channel</label>
            <select value={formChannel} onChange={(e) => setFormChannel(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md">
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-body-sm text-on-surface-variant">Label</label>
            <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          <label className="font-body-sm text-body-sm text-on-surface-variant">Message Body</label>
          <textarea
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
            rows={4}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md"
            placeholder="Hello {{guardianName}}, your child {{studentName}} was marked absent today."
          />
          <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">
            Available variables: {`{{studentName}}`}, {`{{guardianName}}`}, {`{{className}}`}, {`{{examName}}`}, {`{{subjectName}}`}, {`{{termName}}`}, {`{{schoolName}}`}
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          {editing && <button onClick={resetForm} className="px-4 py-2 border border-outline-variant rounded-lg text-sm">Cancel</button>}
          <button onClick={handleSave}
            className="px-6 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] transition-colors">
            {editing ? "Update" : "Add Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Logs Tab ─────────────────────────────────────────────────────────────

function LogsTab({ schoolId, isPlatformOwner }: { schoolId: string; isPlatformOwner: boolean }) {
  const [logs, setLogs] = useState<LogEntryVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotificationLogs(isPlatformOwner ? undefined : schoolId).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, [schoolId, isPlatformOwner]);

  const reload = () => {
    getNotificationLogs(isPlatformOwner ? undefined : schoolId).then((data) => setLogs(data));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Send Log</h2>
        <button onClick={reload} disabled={loading}
          className="px-4 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors">
          {loading ? "Loading&hellip;" : "Refresh"}
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-4">No logs yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant sticky top-0 bg-white">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Recipient</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-outline-variant/50">
                  <td className="py-2 pr-4 font-body-xs text-body-xs text-on-surface-variant whitespace-nowrap">
                    {new Date(l.sentAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 font-body-sm text-body-sm uppercase">{l.channel}</td>
                  <td className="py-2 pr-4 font-body-sm text-body-sm">{EVENT_TYPE_LABELS[l.eventType] ?? l.eventType}</td>
                  <td className="py-2 pr-4 font-body-sm text-body-sm">{l.recipient}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      l.status === "sent" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#FFEBEE] text-[#C62828]"
                    }`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-2 font-body-xs text-body-xs text-[#C62828] max-w-[150px] truncate">
                    {l.error ?? "&mdash;"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Queue Tab (Platform Owner Only) ───────────────────────────────────────

function QueueTab() {
  const [items, setItems] = useState<QueueItemVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getQueueItems().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const reload = () => {
    getQueueItems().then((data) => setItems(data));
  };

  const handleProcess = async () => {
    setProcessing(true);
    setMessage(null);
    const result = await processNotificationQueueAction(50);
    setMessage(`Processed: ${result.processed} sent, ${result.failed} failed.`);
    setProcessing(false);
    reload();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Notification Queue</h2>
        <div className="flex gap-2">
          <button onClick={handleProcess} disabled={processing}
            className="px-4 py-2 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors">
            {processing ? "Processing&hellip;" : "Process Queue"}
          </button>
          <button onClick={reload} disabled={loading}
            className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-3 px-4 py-2 rounded-lg bg-[#E8F5E9] text-[#2E7D32] font-body-sm text-body-sm border border-[#A5D6A7]">
          {message}
        </div>
      )}

      {items.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant text-center py-4">Queue is empty.</p>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant font-body-sm text-body-sm text-on-surface-variant sticky top-0 bg-white">
                <th className="py-2 pr-4">Scheduled</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Recipient</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-outline-variant/50">
                  <td className="py-2 pr-4 font-body-xs text-body-xs text-on-surface-variant whitespace-nowrap">
                    {new Date(i.scheduledAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 font-body-sm text-body-sm uppercase">{i.channel}</td>
                  <td className="py-2 pr-4 font-body-sm text-body-sm">{EVENT_TYPE_LABELS[i.eventType] ?? i.eventType}</td>
                  <td className="py-2 pr-4 font-body-sm text-body-sm">{i.recipient}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      i.status === "pending" ? "bg-[#FFF8E1] text-[#F57F17]" :
                      i.status === "sent" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#FFEBEE] text-[#C62828]"
                    }`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="py-2 font-body-xs text-body-xs text-[#C62828] max-w-[150px] truncate">
                    {i.error ?? "&mdash;"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
