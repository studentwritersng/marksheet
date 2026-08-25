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

/** Minimal shape of the Capacitor global built by the injected native-bridge.js. */
interface NativeCapacitor {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown> & { PushNotifications?: unknown };
  nativePromise?: <T = unknown>(pluginName: string, methodName: string, options?: unknown) => Promise<T>;
  addListener?: (pluginName: string, eventName: string, cb: (payload: unknown) => void) => unknown;
}

declare global {
  interface Window {
    Capacitor?: NativeCapacitor;
    androidBridge?: unknown;
    __marksheetPushState?: PushState;
    __marksheetPushEnable?: () => void;
  }
}

const PN = "PushNotifications";
const LN = "LocalNotifications";

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
 * The app WebView loads a remote URL via Capacitor `server.url`. In that mode
 * the native wrapper injects its high-level bridge script (which creates
 * `window.Capacitor`) only into locally-served files, not remote pages — yet
 * the low-level native JavascriptInterface `window.androidBridge` IS present
 * on every page. We therefore load the stock Android `native-bridge.js`
 * ourselves (served from `public/`), which builds `window.Capacitor` from
 * `window.androidBridge` and gives us `nativePromise`/`addListener`.
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

/**
 * Native-shell glue (loaded on every page, inert in browsers).
 *
 * IMPORTANT: on a remote `server.url` page we can't use the plugin npm
 * package proxy (it requires "plugin headers" only injected into local
 * files). Instead we call the native bridge directly by plugin name via
 * `cap.nativePromise` / `cap.addListener`.
 */

/** Custom notification channel + sound — shared with the native MainActivity
 * channel and the FCM `android.notification` config (push.ts). */
const NOTIF_CHANNEL_ID = "marksheet_notifications";
const NOTIF_SOUND = "marksheet_notification";

async function createLnChannel(cap: NativeCapacitor) {
  if (!cap.nativePromise) return;
  try {
    await cap.nativePromise(LN, "createChannel", {
      id: NOTIF_CHANNEL_ID,
      name: "Notifications",
      description: "Marksheet notifications",
      importance: 5, // IMPORTANCE_HIGH
      sound: NOTIF_SOUND,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* channel creation unavailable — ignore */
  }
}

async function showForegroundNotification(cap: NativeCapacitor, title: string, body: string) {
  if (!cap.nativePromise) return;
  try {
    await cap.nativePromise(LN, "schedule", {
      notifications: [
        { id: Date.now() % 2147483647, title, body, channelId: NOTIF_CHANNEL_ID, sound: NOTIF_SOUND },
      ],
    });
  } catch {
    /* local notifications unavailable — ignore */
  }
}

export function CapacitorBridge() {
  useEffect(() => {
    let cancelled = false;
    let registered = false;

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
          if (res.ok) {
            registered = true;
            setState({ error: undefined });
          } else {
            setState({ error: "registerPost:" + res.status });
          }
        } catch (e) {
          setState({ error: "registerPost:" + (e as Error)?.message });
        }
      })();
    };

    const start = (cap: NativeCapacitor) => {
      const np = cap.nativePromise;
      const al = cap.addListener;
      if (!np || !al) {
        setState({ plugin: false, error: "bridge-methods-missing" });
        return;
      }
      setState({ plugin: true });
      void createLnChannel(cap);

      // Attach listeners before registering so we never miss the instant
      // "registration" event FCM may emit straight away.
      al(PN, "registration", (payload: unknown) => {
        saveToken((payload as { value?: string })?.value);
      });
      al(PN, "registrationError", (err: unknown) => {
        setState({ error: "registrationError:" + JSON.stringify(err) });
      });
      al(PN, "pushNotificationReceived", (message: unknown) => {
        const m = message as { title?: string; body?: string };
        void showForegroundNotification(cap, m?.title ?? "New notification", m?.body ?? "");
      });
      al(PN, "pushNotificationActionPerformed", (payload: unknown) => {
        const url = (payload as { notification?: { data?: { url?: unknown } } })?.notification?.data?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          window.location.assign(url);
        }
      });

      // Kick off FCM registration (do not let a reject go unobserved).
      void (async () => {
        try {
          await np(PN, "register", {});
        } catch (e) {
          setState({ error: "register:" + (e as Error)?.message });
        }
      })();

      // Watchdog: surface if no token arrives and no error was raised.
      setTimeout(() => {
        if (!cancelled && !window.__marksheetPushState?.token && !window.__marksheetPushState?.error) {
          setState({ error: "no-token-15s (FCM register silent; check google-services package/Play services/network)" });
        }
      }, 15000);

      // Request display permission in parallel so it never gates the token.
      void (async () => {
        try {
          const perm = await np<{ display: string }>(PN, "requestPermissions", {});
          setState({ permission: perm?.display ?? "?" });
        } catch (e) {
          setState({ permission: "error", error: "perm:" + (e as Error)?.message });
        }
      })();
    };

    void (async () => {
      // window.androidBridge may be injected slightly after page load — poll.
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
      if (!hasCap || !window.Capacitor) {
        setState({ error: "window.Capacitor-not-created" });
        return;
      }
      start(window.Capacitor);
    })();

    window.__marksheetPushEnable = async () => {
      const cap = window.Capacitor;
      if (!cap?.nativePromise) return;
      try {
        const perm = await cap.nativePromise<{ display: string }>(PN, "requestPermissions", {});
        setState({ permission: perm?.display ?? "?" });
      } catch (e) {
        setState({ permission: "error", error: "perm:" + (e as Error)?.message });
      }
      try {
        await cap.nativePromise(PN, "register", {});
      } catch (e) {
        setState({ error: "register:" + (e as Error)?.message });
      }
    };

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
