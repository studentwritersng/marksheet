"use client";

import { useEffect, useState } from "react";

interface PushState {
  native: boolean;
  plugin: boolean;
  permission: string;
  token: boolean;
  error?: string;
}

declare global {
  interface Window {
    __marksheetPushState?: PushState;
    __marksheetPushEnable?: () => void;
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/**
 * Temporary diagnostic chip — only visible inside the native Android shell.
 * Shows exactly where push setup breaks: plugin load, permission, token.
 * Remove once push is confirmed working.
 */
export function PushDebug() {
  const [s, setS] = useState<PushState | null>(null);

  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    const id = setInterval(() => setS(window.__marksheetPushState ?? null), 1000);
    return () => clearInterval(id);
  }, []);

  if (!s?.native) return null;

  const badge = (ok: boolean, label: string) => (
    <span className={ok ? "text-green-400" : "text-red-400"}>{label}</span>
  );

  return (
    <div className="fixed bottom-2 left-2 z-[100] bg-black/85 text-white text-[10px] font-mono p-2 rounded leading-tight max-w-[70vw]">
      <div>
        Native✓ Plugin {badge(s.plugin, s.plugin ? "✓" : "✗")} Perm {s.permission ?? "-"} Token{" "}
        {badge(s.token, s.token ? "✓" : "✗")}
      </div>
      {s.error && <div className="text-red-300 mt-0.5 break-all">{s.error}</div>}
      <button
        onClick={() => window.__marksheetPushEnable?.()}
        className="mt-1 underline text-blue-300"
      >
        Enable push
      </button>
    </div>
  );
}
