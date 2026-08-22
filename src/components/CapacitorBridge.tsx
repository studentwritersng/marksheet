"use client";

import { useEffect } from "react";
import { isNativeWithPushPlugin } from "@/lib/push/native-detect";

interface CapPlugins {
  PushNotifications?: {
    register(): Promise<void>;
    requestPermissions(): Promise<{ display: string }>;
    addListener(event: string, cb: (payload: unknown) => void): void;
  };
  LocalNotifications?: {
    schedule(options: {
      notifications: { id: number; title: string; body: string }[];
    }): Promise<unknown>;
  };
}

interface RegistrationEvent { value: string }
interface ActionPerformed { notification?: { data?: { url?: unknown } } }
interface ForegroundMessage { title?: string; body?: string }

/**
 * Native-shell glue (loaded on every page, inert in browsers).
 * - Waits for an authenticated session (probed via the unread-count endpoint)
 *   before asking Android for notification permission.
 * - Registers the FCM token with /api/push/register; retries every 60 s until
 *   success, which also self-heals devices after a logout elsewhere.
 * - Shows foreground messages as local notifications (Android suppresses FCM
 *   display while the app is open) and routes taps to data.url (queued
 *   cold-start taps included: the plugin replays them once listeners attach).
 */
export function CapacitorBridge() {
  useEffect(() => {
    const capGlobal = (window as unknown as { Capacitor?: Parameters<typeof isNativeWithPushPlugin>[0] }).Capacitor;
    if (!isNativeWithPushPlugin(capGlobal)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let registered = false;
    // Latest server-POST result for the registration token. Null until the
    // native "registration" event fires for the current attempt.
    let registerResult: Promise<boolean> | null = null;

    const plugins = (window as unknown as { Capacitor?: { Plugins?: CapPlugins } }).Capacitor?.Plugins;
    const pn = plugins?.PushNotifications;
    if (!pn) return;

    // Listeners attach ONCE. They must not be re-attached on every retry —
    // otherwise each loop would stack duplicate token POSTs / local notices.
    pn.addListener("registration", (payload) => {
      const token = (payload as RegistrationEvent)?.value;
      if (!token) return;
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

    pn.addListener("pushNotificationReceived", (payload) => {
      const message = payload as ForegroundMessage;
      const local = plugins?.LocalNotifications;
      if (!local) return;
      void local.schedule({
        notifications: [{
          id: Date.now() % 2147483647,
          title: message.title ?? "New notification",
          body: message.body ?? "",
        }],
      });
    });

    pn.addListener("pushNotificationActionPerformed", (payload) => {
      const url = (payload as ActionPerformed)?.notification?.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        window.location.assign(url);
      }
    });

    const attempt = async () => {
      if (registered || cancelled) return true;
      const probe = await fetch("/api/notifications/unread", { cache: "no-store" });
      if (cancelled) return true;
      if (probe.status !== 200) return false; // not logged in yet — retry later

      const perm = await pn.requestPermissions();
      if (perm.display !== "granted") return true; // denied — stop retrying

      registerResult = null;
      try {
        await pn.register();
      } catch {
        return false;
      }
      // Gate the retry loop on the SERVER response, not just native register()
      // success: the registration listener POSTs to /api/push/register and
      // resolves registerResult with res.ok. If it never fired (no token),
      // retry later.
      const ok = registerResult ? await registerResult : false;
      return ok;
    };

    const loop = async () => {
      const done = await attempt();
      if (!done && !cancelled) timer = setTimeout(loop, 60_000);
    };
    void loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
