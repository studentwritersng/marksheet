import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendHuaweiPush } from "./huawei-push";

/**
 * FCM HTTP v1 push sender (zero-dependency).
 *
 * Credentials come from the server env (see .env.example):
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
 * When unset, every entry point below is a silent no-op — dev/test and
 * non-app usage are unaffected. Never throws outward: delivery failures
 * are logged and must not break the triggering request/action.
 */

interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function getFcmConfig(): FcmConfig | null {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export function isPushConfigured(): boolean {
  return getFcmConfig() !== null;
}

export interface DeliverPushInput {
  recipientType: "student" | "parent" | "staff";
  recipientId: string;
  eventType: string;
  title?: string | null;
  content: string;
}

/**
 * eventType → in-app path opened when the tapped notification surfaces.
 * Unknown events open home ("/"), where the unread bell already lives.
 */
const DEEP_LINKS: Record<string, string> = {};

export function deepLinkForEvent(eventType: string): string {
  return DEEP_LINKS[eventType] ?? "/";
}

/**
 * Map a Notification recipient to User.id(s).
 * parent/student recipientIds ARE user ids; staff recipientIds are usually Staff.id.
 */
export async function resolvePushUserIds(recipientType: string, recipientId: string): Promise<string[]> {
  if (recipientType === "parent" || recipientType === "student") return [recipientId];
  if (recipientType === "staff") {
    const user = await prisma.user.findFirst({ where: { staffId: recipientId }, select: { id: true } });
    return user ? [user.id] : [];
  }
  return [];
}

async function isParentPushMuted(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return false;
  const account = await prisma.parentAccount.findFirst({
    where: { email: user.email },
    select: { notificationPreferences: true },
  });
  const prefs = (account?.notificationPreferences ?? null) as { pushActive?: boolean } | null;
  return prefs?.pushActive === false;
}

// ── OAuth2 access-token minting (RS256 JWT bearer) ─────────────────────────

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

async function mintAccessToken(config: FcmConfig, fetchImpl: typeof fetch): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(config.privateKey))}`;

  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM_TOKEN_ERROR:${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("FCM_TOKEN_MISSING");
  return json.access_token;
}

// ── Per-device send ─────────────────────────────────────────────────────────

interface DeviceRow { id: string; fcmToken: string | null }
interface PushPayload { title?: string | null; body: string; url: string; eventType: string }

async function sendToDevice(
  config: FcmConfig,
  accessToken: string,
  device: DeviceRow,
  payload: PushPayload,
  fetchImpl: typeof fetch,
): Promise<"ok" | "prune" | "error"> {
  if (!device.fcmToken) return "error";
  try {
    const res = await fetchImpl(
      `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: device.fcmToken,
            notification: { title: payload.title ?? "New notification", body: payload.body },
            data: { eventType: payload.eventType, url: payload.url },
            android: {
              priority: "HIGH",
              notification: {
                // Custom channel + sound. The channel is created in MainActivity
                // with res/raw/marksheet_notification.mp3; FCM names it without
                // the file extension.
                channel_id: "marksheet_notifications",
                sound: "marksheet_notification",
              },
            },
          },
        }),
      },
    );
    if (res.ok) return "ok";
    const text = await res.text();
    // Dead/expired tokens are pruned so future sends skip them fast.
    if (/UNREGISTERED|INVALID_ARGUMENT/i.test(text)) return "prune";
    return "error";
  } catch {
    return "error";
  }
}

/**
 * Fan a notification out to every registered device of its recipient.
 * Fire-and-forget by contract: logs failures, never throws.
 */
export async function deliverPushForNotification(
  input: DeliverPushInput,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const fcmConfig = getFcmConfig();

    const userIds = await resolvePushUserIds(input.recipientType, input.recipientId);

    if (input.recipientType === "parent" && (await isParentPushMuted(userIds[0]))) return;

    const devices = await prisma.pushDevice.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, fcmToken: true, hmsToken: true },
    });
    if (devices.length === 0) return;

    const payload: PushPayload = {
      title: input.title,
      body: input.content,
      url: deepLinkForEvent(input.eventType),
      eventType: input.eventType,
    };

    // One FCM OAuth mint per fan-out (only needed for FCM devices).
    const accessToken = fcmConfig ? await mintAccessToken(fcmConfig, fetchImpl) : null;

    const prunedIds: string[] = [];
    await Promise.all(
      devices.map(async (device) => {
        let outcome: "ok" | "prune" | "error";
        if (device.hmsToken) {
          outcome = await sendHuaweiPush(
            {
              hmsToken: device.hmsToken,
              title: payload.title,
              body: payload.body,
              eventType: payload.eventType,
              url: payload.url,
            },
            fetchImpl,
          );
        } else if (device.fcmToken && fcmConfig && accessToken) {
          outcome = await sendToDevice(fcmConfig, accessToken, device, payload, fetchImpl);
        } else {
          return;
        }
        if (outcome === "prune") prunedIds.push(device.id);
      }),
    );

    if (prunedIds.length > 0) {
      await prisma.pushDevice.deleteMany({ where: { id: { in: prunedIds } } });
    }
  } catch (error) {
    console.error("[push] delivery failed:", error);
  }
}
