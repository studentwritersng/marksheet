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

      const saveToken = (token?: string) => {
        if (!token) return;
        setState({ token: true });
        void (async () => {
          try {
            const res = await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fcmToken: token, platform: "android" }),
            });
            if (res.ok) { registered = true; setState({ error: undefined }); }
            else setState({ error: "registerPost:" + res.status });
          } catch (e) {
            setState({ error: "registerPost:" + (e as Error)?.message });
          }
        })();
      };

      // Attach listeners FIRST so we never miss the instant "registration" event.
      let tokenResolve: (t: string | null) => void = () => {};
      const tokenWait = new Promise<string | null>((resolve) => { tokenResolve = resolve; });

      void pn.addListener("registration", (payload: { value?: string }) => {
        const token = (payload as { value?: string })?.value;
        if (!token) return;
        saveToken(token);
        tokenResolve(token);
      });

      void pn.addListener("registrationError", (err: unknown) => {
        setState({ error: "registrationError:" + JSON.stringify(err) });
        tokenResolve(null);
      });

      void pn.addListener("pushNotificationReceived", (message: { title?: string; body?: string }) => {
        void showForegroundNotification(message?.title ?? "New notification", message?.body ?? "");
      });

      void pn.addListener("pushNotificationActionPerformed", (payload: unknown) => {
        const url = (payload as { notification?: { data?: { url?: unknown } } })?.notification?.data?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          window.location.assign(url);
        }
      });

      // Kick off registration; capture rejects explicitly (do not let it hang).
      void (async () => {
        try {
          await pn.register();
        } catch (e) {
          setState({ error: "register:" + (e as Error)?.message });
          tokenResolve(null);
        }
      })();

      // Race the "registration" event against a timeout.
      const timeout = new Promise<null>((r) => setTimeout(() => r(null), 15000));
      void Promise.race([tokenWait, timeout]).then((t) => {
        if (cancelled || registered) return;
        if (!t && !window.__marksheetPushState?.token && !window.__marksheetPushState?.error) {
          setState({ error: "no-token-15s (FCM register silent; check google-services package/Play services/network)" });
        }
      });

      // Request display permission in parallel (don't gate token on it).
      void (async () => {
        try {
          const perm = await pn.requestPermissions();
          setState({ permission: perm.display });
        } catch (e) {
          setState({ permission: "error", error: "perm:" + (e as Error)?.message });
        }
      })();
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
