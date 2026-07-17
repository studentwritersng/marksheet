"use client";

import { useState, useEffect } from "react";
import {
  getProviderConfigs,
  saveProviderConfigAction,
  deleteProviderConfigAction,
  getTemplates,
  saveTemplateAction,
  deleteTemplateAction,
} from "@/lib/notifications/provider-actions";
import { EVENT_TYPE_LABELS, type ProviderConfigVM, type TemplateVM } from "@/lib/notifications/types";


export function ConsoleNotificationsClient() {
  const [tab, setTab] = useState<"providers" | "templates">("providers");
  const [configs, setConfigs] = useState<ProviderConfigVM[]>([]);
  const [templates, setTemplates] = useState<TemplateVM[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setMessage(null);
    try {
      const [c, t] = await Promise.all([getProviderConfigs(), getTemplates()]);
      setConfigs(c);
      setTemplates(t);
    } catch { setMessage("Failed to load data."); }
  };

  useEffect(() => { load(); }, []);

  const handleDeleteProvider = async (id: string) => {
    const r = await deleteProviderConfigAction(id);
    setMessage(r.error ?? r.success ?? null);
    if (r.success) load();
  };

  const handleDeleteTemplate = async (id: string) => {
    const r = await deleteTemplateAction(id);
    setMessage(r.error ?? r.success ?? null);
    if (r.success) load();
  };

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <div className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-slate-200 border border-slate-700">
          {message}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-700">
        <button onClick={() => setTab("providers")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "providers" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
          Providers
        </button>
        <button onClick={() => setTab("templates")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "templates" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
          Templates
        </button>
      </div>

      {tab === "providers" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">Configure Twilio, Africa&apos;s Talking, or WhatsApp Business API providers.</p>
          {configs.map((cfg) => (
            <div key={cfg.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${cfg.isActive ? "bg-green-500" : "bg-slate-500"}`} />
                <span className="text-sm text-white font-medium">{cfg.label ?? cfg.provider}</span>
                <span className="text-xs text-slate-400 ml-2">({cfg.channel})</span>
              </div>
              <button onClick={() => handleDeleteProvider(cfg.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
            </div>
          ))}
          <ProviderForm onSaved={load} />
        </div>
      )}

      {tab === "templates" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">Message templates for notification events. Use {'{{variable}}'} placeholders.</p>
          {templates.map((t) => (
            <div key={t.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${t.isActive ? "bg-green-900 text-green-300" : "bg-slate-700 text-slate-400"}`}>{t.channel}</span>
                  <span className="text-xs text-slate-400">{EVENT_TYPE_LABELS[t.eventType] ?? t.eventType}</span>
                </div>
                <p className="text-sm text-slate-300 truncate">{t.body}</p>
              </div>
              <button onClick={() => handleDeleteTemplate(t.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0 ml-2">Delete</button>
            </div>
          ))}
          <TemplateForm onSaved={load} />
        </div>
      )}
    </div>
  );
}

function ProviderForm({ onSaved }: { onSaved: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await saveProviderConfigAction({
      channel: fd.get("channel") as string,
      provider: fd.get("provider") as string,
      label: fd.get("label") as string,
      credentials: fd.get("credentials") as string,
    });
    if (r.success) { setIsOpen(false); onSaved(); }
  };

  if (!isOpen) return <button onClick={() => setIsOpen(true)} className="self-start px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500">+ Add Provider</button>;

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <select name="channel" required className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
          <option value="">Channel</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select name="provider" required className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
          <option value="">Provider</option>
          <option value="twilio">Twilio</option>
          <option value="africastalking">Africa&apos;s Talking</option>
          <option value="whatsapp_business">WhatsApp Business</option>
        </select>
      </div>
      <input name="label" placeholder="Label (optional)" className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder:text-slate-400" />
      <textarea name="credentials" required placeholder='{"apiKey":"...","username":"..."}' rows={3} className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder:text-slate-400 font-mono" />
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500">Save</button>
        <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600">Cancel</button>
      </div>
    </form>
  );
}

function TemplateForm({ onSaved }: { onSaved: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await saveTemplateAction({
      eventType: fd.get("eventType") as string,
      channel: fd.get("channel") as string,
      body: fd.get("body") as string,
    });
    if (r.success) { setIsOpen(false); onSaved(); }
  };

  if (!isOpen) return <button onClick={() => setIsOpen(true)} className="self-start px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500">+ Add Template</button>;

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <select name="eventType" required className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
          <option value="">Event Type</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="channel" required className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
          <option value="">Channel</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
      <textarea name="body" required placeholder="{{studentName}} signed in at {{time}}" rows={3} className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder:text-slate-400" />
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500">Save</button>
        <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600">Cancel</button>
      </div>
    </form>
  );
}
