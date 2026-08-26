// Huawei Push Kit (HMS) provider — parallel to FCM for devices without GMS.
// Entirely env-guarded: without HUAWEI_APP_ID + HUAWEI_APP_SECRET it is a no-op.

const HUAWEI_AUTH_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/token";
const HUAWEI_PUSH_URL = "https://push-api.cloud.huawei.com/v1";

interface HuaweiConfig {
  appId: string;
  appSecret: string;
}

export function getHuaweiConfig(): HuaweiConfig | null {
  const appId = process.env.HUAWEI_APP_ID;
  const appSecret = process.env.HUAWEI_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

async function mintAccessToken(config: HuaweiConfig, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(HUAWEI_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.appId,
        client_secret: config.appSecret,
      }).toString(),
    });
    if (!res.ok) {
      console.error("[push:huawei] token request failed:", res.status);
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (error) {
    console.error("[push:huawei] token mint error:", error);
    return null;
  }
}

// Returns "ok" on success, "prune" if the device token is invalid (so the
// calling code can drop the PushDevice row), "error" otherwise.
export async function sendHuaweiPush(
  input: { hmsToken: string; title: string; body: string; eventType: string; url: string },
  fetchImpl: typeof fetch = fetch,
): Promise<"ok" | "prune" | "error"> {
  const config = getHuaweiConfig();
  if (!config) return "error";

  const accessToken = await mintAccessToken(config, fetchImpl);
  if (!accessToken) return "error";

  try {
    const res = await fetchImpl(`${HUAWEI_PUSH_URL}/${config.appId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceTokens: [input.hmsToken],
        message: {
          notification: { title: input.title, body: input.body },
          android: {
            notification: {
              channel_id: "marksheet_notifications",
              sound: "marksheet_notification",
            },
          },
          data: { eventType: input.eventType, url: input.url },
        },
      }),
    });

    if (res.ok) return "ok";

    const text = await res.text();
    // Huawei Push Kit invalid-device-token code.
    if (/80300007/.test(text)) return "prune";
    console.error("[push:huawei] send failed:", res.status, text);
    return "error";
  } catch (error) {
    console.error("[push:huawei] send error:", error);
    return "error";
  }
}
