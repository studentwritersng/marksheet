"use client";

import { useActionState, useState } from "react";
import { upsertAiProviderAction, deleteAiProviderAction } from "./actions";

export function AiProviderForm({
  provider,
}: {
  provider: { id: string; label: string; baseUrl: string; defaultModelName: string; isActive: boolean } | null;
}) {
  const [state, action, pending] = useActionState(upsertAiProviderAction, {});
  const [showForm, setShowForm] = useState(!provider);

  if (!provider && !showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="w-full border-2 border-dashed border-outline-variant rounded-xl p-6 text-on-surface-variant font-label-md text-label-md hover:border-primary hover:text-primary transition-colors">
        + Add AI Provider
      </button>
    );
  }

  return (
    <form action={action} className="bg-white border border-outline-variant rounded-xl p-6 space-y-4">
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-2">
        {provider?.label ?? "New AI Provider"}
        {provider?.isActive && (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded">ACTIVE</span>
        )}
      </h3>

      {provider && <input type="hidden" name="id" value={provider.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Label</label>
          <input name="label" defaultValue={provider?.label ?? ""} required placeholder="e.g. OpenRouter" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Base URL</label>
          <input name="baseUrl" defaultValue={provider?.baseUrl ?? ""} required placeholder="https://openrouter.ai/api/v1" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">API Key {provider ? "(leave blank to keep)" : ""}</label>
          <input name="apiKey" type="password" placeholder={provider ? "unchanged" : "sk-..."} className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Default Model</label>
          <input name="defaultModelName" defaultValue={provider?.defaultModelName ?? ""} required placeholder="anthropic/claude-sonnet-4" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isActive" defaultChecked={provider?.isActive ?? false} className="rounded border-outline-variant text-primary focus:ring-primary" />
          <span className="font-label-sm text-label-sm text-on-surface-variant">Set as active provider</span>
        </label>
      </div>

      {state.error && <p className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">{state.error}</p>}
      {state.success && <p className="bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm">{state.success}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-[#002046] text-white font-label-md text-label-md py-2 px-5 rounded-lg hover:bg-[#003366] disabled:opacity-60">
          {pending ? "Saving…" : provider ? "Update" : "Create"}
        </button>
        {provider && (
          <button type="button" onClick={async () => { await deleteAiProviderAction(provider.id); }} className="text-red-600 font-label-md text-label-md py-2 px-4 hover:bg-red-50 rounded-lg">
            Delete
          </button>
        )}
        {!provider && (
          <button type="button" onClick={() => setShowForm(false)} className="text-on-surface-variant font-label-md text-label-md py-2 px-4 hover:bg-surface-container-low rounded-lg">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
