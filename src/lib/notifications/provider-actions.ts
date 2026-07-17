"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { isAddonActive } from "@/lib/addons/check";
import type { Prisma } from "@prisma/client";
import type {
  ProviderConfigVM, TemplateVM, SchoolNotifConfigVM, LogEntryVM, QueueItemVM,
} from "./types";

const NOTIFY_ADDON = "Notifications (WhatsApp & SMS)";

interface ActionState { error?: string; success?: string }

async function guardAddon(schoolId: string) {
  try { await guardActiveLicense(schoolId); } catch (e: unknown) { throw new Error(e instanceof Error ? e.message : "License error"); }
  if (!(await isAddonActive(schoolId, NOTIFY_ADDON))) throw new Error("Notifications addon not active.");
}

// ── Provider Config ───────────────────────────────────────────────────────

export async function getProviderConfigs(): Promise<ProviderConfigVM[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "platform_owner")) return [];
  const configs = await prisma.notificationProviderConfig.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, channel: true, provider: true, label: true, isActive: true, sortOrder: true },
  });
  return configs;
}

export async function saveProviderConfigAction(
  data: { id?: string; channel: string; provider: string; label?: string; credentials: string; isActive?: boolean; sortOrder?: number },
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "super_admin" && user.role !== "platform_owner")) return { error: "Not authorised." };

    let parsedCredentials: Prisma.InputJsonValue;
    try { parsedCredentials = JSON.parse(data.credentials); } catch { return { error: "Invalid JSON in credentials." }; }

    if (data.id) {
      await prisma.notificationProviderConfig.update({
        where: { id: data.id },
        data: { channel: data.channel, provider: data.provider, label: data.label ?? null, credentials: parsedCredentials, isActive: data.isActive ?? true, sortOrder: data.sortOrder ?? 0 },
      });
    } else {
      await prisma.notificationProviderConfig.create({
        data: { channel: data.channel, provider: data.provider, label: data.label ?? null, credentials: parsedCredentials, isActive: data.isActive ?? true, sortOrder: data.sortOrder ?? 0 },
      });
    }

    await recordAudit({ actorId: user.userId, action: "save_provider_config", entityType: "notification_provider" });
    revalidatePath("/notifications");
    return { success: "Provider config saved." };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

export async function deleteProviderConfigAction(id: string): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "super_admin" && user.role !== "platform_owner")) return { error: "Not authorised." };
    await prisma.notificationProviderConfig.delete({ where: { id } });
    await recordAudit({ actorId: user.userId, action: "delete_provider_config", entityType: "notification_provider" });
    revalidatePath("/notifications");
    return { success: "Provider config deleted." };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<TemplateVM[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const templates = await prisma.notificationTemplate.findMany({
    orderBy: [{ eventType: "asc" }, { channel: "asc" }],
    select: { id: true, eventType: true, channel: true, label: true, body: true, isActive: true },
  });
  return templates;
}

export async function saveTemplateAction(
  data: { id?: string; eventType: string; channel: string; label?: string; body: string; isActive?: boolean },
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "super_admin" && user.role !== "platform_owner")) return { error: "Not authorised." };

    if (data.id) {
      await prisma.notificationTemplate.update({
        where: { id: data.id },
        data: { eventType: data.eventType, channel: data.channel, label: data.label ?? null, body: data.body, isActive: data.isActive ?? true },
      });
    } else {
      await prisma.notificationTemplate.create({
        data: { eventType: data.eventType, channel: data.channel, label: data.label ?? null, body: data.body, isActive: data.isActive ?? true },
      });
    }

    revalidatePath("/notifications");
    return { success: "Template saved." };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

export async function deleteTemplateAction(id: string): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "super_admin" && user.role !== "platform_owner")) return { error: "Not authorised." };
    await prisma.notificationTemplate.delete({ where: { id } });
    revalidatePath("/notifications");
    return { success: "Template deleted." };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

// ── School Notification Config ────────────────────────────────────────────

export async function getSchoolNotificationConfig(schoolId: string): Promise<SchoolNotifConfigVM | null> {
  const config = await prisma.schoolNotificationConfig.findUnique({
    where: { schoolId },
    select: { smsActive: true, whatsappActive: true, enabledEvents: true },
  });
  if (!config) return null;
  return { smsActive: config.smsActive, whatsappActive: config.whatsappActive, enabledEvents: config.enabledEvents as string[] };
}

export async function updateSchoolNotificationConfigAction(
  schoolId: string, data: { smsActive?: boolean; whatsappActive?: boolean; enabledEvents?: string[] },
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.schoolId) return { error: "Not authorised." };
    if (user.schoolId !== schoolId && user.role !== "super_admin" && user.role !== "platform_owner") return { error: "Not authorised." };
    const perms = await resolvePermissions(user);
    if (!perms.isSuperAdmin && !perms.isSchoolAdmin) return { error: "Not authorised." };
    await guardAddon(schoolId);

    await prisma.schoolNotificationConfig.upsert({
      where: { schoolId },
      update: { smsActive: data.smsActive, whatsappActive: data.whatsappActive, enabledEvents: data.enabledEvents as Prisma.InputJsonValue },
      create: { schoolId, smsActive: data.smsActive ?? false, whatsappActive: data.whatsappActive ?? false, enabledEvents: data.enabledEvents ?? [] },
    });

    await recordAudit({ schoolId, actorId: user.userId, action: "update_notification_config", entityType: "school_notification_config" });
    revalidatePath("/notifications");
    return { success: "Notification settings saved." };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

// ── Queue & Sending ───────────────────────────────────────────────────────

export async function sendTestNotificationAction(
  schoolId: string, channel: string, recipient: string, message: string,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.staffId) return { error: "Not authorised." };
    const perms = await resolvePermissions(user);
    if (!perms.isSchoolAdmin && !perms.isSuperAdmin) return { error: "Not authorised." };
    await guardAddon(schoolId);

    const queue = await prisma.notificationQueue.create({
      data: { schoolId, channel, eventType: "general_notice", recipient, message, status: "pending", scheduledAt: new Date() },
    });

    // Attempt inline send
    const result = await attemptSend(queue.id, channel, recipient, message);

    await recordAudit({ schoolId, actorId: user.userId, action: "send_test_notification", entityType: "notification" });
    revalidatePath("/notifications");
    return result;
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

async function attemptSend(
  queueId: string, channel: string, recipient: string, message: string,
): Promise<ActionState> {
  try {
    // Find active provider for this channel
    const provider = await prisma.notificationProviderConfig.findFirst({
      where: { channel, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    let status: string;
    let providerName: string | null = null;
    let errorMsg: string | null = null;

    if (!provider) {
      // Simulated send when no provider configured
      status = "sent";
      providerName = "simulated";
      console.log(`[SIMULATED] ${channel} to ${recipient}: ${message}`);
    } else {
      providerName = provider.provider;
      try {
        await sendViaProvider(provider, recipient, message);
        status = "sent";
      } catch (sendError: unknown) {
        status = "failed";
        errorMsg = sendError instanceof Error ? sendError.message : "Send failed";
      }
    }

    await prisma.notificationQueue.update({
      where: { id: queueId },
      data: { status, sentAt: status === "sent" ? new Date() : null, error: errorMsg },
    });

    await prisma.notificationLog.create({
      data: { schoolId: "", channel, eventType: "general_notice", recipient, message, status, provider: providerName, error: errorMsg },
    });

    if (status === "failed") return { error: errorMsg ?? "Send failed" };
    return { success: `${channel} message sent to ${recipient}` };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

async function sendViaProvider(
  provider: { id: string; provider: string; credentials: Prisma.JsonValue },
  recipient: string, message: string,
): Promise<void> {
  const creds = provider.credentials as Record<string, string>;

  switch (provider.provider) {
    case "twilio": {
      const accountSid = creds.accountSid;
      const authToken = creds.authToken;
      const from = creds.from;
      if (!accountSid || !authToken || !from) throw new Error("Twilio credentials incomplete");
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: recipient, From: from, Body: message }),
      });
      if (!resp.ok) { const err = await resp.text(); throw new Error(`Twilio error: ${err}`); }
      break;
    }
    case "africastalking": {
      const apiKey = creds.apiKey;
      const username = creds.username;
      const from = creds.from;
      if (!apiKey || !username) throw new Error("Africa's Talking credentials incomplete");
      const resp = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: { "ApiKey": apiKey, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: new URLSearchParams({ username, to: recipient, message, from: from ?? "" }),
      });
      if (!resp.ok) { const err = await resp.text(); throw new Error(`Africa's Talking error: ${err}`); }
      break;
    }
    case "whatsapp_business": {
      const accessToken = creds.accessToken;
      const phoneNumberId = creds.phoneNumberId;
      if (!accessToken || !phoneNumberId) throw new Error("WhatsApp credentials incomplete");
      const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: recipient.replace("+", ""), type: "text",
          text: { body: message },
        }),
      });
      if (!resp.ok) { const err = await resp.text(); throw new Error(`WhatsApp error: ${err}`); }
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider.provider}`);
  }
}

// ── Queue Processing (Cron / API) ─────────────────────────────────────────

export async function processNotificationQueueAction(limit = 50): Promise<{ processed: number; failed: number }> {
  const pending = await prisma.notificationQueue.findMany({
    where: { status: "pending", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await attemptSend(item.id, item.channel, item.recipient, item.message);
    if (result.success) processed++;
    else failed++;
  }

  return { processed, failed };
}

// ── Logs ──────────────────────────────────────────────────────────────────

export async function getNotificationLogs(schoolId?: string, limit = 100): Promise<LogEntryVM[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const where: Prisma.NotificationLogWhereInput = {};
  if (schoolId) where.schoolId = schoolId;
  if (user.role !== "super_admin" && user.role !== "platform_owner") {
    where.schoolId = user.schoolId ?? undefined;
  }

  const logs = await prisma.notificationLog.findMany({
    where,
    orderBy: { sentAt: "desc" },
    take: limit,
    select: { id: true, channel: true, eventType: true, recipient: true, message: true, status: true, provider: true, error: true, sentAt: true },
  });
  return logs;
}

// ── Queue View ────────────────────────────────────────────────────────────

export async function getQueueItems(schoolId?: string, limit = 50): Promise<QueueItemVM[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const where: Prisma.NotificationQueueWhereInput = {};
  if (schoolId) where.schoolId = schoolId;
  if (user.role !== "super_admin" && user.role !== "platform_owner") {
    where.schoolId = user.schoolId ?? undefined;
  }

  const items = await prisma.notificationQueue.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, channel: true, eventType: true, recipient: true, message: true, status: true, scheduledAt: true, error: true },
  });
  return items.map((i) => ({ ...i, scheduledAt: i.scheduledAt }));
}

// ── Template Variable Substitution ────────────────────────────────────────

export async function fillTemplate(body: string, vars: Record<string, string>): Promise<string> {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Helper: Queue notification for an event ───────────────────────────────

export async function queueEventNotification(
  schoolId: string, eventType: string, recipient: string, channel: string, message: string,
): Promise<void> {
  // Random delay 5–50 seconds to avoid spam flags
  const delayMs = Math.floor(Math.random() * 45000) + 5000;
  const scheduledAt = new Date(Date.now() + delayMs);

  await prisma.notificationQueue.create({
    data: { schoolId, eventType, channel, recipient, message, status: "pending", scheduledAt },
  });
}
