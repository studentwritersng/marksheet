"use client";

import { useEffect } from "react";

interface CapPlugins {
  PushNotifications?: {
    register(): Promise<void>;
    requestPermissions(): Promise<{ display: string }>;
    addListener(event: string, cb: (payload: unknown) => void): unknown;
  };
  LocalNotifications?: {
    schedule(options: {
      notifications: { id: number; title: string; body: string }[];
    }): Promise<unknown>;
  };
}

interface RegistrationEvent {
  value: string;
}
interface ActionPerformed {
  notification?: { data?: { url?: unknown } };
}
interface ForegroundMessage {
  title?: string;
  body?: string;
}

interface PushState {
  native: boolean;
  plugin: boolean;
  permission: string;
  token: boolean;
  error?: string;
}

declare global {
  interface Window {
    Capacitor?: { Plugins?: CapPlugins; isNativePlatform?: () => boolean };
    __marksheetPushState?: PushState;
    __marksheetPushEnable?: () => void;
  }
}

function getPushPlugin(): CapPlugins["PushNotifications"] | null {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.PushNotifications ?? null;
}

function setState(patch: Partial<PushState>) {
  const prev = window.__marksheetPushState ?? { native: false, plugin: false, permission: "-", token: false };
  window.__marksheetPushState = { ...prev, ...patch };
  console.log("[push] state", window.__marksheetPushState);
}

/**
 * Native-shell glue (loaded on every page, inert in browsers).
 *
 * Flow:
 *  - Polls for the native PushNotifications plugin (it can be injected after
 *    React mounts, so a single early check would otherwise bail forever).
 *  - Registers the FCM token first (does NOT require the notification
 *    permission — only DISPLAYING does), so the device is known to the server.
 *  - Then requests the POST_NOTIFICATIONS permission (Android 13+ prompt).
 *  - Shows foreground messages as local notifications + routes taps to deep link.
 *
 * A debug chip (PushDebug) reads window.__marksheetPushState so we can see
 * exactly where things break on a real device.
 */
export function CapacitorBridge() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let registered = false;
    let registerResult: Promise<boolean> | null = null;

    const registerToken = async (pn: NonNullable<ReturnType<typeof getPushPlugin>>) => {
      try {
        await pn.register();
      } catch (e) {
        setState({ error: "register:" + (e as Error)?.message });
        console.error("[push] register failed", e);
      }
    };

    const start = async () => {
      let pn = getPushPlugin();
      for (let i = 0; i < 40 && !pn && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 250));
        pn = getPushPlugin();
      }
      if (cancelled) return;
      if (!pn) {
        setState({ plugin: false, error: "plugin-not-found" });
        console.error("[push] PushNotifications plugin never appeared");
        return;
      }
      setState({ plugin: true });

      pn.addListener("registration", (payload) => {
        const token = (payload as RegistrationEvent)?.value;
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

      pn.addListener("registrationError", (err) => {
        setState({ error: "registrationError:" + JSON.stringify(err) });
        console.error("[push] registrationError", err);
      });

      pn.addListener("pushNotificationReceived", (payload) => {
        const message = payload as ForegroundMessage;
        const local = window.Capacitor?.Plugins?.LocalNotifications;
        if (!local) return;
        void local.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title: message.title ?? "New notification",
              body: message.body ?? "",
            },
          ],
        });
      });

      pn.addListener("pushNotificationActionPerformed", (payload) => {
        const url = (payload as ActionPerformed)?.notification?.data?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          window.location.assign(url);
        }
      });

      // Get the FCM token regardless of permission state.
      await registerToken(pn);

      // Now ask for the display permission (Android 13+ prompt).
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

    // Wait for the Capacitor bridge to be injected into the WebView. When the
    // app loads a remote server URL the bridge can appear AFTER React mounts,
    // so a single early isNativePlatform() check would bail forever.
    void (async () => {
      for (let i = 0; i < 80 && !cancelled; i++) {
        const w = window as {
          Capacitor?: { isNativePlatform?: () => boolean; Plugins?: CapPlugins };
        };
        if (w.Capacitor?.isNativePlatform?.() || w.Capacitor?.Plugins?.PushNotifications) {
          setState({ native: true });
          await start();
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) setState({ native: false });
    })();

    window.__marksheetPushEnable = async () => {
      const pn = getPushPlugin();
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
