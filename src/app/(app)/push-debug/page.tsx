"use client";

import { useEffect, useState } from "react";

export default function PushDebugPage() {
  const [state, setState] = useState<unknown>(null);
  const [diag, setDiag] = useState<unknown>(null);

  useEffect(() => {
    const readState = () => setState((window as unknown as { __marksheetPushState?: unknown }).__marksheetPushState ?? null);
    readState();
    const id = setInterval(readState, 1000);

    const loadDiag = () =>
      fetch("/api/push/diagnose", { cache: "no-store" })
        .then((r) => r.json())
        .then(setDiag)
        .catch(() => setDiag({ error: "fetch failed" }));
    loadDiag();
    const id2 = setInterval(loadDiag, 5000);

    return () => {
      clearInterval(id);
      clearInterval(id2);
    };
  }, []);

  const forceRegister = () =>
    (window as unknown as { __marksheetPushEnable?: () => void }).__marksheetPushEnable?.();

  return (
    <section className="flex flex-col gap-4 p-4 max-w-2xl">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Push Debug</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Open this on the problem device. The client state below is updated live from the
        app&apos;s push bridge. If <code>token</code> stays false, the device never obtained an
        FCM token (Google Play Services / firebase project issue). If <code>native</code> is
        false, the native bridge isn&apos;t detected.
      </p>

      <div>
        <h2 className="font-label-md text-label-md text-on-surface mb-1">Client push state</h2>
        <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="font-label-md text-label-md text-on-surface mb-1">/api/push/diagnose (server)</h2>
        <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(diag, null, 2)}
        </pre>
      </div>

      <button
        onClick={forceRegister}
        className="self-start px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
      >
        Force re-register
      </button>
    </section>
  );
}
