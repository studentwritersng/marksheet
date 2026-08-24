"use client";

import { useEffect, useState } from "react";

interface PushState {
  native: boolean;
  plugin: boolean;
  permission: string;
  token: boolean;
  error?: string;
}

interface Detect {
  cap: boolean;
  capL: boolean;
  droid: boolean;
  pn: boolean;
  native: boolean;
  s: PushState | null;
}

/**
 * Temporary diagnostic chip — visible only inside the app WebView (Android
 * WebView UAs contain "; wv)", which every desktop browser lacks). Reports
 * whether the Capacitor bridge and push plugin are actually present, so we
 * can see exactly where push setup breaks on a real device. Remove once push
 * is confirmed working.
 */
export function PushDebug() {
  const [tick, setTick] = useState(0);
  const [d, setD] = useState<Detect>({ cap: false, capL: false, droid: false, pn: false, native: false, s: null });

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { PushNotifications?: unknown } };
      capacitor?: unknown;
      androidBridge?: unknown;
      __marksheetPushState?: PushState;
    };
    setD({
      cap: !!w.Capacitor,
      capL: !!w.capacitor,
      droid: !!w.androidBridge,
      pn: !!w.Capacitor?.Plugins?.PushNotifications,
      native: !!w.Capacitor?.isNativePlatform?.() || !!w.Capacitor?.Plugins,
      s: w.__marksheetPushState ?? null,
    });
  }, [tick]);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isWebView = /; *wv\)/i.test(ua) || d.cap || d.native;
  if (!isWebView) return null;

  const buildTag = /CapApk\w*/i.exec(ua)?.[0] ?? null;

  const badge = (ok: boolean, label: string) => (
    <span className={ok ? "text-green-400" : "text-red-400"}>{label}</span>
  );

  return (
    <div className="fixed bottom-2 left-2 z-[100] bg-black/85 text-white text-[10px] font-mono p-2 rounded leading-tight max-w-[78vw]">
      <div>
        cap{badge(d.cap, d.cap ? "✓" : "✗")} cap(basic){badge(d.capL, d.capL ? "✓" : "✗")} androidBridge
        {badge(d.droid, d.droid ? "✓" : "✗")} pn{badge(d.pn, d.pn ? "✓" : "✗")}
        perm:{d.s?.permission ?? "-"} token{badge(!!d.s?.token, d.s?.token ? "✓" : "✗")}
      </div>
      <div className="mt-0.5">
        ua-build{badge(!!buildTag, buildTag ?? "none")}
      </div>
      {!buildTag && (
        <div className="text-amber-300 mt-0.5">
          No build marker in UA → this is an OLD APK, not the latest build.
        </div>
      )}
      {!d.cap && (
        <div className="text-red-300 mt-0.5">
          window.Capacitor is undefined — the app isn't injecting the Capacitor bridge.
        </div>
      )}
      <div className="text-blue-200 mt-0.5 break-all opacity-80">ua: {ua}</div>
      {d.s?.error && <div className="text-red-300 mt-0.5 break-all">{d.s.error}</div>}
      <button
        onClick={() =>
          (window as unknown as { __marksheetPushEnable?: () => void }).__marksheetPushEnable?.()
        }
        className="mt-1 underline text-blue-300"
      >
        Enable push
      </button>
    </div>
  );
}
