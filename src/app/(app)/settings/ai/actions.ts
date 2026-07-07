"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";

export interface AiProviderState { error?: string; success?: string }

export async function upsertAiProviderAction(
  _prev: AiProviderState,
  formData: FormData,
): Promise<AiProviderState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") return { error: "Not authorised." };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const label = String(formData.get("label") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const defaultModelName = String(formData.get("defaultModelName") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!label || !baseUrl || !defaultModelName) {
    return { error: "Label, base URL, and default model are required." };
  }

  const upsertData: Record<string, unknown> = { label, baseUrl, defaultModelName, isActive };
  if (apiKey) upsertData.apiKeyEncrypted = apiKey;

  // If setting active, deactivate all others first
  if (isActive) {
    await prisma.aiProviderConfig.updateMany({ data: { isActive: false } });
  }

  if (id) {
    await prisma.aiProviderConfig.update({ where: { id }, data: upsertData as never });
  } else {
    const existing = await prisma.aiProviderConfig.count();
    if (existing >= 1 && !apiKey) {
      // Editing existing, no API key provided means keep existing
      const { apiKeyEncrypted: _, ...rest } = upsertData;
      await prisma.aiProviderConfig.create({ data: rest as never });
    } else {
      await prisma.aiProviderConfig.create({ data: upsertData as never });
    }
  }

  await recordAudit({
    actorId: user.userId, action: "upsert", entityType: "ai_provider_config",
    afterValue: { label, baseUrl, defaultModelName } as never,
  });

  revalidatePath("/settings/ai");
  return { success: `AI provider "${label}" saved.` };
}

export async function deleteAiProviderAction(id: string): Promise<AiProviderState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") return { error: "Not authorised." };

  await prisma.aiProviderConfig.delete({ where: { id } });
  revalidatePath("/settings/ai");
  return { success: "AI provider deleted." };
}
