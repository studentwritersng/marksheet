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

function getPushPlugin(): CapPlugins["PushNotifications"] | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: CapPlugins } }).Capacitor;
  return cap?.Plugins?.PushNotifications ?? null;
}

/**
 * Native-shell glue (loaded on every page, inert in browsers).
 *
 * - Polls for the native PushNotifications plugin (it can be injected after
 *   React mounts, so a single early check would otherwise bail forever).
 * - Requests notification permission eagerly once the plugin is present
 *   (Android 13+ shows the prompt; older Android grants implicitly).
 * - Registers the FCM token with /api/push/register and retries every 60s
 *   until the POST succeeds (covers "not logged in yet" and transient errors).
 * - Shows foreground messages as local notifications and routes taps to the
 *   deep link in the notification data.
 */
export function CapacitorBridge() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let registered = false;
    let registerResult: Promise<boolean> | null = null;

    const start = async () => {
      let pn = getPushPlugin();
      for (let i = 0; i < 40 && !pn && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 250));
        pn = getPushPlugin();
      }
      if (cancelled || !pn) return;

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
        const local = (
          window as unknown as { Capacitor?: { Plugins?: CapPlugins } }
        ).Capacitor?.Plugins?.LocalNotifications;
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

      const perm = await pn.requestPermissions();
      if (perm.display !== "granted") return; // user denied — stop retrying

      try {
        await pn.register();
      } catch {
        /* retried by the loop below */
      }

      const loop = async () => {
        if (registered || cancelled) return;
        const ok = registerResult ? await registerResult : false;
        if (!ok) {
          try {
            await pn.register();
          } catch {
            /* ignore */
          }
        }
        timer = setTimeout(loop, 60_000);
      };
      void loop();
    };

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
