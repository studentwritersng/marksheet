"use client";

import { useActionState, useState } from "react";
import { upsertAiProviderAction, deleteAiProviderAction, testAiConnectionAction } from "./actions";

interface ProviderVM {
  id: string; label: string; baseUrl: string; hasKey: boolean;
  defaultModelName: string; isActive: boolean; createdAt: string;
}

export function AiConfigClient({ providers: initial }: { providers: ProviderVM[] }) {
  const [providers, setProviders] = useState(initial);
  const [editing, setEditing] = useState<ProviderVM | null>(null);
  const [createNew, setCreateNew] = useState(false);

  const [saveState, saveAction, savePending] = useActionState(upsertAiProviderAction, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI Provider Configuration</h1>
          <p className="text-sm text-white/40 mt-1">
            {providers.length} provider{providers.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <button onClick={() => { setCreateNew(true); setEditing(null); }}
          className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
        >Add Provider</button>
      </div>

      {/* Create / Edit form */}
      {(createNew || editing) && (
        <AiProviderForm
          provider={editing}
          saveAction={saveAction}
          savePending={savePending}
          saveState={saveState}
          onCancel={() => { setCreateNew(false); setEditing(null); }}
        />
      )}

      {/* Provider cards */}
      <div className="grid grid-cols-1 gap-3">
        {providers.map((p) => (
          <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-white font-semibold text-base">{p.label}</h2>
                  {p.isActive && (
                    <span className="rounded-full bg-emerald-900/50 text-emerald-300 text-[10px] px-2 py-0.5 font-medium">Active</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-white/40">
                  <span>Base URL: <span className="text-white/60 font-mono">{p.baseUrl}</span></span>
                  <span>Default Model: <span className="text-white/60">{p.defaultModelName}</span></span>
                  <span>API Key: <span className="text-white/30">{p.hasKey ? "••••••" : "Not set"}</span></span>
                  <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditing(p); setCreateNew(false); }}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors underline"
                >Edit</button>
                <DeleteButton providerId={p.id} providerLabel={p.label} onDeleted={() => setProviders((prev) => prev.filter((x) => x.id !== p.id))} />
              </div>
            </div>
          </div>
        ))}
        {providers.length === 0 && !createNew && (
          <p className="text-white/30 text-sm py-12 text-center">No AI providers configured yet.</p>
        )}
      </div>
    </div>
  );
}

function AiProviderForm({ provider, saveAction, savePending, saveState, onCancel }: {
  provider: ProviderVM | null;
  saveAction: (fd: FormData) => void;
  savePending: boolean;
  saveState: any;
  onCancel: () => void;
}) {
  const [testKey, setTestKey] = useState("");
  const [testUrl, setTestUrl] = useState(provider?.baseUrl ?? "");
  const [testModel, setTestModel] = useState(provider?.defaultModelName ?? "");
  const [testState, testAction, testPending] = useActionState(testAiConnectionAction, {});

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
        {provider ? `Edit: ${provider.label}` : "New AI Provider"}
      </h3>

      <form action={saveAction} className="space-y-4">
        {provider && <input type="hidden" name="id" value={provider.id} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 block mb-1">Label</label>
            <input name="label" required defaultValue={provider?.label ?? ""} placeholder="e.g. OpenRouter Production"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Base URL</label>
            <input name="baseUrl" required defaultValue={provider?.baseUrl ?? ""} placeholder="https://openrouter.ai/api/v1"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder:text-white/20 font-mono" />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">
              API Key {provider?.hasKey ? "(leave blank to keep existing)" : ""}
            </label>
            <input name="apiKey" type="password" required={!provider} placeholder={provider ? "sk-..." : "Enter API key"}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Default Model</label>
            <input name="defaultModelName" required defaultValue={provider?.defaultModelName ?? ""} placeholder="e.g. anthropic/claude-3.5-sonnet"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder:text-white/20 font-mono" />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isActive" defaultChecked={provider?.isActive ?? false} 
            className="rounded border-white/10 bg-white/5 text-emerald-600" />
          <span className="text-sm text-white/70">Set as active provider</span>
        </label>

        {saveState.error && <p className="text-red-400 text-sm">{saveState.error}</p>}
        {saveState.success && <p className="text-emerald-400 text-sm">{saveState.success}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={savePending}
            className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60"
          >{savePending ? "Saving..." : "Save Provider"}</button>
          <button type="button" onClick={onCancel}
            className="text-white/40 hover:text-white/70 text-sm px-4 py-2 rounded-lg border border-white/10"
          >Cancel</button>
        </div>
      </form>

      {/* Test connection */}
      <div className="border-t border-white/5 pt-4 mt-4">
        <h4 className="text-xs text-white/50 uppercase tracking-wider mb-3">Test Connection</h4>
        <form action={testAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
          <input type="hidden" name="baseUrl" value={testUrl} />
          <input type="hidden" name="apiKey" value={testKey} />
          <input type="hidden" name="model" value={testModel} />
          <div>
            <label className="text-[10px] text-white/40 block mb-0.5">Base URL</label>
            <input value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder={provider?.baseUrl ?? "https://..."}
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-0.5">API Key</label>
            <input type="password" value={testKey} onChange={(e) => setTestKey(e.target.value)} placeholder="sk-..."
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-0.5">Model</label>
            <input value={testModel} onChange={(e) => setTestModel(e.target.value)} placeholder={provider?.defaultModelName ?? "model-name"}
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white font-mono" />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={testPending}
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
            >{testPending ? "Testing..." : "Test Connection"}</button>
          </div>
        </form>
        {testState.error && <p className="text-red-400 text-xs mt-1">{testState.error}</p>}
        {testState.success && <p className="text-emerald-400 text-xs mt-1">{testState.success}</p>}
      </div>
    </div>
  );
}

function DeleteButton({ providerId, providerLabel, onDeleted }: {
  providerId: string; providerLabel: string; onDeleted: () => void;
}) {
  const [state, action, pending] = useActionState(async () => {
    const r = await deleteAiProviderAction(providerId);
    if (!r.error) onDeleted();
    return r;
  }, {});

  return (
    <form action={action}>
      <button type="submit" disabled={pending}
        onClick={(e) => { if (!confirm(`Delete "${providerLabel}"?`)) e.preventDefault(); }}
        className="text-xs text-red-400 hover:text-red-300 transition-colors underline"
      >{pending ? "..." : "Delete"}</button>
    </form>
  );
}
