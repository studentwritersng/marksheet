"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptSecret } from "@/lib/secrets";

export interface AiActionResult { error?: string; success?: string; }

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") return null;
  return user;
}

export async function upsertAiProviderAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const label = String(formData.get("label") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const defaultModelName = String(formData.get("defaultModelName") ?? "").trim();
  const priority = parseInt(String(formData.get("priority") ?? "1"), 10) || 1;
  const isActive = formData.get("isActive") === "on";

  if (!label || !baseUrl || !defaultModelName) {
    return { error: "Label, base URL, and default model are required." };
  }

  const upsertData: Record<string, unknown> = { label, baseUrl, defaultModelName, priority, isActive };
  if (apiKey) upsertData.apiKeyEncrypted = encryptSecret(apiKey);

  if (id) {
    await prisma.aiProviderConfig.update({ where: { id }, data: upsertData as never });
  } else {
    await prisma.aiProviderConfig.create({ data: upsertData as never });
  }

  await recordAudit({
    actorId: user.userId, action: id ? "update" : "create", entityType: "ai_provider_config",
    afterValue: { label, baseUrl, defaultModelName, priority } as never,
  });

  revalidatePath("/console/ai");
  return { success: `AI provider "${label}" saved.` };
}

export async function setAiProviderPriorityAction(id: string, priority: number): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const p = parseInt(String(priority), 10);
  if (!id || !p || p < 1) return { error: "Provider ID and a priority of 1 or higher are required." };

  const provider = await prisma.aiProviderConfig.findUnique({ where: { id }, select: { label: true } });
  if (!provider) return { error: "Provider not found." };

  await prisma.aiProviderConfig.update({
    where: { id },
    data: { priority: p },
  });

  await recordAudit({
    actorId: user.userId, action: "update", entityType: "ai_provider_config",
    entityId: id, afterValue: { priority: p } as never,
  });

  revalidatePath("/console/ai");
  return { success: `"${provider.label}" priority set to ${p}.` };
}

export async function deleteAiProviderAction(id: string): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const provider = await prisma.aiProviderConfig.findUnique({ where: { id }, select: { label: true } });
  await prisma.aiProviderConfig.delete({ where: { id } });

  await recordAudit({
    actorId: user.userId, action: "delete", entityType: "ai_provider_config",
    beforeValue: { label: provider?.label } as never,
  });

  revalidatePath("/console/ai");
  return { success: `AI provider deleted.` };
}

export async function upsertTaskProfileAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const providerConfigId = String(formData.get("providerConfigId") ?? "");
  const taskType = String(formData.get("taskType") ?? "");
  const modelNameOverride = String(formData.get("modelNameOverride") ?? "").trim() || null;
  const temperature = parseFloat(String(formData.get("temperature") ?? "0.7"));
  const maxTokens = parseInt(String(formData.get("maxTokens") ?? "4096"));
  const systemPromptTemplate = String(formData.get("systemPromptTemplate") ?? "").trim() || null;

  if (!providerConfigId || !taskType) return { error: "Provider and task type are required." };

  await prisma.aiTaskProfile.upsert({
    where: { taskType_providerConfigId: { taskType, providerConfigId } },
    update: { modelNameOverride, temperature, maxTokens, systemPromptTemplate },
    create: { providerConfigId, taskType, modelNameOverride, temperature, maxTokens, systemPromptTemplate },
  });

  await recordAudit({
    actorId: user.userId, action: "upsert", entityType: "ai_task_profile",
    afterValue: { taskType, providerConfigId, modelNameOverride } as never,
  });

  revalidatePath("/console/ai");
  return { success: `Task profile for "${taskType}" saved.` };
}

export async function testAiConnectionAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();

  if (!baseUrl || !apiKey || !model) {
    return { error: "Base URL, API key, and model are required to test." };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Say 'ok' and nothing else." }], max_tokens: 10 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `Connection failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}` };
    }
    return { success: "Connection successful! The provider responded correctly." };
  } catch (e: any) {
    return { error: `Connection error: ${e?.message ?? "Unknown error"}` };
  }
}
