# Android APK (Capacitor) + FCM Push Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable Android APK that wraps the existing hosted Next.js platform (same DB, same sessions) and delivers FCM push notifications whenever in-app notifications are created.

**Architecture:** Thin Capacitor shell loads the live site in a WebView (no UI rewrite, no data duplication). Server side gains a `PushDevice` table, two API routes, and a zero-dependency FCM HTTP-v1 sender wired into the single notification choke point (`createNotification`). Cloud builds produce a debug-signed APK artifact.

**Tech Stack:** Next.js 16 App Router · Prisma 6 · PostgreSQL · Vitest · Capacitor 7 · FCM HTTP v1 (raw fetch + `node:crypto`, **no** firebase-admin)

**Spec:** `docs/superpowers/specs/2026-08-22-android-apk-push-notifications-design.md`

## Global Constraints

- All work happens in the `marksheet/` repo (web additions) and a new sibling folder `mobile-app/` (APK shell).
- **Zero new server-side runtime dependencies.** FCM is called with global `fetch` + `node:crypto`. Only allowed new npm deps: `@capacitor/core`, `@capacitor/push-notifications` (web bundle, tiny) in `marksheet/`; Capacitor packages in `mobile-app/`.
- Session identity comes **only** from `getCurrentUser()` (`src/lib/auth/current-user.ts`) — never trust client-sent user ids.
- Follow existing patterns: `"use server"` action modules, `NextResponse.json` routes, rate-limit helpers from `@/lib/auth/route-security`, colocated `*.test.ts` under `src/` run by vitest (`npm test`).
- Notification recipientId semantics (existing behaviour, relied on throughout):
  - `recipientType: "parent" | "student"` → `recipientId` **is** `User.id`.
  - `recipientType: "staff"` → `recipientId` is usually `Staff.id`; resolve via `prisma.user.findFirst({ where: { staffId } })`.
- Package ID `com.marksheet.app` is permanent once shipped (spec: changing later = reinstall for everyone).
- Default app URL: `https://myportal.sch.ng` (from DEPLOY.md). Confirm/adjust in one place (`mobile-app/app.config.ts`) during Task 8.
- Every task ends with a green `npm test` run and a commit.

---

### Task 1: Prisma model `PushDevice` + env vars

**Files:**
- Modify: `prisma/schema.prisma` (add model after `Notification`, ~line 1450; add relation on `User` ~line 463)
- Modify: `.env.example`
- Test: none (schema task — verified by generate + db push)

**Interfaces:**
- Produces: `prisma.pushDevice` model used by Tasks 2–5. Fields: `id, userId, fcmToken (@unique), schoolId?, platform ("android"), createdAt, updatedAt`.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Insert immediately after the closing brace of `model Notification` (line 1450):

```prisma
model PushDevice {
  id        String   @id @default(cuid())
  userId    String
  fcmToken  String   @unique
  schoolId  String?
  platform  String   @default("android")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_devices")
}
```

Then add to `model User`'s scalar/relation list (after the `student Student?` relation line):

```prisma
  pushDevices      PushDevice[]
```

- [ ] **Step 2: Validate and push the schema**

```bash
npm run db:generate
```
Expected: `Generated Prisma Client` with no errors.

```bash
npm run db:push:local
```
Expected: `Your database is now in sync with your schema.` (Local PostgreSQL must be running — see `start_postgresql.bat`.)

If the online DB is reachable, also run `npm run db:push:online`; otherwise note it as a deploy step.

- [ ] **Step 3: Document the env vars in `.env.example`**

Append to the end of `.env.example`:

```
# Firebase Cloud Messaging (Android app push) — optional; push silently disabled when unset.
# FCM_PRIVATE_KEY is the service-account key with literal \n escapes, quoted, single line.
# FCM_PROJECT_ID=""
# FCM_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
# FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

Also append the same three lines (uncommented, empty values) to your local `.env` **only if** you want live-push testing before Task 8; otherwise leave them out — all push code no-ops without them.

- [ ] **Step 4: Run the existing test suite**

```bash
npm test
```
Expected: all pass (schema change breaks nothing).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat(push): add PushDevice table for FCM device tokens"
```

---

### Task 2: FCM sender library `src/lib/notifications/push.ts`

**Files:**
- Create: `src/lib/notifications/push.ts`
- Test: `src/lib/notifications/push.test.ts`

**Interfaces:**
- Consumes: `prisma` (`pushDevice`, `user`, `parentAccount` models).
- Produces (used by Tasks 3–5):
  - `isPushConfigured(): boolean`
  - `resolvePushUserIds(recipientType: string, recipientId: string): Promise<string[]>`
  - `deepLinkForEvent(eventType: string): string`
  - `deliverPushForNotification(input: DeliverPushInput, fetchImpl?: typeof fetch): Promise<void>` where `DeliverPushInput = { recipientType: "student"|"parent"|"staff"; recipientId: string; eventType: string; title?: string|null; content: string }`. Never throws.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/notifications/push.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import crypto from "crypto";

const mockUserFindFirst = vi.fn();
const mockUserFindUnique = vi.fn();
const mockParentAccountFindFirst = vi.fn();
const mockDevicesFindMany = vi.fn();
const mockDevicesDeleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    parentAccount: { findFirst: (...a: unknown[]) => mockParentAccountFindFirst(...a) },
    pushDevice: {
      findMany: (...a: unknown[]) => mockDevicesFindMany(...a),
      deleteMany: (...a: unknown[]) => mockDevicesDeleteMany(...a),
    },
  },
}));

let rsaKeyPair: crypto.KeyPairKeyObjectResult;

beforeAll(() => {
  rsaKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
});

// Exported PEM of the generated private key, set per-test
function setFcmEnv() {
  process.env.FCM_PROJECT_ID = "test-project";
  process.env.FCM_CLIENT_EMAIL = "firebase-adminsdk@test-project.iam.gserviceaccount.com";
  process.env.FCM_PRIVATE_KEY = rsaKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

const fetchMock = vi.fn();

beforeEach(() => {
  [mockUserFindFirst, mockUserFindUnique, mockParentAccountFindFirst, mockDevicesFindMany, mockDevicesDeleteMany, fetchMock].forEach((m) => m.mockReset());
  delete process.env.FCM_PROJECT_ID;
  delete process.env.FCM_CLIENT_EMAIL;
  delete process.env.FCM_PRIVATE_KEY;
});

/** Helper: first fetch call = OAuth2 token endpoint; subsequent = messages:send */
function stubAuthThenSends(sendResponder: (url: string, init?: RequestInit) => Response) {
  fetchMock.mockImplementationOnce(async () =>
    new Response(JSON.stringify({ access_token: "tok123", expires_in: 3600 }), { status: 200 })
  );
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => sendResponder(url, init));
}

describe("isPushConfigured", () => {
  it("returns false when env vars are missing", async () => {
    const { isPushConfigured } = await import("./push");
    expect(isPushConfigured()).toBe(false);
  });
  it("returns true when all three env vars are present", async () => {
    setFcmEnv();
    const { isPushConfigured } = await import("./push");
    expect(isPushConfigured()).toBe(true);
  });
});

describe("resolvePushUserIds", () => {
  it("passes parent and student recipientIds straight through (they are User ids)", async () => {
    const { resolvePushUserIds } = await import("./push");
    expect(await resolvePushUserIds("parent", "user-1")).toEqual(["user-1"]);
    expect(await resolvePushUserIds("student", "user-2")).toEqual(["user-2"]);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });
  it("resolves staff recipientId (Staff.id) through User.staffId", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-9" });
    const { resolvePushUserIds } = await import("./push");
    expect(await resolvePushUserIds("staff", "staff-5")).toEqual(["user-9"]);
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { staffId: "staff-5" } })
    );
  });
  it("returns [] when a staff recipientId matches no user", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    const { resolvePushUserIds } = await import("./push");
    expect(await resolvePushUserIds("staff", "ghost")).toEqual([]);
  });
});

describe("deliverPushForNotification", () => {
  function happyDb() {
    mockUserFindUnique.mockResolvedValue({ email: "p@x.com" });
    mockParentAccountFindFirst.mockResolvedValue(null);
    mockDevicesFindMany.mockResolvedValue([
      { id: "dev-1", fcmToken: "tokA" },
      { id: "dev-2", fcmToken: "tokB" },
    ]);
    mockDevicesDeleteMany.mockResolvedValue({ count: 0 });
  }

  it("sends an FCM message to every device of the recipient", async () => {
    setFcmEnv(); happyDb();
    stubAuthThenSends(() => new Response("{}", { status: 200 }));
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "parent", recipientId: "user-1", eventType: "result_published", title: "Results out", content: "Check the app." },
      fetchMock as unknown as typeof fetch,
    );
    const sendCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("messages:send"));
    expect(sendCalls.length).toBe(2);
    const body = JSON.parse(String(sendCalls[0][1].body));
    expect(body.message.token).toMatch(/tokA|tokB/);
    expect(body.message.notification.title).toBe("Results out");
    expect(body.message.notification.body).toBe("Check the app.");
    expect(body.message.data.eventType).toBe("result_published");
    expect(mockDevicesDeleteMany).not.toHaveBeenCalled();
  });

  it("does nothing when push is not configured", async () => {
    happyDb();
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "parent", recipientId: "u1", eventType: "e", title: null, content: "hi" },
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when the recipient has no registered devices", async () => {
    setFcmEnv();
    mockUserFindUnique.mockResolvedValue({ email: "p@x.com" });
    mockParentAccountFindFirst.mockResolvedValue(null);
    mockDevicesFindMany.mockResolvedValue([]);
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "staff", recipientId: "s1", eventType: "e", title: null, content: "hi" },
      fetchMock as unknown as typeof fetch,
    );
    // staff resolution returned no user -> no devices query even needed
    expect(mockDevicesFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { in: [] } } }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips muted parents (notificationPreferences.pushActive === false)", async () => {
    setFcmEnv();
    mockUserFindUnique.mockResolvedValue({ email: "p@x.com" });
    mockParentAccountFindFirst.mockResolvedValue({
      notificationPreferences: { smsActive: true, pushActive: false, enabledEvents: [] },
    });
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "parent", recipientId: "u1", eventType: "e", title: null, content: "hi" },
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDevicesFindMany).not.toHaveBeenCalled();
  });

  it("prunes devices whose token Google reports as UNREGISTERED", async () => {
    setFcmEnv(); happyDb();
    stubAuthThenSends((_url, init) => {
      const body = JSON.parse(String(init?.body));
      const status = body.message.token === "tokA" ? 404 : 200;
      return new Response(status === 404 ? JSON.stringify({ error: { status: "UNREGISTERED" } }) : "{}", { status });
    });
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "student", recipientId: "u2", eventType: "exam_graded", title: null, content: "Graded!" },
      fetchMock as unknown as typeof fetch,
    );
    expect(mockDevicesDeleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["dev-1"] } } }));
  });

  it("never throws — provider outage is logged, not propagated", async () => {
    setFcmEnv(); happyDb();
    fetchMock.mockRejectedValue(new Error("network down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deliverPushForNotification } = await import("./push");
    await expect(
      deliverPushForNotification(
        { recipientType: "parent", recipientId: "u1", eventType: "e", title: null, content: "x" },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});

describe("deepLinkForEvent", () => {
  it("falls back to home for unknown events", async () => {
    const { deepLinkForEvent } = await import("./push");
    expect(deepLinkForEvent("anything")).toBe("/");
  });
});
```

- [ ] **Step 2: Verify the tests fail**

```bash
npx vitest run src/lib/notifications/push.test.ts
```
Expected: FAIL — `Cannot find module './push'`.

- [ ] **Step 3: Implement `src/lib/notifications/push.ts`**

```ts
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

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

// ── OAuth2 access-token minting (RS256 JWT bearer), cached in-process ──────

let accessTokenCache: { token: string; expiresAtMs: number } | null = null;

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
  accessTokenCache = {
    token: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
  };
  return accessTokenCache.token;
}

async function getAccessToken(config: FcmConfig, fetchImpl: typeof fetch): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAtMs > Date.now()) return accessTokenCache.token;
  return mintAccessToken(config, fetchImpl);
}

// ── Per-device send ─────────────────────────────────────────────────────────

interface DeviceRow { id: string; fcmToken: string }
interface PushPayload { title?: string | null; body: string; url: string; eventType: string }

async function sendToDevice(
  config: FcmConfig,
  device: DeviceRow,
  payload: PushPayload,
  fetchImpl: typeof fetch,
): Promise<"ok" | "prune" | "error"> {
  try {
    const accessToken = await getAccessToken(config, fetchImpl);
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
            android: { priority: "HIGH" },
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
    const config = getFcmConfig();
    if (!config) return;

    const userIds = await resolvePushUserIds(input.recipientType, input.recipientId);
    if (userIds.length === 0) return;

    if (input.recipientType === "parent" && (await isParentPushMuted(userIds[0]))) return;

    const devices = await prisma.pushDevice.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, fcmToken: true },
    });
    if (devices.length === 0) return;

    const payload: PushPayload = {
      title: input.title,
      body: input.content,
      url: deepLinkForEvent(input.eventType),
      eventType: input.eventType,
    };

    const prunedIds: string[] = [];
    await Promise.all(
      devices.map(async (device) => {
        const outcome = await sendToDevice(config, device, payload, fetchImpl);
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
```

Note on the "no devices for ghost staff" test: `findMany` with `userId: { in: [] }` returns `[]` harmlessly — the assertion pins that contract.

- [ ] **Step 4: Verify the tests pass**

```bash
npx vitest run src/lib/notifications/push.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/push.ts src/lib/notifications/push.test.ts
git commit -m "feat(push): zero-dependency FCM HTTP v1 sender with token pruning"
```

---

### Task 3: Wire push fan-out into `createNotification`

**Files:**
- Modify: `src/lib/notifications/actions.ts:30-64` (the `CreateNotificationInput` interface + `createNotification`)
- Test: `src/lib/notifications/actions.test.ts`

**Interfaces:**
- Consumes: `deliverPushForNotification` (Task 2).
- Produces: behavioural contract — every `createNotification(...)` with channel `in_app` (the default) fans out push **after the response flushes** (via `after()` from `next/server`, same pattern as `src/app/layout.tsx:24`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/notifications/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const runImmediately = (fn: () => unknown) => void fn();

vi.mock("next/server", () => ({ after: (...args: unknown[]) => runImmediately(args[0] as () => unknown) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/auth/permissions", () => ({
  resolvePermissions: vi.fn(),
  canManageSchool: vi.fn(),
}));

const mockNotificationCreate = vi.fn().mockResolvedValue({});
const mockDeliverPush = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { create: (...a: unknown[]) => mockNotificationCreate(...a) } },
}));

vi.mock("@/lib/notifications/push", () => ({
  deliverPushForNotification: (...a: unknown[]) => mockDeliverPush(...a),
}));

import { createNotification } from "./actions";

beforeEach(() => {
  mockNotificationCreate.mockClear();
  mockDeliverPush.mockClear();
});

describe("createNotification push fan-out", () => {
  it("fans out to push for the default (in_app) channel", async () => {
    await createNotification({
      schoolId: "school-1",
      recipientType: "parent",
      recipientId: "user-1",
      eventType: "result_published",
      title: "Results published",
      content: "Term 1 results are ready.",
    });
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockDeliverPush).toHaveBeenCalledWith({
      recipientType: "parent",
      recipientId: "user-1",
      eventType: "result_published",
      title: "Results published",
      content: "Term 1 results are ready.",
    });
  });

  it("still writes the row even though push runs post-response", async () => {
    mockDeliverPush.mockImplementation(() => new Promise(() => {})); // never settles
    await expect(createNotification({
      recipientType: "staff", recipientId: "staff-1", eventType: "general_notice", content: "Hi",
    })).resolves.toBeUndefined();
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
  });

  it("does not fan out when an explicit non-in_app channel is requested", async () => {
    await createNotification({
      recipientType: "parent", recipientId: "user-1", eventType: "e", content: "x", channel: "sms",
    });
    expect(mockDeliverPush).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify the tests fail**

```bash
npx vitest run src/lib/notifications/actions.test.ts
```
Expected: FAIL — `deliverPushForNotification` not called.

- [ ] **Step 3: Apply the minimal edit to `src/lib/notifications/actions.ts`**

Add to the imports at the top:

```ts
import { after } from "next/server";
import { deliverPushForNotification } from "@/lib/notifications/push";
```

Replace the whole `createNotification` function (lines 41–64) with:

```ts
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const channel = input.channel ?? "in_app";

  await prisma.notification.create({
    data: {
      schoolId: input.schoolId ?? null,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel,
      eventType: input.eventType,
      title: input.title ?? null,
      content: input.content,
    },
  });

  if (channel === "in_app") {
    // Push rides along with every in-app notification. Runs after the
    // response flushes; failures inside are logged, never thrown.
    after(() =>
      deliverPushForNotification({
        recipientType: input.recipientType,
        recipientId: input.recipientId,
        eventType: input.eventType,
        title: input.title ?? null,
        content: input.content,
      }),
    );
  }

  if (channel === "email" && input.recipientEmail) {
    await sendEmail({
      to: input.recipientEmail,
      subject: input.title ?? input.eventType,
      text: input.content,
      schoolId: input.schoolId ?? undefined,
    });
  }
}
```

- [ ] **Step 4: Verify the tests pass, then run the full suite**

```bash
npx vitest run src/lib/notifications/actions.test.ts
```
Expected: PASS.

```bash
npm test
```
Expected: all pass (existing suites unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/actions.ts src/lib/notifications/actions.test.ts
git commit -m "feat(push): fan out FCM push on every in-app notification"
```

---

### Task 4: Register/unregister API routes

**Files:**
- Create: `src/app/api/push/register/route.ts`
- Create: `src/app/api/push/unregister/route.ts`
- Test: `src/app/api/push/routes.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser()` (session cookie), `checkRateLimit/clientKey/tooManyRequests` from `@/lib/auth/route-security`, `prisma.pushDevice`.
- Produces (consumed by the app bridge in Task 6):
  - `POST /api/push/register` — body `{ fcmToken: string, platform?: string }` → `{ ok: true }`; 401 unauthenticated; 400 invalid body.
  - `POST /api/push/unregister` — body `{ fcmToken: string }` → deletes only the caller's row.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/push/routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: (...a: unknown[]) => mockGetUser(...a) }));

vi.mock("@/lib/auth/route-security", () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  clientKey: vi.fn().mockReturnValue("test-client"),
  tooManyRequests: vi.fn(),
}));

const mockUpsert = vi.fn().mockResolvedValue({});
const mockDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushDevice: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      deleteMany: (...a: unknown[]) => mockDeleteMany(...a),
    },
  },
}));

import { POST as registerPOST } from "./register/route";
import { POST as unregisterPOST } from "./unregister/route";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue({
    userId: "user-1", role: "parent", schoolId: "school-1", staffId: null,
    email: "p@x.com", mustChangePassword: false,
  });
  mockUpsert.mockClear();
  mockDeleteMany.mockClear();
});

describe("POST /api/push/register", () => {
  it("401s without a session", async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await registerPOST(jsonRequest("http://x/api/push/register", { fcmToken: "t".repeat(16) }));
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s on a missing/too-short/oversized token", async () => {
    for (const bad of [{}, { fcmToken: "short" }, { fcmToken: "t".repeat(5000) }]) {
      const res = await registerPOST(jsonRequest("http://x/api/push/register", bad));
      expect(res.status).toBe(400);
    }
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts by token, stamping the SESSION user and school", async () => {
    const res = await registerPOST(jsonRequest("http://x/api/push/register", { fcmToken: "fcm-token-abc", platform: "android" }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { fcmToken: "fcm-token-abc" },
      update: { userId: "user-1", schoolId: "school-1", platform: "android" },
      create: { fcmToken: "fcm-token-abc", userId: "user-1", schoolId: "school-1", platform: "android" },
    }));
  });

  it("re-registration overwrites a previous owner of the same token", async () => {
    mockGetUser.mockResolvedValueOnce({
      userId: "user-2", role: "student", schoolId: "school-2", staffId: null,
      email: "s@x.com", mustChangePassword: false,
    });
    await registerPOST(jsonRequest("http://x/api/push/register", { fcmToken: "fcm-token-abc" }));
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { userId: "user-2", schoolId: "school-2", platform: "android" },
    }));
  });
});

describe("POST /api/push/unregister", () => {
  it("deletes only the caller's own row", async () => {
    const res = await unregisterPOST(jsonRequest("http://x/api/push/unregister", { fcmToken: "fcm-token-abc" }));
    expect(res.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { fcmToken: "fcm-token-abc", userId: "user-1" },
    });
  });

  it("401s without a session", async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await unregisterPOST(jsonRequest("http://x/api/push/unregister", { fcmToken: "fcm-token-abc" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

```bash
npx vitest run src/app/api/push/routes.test.ts
```
Expected: FAIL — route modules not found.

- [ ] **Step 3: Implement the routes**

`src/app/api/push/register/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/auth/route-security";

/**
 * Registers an FCM device token for the authenticated user.
 * Identity comes ONLY from the session cookie — the body carries the token
 * alone, so one user can never register a device against another account.
 * Upsert-by-token means logging a second user into the same phone
 * transparently moves the device to the new account.
 */

const MIN_TOKEN_LEN = 16;
const MAX_TOKEN_LEN = 4096;

export async function POST(req: Request) {
  if (!checkRateLimit(`pushreg:${clientKey(req)}`, 30, 60_000)) {
    return tooManyRequests();
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fcmToken?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fcmToken = typeof body.fcmToken === "string" ? body.fcmToken.trim() : "";
  const platform = typeof body.platform === "string" && body.platform ? body.platform.slice(0, 32) : "android";
  if (fcmToken.length < MIN_TOKEN_LEN || fcmToken.length > MAX_TOKEN_LEN) {
    return NextResponse.json({ error: "Invalid fcmToken" }, { status: 400 });
  }

  await prisma.pushDevice.upsert({
    where: { fcmToken },
    update: { userId: user.userId, schoolId: user.schoolId, platform },
    create: { fcmToken, userId: user.userId, schoolId: user.schoolId, platform },
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
```

`src/app/api/push/unregister/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/auth/route-security";

/**
 * Removes an FCM token for the authenticated user (called on logout).
 * Scoped to the caller's userId: nobody can unregister someone else's device.
 */
export async function POST(req: Request) {
  if (!checkRateLimit(`pushunreg:${clientKey(req)}`, 30, 60_000)) {
    return tooManyRequests();
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fcmToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fcmToken = typeof body.fcmToken === "string" ? body.fcmToken.trim() : "";
  if (!fcmToken) return NextResponse.json({ error: "Invalid fcmToken" }, { status: 400 });

  await prisma.pushDevice.deleteMany({ where: { fcmToken, userId: user.userId } });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: Verify the tests pass**

```bash
npx vitest run src/app/api/push/routes.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/push
git commit -m "feat(push): session-scoped FCM token register/unregister endpoints"
```

---

### Task 5: Logout clears the user's push devices

**Files:**
- Modify: `src/lib/auth/actions.ts:204-240` (three logout actions)

**Interfaces:**
- Consumes: `verifySessionToken` (already imported in the file), lazy `await import("@/lib/prisma")` (file's existing pattern).
- Behaviour: logging out deletes ALL of that user's device rows (simplest correct scope). Other devices self-heal within ≤60 s because the bridge (Task 6) retries registration while authenticated.

- [ ] **Step 1: Edit `logoutAction` (line 210)**

Inside `if (token) {`, immediately after `const payload = verifySessionToken(token);` (line 211), insert:

```ts
    if (payload) {
      try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.pushDevice.deleteMany({ where: { userId: payload.userId } });
      } catch {}
    }
```

- [ ] **Step 2: Edit `consoleLogoutAction` (lines 230-234)**

Replace with:

```ts
export async function consoleLogoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (payload) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.pushDevice.deleteMany({ where: { userId: payload.userId } });
    } catch {}
  }
  store.delete(SESSION_COOKIE);
  redirect("/console/login");
}
```

- [ ] **Step 3: Edit `proprietorLogoutAction` (lines 236-240)**

Same shape, redirect target unchanged:

```ts
export async function proprietorLogoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (payload) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.pushDevice.deleteMany({ where: { userId: payload.userId } });
    } catch {}
  }
  store.delete(SESSION_COOKIE);
  redirect("/proprietor/login");
}
```

- [ ] **Step 4: Verify compile + suite**

```bash
npx tsc --noEmit && npm test
```
Expected: no type errors; suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/actions.ts
git commit -m "feat(push): clear push device registrations on logout"
```

---

### Task 6: `CapacitorBridge` client component (web side of the bridge)

**Files:**
- Create: `src/components/CapacitorBridge.tsx`
- Modify: `src/components/PushBridge.tsx` — **no**: predicate lives in `src/lib/push/native-detect.ts` (testable)
- Create: `src/lib/push/native-detect.ts`
- Modify: `src/app/layout.tsx:45` (mount the bridge)
- Modify: `marksheet/package.json` (two Capacitor runtime deps)
- Test: `src/lib/push/native-detect.test.ts`

**Interfaces:**
- Consumes: `/api/notifications/unread` (auth probe: 200 vs 401), `/api/push/register` (Task 4).
- Produces: automatic token registration + tap deep-linking whenever the site runs inside the Capacitor WebView. No-ops in ordinary browsers.

- [ ] **Step 1: Add the deps**

```bash
npm install @capacitor/core@^7 @capacitor/push-notifications@^7 @capacitor/local-notifications@^7
```
Expected: installs cleanly (all three are browser-safe no-ops outside native; local-notifications is needed because Android does not auto-display FCM messages while the app is foregrounded).

- [ ] **Step 2: Write the failing predicate test**

Create `src/lib/push/native-detect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isNativeWithPushPlugin } from "./native-detect";

describe("isNativeWithPushPlugin", () => {
  it("false in a plain browser (no window.Capacitor)", () => {
    expect(isNativeWithPushPlugin(undefined)).toBe(false);
  });

  it("false when Capacitor exists but reports web", () => {
    expect(isNativeWithPushPlugin({ isNativePlatform: () => false, Plugins: {} })).toBe(false);
  });

  it("false when native but push plugin is absent", () => {
    expect(isNativeWithPushPlugin({ isNativePlatform: () => true, Plugins: {} })).toBe(false);
  });

  it("true only when native AND the push plugin is injected", () => {
    expect(
      isNativeWithPushPlugin({ isNativePlatform: () => true, Plugins: { PushNotifications: {} } }),
    ).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/push/native-detect.test.ts` — expected FAIL (module missing).

- [ ] **Step 3: Implement the predicate**

Create `src/lib/push/native-detect.ts`:

```ts
export interface CapacitorGlobalShape {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
}

/** True only inside the Capacitor WebView with the push plugin injected. */
export function isNativeWithPushPlugin(cap: CapacitorGlobalShape | undefined | null): boolean {
  return Boolean(cap?.isNativePlatform?.() && cap.Plugins?.PushNotifications);
}
```

Run the test again — expected PASS.

- [ ] **Step 4: Implement the bridge component**

Create `src/components/CapacitorBridge.tsx`:

```tsx
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

    const attempt = async () => {
      if (registered || cancelled) return true;
      const plugins = (window as unknown as { Capacitor?: { Plugins?: CapPlugins } }).Capacitor?.Plugins;
      const pn = plugins?.PushNotifications;
      if (!pn) return true;

      try {
        const probe = await fetch("/api/notifications/unread", { cache: "no-store" });
        if (cancelled) return true;
        if (probe.status !== 200) return false; // not logged in yet — retry later

        const perm = await pn.requestPermissions();
        if (perm.display !== "granted") return true; // denied — stop retrying

        pn.addListener("registration", (payload) => {
          const token = (payload as RegistrationEvent)?.value;
          if (!token) return;
          void fetch("/api/push/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fcmToken: token, platform: "android" }),
          }).then((res) => {
            if (res.ok) registered = true;
          });
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

        await pn.register();
        return true;
      } catch {
        return false;
      }
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
```

- [ ] **Step 5: Mount it in the root layout**

In `src/app/layout.tsx`, add the import:

```tsx
import { CapacitorBridge } from "@/components/CapacitorBridge";
```

and render it inside `<body>` (line 45):

```tsx
<body className="min-h-full flex flex-col">
  {children}
  <CapacitorBridge />
</body>
```

- [ ] **Step 6: Type-check, test, lint**

```bash
npx tsc --noEmit && npx vitest run src/lib/push/native-detect.test.ts && npm run lint && npm test
```
Expected: clean.

- [ ] **Step 7: Browser regression sanity**

```bash
npm run dev
```
Open `http://localhost:3000` in Chrome DevTools console: confirm no new errors and no `/api/push/register` calls fire (predicate gates it off). Stop the server.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/components/CapacitorBridge.tsx src/lib/push src/app/layout.tsx
git commit -m "feat(push): Capacitor bridge registers FCM tokens and routes taps"
```

---

### Task 7: Parent-facing push toggle

**Files:**
- Modify: `src/app/(app)/parent/settings/client.tsx:14-18` (state shape) and `:62-80` (channel checkboxes)
- Modify: `src/app/(app)/parent/settings/actions.ts:11` (prefs type)

**Interfaces:**
- Produces: `pushActive: boolean` persisted inside `parentAccount.notificationPreferences` (default **true** when absent — enforced by the mute check in `push.ts`).

- [ ] **Step 1: Extend the action's prefs type**

In `actions.ts` line 11, change:

```ts
  prefs: { smsActive: boolean; whatsappActive: boolean; enabledEvents: string[] },
```
to

```ts
  prefs: { smsActive: boolean; whatsappActive: boolean; pushActive: boolean; enabledEvents: string[] },
```

(The JSON is stored wholesale, so the extra key persists automatically.)

- [ ] **Step 2: Update the client form**

In `client.tsx`, extend the initial state (lines 14-18):

```tsx
  const [prefs, setPrefs] = useState({
    smsActive: (initialPrefs.smsActive as boolean) ?? false,
    whatsappActive: (initialPrefs.whatsappActive as boolean) ?? false,
    pushActive: (initialPrefs.pushActive as boolean) ?? true,
    enabledEvents: (initialPrefs.enabledEvents as string[]) ?? [],
  });
```

and add the checkbox row directly under the WhatsApp label block (after line 79):

```tsx
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.pushActive}
              onChange={(e) => setPrefs((p) => ({ ...p, pushActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-body-md text-body-md">App notifications (push)</span>
          </label>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm test
```
Expected: clean. Manual: open `/parent/settings` in the browser, toggle, save, reload — checkbox state persists.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/parent/settings
git commit -m "feat(parent-settings): push notification opt-out toggle"
```

---

### Task 8: `mobile-app/` Capacitor scaffold

**Files (all inside a NEW sibling folder `../mobile-app/` relative to `marksheet/`):**
- Create: `mobile-app/package.json`
- Create: `mobile-app/app.config.ts`
- Create: `mobile-app/capacitor.config.ts`
- Create: `mobile-app/www/index.html`
- Create (generated): `mobile-app/android/` via `npx cap add android`
- Modify (generated): `mobile-app/android/build.gradle`, `mobile-app/android/app/build.gradle` (Google Services plugin)
- Create: `mobile-app/.gitignore`

**Interfaces:**
- Consumes: hosted site URL + package ID from `app.config.ts` (single branding source).
- Produces: a committable native Android project that CI (Task 9) builds.

- [ ] **Step 1: Scaffold the folder**

From `C:\Users\Teta\Downloads\teta-exam`:

```bash
mkdir mobile-app && cd mobile-app
```

Write `package.json`:

```json
{
  "name": "marksheet-mobile",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "sync": "cap sync android",
    "open:android": "cap open android",
    "apk:debug": "npm run sync && cd android && ./gradlew assembleDebug"
  },
  "dependencies": {
    "@capacitor/android": "^7.0.0",
    "@capacitor/core": "^7.0.0",
    "@capacitor/local-notifications": "^7.0.0",
    "@capacitor/push-notifications": "^7.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.0.0"
  }
}
```

Note on the spec's `src/push-listener.js`: not needed as a separate native file — Capacitor injects its bridge into every page the WebView loads, so all push handling lives web-side in `CapacitorBridge.tsx` (Task 6).

Write `app.config.ts` (**confirm the URL with the product owner before committing**):

```ts
export const APP_CONFIG = {
  /** Launcher label under the icon. */
  appName: "Marksheet",
  /** PERMANENT Android identity — changing this later means everyone reinstalls. */
  packageId: "com.marksheet.app",
  /** The hosted portal the WebView opens. */
  defaultUrl: "https://myportal.sch.ng",
  backgroundColor: "#ffffff",
} as const;
```

Write `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";
import { APP_CONFIG } from "./app.config";

const config: CapacitorConfig = {
  appId: APP_CONFIG.packageId,
  appName: APP_CONFIG.appName,
  webDir: "www",
  server: {
    url: APP_CONFIG.defaultUrl,
    cleartext: false,
  },
  android: {
    backgroundColor: APP_CONFIG.backgroundColor,
    allowMixedContent: false,
  },
};

export default config;
```

Write `www/index.html` (loader fallback; normally bypassed because `server.url` is set):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Marksheet</title>
  <style>
    html, body { margin: 0; height: 100%; background: #ffffff; }
    main { height: 100%; display: grid; place-items: center; font-family: sans-serif; color: #334155; }
  </style>
</head>
<body>
  <main>Loading Marksheet…</main>
</body>
</html>
```

Write `.gitignore`:

```
node_modules/
android/app/build/
android/build/
android/.gradle/
android/local.properties
android/app/src/main/assets/capacitor.config.json
```

- [ ] **Step 2: Generate the native project**

```bash
npm install && npx cap add android
```
Expected: `✔ add android` creates `android/` (appId/name picked up from `capacitor.config.ts`).

- [ ] **Step 3: Enable Google Services (required by the push plugin)**

In `android/build.gradle`, inside the top-level `buildscript { dependencies { ... } }` block, add:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

In `android/app/build.gradle`, directly under the existing `apply plugin: 'com.android.application'` line, add:

```gradle
apply plugin: 'com.google.gms.google-services'
```

- [ ] **Step 4: Place Firebase config**

Create the Firebase project and app now (full write-up lands in `mobile-app/README.md`, Task 9):
1. https://console.firebase.google.com → Create project (free Spark plan).
2. Project settings → Your apps → Add Android app → package id `com.marksheet.app` (must match `app.config.ts`).
3. Download `google-services.json` → save at `mobile-app/android/app/google-services.json`.
4. Project settings → Service accounts → Generate new private key → from that JSON, set on the **web server's** `.env`: `FCM_PROJECT_ID` (`project_id`), `FCM_CLIENT_EMAIL` (`client_email`), `FCM_PRIVATE_KEY` (`private_key`, keep `\n` escapes).

The file contains identifiers only (no private keys) and is committed — CI depends on it.

- [ ] **Step 5: First local smoke-build (optional but recommended)**

With Android Studio + JDK 17 installed:

```bash
cd android && ./gradlew assembleDebug
```
Windows note: use `gradlew.bat assembleDebug`.
Expected: `BUILD SUCCESSFUL`; APK at `android/app/build/outputs/apk/debug/app-debug.apk`.
If skipped here, CI (Task 9) performs this step.

- [ ] **Step 6: Commit**

```bash
cd ..
git init  # only if mobile-app sits outside any repo — prefer committing inside the teta-exam/marksheet repo or its own
git add .
git commit -m "feat(mobile): Capacitor Android shell for the hosted platform"
```
If `mobile-app/` was created as a sibling of `marksheet/`, either move it inside the same git repo as `marksheet/` (preferred: `marksheet/mobile-app/` keeps CI paths simple) or initialise it as its own repository. The CI workflow in Task 9 assumes the path `<repo-root>/mobile-app/`.

---

### Task 9: GitHub Actions cloud build + mobile README

**Files:**
- Create: `.github/workflows/build-apk.yml` (at the repo root that contains `mobile-app/`)
- Create: `mobile-app/README.md`

**Interfaces:**
- Consumes: `mobile-app/` from Task 8.
- Produces: downloadable `app-debug-apk` artifact on every manual run or `v*` tag.

- [ ] **Step 1: Write the workflow**

`.github/workflows/build-apk.yml`:

```yaml
name: Build Android APK

on:
  workflow_dispatch:
  push:
    tags: ["v*"]

jobs:
  build-apk:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile-app
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - name: Restore google-services.json from secret (optional override)
        env:
          GOOGLE_SERVICES_JSON: ${{ secrets.GOOGLE_SERVICES_JSON }}
        run: |
          if [ -n "$GOOGLE_SERVICES_JSON" ]; then
            echo "$GOOGLE_SERVICES_JSON" | base64 -d > android/app/google-services.json
          else
            test -f android/app/google-services.json && echo "Using committed google-services.json"
          fi

      - name: Install dependencies
        run: npm ci || npm install

      - name: Sync Capacitor assets into the native project
        run: npx cap sync android

      - name: Assemble debug APK
        run: cd android && chmod +x gradlew && ./gradlew assembleDebug

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: mobile-app/android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
```

- [ ] **Step 2: Write the README (branding + Firebase + release path)**

`mobile-app/README.md`:

```markdown
# Marksheet Mobile Shell

Thin Capacitor wrapper around the hosted Marksheet portal.
All features come from the website; this app adds push notifications
and an installable APK.

## Change branding (one place)

Edit `app.config.ts`: app name, package id, target URL.
After changing the package id you must regenerate: delete `android/`,
run `npx cap add android`, redo the two Google Services plugin edits
(see git history of this README's companion commit).

## Firebase setup (once)

1. https://console.firebase.google.com → Create project (free Spark plan).
2. Project settings → Your apps → Add Android app → package id
   `com.marksheet.app` (must match `app.config.ts`).
3. Download `google-services.json` → save to `android/app/google-services.json`.
4. Project settings → Service accounts → Generate new private key →
   download the JSON. From it, set these on the WEB SERVER's `.env`:
   - `FCM_PROJECT_ID` = `project_id`
   - `FCM_CLIENT_EMAIL` = `client_email`
   - `FCM_PRIVATE_KEY` = `private_key` (keep `\n` escapes, keep quotes)

## Build an APK

- Cloud (recommended): repo → Actions → "Build Android APK" → Run →
  download `app-debug-apk` artifact. Also fires on `v*` tags.
- Local (needs JDK 17 + Android SDK): `npm run apk:debug`.

Install: copy the APK to a phone, open it, allow "install unknown apps".

## Release signing (when going to Play Store)

Generate a keystore, base64 it into repo secrets
(`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`),
then switch the workflow's gradle task to `assembleRelease` with a
signing step — see Capacitor docs, "Deploying to Google Play".
```

- [ ] **Step 3: Trigger the first cloud build**

Commit, push the repo to GitHub, run Actions → "Build Android APK" → Run workflow.
Expected: green run; artifact `app-debug-apk` downloads and installs on a device.

- [ ] **Step 4: End-to-end manual verification (spec §8 checklist)**

On the device with the installed APK:
1. Open app → school login screen renders (site served over HTTPS).
2. Log in as parent → accept notification permission prompt.
3. Publish a result (as admin, from another browser) → parent receives a system push within seconds.
4. Tap the push → app lands on the mapped/deep-linked page (home for unmapped events).
5. Mute "App notifications (push)" in `/parent/settings`, trigger another event → no push arrives.
6. Log out → pushes stop; other-device users unaffected.
7. Desktop browser regression: log in normally, confirm no permission prompt and no errors.

- [ ] **Step 5: Final commit**

```bash
git add .github/workflows/build-apk.yml mobile-app/README.md
git commit -m "ci(mobile): cloud APK build workflow + shell documentation"
```

---

## Verification Summary (whole feature)

| Layer | Check |
|---|---|
| Unit | `npm test` — push.test.ts, actions.test.ts, routes.test.ts, native-detect.test.ts green |
| Types/Lint | `npx tsc --noEmit && npm run lint` clean |
| Schema | `npm run db:generate && npm run db:push:local` succeed |
| Web regression | Site behaves identically in desktop browsers (bridge no-op) |
| Device | Spec §8 manual checklist above |
