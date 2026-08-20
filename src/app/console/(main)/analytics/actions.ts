"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";

const CONFIG_ID = "platform-analytics";

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export async function saveAnalyticsConfigAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const ga4MeasurementId = formData.get("ga4MeasurementId")
      ? String(formData.get("ga4MeasurementId"))
      : null;
    const consentModeEnabled = formData.get("consentModeEnabled") === "on";
    const isActive = formData.get("isActive") === "on";

    const existing = await prisma.analyticsConfig.findUnique({ where: { id: CONFIG_ID } });
    if (existing) {
      await recordAudit({
        actorId: user.userId,
        action: "update",
        entityType: "analytics_config",
        entityId: CONFIG_ID,
        beforeValue: {
          ga4MeasurementId: existing.ga4MeasurementId,
          consentModeEnabled: existing.consentModeEnabled,
          isActive: existing.isActive,
        },
        afterValue: { ga4MeasurementId, consentModeEnabled, isActive },
      });
    }

    await prisma.analyticsConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, ga4MeasurementId, consentModeEnabled, isActive },
      update: { ga4MeasurementId, consentModeEnabled, isActive },
    });

    revalidatePath("/console/analytics");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const DEFAULT_EVENTS = [
  { eventName: "demo_request_submitted", ga4EventMapping: "generate_lead" },
  { eventName: "blog_read_75_percent", ga4EventMapping: "scroll" },
  { eventName: "verification_lookup_performed", ga4EventMapping: "search" },
];

export async function seedConversionEventsAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireOwner();
    for (const e of DEFAULT_EVENTS) {
      await prisma.conversionEventDefinition.upsert({
        where: { eventName: e.eventName },
        create: e,
        update: {},
      });
    }
    revalidatePath("/console/analytics");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertConversionEventAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const id = (formData.get("id") as string | null)?.trim() || null;
    const eventName = String(formData.get("eventName") ?? "").trim();
    const ga4EventMapping = String(formData.get("ga4EventMapping") ?? "").trim();
    const isActive = formData.get("isActive") === "on";
    if (!eventName) return { ok: false, error: "eventName required" };
    if (!ga4EventMapping) return { ok: false, error: "GA4 event mapping required" };

    if (id) {
      const existing = await prisma.conversionEventDefinition.findUnique({ where: { id } });
      if (existing) {
        await recordAudit({
          actorId: user.userId,
          action: "update",
          entityType: "conversion_event_definition",
          entityId: id,
          beforeValue: {
            eventName: existing.eventName,
            ga4EventMapping: existing.ga4EventMapping,
            isActive: existing.isActive,
          },
          afterValue: { eventName, ga4EventMapping, isActive },
        });
      }
      await prisma.conversionEventDefinition.update({
        where: { id },
        data: { eventName, ga4EventMapping, isActive },
      });
    } else {
      const created = await prisma.conversionEventDefinition.create({
        data: { eventName, ga4EventMapping, isActive },
      });
      await recordAudit({
        actorId: user.userId,
        action: "create",
        entityType: "conversion_event_definition",
        entityId: created.id,
        afterValue: { eventName, ga4EventMapping, isActive },
      });
    }

    revalidatePath("/console/analytics");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteConversionEventAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOwner();
    const id = String(formData.get("id"));
    const existing = await prisma.conversionEventDefinition.findUnique({ where: { id } });
    await prisma.conversionEventDefinition.delete({ where: { id } });
    if (existing) {
      await recordAudit({
        actorId: user.userId,
        action: "delete",
        entityType: "conversion_event_definition",
        entityId: id,
        beforeValue: { eventName: existing.eventName },
      });
    }
    revalidatePath("/console/analytics");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
