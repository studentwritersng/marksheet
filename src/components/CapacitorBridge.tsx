"use client";

import { useEffect } from "react";

interface PushState {
  native: boolean;
  bridge: string;
  plugin: boolean;
  permission: string;
  token: boolean;
  error?: string;
}

type PushPlugin = import("@capacitor/push-notifications").PushNotificationsPlugin;

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: Record<string, unknown> & { PushNotifications?: unknown };
    };
    androidBridge?: unknown;
    __marksheetPushState?: PushState;
    __marksheetPushEnable?: () => void;
  }
}

function setState(patch: Partial<PushState>) {
  const prev =
    window.__marksheetPushState ?? {
      native: false,
      bridge: "-",
      plugin: false,
      permission: "-",
      token: false,
    };
  window.__marksheetPushState = { ...prev, ...patch };
  console.log("[push] state", window.__marksheetPushState);
}

function hasNativeEnv(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.Capacitor?.isNativePlatform?.() || window.androidBridge);
}

/**
 * The app's WebView loads a remote URL via Capacitor `server.url`. In that
 * mode the native wrapper injects its high-level bridge script (which creates
 * `window.Capacitor`) only into locally-served files — not into remote pages —
 * so `window.Capacitor` is missing here even though the low-level native
 * JavascriptInterface `window.androidBridge` IS present on every page.
 *
 * We therefore serve the stock Android `native-bridge.js` ourselves from
 * `public/` and inject it. It reads `window.androidBridge` and constructs the
 * full `window.Capacitor` global, restoring plugin access.
 */
function ensureCapacitorGlobal(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Capacitor) return Promise.resolve(true);
  if (!window.androidBridge) return Promise.resolve(false);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "/native-bridge.js";
    script.async = true;
    script.onload = () => {
      let tries = 0;
      const id = setInterval(() => {
        if (window.Capacitor || ++tries > 30) {
          clearInterval(id);
          resolve(!!window.Capacitor);
        }
      }, 100);
    };
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function loadPushPlugin(): Promise<PushPlugin | null> {
  try {
    // Dynamic import AFTER window.Capacitor exists so the plugin binds to bridge.
    const mod = await import("@capacitor/push-notifications");
    return mod.PushNotifications ?? null;
  } catch (e) {
    setState({ error: "pnImport:" + (e as Error)?.message });
    console.error("[push] plugin import failed", e);
    return null;
  }
}

async function showForegroundNotification(title: string, body: string) {
  try {
    const mod = await import("@capacitor/local-notifications");
    await mod.LocalNotifications.schedule({
      notifications: [{ id: Date.now() % 2147483647, title, body }],
    });
  } catch {
    /* local notifications unavailable — ignore */
  }
}

/**
 * Native-shell glue (loaded on every page, inert in browsers). A debug chip
 * (PushDebug) reads window.__marksheetPushState so we can see exactly where
 * push setup breaks on a real device.
 */
export function CapacitorBridge() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let registered = false;
    let registerResult: Promise<boolean> | null = null;

    const registerToken = async (pn: PushPlugin) => {
      try {
        await pn.register();
      } catch (e) {
        setState({ error: "register:" + (e as Error)?.message });
        console.error("[push] register failed", e);
      }
    };

    const start = async () => {
      const pn = await loadPushPlugin();
      if (cancelled) return;
      if (!pn) {
        setState({ plugin: false, error: "pn-unavailable" });
        console.error("[push] PushNotifications plugin unavailable");
        return;
      }
      setState({ plugin: true });

      pn.addListener("registration", (payload: { value?: string }) => {
        const token = payload?.value;
        if (!token) return;
        setState({ token: true });
        registerResult = (async () => {
          try {
            const res = await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fcmToken: token, platform: "android" }),
            });
            const ok = res.ok;
            if (ok) registered = true;
            return ok;
          } catch {
            return false;
          }
        })();
      });

      pn.addListener("registrationError", (err: unknown) => {
        setState({ error: "registrationError:" + JSON.stringify(err) });
        console.error("[push] registrationError", err);
      });

      pn.addListener("pushNotificationReceived", (message: { title?: string; body?: string }) => {
        void showForegroundNotification(message?.title ?? "New notification", message?.body ?? "");
      });

      pn.addListener("pushNotificationActionPerformed", (payload: unknown) => {
        const url = (payload as { notification?: { data?: { url?: unknown } } })?.notification?.data?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          window.location.assign(url);
        }
      });

      // Watchdog: if no token appears within 15s of registering, surface it so
      // we can distinguish "FCM register silent" from an outright failure.
      setTimeout(() => {
        if (!cancelled && !window.__marksheetPushState?.token && !window.__marksheetPushState?.error) {
          setState({ error: "no-token-after-15s (FCM register silent; check google-services.json package, Play services, network)" });
        }
      }, 15000);

      // Get the FCM token regardless of permission state.
      await registerToken(pn);

      // Ask for the display permission (Android 13+ prompt).
      try {
        const perm = await pn.requestPermissions();
        setState({ permission: perm.display });
        console.log("[push] permission", perm.display);
      } catch (e) {
        setState({ permission: "error", error: "perm:" + (e as Error)?.message });
        console.error("[push] requestPermissions failed", e);
      }

      const loop = async () => {
        if (registered || cancelled) return;
        const ok = registerResult ? await registerResult : false;
        if (!ok) await registerToken(pn);
        timer = setTimeout(loop, 60_000);
      };
      void loop();
    };

    void (async () => {
      // Native bridge (window.androidBridge) can be injected slightly after load.
      for (let i = 0; i < 60 && !cancelled && !hasNativeEnv(); i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelled) return;
      if (!hasNativeEnv()) {
        setState({ native: false });
        return;
      }
      setState({ native: true });

      const hasCap = await ensureCapacitorGlobal();
      if (cancelled) return;
      setState({ bridge: window.Capacitor ? "window.Capacitor" : "androidBridge-only" });
      if (!hasCap) {
        setState({ error: "window.Capacitor-not-created" });
        return;
      }
      await start();
    })();

    window.__marksheetPushEnable = async () => {
      const pn = await loadPushPlugin();
      if (!pn) return;
      try {
        const perm = await pn.requestPermissions();
        setState({ permission: perm.display });
      } catch (e) {
        setState({ permission: "error", error: "perm:" + (e as Error)?.message });
      }
      await registerToken(pn);
    };

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
